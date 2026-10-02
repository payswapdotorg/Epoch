# Desktop Journey Record — macOS (W048)

Platform: macOS (DMG + .app bundle target — cross-OS target of the Linux build sandbox)
Persona: delivery lead (desktop product user)
Product version: 1.0.0 (@epoch/desktop + the Tauri 2 native host configs)
Source commit: 58232493133514b9bc244a59a8b17ea9451782b1 (dispatch base; journey logic re-validated at the W048 delivery head)
Environment: Linux-only build sandbox — the macOS DMG build and the packaged-binary journeys were NOT executed here (recorded honestly, per the W048 sandbox rules); everything platform-neutral (product logic, visible UI, host config) validated as recorded in desktop-linux.md.
Fixture: epoch-fixture-construction-v1.0.0, epoch-fixture-software-v1.0.0

## Preconditions

- The macOS packaging matrix is committed and structurally pinned:
  - `apps/desktop/src-tauri/tauri.conf.json` → `bundle.macOS` (minimumSystemVersion 10.15; `dmg` positioning/window config; `signingIdentity: null` — the ad-hoc/unsigned default with the field ready for a signing identity).
  - Signing/notarization readiness: the DMG/app bundle configuration leaves `signingIdentity` settable and the build script `pnpm run tauri:build:macos` targets `dmg,app`; notarization (post-sign `xcrun notarize`) applies to the produced artifact on a provisioned macOS runner with the identity in the keychain.
  - The Rust host command surface + the frozen 32-operation forwarding allowlist are pinned by `apps/desktop/test/native-ipc-surface.test.ts`.
  - `apps/desktop/src-tauri/icons/icon.icns` (ic07/ic08/ic09/ic10 PNG payload chunks) is generated deterministically by `node scripts/generate-icons.mjs`.
- The product logic the macOS webview renders is the SAME composition validated on Linux (the platform-neutral layers): the product-logic journeys J01–J09, J11, J12 pass headlessly on both fixture domains (qa/desktop/journeys/records/journey-records.json), and the visible UI passes the Chromium E2E (qa/desktop/e2e/).

## Steps — the delivered validation

| # | Journey | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | J01–J09, J11, J12 (product logic — the exact view-models and bridge the macOS webview serves) | every step passes over the embedded gateway + real fixtures | 22/22 records pass (both fixture domains) — see desktop-linux.md Layer 1 | PASS (platform-neutral layer) |
| 2 | J01/J02/J07 (visible UI — the static-export frontend the macOS webview hosts) | onboarding, registry-verified project entry, world inspection, offline enqueue/reconnect/drain | 5/5 Chromium E2E (dev-server mode of the same frontend) | PASS (platform-neutral layer) |
| 3 | J12 install → launch (DMG/.app on macOS) | a fresh macOS environment installs and launches the app | NOT EXECUTED in this Linux-only sandbox — environment gap recorded below | OPEN (toolchain-gated) |
| 4 | J12 relaunch/update (packaged app) | persisted session/queue/projections restore; the protocol gate refuses incompatible updates | product-logic layer PASS; packaged-app execution toolchain-gated | PARTIAL (logic PASS; shell OPEN) |

## Defects

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| (none observed on macOS-specific code paths; the platform-neutral defect ledger is in desktop-linux.md and every entry is CLOSED) | — | — | — | — | — |

No unresolved P0/P1 defects on the platform-neutral layers.

## Evidence

- Packaging config: apps/desktop/src-tauri/tauri.conf.json (DMG + app bundle + signing-ready fields), pinned by test/native-ipc-surface.test.ts.
- Icon set: apps/desktop/src-tauri/icons/icon.icns (deterministic, committed).
- Platform-neutral journey evidence: qa/desktop/journeys/records/journey-records.json; qa/desktop/e2e/E2E-WEB-RUN.txt.
- Build/run entrypoints: `pnpm run tauri:build:macos` (DMG + .app); `pnpm run e2e:tauri` (WebdriverIO + tauri-driver, qa/desktop/wdio.desktop.conf.ts selects the .app binary on darwin).

## Rerun

Result: n/a (no macOS execution in this environment).
Notes: the packaged-journey runbook — build the webview (`pnpm run build:web`), build the DMG/app bundle (`pnpm run tauri:build:macos`), run the WebdriverIO harness over the packaged binary (`pnpm run e2e:tauri` with tauri-driver on 127.0.0.1:4444) — executes the J01/J02/J07 visible-UI assertions against the real WKWebView shell; the manual-execution protocol (spec/journey-validation.md) covers any step automation cannot reliably drive.

---

# W063 — the ci-recipe-delivered status (never fabricated)

Re-validation head: the W063 delivery. The W048 record above remains true as written.

Linux CANNOT produce a macOS DMG — the Apple SDK and codesigning toolchain exist only on macOS
hosts. That is a hard platform boundary. What W063 delivers instead of a fake artifact is a REAL
recipe that materializes it on demand:

`.github/workflows/release-desktop-native.yml` (workflow_dispatch):
- macos-14 runner; rust stable; pnpm 10.34.5; frozen install; the webview payload build; then
  `tauri build --bundles dmg,app` at the COMMITTED profile (LTO on, codegen-units 1, full
  crate-type set) — no sandbox deviations exist on that path by construction.
- Artifacts collected + SHA256SUMS + uploaded (actions/upload-artifact).
- It is NOT the release gate: the standard ci.yml battery remains the sole gate.

The same workflow carries the windows-latest canonical msvc NSIS job (repairing the three
in-sandbox gnu-route deviations enumerated in desktop-windows.md). The manifest status for
macOS is `ci-recipe-delivered` with the environmentGap stated as the platform boundary.
