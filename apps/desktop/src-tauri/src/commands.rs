// W048 — the frozen native host command surface (Rust side).
//
// EXACTLY the `IPC_HOST_COMMANDS` list the TypeScript bridge declares
// (apps/desktop/src/native/ipc/surface.ts) plus `epoch_gateway_call`.
// Argument names match the webview's camelCase invoke keys verbatim;
// every failure is a typed `Result<_, String>` rejection the bridge maps
// into its error taxonomy (no panics — a desktop shell never dies on a
// host-command failure).
use crate::{DurableState, GatewayState};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

/// The app/host metadata the webview validates on handshake (the protocol
/// gate: an incompatible hostProtocolVersion is a typed startup refusal).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMeta {
    pub schema_version: u8,
    pub product_version: &'static str,
    pub host_protocol_version: &'static str,
    pub gateway_contract_version: &'static str,
    pub platform: &'static str,
    pub locale: &'static str,
}

/// The protocol triple THIS host build speaks (mirrors
/// DESKTOP_PROTOCOL_ENVELOPE in src/native/version.ts).
const PRODUCT_VERSION: &str = "1.0.0";
const HOST_PROTOCOL_VERSION: &str = "1.0.0";
const GATEWAY_CONTRACT_VERSION: &str = "1.0.0";

fn platform_label() -> &'static str {
    match std::env::consts::OS {
        "linux" => "linux",
        "windows" => "windows",
        "macos" => "macos",
        _ => "unknown",
    }
}

/// One file-dialog filter (mirrors the TS FileFilter shape).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[tauri::command]
pub fn epoch_app_meta() -> AppMeta {
    AppMeta {
        schema_version: 1,
        product_version: PRODUCT_VERSION,
        host_protocol_version: HOST_PROTOCOL_VERSION,
        gateway_contract_version: GATEWAY_CONTRACT_VERSION,
        platform: platform_label(),
        locale: "en",
    }
}

// ---------------------------------------------------------------------------
// The platform-safe secure store (OS keychain; W048 pin 5).
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn epoch_secure_store_get(key: String) -> Result<Option<String>, String> {
    crate::secure::get(&key).map_err(|error| format!("secure-store-unavailable: {error}"))
}

#[tauri::command]
pub fn epoch_secure_store_set(key: String, value: String) -> Result<(), String> {
    crate::secure::set(&key, &value).map_err(|error| format!("secure-store-unavailable: {error}"))
}

#[tauri::command]
pub fn epoch_secure_store_delete(key: String) -> Result<bool, String> {
    crate::secure::delete(&key).map_err(|error| format!("secure-store-unavailable: {error}"))
}

// ---------------------------------------------------------------------------
// The durable local-projection store (client-runtime records only).
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn epoch_durable_get(key: String, state: State<'_, Mutex<DurableState>>) -> Result<Option<String>, String> {
    let state = state.lock().map_err(|_| "internal-invariant-violated: durable state poisoned")?;
    Ok(state.store.get(&key))
}

#[tauri::command]
pub fn epoch_durable_set(key: String, value: String, state: State<'_, Mutex<DurableState>>) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "internal-invariant-violated: durable state poisoned")?;
    state.store.set(&key, &value);
    Ok(())
}

#[tauri::command]
pub fn epoch_durable_delete(key: String, state: State<'_, Mutex<DurableState>>) -> Result<bool, String> {
    let mut state = state.lock().map_err(|_| "internal-invariant-violated: durable state poisoned")?;
    Ok(state.store.delete(&key))
}

#[tauri::command]
pub fn epoch_durable_keys(state: State<'_, Mutex<DurableState>>) -> Result<Vec<String>, String> {
    let state = state.lock().map_err(|_| "internal-invariant-violated: durable state poisoned")?;
    Ok(state.store.keys())
}

// ---------------------------------------------------------------------------
// Native file dialogs + import/export (the packaged-app facilities).
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn epoch_pick_open_file(
    app: AppHandle,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    for filter in filters.iter() {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        dialog = dialog.add_filter(filter.name.as_str(), &extensions);
    }
    match dialog.blocking_pick_file() {
        Some(path) => path.into_path().map(|p| Some(p.to_string_lossy().into_owned())).map_err(|error| {
            format!("file-io-rejected: the picked path is not representable ({error})")
        }),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn epoch_pick_save_file(
    app: AppHandle,
    defaultName: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    #[allow(non_snake_case)]
    let defaultName = defaultName;
    let mut dialog = app.dialog().file();
    if let Some(name) = defaultName.as_deref() {
        dialog = dialog.set_file_name(name);
    }
    for filter in filters.iter() {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        dialog = dialog.add_filter(filter.name.as_str(), &extensions);
    }
    match dialog.blocking_save_file() {
        Some(path) => path.into_path().map(|p| Some(p.to_string_lossy().into_owned())).map_err(|error| {
            format!("file-io-rejected: the picked path is not representable ({error})")
        }),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn epoch_read_file_utf8(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|error| format!("file-io-rejected: {error}"))
}

#[tauri::command]
pub fn epoch_write_file_utf8(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, content).map_err(|error| format!("file-io-rejected: {error}"))
}

// ---------------------------------------------------------------------------
// Local-state wipe (the recovery affordance: clears the durable
// projections + the keychain entries this app owns; semantic state lives
// server-side and is untouched by definition).
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn epoch_wipe_local_state(state: State<'_, Mutex<DurableState>>) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "internal-invariant-violated: durable state poisoned")?;
    // The keychain entries mirror the durable keys (the session store
    // writes both); clear them through the same key set.
    for key in state.store.keys() {
        let _ = crate::secure::delete(&key);
    }
    state.store.clear();
    Ok(())
}

// ---------------------------------------------------------------------------
// The remote-gateway forwarder (frozen-vocabulary allowlist + HTTPS).
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn epoch_gateway_call(request: serde_json::Value, state: State<'_, GatewayState>) -> serde_json::Value {
    state.forwarder.call(&request)
}
