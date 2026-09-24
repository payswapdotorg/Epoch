# @epoch/capability-registry

Epoch Capability Registry kernel (**Work Order W007**): versioned,
content-addressed capability manifests across the eight Capability Fabric
adapter categories, with typed lifecycle governance, digest-checked
registration, and deterministic version-constrained resolution.

## Scope (frozen architecture)

- Registered adapter categories are EXACTLY (architecture.md, "Capability
  Fabric"): `source`, `semantic`, `reconstruction`, `visualization`,
  `simulation`, `evaluator`, `action`, `verification`. The vocabulary is
  imported from `@epoch/agent-protocol` (`CAPABILITY_FABRIC_CATEGORIES`) —
  one source of truth, no drift.
- **Versioned capabilities (R18)**: every manifest carries a semver core;
  consumers resolve against `exact` or `caret` constraints (npm-caret
  semantics incl. the 0.x carve-outs), never floating references.
- **The registry REGISTERS capabilities; it never implements them** (lock
  rule 5): simulator/evaluator/verifier engines are external capabilities
  behind adapters (W021/W029).
- **Provider neutrality (lock rule 13)**: strict objects reject unknown
  (vendor/provider) fields; the trust surface names origin classes
  (first-party / community / external-software /
  provisional-document-derived), never vendors.
- **Reference in-memory registry**: no persistence, no event log, no UI,
  no workflow engine, no trust scoring (later Work Orders). Records are
  plain, serialization-friendly JSON; iteration is always sorted.

## Model

- `CapabilityManifest` — the immutable registration document:
  `schemaVersion`, `capabilityId` (opaque, stable, dot-namespaced — the
  extension scoping unit, lock rule 9), `category`, `version`
  (semver core), a provider-neutral `descriptor` (display name,
  agent-protocol `ParameterSpec` inputs/outputs, stated assumptions),
  `contracts` (versioned contract references, e.g.
  `epoch.simulation-protocol@1.0.0`), and `trust` (origin, optional
  curator, optional attestation digest).
- `CapabilityRecord` — the published registry state: the manifest, its
  lifecycle state, and the SHA-256 `manifestDigest` (canonical JSON).
- Lifecycle: `registered -> deprecated -> retired` (typed, forward-only;
  `registered -> retired` is legal for immediate yanks; no revival).
  Retired capabilities do not resolve for NEW bindings; deprecation is
  advisory. `get` retrieves any state (inspection); `resolve` is for new
  bindings and returns the HIGHEST satisfying non-retired version —
  deterministically, or a typed no-match error.

## Integrity (tamper detection)

Registrations are sealed: `{ manifest, digest }` where `digest` is the
SHA-256 of the manifest's canonical JSON (`computeCapabilityManifestDigest`
/ `sealCapabilityManifest`). `register` and `parseCapabilityRecord`
recompute the digest and reject mismatches with a typed
`digest-mismatch` error — a manifest whose digest does not match its
content never enters the registry.

## Error taxonomy

Typed, categorized, precise paths (values, never thrown):
`validation`, `unknown-capability`, `duplicate-capability`,
`version-unsatisfied`, `lifecycle-conflict`, `digest-mismatch`
(`binding-conflict` lives in `@epoch/adapter-sdk` — see below).

## Versioned contract surface

Published INSIDE the package (W007 owns no `contracts/*` directory),
following `@epoch/verification`/`@epoch/evidence`: version constants +
typed index export (`src/index.ts`), runtime zod validators
(`src/schema.ts`), compile-time parity (`src/parity.ts`), and the
committed JSON Schema projection under `schemas/` pinned by
`test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/capability-registry test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared patterns/vocabularies) and `zod`
(frozen catalog). Dev/test only: the workspace toolchain.
`@epoch/adapter-sdk` pins compatibility with this package via
devDependencies + compile-time parity tests — no runtime coupling in
either direction.
