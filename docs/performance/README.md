# Performance Documentation (W034)

Owned by Work Order **W034** (`packages/performance/*`, `tests/performance/*`, `docs/performance/*`). Service layer.

This folder is the **performance model**: the budget catalog, the workload grammar, the counter methodology, the complexity table, and the gate policy. It is written for reviewers — every claim here is pinned by a named test in `tests/performance/test/` and by the self-tests of `packages/performance`.

## The performance discipline (the one rule)

**Deterministic, wall-clock-FREE performance engineering.** Tests NEVER measure real time (flaky by construction); scale is expressed as **INPUT SIZE** and complexity as derived **OPERATION COUNTS**. Everything — budgets, workloads, counters, verdicts, complexity models — is typed, sealed, versioned DATA.

## Document index

| Document | What it covers |
|---|---|
| [`budget-catalog.md`](budget-catalog.md) | The budget records: per subject, per operation class, the input-size → allowed-count envelopes, the measured coefficients they derive from, and the headroom policy |
| [`workload-grammar.md`](workload-grammar.md) | The seed → shape → payload grammar of the deterministic workload generators, and the per-subject grammar the budgets apply to |
| [`counter-methodology.md`](counter-methodology.md) | Why counts and never wall-clock; the operation-class vocabulary; the counting conventions at the composition seam |
| [`complexity-table.md`](complexity-table.md) | The complexity table: subject → declared class → evidence test, and the exact rational ratio bounds |
| [`gate-policy.md`](gate-policy.md) | The regression-gate policy: what fails a suite, how the gate bites, and the recovery contract |

## Authority boundaries (one responsibility, one authority)

- `@epoch/performance` (the kernel) owns the **measurement framework**: budgets, workload generators, counters, evaluation, complexity analysis. It is NOT a semantic authority — it measures the kernels, it never interprets them.
- The **measurement subjects** (solution-delivery, actualization, variance, the two domain packs, the test harness) are never dependencies of the performance kernel; they compose as devDependencies of the test trees (`tests/performance`) — the W032 driver-seam pattern.
- The counter wrappers are **test-only compositions** over the subjects' public APIs — never kernel edits.
- Provider neutrality: no vendor, brand, marketplace, ERP, PM tool or API surface appears in any schema, vocabulary or doc here (architecture lock rule 13).

## Determinism contract

Zero wall-clock, zero randomness, zero network. Every generated value derives from index arithmetic over a fixed instant series; every record is content-addressed canonical SHA-256. Identical seeds derive identical workload digests; identical workloads derive identical measured counts and verdicts (`tests/performance/test/determinism.test.ts`). Reruns are byte-identical.

## How to run

```bash
# The performance kernel's self-tests (framework-level evidence):
pnpm --filter @epoch/performance exec vitest run

# The scale evidence suite (the real-kernel compositions):
pnpm --filter @epoch/test-harness exec vitest run --root ../../tests/performance

# Typecheck + lint of the owned test surface:
cd packages/test-harness && pnpm exec tsc --noEmit -p ../../tests/performance/tsconfig.json
cd tests/performance && ../../packages/test-harness/node_modules/.bin/eslint .
```

The verification battery of record is the repo-standard `pnpm check && pnpm exec turbo run typecheck lint test build --concurrency=1 --force` (which covers `@epoch/performance` as a workspace package) plus the two commands above for the owned test tree.
