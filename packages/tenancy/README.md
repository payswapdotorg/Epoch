# @epoch/tenancy

Epoch Tenancy kernel (**Work Order W009**): the Platform -> Tenant ->
Workspace -> Project -> World/Scenario/Evidence containment hierarchy as
typed **opaque-id references** — never embedded objects — with
deterministic create/resolve/validate machinery, cycle prevention,
hierarchy-escape rejection, cross-tenant move rejection, and
digest-checked record admission.

## Scope (frozen architecture)

- The hierarchy is EXACTLY (architecture.md, "Tenancy", binding):
  `platform -> tenant -> workspace -> project -> {world, scenario,
  evidence}` — seven node kinds with a typed containment table
  (`TENANCY_PARENT_KINDS`). A workspace references its tenant by opaque
  typed id (`tenant:acme`), never by embedding the tenant object.
- **Identity != tenancy != authorization != policy** (lock rule 12):
  tenancy owns the CONTAINER HIERARCHY only. Principals are
  `@epoch/identity`'s authority, decisions are `@epoch/authorization`'s,
  policy semantics are `@epoch/policy-contracts`'. Tenancy never
  interprets principals and never decides.
- **Tenant isolation is a security boundary** (R12): reparenting a node
  across tenants is rejected with the typed `cross-tenant-reference`
  error.
- **Provider neutrality** (lock rule 13): every identifier is an opaque
  kind-prefixed slug; strict objects reject unknown (vendor/deployment)
  fields.
- **Reference in-memory hierarchy**: no persistence, no event log, no
  UI, no clocks. Records are plain, serialization-friendly JSON;
  iteration is always sorted (no insertion-order leaks).

## Model

- `TenancyNode` — the immutable, digested content: `schemaVersion`,
  kind-prefixed `nodeId`, `kind`, `displayName`, optional `description`,
  and the parent's opaque id (`null` only for the platform root).
- `TenancyNodeRecord` — the published record: node content + the SHA-256
  `nodeDigest` of its canonical JSON (the exact-revision address).
- `TenancySnapshot` — deterministic hierarchy projection: records sorted
  by node id ascending; two hierarchies with the same nodes emit
  byte-identical snapshots regardless of creation order.
- Resolution: `pathToRoot` (containment chain), `tenantOf` (owning
  tenant; platform yields `null`), `isWithin` (membership), `childrenOf`
  (sorted), `listNodes` (sorted, optional kind filter).
- Reparenting: `moveNode` within the containment table and within one
  tenant, re-sealing the record with the digest of its new content.

## Error taxonomy

Typed, categorized (values, never thrown): `validation` (malformed ids,
vendor fields), `unknown-node`, `unknown-parent`, `duplicate-node`,
`illegal-parent-kind` (containment-table violation — levels can never be
skipped), `cycle` (parent-link loops, incl. reparenting under a node's
own subtree), `hierarchy-escape` (anything that is not a single-rooted
platform tree: parentless non-platform, parented platform, second root),
`cross-tenant-reference` (R12 isolation boundary), `digest-mismatch`
(tamper detection).

## Integrity (tamper detection)

Node admission is sealed: `{ node, digest }` where `digest` is the SHA-256
of the node content's canonical JSON (`computeTenancyNodeDigest` /
`sealTenancyNode`). `createNode`, `parseTenancyNodeRecord`, and
`parseTenancySnapshot` recompute the digest and reject mismatches with a
typed `digest-mismatch` error — a node whose digest does not match its
content never enters the hierarchy. `TenancyHierarchy.fromSnapshot`
additionally runs the full semantic pipeline (duplicates, single root,
dangling parents, cycles, containment table) atomically.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` / `@epoch/verification` /
`@epoch/evidence`: version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/tenancy test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared patterns) and `zod` (frozen catalog).
Dev/test only: the workspace toolchain. `@epoch/authorization` pins
compatibility with this package's id patterns and kind vocabulary via
devDependencies + parity tests — no runtime coupling in either direction.
