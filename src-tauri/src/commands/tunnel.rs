//! `commands/tunnel.rs`
//! Handles Argo Tunnel lifecycle and management (start, stop, list, delete, etc.)

use crate::state::AppState;
use crate::utils::make_command;
use serde::Serialize;
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Serialize, Clone)]
pub struct LogMessage {
    pub tunnel_name: String,
    pub message: String,
    pub log_type: String, // "info", "error", "success"
}

#[derive(Serialize, Clone)]
pub struct TunnelMetrics {
    pub tunnel_name: String,
    pub req_count: u64,
    /// Total request errors (4xx/5xx from cloudflared metrics, 0 if not exposed)
    pub error_count: u64,
    /// Bytes sent client→origin (0 if cloudflared does not expose this metric)
    pub bytes_in: u64,
    /// Bytes sent origin→client (0 if cloudflared does not expose this metric)
    pub bytes_out: u64,
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

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let metrics_port = listener.local_addr().unwrap().port();
    drop(listener);

    let mut args = vec![
        "tunnel".to_string(),
        "--metrics".to_string(),
        format!("localhost:{}", metrics_port),
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

    let bin_path = if !cloudflared_path.trim().is_empty() {
        cloudflared_path
    } else {
        let default_path = crate::commands::setup::get_default_cloudflared_path(&app);
        if default_path.exists() {
            default_path.to_string_lossy().to_string()
        } else {
            "cloudflared".to_string()
        }
    };

    let mut child = make_command(&bin_path)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
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
            let _ = app_clone1.emit(
                "tunnel-log",
                LogMessage {
                    tunnel_name: tunnel_name_clone1.clone(),
                    message: line,
                    log_type: "info".to_string(),
                },
            );
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

            let _ = app_clone2.emit(
                "tunnel-log",
                LogMessage {
                    tunnel_name: tunnel_name_clone2.clone(),
                    message: line,
                    log_type: log_type.to_string(),
                },
            );
        }

