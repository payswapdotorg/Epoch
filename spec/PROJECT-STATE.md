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

## Wave-5 partial completion (2026-09-25, Tech Lead)
- W010 (Event/Replay/Collaboration): PR #38 squash-merged -> ae28d1cb. 7-gate ALL PASS (128 files owned-only; battery 25/25+22/22+24/24+3/3 forced; determinism 0; runtime deps exactly per pin — replay composes sibling event-log, intra-WO composition accepted; sequence-integrity + cross-tenant negatives).
- W013 (Renderer Runtime): PR #39 squash-merged -> 9b3ae994. 7-gate ALL PASS (121 files owned-only; battery 24/24+21/21+23/23+3/3 forced; engine-neutral 0 non-comment refs; runtime deps exactly agent-protocol+experience-protocol+zod).
- Reconcile PR #40 -> 067c50e0 (5 importers, +176 lines).
- W012 (Experience Compiler): dispatch pending — platform enforces max 2 concurrent generations this window (12 phantom creates logged; W013 landed the instant W012a died at 07:01, confirming slot handoff). Dispatched the moment a slot frees.
- Frontier: W020 + W028 READY (wave 6 candidates); W014/W015/W016 need W012.

## Wave-6 partial completion II — W012 merged (2026-09-25, Tech Lead)
- W012 (Experience Compiler): PR #47 squash-merged -> 73521a8. 7-gate review ALL PASS (98 files owned-only: packages/experience-compiler 32 + contracts/experience-compiler 66; token audit 0; battery check PASS + typecheck 28/28 + lint 25/25 + test 27/27 + build 3/3 FORCED at --concurrency=1 — reproduced independently at /home/z/epoch-review; W012 adds 137 tests/9 files incl. authority/determinism/tenant/device-budget named negatives; runtime deps exactly agent-protocol + experience-protocol per the W012 pin; CI 2/2 green). Reconcile PR #48 -> b7d7d5b (+37 lines, 1 importer).
- DEVIATION (W028-precedent class, 2nd occurrence): the worker's in-chat literal completion report never rendered — its turn stalled at 14:36Z immediately after PR creation (platform capacity peak; chat updated_at frozen; DOM static at plan checklist). Merged on PR-body evidence (complete report format, verification block matching the Tech Lead's independent reproduction exactly). Per lesson: the pushed branch is the delivery truth, the gate is the merge authority.
- Dispatch saga (wave-6 recovery): W020/W023 generation-held chats REAPED platform-side during the 12:44-14:30Z capacity peak (lesson-142 reap windows). W020 re-dispatch grinding via paced patient loop (6 phantoms so far: 8657ee5f, 1c743130, 799791f8, +3 under w020j; 15-min lesson-142 pacing, success = landing + generation). W023 serialized behind W020. Both prompts unchanged (w020e.md @ 17620e8, w023a.md @ 3f4aaff).
- Frontier recalculated: W023 + W014 + W015 + W016 ELIGIBLE (W014 deps W009+W011+W012 all complete; W015 deps W010+W011+W012; W016 deps W012+W013); W020 inFlight. Wave-7 = W020 (completing) + W023 + one of W014/W015/W016 (disjointness check at dispatch).
- dependency-state.completed aligned with program-state.completed (was lagging: W010/W013/W028 missing) — 14/44.

## Wave-7 partial — W020 merged (2026-09-25, Tech Lead)
- W020 (Agent Runtime/Orchestration): PR #49 squash-merged -> 9f1bac9e. 7-gate review ALL PASS (82 files owned-only: packages/agent-orchestration + services/agent-runtime (all new, +10280 lines); token audit 0; battery check PASS + full turbo typecheck/lint/test/build 81/81 tasks FORCED at --concurrency=1 reproduced independently at /home/z/epoch-review; W020 adds 154 tests/21 files; CI 6/6 green; PR-body verification block matches the independent reproduction exactly). Reconcile PR #50 -> bb8b814 (+107 lines, 2 importers: packages/agent-orchestration + services/agent-runtime).
- DEVIATION (3rd occurrence, W028/W012 precedent class): the worker's in-chat completion report never rendered in the client tab (the "Thinking..." view froze — client stream-view lag; the server-side worker continued to completion: branch pushed, PR #49 opened with complete evidence body). Merged on PR-body evidence; pushed branch = delivery truth.
- PLATFORM RECOVERY (operator-directed): the multi-day generation wedge was IP-level (generation endpoint returning HTML error pages -> client SyntaxError). Solved by connecting the TurboVPN browser extension (boot lesson 50 recipe): Chrome restarted with --load-extension (auto-load armed in launch_stack.py), good exit 169.150.210.53; sends land first-try, generation completes, chat pages render. The §16 hourly-probe freeze is retired — probes generate instantly through the VPN.
- Dispatch saga (W020 third loss recorded): the 16:58Z landing (chat 654574d5, w020j10) was REAPED before generation (~87 min, the packet sat generation-held through the raw-IP wedge). Fresh w020k dispatched 18:25Z through the VPN — SENT-VERIFIED first-try, chat 3cad54d8, generation ran to PR #49 in ~79 min.
- W023 re-dispatched (w023e3, chat 697e3c0e, 19:29Z, base 3f4aaff) — generating. W014 dispatched (w014b1, chat ce479a38, 19:45Z, base 15ea614 — first wave-7 WO dispatched directly at the current-main base) — riding to generation. Frontier: W015 + W016 eligible (wave-8 candidates once a slot frees).
- dependency-state.completed aligned — 15/44 (W001-W013 + W020 + W028).

