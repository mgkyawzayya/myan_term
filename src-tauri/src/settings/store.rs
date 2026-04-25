use std::collections::HashMap;
use std::path::PathBuf;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontSettings {
    pub code_family: String,
    pub myanmar_family: String,
    pub size: f32,
    pub line_height: f32,
    pub letter_spacing: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorSettings {
    pub style: String,
    pub blink: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellSettings {
    pub program: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default = "default_schema")]
    pub schema_version: u32,
    pub theme: String,
    pub font: FontSettings,
    pub cursor: CursorSettings,
    pub shell: ShellSettings,
    pub scrollback: u32,
    pub bell: bool,
    pub webgl: bool,
}

fn default_schema() -> u32 {
    1
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            theme: "one-dark".to_string(),
            font: FontSettings {
                code_family: "JetBrains Mono".to_string(),
                myanmar_family: "Padauk".to_string(),
                size: 14.0,
                line_height: 1.2,
                letter_spacing: 0.0,
            },
            cursor: CursorSettings {
                style: "block".to_string(),
                blink: true,
            },
            shell: ShellSettings {
                program: None,
                args: Vec::new(),
                env: HashMap::new(),
            },
            scrollback: 10_000,
            bell: false,
            webgl: true,
        }
    }
}

#[derive(Debug, Default)]
pub struct SettingsStore {
    inner: RwLock<Settings>,
    path: RwLock<Option<PathBuf>>,
}

impl SettingsStore {
    pub fn load(app: &AppHandle) -> AppResult<Self> {
        let path = app
            .path()
            .app_data_dir()
            .map_err(|_| AppError::NoConfigDir)?
            .join("settings.json");
        let inner = if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            serde_json::from_str::<Settings>(&text).unwrap_or_default()
        } else {
            Settings::default()
        };
        Ok(Self {
            inner: RwLock::new(inner),
            path: RwLock::new(Some(path)),
        })
    }

    pub fn get(&self) -> Settings {
        self.inner.read().clone()
    }

    pub fn set(&self, settings: Settings) -> AppResult<()> {
        *self.inner.write() = settings;
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
