# @epoch/performance — the Epoch Performance kernel (W034)

Owned by Work Order **W034** (`packages/performance/*`, `tests/performance/*`, `docs/performance/*`). Service layer (the same class as `@epoch/test-harness`).

**The performance discipline: deterministic, wall-clock-FREE performance engineering.** Budgets, workload generators, operation counters, budget evaluation and complexity models are TYPED DATA. Tests NEVER measure real time (flaky by construction); scale is expressed as INPUT SIZE and complexity as derived OPERATION COUNTS.

## Module map

| Module | What it covers |
|---|---|
| `src/version.ts` | Contract version + the closed vocabularies: operation classes, input units, budget verdicts, complexity classes, provenance kinds, id patterns |
| `src/errors.ts` | The typed error taxonomy (`performance-invalid`, `digest-mismatch`, `cross-tenant-denied`, `workload-mismatch`, `subject-mismatch`, `envelope-invalid`, `complexity-mismatch`, `version-conflict`, `serialization-invalid`) — errors are values, never exceptions |
| `src/primitives.ts` | Zod primitives (digests, ids, subjects, provenance) + the shared sealed-record helpers (canonical-JSON SHA-256 content addressing) |
| `src/counts.ts` | The counting hub (`createCounterHub`) + sealed MEASURED-COUNTS records (bound to one workload + one subject) |
| `src/workloads.ts` | Deterministic WORKLOAD GENERATORS (seed -> synthetic workload at N plan lines / M observations / P pack projections / S scenario steps) + the tenant-scoped workload ledger |
| `src/budgets.ts` | Typed PERFORMANCE BUDGETS (per-class integer envelopes), the pure `evaluateBudget` -> within/near/over VERDICTS, and the regression GATE `enforceBudgets` (the one deliberate throwing API) |
| `src/complexity.ts` | Complexity MODEL records, scale LADDERS, and `analyzeComplexity` (measured count ratios across doubling rungs -> `complexity-class-verified` / `complexity-class-mismatch`) |

## Runtime dependency policy (W034 Tech Lead pin, frozen)

`@epoch/agent-protocol` + `@epoch/tenancy` + `zod` — NOTHING else. The measurement SUBJECTS (solution-delivery, actualization, variance, the packs, the test harness) compose as devDependencies of the TEST trees (`tests/performance`), never as dependencies of this library — the W032 driver-seam pattern.

## Design pins

- **Budgets are DATA.** Swap a budget record, no code change. Envelopes are exact integer math (`intercept + floor(slopeNumerator * size / slopeDenominator)`) — never floats, never time.
- **Workloads are pure functions of seeds.** Same seed -> same workload digest (byte-identical). Values derive from index arithmetic over a fixed instant series — zero clock, zero randomness, zero network.
- **Counts, not wall-clock.** The counter hub tallies operations per class at the composition seam; measured counts are sealed, content-addressed records bound to the exact workload revision.
- **Verdicts are reproducible by construction.** `evaluateBudget` is pure; identical (workload, counts, budget) derive identical verdict digests, and every verdict carries the exact measured/allowed counts.
- **The gate bites.** `enforceBudgets` throws a typed `PerformanceBudgetExceededError` carrying the over-budget verdicts — the regression gate that FAILS the suite when an envelope is exceeded.
- **Tenant isolation (R12) everywhere.** Workload ledger admission, budget evaluation — cross-tenant access is a typed `cross-tenant-denied` value.

## How to run

```bash
pnpm --filter @epoch/performance exec vitest run
pnpm --filter @epoch/performance exec tsc --noEmit -p tsconfig.json
pnpm --filter @epoch/performance exec eslint .
```

The real-kernel composition, scale ladders, budget catalog, regression-gate evidence and complexity evidence live in `tests/performance` (run via the borrowed-filter pattern, see `docs/performance/README.md`).
