//! `commands/system.rs`
//! Handles system-level operations like checking ports and forcing exit.

use serde::Serialize;
use std::env;

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
        let is_open =
            tokio::task::spawn_blocking(move || TcpStream::connect_timeout(&addr, timeout).is_ok())
                .await
                .unwrap_or(false);

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
pub fn get_username() -> String {
    // Windows: USERNAME, macOS/Linux: USER, Linux fallback: LOGNAME
    env::var("USERNAME")
        .or_else(|_| env::var("USER"))
        .or_else(|_| env::var("LOGNAME"))
        .unwrap_or_else(|_| "Developer".to_string())
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

#[derive(Serialize)]
pub struct PingResult {
    pub status: u16,
    pub ok: bool,
    pub latency_ms: u64,
}

#[derive(Serialize)]
pub struct InternetStatus {
    pub online: bool,
    pub latency_ms: u64,
}

#[tauri::command]
pub async fn check_internet() -> Result<InternetStatus, String> {
    use std::net::{SocketAddr, TcpStream};
    use std::time::{Duration, Instant};

    let targets: Vec<SocketAddr> = vec![
        "1.1.1.1:443".parse().unwrap(),
        "8.8.8.8:443".parse().unwrap(),
        "9.9.9.9:443".parse().unwrap(),
    ];
    let timeout = Duration::from_secs(3);

    let result = tokio::task::spawn_blocking(move || {
        let start = Instant::now();
        for addr in &targets {
            if TcpStream::connect_timeout(addr, timeout).is_ok() {
                return Some(start.elapsed().as_millis() as u64);
            }
        }
        None
    })
    .await
    .unwrap_or(None);

    match result {
        Some(ms) => Ok(InternetStatus { online: true, latency_ms: ms }),
        None => Ok(InternetStatus { online: false, latency_ms: 0 }),
    }
}

#[tauri::command]
pub async fn ping_url(url: String) -> Result<PingResult, String> {
    use std::time::Instant;
    let start = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    match client.get(&url).send().await {
        Ok(response) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let status = response.status().as_u16();
            let ok = status >= 200 && status < 400;
            Ok(PingResult {
                status,
                ok,
                latency_ms,
            })
        }
        Err(e) => Err(format!("unreachable: {}", e)),
    }
}
