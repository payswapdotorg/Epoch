# @epoch/adapter-sdk

Epoch Adapter SDK kernel (**Work Order W007**): the typed, per-category
adapter contracts concrete Capability Fabric adapters implement —
capability binding with bind-time version negotiation, a typed error
taxonomy, and deterministic descriptor serialization.

**Ships ZERO concrete adapters** (the reference adapter set — Git/IFC/
MCP/FMI — is W029) and **ZERO Wasm/runtime machinery** (the extension
runtime is W008). Any vendor/provider/model/API surface is a property of
concrete adapters, never of these contracts (architecture lock rule 13).

## Surface

- **Per-category adapter contracts**: `CapabilityAdapter<C>` — a
  descriptor plus an async `invoke(request) => response` — with typed
  request/response envelopes discriminated by the eight Capability
  Fabric categories (`source`, `semantic`, `reconstruction`,
  `visualization`, `simulation`, `evaluator`, `action`, `verification`;
  the agent-protocol vocabulary). Payload types:
  - `simulation` — mirrors W005 `SimulationInvocationRequest` inputs /
    `SimulationOutcome` exactly (parity-pinned).
  - `evaluator` — mirrors W005 `EvaluationSubject` / criteria /
    `VerdictOutcome` / justification exactly (parity-pinned).
  - `action` — mirrors W003 `ActionTarget` / parameters exactly
    (parity-pinned); adapters EXECUTE authorized interventions —
    proposals and authorization belong to the Action Gateway (lock
    rule 3).
  - `verification` — mirrors W006 `VerificationStage` / `RunStatus` /
    produced-evidence digests (parity-pinned).
  - `source`/`semantic`/`reconstruction`/`visualization` — neutral
    named-input/output records until their protocol contracts are
    frozen (documented limitation).
- **Capability binding**: an `AdapterDescriptor` declares which
  capability id + version range (`exact` or `caret`) it serves — never a
  floating reference (R18).
- **Version negotiation at bind time**: `negotiateBinding` /
  `negotiateBestBinding` check identity, category, lifecycle, and
  version, then produce a `BindingPin` — capability manifest digest +
  adapter descriptor digest, both content-addressed — or a typed error.
  Deterministic best-match (highest satisfying version; digest
  tie-break); never a guess.
- **Deterministic descriptor serialization**: canonical JSON
  (`serializeAdapterDescriptor`) + SHA-256 content addressing
  (`computeAdapterDescriptorDigest`).
- **Error taxonomy**: `validation`, `unknown-capability`,
  `version-unsatisfied`, `lifecycle-conflict`, `binding-conflict` —
  typed, categorized, precise paths, as values (never thrown).

## Registry integration (structural, no runtime coupling)

`BindableCapability` is the minimal structural view of a
`@epoch/capability-registry` record; real records are directly
assignable to it (pinned by compile-time parity tests +
`test/registry-parity.test.ts`, which registers real records and
negotiates bindings end-to-end). Runtime dependencies remain exactly
`@epoch/agent-protocol` (canonical JSON, SHA-256, shared patterns) and
`zod` — the W003/W005/W006/registry packages appear only as
devDependencies of the parity tests (the W006 evidence -> W002
world-model kernel devDep precedent).

The semver machinery is deliberately duplicated from
`@epoch/capability-registry` (same policy); a cross-parity test runs
both implementations over a shared corpus and asserts identical
parse/compare/satisfy results.

## Versioned contract surface

Published INSIDE the package (W007 owns no `contracts/*` directory),
following `@epoch/verification`/`@epoch/evidence`: version constants +
typed index export (`src/index.ts`), runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts` +
`test/w00x-parity.types.ts`), and the committed JSON Schema projection
under `schemas/` pinned by `test/contract-drift.test.ts` (regenerate
with `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/adapter-sdk test contract-drift`).
