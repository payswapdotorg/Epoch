/**
 * The authorization decision point (W009).
 *
 * `evaluate` is a TOTAL, DETERMINISTIC function over caller-supplied
 * typed facts: an admissible request over an admissible context always
 * yields a decision (allow / deny / not-applicable); malformed inputs
 * yield typed `validation` errors. Authorization is a DECISION POINT,
 * not a policy engine (architecture.md): it never evaluates constraints
 * — policy semantics are @epoch/policy-contracts' (W004), and the
 * request projects onto the W004 `PolicyTarget` shape via
 * {@link toPolicyTarget} (parity-pinned by tests).
 *
 * Decision semantics (checked in this exact order — deterministic):
 *
 * 1. `not-applicable` (`resource-not-tenant-scoped`) — the resource has
 *    no tenant id: platform-scope is a different authority, not a tenant
 *    decision; neither allow nor deny is asserted.
 * 2. deny `unknown-principal` — the principal has no fact in the context
 *    (fail-closed: unknowns are denied, never error-open).
 * 3. deny `unknown-tenant` — the resource's tenant is not among the
 *    known tenants.
 * 4. deny `cross-tenant-denied` — the principal holds no membership in
 *    the resource's tenant: the tenant isolation boundary (R12) is
 *    enforced BY CONSTRUCTION.
 * 5. deny `cross-workspace-denied` — memberships exist in the tenant
 *    but none covers the resource's workspace (cross-workspace escape).
 * 6. deny `cross-project-denied` — memberships cover the workspace but
 *    none covers the project (hierarchy traversal without membership).
 * 7. deny `inactive-principal` — a covering membership exists but the
 *    principal is suspended/deactivated.
 * 8. deny `unauthenticated-principal` — a covering membership exists
 *    but the principal is not authenticated.
 * 9. allow — a covering membership, an active principal, and a verified
 *    authentication: typed reasons + the exact evidence paths that
 *    ground the decision.
 *
 * Determinism: the evaluator canonicalizes the context (principals
 * sorted by id; memberships deduplicated then sorted by
 * (principalId, tenantId, workspaceId, projectId); knownTenants
 * deduplicated then sorted) BEFORE matching, so two contexts that
 * differ only in array order produce byte-identical decisions (the
 * decision digest is stable). No clocks, no randomness: the decision
 * references the request by the SHA-256 of its canonical JSON.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  AuthorizationContextSchema,
  AuthorizationRequestSchema,
} from './schema';
import { validationError } from './issues';
import type {
  AllowDecision,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationPolicyTarget,
  AuthorizationRequest,
  AuthorizationResult,
  DenyDecision,
  EvidencePath,
  MembershipFact,
  NotApplicableDecision,
  PrincipalFact,
} from './types';

/** Canonicalized context: the deterministic form the evaluator matches over. */
interface CanonicalContext {
  readonly principals: readonly PrincipalFact[];
  readonly memberships: readonly MembershipFact[];
  readonly knownTenants: readonly string[];
}

function membershipSortKey(membership: MembershipFact): string {
  return [
    membership.principalId,
    membership.tenantId,
    membership.workspaceId ?? '',
    membership.projectId ?? '',
  ].join('\u0000');
}

function canonicalize(context: AuthorizationContext): CanonicalContext {
  const principals = [...context.principals].sort((a, b) =>
    a.principalId < b.principalId ? -1 : a.principalId > b.principalId ? 1 : 0,
  );
  const seen = new Set<string>();
  const memberships: MembershipFact[] = [];
  for (const membership of [...context.memberships].sort((a, b) =>
    membershipSortKey(a) < membershipSortKey(b) ? -1 : 1,
  )) {
    const key = membershipSortKey(membership);
    if (seen.has(key)) continue; // exact duplicates are the same fact
    seen.add(key);
    memberships.push(membership);
  }
  const knownTenants = [...new Set(context.knownTenants)].sort();
  return { principals, memberships, knownTenants };
}

