# contracts/execution — Epoch Execution Tracking contract surface

Owned by Work Order **W038** (`packages/execution-tracking/*`,
`services/execution-tracking/*`, `contracts/execution/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Execution Tracking v1** kernel at its ownership
boundary: the universal realization-tracking layer and low-friction
field-observation ingestion over the W036 solution-delivery kernel
(USL1.0, binding) — construction execution is ONE projection;
build/deployment/fabrication/installation/commissioning vocabulary maps
onto the same spine. The runtime implementation is
`@epoch/execution-tracking`; this contract defines only the typed
shapes — no admission logic, no persistence, no UI lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no vendor/field-platform vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/execution-tracking`'s `typecheck` script (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, data-type inventory, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of the CORE record types, emitted by `renderExecutionTrackingPublicContractFiles()` in `@epoch/execution-tracking`. |

The full (55-entry) schema surface is additionally published in-package
at `packages/execution-tracking/schemas/` (the W007/W009/W023/W036
in-package convention); this directory carries the W012-convention public
projection of the core record types. Both sets are drift-pinned
byte-for-byte by `packages/execution-tracking/test/contract-drift.test.ts`.

## Authority split (USL1.0 / architecture lock rule 16)

- **ProgramOfWork** (W036) — the authoritative schedule dimension:
  execution-tracking records reference work packages/activities by
  OPAQUE ID and OBSERVE state transitions; they never re-schedule
  (schedule fields on a tracking record are a typed
  `authority-violation-rejected`).
- **DeliveryRecord** (W036) — the delivery-facts authority:
  execution-tracking PRODUCES observations (kind `observation`) and
  typed reconciliation proposals; actualization converts ACCEPTED
  observations only, through the W036 acceptance/actualization path —
  this surface never writes Actual records directly
  (`actualization-bypass-rejected`).
- **Evidence** (W006) — field evidence references carry the W006
  evidence record digest plus capture context; NEVER embedded payloads.
- **Event log** (W010) — execution events are W010-shaped append-only
  facts in the open `execution:` payload namespace, one stream per work
  package (`stream:execution-<suffix>`), digested by the canonical
  SHA-256 discipline.
