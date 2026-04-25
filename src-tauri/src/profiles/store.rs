use std::collections::HashMap;
use std::path::PathBuf;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub identity_file: Option<String>,
    #[serde(default)]
    pub jump_host: Option<String>,
    #[serde(default)]
    pub remote_command: Option<String>,
    #[serde(default)]
    pub extra_args: Option<Vec<String>>,
    #[serde(default)]
    pub group: Option<String>,
}

impl SshProfile {
    #[allow(dead_code)] // exposed for tests / future programmatic creation
    pub fn new(name: impl Into<String>, host: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            host: host.into(),
            user: None,
            port: None,
            identity_file: None,
            jump_host: None,
            remote_command: None,
            extra_args: None,
            group: None,
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct StoreFile {
    #[serde(default = "default_schema_version")]
    schema_version: u32,
    #[serde(default)]
    profiles: HashMap<String, SshProfile>,
}

fn default_schema_version() -> u32 {
    1
}

#[derive(Debug, Default)]
pub struct ProfileStore {
    inner: RwLock<StoreFile>,
    path: RwLock<Option<PathBuf>>,
}

impl ProfileStore {
    pub fn load(app: &AppHandle) -> AppResult<Self> {
        let path = app
            .path()
            .app_data_dir()
            .map_err(|_| AppError::NoConfigDir)?
            .join("profiles.json");
        let inner = if path.exists() {
            let text = std::fs::read_to_string(&path)?;
            serde_json::from_str::<StoreFile>(&text).unwrap_or_default()
        } else {
            StoreFile::default()
        };
        Ok(Self {
            inner: RwLock::new(inner),
            path: RwLock::new(Some(path)),
        })
    }

    pub fn list(&self) -> Vec<SshProfile> {
        let mut v: Vec<SshProfile> = self.inner.read().profiles.values().cloned().collect();
        v.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        v
    }

    pub fn save(&self, mut profile: SshProfile) -> AppResult<()> {
        if profile.id.trim().is_empty() {
            profile.id = Uuid::new_v4().to_string();
        }
        self.inner
            .write()
            .profiles
            .insert(profile.id.clone(), profile);
        self.persist()
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        if self.inner.write().profiles.remove(id).is_none() {
            return Err(AppError::ProfileNotFound(id.to_string()));
        }
        self.persist()
    }

    pub fn get(&self, id: &str) -> Option<SshProfile> {
        self.inner.read().profiles.get(id).cloned()
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
