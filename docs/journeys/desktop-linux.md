# Desktop Journey Record — Linux (W048)

Platform: Linux (x86_64, Debian-family container)
Persona: delivery lead (desktop product user)
Product version: 1.0.0 (@epoch/desktop + the Tauri 2 native host configs)
Source commit: 58232493133514b9bc244a59a8b17ea9451782b1 (dispatch base; records re-emitted at the W048 delivery head)
Environment: Node/vitest headless product-logic run (the REAL DesktopProduct composition over the embedded fixture-backed Application Gateway — the W046 single-process composition — with the deterministic W046 fixtures and the REAL client-runtime offline queue/replay); visible-UI verification in real Chromium (Playwright) over the dev-server mode; native Tauri shell covered by config validation.
Fixture: epoch-fixture-construction-v1.0.0, epoch-fixture-software-v1.0.0 (qa/fixtures, registry-verified sha256)

## Toolchain audit (the honest environment record)

`node scripts/check-toolchain.mjs` on this machine:

| Prerequisite | Status |
|---|---|
| node v24.21.0 | present |
| pnpm 10.34.5 | present |
| cargo | ABSENT |
| rustc | ABSENT |
| webkit2gtk-4.1 (pkg-config) | ABSENT |
| libayatana-appindicator3 | ABSENT |

**Environment gap (recorded, not hidden):** the Linux native build (AppImage/deb) requires cargo/rustc 1.77+, webkit2gtk-4.1 and libayatana-appindicator — none present in this sandbox. The packaged-binary journeys (install → launch of the AppImage/deb) were therefore NOT executed here; the src-tauri host is delivered config-complete and structurally pinned (see below), with the packaged-journey runbook in qa/desktop/wdio.desktop.conf.ts.

## Preconditions

- The W046 product fixtures load with registry-verified digests (qa/fixtures/registry.json).
- The embedded fixture-backed Application Gateway composes over the real authorities (tenancy, world-model, action-gateway, evidence, event-log, sessions).
- The desktop product builds: `pnpm run build` (sync-fixtures + Next.js static export) succeeds; `out/` carries the webview payload + fixtures.

## Steps — the executed validation

### Layer 1: the product-logic journeys (J01–J09, J11, J12; both fixture domains)

Executed by `apps/desktop/test/desktop-journeys.test.ts` (`pnpm run desktop:journeys`): the REAL product methods (the exact view-models the UI renders, the exact bridge the webview uses) driven over the embedded gateway with the frozen journey clock.

| # | Journey | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | J01 onboard/project entry | session issues; project node resolves; world digest equals the fixture registry digest; W017 shell session snapshot recorded | 3/3 steps pass, both domains | PASS |
| 2 | J02 understand/reconstruct | world entities project; evidence record + digest; known/unknowns separate | 3/3 steps pass, both domains | PASS |
| 3 | J03 capability/role discovery | discovery run records roles + gaps through the discovery authority | steps pass, both domains | PASS |
| 4 | J04 constraints + Action Gateway approval | compiled constraint evaluates; chain validates; submit → human approval → execute → status runs ONLY through the Action Gateway | 3/3 steps pass, both domains | PASS |
| 5 | J05 program of work / BOQ / procurement | solution re-seals to the fixture digest; baseline approves; schedule folds; quote admits | 3/3 steps pass, both domains | PASS |
| 6 | J06 realize/observe/actualize/close | delivery opens; field observations intake; forecast rolls; verification validates; delivery closes | 4/4 steps pass, both domains | PASS |
| 7 | J07 offline/reconnect/idempotent sync | pending projection enqueued offline; offline drain fails transiently; reconnect drains exactly once; replay returns the RECORDED outcome; no second store | 5/5 steps pass, both domains | PASS |
| 8 | J08 cross-device handoff | world digest equality; session scope; cached projection admits | steps pass, both domains | PASS |
| 9 | J09 supervision/intervention | supervision check + alert raise through the authorities | steps pass, both domains | PASS |
| 10 | J11 recovery | failure/recovery chain (session-expired → re-authenticated, connector-failure → retry-succeeded, authority-rejection) | steps pass | PASS |
| 11 | J12 relaunch/update | persisted session/queue/projections restore; the protocol gate refuses incompatible update candidates | steps pass, both domains | PASS |

