use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;
use std::fs;
use reqwest::Client;
use futures_util::StreamExt;
use std::io::Write;

pub fn get_default_cloudflared_path(app: &AppHandle) -> PathBuf {
    let mut path = app.path().app_local_data_dir().expect("Failed to get local data dir");
    path.push("bin");
    #[cfg(target_os = "windows")]
    path.push("cloudflared.exe");
    #[cfg(not(target_os = "windows"))]
    path.push("cloudflared");
    path
}

#[tauri::command]
pub fn check_cloudflared_status(app: AppHandle) -> bool {
    let path = get_default_cloudflared_path(&app);
    path.exists()
}

#[tauri::command]
pub async fn download_cloudflared(app: AppHandle) -> Result<(), String> {
    let mut bin_dir = app.path().app_local_data_dir().expect("Failed to get local data dir");
    bin_dir.push("bin");
    
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;
    }

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let url = match (os, arch) {
        ("windows", "x86_64") => "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
        ("linux", "x86_64") => "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
        ("macos", "x86_64") => "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64",
        ("macos", "aarch64") => "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64",
        _ => return Err(format!("Unsupported OS/Arch: {}/{}", os, arch)),
    };

    let client = Client::new();
    let res = client.get(url).send().await.map_err(|e| format!("Download request failed: {}", e))?;
    let total_size = res.content_length().unwrap_or(0);

    let path = get_default_cloudflared_path(&app);
    let mut file = fs::File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Failed to read stream chunk: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Failed to write chunk to file: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u8;
            let _ = app.emit("download_progress", progress);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }

    Ok(())
}
