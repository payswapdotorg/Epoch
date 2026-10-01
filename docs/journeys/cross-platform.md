# Journey W050 — Cross-Platform Release + Journey Closure

Platform: Web (canonical) + Desktop (Linux/Windows/macOS) + Mobile (Android/iOS) — the six-platform release
Persona: delivery lead / field engineer / chief engineer (construction), tech lead / staff engineer (software), release engineer (Tech Lead)
Product version: 1.0.0 (all three client products on the W046 Application Gateway)
Source commit: `39cc9c84e554cf51b0a301f532e19c0deba7b903` (dispatch base; evidence re-emitted at the W050 delivery head)
Environment: Node 24 / pnpm 10.34.5 / Linux (debian-family container) — the REAL product engines in-process: the web server product runtime (`apps/web/src/server/product-runtime`), the `DesktopProduct` composition root the Tauri webview drives (`apps/desktop/src/native`), and the `MobileFieldHost` the React Native app hosts (`apps/mobile/src/product`), each over the W046 fixture-backed Application Gateway with the deterministic W046 fixtures
Fixture: `epoch-fixture-construction-v1.0.0` (tenant:nordstrand), `epoch-fixture-software-v1.0.0` (tenant:lightspeed) — registry-verified against `qa/fixtures/registry.json`

## Preconditions

- The W047/W048/W049 per-platform journeys are complete and their records committed (web.md, desktop-{linux,windows,macos}.md, mobile-{android,ios}.md).
- The cross-platform harness `qa/cross-platform` is wired into the standard battery (apps/web typecheck/lint/test).
- Every platform composes the SAME authorities over the SAME fixtures (the W046 single-process composition).

## Steps — the executed cross-platform validation

Executed by `qa/cross-platform/cross-platform.test.ts` (`pnpm run cross:journeys` from apps/web; committed records: `qa/cross-platform/records/cross-platform-records.json` — 8/8 records, every step passing):

| # | Check | Expected | Observed | Result |
|---|---|---|---|---|
| X-01 | Digest continuity (both domains) | The world digest every platform projects equals the registry anchor | web === desktop === (mobile, construction) === registry, both domains — byte-identical digests | PASS |
| X-02 | Cross-device session continuity | The same fixture principal signs in on every platform with identical tenant/principal resolution; semantics never mutate on sign-in | principal/tenant identical across platforms; world digest unchanged | PASS |
| X-03 | Capture continuity (J08 cross-device: capture on mobile, inspect on web/desktop) | The same fixture bytes produce the same digest through every platform's evidence path | mobile digest-before-upload === desktop authority-recomputed intake === web record subject digest === registry `objectBytesDigest` | PASS |
| X-04 | Approval continuity (J04: approve where permitted) | Approvals run only through the Action Gateway, with one status vocabulary | mobile: awaiting-approval → authorized; web: awaiting-approval → authorized → executed; desktop: submitted → approved → executed | PASS |
| X-05 | Offline no-drift (J07: offline work, queue, reconnect, idempotent sync) | The same capture content, online on one device and offline-then-synced on another, resolves to the identical outcome digest, exactly once | 1 drained / 0 pending, `duplicateSideEffects=0`, `replayed=true`, `digestStable=true`, offline outcomeDigest === online outcomeDigest | PASS |
| X-06 | Release identity | Every artifact records source commit, version/profile, platform and checksum | `release/clients/release-manifest.json`: 6 platforms, checksums recomputed, git tree identities verified | PASS |

## Defects

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| (none — no product-level cross-platform defects) | — | — | — | — | — |

No cross-platform repair was required: the three client products composed the shared authorities correctly on first drive (the harness bring-up corrections — fixture tenant derivation, the deployment constraint resolver wiring — were harness-side, not product defects; the client trees are unchanged by W050).

## Evidence

- Committed cross-platform records: `qa/cross-platform/records/cross-platform-records.json` (8/8 pass — the spec/journey-validation.md field contract).
- The harness: `qa/cross-platform/cross-platform.test.ts` (9 tests, all passing; runs in the standard CI battery through the apps/web wiring).
- Release identity: `release/clients/release-manifest.json` + `release/clients/generate-manifest.py` (deterministic regeneration).
- CI artifact: the W050 PR checks (governance, boundary, typecheck, lint, test, build — turbo serial; the battery includes the cross-platform harness via apps/web).

## Rerun

Result: **9/9 tests passing** (final battery; the records re-emitted at the delivery head).
Notes: fixture ids `epoch-fixture-construction-v1.0.0` / `epoch-fixture-software-v1.0.0`; the mobile field product runs the construction domain (the field scenario — recorded per-domain in the committed records); the packaged-binary journeys remain with the per-platform records per the sandbox-honesty rule.

## Journey closure (the W050 mandate)

The expected record set of `docs/journeys/README.md` is now complete:
`web.md`, `desktop-linux.md`, `desktop-windows.md`, `desktop-macos.md`,
`mobile-android.md`, `mobile-ios.md`, `cross-platform.md` (this record),
`defect-ledger.md` (the consolidated ledger). All required journeys pass;
no unresolved P0/P1 anywhere in the program; every P2 has a disposition
(see the ledger); cross-device state is consistent (X-01/X-02/X-03);
install/launch/relaunch/update is covered per platform (J12 records +
the release identity manifest).
