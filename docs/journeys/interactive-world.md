# Journey: The Interactive World Workspace — the FINAL closure record (W061)

Platform: web (the `/world` App Router page + `WorldWorkspaceHost` over the
REAL `@epoch/world-runtime` and the REAL `RendererFabric`) and desktop (the
Tauri world section, the same runtime/host wiring) — plus, at closure, the
REAL browser E2E battery over real software GL.
Product version: ACR-007 / X2.0 closed (W061 — multi-renderer interactive
world closure); the W016 marker-time P2 defect-ledger entry below is
CLOSED at W062 (ACR-008 — the defect-closure program; this file is the
ledger of record).
Source commit: this branch (`work/W061-multi-renderer-closure`), the
save-point chain `a9e743f` (web /world host + desktop real-renderer
registration) → `21b7d49` (qa/rendering engine-pair + degradation ladder) →
`c90badb` (the j13-world E2E battery + two P1 fixes) → this commit (the
final record set).
Engines: Three.js `three@0.186.1` (MIT) and Babylon.js
`@babylonjs/core@9.29.0` (Apache-2.0) — both embedded behind the frozen W056
`RendererAdapter` seam (`contracts/renderers` v1.1.0), with the
contract-only reference adapter as the declared fallback; the Blender
sidecar and the glTF 2.0 interchange bridge (W060) behind the same seam.
Environment (recorded exactly): deterministic vitest batteries (Node 22)
for the runtime/host batteries; the closure E2E legs run in REAL Chromium
over REAL software GL — ANGLE/SwiftShader (`--use-angle=swiftshader
--enable-unsafe-swiftshader`), Playwright 1.63.0, production build (`next
build` + `next start -p 3210`, the free private port of
`apps/web/playwright.world.config.ts`). Real-browser real-GL evidence,
honestly presented as SOFTWARE rasterization: no GPU exists in this sandbox
and nothing here is claimed as a GPU run.
Fixture: the Riverside plant-room riser coordination problem (the compact
canonical slice shared by every battery — `qa/world-experience` /
`apps/web/src/features/world/host/world-fixture.ts` /
`apps/desktop/app/components/world-host/world-fixture.ts`).

## The journey thesis (the work-order acceptance)

A user can enter a real fixture problem and **solve it through the
spatial world** — the viewport is the PRIMARY problem-solving surface —
**switch the real engine underneath without leaving Epoch**, and close the
loop through the canonical authorities (Action Gateway included). Every
interaction produces an EXISTING typed Epoch intent
(`epoch.world.interaction.*`, the W016 vocabulary), admitted and applied
through the canonical boundaries. No table/status representation is
required to work the problem; no vendor UI is required for any leg.

## The FINAL battery: 18 legs, per-leg verdicts and evidence

