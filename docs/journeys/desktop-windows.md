# Desktop Journey Record — Windows (W048)

Platform: Windows (NSIS installer target — cross-OS target of the Linux build sandbox)
Persona: delivery lead (desktop product user)
Product version: 1.0.0 (@epoch/desktop + the Tauri 2 native host configs)
Source commit: 58232493133514b9bc244a59a8b17ea9451782b1 (dispatch base; journey logic re-validated at the W048 delivery head)
Environment: Linux-only build sandbox — the Windows NSIS build and the packaged-binary journeys were NOT executed here (recorded honestly, per the W048 sandbox rules); everything platform-neutral (product logic, visible UI, host config) validated as recorded in desktop-linux.md.
Fixture: epoch-fixture-construction-v1.0.0, epoch-fixture-software-v1.0.0

## Preconditions

- The Windows packaging matrix is committed and structurally pinned:
  - `apps/desktop/src-tauri/tauri.conf.json` → `bundle.windows.nsis` (installMode currentUser, English, LZMA), `webviewInstallMode: embedBootstrapper`, and the signing-ready fields (`certificateThumbprint`, `digestAlgorithm: sha256`, `timestampUrl`).
  - The Rust host command surface + the frozen 32-operation forwarding allowlist are pinned by `apps/desktop/test/native-ipc-surface.test.ts`.
  - `apps/desktop/src-tauri/icons/icon.ico` (16/32/128/256 PNG payloads, Vista+ format) is generated deterministically by `node scripts/generate-icons.mjs`.
- The product logic the Windows webview renders is the SAME composition validated on Linux (the platform-neutral layers): the product-logic journeys J01–J09, J11, J12 pass headlessly on both fixture domains (qa/desktop/journeys/records/journey-records.json), and the visible UI passes the Chromium E2E (qa/desktop/e2e/).

## Steps — the delivered validation

| # | Journey | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | J01–J09, J11, J12 (product logic — the exact view-models and bridge the Windows webview serves) | every step passes over the embedded gateway + real fixtures | 22/22 records pass (both fixture domains) — see desktop-linux.md Layer 1 | PASS (platform-neutral layer) |
| 2 | J01/J02/J07 (visible UI — the static-export frontend the Windows webview hosts) | onboarding, registry-verified project entry, world inspection, offline enqueue/reconnect/drain | 5/5 Chromium E2E (dev-server mode of the same frontend) | PASS (platform-neutral layer) |
| 3 | J12 install → launch (NSIS installer on Windows) | a fresh Windows environment installs and launches the app | NOT EXECUTED in this Linux-only sandbox — environment gap recorded below | OPEN (toolchain-gated) |
| 4 | J12 relaunch/update (packaged app) | persisted session/queue/projections restore; the protocol gate refuses incompatible updates | product-logic layer PASS; packaged-app execution toolchain-gated | PARTIAL (logic PASS; shell OPEN) |

## Defects

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| (none observed on Windows-specific code paths; the platform-neutral defect ledger is in desktop-linux.md and every entry is CLOSED) | — | — | — | — | — |

No unresolved P0/P1 defects on the platform-neutral layers.

## Evidence

- Packaging config: apps/desktop/src-tauri/tauri.conf.json (NSIS + signing-ready fields), pinned by test/native-ipc-surface.test.ts.
- Icon set: apps/desktop/src-tauri/icons/icon.ico (deterministic, committed).
- Platform-neutral journey evidence: qa/desktop/journeys/records/journey-records.json; qa/desktop/e2e/E2E-WEB-RUN.txt.
- Build/run entrypoints: `pnpm run tauri:build:windows` (NSIS); `pnpm run e2e:tauri` (WebdriverIO + tauri-driver, qa/desktop/wdio.desktop.conf.ts selects epoch-desktop.exe on win32).

## Rerun

Result: n/a (no Windows execution in this environment).
Notes: the packaged-journey runbook — build the webview (`pnpm run build:web`), build the NSIS bundle (`pnpm run tauri:build:windows`), run the WebdriverIO harness over the packaged binary (`pnpm run e2e:tauri` with tauri-driver on 127.0.0.1:4444) — executes the J01/J02/J07 visible-UI assertions against the real WebView2 shell; the manual-execution protocol (spec/journey-validation.md) covers any step automation cannot reliably drive.
