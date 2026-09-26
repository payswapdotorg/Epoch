# @epoch/solution-delivery — Solution Delivery kernel (W036)

Epoch **Solution Delivery** domain model — the universal delivery DOMAIN
MODEL of USL1.0 (binding): the semantic contracts and reference machinery
for taking an approved solution through acquisition, realization,
observation, actualization, verification, forecast, close and learn across
construction, software, mechanical, electrical, infrastructure,
manufacturing, facilities and field-service domains.

## What this package owns

- **SolutionPackage + immutable SolutionVersion baselines** (the W023
  version-chain convention): canonically ordered, content-addressed
  (SHA-256 over canonical JSON), hash-chained via `previousVersionDigest`;
  `admitSolutionVersion` (append semantics; typed `version-conflict` on
  mutation of a published version), `verifySolutionVersionChain`, and the
  distinct `BaselineApproval` authority act. In-place revision of an
  approved baseline is a typed `baseline-mutation-rejected` — changed
  content ships as a NEW version.
- **The nine semantic-distinction record types** (USL1.0): Prediction,
  Estimate, Baseline, Commitment, Observation, Actual, Forecast, Outcome,
  Learning Record — one immutable, digest-bearing record family
  (`DistinctionRecord`), each carrying the full uncertainty state
  (provenance + freshness + confidence). The `DistinctionLedger` admission
  rejects a record identity changing kind (`distinction-collapse-rejected`)
  and a forecast refining anything but an earlier forecast
  (`forecast-overwrite-rejected`).
- **The ProgramOfWork** (the authoritative schedule dimension): work
  packages and activities with planned quantity/cost/dates, mirrored
  predecessor/successor dependencies, resources, responsible actors,
  constraint references, approvals, verification gates, actual
  progress/dates, blockers, evidence, confidence and forecast finish;
  milestone records; deterministic quantity/cost/resource/milestone
  schedule folds (exact decimal arithmetic; input order never leaks).
  `buildProgramOfWork` validates the DAG: dependency CYCLES are typed
  `schedule-cycle-rejected` (with the cycle path); mirror inconsistencies
  are `schedule-integrity-rejected`; dangling references are
  `dangling-reference-rejected`.
- **The DeliveryRecord** (the delivery-facts authority): observation
  intake (Observation is EVIDENCE CAPTURE), acceptance transitions (the
  review state lives on the delivery, never on the observation record),
  and actualization — ACCEPTED observations only
  (`unaccepted-actualization-rejected`); the actual inherits the
  observation's measure and uncertainty and links to it, never restating
  it. Every state is sealed (content-addressed); `foldDeliveryActuals`
  folds the authoritative delivery state deterministically.
- **The universal lifecycle** (USL1.0): eleven stage records (projections,
  never a linear FSM) plus six typed transition relations —
  `precedes`/`branch`/`overlap`/`loop` between different stage records,
  `pause`/`resume` as self-relations with DERIVED status (the stage
  records never mutate). Domain-pack profiles bind display vocabulary and
  projection rules onto these contracts; authority claims and invented
  stages are typed `authority-violation-rejected` (DP1.0).
- **Acquisition (the universal Acquire contract)**: the closed
  seven-variant catalog — external procurement, internal allocation,
  subscription/license, cloud/service provisioning, fabrication request,
  specialist capability assignment, data/evidence acquisition — plus
  fulfillment records. Provider-neutral: external parties are opaque
  references.
- **Information-acquisition requests** (the decision-sufficiency rule):
  typed decision impact (stage, decision kind, materiality, rationale) —
  material unknowns spawn requests; immaterial unknowns stay preserved
  with uncertainty.
- **The provider-neutral external request/event seam**: outbound request
  envelopes (acquisition order, information request, status check,
  alert), inbound event envelopes (observation report, status update,
  acknowledgment), typed correlation, and the reference adapter step
  (`externalEventToObservation`) — the seam W042 later bridges.
- **The `delivery:*` event vocabulary** over the W010 event shapes: a
  structural mirror of `EventContent` (pinned by compile-time
  `src/kernel-parity.ts` and runtime parity tests) with typed payload
  data for all fifteen lifecycle event kinds.
- **Solution Navigator projection helpers** (SN1.0): synchronized
  projections (World View / Solution / Decision / ProgramOfWork /
  Schedule / Acquisition / Realization / Verification / Forecast /
  Outcomes / Learning) over the SAME identities, with
  identity-preserving navigation (`navigateFromWorldEntity` traverses
  world entity → solution line → work package → activity → observation →
  actual → verification → outcome without creating duplicate records).

## Runtime dependency policy (W036 Tech Lead pin)

`@epoch/agent-protocol` (ids, digests, canonical JSON, version
discriminators), `@epoch/tenancy` (the W009 tenant grammar), and `zod`
are the ONLY runtime dependencies. Compatibility with
`@epoch/world-model`, `@epoch/event-log`, `@epoch/constraint-language`,
`@epoch/verification`, and `@epoch/evidence` is pinned via devDependencies
+ compile-time parity (`src/kernel-parity.ts`) and runtime parity tests
(`test/parity.test.ts`) — never runtime deps. The delivery event mirror
digests identically to the REAL W010 `computeEventDigest` and is admitted
by the REAL `sealEvent`.

## Versioned contract surfaces

- In-package full surface: `packages/solution-delivery/schemas/`
  (the W006/W007/W009/W023 in-package convention) — 89 schema files +
  manifest, emitted by `renderSolutionDeliveryContractFiles()`.
- Public core-record surface: `contracts/solution-delivery/`
  (the W012 convention) — `index.d.ts` + `parity.ts` + `manifest.json` +
  `schemas/`, emitted by `renderSolutionDeliveryPublicContractFiles()`.
- Both are drift-pinned byte-for-byte by `test/contract-drift.test.ts`;
  regeneration only via
  `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/solution-delivery test contract-drift`.

## Documentation

See `docs/solution-delivery/` for the USL implementation map, the
ProgramOfWork scheduling model, the semantic-distinction invariant guide,
the acquisition/realization variant catalogs, the pack-integration guide
(DP1.0), and the Navigator projection guide (SN1.0).
