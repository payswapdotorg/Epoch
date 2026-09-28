# The Workload Grammar (W034)

The deterministic workload generators (`packages/performance/src/workloads.ts`) generalize the W031/W032 fixture pattern to scale: **a workload is a pure function of its seed** — `(identity, tenant, shape, salt) → a typed synthetic workload` — and the test trees materialize the synthetic payload into real kernel inputs through the kernels' own public admission paths (`tests/performance/src/materialize.ts`).

## The seed

```
WorkloadSeed = {
  workloadId: 'workload:<slug>',
  tenantId:   'tenant:<slug>',
  shape:      { planLines: N ≥ 1, observations: M ≥ 1, packProjections: P ≥ 1, scenarioSteps: S ≥ 1 },
  salt:       string (default '')
}
```

**Same seed → same workload digest, byte-identical.** Different salt → different digest, same shape. Zero dimensions are rejected (a degenerate workload is a fixture, not a workload — the W031/W032 fixtures cover that case).

## The payload grammar (index arithmetic, never the clock)

| Payload | Derivation |
|---|---|
| plan line i | `line:perf-<i:6>`, title `Synthetic plan line <i:6>`, quantity `100 + (7i mod 977)` cycling units `m3/tonne/deliverable`, unit cost `(2550 + (i mod 75)·100)/100` EUR, world entity `element-perf-<i mod 3>`, acquisition variant cycling `external-procurement/cloud-service-provisioning` |
| observation i | `observation:perf-<i:6>`, capture key `perf-capture-<i:6>`, measure `50 + (3i mod 419)` m3, instant `2026-07-01T08:00Z + i hours` (the fixed series), observer `principal:field-engineer`, subject activity index `i mod N` |
| pack projection i | surface cycling the closed vocabulary `boq → construction-programme → roadmap → backlog → deployment-plan` |
| scenario step i | `step:perf-<i:6>`, op cycling `ledger.append → ledger.head`, input `{ recordIndex: i, value: (13i+7) mod 97 }` |

Every value is a deterministic function of its index. The record carries a W006-convention provenance state (`derived`, source `@epoch/performance/generateWorkload`) and a `sizes` projection over the closed input-unit vocabulary (`planLines, observations, packProjections, scenarioSteps`) — the input-size source the budgets read.

## The materialization (synthetic → real kernel inputs)

`tests/performance/src/materialize.ts` maps a workload onto the W036/W039 content shapes through the kernels' own admission paths:

- **solution** — N plan lines → solution lines (sorted ids, exact decimals); 3 world entities.
- **program** — N lines → 8-activity work packages (dependency chain within each package, mirrored predecessors/successors per the W036 schedule-integrity rule), one resource per activity, one milestone per 16 lines; realization variants alternate so BOTH domain packs project over the SAME program.
- **delivery + observations** — the W036 delivery record; M observations → W036 observation distinction records (one per plan-line activity; quantity measures; observed provenance, fresh, measured confidence).
- **variance inputs** — M observations → W039 quantity-variance computations (baseline = actual + 3, sorted thresholds).
- **harness scenario** — S steps → a W032 `ScenarioDefinition` (actors, one fixture, call steps over the counting driver's ops, replay-determinism invariant).

## The per-subject grammar (what the budgets apply to)

Each subject scales ONE dimension along its doubling ladder; the others are pinned at declared constants. The grammar is DATA in the catalog (`SUBJECT_GRAMMARS`):

| Subject | Scales along | Ladder | Pinned dimensions |
|---|---|---|---|
| solution-admission | planLines | 32→512 | observations 8, projections 5, steps 16 |
| program-fold | planLines | 32→512 | observations 8, projections 5, steps 16 |
| pack-projection | packProjections | 5→80 | planLines 64, observations 8, steps 16 |
| observation-stack | observations | 8→128 | planLines 256 (≥ M so every observation addresses a distinct activity), projections 5, steps 16 |
| variance-stack | observations | 8→128 | planLines 64, projections 5, steps 16 |
| harness-scenario | scenarioSteps | 32→512 | planLines 32, observations 8, projections 5 |
| delivery-stack-composition | planLines | 32→512 | observations = ceil(N/8), projections 5 (one full surface cycle), steps 16 |
| distinction-refold | observations | 8→128 | planLines 256, projections 5, steps 16 |

Ladder rung labels are `small, medium, large, x-large, xx-large` — **sizes are DATA** (`tests/performance/src/budget-catalog.ts`). Every ladder is a doubling ladder (each rung doubles the previous) because the complexity ratio analysis is defined on doubling.

## Tenant discipline

Workload records are tenant-scoped (R12): the workload ledger (`openWorkloadLedger` / `admitWorkload`) admits same-tenant workloads only (`cross-tenant-denied`), is idempotent for identical records, and rejects identity/content divergence (`version-conflict`). Evidence: `packages/performance/test/workloads.test.ts` and `tests/performance/test/negative.test.ts`.
