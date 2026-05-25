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
