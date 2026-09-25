# @epoch/tenancy

Epoch Tenancy kernel (**Work Order W009**): the typed, provider-neutral
tenancy hierarchy `Platform -> Tenant -> Workspace -> Project ->
World/Scenario/Evidence` as opaque-id references, with deterministic
in-memory create/resolve/validate machinery, cycle and hierarchy-escape
rejection, tenant isolation checks, and content-addressed node records.

## Scope (frozen architecture)

- The hierarchy is FROZEN by `spec/architecture.md` ("Tenancy", binding):
  `Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence`.
  The kind vocabulary and the legal parent-kind table encode exactly that
  structure; nothing else is a tenancy node kind.
- **Identity != tenancy != authorization != policy** (architecture lock
  rule 12): this package owns the containment hierarchy ONLY. Principals
  live in `@epoch/identity`, authorization decisions in
  `@epoch/authorization`, policy semantics in `@epoch/policy-contracts`
  (W004). The three W009 packages cohere through HOST WIRING (W014+ /
  W022), never runtime dependencies — compatibility is pinned by
  devDependency parity tests in the consuming packages.
- **Opaque-id references** (the W002/W003 house pattern): a workspace
  references its tenant by typed id (`tenant:acme`) — never by embedding
  tenant objects. The id prefix encodes the kind; ids are the single
  source of node identity.
- **Tenant isolation is a security boundary (R12)**: cross-tenant
  references (`assertSameTenant`), hierarchy escapes (illegal parent
  kinds, second platform root), and traversals without membership
  (`assertAncestorOf`) are typed, named, tested rejections.
- **Provider neutrality (lock rule 13)**: strict objects reject unknown
  (vendor) fields; every identifier is opaque.
- **Reference in-memory directory**: no persistence, no events, no
  authorization logic, no clocks. Records are plain, serialization-
  friendly JSON; iteration is always sorted (no insertion-order leaks);
  every entry point is total (typed errors, never thrown).

## Model

- `TenancyNode` — `{ schemaVersion, id, kind, parentId, displayName? }`:
  the immutable hierarchy node. `parentId` is `null` if and only if the
  kind is `platform` (exactly one root per directory).
- `TenancyMembership` — the resolved containment of a node: platform,
  tenant, workspace, and project ids (levels below the node's own level
  are absent). The shape hosts use to scope authorization requests.
- `TenancyDirectory` — create (`createPlatform` then `createNode`),
  resolve (`get`, `ancestryOf`, `resolveMembership`, `tenantOf`),
  isolation checks (`assertSameTenant`, `contains`, `assertAncestorOf`),
  deterministic listing (`list`, `childrenOf`), and `snapshot()` /
  `restore()` / `restoreSealed()` round-trips.
- Legal attachments: `tenant -> platform`, `workspace -> tenant`,
  `project -> workspace`, `world|scenario|evidence -> project`. Anything
  else (e.g. a workspace under the platform root) is a `hierarchy-escape`.

## Integrity (tamper detection)

Node records are content-addressed: `{ node, digest }` sealed records
carry the SHA-256 of the node's canonical JSON
(`computeTenancyNodeDigest` / `sealTenancyNode`).
`restoreSealed` and `parseSealedTenancyNode` recompute the digest and
reject mismatches with a typed `digest-mismatch` error — a record whose
claimed digest does not match its content never enters the directory.

## Error taxonomy

Typed, categorized, precise paths (values, never thrown): `validation`,
`unknown-node`, `unknown-parent`, `duplicate-node`, `hierarchy-escape`,
`cycle`, `cross-tenant-reference`, `digest-mismatch`.

Cycle discipline: `createNode` can never produce a cycle (parents must
already exist and are immutable), but bulk ingest of serialized state
can — `restore`/`restoreSealed` walk every parent chain with a
visited-set and reject loops with a typed `cycle` error naming the loop;
`ancestryOf` carries the same defensive guard so corrupted state fails
closed instead of looping.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` (W007) and
`@epoch/extension-sdk` (W008): version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/tenancy test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared pattern conventions) and `zod` (frozen
catalog). Dev/test only: the workspace toolchain. Other kernels pin
compatibility with this package via devDependencies + parity tests — no
runtime coupling in either direction.