/**
 * Does a membership cover the resource's scope? Containment semantics
 * mirror @epoch/tenancy: a tenant-wide membership ({tenantId} only)
 * covers every workspace and project in the tenant; a workspace-wide
 * membership ({tenantId, workspaceId}) covers the workspace and every
 * project under it; a project-scoped membership covers only that
 * project. An absent scope field on the MEMBERSHIP means "covers
 * everything below"; an absent field on the RESOURCE means "not scoped
 * that deep".
 */
function covers(membership: MembershipFact, resource: AuthorizationRequest['resource']): boolean {
  if (membership.tenantId !== resource.tenantId) return false;
  if (
    resource.workspaceId !== undefined &&
    membership.workspaceId !== undefined &&
    membership.workspaceId !== resource.workspaceId
  ) {
    return false;
  }
  if (
    resource.projectId !== undefined &&
    membership.projectId !== undefined &&
    membership.projectId !== resource.projectId
  ) {
    return false;
  }
  return true;
}

function allow(
  requestDigest: Sha256Hex,
  evidence: readonly EvidencePath[],
): AllowDecision {
  return {
    schemaVersion: 1,
    requestDigest,
    outcome: 'allow',
    reasons: ['covering-membership', 'active-principal', 'authenticated-principal'],
    evidence,
  };
}

function deny(
  requestDigest: Sha256Hex,
  code: DenyDecision['denial']['code'],
  message: string,
  evidence: readonly EvidencePath[],
): DenyDecision {
  return {
    schemaVersion: 1,
    requestDigest,
    outcome: 'deny',
    denial: { code, message },
    evidence,
  };
}

function notApplicable(
  requestDigest: Sha256Hex,
  reason: NotApplicableDecision['reason'],
  message: string,
  evidence: readonly EvidencePath[],
): NotApplicableDecision {
  return {
    schemaVersion: 1,
    requestDigest,
    outcome: 'not-applicable',
    reason,
    message,
    evidence,
  };
}

/**
 * Evaluate one authorization request over one decision context (total,
 * deterministic, fail-closed). Both inputs are schema-validated first;
 * malformed inputs yield typed `validation` errors and NEVER an
 * implicit decision.
 */
