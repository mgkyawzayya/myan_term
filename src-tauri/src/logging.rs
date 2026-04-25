use directories::ProjectDirs;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init() -> Option<WorkerGuard> {
    let env_filter =
        EnvFilter::try_from_env("MYANTERM_LOG").unwrap_or_else(|_| EnvFilter::new("info"));

    let (file_layer, guard) = match log_dir() {
        Some(dir) => {
            std::fs::create_dir_all(&dir).ok();
            let appender = tracing_appender::rolling::daily(dir, "myanterm.log");
            let (nb, guard) = tracing_appender::non_blocking(appender);
            (
                Some(fmt::layer().with_ansi(false).with_writer(nb)),
                Some(guard),
            )
        }
        None => (None, None),
    };

    let subscriber = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_ansi(true))
        .with(file_layer);

    if let Err(e) = subscriber.try_init() {
        eprintln!("logging init failed: {e}");
    }
    guard
}

fn log_dir() -> Option<std::path::PathBuf> {
    let dirs = ProjectDirs::from("app", "MyanTerm", "MyanTerm")?;
    Some(dirs.data_local_dir().join("logs"))
}
