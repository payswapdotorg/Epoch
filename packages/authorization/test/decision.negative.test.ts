// Negative tests: every boundary the authorization decision point must
// reject — named for the W009 acceptance criteria. Every rejection is a
// TYPED error value (never a throw, never a silent allow):
//   cross-tenant-denied (tenant isolation BY CONSTRUCTION — R12),
//   unknown-principal, unknown-tenant, not-applicable (no policy source
//   wired — fail closed), evaluation-failed (fail closed), validation
//   (malformed ids, vendor/provider fields), digest-mismatch (tamper
//   detection).
import { describe, expect, it } from 'vitest';
import type { AuthorizationError, AuthorizationResult } from '../src/index';
import {
  AuthorizationDecisionPoint,
  parseAuthorizationRecord,
  parseAuthorizationRequest,
  sealAuthorizationDecision,
} from '../src/index';
import {
  PRINCIPAL_ID,
  TENANT_A_ID,
  TENANT_B_ID,
  evidencePath,
  factsFixture,
  policyOutcome,
  request,
} from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: AuthorizationResult<T>): AuthorizationError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('cross-tenant-denied (negative — tenant isolation BY CONSTRUCTION, R12)', () => {
  it('rejects a principal requesting authorization in a tenant it is not a member of', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    // Ada is a member of tenant:acme only; the request scopes tenant:globex.
    const error = failureOf(decisionPoint.decide(request({ tenantId: TENANT_B_ID })));
    expect(error.code).toBe('cross-tenant-denied');
    if (error.code !== 'cross-tenant-denied') return;
    expect(error.principalId).toBe(PRINCIPAL_ID);
    expect(error.tenantId).toBe(TENANT_B_ID);
    expect(error.memberTenants).toEqual([TENANT_A_ID]);
  });

  it('rejects a principal with NO tenant membership requesting any tenant scope', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        principals: { [PRINCIPAL_ID]: [] },
        policy: policyOutcome(),
      }),
    );
    const error = failureOf(decisionPoint.decide(request()));
    expect(error.code).toBe('cross-tenant-denied');
    if (error.code !== 'cross-tenant-denied') return;
    expect(error.memberTenants).toEqual([]);
  });

  it('an even-permissive policy source cannot rescue a cross-tenant request', () => {
    // The isolation check runs BEFORE policy evaluation: no code path
    // from a non-member principal to an allow exists.
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        principals: { [PRINCIPAL_ID]: [TENANT_A_ID] },
        policy: policyOutcome(), // would allow
      }),
    );
    const result = decisionPoint.decide(request({ tenantId: TENANT_B_ID }));
    expect(failureOf(result).code).toBe('cross-tenant-denied');
  });
});

describe('unknown-principal (negative)', () => {
  it('rejects a request whose principal is not known to the facts', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const error = failureOf(
      decisionPoint.decide(request({ principalId: 'principal:ghost' })),
    );
    expect(error.code).toBe('unknown-principal');
    if (error.code !== 'unknown-principal') return;
    expect(error.principalId).toBe('principal:ghost');
  });

  it('unknown-principal takes precedence over unknown-tenant (pin order)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        principals: {},
        tenants: [],
        policy: policyOutcome(),
      }),
    );
    const error = failureOf(decisionPoint.decide(request()));
    expect(error.code).toBe('unknown-principal');
  });
});

describe('unknown-tenant (negative)', () => {
  it('rejects a request whose tenant scope is not known to the facts', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        tenants: [TENANT_A_ID],
        policy: policyOutcome(),
      }),
    );
    const error = failureOf(
      decisionPoint.decide(request({ tenantId: 'tenant:ghost' })),
    );
    expect(error.code).toBe('unknown-tenant');
    if (error.code !== 'unknown-tenant') return;
    expect(error.tenantId).toBe('tenant:ghost');
  });
});

describe('not-applicable — no policy source wired (negative — fail closed)', () => {
  it('rejects every request when the facts carry no policy evaluation', () => {
    const decisionPoint = new AuthorizationDecisionPoint(factsFixture({}));
    const error = failureOf(decisionPoint.decide(request()));
    expect(error.code).toBe('not-applicable');
    if (error.code !== 'not-applicable') return;
    expect(error.message).toContain('no policy source is wired');
  });
});

describe('evaluation-failed (negative — fail closed)', () => {
  it('a failed policy evaluation surfaces as a typed error, never a silent allow', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        policy: policyOutcome({
          outcome: 'failed',
          reasons: ['policy resolution returned issues'],
        }),
      }),
    );
    const error = failureOf(decisionPoint.decide(request()));
    expect(error.code).toBe('evaluation-failed');
    if (error.code !== 'evaluation-failed') return;
    expect(error.reasons).toEqual(['policy resolution returned issues']);
  });
});

