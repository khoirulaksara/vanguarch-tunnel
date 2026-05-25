//! `commands/cloudflare.rs`
//! Handles Cloudflared authentication, configuration, and verification.

use crate::utils::make_command;

#[tauri::command]
pub async fn get_cloudflared_domain() -> Result<String, String> {
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
pub fn check_cloudflared_login() -> bool {
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
pub async fn logout_cloudflared(cloudflared_path: String) -> Result<String, String> {
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

        // Hapus semua tunnel dari Cloudflare API sebelum membackup
        if let Ok(list_cmd) = make_command(&bin_path)
            .args(["tunnel", "list", "--output", "json"])
            .output()
            .await 
        {
            if list_cmd.status.success() {
                let list_out = String::from_utf8_lossy(&list_cmd.stdout);
                if let Ok(tunnels) = serde_json::from_str::<serde_json::Value>(&list_out) {
                    if let Some(tunnels_array) = tunnels.as_array() {
                        for tunnel in tunnels_array {
                            if let Some(name) = tunnel["name"].as_str() {
                                let _ = make_command(&bin_path)
                                    .args(["tunnel", "delete", "-f", name])
                                    .output()
                                    .await;
                            }
                        }
                    }
                }
            }
        }
        
        // Create backup directory
        std::fs::create_dir_all(&backup_dir_path).map_err(|e| format!("Failed to create backup dir: {}", e))?;
        
        for file_path in files_to_move {
            if let Some(file_name) = file_path.file_name() {
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
pub async fn cloudflared_login(cloudflared_path: String) -> Result<String, String> {
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
pub async fn check_cloudflared(cloudflared_path: String) -> Result<String, String> {
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
pub async fn update_cloudflared(cloudflared_path: String) -> Result<String, String> {
    let bin_path = if cloudflared_path.trim().is_empty() {
        "cloudflared".to_string()
    } else {
        cloudflared_path
    };

    let output = make_command(&bin_path)
        .arg("update")
        .output()
        .await
        .map_err(|e| format!("Failed to execute update process: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() || output.status.code() == Some(11) {
        Ok(format!("Update completed.\n{}\n{}", stdout, stderr))
    } else {
        Err(format!("Update failed: {}", stderr.trim()))
    }
}
