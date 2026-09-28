# The Counter Methodology (W034)

## Why counts, not wall-clock

Wall-clock measurements are flaky by construction: they depend on machine load, JIT state, GC pauses, cache temperature and virtualization noise — none of which is a property of the CODE under test. A performance gate built on time either flakes (false regressions) or is padded until it gates nothing (false confidence).

The Epoch performance discipline therefore counts **OPERATIONS** — deterministic, typed integers derived at the composition seam:

- **Reproducible by construction**: the same workload through the same composition yields the same counts, every time, on every machine (`budget-verdict-reproducible`).
- **Regression-sensitive where it matters**: composition-level regressions (re-admitting per record, re-folding after every append, projecting per row instead of per view) change COUNTS deterministically even when they are invisible under timing noise at small scale.
- **Auditable**: a budget verdict carries the exact measured and allowed counts — a failing gate prints the envelope it exceeded, not a millisecond delta.

What counts do NOT capture (the honest scope): internal kernel constants hidden behind a single API call (e.g. the byte-quadratic re-seal cost of append-only record growth inside `recordObservation`). Those are the kernels' own documented behavior — surfaced here through the complexity model declarations and the input-size envelopes, not through seam counts.

## The operation-class vocabulary (closed, versioned)

| Class | Unit | Semantics |
|---|---|---|
| `kernel-admission` | +1 per call | A state-extending kernel API invocation: `admitSolutionVersion`, `buildProgramOfWork`, `openDeliveryRecord`, `recordObservation`, `admitDistinctionRecord`, `intakeObservation`, `applyActualization`, `admitVarianceRecord` |
| `kernel-fold` | +N per call | One fold invocation, N = the records it iterates (its documented input count): `foldQuantitySchedule` (activities), `foldCostSchedule` (activities), `foldResourceSchedule` (resource assignments), `foldMilestoneSchedule` (milestones), `foldRealizationVariants` (work packages), `foldDistinctionRecords` (ledger records), `foldDeliveryActuals` (observations + actuals), `foldVarianceRecords` / `foldVarianceSummary` (ledger records) |
| `projection-compute` | +N per call | One projection invocation, N = the view rows it emits (one computed output record): `projectBoq` (line items), `projectConstructionProgramme` (activities + milestones), `projectRoadmap` (releases), `projectBacklog` (issues + epics), `projectDeploymentPlan` (rollout steps), `projectNavigator` (the synchronized view rows) |
| `digest-compute` | +N per call | One digest-bearing invocation, N = sealed records produced or verified (output-observable): `sealSolutionVersion`, `verifySolutionVersionChain`, `approveSolutionBaseline`, `sealDistinctionRecord`, `verifySealedDeliveryRecord`, `currentAssessments` (sealed assessments emitted), `computeVariance` (sealed record), `verifySealedWorkload` |
| `harness-scenario` | +1 per invocation | One W032 driver-seam invocation (`begin`, `runStep`, `stateDigest`) — the only seam the harness runner exposes; the runner's built-in replay-determinism double-run DOUBLES these by design |

## The counting hub (the instrument)

`createCounterHub()` (in `@epoch/performance`) is a closure over an integer tally per class. The subject flows (`tests/performance/src/flows.ts`) wrap the REAL kernel calls — tally, then invoke, then observe the output for row/record units:

```
const sealed = need(sealSolutionVersion(content), 'seal');  hub.tally('digest-compute', 1);
const boq    = need(projectBoq(inputs), 'project');          hub.tally('projection-compute', boq.lineItems.length);
foldQuantitySchedule(program);                                hub.tally('kernel-fold', activityCount);
```

Every unit is observable at the seam — public API inputs (the fold's input record counts) and outputs (the projection's emitted rows, the sealed records produced). The wrappers are test-only compositions over the kernels' public APIs; no kernel was edited to add a counter.

The snapshot is frozen typed data (`OperationCounts`), sealed into a **measured-counts record** bound to the exact workload revision + subject, with a content digest and measurement provenance (`observed`, the composition seam). Identical tally sequences derive identical count digests.

## The harness composition (a measured subject)

The W032 test harness is itself a measurement subject (the "harness scenarios" operation class). The counting driver (`tests/performance/src/harness-driver.ts`) implements the `ScenarioDriver` seam over a synthetic hash-chained ledger — the W032 fixture-driver pattern — and tallies every seam invocation into the SHARED hub, so harness counts land in the same measured-counts record as the kernel counts. The driver's state digest is O(1) (hash-chained head) so the driver contributes no hidden super-linear work.

## Where the evidence lives

- Hub determinism + snapshot discipline: `packages/performance/test/counts.test.ts`.
- The counting conventions produce the documented coefficients: `tests/performance/test/scale-budgets.test.ts` ("the measured counts match the documented composition coefficients").
- Byte-identical counts across independent reruns: `tests/performance/test/determinism.test.ts`.
