//! `commands/tunnel.rs`
//! Handles Argo Tunnel lifecycle and management (start, stop, list, delete, etc.)

use serde::Serialize;
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use crate::state::AppState;
use crate::utils::make_command;

#[derive(Serialize, Clone)]
pub struct LogMessage {
    pub tunnel_name: String,
    pub message: String,
    pub log_type: String, // "info", "error", "success"
}

#[tauri::command]
pub async fn start_tunnel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    cloudflared_path: String,
    local_url: String,
    public_domain: String,
    tunnel_name: String,
    http_host_header: bool,
    origin_server_name: bool,
    force_http2: bool,
    ipv4_only: bool,
) -> Result<(), String> {
    // Hentikan proses yang sedang berjalan untuk tunnel ini (jika ada)
    let mut process_guard = state.tunnel_processes.lock().await;
    if let Some(mut child) = process_guard.remove(&tunnel_name) {
        let _ = child.kill().await;
    }

    let mut args = vec![
        "tunnel".to_string(),
        "--url".to_string(),
        local_url.clone(),
    ];

    if http_host_header {
        args.push("--http-host-header".to_string());
        args.push(public_domain.clone());
    }
    
    if origin_server_name {
        args.push("--origin-server-name".to_string());
        args.push(public_domain.clone());
    }

    if force_http2 {
        args.push("--force-http2".to_string());
    }

    if ipv4_only {
        args.push("--edge-ip-version".to_string());
        args.push("4".to_string());
    }

    args.push("run".to_string());
    args.push(tunnel_name.clone());

    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let mut child = make_command(&bin_path)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true) // Memastikan proses berhenti saat app tutup
        .spawn()
        .map_err(|e| format!("Gagal menjalankan cloudflared: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Stream Stdout
    let app_clone1 = app.clone();
    let tunnel_name_clone1 = tunnel_name.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone1.emit("tunnel-log", LogMessage {
                tunnel_name: tunnel_name_clone1.clone(),
                message: line,
                log_type: "info".to_string(),
            });
        }
    });

    // Stream Stderr (cloudflared biasanya menggunakan stderr untuk logging utama)
    let app_clone2 = app.clone();
    let tunnel_name_clone2 = tunnel_name.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let log_type = if line.contains("ERR") || line.contains("error") {
                "error"
            } else if line.contains("Registered tunnel connection") {
                "success"
            } else {
                "info"
            };

            let _ = app_clone2.emit("tunnel-log", LogMessage {
                tunnel_name: tunnel_name_clone2.clone(),
                message: line,
                log_type: log_type.to_string(),
            });
        }
        
        let _ = app_clone2.emit("tunnel-log", LogMessage {
            tunnel_name: tunnel_name_clone2.clone(),
            message: "Proses cloudflared telah berhenti.".to_string(),
            log_type: "info".to_string(),
        });
    });

    process_guard.insert(tunnel_name.clone(), child);

    Ok(())
}

#[tauri::command]
pub async fn stop_tunnel(state: State<'_, AppState>, tunnel_name: String) -> Result<(), String> {
    let mut process_guard = state.tunnel_processes.lock().await;
    if let Some(mut child) = process_guard.remove(&tunnel_name) {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn auto_tunnel_setup(
    cloudflared_path: String,
    tunnel_name: String,
    subdomain: String,
) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    // Check if tunnel exists
    let list_cmd = make_command(&bin_path)
        .args(["tunnel", "list"])
        .output()
        .await
        .map_err(|e| format!("Failed to run cloudflared list: {}", e))?;

    let list_out = String::from_utf8_lossy(&list_cmd.stdout);
    
    // Check for EXACT tunnel name match in the output
    let name_exists = list_out.lines().any(|line| {
        let parts: Vec<&str> = line.split_whitespace().collect();
        parts.get(1) == Some(&tunnel_name.as_str())
    });

    if name_exists {
        return Err(format!("Tunnel {} already exists", tunnel_name));
    }

    // 1. Create tunnel
    let _create_cmd = make_command(&bin_path)
        .args(["tunnel", "create", &tunnel_name])
        .output()
        .await
        .map_err(|e| format!("Failed to run cloudflared create: {}", e))?;

    // We ignore errors here because the tunnel might already exist.
    // If you want better logging, you could capture create_cmd.stderr.

    // 2. Route DNS (use -f to overwrite existing CNAME if tunnel was previously deleted)
    let route_cmd = make_command(&bin_path)
        .args(["tunnel", "route", "dns", "-f", &tunnel_name, &subdomain])
        .output()
        .await
        .map_err(|e| format!("Failed to run cloudflared route: {}", e))?;

    let route_err = String::from_utf8_lossy(&route_cmd.stderr).to_string();
    let route_out = String::from_utf8_lossy(&route_cmd.stdout).to_string();
    
    // If the DNS route is already in use or fails, we should bubble that error up
    if !route_cmd.status.success() {
        if route_err.contains("already exists") || route_err.contains("Validation Error") || route_err.to_lowercase().contains("error") {
            // Cleanup the created orphan tunnel since routing failed
            let _ = make_command(&bin_path).args(["tunnel", "delete", "-f", &tunnel_name]).output().await;

            return Err(format!("DNS Route failed: {}", route_err.trim()));
        }
    }
    
    Ok(format!("Setup complete. Out: {} Err: {}", route_out, route_err))
}

#[tauri::command]
pub async fn list_tunnels(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let list_cmd = make_command(&bin_path)
        .args(["tunnel", "list", "--output", "json"])
        .output()
        .await
        .map_err(|e| format!("Failed to run cloudflared list: {}", e))?;

    if !list_cmd.status.success() {
        return Err(String::from_utf8_lossy(&list_cmd.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&list_cmd.stdout).to_string())
}

#[tauri::command]
pub async fn delete_tunnel(cloudflared_path: String, tunnel_name: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let delete_cmd = make_command(&bin_path)
        .args(["tunnel", "delete", "-f", &tunnel_name])
        .output()
        .await
        .map_err(|e| format!("Failed to run cloudflared delete: {}", e))?;

    if !delete_cmd.status.success() {
        return Err(String::from_utf8_lossy(&delete_cmd.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&delete_cmd.stdout).to_string())
}
