# @epoch/access-projection

The Epoch **Access Projection** kernel (Work Order W041): least-privilege
projections over the canonical W036 solution/delivery state.

## What this kernel owns

- **Projection POLICY as data** — typed, versioned, sealed
  `ProjectionPolicy` records bind `(principal role OR agent-task class) x
  object class -> allowed actions -> minimum-necessary field allowlist ->
  evidence/commercial/supplier scope filters -> redaction rules`.
  Swapping a policy revision changes the projection with **zero code
  change** (the `policy-as-data` fixture proves it).
- **Two-stage evaluation, strictly ordered** — stage 1 consumes a prior
  **W009 authorization decision** (sealed, digest-verified, bound to the
  exact request; `authorization-bypass-rejected` without one — the
  decision point is never re-implemented here); stage 2 computes the
  visible subset.
- **Minimum-necessary field selection** — a zod-schema-driven field walk
  over the W036 record shapes. Released fields pass through **by
  reference** (same value, same digest); everything else becomes a typed
  `RedactionMarker` (field path + policy clause + redaction class).
  Fields are never silently dropped.
- **Scoping** — evidence scopes (which W006 evidence digests are
  visible), commercial scopes (cost fields) and supplier scopes
  (commitment visibility), each a typed filter applied **after** the
  field walk.
- **Agent task-specific projections** — a `TaskProjectionContext`
  narrows a projection to the task's object scope; task rows are
  narrower than the role baseline, never wider
  (`task-escalation-rejected`).
- **Export/share rulings** — export and share are distinct actions with
  their own policy rows (`export-without-grant-rejected`,
  `share-without-grant-rejected`). Service principals follow the same
  two-stage path as humans.
- **Stable semantic identity** — a projection carries the SAME record id
  and content digest as the canonical record; projections never mint
  identities (`identity-fork-rejected`).
- **Auditability** — every projection decision (released or denied)
  emits a sealed, content-addressed `ProjectionAuditRecord` with the
  evaluation-key replay discipline (identical inputs -> identical
  digests; duplicate evaluation = the sealed prior audit record).
- **Events** — the `access-projection:*` vocabulary over the W010 event
  shapes (one object/policy/tenant-state = one stream).

## Authority split (USL1.0 / architecture lock rule 12)

Identity != tenancy != authorization != policy. The decision point is
`@epoch/authorization` (W009); the canonical records are
`@epoch/solution-delivery` (W036); tenancy scoping is `@epoch/tenancy`.
This kernel **consumes** them; it never re-implements them, and it never
creates a second lifecycle/baseline/schedule/delivery authority.

## Runtime dependency policy (frozen)

Runtime: `@epoch/authorization`, `@epoch/solution-delivery`,
`@epoch/agent-protocol`, `@epoch/tenancy`, `zod` — nothing else.
Parity devDependencies: `@epoch/event-log`, `@epoch/evidence`,
`@epoch/identity` (+ `@epoch/tsconfig`, `@epoch/eslint-config`,
`vitest`, `typescript`), pinned by `src/kernel-parity.ts` (compile-time)
and `test/parity.test.ts` (runtime: the same fixtures seal through the
REAL W010 `sealEvent` and digest identically).

> The dispatch pin also listed `@epoch/experience-protocol` as a parity
> devDependency; it is layer `experience`, and the boundary rules forbid
> kernel->experience edges even as devDependencies. The W011
> projected-reference convention (kind + tenant scope + exact-revision
> digest) is therefore **mirrored** (see `src/kernel-parity.ts`) instead
> of imported. See the PR's architecture questions.

## Contract surfaces

- `packages/access-projection/schemas/` — the in-package full JSON
  Schema projection (the W006/W007/W009/W023/W036 convention).
- `contracts/access-projection/` — the public core-record surface (the
  W012 convention): self-contained `index.d.ts` + `parity.ts` +
  `schemas/` + `manifest.json`.

Both are drift-pinned byte-for-byte by `test/contract-drift.test.ts`;
regenerate only via:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/access-projection test contract-drift

## Determinism

Zero wall-clock reads, zero randomness, zero I/O — every instant is
caller-supplied; every listing/snapshot is sorted. Two evaluations with
identical inputs produce byte-identical sealed records.
