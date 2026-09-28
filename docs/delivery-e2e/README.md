# W044 — Delivery-to-Learning End-to-End Fixture

The construction-realization **end-to-end proof layer** of the Epoch
program: one deterministic, in-process scenario that traverses the
COMPLETE universal lifecycle (Understand → Decide → Plan → Acquire →
Realize → Observe/Actualize → Verify → Forecast → Close → Learn) with
the BOQ as the synchronized domain projection, and asserts identity,
authorization and lineage ACROSS every surface it crosses.

- **Fixture test**: `tests/delivery-e2e/test/delivery-learning-fixture.test.ts`
  (vitest, 16 tests — one per Work Order clause)
- **Scenario definition + fixtures**: `examples/delivery-e2e/scenarios/*.ts`
  (importable, documented)
- **This catalog + evidence chain**: `docs/delivery-e2e/`

## The scenario (the inspectable evidence chain)

`runDeliveryLearningScenario()` composes REAL kernels (W026 pack
construction, W036 solution delivery, W037 procurement, W038 execution
tracking, W039 actualization + variance, W040 learning calibration,
W041 access projection, W042 external event bridge + mocked Aurum chat
adapter, W043 supervision + alerts, W009 authorization, W006 evidence,
W010 event log) through their public admission paths. The scenario
timeline (every instant caller-supplied — zero wall-clock):

| Instant | Lifecycle event | Surfaces exercised |
| --- | --- | --- |
| T0 | **Understand** — existing-conditions estimate (121 m³ surveyed pit) | W036 distinction ledger (estimate record) |
| T1 | Two alternatives authored (steel frame vs hybrid frame) | W036 solution versions |
| T2 | **Decide** — deterministic evaluation (29,670 EUR vs 32,470 EUR via the kernel decimal arithmetic); winner sealed | W036 solution-version chain admission |
| T3 | Baseline approved; **Plan** — program of work (baseline) built; delivery opened; W041 access policy sealed + admitted; mocked Aurum provider registered behind REAL W009 decisions | W036 baseline approval; W041 policy store; W042 provider registration |
| T4 | **Acquire** — acquisition request; field work starts | W036 acquisition request; W038 tracking store |
| T5 | **Realize** — supervisor InformationAcquisitionRequest issued (open, material, aging); OUTBOUND bridge information request delivered to the mocked provider (least-privilege projection citing the REAL W041 policy digest; the commercial note redacted) | W036 info request; W042 bridge dispatch |
| T6 | **Observe** — low-friction field observation (118.5 m³ pit volume); tracking state admitted | W038 field intake; W036 delivery record |
| T7 | Forecast r1 (122 m³ remaining) | W036 forecast distinction record |
| T8 | Forecast r2 (119 m³, **refines** r1 — append-only) | W036 forecast lineage |
| T9 | Supplier delivery received; INBOUND Aurum observation report → bridge intake proposal → sealed through the REAL W036 authority (never the bridge) → recorded in delivery; acquisition fulfilled; **supervision pass 1**: the foundations milestone is MISSED → five findings (critical-path drift + late activity + missed milestone + unresolved supervisor unknown + overdue verification gate) → five alerts raised (policy-driven severity) → five notifications dispatched to the supervisor role | W042 inbound intake; W037 supplier transitions + fulfillment; W043 supervision + alerts + notifications |
| T10 | **Actualize** — the W039 validation + actualization fold mints the actuals (118.5 m³ + 4 t); the supervisor's answer RETURNS through the bridge (correlated information-response); the info request flips to fulfilled with the answer's provider-payload digest as evidence; variance (baseline 120 vs actual 118.5 = 1.5 adverse minor) + attribution (the real W038 change record as cause, real W006 evidence) | W039 actualization/variance; W042 answer intake; W036 fulfilled info request |
| T11 | **supervision pass 2 (the automatic update)**: the finding set recomputes to ZERO (foundations complete, gate passed, request fulfilled); the milestone alert ESCALATES through the REAL W003 pipeline (proposal → Action Gateway authorized decision → dispatched outcome → escalated revision) + the escalation-tier notification; an OUTBOUND bridge alert reaches the mocked provider; all five alert chains RESOLVE (remediated) | W043 supervision/alerts/escalation; W042 outbound alert |
| T12 | **Verify** — formation gate passed with real evidence; the outcome record (delivered) carries the evidence digests; **Forecast** stage | W006 evidence; W036 outcome record |
| T13 | **Close** — the delivery record closes | W036 closeDeliveryRecord |
| T14 | **Learn** — comparison facts (forecast r2 119 vs actual 118.5 = 0.5 over-forecast; r1 122 vs 118.5 for the residual) + candidates → the governed learning store: 1 eligible row + 1 typed `excluded-unresolved` exclusion; a foreign-tenant candidate excluded on the pure path (`excluded-foreign-tenant`); model-revision proposal with MANDATORY lineage admitted; calibration metric fold; pack-scoped view | W040 learning calibration |
| T15 | Role-specific authorized views evaluated over REAL W009 decisions: client view (costs/evidence redacted) vs engineer view (superset, commercial visible); the client's delivery-record request DENIED fail-closed (audited `policy-binding-missing`); engineer export of the closed delivery released; 4 audits (3 released + 1 denied) | W041 access projection |

