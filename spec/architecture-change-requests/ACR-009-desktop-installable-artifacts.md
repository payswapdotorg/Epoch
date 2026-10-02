# ACR-009 — Desktop Installable Artifacts

Status: APPROVED — productization/release program (no architecture change; no lock transition; E1.0/X2.0 invariants remain binding)

Approved: 2026-10-02 (the operator's direct directive: "create installable versions of each desktop app")

## Class of change

This is NOT a new semantic subsystem and NOT an architecture extension. It is the completion of
the ALREADY-SCOPED ACR-005 client productization program at its declared boundary: W048 delivered
the desktop host "config-complete" with the packaging honestly deferred ("config-delivered ...
the AppImage/deb packaging cannot run here" — the declared environment gap in
`release/clients/release-manifest.json` and `docs/journeys/desktop-*.md`). ACR-009 closes that
gap by provisioning the toolchains and producing the real installable artifacts, re-stamping the
release identity with the real records. No lock transition; no contract version bump; the
architecture invariants are untouched (platform toolchains remain adapters, never authorities —
lock rule 13).

## The operator directive

"create installable versions of each desktop app" — the desktop app has three platform packaging
targets (desktop-linux AppImage+deb, desktop-windows NSIS, desktop-macos DMG+app). The program
delivers, per platform, the most complete honestly-verifiable artifact:

- desktop-linux: `built-in-sandbox` — the full toolchain provisioned user-space (no root);
  real AppImage + deb; launch verification to the spawn boundary; every deviation declared.
- desktop-windows: `built-in-sandbox-cross` — the mingw-w64 gnu cross-compile with every
  build-local deviation enumerated, plus the CANONICAL msvc recipe as a dispatch workflow.
- desktop-macos: `ci-recipe-delivered` — a real macos-14 dispatch workflow at the committed
  profile (Linux cannot produce a DMG — a hard platform boundary, never fabricated).

## The defects closed on the way (the first packaged builds ever run)

The packaged build had NEVER executed (W048 was config-delivered) — the first full run exposed
real defects, each closed with the discipline chain (observed -> fixed -> rerun -> closed):
D-1 the unused `#[derive(Default)]` (E0277) in the Rust host; D-2 the dangling prefix dev
symlinks at the link stage; D-3 the linuxdeploy gtk plugin prefix-path cp defect; D-4 the
AppImage libEGL closure gap. All recorded in `docs/journeys/defect-ledger.md`.

## Non-negotiables

- The COMMITTED tree never carries build-local deviations: every cross-compile adaptation is
  reverted and recorded in the manifest `deviations` field and the journey docs.
- Every artifact records file, bytes, sha256 and producedBy in the release manifest
  (`spec/productization-architecture.md` release identity rule).
- Every status is honest: `built-in-sandbox` / `built-in-sandbox-cross` / `ci-recipe-delivered`
  are the only statuses; "config-delivered" remains for the mobile platforms (out of scope).
- Never fabricated: no launch claimed beyond the evidence; no signing claimed without a
  certificate; no DMG claimed from Linux; the WebProcess EGL display boundary is declared.
- The canonical recipes (windows-latest msvc, macos-14) live in
  `.github/workflows/release-desktop-native.yml` and are NOT the release gate — the standard
  ci.yml battery remains the sole gate.

## Binding implementation

W063 (single work order, serialized). Surfaces: `apps/desktop/src-tauri/**` (the D-1 fix +
the committed `Cargo.lock`), `.github/workflows/release-desktop-native.yml` (new),
`release/clients/**`, `docs/journeys/desktop-*.md` + `defect-ledger.md`,
`docs/release/client-release-process.md`, `spec/PROJECT-STATE.md`,
`spec/development-state/*`, `AI_CONTINUATION.md`, `docs/LLM-ARCHITECT-HANDOFF.md`.
No `apps/web` / `apps/mobile` / packages surfaces. No root manifests/lockfiles touched
(the pnpm catalog is unchanged; `src-tauri/Cargo.lock` is a NEW derived pin inside the
desktop owned surface — the dependency-baseline guard reads the pnpm workspace only).
