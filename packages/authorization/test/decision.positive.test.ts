// Positive tests: decision issuance across the three outcomes — typed
// reasons and exact evidence paths flow from the host-wired facts into
// content-addressed decision records; determinism; parse round-trips.
import { describe, expect, it } from 'vitest';
import {
  AuthorizationDecisionPoint,
  computeAuthorizationDecisionDigest,
  parseAuthorizationDecision,
  parseAuthorizationRecord,
  parseAuthorizationRequest,
  projectPolicyTarget,
  sealAuthorizationDecision,
} from '../src/index';
import {
  EVIDENCE_PATH_FIXTURE,
  PRINCIPAL_ID,
  PROJECT_A1_ID,
  TENANT_A_ID,
  WORKSPACE_A1_ID,
  evidencePath,
  factsFixture,
  policyOutcome,
  request,
} from './helpers';

describe('decision issuance (positive)', () => {
  it('an allow outcome yields an allow decision with typed reasons and evidence paths', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const result = decisionPoint.decide(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.value;
    expect(record.decision.outcome).toBe('allow');
    expect(record.decision.requestId).toBe('request-0001');
    expect(record.decision.principalId).toBe(PRINCIPAL_ID);
    expect(record.decision.tenantId).toBe(TENANT_A_ID);
    expect(record.decision.reasons).toEqual([
      { code: 'principal-verified' },
      { code: 'tenant-verified' },
      {
        code: 'policy-allows',
        detail: 'workspace write permitted for engineering members',
      },
    ]);
    expect(record.decision.evidencePaths).toEqual([EVIDENCE_PATH_FIXTURE]);
  });

  it('a deny outcome yields a deny decision carrying the policy reason details', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        policy: policyOutcome({
          outcome: 'deny',
          reasons: ['workspace write blocked by tenant policy'],
        }),
      }),
    );
    const result = decisionPoint.decide(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decision.outcome).toBe('deny');
    expect(result.value.decision.reasons).toEqual([
      { code: 'principal-verified' },
      { code: 'tenant-verified' },
      { code: 'policy-denies', detail: 'workspace write blocked by tenant policy' },
    ]);
  });

  it('a not-applicable evaluation yields a not-applicable decision (no authorization granted)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        policy: policyOutcome({
          outcome: 'not-applicable',
          reasons: ['no policy matched the target tags'],
        }),
      }),
    );
    const result = decisionPoint.decide(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decision.outcome).toBe('not-applicable');
    expect(result.value.decision.reasons).toEqual([
      { code: 'principal-verified' },
      { code: 'tenant-verified' },
      { code: 'no-applicable-policy', detail: 'no policy matched the target tags' },
    ]);
  });

  it('decide accepts serialized request documents (validation first)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const result = decisionPoint.decide(JSON.parse(JSON.stringify(request())) as unknown);
    expect(result.ok).toBe(true);
  });

  it('a caller-supplied decidedAt is stamped on the decision (audit)', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const result = decisionPoint.decide(request(), {
      decidedAt: '2026-10-01T09:00:02.000Z',
    });
    expect(result.ok && result.value.decision.decidedAt).toBe('2026-10-01T09:00:02.000Z');
  });

  it('principal-resolution evidence paths flow into the decision record', () => {
    const authnEvidence = evidencePath({ artifactId: 'authn-result-0099' });
    const decisionPoint = new AuthorizationDecisionPoint({
      resolvePrincipal: (principalId: string) =>
        principalId === PRINCIPAL_ID
          ? { known: true, memberTenants: [TENANT_A_ID], evidencePaths: [authnEvidence as never] }
          : { known: false },
      resolveTenant: () => ({ known: true }),
      evaluatePolicy: () => policyOutcome(),
    });
    const result = decisionPoint.decide(request());
    expect(result.ok && result.value.decision.evidencePaths).toEqual([
      authnEvidence,
      EVIDENCE_PATH_FIXTURE,
    ]);
  });
});

describe('content addressing and determinism (positive)', () => {
  it('deciding the same request twice yields byte-identical records', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const first = decisionPoint.decide(request());
    const second = decisionPoint.decide(request());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(JSON.stringify(second.value)).toBe(JSON.stringify(first.value));
    expect(second.value.decisionDigest).toBe(first.value.decisionDigest);
  });

  it('the decision digest equals the canonical digest of the decision content', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const result = decisionPoint.decide(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.decisionDigest).toBe(
      computeAuthorizationDecisionDigest(result.value.decision),
    );
  });

  it('key-order differences in the request do not change the decision digest', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const first = decisionPoint.decide(request());
    const reordered = request({
      actionKind: 'world:write',
      resource: { resourceId: WORKSPACE_A1_ID, resourceType: 'workspace' },
      tenantId: TENANT_A_ID,
      principalId: PRINCIPAL_ID,
      requestId: 'request-0001',
      schemaVersion: 1,
    });
    const second = decisionPoint.decide(reordered);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.decisionDigest).toBe(first.value.decisionDigest);
  });
});

describe('parse round-trips (positive)', () => {
  it('parses valid requests, decisions, and records', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const issued = decisionPoint.decide(request());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    expect(parseAuthorizationRequest(request()).ok).toBe(true);
    expect(parseAuthorizationDecision(issued.value.decision).ok).toBe(true);
    expect(parseAuthorizationRecord(issued.value).ok).toBe(true);
  });

  it('sealAuthorizationDecision round-trips a decision into its record', () => {
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({ policy: policyOutcome() }),
    );
    const issued = decisionPoint.decide(request());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const sealed = sealAuthorizationDecision(issued.value.decision);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.decisionDigest).toBe(issued.value.decisionDigest);
    expect(parseAuthorizationRecord(sealed.value).ok).toBe(true);
  });
});

describe('policy-target projection (positive)', () => {
  it('projects the request onto the W004-compatible target fields', () => {
    const parsed = parseAuthorizationRequest(request());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(projectPolicyTarget(parsed.value)).toEqual({
      tenantId: TENANT_A_ID,
      workspaceId: WORKSPACE_A1_ID,
      projectId: PROJECT_A1_ID,
      actionKind: 'world:write',
      resourceType: 'workspace',
      tags: ['engineering'],
    });
  });

  it('the projection omits absent optional fields', () => {
    const parsed = parseAuthorizationRequest(request({ context: undefined }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(projectPolicyTarget(parsed.value)).toEqual({
      tenantId: TENANT_A_ID,
      actionKind: 'world:write',
      resourceType: 'workspace',
    });
  });

  it('the decision point passes the projection to the policy source', () => {
    const seen: unknown[] = [];
    const decisionPoint = new AuthorizationDecisionPoint(
      factsFixture({
        policy: (target: unknown) => {
          seen.push(target);
          return policyOutcome();
        },
      }),
    );
    expect(decisionPoint.decide(request()).ok).toBe(true);
    expect(seen).toEqual([
      {
        tenantId: TENANT_A_ID,
        workspaceId: WORKSPACE_A1_ID,
        projectId: PROJECT_A1_ID,
        actionKind: 'world:write',
        resourceType: 'workspace',
        tags: ['engineering'],
      },
    ]);
  });
});
