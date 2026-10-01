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
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "config-delivered",
            "evidence": "the Tauri 2 host is config-complete and structurally pinned (qa/desktop native battery; the webview payload builds via pnpm build; the packaged-binary runbook is qa/desktop/wdio.desktop.conf.ts + pnpm run tauri:build:linux)",
            "environmentGap": "the Linux sandbox has no cargo/rustc, no webkit2gtk-4.1, no libayatana-appindicator — the AppImage/deb packaging cannot run here (docs/journeys/desktop-linux.md toolchain audit)",
        },
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
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "config-delivered",
            "evidence": "the Windows bundle matrix is committed in tauri.conf.json; the same Rust host + webview payload as Linux (one artifact definition family)",
            "environmentGap": "Windows packaging requires a Windows host with the MSVC toolchain — not present in this Linux sandbox (docs/journeys/desktop-windows.md)",
        },
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
            "apps/desktop/tsconfig.json",
        ],
        "buildStatus": {
            "status": "config-delivered",
            "evidence": "the macOS bundle matrix is committed in tauri.conf.json (signing/notarization-ready structure); the same Rust host + webview payload as Linux (one artifact definition family)",
            "environmentGap": "macOS packaging requires a macOS host with Xcode — not present in this Linux sandbox (docs/journeys/desktop-macos.md)",
        },
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

    manifest = {
        "schemaVersion": 1,
        "releaseId": "epoch-clients-v1.0.0",
        "version": VERSION,
        "sourceCommit": full_sha,
        "description": "The client release identity record set (W050): every artifact records source commit, version/profile, target platform and checksum (spec/productization-architecture.md). Config-delivered platforms declare their environment gaps — never silent.",
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
