# @epoch/authorization

Epoch Authorization kernel (**Work Order W009**): the typed DECISION
POINT — not a policy engine — over opaque principal/tenant/resource ids.
Requests in, deterministic decisions out: allow / deny / not-applicable
with typed reasons and exact evidence paths.

## Scope (frozen architecture)

- **Identity != tenancy != authorization != policy** (lock rule 12):
  authorization owns DECISIONS. Policy semantics are
  `@epoch/policy-contracts`' (W004) — this package never evaluates
  constraints. Shape compatibility with W004 is pinned via
  devDependencies + parity tests (`test/w004-parity.*`), the
  kernel-to-kernel devDep precedent (W002, W006, W007, W008) — NO
  runtime coupling.
- **Fail-closed**: unknown principals and unknown tenants are DENIED
  with typed codes, never error-open. Cross-tenant access is denied BY
  CONSTRUCTION (R12 — the tenant isolation boundary): the evaluator
  demands a covering membership in the resource's tenant before anything
  else can allow.
- **Facts, not lookups**: the decision context (principal facts,
  membership facts, known tenants) is caller-supplied typed data — the
  host (Action Gateway, W022) projects it from `@epoch/identity` and
  `@epoch/tenancy` records. This package never calls into them at
  runtime; `test/composite.test.ts` wires all three packages end-to-end
  (test-only) to prove the composition.
- **Provider neutrality** (lock rule 13): every identifier is opaque;
  strict objects reject unknown (vendor) fields; no role/permission
  vendor vocabulary is declared anywhere in the surface.

## Model

- `AuthorizationRequest` — `schemaVersion`, `principalId`, opaque
  `actionKind`, and a `ResourceReference` (opaque `resourceType`/
  `resourceId` plus the optional tenant/workspace/project scope). The
  scope chain must be complete (a workspace requires a tenant; a project
  requires a workspace). A resource without a tenant is platform-scoped.
- `PrincipalFact` — caller-supplied: principal id, status (mirrors
  identity), authenticated.
- `MembershipFact` — caller-supplied tenancy membership: tenant-wide
  (`{tenantId}`), workspace-wide (`+ workspaceId`), or project-scoped
  (`+ projectId`). Containment semantics mirror `@epoch/tenancy`.
- `AuthorizationContext` — the three fact lists; duplicate principal
  facts and factless memberships are rejected (validation), exact
  duplicate memberships are deduplicated.
- `AuthorizationDecision` — discriminated union:
  - **allow** — typed reasons (`covering-membership`,
    `active-principal`, `authenticated-principal`) + evidence paths;
  - **deny** — exactly one typed denial + evidence paths;
  - **not-applicable** — `resource-not-tenant-scoped` (platform-scope is
    a different authority; neither allow nor deny is asserted).
  Every decision carries the `requestDigest` — the SHA-256 of the exact
  request revision's canonical JSON — and is itself content-addressed.

## Denial taxonomy

`unknown-principal`, `unknown-tenant`, `cross-tenant-denied` (R12),
`cross-workspace-denied`, `cross-project-denied` (hierarchy traversal
without membership), `inactive-principal`, `unauthenticated-principal`.
Errors (malformed inputs) are separate: `validation`,
`digest-mismatch`.

## Determinism

The evaluator canonicalizes the context before matching (principals
sorted; memberships deduplicated + sorted; known tenants deduplicated +
sorted), so two contexts that differ only in ARRAY ORDER produce
byte-identical decisions. No clocks, no randomness.

## Integrity (tamper detection)

Decisions are sealed: `{ decision, digest }` where `digest` is the
SHA-256 of the decision's canonical JSON
(`computeAuthorizationDecisionDigest` / `sealAuthorizationDecision`);
`parseSealedAuthorizationDecision` recomputes and rejects mismatches
with a typed `digest-mismatch` error.

## W004 parity

`toPolicyTarget(request)` projects a request onto the policy-target
shape; the projection type is compile-time `Equals` to
`@epoch/policy-contracts`' `PolicyTarget` (`test/w004-parity.types.ts`),
the frozen validator accepts every projection (`test/w004-parity.test.ts`),
and scope matching agrees with the isolation semantics. The mirrored
tenant/workspace/project/principal id patterns and the principal-status
vocabulary are pinned identical to `@epoch/tenancy` / `@epoch/identity`.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` / `@epoch/verification` /
`@epoch/evidence`: version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/authorization test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` (the only @epoch runtime dependency —
canonical JSON, SHA-256, shared patterns) and `zod` (frozen catalog).
Dev/test only: the workspace toolchain plus `@epoch/policy-contracts`,
`@epoch/tenancy`, `@epoch/identity` (parity + composite tests — no
runtime coupling in any direction).
