//! `commands/project.rs`
//! Handles local web project scanning and configuration injection.

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct DiscoveredProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub framework: String,
    #[serde(rename = "suggestedUrl")]
    pub suggested_url: String,
    #[serde(rename = "wpHelperInstalled")]
    pub wp_helper_installed: Option<bool>,
    #[serde(rename = "laravelProxyInstalled")]
    pub laravel_proxy_installed: Option<bool>,
}

pub fn detect_project(path: &std::path::Path) -> Option<DiscoveredProject> {
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

        let mut laravel_proxy_installed = None;
        if framework == "Laravel" {
            laravel_proxy_installed = Some(false);
            // Laravel ≤10: check TrustProxies.php for wildcard
            let trust_proxies = path.join("app/Http/Middleware/TrustProxies.php");
            if trust_proxies.exists() {
                if let Ok(content) = std::fs::read_to_string(&trust_proxies) {
                    if content.contains("'*'") || content.contains("\"*\"") {
                        laravel_proxy_installed = Some(true);
                    }
                }
            }
            // Laravel 11+: check bootstrap/app.php for trustProxies call
            let bootstrap = path.join("bootstrap/app.php");
            if bootstrap.exists() {
                if let Ok(content) = std::fs::read_to_string(&bootstrap) {
                    if content.contains("trustProxies") {
                        laravel_proxy_installed = Some(true);
                    }
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
            laravel_proxy_installed,
        })
    } else {
        None
    }
}

