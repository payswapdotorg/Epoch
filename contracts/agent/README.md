# contracts/agent — Epoch Agent Protocol contract surface

Owned by Work Order **W003** (`packages/agent-protocol/*`,
`packages/action-protocol/*`, `contracts/agent/*`, `contracts/actions/*`).
Kernel layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Agent Protocol v1** at its ownership boundary. The
runtime implementation is `@epoch/agent-protocol` (kernel layer); consumers
in later Work Orders (W007 adapter SDK, W010 event/replay, W011 experience
protocol, W020 agent runtime, W022 action gateway) program against the
shapes published here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/agent-protocol`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, message kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderAgentContractFiles()` in `@epoch/agent-protocol`. |

## Versioning

- `protocolVersion` (`"1.0.0"`) is carried by every message and validated
  exactly — a differing version is a typed `version-mismatch` admission
  error, never a silent parse. Tolerance for compatible minor/patch versions
  is deliberately *not* implemented in v1 (see Limitations in the W003 PR).
- `contractVersion` (`"1.0.0"`) versions this published surface. The two are
  currently in lockstep; they may diverge when a contract release re-exports
  unchanged protocol types.
- Breaking changes to any published type require a protocol major version
  bump; additions may ride a contract minor bump. The manifest inventory
  makes the published set machine-checkable.

## Determinism and evidence addressing

Admitted messages serialize to a canonical JSON form (sorted keys, no
whitespace, ECMAScript number serialization; see
`packages/agent-protocol/src/canonical.ts`) whose SHA-256 digest addresses
the exact revision of the message. The manifest applies the same discipline
to the contract artifacts themselves: every schema file's digest is recorded,
and a drift test proves the committed artifacts are byte-identical to what
the implementation emits.

Canonical-form deviations from RFC 8785 (JCS), both immaterial for the
protocol's ASCII identifier vocabulary: UTF-16 code-unit key ordering
instead of UTF-8 code-point ordering, and lone-surrogate escaping instead of
rejection.

## JSON Schema fidelity

The schema files are a **structural-only** projection (`jsonSchemaFidelity`
in `manifest.json`). Zod refinements — cross-field invariants such as
"p95 ≥ p50", "enumValues iff kind is enum", "unique capability ids", and the
calendar validity of timestamps — are enforced by the runtime validators in
`@epoch/agent-protocol` and are intentionally absent from the JSON Schema
files (they are not expressible without duplicating policy into the
published schemas). Consumers MUST validate messages with the runtime
package; the JSON Schema files describe the wire shapes for tooling and
documentation.

## Authority and neutrality (architecture lock rules 2/3, 13)

- Agents **propose**; only the Action Gateway authorizes and executes. The
  registration's `authority.executionAuthority` is a literal that admits
  exactly `"none"` — execution authority for agents is structurally
  inexpressible in this protocol.
- The surface is provider-neutral: a human, a deterministic solver, and an
  LLM-backed agent are all representable (`executor.kind` ∈
  `human | program | model | hybrid`), and no vendor/framework vocabulary
  exists anywhere in the published types or schemas (enforced by tests).
  Frameworks and model gateways are adapters behind this protocol.

## Reconciliation notes (architecture questions)

`contracts/agent` is self-contained by design. The following references are
minimal and additive, pending the surfaces owned by concurrently running or
later Work Orders (recorded as architecture questions in the W003 PR):

- `entity-reference` parameter kind: the entity reference *format* is owned
  by the canonical World Model (W002, in flight at dispatch time).
- `requiredArtifactKinds` slug vocabulary: evidence artifact semantics are
  owned by the evidence domain (W006).
- Tenancy/identity scoping of `agentId` is owned by W009.
