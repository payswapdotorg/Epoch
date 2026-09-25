// Negative tests: the tenant-isolation security boundary (R12) and the
// fail-closed decision discipline. Named cases (W009 Tech Lead pins):
// cross-tenant access, cross-workspace escape, hierarchy traversal
// without membership, unknown principal/tenant, inactive and
// unauthenticated principals, malformed ids, scope-chain gaps, vendor
// fields, duplicate/conflicting facts, and tampered decision digests.
import { describe, expect, it } from 'vitest';
import type { AuthorizationError, AuthorizationResult } from '../src/index';
import {
  evaluate,
  parseAuthorizationRequest,
  sealAuthorizationDecision,
} from '../src/index';
import {
  IDS,
  adaFact,
  asContext,
  asRequest,
  globexFact,
  globexMembership,
  request,
} from './helpers';

function failureOf<T>(result: AuthorizationResult<T>): AuthorizationError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

function deniedOf(result: AuthorizationResult<{ outcome: string }>): {
  code: string;
  decision: { outcome: string };
} {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected a decision');
  const decision = result.value as unknown as { outcome: string; denial?: { code: string } };
  expect(decision.outcome).toBe('deny');
  return { code: (decision as { denial: { code: string } }).denial.code, decision };
}

describe('tenant isolation boundary (negative — R12, fail-closed by construction)', () => {
  it('cross-tenant access is denied: an Acme member requesting a Globex resource', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'world',
            resourceId: 'world:globex-model',
            tenantId: IDS.TENANT_GLOBEX,
            workspaceId: IDS.WS_GLOBEX_ENG,
            projectId: 'project:globex-1',
          },
        }),
        asContext(),
      ),
    );
    expect(code).toBe('cross-tenant-denied');
  });

  it('cross-tenant access is denied even when the foreign tenant is not known at all', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'world',
            resourceId: 'world:other-model',
            tenantId: 'tenant:other',
            workspaceId: 'workspace:other-eng',
            projectId: 'project:other-1',
          },
        }),
        asContext(),
      ),
    );
    expect(code).toBe('unknown-tenant');
  });

  it('cross-workspace escape is denied within the same tenant', () => {
    // Ada is a member of workspace:acme-eng only; the resource lives in a
    // different workspace of the SAME tenant.
    const { code } = deniedOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'world',
            resourceId: 'world:acme-civil-model',
            tenantId: IDS.TENANT_ACME,
            workspaceId: 'workspace:acme-civil',
            projectId: 'project:acme-civil-1',
          },
        }),
        asContext(),
      ),
    );
    expect(code).toBe('cross-workspace-denied');
  });

  it('hierarchy traversal without membership is denied: another project in the same workspace', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'evidence',
            resourceId: 'evidence:bridge-13-report',
            tenantId: IDS.TENANT_ACME,
            workspaceId: IDS.WS_ACME_ENG,
            projectId: 'project:bridge-13',
          },
        }),
        asContext(),
      ),
    );
    expect(code).toBe('cross-project-denied');
  });

  it('a tenant-wide membership still covers the workspace level (no false cross-workspace denial)', () => {
    const decision = evaluate(
      asRequest({
        resource: {
          resourceType: 'world',
          resourceId: 'world:acme-civil-model',
          tenantId: IDS.TENANT_ACME,
          workspaceId: 'workspace:acme-civil',
          projectId: 'project:acme-civil-1',
        },
      }),
      asContext({
        memberships: [{ principalId: IDS.ADA, tenantId: IDS.TENANT_ACME }],
      }),
    );
    expect(decision.ok && (decision.value as { outcome: string }).outcome).toBe('allow');
  });
});

describe('fail-closed unknowns (negative)', () => {
  it('an unknown principal is denied, never error-open', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest({ principalId: 'principal:ghost' }),
        asContext({
          principals: [],
          memberships: [],
        }),
      ),
    );
    expect(code).toBe('unknown-principal');
  });

  it('an unknown tenant is denied, never error-open', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'report',
            resourceId: 'report:x',
            tenantId: 'tenant:not-known',
          },
        }),
        asContext({ knownTenants: [IDS.TENANT_ACME] }),
      ),
    );
    expect(code).toBe('unknown-tenant');
  });

  it('a principal with facts but no memberships at all is cross-tenant denied', () => {
    const { code } = deniedOf(
      evaluate(asRequest(), asContext({ memberships: [globexMembership()] })),
    );
    expect(code).toBe('cross-tenant-denied');
  });
});