| # | Leg (work-order battery) | Verdict | Evidence |
|---|---|---|---|
| 1 | enter a real fixture problem | PASS | `apps/web/e2e/j13-world.spec.ts` leg 1 — `/world` reaches `data-world-phase=ready`; banner carries the problem name + tenant; the world digest equals the sealed fixture digest; Three.js active with both real engines + the reference fallback listed, healthy. Shot `e2e-results/world-legs/leg01-enter.png` |
| 2 | render a real spatial world | PASS | leg 2 — REAL GL pixels: `data-gl-three=true`, engine canvas visible, and the battery asserts the actual WebGL renderer STRING contains `SwiftShader` (software GL pinned, never claimed as GPU). Shot `leg02-render-three.png` |
| 3 | orbit/move/zoom | PASS | leg 3 — real keyboard orbit (`q`), pan (`w`), wheel zoom; the typed `zoom` intent lands in the journal and the navigation HUD moves. Shot `leg03-orbit-zoom.png` |
| 4 | select a semantic entity | PASS | leg 4 — a real mouse click at the entity's DERIVED projected position (the adapters' own projection helpers, the honest pointer basis) through the Three.js Raycaster; `select:applied` in the journal; inspect panel shows the entity |
| 5 | inspect it | PASS | leg 5 — the typed `inspect` intent (effect-only): `inspect:normalized` + the `inspect-requested` effect awaits the world model; never executed by the UI |
| 6 | isolate/reveal a layer | PASS | leg 6 — `layer-isolate-lyr-mep` issues the typed `filter` intent; a pick on a hidden-layer entity honestly resolves `select:no-target`; reveal-all issues `show` and the world returns |
| 7 | measure | PASS | leg 7 — the documented FOUR-pick cadence over the REAL engine affordance (adapter anchor → runtime arm → adapter re-anchor → compose): four journal entries ending in the `measure-requested` effect; identical to the desktop world-host battery and the workspace module docs |
| 8 | annotate | PASS | leg 8 — the typed `annotate` intent enters the CANONICAL revision: the world digest changes (asserted) |
| 9 | see and follow an agent | PASS | leg 9 — both agents present in the presence panel; `follow-agent:applied`; the HUD shows the `follow-agent` camera mode; the followed marker is pinned |
| 10 | replay/seek | PASS | leg 10 — track scrub (typed `replay`), pause/resume transport; the branch-point marker is presented |
| 11 | branch/simulate | PASS | leg 11 — the scene controls issue the typed `branch`/`simulate` intents; their request effects await their authorities; the scene is NOT mutated |
| 12 | switch Three.js → Babylon.js without leaving Epoch | PASS | leg 12 — the direct switch with world digest + tenant continuity (asserted), the Babylon GL surface live at its first session, the switch receipt surfaced, and a semantic pick through the REAL Babylon `scene.pick` on the switched session |
| 13 | switch back | PASS | leg 13 — the reverse switch with the same invariants; a semantic pick through the real Three.js Raycaster after the round trip |
| 14 | exercise the external foundation path without separate vendor UI | NOT-RUNNABLE (honest) | the recorded skip test in `j13-world.spec.ts` carries the exact reasons: (1) `bindAsset` is adapter-seam-scoped in the frozen RendererAdapter contract v1.1.0 (the W060 advisory: a fabric-level asset-binding orchestration would be a CONTRACT CHANGE), so the `/world` host composition exposes no in-page path to the glTF bridge; (2) the Blender real-binary battery is env-gated and NO Blender binary exists in this sandbox. The path IS proven at its real surface: `qa/foundation-renderers` (glTF → validate → binding → `bindAsset` on a REAL Three.js adapter session + the Blender-double subprocess round-trip — 84/84 + the 15-test battery). Closing commands: `EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=<blender> corepack pnpm --filter @epoch/adapter-renderer-blender test` and `corepack pnpm --filter @epoch/adapter-foundation-gltf test` |
| 15 | verify world digest/entity continuity | PASS | asserted inside legs 12/13 (the digest before each switch equals the digest after; entity picks resolve through each engine's own hit-test surface) and pinned deterministically by `qa/rendering/engine-pair.test.ts` (digest/tenant/portable-state continuity across the direct cross-engine switch) |
| 16 | force renderer degradation/failure and verify declared fallback | PASS | `apps/web/e2e/j13-world-degradation.spec.ts` (the `chromium-no-gl` project — WebGL disabled at launch, the forced condition asserted REAL: no WebGL context exists): both engine probes honestly report `false`, the session stays healthy on the real adapters' declared headless cores, the declared fallback surface is the contract-only reference projection (`data-spatial-overlay=reference`) drawing every visible entity, and the degraded world stays fully interactive (a real pick resolves through the headless hit-test core). The fabric-level forced ladder (declared degradations, undeclared typed refusals, ordered fallback, abort-with-retention) is pinned deterministically by `qa/rendering/degradation-fallback.test.ts`. Shot `leg16-degraded-reference.png` |
| 17 | approve an actual action through the Action Gateway | PASS | `j13-world.spec.ts` test 2 — the real decision surface: seal → constraint evaluate → chain validate → baseline approve → submit (`awaiting-approval`) → APPROVE → execute, all through the REAL Action Gateway (Epoch's only execution path). Shot `leg17-18-action-gateway.png` |
| 18 | verify resulting state/evidence in Epoch | PASS | same test — the executed action's terminal status re-resolves from the authoritative action stream on the Developers surface (`executed` in the action-status table) |

E2E result (recorded): **3 passed / 2 honest skips** (the leg-14 skip and
the degradation-leg project scoping), 23.9s total at the c90badb save
point; the battery starts its own production server on the free port 3210.

## Defect ledger (the discipline chain: observe → record → reproduce → regression-test → fix → rerun → close)

| Defect | Severity | Chain | Regression pin | Status |
|---|---|---|---|---|
| The viewport controls rendered BELOW the pointer-capture SVG (`zIndex 1`): the reset-camera button was intercepted and UNCLICKABLE in the real engine composition | P1 (observed at the first real-engine E2E bring-up) | observed (leg 3 could not focus the viewport) → recorded → reproduced (pointer events intercepted by the capture layer) → fixed (`WorldViewport.tsx`: controls stack at `zIndex 2`) → rerun green | leg 3 itself (reset-camera click + keyboard navigation through the focused viewport) | CLOSED at `c90badb` |
| The stage's GL-liveness state was captured ONCE at mount: the lazy engines (constructed at their FIRST session, not at mount) left `data-gl-babylon` stale forever after a switch | P1 (observed when leg 12's GL assertion could never go live) | observed → recorded → reproduced (the probe state never refreshed) → fixed (`world-host.tsx`: the probes refresh on every view-model tick) → rerun green | leg 12 (`data-gl-babylon=true` on the switched session) + leg 16 (both probes honestly `false` without GL) | CLOSED at `c90badb` |
| W016 marker-time ordering compared `${atMs}\0${markerId}` LEXICOGRAPHICALLY: mixed-width times (5000 vs 12000) failed admission — numerically ASCENDING timelines were refused, and the mirrored numerically DESCENDING order was admitted with a WRONG timeline end bound | P2 (the W057-discovered defect) | observed (W057 journey bring-up) → recorded (the W057 defect table + the harness README advisory) → reproduced precisely at the REAL W016 surface (`admitWorldScene`) in `qa/world-experience/w016-marker-time-known-issue.test.ts` (3 tests, pinned green while the defect stood so the fix must FLIP them) → FIXED at W062/ACR-008 (`packages/world-experience/src/timeline.ts`: the comparator inside the same `.superRefine` now compares `atMs` NUMERICALLY with the lexicographic `markerId` tie-break — the already-specified intent; strictly-ascending duplicate-free pairs unchanged; no schema/contract version bump, no second comparator) → RERUN green (the flipped battery: the ascending mixed-width case ADMITS with `timelineEndMs` == 12000 and the in-track 8000ms position validating; the mirrored descending case is REFUSED with the typed `malformed-record` admission error at `timeline.markers`; the same-digit-width control stays green — the world-runtime battery 70/70 including the flipped record) → CLOSED | the flipped regression record `qa/world-experience/w016-marker-time-known-issue.test.ts` (3 tests, file path stable) + the focused comparator regression `packages/world-experience/test/timeline-ordering.test.ts` (5 tests: mixed-width ascending admits, mixed-width descending refused, duplicate refused, markerId tie-break ordering, same-width control) | CLOSED at W062 (ACR-008) |
| (W057, carried in the closure record) hiding the layer of the FOCUSED entity killed the renderer session | high (W057) | fixed at W057 (`portableViewStateOf` carries the focus MINUS the hidden set) | `packages/world-runtime/test/workspace-runtime.test.ts` | CLOSED at W057 |
| (W057) the W050 release-identity checksums pinned the pre-W057 desktop `package.json` | medium (W057) | fixed at W057 by the sanctioned manifest re-stamp; re-stamped again at W061 (see below) | the X-06 cross-platform battery | CLOSED at W061 (re-stamp disclosed in the PR) |
| The pinned Blender sidecar script's argv-validation prologue called `require(condition, report_path, job_id, error_code, message)` with only 4 positional arguments (staged sidecar lines 79/81): EVERY real-Blender sidecar job (`render-offscene` and `export-gltf` alike) died with `TypeError: require() missing 1 required positional argument: 'message'` before reading the job spec or writing any report; Blender 4.2.11 printed the traceback to stderr but EXITED 0, so the typed boundary returned the `report-missing` (ENOENT) failure wrapped as `session-failed` at the seam | P1 (the W064 live-battery finding, 2026-10-03 — both the render and export live legs fail against the REAL official binary; the probe leg passes; the double-mode CI battery is UNAFFECTED because the committed double re-implements the job protocol in JavaScript and never executes the sidecar Python) | observed (the W064 live run: `2 failed | 1 passed | 1 skipped` — the version probe PASS, the render FAIL at `live-blender.test.ts:95`, the export FAIL at `live-blender.test.ts:139`) → recorded (this ledger + the W064 live-run record in docs/rendering/blender.md) → reproduced precisely TWO ways (a persistent-workspace diagnostic run of the same adapter path printing the typed `report-missing` ENOENT failures; a manual `blender --background --factory-startup --python <staged sidecar> -- <job.json> <report.json>` invocation of the exact staged files — exit code 0, the TypeError traceback on stderr, NO report file; the staged sidecar digested to the pinned `BLENDER_SIDECAR_PYTHON_DIGEST` `c52801e2…`) → NOT FIXED (W064 is the docs-only verification closure; remediation scope is the Tech Lead's per the work order) | the env-gated live battery itself (`adapters/renderers/blender`: `EPOCH_BLENDER_LIVE=1 EPOCH_BLENDER_PATH=<official 4.2.11> corepack pnpm run test:live` — flips green when fixed); a CI-executable sidecar-Python execution/arity check is remediation scope for the TL | OPEN (recorded at W064, 2026-10-03) |

