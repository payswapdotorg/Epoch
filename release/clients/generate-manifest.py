#!/usr/bin/env python3
"""W050 — the release/clients manifest generator.

Emits `release/clients/release-manifest.json`: the typed release-identity
record set for the six client platforms of the ACR-005 productization
program (spec/productization-architecture.md — "Every artifact records
source commit, version/profile, target platform and checksum").

What each record carries:
  - platform          — the target platform (one of the six below);
  - sourceCommit      — the exact commit the artifact definitions ship at;
  - version/profile   — the product version + production profile;
  - definitionFiles   — the committed files that DEFINE the artifact (the
                        build/packaging configuration of that platform);
  - checksums         — the sha256 of every definition file (recomputable
                        by anyone with a checkout — the binding evidence);
  - definitionTreeSha — the git tree SHA of the platform's app tree at the
                        source commit (the content-addressed identity of
                        the whole client tree: `git rev-parse <sha>:apps/<app>`);
  - buildStatus       — the honest build record: 'built-in-sandbox' (the
                        artifact was actually built and validated here /
                        in CI) or 'config-delivered' (the packaging
                        definition is complete but the toolchain is absent
                        from this sandbox — the gap is declared, never
                        hidden; the W048/W049 sandbox-honesty doctrine);
  - journeys          — the platform's journey record (docs/journeys/*).

Deterministic: the manifest is a pure function of the tree at the source
commit. Re-running at the same commit emits byte-identical JSON.

Usage: python3 generate-manifest.py <source-commit> [--out <path>]
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

CLIENTS: list[dict] = [
    {
        "platform": "web",
        "appTree": "apps/web",
        "artifactKind": "next-production-build (next build -> next start; the canonical web client)",
        "definitionFiles": [
            "apps/web/package.json",
            "apps/web/next.config.ts",
            "apps/web/tsconfig.json",
            "apps/web/vitest.config.mts",
            "apps/web/playwright.config.ts",
        ],
        "buildStatus": {
            "status": "built-in-sandbox",
            "evidence": "the CI battery (turbo build) builds the production web artifact at every push/PR; the W047 journey battery ran the production build through J01-J12 (docs/journeys/web.md)",
            "environmentGap": None,
        },
        "journeys": "docs/journeys/web.md",
    },
    {
        "platform": "desktop-linux",
        "appTree": "apps/desktop",
        "artifactKind": "tauri appimage + deb (tauri build --bundles appimage,deb)",
        "definitionFiles": [
            "apps/desktop/package.json",
            "apps/desktop/src-tauri/tauri.conf.json",
            "apps/desktop/src-tauri/Cargo.toml",
            "apps/desktop/src-tauri/Cargo.lock",
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "built-in-sandbox",
            "evidence": "W063: the full toolchain was provisioned user-space in the build sandbox (rustup stable 1.99; webkit2gtk-4.1 2.52.6 / gtk 3.24.49 / soup 3.6.5 / ayatana 0.5.94 via the 300-deb dpkg-deb prefix; patchelf rpath pass). The deb was produced by the tauri-bundler internal path; the AppImage by linuxdeploy with the W063 never-fatal gtk module installer (the upstream plugin's prefix-path cp defect is documented in docs/journeys/desktop-linux.md). Packaged launch verified under Xvfb :99 — the process tree (epoch-desktop + WebKitNetworkProcess; tauri setup data dir created; stable RSS) held for the full observation window. HONEST BOUNDARY: WebProcess in-page rendering needs a GL-capable display; this sandbox's Xvfb provides none (EGL_BAD_PARAMETER) — the webview payload layer is independently verified by the CI browser battery over real Chromium; the native shell is verified to the spawn boundary.",
            "environmentGap": None,
            "deviations": "the AppImage bundles the full runtime stack EXCEPT the webkit pair (libwebkit2gtk + libjavascriptcoregtk): webkit auxiliary processes spawn from the compile-time canonical path, so library and processes must come from the same system build — the deb Depends (libwebkit2gtk-4.1-0, libayatana-appindicator3-1, libgtk-3-0) and the AppImage share that contract by design (docs/journeys/desktop-linux.md W063 section).",
        },
        "artifacts": [
            {
                "file": "Epoch_1.0.0_amd64.deb",
                "bytes": 3415434,
                "sha256": "7308ec7a66226e6d48c5d2ec948752212093fe9738037cbc9f23c5a008f7a0d6",
                "producedBy": "tauri-bundler internal debian packager (apps/desktop/src-tauri target release)",
            },
            {
                "file": "Epoch-x86_64.AppImage",
                "bytes": 57289208,
                "sha256": "0fbafa721f1515957bc7e10090bce609c685e0715062fe8ae5037d5e25127865",
                "producedBy": "linuxdeploy (AppDir deploy + $ORIGIN rpaths) + appimagetool, W063 gtk module installer + AppRun hook wrapper",
            },
        ],
        "journeys": "docs/journeys/desktop-linux.md",
    },
    {
        "platform": "desktop-windows",
        "appTree": "apps/desktop",
        "artifactKind": "tauri nsis installer (tauri build --bundles nsis)",
        "definitionFiles": [
            "apps/desktop/package.json",
            "apps/desktop/src-tauri/tauri.conf.json",
            "apps/desktop/src-tauri/Cargo.toml",
            "apps/desktop/src-tauri/Cargo.lock",
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "built-in-sandbox-cross",
            "evidence": "W063: cross-compiled from the Linux build sandbox via the mingw-w64 gnu toolchain (gcc 14-win32; x86_64-pc-windows-gnu). The PE32+ GUI binary links the committed host surface; the NSIS installer embeds the WebView2 bootstrapper fetched from Microsoft at bundle time. The bundling bridge (makensis compiled-in /usr/share/nsis path; ${NSISDIR} windows separators) is documented in docs/journeys/desktop-windows.md. The installer is UNSIGNED (no certificate exists in the program; tauri-bundler skipped signing — recorded, never fabricated).",
            "environmentGap": None,
            "deviations": "the sandbox ceilings (4G RAM, no swap; 9.9G disk overlay) forced BUILD-LOCAL ONLY deviations, every one reverted from the committed tree and enumerated here: (1) release profile relaxed to lto=false + codegen-units=16 via env override — the bfd-ld cdylib import-library link was OOM-killed (ld signal 9) at the committed profile; (2) the desktop build linked the rlib only (the cdylib/staticlib crate-types are the mobile-side link passes and were the OOM paths) — the committed Cargo.toml keeps the full crate-type set; (3) gnu target, not msvc — the xwin/msvc route was disk-blocked. THE CANONICAL RECIPE repairs all three on a windows-latest runner at the committed profile: .github/workflows/release-desktop-native.yml.",
        },
        "artifacts": [
            {
                "file": "Epoch_1.0.0_x64-setup.exe",
                "bytes": 6371004,
                "sha256": "4f739387cd7b624627cb52f3335bb14489a7508eec995a1c4f2172d3d03dcc29",
                "producedBy": "rustc x86_64-pc-windows-gnu (mingw-w64 gcc 14) + tauri-bundler NSIS (makensis 3.11, WebView2 embedBootstrapper)",
            },
            {
                "file": "epoch-desktop.exe",
                "bytes": 12697088,
                "sha256": "13f7086021de1e3b30da9cb22666bbd337140a5dd131a7e4c29fccd507985ec7",
                "producedBy": "the raw cross-compiled PE32+ binary (also embedded in the installer); recorded in the journey doc",
                "rawBinary": True,
            },
        ],
        "journeys": "docs/journeys/desktop-windows.md",
    },
    {
        "platform": "desktop-macos",
        "appTree": "apps/desktop",
        "artifactKind": "tauri dmg + app bundle (tauri build --bundles dmg,app)",
        "definitionFiles": [
            "apps/desktop/package.json",
            "apps/desktop/src-tauri/tauri.conf.json",
            "apps/desktop/src-tauri/Cargo.toml",
            "apps/desktop/src-tauri/Cargo.lock",
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "ci-recipe-delivered",
            "evidence": "W063: a real dispatch recipe now builds the dmg + app bundles on a macos-14 runner at the committed profile: .github/workflows/release-desktop-native.yml (workflow_dispatch; uploads the artifacts + SHA256SUMS). The recipe materializes the artifact on demand; it is not the release gate (the standard ci.yml battery remains the sole gate).",
            "environmentGap": "Linux cannot produce a macOS DMG — the Apple SDK and codesigning toolchain exist only on macOS hosts; this is a hard platform boundary, recorded, never fabricated",
            "deviations": None,
        },
        "artifacts": [],
        "journeys": "docs/journeys/desktop-macos.md",
    },
    {
        "platform": "mobile-android",
        "appTree": "apps/mobile",
        "artifactKind": "expo android release build — apk/aab (eas build --platform android)",
        "definitionFiles": [
            "apps/mobile/package.json",
            "apps/mobile/app.json",
            "apps/mobile/eas.json",
            "apps/mobile/tsconfig.json",
        ],
        "buildStatus": {
            "status": "config-delivered",
            "evidence": "the Expo/EAS build profiles are committed (eas.json: the production release profile); the detox E2E harness is complete under qa/mobile (runnable on infra with the mobile toolchains); the product engine is journey-validated in-sandbox (apps/mobile test battery + docs/journeys/mobile-android.md)",
            "environmentGap": "the Linux sandbox has no Android SDK — device/emulator runs and the apk/aab packaging cannot run here (docs/journeys/mobile-android.md honest environment record)",
        },
        "journeys": "docs/journeys/mobile-android.md",
    },
    {
        "platform": "mobile-ios",
        "appTree": "apps/mobile",
        "artifactKind": "expo ios release build — simulator/device archive, TestFlight-ready (eas build --platform ios)",
        "definitionFiles": [
            "apps/mobile/package.json",
            "apps/mobile/app.json",
            "apps/mobile/eas.json",
            "apps/mobile/tsconfig.json",
        ],
        "buildStatus": {
            "status": "config-delivered",
            "evidence": "the Expo/EAS build profiles are committed (eas.json: the production release profile); the detox E2E harness is complete under qa/mobile (runnable on infra with the mobile toolchains); the product engine is journey-validated in-sandbox (apps/mobile test battery + docs/journeys/mobile-ios.md)",
            "environmentGap": "the Linux sandbox has no Xcode — iOS builds require a macOS build host (docs/journeys/mobile-ios.md honest environment record)",
        },
        "journeys": "docs/journeys/mobile-ios.md",
    },
]

VERSION = "1.0.0"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True
    ).stdout.strip()


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: generate-manifest.py <source-commit> [--out <path>]")
    source_commit = sys.argv[1]
    out_path = Path(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[2] == "--out" else None
    full_sha = git("rev-parse", source_commit)

    clients = []
    for client in CLIENTS:
        checksums = {
            file: sha256_of(REPO_ROOT / file) for file in client["definitionFiles"]
        }
        tree_sha = git("rev-parse", f"{full_sha}:{client['appTree']}")
        clients.append(
            {
                "platform": client["platform"],
                "version": VERSION,
                "profile": "production",
                "artifact": {
                    "kind": client["artifactKind"],
                    "definitionFiles": client["definitionFiles"],
                    "definitionTreeSha": tree_sha,
                    "checksums": checksums,
                },
                "buildStatus": client["buildStatus"],
                "journeys": client["journeys"],
            }
        )
        if "artifacts" in client:
            clients[-1]["artifacts"] = client["artifacts"]

    manifest = {
        "schemaVersion": 1,
        "releaseId": "epoch-clients-v1.0.0",
        "version": VERSION,
        "sourceCommit": full_sha,
        "description": "The client release identity record set (W050; re-stamped by W063 with the real desktop installable artifacts: linux built-in-sandbox, windows built-in-sandbox-cross, macos ci-recipe-delivered). Every artifact records source commit, version/profile, target platform and checksum (spec/productization-architecture.md). Gaps and deviations are declared — never silent.",
        "clients": clients,
    }

    rendered = json.dumps(manifest, indent=2, sort_keys=False) + "\n"
    if out_path is not None:
        out_path.write_text(rendered)
        print(f"wrote {out_path} ({len(clients)} clients, source {full_sha[:8]})")
    else:
        sys.stdout.write(rendered)


if __name__ == "__main__":
    main()
