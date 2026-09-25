# Epoch Project State

Architecture: E1.0 / X1.0 (ACR-001 + ACR-002 + ACR-003 targets pending lock transition)
Work Order schema: WO1.0
Default branch: main
Max concurrent workers: 3
Bootstrap baseline: ad76c5c5cdb92cd4ff72b90b663bdce26bb9b3ce

Current frontier:
- W001 COMPLETE (PR #2, squash 1b0d8d24; reviewed head be8f48a0)
- W002 COMPLETE (PR #6, squash f4a7ffa1; reviewed head a58a95f8)
- W003 COMPLETE (PR #8, squash aeabf3b6; reviewed head eda7bbd8)
- W004 COMPLETE (PR #7, squash d98bb42e; reviewed head 7980e996)
- Foundation maintenance COMPLETE (PR #9, squash 63a7469f: wave-1 lockfile reconcile + eslint layerRestrictions ESLint-10 fix with regression tests)
- W005 COMPLETE (PR #12, squash 27a1ab8a; 245 tests: 122 simulation-protocol + 123 evaluation-protocol)
- W006 COMPLETE (PR #13, squash b42a0bcc; reviewed head 5cc67390; 163 new tests, 68 negative; 101 files in owned trees)
- Foundation maintenance COMPLETE (PR #14, squash 46f00917: wave-2 lockfile reconcile, +152/-0, 5 new importers)
- W007 COMPLETE (PR #16, squash 000fcdd7; reviewed head 01b59838; 270 new tests: 135 capability-registry + 135 adapter-sdk; 95 files, 100% in owned trees; 7/7 review gates + independent battery reproduction)
- Foundation maintenance COMPLETE (PR #17, squash 5a5a1e24: wave-3 lockfile reconcile, +71/-0, 2 new importers)
- W008 COMPLETE (PR #22, squash 24eb076c; reviewed head fd1ba567; CI run 69 success; 146 files in owned trees; 284 new tests reported)
- W009/W011 ACTIVE — wave 4, two workers remaining; W010 waits on W009; W012/W013 wait on W011
- W010 WAITING_ON_DEPENDENCIES (needs W009); all others WAITING_ON_DEPENDENCIES
- PR #21 merged (squash b2bebc38): ACR-001 approved architecture target and W036-W044 delivery program added
- Foundation maintenance COMPLETE (PR #24, squash 803a1989): post-W008 pnpm-lock.yaml reconcile
- Architect architecture PR #27 MERGED (squash 8bfd14a7): universal lifecycle + Solution Navigator + domain-pack contract + delivery Work Order reconciliation
- Architect architecture PR #29 MERGED (squash e09f5309): Capability Foundation Policy + upstream integration/fork governance

Verification baseline after W008 (6314365): battery 54/54 tasks --force, 0 cached (18 typecheck + 15 lint + 16 test + 3 build + governance + boundary), across 17 kernel packages + web app; governance selftest 6/6. pnpm@10.34.5 / Node 22 / TS 5.9.3 / eslint 10.11.0 + typescript-eslint 8.70.1 / vitest 5.0.1 / Next 15.5.26 / React 19.3.0 / zod 4.6.5 / turbo 2.11.3 — frozen catalog in pnpm-workspace.yaml; policy in scripts/DEPENDENCY-BASELINE.md; CI battery: governance boundary typecheck lint test build.

Material review lessons (W001):
- (wave-3 addition) Dispatch reliability under platform strain: W007 took 5 attempts — one 40-minute run died at final-report composition (frozen DOM + open empty server turn = dead turn; content commits only at stream end), then THREE capacity-era stillbirths (turns died within ~2 min at first command echo; correlated with staged-resume landings after WebSocket drops + GLM-5.3 hidden from the model menu). The golden path (model visible, insert 100%, direct send) landed cleanly on attempt 5. Doctrine: verify model-menu health before dispatch; treat any staged-resume landing as at-risk; discriminate dead vs slow via reload-first DOM progress over time (dispatch_worker check does NOT reload; stale renders fake freezes).
- (wave-3 addition) Worker self-reports may contain minor numeric inaccuracies under DOM truncation: W007's report cited a 44/51 file split (actual 40/55, total 95 correct) and the DOM render truncated the 40-char head SHA to 38 chars. Always reconcile report claims against git/API ground truth during review; never trust truncated IDs.
- (wave-3 addition) Non-binding architecture notes parked for future WOs: (1) should the capability registry enforce category stability across versions of one capability id; (2) canonical home for action execution-failure vocabulary when W022 lands. Recorded in PR #16.
- (wave-2 addition) The lockfile merge-seam recurs on EVERY wave that adds packages: work branches never commit lockfile changes, so main's frozen install breaks until the Tech Lead lands a serialized work/foundation-* reconcile (PR #9 for wave-1, PR #14 for wave-2). Budget for it after every package-adding merge.
- pnpm-lock.yaml is a derived root-manifest artifact and IS in scope for foundation Work Orders ("root manifests" grant in work-items.md): the frozen baseline requires the committed lockfile.
- Layer matrix authoritative: experience must not import app (apps consume experience, never the reverse); enforced by dual layers (scripts/boundary-check.mjs + packages/eslint-config/boundary.mjs).
- next build (15.5.x) rewrites apps/web/next-env.d.ts; handled via committed canonical pre-build file + typecheck sequenced after build.
- Known non-blocking: boundary source-scan is regex-based (stdlib-only), triple-reinforced; .gitignore left untouched (governance) so build-artifact churn stays untracked noise.

## Approved architecture change — ACR-001 + ACR-002 + ACR-003
Approved 2026-09-24.

Target additions:
- SolutionPackage/Version + DeliveryRecord
- Program of Work synchronized with the BOQ/solution schedule
- procurement, execution, actualization, variance and forecast
- outcome learning/calibration
- low-friction partial observations with confidence/provenance/freshness
- fine-grained access projections
- delivery supervision and alerts
- optional provider-neutral external event bridge, with Aurum Chat as a reference adapter only

ACR-001/ACR-002/ACR-003 are not effective for new implementation yet. The currently authorized W008/W009/W011 wave remains on E1.0/X1.0. After that wave is stabilized, the Architect/Tech Lead must record the lock transition and frontier update before dispatching W036. ACR-003 is binding capability-foundation policy at that same transition.

W036-W044 are defined and dependency-gated; none is currently authorized.

Current main head: e09f530926e4fa2c0e7de317a86d6d13013559f8.

Every merge must update this file before advancing.


Target clarification: the universal lifecycle is Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize -> Verify -> Forecast -> Close -> Learn. Domain packs and the Solution Navigator are projections over the shared semantic graph; they must not create competing lifecycle or ledger authorities. Canonical references: `spec/universal-solution-lifecycle.md`, `spec/domain-pack-contract.md`, `spec/solution-navigator-architecture.md`.

## Wave-4 completion (2026-09-25, Tech Lead)
- W009 (Tenancy/Identity/Authorization): PR #31 squash-merged -> b6df6644. 7-gate review ALL PASS (120 files owned-only; battery typecheck 21/21, lint 18/18, test 20/20, build 3/3 forced at --concurrency=1; determinism/neutrality clean; 156 tests; W004 parity via devDeps). Reconcile PR #33 -> 8353182.
- W011 (Experience Protocol): PR #32 squash-merged -> fd0d6af6. 7-gate review ALL PASS (104 files owned-only; 194 tests incl. authority/neutrality/tenant/graph/determinism/kernel-parity named negatives; runtime deps exactly agent-protocol + world-model; contracts/experience per W002-W004 convention: index.d.ts + parity.ts + manifest.json + 65 schemas). Reconcile PR #34 -> ee8615ab.
- W011 architecture questions recorded: (1) W002 standalone relation-id schema (W011 mirrors + parity-pins — advisory); (2) GRAPH_KIND_NODE_KINDS constrained mixing (constrained is correct — no change).
- Dispatch saga lesson (recorded in replay2 lesson 129): rate-limit/capacity popups are dismissed (Enter+resend / cancel+retry), never obeyed; "concurrent conversation limit" was cleared by deleting dead-turn chats; innerText flatness is NOT a dead-turn signal (transcript virtualizes during long sandbox ops — screenshots are the liveness truth).
- Frontier recalculated: W010/W012/W013/W023 all READY; wave 5 = W010 + W012 + W013 (W023 next; cap 3).
