# Semantic-Distinction Invariant Guide (W036)

USL1.0 (binding) preserves nine distinctions as SEPARATE concepts:
**Prediction, Estimate, Baseline, Commitment, Observation, Actual,
Forecast, Outcome, Learning Record.** No domain pack may collapse them
into one mutable value. This guide documents how
`@epoch/solution-delivery` enforces that invariant.

## The record family

Every distinction is one member of the sealed `DistinctionRecord` family
(`packages/solution-delivery/src/distinctions.ts`):

| Kind | Record id grammar | Carries | Typical subject |
|---|---|---|---|
| `prediction` | `prediction:<slug>` | measure + optional basis reference (e.g. a simulation run) and target instant | activity / work package |
| `estimate` | `estimate:<slug>` | measure + optional method reference and low/high range | solution line / activity |
| `baseline` | `baseline:<slug>` | the approved solution version + its exact content digest | solution |
| `commitment` | `commitment:<slug>` | measure + committing principal + instant + optional acquisition link | acquisition |
| `observation` | `observation:<slug>` | measure + delivery scope + observer + instant + sorted evidence references | activity / work package / milestone |
| `actual` | `actual:<slug>` | measure + the observation it was converted from + actualization provenance | (inherits the observation's subject) |
| `forecast` | `forecast:<slug>` | measure + as-of instant + forecast-lineage `refines` | any |
| `outcome` | `outcome:<slug>` | outcome kind + sorted verification digests | solution / activity / work package / line |
| `learning` | `learning:<slug>` | lesson text + sorted record links | any |

Every record: strict object (vendor fields rejected), tenant-scoped,
digest-sealed (SHA-256 over canonical JSON — tamper detection is a typed
`digest-mismatch`), and carries the mandatory **uncertainty state**
(provenance + freshness + confidence — the decision-sufficiency rule).

## The invariants and their typed rejections

1. **One record identity = one semantic distinction.** The ledger
   admission rejects a record id that changes kind —
   `distinction-collapse-rejected` (`publishedKind` / `encounteredKind`
   carried on the error). The same id with the same kind but different
   content is `version-conflict`: sealed records are immutable; changed
   content ships as a NEW record id.
2. **A record id's kind prefix must match its kind.** A record whose id
   claims one distinction while its content claims another is also
   `distinction-collapse-rejected`.
3. **Forecasts never overwrite history.** A forecast may `refines` an
   EARLIER FORECAST only. Refining a prediction, baseline or actual — or
   a missing record — is `forecast-overwrite-rejected`. The forecast
   lineage is therefore a chain of forecasts; historical records are
   never touched.
4. **Baselines reference, never restate.** A `baseline` record points at
   the sealed solution version (version + digest); the version chain is
   the baseline authority. Mutating an approved baseline is
   `baseline-mutation-rejected` — changes ship as a NEW version in the
   chain.
5. **Actuals derive, never restate.** An `actual` inherits the accepted
   observation's measure and uncertainty and links to its id;
   actualization converts ACCEPTED observations only
   (`unaccepted-actualization-rejected`), and exactly once
   (`version-conflict`).
6. **Uncertainty is mandatory.** A fact without provenance/freshness/
   confidence is structurally inexpressible (`validation` rejection).
   Unknowns stay preserved — they never block silently.

## Why this matters for domain packs (DP1.0)

A pack that wants "the current quantity" must PROJECT: baseline (planned)
from the version chain, commitments from commitment records, actuals from
the delivery record, forecasts from the forecast lineage — and show all
of them with their uncertainty states. A single mutable `value` field
that flips meaning over time is exactly what the typed rejections above
make impossible to admit.
