# Epoch World Contracts (`contracts/world`)

Published, versioned contract surface for the **Canonical World Model** (Work
Order W002, layer `contracts`). This directory is the ownership boundary
between the world model and every other Epoch subsystem (agents, actions,
constraints, simulation, evaluation, verification, experience).

## Contents

- `src/` — the **TypeScript declaration surface**: types only, zero runtime
  code, zero dependencies, zero imports outside this directory. Every file
  exports types exclusively (`import type` / `export type`).
- `schemas/` — **JSON Schema (draft 2020-12) documents** for the core types,
  generated from the runtime zod validators in `packages/world-model` and
  kept in sync by a contract-sync test (see below).

## Versioning

- The contract version lives in `src/version.ts` as the literal type
  `WorldContractsVersion` (currently `1.0.0`) and is mirrored by the
  `version` field of this package manifest.
- Every serialized form (see `WorldSnapshot`) carries an explicit
  `schema: 'epoch.world-model'` discriminator plus the contract `version`.
- Bumping the version is a contract change: the kernel constant
  `WORLD_CONTRACTS_VERSION` (typed as `WorldContractsVersion`) fails to
  compile until it is updated, the JSON Schema `$id`s embed the version, and
  `WorldModel.fromSnapshot` rejects snapshots whose version does not match.

## How this surface is consumed (W001-shipped workspace conventions)

`contracts/*` is intentionally **not** a pnpm workspace glob — the root
`pnpm-workspace.yaml` is frozen (see `scripts/DEPENDENCY-BASELINE.md`), and
relative imports may not escape a workspace package root (enforced by
`scripts/boundary-check.mjs`). The shipped convention is therefore:

1. `packages/world-model/tsconfig.json` declares a path mapping
   `"@epoch/world-contracts" -> "../../contracts/world/src/index.ts"`, so the
   declaration surface is type-checked as part of the kernel package's
   `tsc --noEmit` program.
2. `packages/world-model` (layer `kernel`) imports the contract types with
   `import type` / re-exports them with `export type * from
   '@epoch/world-contracts'`. Because the surface is types-only, these
   imports are fully erased at runtime — no bundler alias is ever needed.
3. All downstream workspace packages consume the contracts through the
   `@epoch/world-model` workspace package (`workspace:*` protocol) and get
   both the contract types and the runtime validators from one place.

## JSON Schema sync guarantee

`schemas/*.schema.json` are exact `z.toJSONSchema()` conversions of the zod
validators in `packages/world-model/src/schema`. The test
`packages/world-model/test/contracts-sync.test.ts` fails on any drift
between the published documents, the zod validators, the contract version,
and this manifest — the published schemas can never silently diverge from
the runtime validation behavior.

## Authority notes

This surface expresses the frozen architecture rules (spec/architecture-lock.md):

- the World Model is the **semantic authority**; assertions (not bare
  writes) are the unit of stated truth and always carry provenance,
  confidence and validity;
- external standards map **into** the model (`ExternalMapping`); no
  provider semantics exist in these types;
- history is never silently discarded — snapshots carry the full assertion
  and event history.
