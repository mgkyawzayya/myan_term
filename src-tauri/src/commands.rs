use tauri::State;

use crate::errors::AppResult;
use crate::profiles::ssh::{profile_to_command as build_command, SshCommand};
use crate::profiles::{ProfileStore, SshProfile};
use crate::pty::manager::{PtyManager, PtySpawnArgs};
use crate::sessions::{SessionState, SessionStore};
use crate::settings::{Settings, SettingsStore};

#[tauri::command]
pub fn pty_spawn(
    args: PtySpawnArgs,
    manager: State<'_, PtyManager>,
) -> AppResult<serde_json::Value> {
    let id = manager.spawn(args)?;
    Ok(serde_json::json!({ "pty_id": id }))
}

#[tauri::command]
pub fn pty_write(pty_id: String, data: String, manager: State<'_, PtyManager>) -> AppResult<()> {
    manager.write(&pty_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    pty_id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
) -> AppResult<()> {
    manager.resize(&pty_id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(pty_id: String, manager: State<'_, PtyManager>) -> AppResult<()> {
    manager.kill(&pty_id)
}

#[tauri::command]
pub fn pty_list(manager: State<'_, PtyManager>) -> AppResult<Vec<String>> {
    Ok(manager.list())
}

#[tauri::command]
pub fn profile_list(store: State<'_, ProfileStore>) -> AppResult<Vec<SshProfile>> {
    Ok(store.list())
}

#[tauri::command]
pub fn profile_save(profile: SshProfile, store: State<'_, ProfileStore>) -> AppResult<()> {
    store.save(profile)
}

#[tauri::command]
pub fn profile_delete(id: String, store: State<'_, ProfileStore>) -> AppResult<()> {
    store.delete(&id)
}

#[tauri::command]
pub fn profile_to_command(id: String, store: State<'_, ProfileStore>) -> AppResult<SshCommand> {
    let profile = store
        .get(&id)
        .ok_or(crate::errors::AppError::ProfileNotFound(id.clone()))?;
    Ok(build_command(&profile))
}

#[tauri::command]
pub fn session_load(store: State<'_, SessionStore>) -> AppResult<SessionState> {
    Ok(store.get())
}

#[tauri::command]
pub fn session_save(state: SessionState, store: State<'_, SessionStore>) -> AppResult<()> {
    store.set(state)
}

#[tauri::command]
pub fn settings_get(store: State<'_, SettingsStore>) -> AppResult<Settings> {
    Ok(store.get())
}

#[tauri::command]
pub fn settings_set(settings: Settings, store: State<'_, SettingsStore>) -> AppResult<()> {
    store.set(settings)
}

#[tauri::command]
pub fn ssh_config_hosts() -> AppResult<Vec<String>> {
    Ok(crate::profiles::ssh_config::read_hosts().unwrap_or_default())
}

#[tauri::command]
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
