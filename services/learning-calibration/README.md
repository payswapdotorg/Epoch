# @epoch/learning-calibration-runtime

Epoch Learning Calibration Runtime service (**Work Order W040**): the
thin typed HOST FACADE over the `@epoch/learning-calibration` kernel.

## What this host owns

- **Source-history registration** — sealed W039-grammar comparison
  facts + W036 Outcome records (read-only, idempotent by digest,
  `history-immutable` on conflicts);
- **Learning-record intake** — sealed outcome-learning candidates,
  direct or through the `LearningRecordSourcePort` adapter seam (ONE
  in-memory reference adapter; the core never names a vendor), with
  IDEMPOTENT replay (`duplicate-candidate` admission, state unchanged);
- **Deterministic dataset assembly** — the kernel fold over the
  admitted candidates (typed eligibility: ONLY validated
  actual/outcome records fold into rows; every exclusion a typed
  record), replay idempotence, and the `history-immutable` replay
  conflict (same identity, different content seals the PRIOR record);
- **Calibration metric folds** — per (model revision, applicability
  scope): bias / MAE / hit-rate over exact decimal arithmetic with
  per-domain-pack and per-realization-variant breakdowns;
- **Model-registry updates EXCLUSIVELY through typed proposals** —
  draft revision + W005-convention justification + MANDATORY dataset +
  changing-observation lineage (`model-revision-lineage-required`,
  `stale-reference-rejected`);
- **Pack learning surfaces as PURE PROJECTIONS** over the universal
  dataset (`parallel-history-store-rejected` — never pack-keyed
  stores);
- **The derived learning-state projection** and the `learning:*` event
  streams (W010-shaped, one stream per solution scope
  `stream:learning-<suffix>`, kernel-sealed).

## What this host is NOT

No persistence, no network, no real learning-record sources (adapters
of `LearningRecordSourcePort`), no ML runtime, no model training, no
clocks (every instant is caller-supplied), no randomness. The W009
authorization gate denies unauthorized operations BEFORE any kernel
admission; tenant isolation is typed `tenant-isolation-rejected` (R12).

## Reference flow

```ts
import { LearningCalibrationRuntime } from '@epoch/learning-calibration-runtime';

const runtime = new LearningCalibrationRuntime({ expectedTenantId: 'tenant:globex' });

// 1. Intake learning records (source history registers from the embeddings).
const intaken = runtime.intakeLearningRecord({
  tenantId: 'tenant:globex',
  authorization: { principalId: 'principal:delivery-lead', context: allowContext() },
  candidate: sealedCandidate,
  intakenAt: '2026-04-06T08:00:05.000Z',
});

// 2. Assemble the dataset (deterministic; replay idempotent).
const assembled = runtime.assembleDataset({
  tenantId: 'tenant:globex',
  authorization: { /* ... */ },
  solutionId: 'solution:tower-retrofit',
  bandThresholds: { minor: '5', material: '20', severe: '50' },
  assembledAt: '2026-04-06T08:00:06.000Z',
});

// 3. Revise the model through a typed proposal (lineage mandatory).
const admitted = runtime.admitModelRevision({ /* proposal with lineage */ });

// 4. Fold the calibration metrics.
const folded = runtime.foldMetrics({
  tenantId: 'tenant:globex',
  authorization: { /* ... */ },
  solutionId: 'solution:tower-retrofit',
  revisionId: admitted.value.revision.revisionId,
  toleranceBands: ['5', '10'],
  foldedAt: '2026-04-06T08:00:08.000Z',
});
```

The kernel (`packages/learning-calibration`) owns every admission
decision; this host only gates (W009 authorization, R12 tenant
isolation), calls the kernel, and emits the `learning:*` events.
