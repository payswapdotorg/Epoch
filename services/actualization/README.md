# @epoch/actualization-runtime — Epoch Actualization Runtime service (W039)

The thin typed **HOST FACADE** over the `@epoch/actualization` +
`@epoch/variance` kernels.

Owned by Work Order **W039** (`services/actualization/*`). Service
layer.

## What this host owns

| Surface | Responsibility |
|---|---|
| `registerDeliveryRecord` | Delivery-record registration (the W036 authority state input; idempotent by digest). |
| `intakeObservation` / `pollObservationSources` | The observation intake — direct and through the **ObservationSourcePort** adapter seam (ONE in-memory reference adapter; the core never names a vendor) — with IDEMPOTENT replay (duplicate-observation admissions, state unchanged, replays emit nothing). |
| `assessValidation` / `admitResolution` | The typed validation fold + conflict-resolution admission (exact-revision partition bindings). |
| `applyActualization` | Actualization application **EXCLUSIVELY through the W036 DeliveryRecord authority path** (`recordObservation → acceptObservation → actualizeObservation`) — never a direct actual write (`actualization-bypass-rejected`). |
| `computeVariance` / `admitAttribution` | Variance computation + evidence-grounded root-cause attribution (`attribution-evidence-required` BEFORE admission). |
| `reviseForecast` | Rolling forecast revision emission — append-only W036 Forecast-distinction records refining earlier forecasts only (the host owns the growing forecast DistinctionLedger). |
| `admitComparisonFact` / `foldCalibration` | Immutable comparison-fact admission + the deterministic calibration folds. |
| `projectState` / `health` | The derived actualization-state projection + the runtime health snapshot. |

Every step emits `actualization:*` events (W010-shaped, one stream per
delivery `stream:actualization-<suffix>`) sealed by the kernel and
pinned by REAL `sealEvent` parity tests.

## Authority split

- The **W036 DeliveryRecord** stays the delivery-facts authority: this
  host applies actuals through its authority path only.
- The **kernels** stay the domain authority: this host adds
  authorization, tenancy scoping, event emission, and state hosting —
  zero domain re-implementation.

## The authorization gate (W009)

Every operation passes the `@epoch/authorization` decision point
(`actualization.<operation>` action kinds) BEFORE any kernel admission;
denials are typed `authorization-rejected` (fail-closed on unknown
principals, foreign memberships, inactive principals).

## Runtime dependencies

`@epoch/authorization`, `@epoch/actualization`, `@epoch/variance`,
`@epoch/tenancy`, `zod` — nothing else (the frozen W039 policy).

## Determinism

Zero wall-clock, zero randomness — every instant is caller-supplied;
every listing/snapshot is sorted; two runtimes fed the same operations
hold byte-identical state (the event stream is order-bearing by W010
design; the derived state folds are order-invariant).
