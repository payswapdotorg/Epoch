// W048 — the Epoch desktop native host (Tauri 2 application wiring).
//
// The Rust shell registers EXACTLY the frozen command surface the
// TypeScript bridge declares (`IPC_HOST_COMMANDS` in
// apps/desktop/src/native/ipc/surface.ts — 14 host commands + the
// `epoch_gateway_call` forwarder). The webview (the static-export Next.js
// frontend in ../out) drives the W017 experience surface through those
// commands; every semantic call still crosses the Application Gateway —
// this crate never computes semantic state (architecture lock rule 13:
// platform toolchains are adapters, never semantic authorities).
mod commands;
mod durable;
mod gateway;
mod operations;
mod secure;

use std::sync::Mutex;
use tauri::Manager;

/// The durable local-projection store state (client-runtime records only:
/// sessions mirror, offline queue, projection cache — never semantic truth).
///
/// W063 defect D-1: the unused `#[derive(Default)]` (the ONLY construction
/// path is the explicit `setup()` wiring below, which passes the real
/// per-OS data dir) required `DurableStore: Default` — unimplementable
/// honestly (`DurableStore::new` needs a real data dir; a Default would be
/// a pathless lie). The derive was dead weight and the sole compile defect
/// of the first real `cargo build` of this crate (W048 delivered
/// config-complete; the packaged build had never run to completion).
pub struct DurableState {
    pub store: durable::DurableStore,
}

/// The gateway forwarder state (endpoint config + HTTP client).
pub struct GatewayState {
    pub forwarder: gateway::GatewayForwarder,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // The durable store lives under the per-OS app-data dir.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.manage(Mutex::new(DurableState {
                store: durable::DurableStore::new(&data_dir),
            }));
            app.manage(GatewayState {
                forwarder: gateway::GatewayForwarder::new(&data_dir),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::epoch_app_meta,
            commands::epoch_secure_store_get,
            commands::epoch_secure_store_set,
            commands::epoch_secure_store_delete,
            commands::epoch_durable_get,
            commands::epoch_durable_set,
            commands::epoch_durable_delete,
            commands::epoch_durable_keys,
            commands::epoch_pick_open_file,
            commands::epoch_pick_save_file,
            commands::epoch_read_file_utf8,
            commands::epoch_write_file_utf8,
            commands::epoch_wipe_local_state,
            commands::epoch_gateway_call,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Epoch desktop application");
}
