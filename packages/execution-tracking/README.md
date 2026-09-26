# @epoch/execution-tracking

Epoch Execution Tracking kernel (**Work Order W038**): the universal
REALIZATION-TRACKING layer and low-friction field-observation ingestion
over the W036 solution-delivery kernel. Construction execution is ONE
projection; build/deployment/fabrication/installation/commissioning
vocabulary maps onto the same spine (`DOMAIN_TRACKING_STATE_BINDINGS`).

## What it owns

- **Work-package/activity state tracking** — typed, sealed, append-only
  `TrackingStateRecord` chains referencing ProgramOfWork items by OPAQUE
  ID; transitions (not-started/in-progress/completed/blocked + the
  domain-mappable equivalents) are recorded events with provenance. The
  schedule authority STAYS in ProgramOfWork: schedule fields on a
  tracking record are a typed `authority-violation-rejected`.
- **Progress actualization** — progress observations
  (percent-complete, quantity progress, milestone hits) as W036
  Observation-distinction records. Actualization flows ONLY through the
  W036 DeliveryRecord acceptance/actualization path
  (`applyReconciliationProposal`); writing Actual records directly is
  impossible — the typed `actualization-bypass-rejected`.
- **Resource observations** — labor/equipment/material/resource usage
  records: content-addressed, quantity + unit + time + provenance + the
  mandatory uncertainty state, linked to work-package references.
- **Field evidence references** — typed references to W006 evidence
  records by digest (photos, sensor readings, documents) with capture
  context; NEVER embedded payloads.
- **Changes/delays/rework/defects/blockers** — typed record families
  with severity + impact references (opaque ProgramOfWork ids) +
  append-only resolutions; rework references the original work records;
  blockers carry dependency semantics.
- **Confidence/provenance/freshness on EVERY observation** — the
  mandatory uncertainty state (`uncertainty-missing-rejected`).
- **Replay/idempotent observation handling** — same observation payload
  + idempotency key → the same sealed record (the typed
  `duplicate-observation` admission returning the prior digest).
- **Explicit Observation ≠ Actual separation** — reconciliation is a
  typed, recorded proposal the W036 DeliveryRecord authority
  accepts/actualizes; partial observations record without destructive
  overwrites.
- **The low-friction single-call intake**
  (`intakeFieldObservation`) — infers the work-package linkage;
  ambiguous linkage is `ambiguous-linkage-rejected`, never a guess.
- **The `execution:*` event vocabulary** over the W010 shapes (one
  stream per work package `stream:execution-<suffix>`) and the
  deterministic execution-state projection.

NO persistence, NO UI, NO provider vocabulary — external field systems
(mobile capture, IoT, scanners) stay behind the service-layer
`FieldCapturePort` seam (`@epoch/execution-tracking-runtime`).

## Runtime dependencies (frozen, W038 pin)

`@epoch/solution-delivery`, `@epoch/agent-protocol`,
`@epoch/tenancy`, `zod` — nothing else. Parity with `@epoch/event-log`
(W010), `@epoch/evidence` (W006), `@epoch/verification` (W006) and
`@epoch/capability-registry` (W007) is pinned through devDependencies +
compile-time parity (`src/kernel-parity.ts`) + runtime parity tests
(`test/parity.test.ts`), never runtime deps.

## Contract surface

The full schema surface is committed under `schemas/`; the public
core-record projection lives at `contracts/execution/`. Both are emitted
by `renderExecutionTrackingContractFiles()` /
`renderExecutionTrackingPublicContractFiles()` and drift-pinned
byte-for-byte by `test/contract-drift.test.ts`. Regeneration:
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/execution-tracking test contract-drift`.