The lifecycle graph carries **11 stage records + 10 `precedes`
transitions** (understand → … → learn) on one delivery-record subject;
procurement and execution hang below the single `acquire`/`realize`
stage records as domain projections.

## The evidence chain (what the fixture leaves behind)

Four typed, per-stream event chains + one unified W010 log, all
content-addressed and replayable:

1. **`stream:delivery-warehouse-extension-v1`** (the W010 EventLog):
   24 events — 11× `delivery:stage-entered`, `delivery:baseline-approved`,
   `delivery:acquisition-requested`, `delivery:info-request-issued`,
   2× `delivery:observation-recorded`, 2× `delivery:forecast-recorded`,
   `delivery:acquisition-fulfilled`, 2× `delivery:observation-actualized`,
   `delivery:milestone-reached`, `delivery:outcome-recorded`,
   `delivery:learning-recorded`.
2. **The supervision stream**: 29 events — registration triple, both
   passes, 5× finding-produced, 5× alert-raised, 6×
   notification-dispatched, alert-escalated, 5× alert-resolved, 2×
   projection-updated.
3. **The learning stream**: 8 events — 2× record-intaken,
   dataset-assembled, revision-proposed, revision-admitted,
   metrics-folded, pack-view-projected, state-projected.
4. **The access stream**: 12 events — policy-registered, 2×
   record-admitted, 3× projection-released, projection-denied, 4×
   audit-recorded, state-projected.
5. **The bridge events** (runtime-recorded): provider-registered, 2×
   receipt-recorded, 2× request-dispatched, 2× event-received,
   intake-proposed.

Plus the actualization event chain (10 sealed events: intakes,
assessments, mints) and the delivery digest chain (6 links: open →
field observation → bridged observation → 2× actualization → close).

## The acceptance mapping (clause → test)

| Work Order clause (must prove / must demonstrate) | Test |
| --- | --- |
| semantic identity remains continuous | `semantic identity remains continuous: one solution id across every surface` |
| BOQ and ProgramOfWork stay synchronized (BOQ row ↔ activity ↔ spatial binding) | `BOQ row <-> program activity <-> spatial binding stay synchronized` |
| procurement/execution are projections of universal Acquire/Realize | `procurement and execution are projections of the universal Acquire/Realize concepts` |
| baseline, commitment, actual and forecast remain distinct | `baseline, commitment, actual and forecast remain distinct records` |
| incomplete information and confidence remain explicit | `incomplete information and confidence remain explicit` |
| the complete universal lifecycle (reconstruct → … → learning data) | `the lifecycle graph carries all eleven universal stages with precedes transitions` |
| optional Aurum/event-bridge path can supply observations/alerts | `the mocked Aurum bridge supplies the observation AND the returned answer (authority preserved)` |
| missed milestone → supervisor request → returned status → automatic update | `the missed milestone drives a supervisor request whose returned status updates supervision automatically` |
| alert propagation | `alerts propagate: raise -> notify -> escalate -> notify -> resolve (+ the outbound bridge alert)` |
| procurement actuals | `procurement actuals fold into the delivery actuals and the supplier delivery state` |
| predicted-vs-actual variance | `predicted-vs-actual variance: baseline vs actual AND forecast vs actual, with real evidence` |
| learning only consumes validated outcome lineage | `learning consumes ONLY validated outcome lineage: typed exclusions, lineage-bound revision` |
| role-specific authorized views (authorization projections enforced) | `role-specific authorized views are enforced (client vs engineer, with an audited denial)` |
| attributable, authorized, traceable (R12 at every boundary) | `a cross-tenant observation is DENIED at the delivery intake (R12)` |
| baseline immutability (evidence chain integrity) | `the baseline is IMMUTABLE and the closed delivery cannot close again` |
| the E2E fixture is reproducible and leaves an inspectable evidence chain | `the digest projection round-trips and the evidence chain replays from the W010 log` |

