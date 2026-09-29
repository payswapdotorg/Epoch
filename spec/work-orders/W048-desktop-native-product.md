# W048 — Desktop Native Product + Desktop Journey Validation

Status: BLOCKED_UNTIL_W046_COMPLETE
Wave: ACR-005 / client
Depends On: W046
Worker Count: 1

## Objective
Turn the W017 typed desktop reference host into a real Tauri 2 application downloadable and launchable on Linux, Windows and macOS, then validate packaged artifacts.

## Owned write surfaces
- apps/desktop/*
- qa/desktop/*
- docs/journeys/desktop-linux.md
- docs/journeys/desktop-windows.md
- docs/journeys/desktop-macos.md

Do not edit web/mobile implementation.

## Required
Tauri 2 native host around W017; safe IPC/envelope bridge; dev launch on all three OSes; Linux AppImage + Debian-family package; Windows installer; macOS DMG/app bundle suitable for signing/notarization; native file picker/import/export as needed; platform-safe credential/session storage; offline/session cache integration; update/protocol compatibility checks; automated desktop E2E.

## Journey gate
Execute J01-J09, J11, J12 on packaged applications on Linux, Windows and macOS. Cover install, launch, relaunch, offline/reconnect, cross-device handoff and update. P0/P1 defects must be fixed before closure.

## Acceptance
- Fresh supported Linux/Windows/macOS environments install and launch.
- App resolves the same authoritative project state as web.
- Action Gateway remains authoritative.
- Offline/reconnect creates no second semantic store.
- All required desktop journeys pass on all three OS targets.
- Build/install metadata is reproducible and documented.
