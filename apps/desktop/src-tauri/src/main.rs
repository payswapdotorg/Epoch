// W048 — the Epoch desktop entry point.
// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    epoch_desktop_lib::run()
}