Committed evidence: `qa/desktop/journeys/records/journey-records.json` (22 records — 11 journeys × 2 domains — every step passing; field contract per spec/journey-validation.md).

### Layer 2: the visible-UI journeys (real Chromium, dev-server mode)

Executed by `pnpm run e2e:web` (qa/desktop/e2e/desktop-web.spec.ts, Playwright/chromium, run log qa/desktop/e2e/E2E-WEB-RUN.txt — 5/5 passed):

| # | User action | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Launch, click Authenticate | session bar flips to active; principal/tenant/gateway-mode badges | as expected | PASS |
| 2 | J01: click Enter project | world digest matches the fixture registry | badge rendered | PASS |
| 3 | J02: Inspect world | world-entity table projects | as expected | PASS |
| 4 | J07: Go offline → Enqueue sample observation → Go online → Drain queue | 1 pending → drain → no pending intents (exactly-once) | as expected | PASS |
| 5 | Domain switch (construction → software) + re-auth + Enter project | fresh product root over the software fixtures; registry digest matches | as expected | PASS |

### Layer 3: the native shell (config validation — the environment gap layer)

`apps/desktop/test/native-ipc-surface.test.ts` pins, against the committed src-tauri sources:

| Check | Result |
|---|---|
| Rust command surface registers EXACTLY IPC_HOST_COMMANDS + epoch_gateway_call | PASS |
| operations.rs allowlist mirrors the frozen 32-operation vocabulary | PASS |
| tauri.conf.json carries the Linux bundle matrix (AppImage + deb, webkit2gtk-4.1 dependency) | PASS |
| The deterministic icon set exists (PNG/ICO/ICNS) | PASS |
| The Tauri capability set (core + dialog) | PASS |

## Defects (observed → recorded → reproduced → regression-tested → fixed → rerun)

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| program.schedule milestone fold mis-shaped (folds.milestones treated as array; the fold is {rows, counts}) | P1 | J05 headless run failed | product.ts reads folds.milestones?.rows | desktop-journeys.test.ts (J05 both domains) | CLOSED |
| W017 shell session-open payload carried the gateway session descriptor (schemaVersion/sessionId/principalId keys) — strict envelope validation rejected it, so no shell session ever opened (J01 snapshotDigest null) | P1 | J01 headless run failed | bindSession sends the W017 tenancy scope; windowId grammar `win-main`; the workspace resolves through the real tenancy authority | desktop-journeys.test.ts (J01 both domains) | CLOSED |
| J04 constraint was hand-rolled JSON, not a compiled W004 artifact — evaluation failed closed (constraint-blocked) | P1 | J04 failed on both domains | the harness compiles through the REAL compileConstraint (@epoch/policy-contracts) | desktop-journeys.test.ts (J04 both domains) | CLOSED |
| Software-domain scenario IDs drifted from the fixture (tenant:checkout vs tenant:lightspeed; solution/activity ids) — policy applicability and tenant isolation failed | P1 | J04/J06/J07 software-domain runs failed | scenario aligned to the registry-verified fixture ids | desktop-journeys.test.ts (software domain) | CLOSED |
| J04 evaluation context hardcoded (spend) instead of the scenario's declared constraint inputs (p95) | P1 | J04 software-domain failure | runner passes the scenario's constraint context | desktop-journeys.test.ts | CLOSED |

No unresolved P0/P1 defects remain.

## Evidence

- Committed journey records: qa/desktop/journeys/records/journey-records.json (22/22 pass).
- Web E2E run log: qa/desktop/e2e/E2E-WEB-RUN.txt (chromium, 5/5).
- Test battery: apps/desktop/test (189 tests, 18 files — W017 pins + W048 native battery).
- Toolchain audit: `node scripts/check-toolchain.mjs` (the table above).

## Rerun

Result: after every defect fix, the affected journeys and the nearest related journeys re-ran green (the full 22-record suite re-executed; final state all-pass).
Notes: the packaged-binary journeys (AppImage/deb install → launch) remain OPEN on this platform pending a provisioned Linux toolchain; the runbook is qa/desktop/wdio.desktop.conf.ts + `pnpm run tauri:build:linux`.
