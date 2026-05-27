use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State};
use warp::Filter;
use crate::state::AppState;
use reqwest::Client;
use std::convert::Infallible;
use bytes::Bytes;
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct InspectorLog {
    pub log_id: String,
    pub tunnel_name: String,
    pub timestamp: String,
    pub request: Option<InspectorRequest>,
    pub response: Option<InspectorResponse>,
}

#[derive(Serialize, Clone)]
pub struct InspectorRequest {
    pub method: String,
    pub path: String,
    pub query: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[derive(Serialize, Clone)]
pub struct InspectorResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

async fn handle_proxy(
    app: AppHandle,
    tunnel_name: String,
    target_base: String,
    method: warp::http::Method,
    path: warp::path::FullPath,
    query: String,
    headers: warp::http::HeaderMap,
    body: Bytes,
) -> Result<impl warp::Reply, Infallible> {
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_else(|_| Client::new());

    let mut full_url = format!("{}{}", target_base, path.as_str());
    if !query.is_empty() {
        full_url = format!("{}?{}", full_url, query);
    }

    let log_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();

    // 1. Log Request
    let mut req_headers = HashMap::new();
    let mut req_builder = client.request(method.clone(), &full_url);
    
    for (k, v) in headers.iter() {
        if let Ok(val) = v.to_str() {
            req_headers.insert(k.as_str().to_string(), val.to_string());
            req_builder = req_builder.header(k, val);
        }
    }

    let req_body_str = String::from_utf8(body.to_vec()).unwrap_or_else(|_| "[Binary Data]".to_string());
    req_builder = req_builder.body(body);

    let req_log = InspectorLog {
        log_id: log_id.clone(),
        tunnel_name: tunnel_name.clone(),
        timestamp: timestamp.clone(),
        request: Some(InspectorRequest {
            method: method.as_str().to_string(),
            path: path.as_str().to_string(),
            query,
            headers: req_headers,
            body: req_body_str,
        }),
        response: None,
    };
    
    let _ = app.emit("inspector-log", req_log);

    // 2. Perform Request
    let response_result = req_builder.send().await;

    match response_result {
        Ok(res) => {
            let status = res.status();
            let mut res_headers = HashMap::new();
            let mut warp_res = warp::http::Response::builder().status(status);
            
            for (k, v) in res.headers().iter() {
                if let Ok(val) = v.to_str() {
                    res_headers.insert(k.as_str().to_string(), val.to_string());
                    warp_res = warp_res.header(k, val);
                }
            }

            let res_body_bytes = res.bytes().await.unwrap_or_default();
            let res_body_str = String::from_utf8(res_body_bytes.to_vec()).unwrap_or_else(|_| "[Binary Data]".to_string());

            let res_log = InspectorLog {
                log_id: log_id.clone(),
                tunnel_name: tunnel_name.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request: None,
                response: Some(InspectorResponse {
                    status: status.as_u16(),
                    headers: res_headers,
                    body: res_body_str,
                }),
            };
            
            let _ = app.emit("inspector-log", res_log);
            
            Ok(warp_res.body(res_body_bytes).unwrap_or_default())
        }
        Err(e) => {
            let err_log = InspectorLog {
                log_id: log_id.clone(),
                tunnel_name: tunnel_name.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                request: None,
                response: Some(InspectorResponse {
                    status: 502,
                    headers: HashMap::new(),
                    body: format!("Bad Gateway: {}", e),
                }),
            };
            let _ = app.emit("inspector-log", err_log);
            
            Ok(warp::http::Response::builder()
                .status(502)
                .body(Bytes::from(format!("Vanguarch Proxy Error: {}", e)))
                .unwrap_or_default())
        }
    }
}

#[tauri::command]
pub async fn start_inspector(
    app: AppHandle,
    state: State<'_, AppState>,
    target_url: String,
    tunnel_name: String,
) -> Result<u16, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    
    let app_handle = app.clone();
    let tunnel_name_clone = tunnel_name.clone();
    let target = target_url.clone();
    
    let route = warp::any()
        .and(warp::method())
        .and(warp::path::full())
        .and(warp::query::raw().or_else(|_| async { Ok::<_, std::convert::Infallible>((String::new(),)) }))
        .and(warp::header::headers_cloned())
        .and(warp::body::bytes())
        .and_then(move |method, path, query, headers, body| {
            let app_h = app_handle.clone();
            let t_name = tunnel_name_clone.clone();
            let t_target = target.clone();
            
            async move {
                handle_proxy(app_h, t_name, t_target, method, path, query, headers, body).await
            }
        });

    let (addr, server) = warp::serve(route)
        .bind_with_graceful_shutdown(([127, 0, 0, 1], 0), async move {
            rx.await.ok();
        });

    let port = addr.port();
    
    let mut servers = state.inspector_servers.lock().await;
    servers.insert(tunnel_name, tx);
    
    tokio::spawn(server);

    Ok(port)
}

#[tauri::command]
pub async fn stop_inspector_for_tunnel(
    state: State<'_, AppState>,
    tunnel_name: String,
) -> Result<(), String> {
    let mut servers = state.inspector_servers.lock().await;
    if let Some(tx) = servers.remove(&tunnel_name) {
        let _ = tx.send(());
    }
    Ok(())
}
