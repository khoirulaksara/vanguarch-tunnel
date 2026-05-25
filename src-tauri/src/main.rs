// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use tauri::{Emitter, State, Manager, menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use serde::Serialize;

#[derive(Default)]
struct AppState {
    // Menyimpan process cloudflared berdasarkan tunnel name / ID agar bisa multi-tunnel
    tunnel_processes: Mutex<HashMap<String, Child>>,
}

fn make_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    cmd
}

#[derive(Serialize, Clone)]
struct LogMessage {
    tunnel_name: String,
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
async fn stop_tunnel(state: State<'_, AppState>, tunnel_name: String) -> Result<(), String> {
    let mut process_guard = state.tunnel_processes.lock().await;
    if let Some(mut child) = process_guard.remove(&tunnel_name) {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
async fn get_cloudflared_domain() -> Result<String, String> {
    let mut cert_path = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(std::path::PathBuf::from)
        .unwrap_or_default();
    cert_path.push(".cloudflared");
    cert_path.push("cert.pem");

    if !cert_path.exists() {
        return Err("cert.pem not found".to_string());
    }

    let contents = std::fs::read_to_string(&cert_path)
        .map_err(|e| format!("Failed to read cert.pem: {}", e))?;
    
    let mut token_b64 = String::new();
    let mut in_token = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed == "-----BEGIN ARGO TUNNEL TOKEN-----" {
            in_token = true;
            continue;
        }
        if trimmed == "-----END ARGO TUNNEL TOKEN-----" {
            break;
        }
        if in_token {
            token_b64.push_str(trimmed);
        }
    }

    if token_b64.is_empty() {
        return Err("Could not find ARGO TUNNEL TOKEN block in cert.pem".to_string());
    }

    use base64::{Engine as _, engine::general_purpose};
    
    let decoded_token_bytes = general_purpose::STANDARD.decode(token_b64.trim())
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(token_b64.trim()))
        .map_err(|e| format!("Failed to decode ARGO TUNNEL TOKEN base64: {}", e))?;

    let json_str = String::from_utf8(decoded_token_bytes)
        .map_err(|e| format!("Invalid utf8 in decoded token: {}", e))?;

    let parsed: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let zone_id = parsed["zoneID"].as_str()
        .ok_or_else(|| "zoneID not found in token".to_string())?;
    
    let api_token = parsed["apiToken"].as_str()
        .ok_or_else(|| "apiToken not found in token".to_string())?;

    let url = format!("https://api.cloudflare.com/client/v4/zones/{}", zone_id);
    
    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .bearer_auth(api_token)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch zone API: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Cloudflare API error: {}", resp.status()));
    }

    let result_json: serde_json::Value = resp.json()
        .await
        .map_err(|e| format!("Failed to parse response API: {}", e))?;

    let name = result_json["result"]["name"].as_str()
        .ok_or_else(|| "name not found in API response".to_string())?;

    Ok(name.to_string())
}

#[tauri::command]
fn check_cloudflared_login() -> bool {
    let mut cert_path = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(std::path::PathBuf::from)
        .unwrap_or_default();
    
    if cert_path.as_os_str().is_empty() {
        return false;
    }
    
    cert_path.push(".cloudflared");
    cert_path.push("cert.pem");
    cert_path.exists()
}

#[tauri::command]
async fn inject_wp_helper(path: String) -> Result<String, String> {
    let wp_config_path = std::path::Path::new(&path).join("wp-config.php");
    
    if !wp_config_path.exists() {
        return Err("wp-config.php tidak ditemukan".to_string());
    }

    let mut content = std::fs::read_to_string(&wp_config_path)
        .map_err(|e| format!("Gagal membaca wp-config.php: {}", e))?;

    if content.contains("HTTP_X_FORWARDED_HOST") {
        return Err("Helper sudah terpasang".to_string());
    }

    let helper_code = r#"
// -- START CLOUDFLARED TUNNEL HELPER --
if ( ! defined('WP_CLI') ) {
    $is_https =
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || ($_SERVER['SERVER_PORT'] ?? null) == 443;

    if ($is_https) {
        $_SERVER['HTTPS'] = 'on';
    }

    $scheme = $is_https ? 'https' : 'http';

    $host =
        $_SERVER['HTTP_X_FORWARDED_HOST']
        ?? $_SERVER['HTTP_HOST'];

    define('WP_HOME', $scheme . '://' . $host);

    define('WP_SITEURL', $scheme . '://' . $host);
}
// -- END CLOUDFLARED TUNNEL HELPER --
"#;

    // Try to insert before "That's all, stop editing!"
    let target = "/* That's all, stop editing!";
    if let Some(pos) = content.find(target) {
        content.insert_str(pos, &(helper_code.to_string() + "\n"));
    } else {
        // Fallback: append
        content.push_str("\n");
        content.push_str(helper_code);
    }

    std::fs::write(&wp_config_path, content)
        .map_err(|e| format!("Gagal menyimpan wp-config.php: {}", e))?;

    Ok("Berhasil memasang WordPress helper".to_string())
}

