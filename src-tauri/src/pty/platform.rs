//! Platform-specific PTY defaults.

#[cfg(target_os = "windows")]
pub fn default_shell() -> (String, Vec<String>) {
    if let Ok(shell) = std::env::var("COMSPEC") {
        return (shell, vec![]);
    }
    ("powershell.exe".to_string(), vec![])
}

#[cfg(not(target_os = "windows"))]
pub fn default_shell() -> (String, Vec<String>) {
    if let Ok(shell) = std::env::var("SHELL") {
        return (shell, vec!["-l".to_string()]);
    }
    ("/bin/sh".to_string(), vec!["-l".to_string()])
}

pub fn default_term() -> &'static str {
    "xterm-256color"
}