The determinism gate (`expectScenarioDeterministic` in
`tests/delivery-e2e/test/helpers.ts`) runs the ENTIRE scenario twice
in-process and requires byte-identical digest projections.

## How to run

`tests/delivery-e2e` is an owned W044 surface **outside the
pnpm-workspace globs** (the root manifests are frozen for this Work
Order), so it is not a pnpm importer and carries no `node_modules`. The
suite borrows the toolchain of an existing workspace package and
resolves imports via explicit aliases (`tests/delivery-e2e/
vitest.config.mts` + `tsconfig.json` paths — the same set
`tests/delivery-e2e/package.json` declares as devDependencies; the W031
`tests/e2e` precedent).

From the repository root (after `pnpm install`):

```bash
# the fixture (16 tests)
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/delivery-e2e

# typecheck (tests + examples)
pnpm --filter @epoch/pack-construction exec tsc --noEmit -p ../../tests/delivery-e2e/tsconfig.json

# lint
(cd tests/delivery-e2e && ../../packs/construction/node_modules/.bin/eslint .)
(cd examples/delivery-e2e && ../../packs/construction/node_modules/.bin/eslint .)
```

The repo's own gates (`pnpm check`, `pnpm exec turbo run typecheck
lint test build`) cover the workspace packages and are unaffected by
these surfaces (that is by design: the fixture adds proof without
touching any gate input).

## Runtime dependency policy

The fixture imports workspace packages as **devDependencies only**
(declared in `tests/delivery-e2e/package.json`; tests never ship
runtime deps): `@epoch/solution-delivery`, `@epoch/procurement`,
`@epoch/execution-tracking`, `@epoch/actualization`, `@epoch/variance`,
`@epoch/learning-calibration`, `@epoch/access-projection`,
`@epoch/external-event-bridge`, `@epoch/adapter-aurum-chat`,
`@epoch/supervision`, `@epoch/alerts`, `@epoch/pack-construction`,
`@epoch/action-policy`, `@epoch/action-protocol`,
`@epoch/agent-protocol`, `@epoch/authorization`, `@epoch/evidence`,
`@epoch/event-log`, `@epoch/tenancy`, plus the `vitest`/`typescript`
toolchain entries from the frozen catalog. Nothing outside the frozen
baseline; no new dependencies; no lockfile changes.

## Design notes (the W036-W043 kernel-discipline precedent)

- **Deterministic typed in-memory kernels**: every record is built
  through a kernel admission path (`sealSolutionVersion`,
  `buildProgramOfWork`, `evaluateSupervisionPass`, `sealComparisonFactInput`,
  `evaluateProjection`, …); the scenario never writes kernel state
  directly. The negative paths (`reviseSolutionBaseline`,
  `closeDeliveryRecord` on a closed delivery, the cross-tenant intake)
  assert the kernels' own typed rejections.
- **The bridge never writes observations**: the mocked Aurum
  observation report becomes a W036-shaped intake PROPOSAL; the W036
  authority seals it. Provider vocabulary never crosses the seam
  (asserted).
- **Authorization is REAL everywhere it is crossed**: W009 `evaluate` +
  `sealAuthorizationDecision` produce every access-projection decision
  and every bridge gate pair; the escalation runs the full W003
  proposal → gateway-decision pipeline.
- **Zero wall-clock, zero randomness, zero network**: every instant is
  a `T[…]` constant; every id is explicit; the Aurum provider runs its
  committed fixtures (delivery script: success).
- **Baseline vs live**: the baseline program, baseline distinction
  record and approved solution digest never change; the live schedule
  states (missed → reached), the delivery digest chain and the
  supervision projections move. The client's authorized view of the
  baseline program shows the milestone `planned` while the live
  programme projection shows `reached` — the distinction is visible
  through the authorized views themselves.
