# The Budget Catalog (W034)

The performance budgets of the reference compositions. **Budgets are DATA** (sealed, versioned, tenant-scoped records in `tests/performance/src/budget-catalog.ts`): swap a budget record, no code change. Each budget declares:

- a **subject** (the measured composition flow it governs);
- an **input unit** (the workload dimension the envelopes scale along);
- per **operation class**, an **envelope**: `allowedCount(size) = intercept + floor(slopeNumerator * size / slopeDenominator)` — exact integer arithmetic, never floats, never time;
- a **near-budget policy** (default: `near` begins at ceil(9/10 · allowed)).

Verdicts: `within-budget` (measured < near floor) | `near-budget` (near floor ≤ measured ≤ allowed) | `over-budget` (measured > allowed — the regression gate bites).

## Headroom policy

Envelope slopes derive from the **measured coefficients** of the reference compositions (the calibration is reproducible via the scale suite) plus declared engineering headroom: the healthy composition must sit comfortably BELOW the near threshold (target ratio measured/allowed ≤ 0.9) while a composition-level regression (any super-linear behavior or per-record re-work) exceeds the envelope. Intercepts absorb small-rung constants.

## The catalog

| Budget | Subject | Input unit | Class → measured coefficient → envelope |
|---|---|---|---|
| `budget:solution-admission` | solution-admission | planLines | kernel-admission: constant 1 → intercept 4; digest-compute: constant 4 → intercept 16 |
| `budget:program-fold` | program-fold | planLines | kernel-fold: 3N + N/16 + N/8 = 3.1875N → slope 15/4, intercept 16; admission 1 and digest 2 constant |
| `budget:pack-projection` | pack-projection | packProjections | projection-compute: 54.4 rows/projection (a full 5-surface cycle at planLines=64 emits 272 rows) → slope 62, intercept 32; admission 2 and digest 1 constant |
| `budget:observation-stack` | observation-stack | observations | kernel-admission: 4M+1 → slope 5; digest-compute: 2M+2 → slope 3; kernel-fold: 3M → slope 4 (intercepts 8) |
| `budget:variance-stack` | variance-stack | observations | kernel-admission: M → slope 2; digest-compute: M → slope 2; kernel-fold: 2M → slope 3 (intercepts 8) |
| `budget:harness-scenario` | harness-scenario | scenarioSteps | harness-scenario: 4S+4 → slope 5, intercept 16 |
| `budget:delivery-stack-composition` | delivery-stack-composition | planLines | kernel-admission: 0.5N+3 → slope 1; digest-compute: 0.375N+2 → slope 1/2; kernel-fold: 3.6875N → slope 9/2; projection-compute: 7.6875N+7 → slope 9; harness-scenario: 68 constant → intercept 96 |
| `budget:distinction-refold` | distinction-refold | observations | the fold-discipline budget: kernel-fold of the CORRECT batched composition is M → slope 2, intercept 8 (admission/digest slope 2) |

## Per-budget rationale (the measured derivations)

- **solution-admission**: the W036 admission path is one fixed sequence regardless of plan-line count: workload-record verification (1 digest), version seal (1), chain admission (1 admission), chain verification (chain length digests), baseline approval (1). A per-line re-admission regression (slope > 0) exceeds the constant envelope.
- **program-fold**: the five synchronized W036 schedule folds iterate their input records once each — quantity/cost/resource rows N each, milestones N/16, realization N/8.
- **pack-projection**: the W026/W027 pack projections emit one view row per input record (the DP1.0 projection rule); at the pinned grammar (planLines=64) a full 5-surface cycle emits 272 rows.
- **observation-stack**: the full authority path per observation — seal, delivery record, distinction-ledger admission, actualization intake, actualization apply (4M+1 admissions); M seals + M sealed assessments + a final verification (2M+2 digests); ledger fold + delivery actuals fold (3M fold records).
- **variance-stack**: per variance record — compute (seal) + ledger admission; the records fold and the summary fold iterate the ledger once each (2M).
- **harness-scenario**: the W032 runner performs begin + initial state digest + per step (runStep + state digest) per execution, DOUBLED by the built-in replay-determinism double-run: 4S+4 driver-seam invocations.
- **delivery-stack-composition**: the composed stack at N plan lines under the composition grammar (observations = ceil(N/8), one full 5-surface projection cycle, 16 harness steps): every class linear in N with the constants above.
- **distinction-refold**: the fold-discipline envelope. The CORRECT batched composition folds ONCE after M admissions (M fold records). The INFLATED composition (re-fold after every admission — M(M+1)/2 fold records) violates the envelope: this budget exists to make that regression a typed over-budget verdict (see `gate-policy.md`).

## Where the evidence lives

- Every budget at every ladder rung is asserted `within-budget` and passed through `enforceBudgets`: `tests/performance/test/scale-budgets.test.ts` (named tests per operation class).
- The catalog records round-trip + verify: `tests/performance/test/round-trip.test.ts`.
- Envelope math exactness + verdict boundaries: `packages/performance/test/budgets.test.ts`.