describe('malformed documents (negative — validation)', () => {
  it('rejects malformed principal/tenant ids', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    for (const [field, value] of [
      ['principalId', ''],
      ['principalId', 'principal'],
      ['principalId', 'Principal:Ada'],
      ['principalId', 'user:ada'],
      ['principalId', `principal:${'x'.repeat(64)}`],
      ['tenantId', ''],
      ['tenantId', 'tenant:'],
      ['tenantId', 'Tenant:acme'],
      ['tenantId', 'org:acme'],
    ] as const) {
      const error = failureOf(decisionPoint.decide(request({ [field]: value })));
      expect(error.code, `${field}=${JSON.stringify(value)}`).toBe('validation');
    }
  });

  it('rejects malformed action kinds (colon-namespaced discipline)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    for (const badKind of ['', 'write', 'WORLD:write', 'world:', 'a b', 'world:Write']) {
      const error = failureOf(decisionPoint.decide(request({ actionKind: badKind })));
      expect(error.code, JSON.stringify(badKind)).toBe('validation');
    }
  });

  it('rejects malformed resource references', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    for (const badResource of [
      { resourceType: '', resourceId: 'workspace:acme-eng' },
      { resourceType: 'Workspace', resourceId: 'workspace:acme-eng' },
      { resourceType: 'workspace', resourceId: '' },
      { resourceType: 'workspace', resourceId: 'x'.repeat(129) },
      { resourceType: 'workspace' },
      { resourceId: 'workspace:acme-eng' },
    ]) {
      const error = failureOf(
        decisionPoint.decide(request({ resource: badResource })),
      );
      expect(error.code, JSON.stringify(badResource)).toBe('validation');
    }
  });

  it('rejects malformed context ids (tenancy id spaces)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const error = failureOf(
      decisionPoint.decide(request({ context: { workspaceId: 'ws:acme' } })),
    );
    expect(error.code).toBe('validation');
    const error2 = failureOf(
      decisionPoint.decide(request({ context: { projectId: 'tenant:acme' } })),
    );
    expect(error2.code).toBe('validation');
  });

  it('rejects vendor/provider fields on request documents (strict objects)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const withVendor = request({ provider: 'acme-idp', endpoint: 'https://idp.example' });
    const error = failureOf(decisionPoint.decide(withVendor));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'provider')).toBe(true);
    expect(error.issues.some((issue) => issue.path === 'endpoint')).toBe(true);
  });

  it('rejects malformed evidence paths supplied by the facts', () => {
    const decisionPoint = new AuthorizationDecisionPoint({
      resolvePrincipal: () => ({
        known: true,
        memberTenants: [TENANT_A_ID],
        evidencePaths: [evidencePath({ digest: 'short' }) as never],
      }),
      resolveTenant: () => ({ known: true }),
      evaluatePolicy: () => policyOutcome(),
    });
    const error = failureOf(decisionPoint.decide(request()));
    expect(error.code).toBe('validation');
  });

  it('rejects a malformed decidedAt option', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const error = failureOf(
      decisionPoint.decide(request(), { decidedAt: '2026-10-01T09:00:02Z' }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects version skew', () => {
    expect(
      failureOf(parseAuthorizationRequest(request({ schemaVersion: 2 }))).code,
    ).toBe('validation');
  });
});

describe('digest-mismatch (negative — tamper detection)', () => {
  it('parseAuthorizationRecord rejects a record whose claimed digest does not match its decision', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const issued = decisionPoint.decide(request());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const tampered = {
      schemaVersion: 1,
      decision: issued.value.decision,
      decisionDigest: 'b'.repeat(64),
    };
    const error = failureOf(parseAuthorizationRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.expected).toBe(issued.value.decisionDigest);
    expect(error.encountered).toBe('b'.repeat(64));
  });

  it('sealAuthorizationDecision rejects an invalid decision document (total form)', () => {
    const invalid = {
      schemaVersion: 1,
      outcome: 'maybe',
      requestId: 'request-0001',
      principalId: PRINCIPAL_ID,
      tenantId: TENANT_A_ID,
      resource: { resourceType: 'workspace', resourceId: 'workspace:acme-eng' },
      actionKind: 'world:write',
      reasons: [],
      evidencePaths: [],
    };
    expect(failureOf(sealAuthorizationDecision(invalid)).code).toBe('validation');
  });

  it('a decision with empty reasons is invalid (auditability)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        policy: policyOutcome({ outcome: 'not-applicable', reasons: [] }),
      }),
    );
    // Engine steps always populate reasons, so this issues validly; the
    // empty-reasons guard applies to hand-built decisions:
    const issued = decisionPoint.decide(request());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const stripped = { ...issued.value.decision, reasons: [] };
    expect(failureOf(sealAuthorizationDecision(stripped)).code).toBe('validation');
  });
});
