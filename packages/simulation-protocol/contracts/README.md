# packages/simulation-protocol/contracts — Epoch Simulation Protocol contract surface

Owned by Work Order **W005** (`packages/simulation-protocol/*`,
`packages/evaluation-protocol/*`). Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Simulation Protocol v1** at its ownership
boundary. W005 owns no repository-root `contracts/*` directory, so — by
Tech Lead design pin — the versioned contract surface is published
IN-PACKAGE. The runtime implementation is `@epoch/simulation-protocol`
(kernel layer); consumers in later Work Orders (W007 adapter SDK, W021
simulation execution fabric, W022 action gateway, W029 external adapter
reference set) program against the shapes published here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/simulation-protocol`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, message kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderSimulationContractFiles()` in `@epoch/simulation-protocol`. |

## Versioning

- `protocolVersion` (`"1.0.0"`) is carried by every message and validated
  exactly — a differing version is a typed `version-mismatch` admission
  error, never a silent parse. Tolerance for compatible minor/patch
  versions is deliberately *not* implemented in v1 (recorded as a
  limitation in the W005 PR).
- `contractVersion` (`"1.0.0"`) versions this published surface. The two
  are currently in lockstep; they may diverge when a contract release
  re-exports unchanged protocol types.
- Breaking changes to any published type require a protocol major version
  bump; additions may ride a contract minor bump. The manifest inventory
  makes the published set machine-checkable.

## Determinism and evidence addressing

Admitted messages serialize to a canonical JSON form (sorted keys, no
whitespace, ECMAScript number serialization; owned by
`@epoch/agent-protocol` at `contracts/agent`) whose SHA-256 digest
addresses the exact revision of the message. The evidence chain is:

- a **registration** is addressed by its canonical digest;
- an **invocation request** binds the simulator id to that registration
  digest and is itself addressed by its canonical digest;
- a **result** binds the request id + request digest and the simulator
  reference, and is itself addressed by its canonical digest.

Simulation results deliberately carry NO wall-clock or measurement
fields: a deterministic simulator's result digest must be a pure function
of the request digest, so anything time-varying is structurally
inexpressible in the result message. Measured cost/latency belong to the
declared profiles and to the execution fabric (W021), not to the
prediction artifact.

Canonical-form deviations from RFC 8785 (JCS), both immaterial for the
protocol's ASCII identifier vocabulary, are documented in
`contracts/agent/README.md` and inherited from the shared canonical
serializer.

## JSON Schema fidelity

The schema files are a **structural-only** projection
(`jsonSchemaFidelity` in `manifest.json`). Zod refinements — cross-field
invariants such as "at least one input", "unique/disjoint parameter
names", "non-deterministic + internal-seed is contradictory", and the
calendar validity of timestamps — are enforced by the runtime validators
in `@epoch/simulation-protocol` and are intentionally absent from the
JSON Schema files. Consumers MUST validate messages with the runtime
package; the JSON Schema files describe the wire shapes for tooling and
documentation.

## Authority and neutrality (architecture lock rules 5/6, 13)

- **Simulators remain external capabilities** (lock rule 5): this surface
  declares registration, invocation request, and result message shapes —
  not a simulation engine, not an execution fabric (W021), and no
  concrete solver adapters (W029). Nothing solver-specific may appear in
  these types; enforced by blocklist tests.
- **Simulation predicts; evaluation judges** (lock rule 6): verdicts and
  evaluation criteria live in `@epoch/evaluation-protocol` — a distinct
  package with a distinct contract surface. The two protocols are never
  fused.
- **Not registrable without a declared contract**: a registration must
  declare inputs, outputs, fidelity, a validity domain with at least one
  included scope, at least one assumption, reproducibility, cost, and
  latency (architecture.md, "Simulation / Evaluation").

## Reconciliation notes (architecture questions)

- `entity-reference` parameter kind: the entity reference *format* is
  owned by the canonical World Model (W002).
- The registration's `registrationDigest` binding assumes registrars
  retain admitted registrations by digest; the capability registry that
  makes this lookup durable is W007.
- Tenancy/identity scoping of `simulatorId` is owned by W009.
- Execution, scheduling, retries, and resource accounting for runs are
  owned by the simulation execution fabric (W021).
