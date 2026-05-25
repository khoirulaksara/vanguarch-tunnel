//! `utils.rs`
//! Shared utility functions for the application.

use tokio::process::Command;

/// Creates a new `tokio::process::Command` instance tailored for the current OS.
/// On Windows, it sets the creation flags to prevent opening a console window.
#[cfg(target_os = "windows")]
pub fn make_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    cmd.creation_flags(0x08000000);
    cmd
}

/// Creates a new `tokio::process::Command` instance tailored for the current OS.
#[cfg(not(target_os = "windows"))]
pub fn make_command(program: &str) -> Command {
    Command::new(program)
}
