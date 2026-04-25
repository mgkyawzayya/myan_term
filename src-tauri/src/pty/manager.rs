//! PTY lifecycle manager.
//!
//! Each spawned PTY gets a UUID, a writer handle, and a background thread
//! that pumps stdout bytes into the webview via Tauri events.
//!
//! Per CLAUDE.md R4: PTY data is bytes, not strings. We decode UTF-8 lossily
//! at the boundary to the webview so binary garbage doesn't crash anything.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;

use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};
use super::platform;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySpawnArgs {
    #[serde(default)]
    pub shell: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub env: Option<HashMap<String, String>>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyDataEvent {
    pub pty_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PtyExitEvent {
    pub pty_id: String,
    pub code: Option<i32>,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    app: AppHandle,
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn list(&self) -> Vec<String> {
        self.sessions.lock().keys().cloned().collect()
    }

    pub fn spawn(&self, args: PtySpawnArgs) -> AppResult<String> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows: args.rows.max(1),
            cols: args.cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = pty_system
            .openpty(size)
            .map_err(|e| AppError::Pty(format!("openpty failed: {e}")))?;

        let (program, default_args) = match args.shell.as_ref() {
            Some(s) if !s.trim().is_empty() => (s.clone(), Vec::<String>::new()),
            _ => platform::default_shell(),
        };

        let mut cmd = CommandBuilder::new(&program);
        let extra_args = args.args.unwrap_or(default_args);
        for a in extra_args {
            cmd.arg(a);
        }
        if let Some(cwd) = args.cwd.as_ref() {
            cmd.cwd(cwd);
        } else if let Some(home) = home_dir() {
            cmd.cwd(home);
        }

        cmd.env("TERM", platform::default_term());
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "MyanTerm");
        cmd.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"));
        if let Some(env) = args.env.as_ref() {
            for (k, v) in env.iter() {
                cmd.env(k, v);
            }
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| AppError::Pty(format!("spawn failed: {e}")))?;
        drop(pair.slave);

        let id = Uuid::new_v4().to_string();
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| AppError::Pty(format!("clone_reader failed: {e}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| AppError::Pty(format!("take_writer failed: {e}")))?;

        self.sessions.lock().insert(
            id.clone(),
            PtySession {
                master: pair.master,
                writer,
            },
        );

        let app = self.app.clone();
        let sessions = self.sessions.clone();
        let id_for_thread = id.clone();
        std::thread::Builder::new()
            .name(format!("pty-reader-{id}"))
            .spawn(move || {
                let mut buf = vec![0u8; 32 * 1024];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => {
                            // Lossy UTF-8 — invalid bytes become U+FFFD; the
                            // terminal parser sees a valid string and the
                            // webview never crashes on binary garbage.
                            let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                            let evt = PtyDataEvent {
                                pty_id: id_for_thread.clone(),
                                data: chunk,
                            };
                            if let Err(err) = app.emit("pty:data", evt) {
                                tracing::warn!(?err, "failed emitting pty:data");
                                break;
                            }
                        }
                        Err(e) => {
                            tracing::debug!(?e, "pty read error");
                            break;
                        }
                    }
                }

                let code = child
                    .wait()
                    .ok()
                    .and_then(|s| s.exit_code().try_into().ok());
                let _ = app.emit(
                    "pty:exit",
                    PtyExitEvent {
                        pty_id: id_for_thread.clone(),
                        code,
                    },
                );
                sessions.lock().remove(&id_for_thread);
            })
            .map_err(|e| AppError::Pty(format!("spawn reader thread: {e}")))?;

        Ok(id)
    }

    pub fn write(&self, pty_id: &str, data: &str) -> AppResult<()> {
        let mut guard = self.sessions.lock();
        let session = guard
            .get_mut(pty_id)
            .ok_or_else(|| AppError::PtyNotFound(pty_id.to_string()))?;
        session.writer.write_all(data.as_bytes())?;
        session.writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, pty_id: &str, cols: u16, rows: u16) -> AppResult<()> {
        let guard = self.sessions.lock();
        let session = guard
            .get(pty_id)
            .ok_or_else(|| AppError::PtyNotFound(pty_id.to_string()))?;
        session
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| AppError::Pty(format!("resize failed: {e}")))?;
        Ok(())
    }

    pub fn kill(&self, pty_id: &str) -> AppResult<()> {
        let mut guard = self.sessions.lock();
        let session = guard
            .remove(pty_id)
            .ok_or_else(|| AppError::PtyNotFound(pty_id.to_string()))?;
        // Dropping master triggers EOF on the reader thread; writer drops with it.
        drop(session);
        Ok(())
    }
}

fn home_dir() -> Option<String> {
    directories::UserDirs::new()
        .and_then(|d| d.home_dir().to_str().map(|s| s.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spawn_args_round_trip() {
        let json = r#"{"shell":"/bin/sh","args":["-l"],"cols":80,"rows":24}"#;
        let parsed: PtySpawnArgs = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.cols, 80);
        assert_eq!(parsed.rows, 24);
        assert_eq!(parsed.args.as_ref().unwrap()[0], "-l");
    }
}
