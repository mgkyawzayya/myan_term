//! Session persistence (T-042).
//!
//! Mirrors the shape of `settings::store` and `profiles::store`: a parking_lot
//! `RwLock` around an in-memory state, with `persist()` writing pretty JSON via
//! atomic temp-file rename. The pane tree is stored as opaque
//! `serde_json::Value` so the frontend retains exclusive ownership of its
//! schema (CLAUDE.md R3 — backend stays decoupled from React internals).
//!
//! Robustness contract: a corrupt / schema-mismatched `session.json` must
//! NEVER block startup. Both the file load path and `Default` impl prefer
//! "fresh empty session" over an error — losing the layout is acceptable;
//! crashing on launch is not.

use std::path::PathBuf;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    #[serde(default = "default_schema")]
    pub schema_version: u32,
    #[serde(default)]
    pub tabs: Vec<SessionTab>,
    #[serde(default)]
    pub active_tab_id: Option<String>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            schema_version: default_schema(),
            tabs: Vec::new(),
            active_tab_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTab {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub cwd: Option<String>,
    /// Pane tree as opaque JSON value — defined and validated on the frontend.
    /// Serialising it as `serde_json::Value` lets the backend stay agnostic to
    /// the React component's exact schema (CLAUDE.md R3 — no internals reach).
    pub pane_tree: serde_json::Value,
    pub focused_leaf_id: String,
    #[serde(default)]
    pub shell_override: Option<ShellOverride>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellOverride {
    #[serde(default)]
    pub program: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
}

fn default_schema() -> u32 {
    1
}

#[derive(Debug, Default)]
pub struct SessionStore {
    inner: RwLock<SessionState>,
    path: RwLock<Option<PathBuf>>,
}

impl SessionStore {
    pub fn load(app: &AppHandle) -> AppResult<Self> {
        let path = app
            .path()
            .app_data_dir()
            .map_err(|_| AppError::NoConfigDir)?
            .join("session.json");
        let inner = if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            // Robustness over correctness: a malformed session.json must never
            // block startup. Fall through to default (empty) on any parse
            // failure rather than propagating.
            serde_json::from_str::<SessionState>(&text).unwrap_or_default()
        } else {
            SessionState::default()
        };
        Ok(Self {
            inner: RwLock::new(inner),
            path: RwLock::new(Some(path)),
        })
    }

    pub fn get(&self) -> SessionState {
        self.inner.read().clone()
    }

    pub fn set(&self, state: SessionState) -> AppResult<()> {
        *self.inner.write() = state;
        self.persist()
    }

    fn persist(&self) -> AppResult<()> {
        let path = match self.path.read().clone() {
            Some(p) => p,
            None => return Ok(()),
        };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let payload = serde_json::to_string_pretty(&*self.inner.read())?;
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, payload)?;
        std::fs::rename(&tmp, &path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_schema_version_defaults_to_one() {
        // Payload that does NOT carry a `schema_version` key — the serde
        // default must fill it in instead of erroring.
        let payload = json!({
            "tabs": [],
            "active_tab_id": null,
        })
        .to_string();
        let state: SessionState = serde_json::from_str(&payload).expect("deserialize");
        assert_eq!(state.schema_version, 1);
        assert!(state.tabs.is_empty());
        assert!(state.active_tab_id.is_none());
    }

    #[test]
    fn round_trip_preserves_pane_tree_shape() {
        // Construct a SessionState carrying a JSON-shaped pane tree similar to
        // what the React frontend will serialise (a split with two leaf
        // children plus ratios). The backend treats it as opaque JSON.
        let pane_tree = json!({
            "kind": "split",
            "id": "split-1",
            "orientation": "horizontal",
            "ratios": [0.5, 0.5],
            "children": [
                { "kind": "leaf", "id": "leaf-a" },
                { "kind": "leaf", "id": "leaf-b" }
            ]
        });
        let state = SessionState {
            schema_version: 1,
            active_tab_id: Some("tab-1".into()),
            tabs: vec![SessionTab {
                id: "tab-1".into(),
                title: "Terminal".into(),
                cwd: Some("/tmp".into()),
                pane_tree: pane_tree.clone(),
                focused_leaf_id: "leaf-a".into(),
                shell_override: Some(ShellOverride {
                    program: Some("/bin/zsh".into()),
                    args: vec!["-l".into()],
                }),
            }],
        };
        let serialised = serde_json::to_string(&state).expect("serialize");
        let parsed: SessionState = serde_json::from_str(&serialised).expect("deserialize");
        assert_eq!(parsed.schema_version, 1);
        assert_eq!(parsed.tabs.len(), 1);
        assert_eq!(parsed.tabs[0].id, "tab-1");
        assert_eq!(parsed.tabs[0].pane_tree, pane_tree);
        assert_eq!(parsed.tabs[0].focused_leaf_id, "leaf-a");
        let shell = parsed.tabs[0].shell_override.as_ref().expect("shell override");
        assert_eq!(shell.program.as_deref(), Some("/bin/zsh"));
        assert_eq!(shell.args, vec!["-l".to_string()]);
    }
}
