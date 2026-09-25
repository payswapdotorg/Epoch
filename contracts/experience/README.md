# contracts/experience — Epoch Experience Protocol contract surface

Owned by Work Order **W011** (`packages/experience-protocol/*`,
`contracts/experience/*`). Experience layer (the first experience-layer
package in the workspace).

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Experience Protocol v1** at its ownership boundary:
the Experience Graph envelope (a READ PROJECTION of kernel state — never a
second source of truth, architecture lock rule 8), the tenant-scoped
projection request, and the abstract device-descriptor slot that W019
(Renderer/Device Adaptation) fills. The runtime implementation is
`@epoch/experience-protocol`; this contract defines only the typed shapes —
no rendering, no compilation, no orchestration lives here (those are W012
Experience Compiler and W013 Renderer Runtime).

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no vendor/engine vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/experience-protocol`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, document kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderExperienceContractFiles()` in `@epoch/experience-protocol`. |

## Authority split (architecture lock rules 8/16)

The Experience Graph is a **projection, never authority**. The split is
encoded structurally:

- kernel state is addressed ONLY through `ProjectedReference` values —
  opaque, tenant-scoped, and bound to the exact revision via the SHA-256
  digest of the referenced kernel object's canonical JSON. Embedding a
  kernel object as an unknown field is **structurally inexpressible**
  (strict objects reject it as `malformed-descriptor`);
- the one open record (`attributes` on nodes and edges) is
  presentation-only: the admission pipeline scans it for kernel-reserved
  keys (the world-model/assertion/authority vocabulary — see
  `KERNEL_RESERVED_ATTRIBUTE_KEYS` in the implementation) and rejects the
  document with a typed `authority-violation` error. Inline world state
  instead of references is REJECTED, first-class;
- the envelope carries no mutation surface, no query language, and no
  semantic vocabulary — a graph cannot state truth, only present it;
- Experience Graph envelopes are content-addressed: the `digest` is the
  SHA-256 of the canonical JSON of the content (digest field excluded);
  admission rejects a claimed digest that does not match (tamper
  detection).

## Tenant isolation (R12)

Every projected reference carries its owning `tenantId`, and every
document carries a `tenantScope`. The admission pipeline rejects:

- a document admitted for a different expected tenant;
- any reference (projection input or node reference) whose tenant differs
  from the document's scope — with a typed `cross-tenant-denied` error
  carrying expected and encountered tenant ids and a precise path.

## Provider neutrality (lock rule 13)

No vendor, engine, renderer, framework, or API vocabulary exists in these
types: the device slot is abstract typed capability/limit data (device
classes, interaction modalities, pose-tracking classes, display/spatial
budgets); 3D primitives are neutral mathematical shapes; mesh assets are
content-addressed opaque bindings (no filenames, URLs, or engine formats).
A blocklist test fails the build if any vendor/engine token appears in the
published artifacts. Concrete renderers and engine integrations are future
adapters (W013/W019) behind the capability fabric.

## Versioning

`protocolVersion` (`"1.0.0"`) is carried by every document and validated
exactly — a differing version is a typed `version-unsupported` admission
error, never a silent parse. `contractVersion` (`"1.0.0"`) versions this
published surface. See `contracts/agent/README.md` for the shared policy;
the experience-protocol version evolves independently.

## Mirrored shared primitives

`JsonValue` is redeclared here so this directory is a self-contained
published artifact; its canonical home is `contracts/agent` (W003), and the
parity assertion verifies the mirror against the implementation (which
imports it from `@epoch/agent-protocol`).

## JSON Schema fidelity and determinism

Structural-only projection; runtime refinements (canonical ordering of
nodes/edges/references, keyframe time-ordering, graph-kind/node-kind
pairing, mesh/selector conditionals, digest verification, tenant checks,
authority scans) are enforced by `@epoch/experience-protocol`. The
committed artifacts are byte-identical to the deterministic emission
(`test/contract-drift.test.ts`); regeneration is only possible through the
documented update mode:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-protocol test contract-drift

## Reconciliation notes (architecture questions)

- The `evidence-record` and `capability` reference kinds are pinned by
  devDependency parity tests against `@epoch/evidence` (W006) and
  `@epoch/capability-registry` (W007) — no runtime dependency, per the
  W011 Tech Lead pin.
- `ControlIntent` is structurally identical to the action-protocol
  `ActionTypeReference` (W003) so control-to-proposal wiring through the
  Action Gateway (lock rule 3) needs no translation layer.
- Tenancy/identity semantics of the opaque `tenantId`/participant ids are
  owned by W009; the experience protocol treats them as opaque strings and
  enforces isolation by equality.
- How the Experience Runtime (W012/W013) resolves projected references
  against live kernel state — including whether the resolver consumes
  world snapshots by digest — is the compiler Work Order's design space.
