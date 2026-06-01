// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! `main.rs`
//! The entry point of the Vanguarch Tunnel application.
//! Sets up the system tray, registers commands, and initializes Tauri.

mod commands;
mod state;
mod utils;

use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

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
                .tooltip("Vanguarch Tunnel")
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
            commands::tunnel::start_tunnel,
            commands::tunnel::stop_tunnel,
            commands::project::scan_projects,
            commands::cloudflare::cloudflared_login,
            commands::cloudflare::logout_cloudflared,
            commands::cloudflare::get_cloudflared_domain,
            commands::cloudflare::check_cloudflared,
            commands::cloudflare::check_cloudflared_login,
            commands::cloudflare::update_cloudflared,
            commands::project::inject_wp_helper,
            commands::tunnel::auto_tunnel_setup,
            commands::tunnel::list_tunnels,
            commands::tunnel::delete_tunnel,
            commands::system::force_exit,
            commands::system::check_ports,
            commands::system::open_url,
            commands::system::get_username,
            commands::setup::check_cloudflared_status,
            commands::setup::download_cloudflared,
            commands::share::start_static_server,
            commands::share::stop_static_server,
            commands::inspector::start_inspector,
            commands::inspector::stop_inspector_for_tunnel,
            commands::inspector::replay_request,
            commands::system::ping_url,
            commands::system::check_internet,
            commands::project::inject_laravel_env,
            commands::project::restore_laravel_env,
            commands::project::inject_laravel_trust_proxies
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
