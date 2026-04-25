//! MyanTerm Tauri backend.
//!
//! Responsibilities:
//!   - PTY lifecycle (spawn, write, resize, kill) via `portable-pty`.
//!   - SSH profile + settings persistence as JSON in the platform app data dir.
//!   - Tauri command handlers wired into the React frontend.

mod commands;
mod errors;
mod logging;
mod profiles;
mod pty;
mod settings;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _log_guard = logging::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(pty::PtyManager::new(handle.clone()));
            app.manage(profiles::ProfileStore::load(&handle).unwrap_or_default());
            app.manage(settings::SettingsStore::load(&handle).unwrap_or_default());
            tracing::info!("MyanTerm backend initialised");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
            commands::pty_list,
            commands::profile_list,
            commands::profile_save,
            commands::profile_delete,
            commands::profile_to_command,
            commands::settings_get,
            commands::settings_set,
            commands::version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MyanTerm");
}