#[tauri::command]
async fn auto_tunnel_setup(
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
    
    if list_out.contains(&tunnel_name) {
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

    // 2. Route DNS
    let route_cmd = make_command(&bin_path)
        .args(["tunnel", "route", "dns", &tunnel_name, &subdomain])
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
async fn list_tunnels(cloudflared_path: String) -> Result<String, String> {
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
async fn delete_tunnel(cloudflared_path: String, tunnel_name: String) -> Result<String, String> {
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

#[derive(Serialize, Clone)]
struct DiscoveredProject {
    id: String,
    name: String,
    path: String,
    framework: String,
    #[serde(rename = "suggestedUrl")]
    suggested_url: String,
    #[serde(rename = "wpHelperInstalled")]
    wp_helper_installed: Option<bool>,
}

fn detect_project(path: &std::path::Path) -> Option<DiscoveredProject> {
    if !path.is_dir() {
        return None;
    }
    
    let name = path.file_name()?.to_string_lossy().to_string();
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
        } else if framework == "WordPress" || framework == "PHP" || framework == "HTML" {
            format!("http://{}.test", name)
        } else if framework == "Vite" || framework == "React" || framework == "Vue" {
            "http://localhost:5173".to_string()
        } else if framework == "Next.js" || framework == "Node.js" {
            "http://localhost:3000".to_string()
        } else {
            "http://localhost:8080".to_string()
        };

        let mut wp_helper_installed = None;
        if framework == "WordPress" {
            wp_helper_installed = Some(false);
            if let Ok(config) = std::fs::read_to_string(path.join("wp-config.php")) {
                if config.contains("HTTP_X_FORWARDED_HOST") {
                    wp_helper_installed = Some(true);
                }
            }
        }

        Some(DiscoveredProject {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: path.to_string_lossy().to_string(),
            framework,
            suggested_url,
            wp_helper_installed,
        })
    } else {
        None
    }
}

#[tauri::command]
async fn scan_projects(dir: String, is_workspace: bool) -> Result<Vec<DiscoveredProject>, String> {
    let mut projects = Vec::new();
    let root_path = std::path::Path::new(&dir);
    
    if !is_workspace {
        if let Some(project) = detect_project(root_path) {
            projects.push(project);
        }
        return Ok(projects);
    }
    
    let entries = std::fs::read_dir(root_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        if let Some(project) = detect_project(&entry.path()) {
            projects.push(project);
        }
    }

    Ok(projects)
}

#[tauri::command]
async fn logout_cloudflared(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let mut dot_cloudflared = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(std::path::PathBuf::from)
        .unwrap_or_default();
        
    if dot_cloudflared.as_os_str().is_empty() {
        return Err("Could not determine home directory".to_string());
    }
    
    dot_cloudflared.push(".cloudflared");
    if !dot_cloudflared.exists() || !dot_cloudflared.is_dir() {
        return Ok("Already logged out (no .cloudflared directory)".to_string());
    }
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
        
    let backup_dir_name = format!("backup_{}", now);
    let backup_dir_path = dot_cloudflared.join(&backup_dir_name);
    
    let mut moved_files = 0;
    
    // Check if there's anything to backup (cert.pem or .json)
    if let Ok(entries) = std::fs::read_dir(&dot_cloudflared) {
        let mut files_to_move = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" && path.file_name().map_or(true, |n| n != "config.json") {
                        files_to_move.push(path.clone());
                    }
                }
                if let Some(file_name) = path.file_name() {
                    if file_name == "cert.pem" {
                        files_to_move.push(path.clone());
                    }
                }
            }
        }
        
        if files_to_move.is_empty() {
             return Ok("Already logged out (no cert or credential files found)".to_string());
        }
        
        // Create backup directory
        std::fs::create_dir_all(&backup_dir_path).map_err(|e| format!("Failed to create backup dir: {}", e))?;
        
        for file_path in files_to_move {
            if let Some(file_name) = file_path.file_name() {
                // Delete tunnel via CLI if it's a UUID json file
                let fname_str = file_name.to_string_lossy();
                if fname_str.ends_with(".json") && fname_str != "config.json" {
                    let id = fname_str.trim_end_matches(".json");
                    let _ = make_command(&bin_path)
                        .args(["tunnel", "delete", "-f", id])
                        .output()
                        .await;
                }

                let dest = backup_dir_path.join(file_name);
                if std::fs::rename(&file_path, &dest).is_ok() {
                    moved_files += 1;
                }
            }
        }
    }
    
    if moved_files > 0 {
        Ok(format!("Backed up {} files to {}", moved_files, backup_dir_name))
    } else {
        Ok("No files were backed up".to_string())
    }
}

#[tauri::command]
async fn cloudflared_login(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let output = make_command(&bin_path)
        .args(["tunnel", "login"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute login process: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(format!("Login successful.\n{}", stdout))
    } else {
        Err(format!("Login failed: {}", stderr.trim()))
    }
}

#[tauri::command]
async fn check_cloudflared(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let output = make_command(&bin_path)
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

#[tauri::command]
fn force_exit() {
    std::process::exit(0);
}

#[derive(Serialize)]
struct PortStatus {
    port: u16,
    is_open: bool,
    description: String,
}

#[tauri::command]
async fn check_ports() -> Result<Vec<PortStatus>, String> {
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
            
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        let _ = app.emit("tray-quit-requested", "exit");
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            start_tunnel, 
            stop_tunnel, 
            scan_projects, 
            cloudflared_login,
            logout_cloudflared,
            get_cloudflared_domain,
            check_cloudflared,
            check_cloudflared_login,
            inject_wp_helper,
            auto_tunnel_setup,
            list_tunnels,
            delete_tunnel,
            force_exit,
            check_ports
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
