// Shared fixtures for the authorization tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely;
// the facts builders implement the host wiring seam over plain maps
// (the parity tests wire the real @epoch/tenancy /
// @epoch/identity / @epoch/policy-contracts kernels behind it).
import type {
  AuthorizationFacts,
  EvidencePath,
  PolicyEvaluationOutcome,
} from '../src/index';

export const PRINCIPAL_ID = 'principal:ada-lovelace';
export const AGENT_PRINCIPAL_ID = 'principal:stress-agent';
export const TENANT_A_ID = 'tenant:acme';
export const TENANT_B_ID = 'tenant:globex';
export const WORKSPACE_A1_ID = 'workspace:acme-eng';
export const PROJECT_A1_ID = 'project:acme-bridge';

/** A valid authorization request as loose JSON (Acme tenant scope). */
export function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requestId: 'request-0001',
    principalId: PRINCIPAL_ID,
    tenantId: TENANT_A_ID,
    resource: { resourceType: 'workspace', resourceId: WORKSPACE_A1_ID },
    actionKind: 'world:write',
    context: {
      workspaceId: WORKSPACE_A1_ID,
      projectId: PROJECT_A1_ID,
      tags: ['engineering'],
    },
    requestedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

/** A valid exact evidence path as loose JSON. */
export function evidencePath(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    artifactId: 'authn-result-0001',
    revision: 'r1',
    digest: 'a'.repeat(64),
    ...overrides,
  };
}

export const EVIDENCE_PATH_FIXTURE: Record<string, unknown> = evidencePath();

/** A policy evaluation outcome fixture (allow by default). */
export function policyOutcome(overrides: Record<string, unknown> = {}): PolicyEvaluationOutcome {
  return {
    outcome: 'allow',
    reasons: ['workspace write permitted for engineering members'],
    evidencePaths: [EVIDENCE_PATH_FIXTURE as unknown as EvidencePath],
    ...overrides,
  } as PolicyEvaluationOutcome;
}

/**
 * Host-wired facts over plain maps: the seam hosts implement with real
 * kernels (tenancy/identity/policy) — the parity tests do exactly that.
 */
export function factsFixture(options: {
  principals?: Record<string, readonly string[]>;
  tenants?: readonly string[];
  policy?: PolicyEvaluationOutcome | ((target: unknown) => PolicyEvaluationOutcome);
}): AuthorizationFacts {
  const principals: Record<string, readonly string[]> = options.principals ?? {
    [PRINCIPAL_ID]: [TENANT_A_ID],
    [AGENT_PRINCIPAL_ID]: [TENANT_A_ID],
  };
  const tenants: readonly string[] = options.tenants ?? [TENANT_A_ID, TENANT_B_ID];
  const facts: AuthorizationFacts = {
    resolvePrincipal(principalId: string) {
      const memberTenants = principals[principalId];
      return memberTenants === undefined
        ? { known: false }
        : { known: true, memberTenants };
    },
    resolveTenant(tenantId: string) {
      return tenants.includes(tenantId) ? { known: true } : { known: false };
    },
  };
  if (options.policy !== undefined) {
    const policy = options.policy;
    facts.evaluatePolicy = (_request: unknown, target: unknown): PolicyEvaluationOutcome =>
      typeof policy === 'function'
        ? (policy as (target: unknown) => PolicyEvaluationOutcome)(target)
        : policy;
  }
  return facts;
}
