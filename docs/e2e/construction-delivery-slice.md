# construction-delivery-slice

The construction path, end-to-end. Scenario definition:
`examples/e2e/scenarios/construction-delivery.ts` — test:
`tests/e2e/test/construction-delivery-slice.test.ts` (10 tests).

## The path

```
W026 constructionPackProfile ──admit──▶ W036 admitPackProfile gate
W036 sealSolutionVersion ──▶ admitSolutionVersion ──▶ approveSolutionBaseline
W036 buildProgramOfWork ──▶ verifySealedProgramOfWork
W026 projectBoq (BOQ view)          W026 projectConstructionProgramme
W026 foldDeliveryLinks (line → package → activity → observation → actual)

W036 admitAcquisitionRequest ──▶ W037 sealAcquisitionPackage ──▶ admitQuote
   ──▶ sealQuoteSelection ──▶ sealProcurementCommitment
   ──▶ sealPurchaseOrder + admitPurchaseOrder
   ──▶ supplier delivery log: ordered → confirmed → shipped → received
        (the received transition's receipt references the W036
         observation by exact recordId + contentDigest)

W038 buildProgramIndex ──▶ openExecutionTrackingStore
   ──▶ intakeFieldObservation (the low-friction field capture; the intake
        infers the work-package linkage) ──▶ admitIssue (the change record)
   ──▶ admitTrackingState

W036 openDeliveryRecord ──▶ recordObservation (field + receipt; the
        AUTHORITY PATH) ──▶ W039 openActualizationStore
   ──▶ intakeObservation ×2 ──▶ currentAssessments (exact mode)
   ──▶ applyActualization ×2 (drives the REAL W036
        recordObservation → acceptObservation → actualizeObservation
        internally) ──▶ sealed actualization events (the digest chain)

W036 sealDistinctionRecord (baseline record, payload pins the solution
        version digest) ──▶ W006 EvidenceStore (real measurement evidence)
   ──▶ W039 computeVariance (baselineRef/actualRef pin the EXACT digests)
   ──▶ admitVarianceRecord ──▶ sealAttributionRecord (cause = the W038
        change record, evidence = the W006 digests) ──▶ admitAttributionRecord

supervision folds: foldDeliveryActuals, projectActualizationState,
   foldVarianceSummary, foldDeliveryLinks, projectExecutionState,
   projectConstructionProgramme

W010 EventLog stream 'stream:delivery-warehouse-v1' (9 lifecycle events,
   consumed by the recovery slice)
```

## Invariants (assertion → named test)

| Invariant | Test |
| --- | --- |
| BOQ line ids ≡ solution plan-line ids (identity-mapped projection; the view's content digest verifies) | `the BOQ line ids EQUAL the solution plan-line ids` |
| One identity spine line → work package → observation → actual (the delivery-link index carries only canonical ids) | `the delivery links carry ONE identity spine` |
| Observation intake through the W036 authority path; the actual inherits the observation identity (`derivedFromObservationId`); every record verifies | `the observation intake flows through the W036 authority path…` |
| The actualization digest chain verifies (sequence, causal parents, per-record digests; the delivery head digest is the chain's end) | `the actualization digest chain verifies` |
| Variance attribution references REAL evidence by exact digest (baseline record, actual record, W038 change record, W006 evidence store membership) | `the variance attribution references REAL evidence by exact digest` |
| The supplier fold agrees with the receipt observation (W037 → W036 identity) | `the supplier delivery fold agrees…` |
| Supervision folds agree across W036/W038/W039 (actuals totals, validation groups, variance summary, execution state, programme milestone) | `supervision-visible state folds agree…` |
| Cross-tenant observation denied at the delivery intake (typed `cross-tenant-denied`) | `a cross-tenant observation is DENIED…` |
| The baseline is immutable (the dedicated negative-path export `reviseSolutionBaseline` → `baseline-mutation-rejected`) | `the baseline is IMMUTABLE` |
| Determinism + round-trip | the shared gates (`expectScenarioDeterministic`, `expectRoundTrip`) |

## The scenario's identity vocabulary

`solution:warehouse-extension` (3 plan lines) ·
`program:warehouse-extension-v1` · `delivery:warehouse-extension-v1` ·
`work-package:substructure` / `work-package:superstructure` ·
`activity:excavation-bulk` · `observation:field-pit-progress-monday`
(the W038-derived field id) · `observation:steel-receipt` (the
procurement receipt) · `actual:field-pit-progress-monday` ·
`baseline:excavation-quantity` · `variance:excavation-quantity` ·
`attribution:excavation-geometry` · `change:pit-geometry-revision`
(the W038 issue) · `po:steel-supply-001` + the supplier-delivery
transitions.

## How to run

```bash
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e \
  test/construction-delivery-slice.test.ts
```
