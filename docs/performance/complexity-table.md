# The Complexity Table (W034)

Every primary operation subject carries a DECLARED complexity class (a sealed, versioned record citing the kernels' documented behavior) VERIFIED by measured count ratios across a doubling scale ladder — `complexity-class-verified` is a typed verdict, not an opinion.

## The verification rule

For each consecutive rung pair of a DOUBLING ladder (sizes N → 2N), the ratio `measured(2N) / measured(N)` must lie within the declared class's **exact rational bounds** (integer cross-multiplication — never floats):

| Declared class | Doubling-ratio bounds (exact rationals) | Ideal |
|---|---|---|
| `constant`  | [1/2, 3/2]  | 1 |
| `linear`    | [3/2, 5/2]  | 2 |
| `quadratic` | [3, 5]      | 4 |

Every pair within bounds → `complexity-class-verified`; any pair outside → `complexity-class-mismatch` (the offending pair is carried in the sealed analysis record).

## The table (subject → class → evidence)

| Subject | Operation class | Declared | Documented basis | Evidence test |
|---|---|---|---|---|
| solution-admission | digest-compute | constant | The W036 admission path (seal, chain admission, chain verification, baseline approval) is one fixed sequence independent of plan-line count | `complexity.test.ts` → 'the constant admission path keeps flat counts' |
| program-fold | kernel-fold | linear | The five synchronized W036 schedule folds iterate their input records once each | `complexity.test.ts` → 'the linear folds double their counts' |
| pack-projection | projection-compute | linear | The W026/W027 pack projections emit one view row per input record (the DP1.0 projection rule) | `complexity.test.ts` → 'every catalog model verifies' |
| observation-stack | kernel-admission | linear | The observation authority path (seal, record, ledger admit, intake, apply) is per-observation | `complexity.test.ts` → 'every catalog model verifies' |
| variance-stack | kernel-fold | linear | The W039 records fold and summary fold iterate the ledger once each | `complexity.test.ts` → 'every catalog model verifies' |
| harness-scenario | harness-scenario | linear | The W032 runner performs a fixed per-step seam sequence (doubled by the replay double-run: slope 4) | `complexity.test.ts` → 'the harness seam doubles with the step count' |
| delivery-stack-composition | kernel-fold | linear | The composed stack folds program schedules (linear in N) + variance and delivery folds (linear in ceil(N/8) observations) | `complexity.test.ts` → 'every catalog model verifies' |
| distinction-refold | kernel-fold | quadratic | The INFLATED composition (re-fold after EVERY admission) measures the triangular sum M(M+1)/2 — the regression signature | `complexity.test.ts` → 'the quadratic signature is DETECTED' |

## The detection case (why the table includes a quadratic row)

The `distinction-refold` quadratic model is deliberately present so the analyzer's detection capability is EXERCISED, not just claimed: the inflated composition's measured counts are the triangular sums (verified exactly: 16·17/2 = 136, 32·33/2 = 528, …), and:

- against a **linear** declaration (the batched expectation) the analysis returns `complexity-class-mismatch` — the analyzer bites;
- against the **quadratic** declaration it returns `complexity-class-verified` — the class is real, not noise;
- the **batched** composition (fold once) verifies LINEAR — the correct discipline holds its class.

This is the same evidence that justifies the over-budget verdict of the regression gate: the quadratic counts are a property of the composition, proven by ratio, not asserted.

## Model records

The models live in `tests/performance/src/budget-catalog.ts` (`COMPLEXITY_MODELS`): sealed, content-addressed records carrying the subject, operation class, declared class, and the documented rationale. The analysis records (verdict + per-pair findings with exact reduced fractions) are sealed by `analyzeComplexity` and round-trip + verify like every other performance record (`packages/performance/test/complexity.test.ts`).
