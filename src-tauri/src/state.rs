//! `state.rs`
//! Defines the shared state models for the application.

use std::collections::HashMap;

use tokio::sync::Mutex;

/// Shared application state managed by Tauri.
#[derive(Default)]
pub struct AppState {
    pub tunnel_processes: Mutex<HashMap<String, tokio::process::Child>>,
    pub share_servers: Mutex<HashMap<u16, tokio::sync::oneshot::Sender<()>>>,
    pub inspector_servers: Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>,
}
