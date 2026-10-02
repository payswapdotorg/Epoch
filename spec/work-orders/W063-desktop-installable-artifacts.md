# Work Order W063 — Desktop Installable Artifacts

Program: ACR-009 (approved 2026-10-02). Single serialized work order. Base: ACR-008/W062 complete (main).

## Objective

Produce the real installable versions of the Epoch desktop app for each platform target, closing the W048-declared environment gap, and re-stamp the release identity with the real records.

## Owned surfaces

`apps/desktop/src-tauri/**` (the D-1 host fix; the committed `Cargo.lock`), `.github/workflows/release-desktop-native.yml` (new, dispatch-only), `release/clients/**`, `docs/journeys/desktop-*.md`, `docs/journeys/defect-ledger.md`, `docs/release/client-release-process.md`, `spec/PROJECT-STATE.md`, `spec/development-state/*`, `AI_CONTINUATION.md`, `docs/LLM-ARCHITECT-HANDOFF.md`, plus `spec/architecture-change-requests/ACR-009-desktop-installable-artifacts.md`, `spec/work-items.md`, `spec/dependency-graph.md`, `spec/architecture-lock.md` (the program sections).

Forbidden: every other surface (packages/**, apps/web/**, apps/mobile/**, services/**, qa/** root manifests, the pnpm workspace catalog — the dependency-baseline guard must stay green unchanged).

## Deliverables

1. Linux: `Epoch_1.0.0_amd64.deb` + `Epoch-x86_64.AppImage` — built with the user-space-provisioned toolchain (the recipe recorded in `docs/journeys/desktop-linux.md`); launch verification to the spawn boundary under Xvfb with the WebProcess EGL display boundary declared.
2. Windows: `Epoch_1.0.0_x64-setup.exe` — mingw-w64 gnu cross-compile; every build-local deviation enumerated and reverted; unsigned status honest.
3. macOS: the ci-recipe-delivered status via `.github/workflows/release-desktop-native.yml` (macos-14 dmg+app at the committed profile; plus the windows-latest canonical msvc job).
4. The release re-stamp: `release/clients/release-manifest.json` regenerated at the delivery head carrying real artifacts (file, bytes, sha256, producedBy) + declared deviations.
5. The defect ledger entries D-1..D-4 with the full discipline chain.
6. The governance advance (PROJECT-STATE, development-state, AI_CONTINUATION).

## Verification (the TL gates)

- The committed tree is deviation-free: `git diff` shows no build-local adaptations.
- The manifest regenerates deterministically at the head; the artifact sha256s re-verify against the preserved artifacts.
- The standard battery (check/typecheck/lint/test/build via turbo) stays green; the dependency-baseline guard green; governance check PASS.
- The honest statuses read back exactly: built-in-sandbox / built-in-sandbox-cross / ci-recipe-delivered — never a claim beyond the evidence.