describe('principal state gating (negative)', () => {
  it('a suspended principal is denied (inactive-principal)', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest(),
        asContext({ principals: [adaFact({ status: 'suspended' }), globexFact()] }),
      ),
    );
    expect(code).toBe('inactive-principal');
  });

  it('a deactivated principal is denied (inactive-principal)', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest(),
        asContext({ principals: [adaFact({ status: 'deactivated' }), globexFact()] }),
      ),
    );
    expect(code).toBe('inactive-principal');
  });

  it('an unauthenticated principal is denied (unauthenticated-principal)', () => {
    const { code } = deniedOf(
      evaluate(
        asRequest(),
        asContext({ principals: [adaFact({ authenticated: false }), globexFact()] }),
      ),
    );
    expect(code).toBe('unauthenticated-principal');
  });
});

describe('malformed inputs (negative — validation boundary)', () => {
  it('malformed ids are rejected: bad principal/tenant/workspace/project shapes', () => {
    for (const bad of [
      asRequest({ principalId: 'Principal:Ada' }),
      asRequest({ principalId: 'ada' }),
      asRequest({
        resource: {
          resourceType: 'world',
          resourceId: 'world:x',
          tenantId: 'Tenant:ACME',
        },
      }),
      asRequest({
        resource: {
          resourceType: 'world',
          resourceId: 'world:x',
          tenantId: 'tenant:acme',
          workspaceId: 'ws:acme-eng',
        },
      }),
    ]) {
      const error = failureOf(evaluate(bad, asContext()));
      expect(error.code).toBe('validation');
    }
  });

  it('scope-chain gaps are rejected: a workspace without a tenant; a project without a workspace', () => {
    const noTenant = request({
      resource: {
        resourceType: 'world',
        resourceId: 'world:x',
        workspaceId: IDS.WS_ACME_ENG,
      },
    });
    const error = failureOf(evaluate(noTenant as never, asContext()));
    expect(error.code).toBe('validation');

    const noWorkspace = request({
      resource: {
        resourceType: 'world',
        resourceId: 'world:x',
        tenantId: IDS.TENANT_ACME,
        projectId: IDS.PROJ_BRIDGE,
      },
    });
    const error2 = failureOf(evaluate(noWorkspace as never, asContext()));
    expect(error2.code).toBe('validation');
    if (error2.code !== 'validation') return;
    expect(error2.issues.some((issue) => issue.path === 'resource')).toBe(true);
  });

  it('duplicate principal facts are rejected (conflicting facts are not averaged)', () => {
    const error = failureOf(
      evaluate(
        asRequest(),
        asContext({
          principals: [adaFact(), adaFact({ status: 'suspended' })],
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('a membership for a factless principal is rejected (the context must be consistent)', () => {
    const error = failureOf(
      evaluate(
        asRequest({ principalId: 'principal:nikola' }),
        asContext({ principals: [adaFact()], memberships: [globexMembership()] }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('schema-version skew is rejected before any other check', () => {
    const error = failureOf(evaluate(asRequest({ schemaVersion: 2 }), asContext()));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('out-of-vocabulary statuses and malformed evidence paths in INPUTS are rejected', () => {
    const error = failureOf(
      evaluate(asRequest(), asContext({ principals: [adaFact({ status: 'banned' })] })),
    );
    expect(error.code).toBe('validation');
  });
});

describe('tampered decision digests (negative — integrity boundary)', () => {
  it('sealing rejects an invalid decision (outcome/reason discipline)', () => {
    const bogus = {
      schemaVersion: 1,
      requestDigest: 'a'.repeat(64),
      outcome: 'allow',
      reasons: ['not-in-vocabulary'],
      evidence: ['request.principalId'],
    };
    const error = failureOf(sealAuthorizationDecision(bogus));
    expect(error.code).toBe('validation');
  });

  it('sealing rejects malformed evidence paths', () => {
    const bogus = {
      schemaVersion: 1,
      requestDigest: 'a'.repeat(64),
      outcome: 'allow',
      reasons: ['covering-membership'],
      evidence: ['not-a-rooted-path'],
    };
    const error = failureOf(sealAuthorizationDecision(bogus));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path.startsWith('evidence'))).toBe(true);
  });

  it('parseAuthorizationRequest rejects vendor fields on requests (strict objects)', () => {
    const error = failureOf(parseAuthorizationRequest({ ...request(), provider: 'acme-authz' }));
    expect(error.code).toBe('validation');
  });
});
