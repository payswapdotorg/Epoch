# contracts/renderers — Epoch Renderer Runtime published contracts (W013)

The versioned, provider-neutral contract surface of the Renderer Runtime
hosting boundary (Work Order W013; implementation: `@epoch/renderer-runtime`
in the experience layer).

**Contract version: 1.2.0** (W065/ACR-010 bumped 1.1.0 → 1.2.0 ADDITIVELY —
see "The v1.2.0 additive operation layer" below; protocolVersion and
fabricProtocolVersion are UNCHANGED at 1.0.0).

Contents (the W002-W004 shared-contracts convention):

- `index.d.ts` — self-contained TypeScript declarations (no imports, no
  runtime code, no vendor/engine/framework vocabulary). Mirrored shared
  primitives are redeclared here exactly as `contracts/experience`
  mirrors `contracts/agent` shapes; canonical homes are noted inline.
  This file is the UNCHANGED v1.1.0 declaration surface.
- `fabric-operations.d.ts` — the v1.2.0 ADDITIVE operation layer (W065):
  the typed fabric-level `bindSessionAsset` operation input, the
  applied/declined outcome, and the content-addressed, tenant-scoped
  `RendererAssetBindingReceipt`. It imports the frozen v1.1.0 base
  declarations from `./index` (it references those documents verbatim)
  instead of duplicating them, so the additive layer can never drift from
  the base it builds on. Implemented by `@epoch/renderer-fabric` (the
  orchestration layer — a fabric-level operation, deliberately not part
  of the runtime's emitted schema surface).
- `parity.ts` — compile-time conformance assertions proving the
  implementation's zod-inferred types are identical to the declarations:
  the v1.1.0 surface against `@epoch/renderer-runtime`, and the v1.2.0
  operation surface (fabric-operations.d.ts) against
  `@epoch/renderer-fabric`'s public API. Compiled by
  `packages/renderer-runtime/tsconfig.contracts.json` as part of
  `pnpm typecheck`. Verification-only; no runtime dependency.
- `manifest.json` — the contract inventory: version, data types, document
  kinds, JSON-Schema fidelity note, and SHA-256 digests of every emitted
  schema file. At v1.2.0 the emitted schema surface is byte-identical to
  the v1.1.0 emission — only the contractVersion moved.
- `schemas/*.schema.json` — the committed JSON Schema projection (draft
  2020-12) of every surface type, emitted deterministically by
  `renderRendererContractFiles()` in `@epoch/renderer-runtime`.

## The v1.2.0 additive operation layer (W065, ACR-010)

The fabric gains `bindSessionAsset(input: { sessionId, binding, atMs }) →
FabricResult<RendererAssetBindingReceipt>` — a fabric-level orchestration
that composes the EXISTING, UNCHANGED optional adapter-seam `bindAsset`:
session resolution → sealed-record validation + tenant-scope verification →
adapter capability/asset-kind check → seam application → a typed,
digest-addressed (the sealed binding's digest), tenant-scoped receipt
carrying the adapter's rendererId and the applied/declined outcome. Every
failure path is a typed refusal (unknown session, undeclared asset kind,
tenant-scope mismatch, adapter refusal — propagated verbatim — and the
absent optional seam); there is no partial application on refusal, and the
receipt is evidence, never authority (an asset binding is presentation).

Frozen-contract discipline: additive only. Nothing in the v1.1.0 surface
is renamed, narrowed, or moved; the v1.1.0 emitted artifacts (manifest
dataTypes, schemas/*, index.d.ts) are byte-identical at v1.2.0 except the
manifest's contractVersion line; the adapter seam is UNCHANGED (adapters
implement nothing new — a v1.2.0 fabric honors every v1.1.0 adapter
additively, and adapter capability manifests keep declaring the v1.1.0
seam version they implement).

Regeneration (only through the documented update mode, so committed
artifacts can never drift silently from the implementation schemas):

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-runtime test contract-drift
```

NOT a pnpm workspace package: consumed via TypeScript declarations and the
JSON Schema documents; the runtime validators live in
`@epoch/renderer-runtime` (see `packages/renderer-runtime/src/index.ts`),
and the v1.2.0 operation surface is implemented by
`@epoch/renderer-fabric` (see
`packages/renderer-fabric/src/session-asset-binding.ts`).

Authority: the renderer runtime EXECUTES render-ready typed structures (W011
Experience Graphs, referenced by content digest); it is never semantic
authority (architecture lock rule 8). Provider neutrality is structural
(lock rule 13): abstract renderer descriptors (kind, capabilities,
budgets) — concrete engines are future adapters behind this contract.