## Evidence set

- **Browser E2E (the closure battery):** `apps/web/playwright.world.config.ts`
  (production build, free port 3210, `chromium` with REAL software GL via
  SwiftShader ANGLE, `chromium-no-gl` for the degradation leg) +
  `apps/web/e2e/j13-world.spec.ts` + `j13-world-degradation.spec.ts`.
  Visual evidence convention: per-leg full-page screenshots under
  `apps/web/e2e-results/world-legs/` (gitignored run artifacts — binary
  evidence stays local by the repo's artifact policy; the committed
  evidence is the spec set + this record).
- **Deterministic engine battery:** `qa/rendering`
  (`engine-pair.test.ts` — the direct Three⇄Babylon cross-switch over the
  SHARED canonical fixture; `degradation-fallback.test.ts` — the forced
  ladder), riding `corepack pnpm --filter @epoch/renderer-fabric test`.
- **Journey + parity batteries:** `qa/world-experience`
  (`world-journey.test.ts` 13 tests, `web-driver-parity.test.ts` 3 tests,
  `w016-marker-time-known-issue.test.ts` 3 tests) via
  `corepack pnpm --filter @epoch/world-runtime test`.
- **Host batteries:** `apps/web/src/features/world/host/world-engines.test.ts`
  (4 — the real-engine headless battery) + `world-host.test.tsx` (3) + the
  W057 feature/route batteries; `apps/desktop/test/world-host.test.ts`
  (3 — re-pinned to the REAL adapters) inside the 192-test desktop suite.
