# @epoch/actualization — Epoch Actualization kernel (W039)

The **Actualization, Variance-input and Forecast spine** over the W036
solution-delivery kernel (USL1.0, binding): *“Observation is evidence
capture; Actualization converts accepted observations into authoritative
delivery facts”* and *“Forecasts never overwrite historical predictions,
baselines or actuals.”*

Owned by Work Order **W039** (`packages/actualization/*`,
`contracts/actualization/*`; the sibling variance kernel lives in
`packages/variance/*`, the reference runtime in
`services/actualization/*`). Kernel layer.

## What this kernel owns

| Module | Responsibility |
|---|---|
| `src/validation.ts` | Observation intake admission + the **typed validation states** (insufficient / corroborated / conflicting / resolved) — the deterministic per-(subject, measure) reconciliation fold under a typed policy (exact or tolerance agreement, corroboration quorum); sealed conflict resolutions that partition a conflicting observation set exactly. |
| `src/reconciliation.ts` | `applyActualization` — the deterministic fold of validated observations into actuals, applied **EXCLUSIVELY through the W036 DeliveryRecord authority path** (`recordObservation → acceptObservation → actualizeObservation`). No code path seals `actual` records directly (`actualization-bypass-rejected`). |
| `src/lineage.ts` | Typed **exact-revision lineage edges** chaining prediction → baseline → commitment → actual → forecast for every realization variant — content-addressed, revision-precise, acyclic, traversable in both directions. |
| `src/forecast.ts` | **Rolling completion and cost forecasts**: deterministic functions producing the NEXT forecast revision from current actuals + remaining plan (exact fixed-point decimals); forecasts are NEW sealed W036 Forecast-distinction records refining earlier forecasts only. |
| `src/calibration.ts` | **Confidence/calibration state**: immutable comparison facts (`history-immutable`) folding deterministically into sealed calibration states (bias counts, exact total absolute deviation, worst deviation, derived confidence). |
| `src/store.ts` / `src/state.ts` | The reference in-memory admission store + the derived actualization-state projection (pure folds, never stored). |
| `src/events.ts` | The `actualization:*` event vocabulary over the W010 event shapes (one stream per delivery, `stream:actualization-<suffix>`). |

## Authority split

- The **DeliveryRecord (W036)** stays the delivery-facts authority: this
  kernel never writes actuals directly — actualization converts ACCEPTED
  observations through the W036 authority path only.
- The **DistinctionLedger (W036)** stays the forecast-record authority:
  rolling forecasts are W036 Forecast-distinction records; the ledger
  enforces forecast-refinement (`forecast-overwrite-rejected`).
- W038 field observations and W037 supplier-delivery receipts enter as
  sealed W036 Observation-distinction records (the common spine) — this
  kernel folds them; it never re-implements them.
- The variance kernel (`@epoch/variance`) owns variance records,
  attribution, and prediction comparisons; this kernel folds their
  outputs as opaque comparison facts (no runtime edge).

## Runtime dependencies

`@epoch/solution-delivery`, `@epoch/agent-protocol`, `@epoch/tenancy`,
`zod` — nothing else (frozen W039 policy). Sibling-kernel parity is
pinned via devDependencies only (`src/kernel-parity.ts` +
`test/parity.test.ts`).

## Contract surface

- In-package full surface: `packages/actualization/schemas/` (+ this
  package’s `manifest.json`), emitted by
  `renderActualizationContractFiles()`.
- Public core-record projection: `contracts/actualization/` (W012
  convention), emitted by `renderActualizationPublicContractFiles()`.
- Both are drift-pinned byte-for-byte by `test/contract-drift.test.ts`.

## Determinism

Zero wall-clock, zero randomness, zero I/O — every instant is
caller-supplied; every fold is exact fixed-point decimal arithmetic over
canonically ordered inputs (input order never leaks); identical inputs
derive identical digests.