export function evaluate(
  request: AuthorizationRequest,
  context: AuthorizationContext,
): AuthorizationResult<AuthorizationDecision> {
  const parsedRequest = AuthorizationRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    return { ok: false, error: validationError(parsedRequest.error) };
  }
  const parsedContext = AuthorizationContextSchema.safeParse(context);
  if (!parsedContext.success) {
    return { ok: false, error: validationError(parsedContext.error) };
  }
  const req = parsedRequest.data;
  const canonical = canonicalize(parsedContext.data);
  const requestDigest = canonicalDigest(req as unknown as JsonValue);

  // 1. Platform scope: this decision point has nothing to say.
  if (req.resource.tenantId === undefined) {
    return {
      ok: true,
      value: notApplicable(
        requestDigest,
        'resource-not-tenant-scoped',
        'the resource carries no tenant scope — platform-level authorization is a different authority, not a tenant decision',
        ['request.resource.tenantId'],
      ),
    };
  }

  const resourceTenant = req.resource.tenantId;

  // 2. Unknown principal (fail-closed).
  const principalIndex = canonical.principals.findIndex(
    (fact) => fact.principalId === req.principalId,
  );
  if (principalIndex === -1) {
    return {
      ok: true,
      value: deny(
        requestDigest,
        'unknown-principal',
        `principal "${req.principalId}" has no fact in the decision context — unknowns are denied (fail-closed)`,
        ['request.principalId', 'principals'],
      ),
    };
  }
  const principal = canonical.principals[principalIndex]!;

  // 3. Unknown tenant (fail-closed).
  if (!canonical.knownTenants.includes(resourceTenant)) {
    return {
      ok: true,
      value: deny(
        requestDigest,
        'unknown-tenant',
        `tenant "${resourceTenant}" is not among the known tenants — unknowns are denied (fail-closed)`,
        ['request.resource.tenantId', 'knownTenants'],
      ),
    };
  }

  // 4. Tenant isolation boundary (R12): no membership in the tenant.
  const tenantMemberships = canonical.memberships.filter(
    (membership) =>
      membership.principalId === req.principalId && membership.tenantId === resourceTenant,
  );
  if (tenantMemberships.length === 0) {
    return {
      ok: true,
      value: deny(
        requestDigest,
        'cross-tenant-denied',
        `principal "${req.principalId}" holds no membership in tenant "${resourceTenant}" — the tenant boundary is an isolation boundary`,
        ['request.principalId', 'request.resource.tenantId', 'memberships'],
      ),
    };
  }

  // 5-6. Scope coverage: workspace, then project (hierarchy traversal
  // without membership is denied at each level).
  const covering = tenantMemberships.filter((membership) => covers(membership, req.resource));
  if (covering.length === 0) {
    if (req.resource.workspaceId !== undefined) {
      const workspaceCovering = tenantMemberships.filter(
        (membership) =>
          membership.workspaceId === undefined ||
          membership.workspaceId === req.resource.workspaceId,
      );
      if (workspaceCovering.length === 0) {
        return {
          ok: true,
          value: deny(
            requestDigest,
            'cross-workspace-denied',
            `principal "${req.principalId}" is not a member of workspace "${req.resource.workspaceId}" — cross-workspace escape is denied`,
            ['request.resource.workspaceId', 'memberships'],
          ),
        };
      }
    }
    if (req.resource.projectId !== undefined) {
      return {
        ok: true,
        value: deny(
          requestDigest,
          'cross-project-denied',
          `principal "${req.principalId}" is not a member of project "${req.resource.projectId}" — hierarchy traversal without membership is denied`,
          ['request.resource.projectId', 'memberships'],
        ),
      };
    }
  }

  // The covering membership's canonical index (evidence path).
  const coveringIndex = canonical.memberships.findIndex((membership) =>
    covers(membership, req.resource),
  );

  // 7. Principal state on the covering membership.
  if (principal.status !== 'active') {
    return {
      ok: true,
      value: deny(
        requestDigest,
        'inactive-principal',
        `principal "${req.principalId}" is ${principal.status} — an inactive principal cannot be authorized`,
        [`principals[${principalIndex}]`, `principals[${principalIndex}].status`],
      ),
    };
  }

  // 8. Authentication state.
  if (!principal.authenticated) {
    return {
      ok: true,
      value: deny(
        requestDigest,
        'unauthenticated-principal',
        `principal "${req.principalId}" has no verified authentication — unauthenticated principals cannot be authorized`,
        [`principals[${principalIndex}]`, `principals[${principalIndex}].authenticated`],
      ),
    };
  }

  // 9. Allow, with the exact evidence that grounds it.
  const evidence =
    coveringIndex === -1
      ? ['request.principalId', `principals[${principalIndex}]`]
      : ['request.principalId', `principals[${principalIndex}]`, `memberships[${coveringIndex}]`];
  return { ok: true, value: allow(requestDigest, evidence) };
}

/**
 * Project a request onto the W004 policy-target shape (fields 1:1:
 * tenant/workspace/project scope, action kind, resource type). The
 * projection type is compile-time EQUALS to @epoch/policy-contracts'
 * `PolicyTarget` (pinned by test/w004-parity.types.ts); runtime
 * acceptance is pinned by test/w004-parity.test.ts.
 */
export function toPolicyTarget(request: AuthorizationRequest): AuthorizationPolicyTarget {
  return {
    tenantId: request.resource.tenantId,
    workspaceId: request.resource.workspaceId,
    projectId: request.resource.projectId,
    actionKind: request.actionKind,
    resourceType: request.resource.resourceType,
    tags: undefined,
  };
}
