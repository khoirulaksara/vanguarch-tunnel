//! `commands/system.rs`
//! Handles system-level operations like checking ports and forcing exit.

use serde::Serialize;

#[derive(Serialize)]
pub struct PortStatus {
    pub port: u16,
    pub is_open: bool,
    pub description: String,
}

#[tauri::command]
pub async fn check_ports() -> Result<Vec<PortStatus>, String> {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    let ports_to_check = vec![
        (80, "HTTP"),
        (443, "HTTPS"),
        (3000, "Node / React"),
        (3306, "MySQL"),
        (5432, "PostgreSQL"),
        (8000, "Dev Server"),
    ];
    let mut status = Vec::new();
    let timeout = Duration::from_millis(50);
    
    for (port, desc) in ports_to_check {
        let addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
        let is_open = tokio::task::spawn_blocking(move || {
            TcpStream::connect_timeout(&addr, timeout).is_ok()
        }).await.unwrap_or(false);
        
        status.push(PortStatus {
            port,
            is_open,
            description: desc.to_string(),
        });
    }
    Ok(status)
}

#[tauri::command]
pub fn force_exit() {
    std::process::exit(0);
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
