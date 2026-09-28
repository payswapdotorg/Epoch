# The Gate Policy (W034)

The regression gate is the point of the whole performance layer: **the suite FAILS when a budget is exceeded.**

## The mechanism

`enforceBudgets(verdicts)` — the ONE deliberately throwing API in `@epoch/performance` — throws a typed `PerformanceBudgetExceededError` carrying the exact over-budget verdicts when any verdict's overall is `over-budget`. The error message names the subject, the operation class, and the exact counts (`kernel-fold: measured 136 > allowed 40 (exceeded by 96)`), and the `violations` field carries the full typed records for programmatic inspection.

Every scale-suite test runs its verdicts through `enforceBudgets` in addition to asserting `within-budget` — two independent tripwires on the same evidence.

## What trips the gate

1. **Envelope exceedance** — a composition whose measured counts exceed an envelope at ANY ladder rung. The gate is per-rung: a regression that only bites at scale (e.g. quadratic refold at M ≥ 5) is caught at the small rung already, and the suite exercises every rung up to `xx-large`.
2. **Slope regressions** — a healthy-but-degraded composition that stays linear but with a worse coefficient eventually crosses the envelope (the headroom policy in `budget-catalog.md` is sized so measured/allowed ≤ 0.9 for the reference compositions; a coefficient regression of ~11%+ crosses the near threshold, a larger one crosses the envelope).
3. **Composition-level complexity regressions** — a super-linear composition (re-admission per record, re-fold per append) exceeds any linear envelope; the complexity analysis independently flags it (`complexity-class-mismatch`) and the quadratic detection case proves the analyzer sees it.

## The gate-bites evidence (`regression-gate-bites`)

`tests/performance/test/regression-gate.test.ts` proves the gate with a REAL inflated composition (not a hand-forged record):

1. **Bites**: the inflated refold (re-fold after every admission) at the medium rung measures 136 fold records against an allowed 40 → the verdict is `over-budget` with `exceededBy = 96`; `enforceBudgets` throws the typed error carrying those exact counts.
2. **No masking**: a within-budget verdict mixed with the over-budget one still fails the gate.
3. **Early**: the smallest rung (M=8: 36 > 24) already trips.
4. **Restored**: the batched composition (the correct discipline) at the same rung evaluates `within-budget` and enforces cleanly — the suite recovers, proving the gate is discriminating (it fails the REGRESSION, not the composition family).

## The recovery contract

An over-budget condition is NEVER a crash:

- `evaluateBudget` is total — the over-budget outcome is a SEALED VERDICT RECORD carrying the exact measured/allowed counts, the exceeded envelope, and the full evaluation binding (budget/workload/counts by id + digest). Evidence: `tests/performance/test/recovery.test.ts`.
- The measurement pipeline keeps operating after an over-budget verdict (a subsequent healthy measurement evaluates and verifies cleanly).
- Violation collection is pure (`collectBudgetViolations`) — callers can inspect before deciding to enforce.

## What the gate is NOT

- The gate does not measure time and does not claim to (see `counter-methodology.md`).
- The gate does not fail on `near-budget` — near is a signal, not a breach (the reference compositions sit below the near threshold by the headroom policy).
- The gate does not police kernel-internal constants invisible at the seam; those are covered by the complexity declarations and the input-size envelopes.
- The gate never blocks a merge by flaky timing: every input to a verdict is deterministic data (workload digest, measured counts, budget record).
