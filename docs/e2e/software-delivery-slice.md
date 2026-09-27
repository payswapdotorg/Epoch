# software-delivery-slice

The software path, end-to-end. Scenario definition:
`examples/e2e/scenarios/software-delivery.ts` — test:
`tests/e2e/test/software-delivery-slice.test.ts` (7 tests).

## The path

```
W027 softwarePackProfile ──admit──▶ W036 admitPackProfile gate
W036 sealSolutionVersion ──▶ approveSolutionBaseline ──▶ buildProgramOfWork
W027 projectRoadmap (releases)        W027 projectBacklog (epics + issues)

W038 buildProgramIndex ──▶ openExecutionTrackingStore
   ──▶ intakeFieldObservation (platform engineer's staging-deploy capture)
   ──▶ admitTrackingState (not-started → in-progress)
   ──▶ sealed execution events ('execution:tracking-recorded',
        'execution:observation-recorded' — the causally chained
        realization stream)

W036 openDeliveryRecord ──▶ recordObservation (the authority path)
W039 intakeObservation ──▶ currentAssessments ──▶ applyActualization
   ──▶ actuals (the actual inherits the observation identity)

W027 projectBacklog over the post-actualization delivery (the issue
        rows link the observation + actual ids)

W039 rollForecast r1 (refines null) ──▶ admitForecastRevision
   ──▶ rollForecast r2 (refines r1's EXACT digest) ──▶ admitForecastRevision
        (the append-only forecast ledger)

W010 EventLog stream 'stream:delivery-checkout-v1' (7 lifecycle events)
```

## Invariants (assertion → named test)

| Invariant | Test |
| --- | --- |
| Roadmap milestone ids ARE canonical ProgramOfWork ids — `releaseId === milestoneId` (never minted), the release set equals the program's milestone set, and the universal status terms map (`reached` → `Shipped`) | `roadmap milestone ids ARE canonical ProgramOfWork ids` |
| Backlog identity is canonical — epics ≡ `workPackageId`, issues ≡ `activityId`, and the issue rows link the observation + actual by id | `backlog identity is canonical…` |
| Execution events chain + verify (sequence, causal parent, per-record digests) | `execution events chain + verify` |
| The actualization fold drives the W036 authority path (`derivedFromObservationId` identity carry; every actual verifies) | `the actualization fold drives the W036 authority path` |
| Forecast revisions are APPEND-ONLY — r2 refines r1's exact digest, the ledger holds both revisions with r1's digest intact, and an out-of-lineage refinement is the typed `forecast-overwrite-rejected` | `forecast revisions are APPEND-ONLY…` |
| Cross-tenant observation denied at the delivery intake (typed `cross-tenant-denied`) | `a cross-tenant observation is DENIED…` |
| Determinism + round-trip | the shared gates |

## The forecast math (exact decimals)

Planned `24 deliverable`, actuals-to-date `18`:

- **r1** (performance factor `1`): remaining `6`, at-completion `24`.
- **r2** (performance factor `1.5`, refines r1): remaining `6`,
  at-completion `18 + 6 × 1.5 = 27`.

## How to run

```bash
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e \
  test/software-delivery-slice.test.ts
```
