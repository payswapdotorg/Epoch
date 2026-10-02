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

---

# W063 — the real installable artifact (cross-compiled from the Linux sandbox)

Re-validation head: the W063 delivery. The W048 record above remains true as written. W063
produced the FIRST real Windows artifact: `Epoch_1.0.0_x64-setup.exe`.

## Route selection (honest, under the sandbox ceilings)

- The CANONICAL route (msvc via cargo-xwin) was attempted first: the MSVC CRT + Windows SDK
  cab downloads succeeded (~1.1G), but the 9.9G overlay disk ceiling (image lower-layer content
  is immovable; the 4.4G preinstalled python venv was also a lower-layer file) cannot hold the
  ~2.5G splat + the build tree. Recorded, not hidden.
- The DELIVERED route: mingw-w64 gnu cross-toolchain (Debian trixie gcc 14-win32,
  x86_64-pc-windows-gnu; ~200M of debs user-space). `epoch-desktop.exe`: PE32+ GUI x86-64,
  stripped, 12,698,708 bytes — links the committed host surface (WebView2Loader.dll resolved
  by the bundler; the full committed Cargo.lock graph).

## Build-local deviations (EVERY one reverted from the committed tree — the record is the contract)

1. Release profile relaxed via ENV override only (`CARGO_PROFILE_RELEASE_LTO=false`,
   `CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16`): the committed profile's bfd-ld cdylib
   import-library link was OOM-killed (ld signal 9; 4G RAM, no swap).
2. The desktop build linked the rlib only (a build-local `crate-type = ["rlib"]` patch,
   reverted after the build): the cdylib/staticlib crate-types are the mobile-side link
   passes and were the OOM paths. The committed Cargo.toml keeps the full set.
3. gnu target instead of msvc (disk-blocked as above).
THE CANONICAL RECIPE repairs all three at the committed profile on a windows-latest runner:
`.github/workflows/release-desktop-native.yml` (dispatch; uploads artifacts + SHA256SUMS).

## The NSIS bundling bridge (the honest engineering record)

- makensis 3.11 (Debian) has `/usr/share/nsis` compiled in absolutely; the user-space prefix
  carried the nsis data. Bridge: an LD_PRELOAD path rewriter for the build env (open/stat/
  access families; never shipped) + the `${NSISDIR}` literals in the prefix's .nsh files
  repointed to the absolute prefix (windows separators normalized) + a custom NSIS template
  via `tauri build --config` overlay carrying `!addincludedir`/`!addplugindir`.
- The WebView2 bootstrapper (embedBootstrapper per the committed tauri.conf.json) was fetched
  from Microsoft at bundle time (2,002,128 bytes, msedge.sf.dl.delivery.mp.microsoft.com).
- The installer is UNSIGNED: no certificate exists in the program; tauri-bundler skipped
  signing with its own warning — recorded here, never fabricated as signed.

## Verification (the honest boundary)

- Structural: `file` → PE32+ setup exe (6,371,004 bytes); the inner `epoch-desktop.exe` is
  PE32+ GUI x86-64 stripped. `makensis` completed with 2 warnings (OUTPUTCHARSET/File-a
  non-Win32 platform notices) — both are cross-compile notices, not defects.
- EXECUTION: the installer was NOT executed in-sandbox (no Windows host / no wine). The
  canonical CI recipe builds AND can smoke-test on a windows runner. The gnu-route binary
  links the same committed host surface the Linux build validates; the webview payload is
  platform-neutral (verified by the Chromium battery).

## Artifact

- `Epoch_1.0.0_x64-setup.exe` — 6,371,004 bytes — sha256 in release/clients/release-manifest.json.
- Raw binary: `epoch-desktop.exe` — 12,698,708 bytes — sha256 13f7086021de1e3b30da9cb22666bbd337140a5dd131a7e4c29fccd507985ec7.
