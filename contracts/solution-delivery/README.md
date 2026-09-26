# contracts/solution-delivery — Epoch Solution Delivery contract surface

Owned by Work Order **W036** (`packages/solution-delivery/*`,
`contracts/solution-delivery/*`, `docs/solution-delivery/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Solution Delivery v1** kernel at its ownership
boundary: the universal delivery domain model (USL1.0, binding) —
tenant-scoped SolutionPackages with immutable hash-chained SolutionVersion
baselines; the nine semantic-distinction record types; the ProgramOfWork
schedule dimension; the DeliveryRecord observation/acceptance/actualization
machinery; the universal eleven-stage lifecycle as typed stage records and
typed transition relations; the acquisition/realization variant catalogs;
information-acquisition requests; the provider-neutral external
request/event seam; and the `delivery:*` event vocabulary over the W010
event shapes. The runtime implementation is `@epoch/solution-delivery`;
this contract defines only the typed shapes — no admission logic, no
persistence, no UI lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no vendor/Aurum vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/solution-delivery`'s `typecheck` script (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, data-type inventory, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of the CORE record types, emitted by `renderSolutionDeliveryPublicContractFiles()` in `@epoch/solution-delivery`. |

The full (90-entry) schema surface is additionally published in-package at
`packages/solution-delivery/schemas/` (the W007/W009/W023 in-package
convention); this directory carries the W012-convention public projection
of the core record types. Both sets are drift-pinned byte-for-byte by
`packages/solution-delivery/test/contract-drift.test.ts`.

## Authority split (USL1.0 / architecture lock rule 16)

- **SolutionPackage / SolutionVersion** — approved solution intent and
  baseline authority: sealed, content-addressed, hash-chained via
  `previousVersionDigest`; approval is a distinct authority act
  (`BaselineApproval`); in-place revision of an approved baseline is a
  typed `baseline-mutation-rejected` (changes ship as NEW versions).
- **DeliveryRecord** — live delivery facts authority: observation intake
  (evidence capture), acceptance transitions (review state lives on the
  delivery, never on the observation record), and actualization of
  ACCEPTED observations only (`unaccepted-actualization-rejected`).
- **ProgramOfWork** — the authoritative schedule dimension: a
  dependency-aware realization graph (work packages, activities,
  predecessor/successor mirrors, milestones) with deterministic
  quantity/cost/resource schedule folds.
- Everything else is referenced OPAQUELY: world entities (W002 grammar),
  constraints (W004 grammar), evidence digests (W006 grammar), external
  systems (opaque references behind the external request/event seam).
  One responsibility has one authority.

## The nine semantic distinctions (USL1.0)

Prediction, Estimate, Baseline, Commitment, Observation, Actual,
Forecast, Outcome, Learning Record are SEPARATE immutable record types.
A record identity belongs to exactly one kind; a kind flip is a typed
`distinction-collapse-rejected`; forecasts refine forecasts only
(`forecast-overwrite-rejected` — they never overwrite historical
predictions, baselines or actuals).

## Provider neutrality (lock rule 13)

No vendor, brand, marketplace, ERP, PM tool, or API vocabulary exists in
these types. Procurement is ONE of seven acquisition variants;
construction execution is ONE of seven realization variants. A blocklist
test fails the build if any vendor/Aurum token appears in the source or
emitted artifacts.

## Versioning

`schemaVersion` (`1`) is carried by every serialized record and validated
exactly — skew is a typed `validation` error at the precise path, never a
silent parse. `contractVersion` (`1.0.0`) versions this published surface.
The universal lifecycle version (`1.0.0`, USL1.0) must be declared exactly
by every domain pack profile.

## JSON Schema fidelity and determinism

Structural-only projection; runtime refinements (canonical ordering,
dependency mirrors, digest verification, tenant checks) are enforced by
`@epoch/solution-delivery`. The committed artifacts are byte-identical to
the deterministic emission; regeneration is only possible through the
documented update mode:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/solution-delivery test contract-drift
