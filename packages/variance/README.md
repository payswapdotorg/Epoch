# @epoch/variance — Epoch Variance kernel (W039)

The **explainable predicted-vs-actual variance layer** over opaque typed
references (USL1.0: prediction/baseline/commitment/actual/forecast are
lifecycle-first concepts; forecasts never overwrite historical
predictions, baselines or actuals).

Owned by Work Order **W039** (`packages/variance/*` — the W039 owned
surfaces include NO `contracts/variance` tree, so the in-package schema
surface under `schemas/` is this kernel's published contract).

## What this kernel owns

| Module | Responsibility |
|---|---|
| `src/variance.ts` | The **full variance class set** as typed sealed records — quantity, price/rate, productivity, schedule, waste, rework, change, external-condition — each comparing a baseline/commitment/forecast line to actualized values with **magnitude + direction (+ band)**; the deterministic polarity table; the append-only variance ledger + the explainability summary fold. |
| `src/attribution.ts` | **Root-cause attribution with evidence**: typed attribution records linking a variance to its cause (a change record, a W038 issue, an external condition) by W006-convention evidence references — `attribution-evidence-required` when ungrounded. |
| `src/comparison.ts` | **Immutable historical prediction comparison**: forecast-revision and forecast-to-actual comparisons as typed sealed records; `history-immutable` on modification or pair-replacement attempts. |
| `src/decimal.ts` | The exact fixed-point decimal discipline (locally implemented — no runtime edge to `@epoch/solution-delivery`). |
| `src/kernel-parity.ts` | Compile-time pins: the measure-value mirror ≡ the W036 `Measure`; the confidence mirror ≡ the W036 `ConfidenceState`; compared-line grammars ≡ the W037 commitment-reference discipline. |

## Compared lines are opaque references

Variance records reference actuals/forecasts/baselines/commitments by
**opaque exact-revision typed references** (`ComparedLineRef` —
kind-prefixed record id + content digest, the W037
commitment-reference discipline). There is NO runtime edge to
`@epoch/actualization` or `@epoch/solution-delivery`; the measure-value
space is a structural mirror of the W036 measure grammar, pinned by
compile-time kernel parity (`src/kernel-parity.ts`) and runtime parity
tests over devDependencies only.

## Runtime dependencies

`@epoch/agent-protocol`, `@epoch/tenancy`, `zod` — nothing else (the
frozen W039 policy). `@epoch/solution-delivery` is a devDependency
solely for compile-time + test parity of the measure/confidence mirrors
(no runtime edge; `dependencies` carries exactly the frozen set).

## Contract surface

The in-package full surface under `packages/variance/schemas/` (+ the
manifest), emitted by `renderVarianceContractFiles()`, drift-pinned
byte-for-byte by `test/contract-drift.test.ts`.

## Determinism

Zero wall-clock, zero randomness, zero I/O — every instant is
caller-supplied; every deviation is exact fixed-point decimal
arithmetic; identical inputs derive identical digests.
