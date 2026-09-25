/**
 * Authorization contract versions and closed vocabularies.
 *
 * architecture.md (binding): authorization is a DECISION POINT, not a
 * policy engine — typed requests/decisions (allow/deny/not-applicable +
 * reasons + exact evidence paths) over opaque principal/tenant/resource
 * ids. Policy semantics are @epoch/policy-contracts' (W004); this
 * package never evaluates constraints. Shape compatibility with W004 is
 * pinned via devDependencies + compile-time parity tests (the
 * kernel-to-kernel devDep precedent: W002, W006, W007, W008).
 *
 * The tenant id / workspace id / project id / principal id patterns and
 * the principal-status vocabulary MIRROR @epoch/tenancy and
 * @epoch/identity (the semver-duplication policy of W007: self-contained
 * in src, drift-pinned by parity tests — no runtime coupling).
 */

/** Version of the published authorization contract surface (schemas/ + types). */
export const AUTHORIZATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized authorization record. */
export const AUTHORIZATION_RECORD_VERSION = 1 as const;

/** The exhaustive decision outcomes. */
export const AUTHORIZATION_OUTCOMES = ['allow', 'deny', 'not-applicable'] as const;

/** One decision outcome. */
export type AuthorizationOutcome = (typeof AUTHORIZATION_OUTCOMES)[number];

/**
 * The typed denial taxonomy (fail-closed — every denial carries exactly
 * one machine-readable code; unknowns are DENIED, never error-open):
 *
 * - `unknown-principal` — the principal is absent from the supplied
 *   principal facts;
 * - `unknown-tenant` — the resource's tenant is not among the known
 *   tenants;
 * - `cross-tenant-denied` — the principal holds no membership in the
 *   resource's tenant (the tenant isolation boundary, R12);
 * - `cross-workspace-denied` — memberships exist in the tenant but none
 *   covers the resource's workspace (cross-workspace escape);
 * - `cross-project-denied` — memberships cover the workspace but none
 *   covers the project (hierarchy traversal without membership);
 * - `inactive-principal` — the covering membership exists but the
 *   principal is suspended/deactivated;
 * - `unauthenticated-principal` — the covering membership exists but the
 *   principal's last authentication is not verified.
 */
export const DENIAL_CODES = [
  'unknown-principal',
  'unknown-tenant',
  'cross-tenant-denied',
  'cross-workspace-denied',
  'cross-project-denied',
  'inactive-principal',
  'unauthenticated-principal',
] as const;

/** One typed denial code. */
export type DenialCode = (typeof DENIAL_CODES)[number];

/** Typed reasons an allow decision may cite (evidence paths carry the proof). */
export const ALLOW_REASONS = [
  'covering-membership',
  'active-principal',
  'authenticated-principal',
] as const;

/** One allow reason. */
export type AllowReason = (typeof ALLOW_REASONS)[number];

/** Typed reasons a decision may be not-applicable to this decision point. */
export const NOT_APPLICABLE_REASONS = ['resource-not-tenant-scoped'] as const;

/** One not-applicable reason. */
export type NotApplicableReason = (typeof NOT_APPLICABLE_REASONS)[number];

/**
 * Principal statuses MIRROR @epoch/identity (active/suspended/deactivated)
 * — authorization consumes them as caller-supplied FACTS; the identity
 * registry stays the only authority over principal state.
 */
export const PRINCIPAL_STATUSES = ['active', 'suspended', 'deactivated'] as const;

/** One principal status (mirrors @epoch/identity). */
export type PrincipalStatus = (typeof PRINCIPAL_STATUSES)[number];

/** Principal id pattern — MIRRORS @epoch/identity (parity-pinned). */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Tenant id pattern — MIRRORS @epoch/tenancy (parity-pinned). */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** Workspace id pattern — MIRRORS @epoch/tenancy (parity-pinned). */
export const WORKSPACE_ID_PATTERN = /^workspace:[a-z0-9][a-z0-9-]{0,62}$/;

/** Project id pattern — MIRRORS @epoch/tenancy (parity-pinned). */
export const PROJECT_ID_PATTERN = /^project:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Exact evidence paths: dotted pointers into the request/context that
 * ground a decision (e.g. `request.resource.tenantId`, `memberships[2]`,
 * `principals[0].status`). Rooted at one of the four decision inputs.
 */
export const EVIDENCE_PATH_PATTERN =
  /^(?:request|principals|memberships|knownTenants)(?:\.[A-Za-z][A-Za-z0-9_]*|\[\d+\])*$/;
