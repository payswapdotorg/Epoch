# @epoch/authorization

Epoch Authorization kernel (**Work Order W009**): the typed decision
point over opaque principal/tenant/resource ids — authorization
requests (principal + tenant scope + resource reference + action),
decisions (allow/deny/not-applicable with typed reasons and exact
evidence paths), fail-closed tenant isolation, and content-addressed
decision records.

## Scope (frozen architecture)

- **A decision point, NOT a policy engine** (architecture direction,
  binding): policy semantics stay in W004 (`@epoch/policy-contracts`);
  this package owns the typed request/decision contracts and the
  fail-closed decision pipeline. Policy evaluation is host-wired behind
  the `AuthorizationFacts` interface — the W022 Action Gateway / W014
  app shell wire identity, tenancy, and policy behind it.
- **Runtime dependency policy**: `@epoch/agent-protocol` is the ONLY
  @epoch runtime dependency (canonical JSON, SHA-256, shared
  MessageId/Timestamp validators, pattern conventions). Compatibility
  with `@epoch/policy-contracts` (the W004 policy-target shape),
  `@epoch/tenancy` (tenant id space), `@epoch/identity` (principal id
  space), `@epoch/action-protocol` (authority-scope action kinds,
  opaque PrincipalReference ids), and `@epoch/evidence`
  (exact-revision evidence paths) is pinned via devDependencies +
  parity tests (`test/parity.test.ts`) — zero runtime coupling in
  either direction (the kernel-to-kernel devDep precedent: W002, W006,
  W007, W008).
- **Tenant isolation is a security boundary (R12)**: cross-tenant
  authorization is DENIED with a typed `cross-tenant-denied` error BY
  CONSTRUCTION — a principal that is not a member of the request's
  tenant scope has no code path to an allow.
- **Provider neutrality (lock rule 13)**: strict objects reject unknown
  (vendor/provider) fields; every id is opaque.
- **Fail-closed**: a decision point wired without a policy source fails
  every request with a typed `not-applicable` error (no authorization
  granted); a policy evaluation that fails surfaces a typed
  `evaluation-failed` error — never a silent allow.

## Model

- `AuthorizationRequest` — `{ schemaVersion, requestId, principalId,
  tenantId, resource: { resourceType, resourceId }, actionKind,
  context?, requestedAt? }`: the exact-revision evidence anchor of a
  decision. The tenant scope is ALWAYS the explicit `tenantId` field.
- `AuthorizationFacts` — the host wiring seam:
  `resolvePrincipal` (unknown, or member tenants + authentication
  evidence paths), `resolveTenant` (known/unknown), and an OPTIONAL
  `evaluatePolicy` (allow/deny/not-applicable/failed with policy-side
  reasons and evidence paths).
- `AuthorizationDecisionPoint` — `decide(request, options?)` runs the
  fixed pipeline: validation -> principal -> tenant -> tenant isolation
  -> policy evaluation -> content-addressed record. Deterministic: no
  clocks, no randomness; the optional `decidedAt` is caller-supplied.
- `projectPolicyTarget(request)` — the W004-compatible policy-target
  projection (tenantId/workspaceId/projectId/actionKind/resourceType/
  tags): exactly what `@epoch/policy-contracts` policy targets admit.
- `AuthorizationDecision` — `{ outcome, requestId, principalId,
  tenantId, resource, actionKind, reasons, evidencePaths, decidedAt? }`
  with typed reasons (principal-verified, tenant-verified,
  policy-allows, policy-denies, no-applicable-policy + bounded
  details) and exact evidence paths (`{ artifactId, revision, digest }`
  — the @epoch/evidence exact-revision form).
- `AuthorizationRecord` — the published decision record: decision +
  `decisionDigest` (SHA-256 of the decision's canonical JSON — the
  exact-revision address of the decision).

## Decision outcomes vs errors

Decisions (when the pipeline CAN decide): `allow`, `deny`,
`not-applicable` (policies evaluated, none applied — NOT an allow;
consumers fail closed). Errors (fail-closed refusals to issue any
decision): `validation`, `unknown-principal`, `unknown-tenant`,
`cross-tenant-denied`, `not-applicable` (no policy source wired),
`evaluation-failed`, `digest-mismatch` (tampered record).

## Integrity (tamper detection)

Decision records are content-addressed: `decisionDigest` is the
SHA-256 of the decision's canonical JSON
(`computeAuthorizationDecisionDigest` / `sealAuthorizationDecision`).
`parseAuthorizationRecord` recomputes the digest and rejects mismatches
with a typed `digest-mismatch` error — a record whose claimed digest
does not match its content never resolves.

## Versioned contract surface

Published INSIDE the package (W009 owns no `contracts/*` directory),
following `@epoch/capability-registry` (W007) and
`@epoch/extension-sdk` (W008): version constants + typed index export
(`src/index.ts`), runtime zod validators (`src/schema.ts`), compile-time
parity (`src/parity.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (regenerate with
`EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/authorization test contract-drift`).

## Dependencies

Runtime: `@epoch/agent-protocol` and `zod` (frozen catalog). Dev/test
only: the workspace toolchain and five kernel parity devDependencies
(policy-contracts, tenancy, identity, action-protocol, evidence) — all
pinned by `test/parity.test.ts`, none imported at runtime.
