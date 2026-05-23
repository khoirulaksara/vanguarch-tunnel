// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use serde::Serialize;

#[derive(Default)]
struct AppState {
    // Menyimpan process cloudflared agar bisa dihentikan nanti
    tunnel_process: Mutex<Option<Child>>,
}

#[derive(Serialize, Clone)]
struct LogMessage {
    message: String,
    log_type: String, // "info", "error", "success"
}

#[tauri::command]
async fn start_tunnel(
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
    // Hentikan proses yang sedang berjalan jika ada
    let mut process_guard = state.tunnel_process.lock().await;
    if let Some(mut child) = process_guard.take() {
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
    args.push(tunnel_name);

    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let mut child = Command::new(bin_path)
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
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone1.emit("tunnel-log", LogMessage {
                message: line,
                log_type: "info".to_string(),
            });
        }
    });

    // Stream Stderr (cloudflared biasanya menggunakan stderr untuk logging utama)
    let app_clone2 = app.clone();
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
                message: line,
                log_type: log_type.to_string(),
            });
        }
        
        let _ = app_clone2.emit("tunnel-log", LogMessage {
            message: "Proses cloudflared telah berhenti.".to_string(),
            log_type: "info".to_string(),
        });
    });

    *process_guard = Some(child);

    Ok(())
}

#[tauri::command]
async fn stop_tunnel(state: State<'_, AppState>) -> Result<(), String> {
    let mut process_guard = state.tunnel_process.lock().await;
    if let Some(mut child) = process_guard.take() {
        let _ = child.kill().await;
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct DiscoveredProject {
    id: String,
    name: String,
    path: String,
    framework: String,
    #[serde(rename = "suggestedUrl")]
    suggested_url: String,
}

#[tauri::command]
async fn scan_projects(dir: String) -> Result<Vec<DiscoveredProject>, String> {
    let mut projects = Vec::new();
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let mut framework = "Unknown".to_string();
            
            // Basic framework detection
            if path.join("wp-config.php").exists() || path.join("wp-config-sample.php").exists() {
                framework = "WordPress".to_string();
            } else if path.join("artisan").exists() {
                framework = "Laravel".to_string();
            } else if path.join("package.json").exists() {
                let pkg_content = std::fs::read_to_string(path.join("package.json")).unwrap_or_default();
                if pkg_content.contains("\"next\"") {
                    framework = "Next.js".to_string();
                } else if pkg_content.contains("\"vite\"") {
                    framework = "Vite".to_string();
                } else if pkg_content.contains("\"react\"") {
                    framework = "React".to_string();
                } else if pkg_content.contains("\"vue\"") {
                    framework = "Vue".to_string();
                } else {
                    framework = "Node.js".to_string();
                }
            } else if path.join("index.php").exists() {
                framework = "PHP".to_string();
            } else if path.join("index.html").exists() {
                framework = "HTML".to_string();
            }
            
            if framework != "Unknown" {
                let suggested_url = if framework == "Laravel" {
                    format!("http://{}.test", name)
                } else if framework == "WordPress" || framework == "PHP" {
                    format!("http://{}.test", name)
                } else {
                    "http://localhost:3000".to_string()
                };

                projects.push(DiscoveredProject {
                    id: uuid::Uuid::new_v4().to_string(),
                    name,
                    path: path.to_string_lossy().to_string(),
                    framework,
                    suggested_url,
                });
            }
        }
    }

    Ok(projects)
}

#[tauri::command]
async fn cloudflared_login(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    // cloudflared tunnel login ideally opens browser automatically
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &bin_path, "tunnel", "login"])
            .spawn()
            .map_err(|e| format!("Failed to start login process: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&bin_path)
            .args(["tunnel", "login"])
            .spawn()
            .map_err(|e| format!("Failed to start login process: {}", e))?;
    }

    Ok("Login process started. Check your browser or new terminal window.".to_string())
}

#[tauri::command]
async fn check_cloudflared(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let output = Command::new(&bin_path)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("Failed to find or execute cloudflared: {}", e))?;

    if output.status.success() {
        let version_str = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(version_str.trim().to_string())
    } else {
        let err_str = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Error running cloudflared: {}", err_str))
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_tunnel, 
            stop_tunnel, 
            scan_projects, 
            cloudflared_login,
            check_cloudflared
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