        let _ = app_clone2.emit(
            "tunnel-log",
            LogMessage {
                tunnel_name: tunnel_name_clone2.clone(),
                message: "Proses cloudflared telah berhenti.".to_string(),
                log_type: "info".to_string(),
            },
        );
    });

    process_guard.insert(tunnel_name.clone(), child);

    // Spawn metrics scraper
    let app_clone3 = app.clone();
    let tunnel_name_clone3 = tunnel_name.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/metrics", metrics_port);
        let mut last_reqs = 0;

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            // Check if process is still running via state
            // If it's killed, this loop will eventually fail the reqwest and we can break.
            if let Ok(res) = client.get(&url).send().await {
                if let Ok(text) = res.text().await {
                    let mut req_count = last_reqs;
                    let mut error_count = 0u64;
                    let mut bytes_in = 0u64;
                    let mut bytes_out = 0u64;

                    for line in text.lines() {
                        // Skip Prometheus comments and empty lines
                        if line.starts_with('#') || line.trim().is_empty() {
                            continue;
                        }
                        // Parse: "metric_name{labels} value" or "metric_name value"
                        // Value is the last whitespace token; name is before the first '{'
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        let value: u64 = match parts.last().and_then(|v| v.parse::<f64>().ok()) {
                            Some(v) => v as u64,
                            None => continue,
                        };
                        let name = parts.first().unwrap_or(&"").split('{').next().unwrap_or("");

                        match name {
                            // Request counter (name varies across cloudflared versions)
                            "cloudflared_tunnel_total_requests"
                            | "cloudflared_tunnel_total_requests_total" => {
                                req_count = value;
                            }
                            // Error counter
                            "cloudflared_tunnel_request_errors"
                            | "cloudflared_tunnel_request_errors_total"
                            | "cloudflared_tunnel_response_error_total" => {
                                error_count = error_count.saturating_add(value);
                            }
                            // Bytes sent client → origin (request side)
                            "cloudflared_proxy_request_bytes_total"
                            | "cloudflared_tunnel_bytes_sent"
                            | "cloudflared_tunnel_bytes_sent_total" => {
                                bytes_in = value;
                            }
                            // Bytes sent origin → client (response side)
                            "cloudflared_proxy_response_bytes_total"
                            | "cloudflared_tunnel_bytes_recv"
                            | "cloudflared_tunnel_bytes_recv_total" => {
                                bytes_out = value;
                            }
                            _ => {}
                        }
                    }

                    // Emit whenever the tunnel is active (not just when req_count > 0)
                    // so that the frontend can track bytes even before any requests arrive.
                    if req_count > 0 || bytes_in > 0 || bytes_out > 0 || error_count > 0 {
                        last_reqs = req_count;
                        let _ = app_clone3.emit(
                            "tunnel-metrics",
                            TunnelMetrics {
                                tunnel_name: tunnel_name_clone3.clone(),
                                req_count,
                                error_count,
                                bytes_in,
                                bytes_out,
                            },
                        );
                    }
                }
            } else {
                // Fails to connect, means cloudflared is down or restarting. Break the scraper.
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_tunnel(state: State<'_, AppState>, tunnel_name: String) -> Result<(), String> {
    // Case 1: Process was started by this session — kill it directly.
    let mut process_guard = state.tunnel_processes.lock().await;
    if let Some(mut child) = process_guard.remove(&tunnel_name) {
        let _ = child.kill().await;
        return Ok(());
    }
    drop(process_guard);

    // Case 2: Orphaned process (app restarted / logoff-logon while cloudflared kept running).
    // Best-effort: search the OS process list for a cloudflared process whose command line
    // contains the tunnel name and terminate it.
    #[cfg(target_os = "windows")]
    {
        // WMIC approach — works on Windows 7 through 11.
        // We run two queries: exact end-of-line match first, then a broader substring match.
        let exact_filter = format!(
            "name='cloudflared.exe' and CommandLine like '% {}'",
            tunnel_name
        );
        let _ = make_command("wmic")
            .args(["process", "where", &exact_filter, "call", "terminate"])
            .output()
            .await;

        let broad_filter = format!(
            "name='cloudflared.exe' and CommandLine like '%{}%'",
            tunnel_name
        );
        let _ = make_command("wmic")
            .args(["process", "where", &broad_filter, "call", "terminate"])
            .output()
            .await;
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On macOS / Linux use pkill with a regex matching the tunnel name in args.
        let pattern = format!("cloudflared.*{}", tunnel_name);
        let _ = tokio::process::Command::new("pkill")
            .args(["-f", &pattern])
            .output()
            .await;
    }

    Ok(())
}

#[tauri::command]
pub async fn auto_tunnel_setup(
    app: tauri::AppHandle,
    cloudflared_path: String,
    tunnel_name: String,
    subdomain: String,
    _local_url: String,
) -> Result<String, String> {
    let bin_path = if !cloudflared_path.trim().is_empty() {
        cloudflared_path
    } else {
        let default_path = crate::commands::setup::get_default_cloudflared_path(&app);
        if default_path.exists() {
            default_path.to_string_lossy().to_string()
        } else {
            "cloudflared".to_string()
        }
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
        if route_err.contains("already exists")
            || route_err.contains("Validation Error")
            || route_err.to_lowercase().contains("error")
        {
            // Cleanup the created orphan tunnel since routing failed
            let _ = make_command(&bin_path)
                .args(["tunnel", "delete", "-f", &tunnel_name])
                .output()
                .await;

            return Err(format!("DNS Route failed: {}", route_err.trim()));
        }
    }

    Ok(format!(
        "Setup complete. Out: {} Err: {}",
        route_out, route_err
    ))
}

#[tauri::command]
pub async fn list_tunnels(
    app: tauri::AppHandle,
    cloudflared_path: String,
) -> Result<String, String> {
    let bin_path = if !cloudflared_path.trim().is_empty() {
        cloudflared_path
    } else {
        let default_path = crate::commands::setup::get_default_cloudflared_path(&app);
        if default_path.exists() {
            default_path.to_string_lossy().to_string()
        } else {
            "cloudflared".to_string()
        }
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
pub async fn delete_tunnel(
    app: tauri::AppHandle,
    cloudflared_path: String,
    tunnel_name: String,
) -> Result<String, String> {
    let bin_path = if !cloudflared_path.trim().is_empty() {
        cloudflared_path
    } else {
        let default_path = crate::commands::setup::get_default_cloudflared_path(&app);
        if default_path.exists() {
            default_path.to_string_lossy().to_string()
        } else {
            "cloudflared".to_string()
        }
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
