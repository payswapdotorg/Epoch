# contracts/access-projection

The public core-record contract surface of the Access Projection kernel
(Work Order W041, the W012 declaration-only convention).

## Contents

- `index.d.ts` — the versioned, self-contained TypeScript declarations
  (no imports, no runtime code, no vendor vocabulary): the closed
  vocabularies (actions, object classes, principal kinds, scope modes,
  redaction classes, event discriminators), the opaque id grammars, the
  projection-policy record family (policy is DATA), task projection
  contexts, authorized projections with released fields and typed
  redaction markers, the sealed projection-audit records, and the
  access-projection events over the W010 shapes.
- `parity.ts` — compile-time conformance assertions: strict type
  identity (`Equals`) between every published declaration and the
  zod-inferred implementation type. Compiled by
  `packages/access-projection`'s `typecheck` script
  (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
- `schemas/` + `manifest.json` — the JSON Schema projection emitted by
  `renderAccessProjectionPublicContractFiles()` in `@epoch/access-projection`
  (draft 2020-12, `$id: urn:epoch:access-projection:<type>:1.0.0`,
  SHA-256 per file). Regenerate only via:
  `EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/access-projection test contract-drift`.

## Authority split (USL1.0 / architecture lock rules 12 + 16)

The authorization DECISION is `@epoch/authorization`'s (W009); the
canonical records are `@epoch/solution-delivery`'s (W036); tenancy is
`@epoch/tenancy`'s. This surface is the least-privilege PROJECTION
layer: it consumes sealed decisions and canonical records opaquely and
never re-implements them.

## Curation note

The `CanonicalRecord` union (objectClass-tagged sealed W036 records)
stays on the IN-PACKAGE full surface
(`packages/access-projection/schemas`): it embeds the W036 record
shapes, which downstream consumers bind to via
`contracts/solution-delivery`, not via re-declaration here. Every type
in this tree references canonical state only through opaque ids and
exact-revision digests (the W011 projected-reference convention,
mirrored — the boundary rules forbid kernel->experience edges).