- **Scoped frozen baselines (regression):** renderer-fabric pipeline 36/36
  (the 27-test W056 baseline + the 9-test W061 qa/rendering battery riding
  it), renderer-runtime 227/227, threejs adapter 58/58, babylonjs adapter
  64/64, gltf 84/84, blender 40 passed + 3 env-gated live skips.

## What is test-proven vs. what remains NOT-VERIFIED-live (the honest split)

**Test-proven (deterministic + real browser):** the complete 18-leg loop
above — through the REAL fabric seam, the REAL W016 admission/reducer, the
REAL web/desktop presenters, and (legs 1-13, 15-18) a REAL Chromium over
REAL software GL with both real engines live.

**NOT-VERIFIED-live (recorded honestly, never fabricated):**
- the Blender REAL binary — **RAN-live at W064 (2026-10-03) and
  FAILED-live honestly**: the official Blender 4.2.11 LTS
  (operator-supplied binary, never bundled; source URL + sha256 + the
  full live-run record in docs/rendering/blender.md) was supplied to the
  env-gated battery with the result `2 failed | 1 passed | 1 skipped`:
  the version probe PASSES (the live evidence line `[live] probe:
  Blender 4.2.11 (separate-process sidecar)…`); the offscreen Cycles
  render and the glTF/GLB export FAIL on a REAL sidecar defect — the
  pinned sidecar script's argv-validation `require()` calls pass 4 of
  5 required positional arguments, so every real-Blender sidecar job
  dies with `TypeError: require() missing 1 required positional
  argument: 'message'` before writing any report (Blender 4.2.11
  exits 0; the adapter returns the typed `report-missing` failure) —
  ledgered in the defect ledger below (OPEN; remediation is Tech Lead
  scope — W064 is docs-only). CI-verified evidence remains the
  committed Node CLI double (a real subprocess boundary, doubled
  engine — 40 passed + 3 env-gated skips, no regression; the live run
  is NEVER claimed as CI evidence);
- any leg-14 in-page path — blocked on the frozen contract's
  adapter-seam-scoped `bindAsset` (a fabric-level orchestration would be a
  contract change for a future ACR, per the W060 advisory);
- GPU rasterization — SwiftShader ANGLE is REAL browser GL but
  software-rasterized; no GPU exists in this sandbox and no run here is
  presented as one.

## Rerun

```
# the deterministic batteries
corepack pnpm --filter @epoch/world-runtime test        # 70/70 (51 runtime + 19 qa/world-experience)
corepack pnpm --filter @epoch/renderer-fabric test      # 36/36 (incl. the 9-test qa/rendering battery)
# the browser closure battery (production build on the free port 3210)
cd apps/web && npx playwright test --config playwright.world.config.ts
```

Result: all listed batteries green on this branch (see the PR body for the
exact commands and pass counts).
