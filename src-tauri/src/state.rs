//! `state.rs`
//! Defines the shared state models for the application.

use std::collections::HashMap;
use command_group::AsyncGroupChild;
use tokio::sync::Mutex;

/// Shared application state managed by Tauri.
#[derive(Default)]
pub struct AppState {
    /// Menyimpan process cloudflared berdasarkan tunnel name / ID agar bisa multi-tunnel
    pub tunnel_processes: Mutex<HashMap<String, AsyncGroupChild>>,
}