#[tauri::command]
pub async fn scan_projects(dir: String, is_workspace: bool) -> Result<Vec<DiscoveredProject>, String> {
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
pub async fn inject_wp_helper(path: String) -> Result<String, String> {
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

// ---------------------------------------------------------------------------
// Laravel .env tunnel helpers
// ---------------------------------------------------------------------------

/// Backs up the current `.env` to `.env.tunnel`, then sets/replaces `APP_URL`
/// with the given tunnel URL. Creates `.env` from scratch if it doesn't exist.
#[tauri::command]
pub async fn inject_laravel_env(project_path: String, tunnel_url: String) -> Result<String, String> {
    let env_path = std::path::Path::new(&project_path).join(".env");
    let backup_path = std::path::Path::new(&project_path).join(".env.tunnel");

    // Read current .env (empty string if missing — we'll create it)
    let original = if env_path.exists() {
        std::fs::read_to_string(&env_path)
            .map_err(|e| format!("Gagal membaca .env: {}", e))?
    } else {
        String::new()
    };

    // Write backup
    std::fs::write(&backup_path, &original)
        .map_err(|e| format!("Gagal membuat .env.tunnel: {}", e))?;

    // Build new .env — replace APP_URL line or append
    let new_app_url_line = format!("APP_URL={}", tunnel_url);
    let new_content = if original.lines().any(|l| l.starts_with("APP_URL=")) {
        original
            .lines()
            .map(|line| {
                if line.starts_with("APP_URL=") {
                    new_app_url_line.as_str()
                } else {
                    line
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
            + if original.ends_with('\n') { "\n" } else { "" }
    } else if original.is_empty() {
        format!("{}\n", new_app_url_line)
    } else {
        format!("{}\n{}\n", original.trim_end_matches('\n'), new_app_url_line)
    };

    std::fs::write(&env_path, new_content)
        .map_err(|e| format!("Gagal menulis .env: {}", e))?;

    Ok(format!("APP_URL diatur ke {} dan backup disimpan ke .env.tunnel", tunnel_url))
}

/// Restores `.env` from `.env.tunnel` backup and removes the backup file.
/// Falls back to stripping the `APP_URL` line if no backup exists.
#[tauri::command]
pub async fn restore_laravel_env(project_path: String) -> Result<String, String> {
    let env_path = std::path::Path::new(&project_path).join(".env");
    let backup_path = std::path::Path::new(&project_path).join(".env.tunnel");

    if backup_path.exists() {
        let backup = std::fs::read_to_string(&backup_path)
            .map_err(|e| format!("Gagal membaca .env.tunnel: {}", e))?;

        if backup.is_empty() {
            // .env didn't exist before — remove the created one
            if env_path.exists() {
                std::fs::remove_file(&env_path)
                    .map_err(|e| format!("Gagal menghapus .env: {}", e))?;
            }
        } else {
            std::fs::write(&env_path, backup)
                .map_err(|e| format!("Gagal merestore .env: {}", e))?;
        }

        std::fs::remove_file(&backup_path)
            .map_err(|e| format!("Gagal menghapus .env.tunnel: {}", e))?;

        Ok(".env berhasil direstore dari .env.tunnel".to_string())
    } else {
        // No backup — best-effort: strip APP_URL line from .env
        if env_path.exists() {
            let content = std::fs::read_to_string(&env_path)
                .map_err(|e| format!("Gagal membaca .env: {}", e))?;
            let stripped = content
                .lines()
                .filter(|l| !l.starts_with("APP_URL="))
                .collect::<Vec<_>>()
                .join("\n");
            let stripped = if content.ends_with('\n') {
                format!("{}\n", stripped)
            } else {
                stripped
            };
            std::fs::write(&env_path, stripped)
                .map_err(|e| format!("Gagal menulis .env: {}", e))?;
        }
        Ok(".env.tunnel tidak ditemukan — APP_URL dihapus dari .env (fallback)".to_string())
    }
}

#[tauri::command]
pub async fn inject_laravel_trust_proxies(project_path: String) -> Result<String, String> {
    let trust_proxies_path = std::path::Path::new(&project_path).join("app/Http/Middleware/TrustProxies.php");
    let bootstrap_path = std::path::Path::new(&project_path).join("bootstrap/app.php");

    if trust_proxies_path.exists() {
        // Laravel <= 10
        let content = std::fs::read_to_string(&trust_proxies_path)
            .map_err(|e| format!("Gagal membaca TrustProxies.php: {}", e))?;

        if content.contains("protected $proxies = '*';") || content.contains("protected $proxies = \"*\";") {
            return Ok("Trust proxies sudah dikonfigurasi".to_string());
        }

        if let Some(start_idx) = content.find("protected $proxies") {
            if let Some(end_idx) = content[start_idx..].find(';') {
                let actual_end_idx = start_idx + end_idx;
                let mut new_content = content[..start_idx].to_string();
                new_content.push_str("protected $proxies = '*';");
                new_content.push_str(&content[actual_end_idx + 1..]);
                
                std::fs::write(&trust_proxies_path, new_content)
                    .map_err(|e| format!("Gagal menulis TrustProxies.php: {}", e))?;
                
                return Ok("Berhasil mengonfigurasi trust proxies di TrustProxies.php".to_string());
            }
        }
        
        return Err("Variabel $proxies tidak ditemukan di TrustProxies.php".to_string());
    } else if bootstrap_path.exists() {
        // Laravel 11+
        let mut content = std::fs::read_to_string(&bootstrap_path)
            .map_err(|e| format!("Gagal membaca bootstrap/app.php: {}", e))?;

        if content.contains("trustProxies") {
            return Ok("Trust proxies sudah dikonfigurasi".to_string());
        }

        let pattern1 = "->withMiddleware(function (Middleware $middleware) {";
        let pattern2 = "->withMiddleware(function ($middleware) {";
        
        let mut pos = None;
        let mut len = 0;
        
        if let Some(idx) = content.find(pattern1) {
            pos = Some(idx);
            len = pattern1.len();
        } else if let Some(idx) = content.find(pattern2) {
            pos = Some(idx);
            len = pattern2.len();
        }
        
        if let Some(idx) = pos {
            content.insert_str(idx + len, "\n        $middleware->trustProxies(at: '*');");
        } else {
            let create_pattern = "->create()";
            if let Some(idx) = content.find(create_pattern) {
                let insert_str = "\n    ->withMiddleware(function (Middleware $middleware) {\n        $middleware->trustProxies(at: '*');\n    })";
                content.insert_str(idx, insert_str);
            } else {
                return Err("Tidak dapat menemukan block middleware di bootstrap/app.php".to_string());
            }
        }

        std::fs::write(&bootstrap_path, content)
            .map_err(|e| format!("Gagal menulis bootstrap/app.php: {}", e))?;

        return Ok("Berhasil mengonfigurasi trust proxies di bootstrap/app.php".to_string());
    }

    Err("Project Laravel tidak valid atau file konfigurasi tidak ditemukan".to_string())
}

