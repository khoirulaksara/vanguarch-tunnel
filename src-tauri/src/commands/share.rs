use warp::Filter;
use tokio::sync::oneshot;
use tauri::{AppHandle, State};
use crate::state::AppState;

#[tauri::command]
pub async fn start_static_server(
    _app: AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<u16, String> {
    let route = warp::fs::dir(folder_path.clone());
    
    // Add CORS if needed, but for tunneling it's usually fine
    let cors = warp::cors().allow_any_origin();
    let route = route.with(cors);

    let (tx, rx) = oneshot::channel();
    
    let (addr, server) = warp::serve(route)
        .bind_with_graceful_shutdown(([127, 0, 0, 1], 0), async {
            rx.await.ok();
        });
        
    tokio::spawn(server);
    
    let port = addr.port();
    
    let mut servers = state.share_servers.lock().await;
    servers.insert(port, tx);
    
    Ok(port)
}

#[tauri::command]
pub async fn stop_static_server(
    state: State<'_, AppState>,
    port: u16,
) -> Result<(), String> {
    let mut servers = state.share_servers.lock().await;
    if let Some(tx) = servers.remove(&port) {
        let _ = tx.send(());
    }
    Ok(())
}
