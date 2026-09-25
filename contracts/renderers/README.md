# contracts/renderers — Epoch Renderer Runtime published contracts (W013)

The versioned, provider-neutral contract surface of the Renderer Runtime
hosting boundary (Work Order W013; implementation: `@epoch/renderer-runtime`
in the experience layer).

Contents (the W002-W004 shared-contracts convention):

- `index.d.ts` — self-contained TypeScript declarations (no imports, no
  runtime code, no vendor/engine/framework vocabulary). Mirrored shared
  primitives are redeclared here exactly as `contracts/experience`
  mirrors `contracts/agent` shapes; canonical homes are noted inline.
- `parity.ts` — compile-time conformance assertions proving the
  implementation's zod-inferred types are identical to the declarations.
  Compiled by `packages/renderer-runtime/tsconfig.contracts.json` as part
  of `pnpm typecheck`. Verification-only; no runtime dependency.
- `manifest.json` — the contract inventory: version, data types, document
  kinds, JSON-Schema fidelity note, and SHA-256 digests of every emitted
  schema file.
- `schemas/*.schema.json` — the committed JSON Schema projection (draft
  2020-12) of every surface type, emitted deterministically by
  `renderRendererContractFiles()` in `@epoch/renderer-runtime`.

Regeneration (only through the documented update mode, so committed
artifacts can never drift silently from the implementation schemas):

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/renderer-runtime test contract-drift
```

NOT a pnpm workspace package: consumed via TypeScript declarations and the
JSON Schema documents; the runtime validators live in
`@epoch/renderer-runtime` (see `packages/renderer-runtime/src/index.ts`).

Authority: the renderer runtime EXECUTES render-ready typed structures (W011
Experience Graphs, referenced by content digest); it is never semantic
authority (architecture lock rule 8). Provider neutrality is structural
(lock rule 13): abstract renderer descriptors (kind, capabilities,
budgets) — concrete engines are future adapters behind this contract.
