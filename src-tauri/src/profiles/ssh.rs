//! Map an SshProfile to an `ssh` command-line invocation.
//!
//! The contract from CLAUDE.md §4: we never bundle an SSH client. We spawn
//! the user's `ssh` binary with arguments derived from the profile, and the
//! user's `~/.ssh/config`, ssh-agent, and ProxyJump infrastructure carry the
//! real load.

use std::collections::HashMap;

use serde::Serialize;

use super::store::SshProfile;

#[derive(Debug, Clone, Serialize)]
pub struct SshCommand {
    pub argv: Vec<String>,
    pub env: HashMap<String, String>,
}

pub fn profile_to_command(profile: &SshProfile) -> SshCommand {
    let mut argv: Vec<String> = vec!["ssh".to_string()];

    if let Some(port) = profile.port {
        argv.push("-p".to_string());
        argv.push(port.to_string());
    }
    if let Some(key) = profile.identity_file.as_ref() {
        if !key.trim().is_empty() {
            argv.push("-i".to_string());
            argv.push(key.clone());
        }
    }
    if let Some(jump) = profile.jump_host.as_ref() {
        if !jump.trim().is_empty() {
            argv.push("-J".to_string());
            argv.push(jump.clone());
        }
    }
    if let Some(extra) = profile.extra_args.as_ref() {
        for a in extra {
            argv.push(a.clone());
        }
    }

    let target = match profile.user.as_ref() {
        Some(u) if !u.is_empty() => format!("{}@{}", u, profile.host),
        _ => profile.host.clone(),
    };
    argv.push(target);

    if let Some(cmd) = profile.remote_command.as_ref() {
        if !cmd.trim().is_empty() {
            // Remote command is appended literally; ssh runs it through the
            // remote shell, so callers may include their own quoting.
            argv.push(cmd.clone());
        }
    }

    SshCommand {
        argv,
        env: HashMap::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> SshProfile {
        SshProfile {
            id: "x".to_string(),
            name: "test".to_string(),
            host: "example.com".to_string(),
            user: None,
            port: None,
            identity_file: None,
            jump_host: None,
            remote_command: None,
            extra_args: None,
            group: None,
        }
    }

    #[test]
    fn host_only() {
        let cmd = profile_to_command(&base());
        assert_eq!(cmd.argv, vec!["ssh", "example.com"]);
    }

    #[test]
    fn user_port_key_jump() {
        let mut p = base();
        p.user = Some("alice".into());
        p.port = Some(2222);
        p.identity_file = Some("~/.ssh/id_ed25519".into());
        p.jump_host = Some("bastion".into());
        let cmd = profile_to_command(&p);
        assert_eq!(
            cmd.argv,
            vec![
                "ssh",
                "-p",
                "2222",
                "-i",
                "~/.ssh/id_ed25519",
                "-J",
                "bastion",
                "alice@example.com"
            ]
        );
    }

    #[test]
    fn extra_args_and_remote_command() {
        let mut p = base();
        p.extra_args = Some(vec![
            "-A".into(),
            "-o".into(),
            "ServerAliveInterval=30".into(),
        ]);
        p.remote_command = Some("tmux new -A -s main".into());
        let cmd = profile_to_command(&p);
        assert!(cmd.argv.contains(&"-A".to_string()));
        assert_eq!(cmd.argv.last().unwrap(), "tmux new -A -s main");
    }
}