## Wave-7 partial II — W023 merged (2026-09-25, Tech Lead)
- W023 (Marketplace): PR #52 squash-merged -> b5c7c50f. 7-gate review ALL PASS (122 files owned-only: packages/marketplace + services/marketplace + apps/web/src/features/marketplace, +15071 lines; token audit 0; battery install/check PASS + typecheck 31/31 + lint 28/28 + test 30/30 + build 3/3 FORCED at --concurrency=1 reproduced independently at /home/z/epoch-review; W023 adds 235 tests/23 files — 189 kernel + 46 host — incl. payment-authority, cross-tenant, dangling-capability-reference, published-version-mutation, vendor-fields, invalid-pricing, immediate-revocation, idempotency named negatives; CI green; PR-body verification block matches the independent reproduction exactly). Reconcile PR #53 -> 51d2b57 (+86 lines, 2 importers).
- TL RULINGS on W023 architecture questions: (1) kernel→experience devDep-parity pin deviation ACCEPTED — the binding layer model (boundary-check LAYER_RULES: kernel → {kernel, contracts, tooling}) forbids kernel→experience imports including devDependencies; the worker pinned the digest discipline against the evidence/event-log kernel mirrors instead (correct; the packet's suggestion was wrong for a kernel package). No ACR required. (2) Web feature module structural consumption CONFIRMED — apps/web/package.json is W014-frozen; the marketplace feature module consumes the kernel surface via documented structural mirrors; wiring/seam-pinning belongs to W014/W025 integration.
- DEVIATION (4th occurrence, W028/W012/W020 precedent class): the in-chat report never rendered in the frozen client tab (DOM static mid-battery from 20:26Z; byte-flow 0) while the server-side worker completed the full delivery (branch 5ea5e07b pushed, PR #52 opened with complete evidence body, CI green). Merged on PR-body evidence; pushed branch = delivery truth. The frozen-client pattern is now the NORM for long sandbox batteries, not an exception.
- Dispatch state: W023 slot-landed 19:29Z (w023e3, third paced-loop attempt — the slot-snipe pattern); W015 landed+generating 20:27Z (w015b2, chat 248fd7d1) after one reap (w015b1, 60s window); W014 landed+generating 20:34Z (w014c1, chat f16f9c3d) via the w014c chain loop after one reap (w014b1 — the packet sat queued behind capacity then reaped). Peak-hour concurrency observed at 3 generation slots once the VPN egress is clean.
- Platform hardening: freeze_probe_watch RETIRED (its hourly probe sends stole generation slots; probe "DOWN" verdicts were false-negatives of the fixed wedge). Resident wave watch (epoch_wave_resident.py, 120s cycles: DOM + report markers + byte-flow + PR watch + reap detection) + serialized dispatch chains now run continuously.
- Frontier recalculated: W021 + W022 + W024 + W036 ELIGIBLE (W021 deps W005+W007+W020; W022 deps W003+W004+W006+W009+W020; W024 deps W009+W023 — all complete with W023's merge; W036 deps W002+W003+W004+W006+W009+W010+W011). In flight: W014 + W015 + W016 (dispatching next at base 51d2b57). dependency-state.completed aligned — 16/44 (W001-W013 + W020 + W023 + W028).

## Wave-7 partial III — W014 merged (2026-09-25, Tech Lead)
- W014 (Web App Shell): PR #54 squash-merged -> aba9b7ab. 7-gate review ALL PASS (52 files, +5261/-7 — the -7 is the W001 placeholder replacement; scope: 49 files under the three owned trees + 3 packet-authorized app-manifest wiring files (package.json test script + devDep parity set, tsconfig world-contracts path mapping per the W012 precedent, vitest.config.mts) — nested manifests belong to the owning WO, root baseline guard untouched; token audit 0; battery typecheck 30/30 + lint 27/27 + test + build ALL FORCED at --concurrency=1 reproduced independently; CI green; PR-body evidence complete). Reconcile PR #55 -> fa82d749 (+18 lines, app-manifest devDeps).
- TL RULINGS on W014 architecture questions (both advisory): (1) the 3 manifest wiring files ACCEPTED — the packet mandated vitest tests; the convention "nested package manifests belong to the owning Work Order" is now recorded for future app-layer WOs. (2) tenancy via structural + devDep parity (NOT runtime) CONFIRMED — the packet's conditional was resolved correctly; the shell stays runtime-dep-minimal (next/react/react-dom only).
- W015 require-changes cycle: PR #56 (81 files, +16649, head 4d6f2f1f) gates 1-4 PASS locally, but the pull_request-event CI on the merge context FAILS — a cross-wave integration seam: W014's newly-merged apps/web `test` task discovers W015's feature test files and runs them WITHOUT vitest globals (ReferenceError: describe is not defined in guards.test.ts + view-models.test.ts). REQUIRED FIX dispatched to a fresh session (w015x, chat 5a4fd5ea, fix packet: runner-independent explicit vitest imports, same-branch push, both CI contexts green) after the composer follow-up path was found network-dropped through the VPN exit (three null commits server-side — lesson-51/127 pattern: fresh dispatch beats follow-up sends into dead/null-turn sessions).
- Platform notes: peak-hour generation slots fluctuate 1-3; W016's two landings were reaped in the window (loop paused for serialization; re-arms after the W015-fix session generates). Wedged-tab navigate crash (lesson 143 pattern) fixed operationally by fresh-tab pinning.
- Frontier unchanged: W021 + W022 + W024 + W036 eligible; W015 (fix pending) + W016 (re-dispatch pending) in flight. 17/44 (W001-W014 + W020 + W023 + W028).

## Wave-8 — W015 merged after require-changes cycle (2026-09-25, Tech Lead)
- W015 (AI Collaboration UX): PR #56 squash-merged -> 0fa2f33e (original head 4d6f2f1f + fix commit 7e54200b). REQUIRE-CHANGES cycle executed end-to-end: the pull_request-event CI exposed a cross-wave integration seam (W014's newly-merged apps/web test task ran W015's feature tests without vitest globals — describe is not defined); the composer follow-up path was network-dropped through the VPN exit (three null server commits), so the fix was delivered via a FRESH self-contained fix session (w015x, chat 5a4fd5ea — lesson 127 applied); the fix pass made the feature tests runner-independent per the W023 convention (8-file incremental diff, all owned). 7/7 gates PASS on the fix head (scope 77/77; battery serialized green; BOTH CI contexts green on 7e54200b). Reconcile PR #57 -> 84bb3165 (+46 lines, ai-experience importer).
- W015 delivers: typed collaboration-session descriptors with human/agent peer roles, presence/focus over the W010 vocabulary (devDep parity), 16-member versioned interaction-intent vocabulary, takeover/release with provenance (denials are history), content-addressed Engineering Moment records (7 binding components), ai:* collaboration event adapters round-tripping the real EventLog, deterministic projection fold, and the agents web feature module. 259 tests incl. the packet's named negatives.
- Frontier: W016 (Interactive World UX) + W036 (Solution Delivery Core) GENERATING (chats e9456210 / 92173ced). W016's first two landings reaped in the peak window (paced loop absorbed them; third landing generated). W036's first landing reaped; second generated. Eligible next: W021 + W022 + W024. 18/44 (W001-W015 + W020 + W023 + W028).
- Operational doctrine hardened this wave: (1) packets now REQUIRE both CI contexts green (push + pull_request merge) — the W015 seam lesson is baked into w036a.md and all future packets; (2) the composer message path through the current VPN exit drops existing-chat POSTs (null commits) — fresh-create is the reliable follow-up channel; (3) patient_dispatch tabs[0] reuse hits wedged post-reap renderers (lesson 143) — fresh-tab pinning or loop-based dispatch (which pins per-attempt tabs) is the reliable create path.
