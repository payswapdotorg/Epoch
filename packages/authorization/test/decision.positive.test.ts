// Positive tests: the material authorization behaviors — decision
// issuance across all three outcomes, scope-coverage semantics at every
// tenancy level, deterministic serialization (canonical digests stable
// under context reordering), exact evidence paths, and decision
// sealing/round-trips.
import { describe, expect, it } from 'vitest';
import {
  computeAuthorizationDecisionDigest,
  computeAuthorizationRequestDigest,
  evaluate,
  parseSealedAuthorizationDecision,
  sealAuthorizationDecision,
  toPolicyTarget,
} from '../src/index';
import type { AuthorizationDecision } from '../src/index';
import { IDS, adaFact, asContext, asRequest, context } from './helpers';

function decisionOf(result: { ok: boolean; value?: unknown }): AuthorizationDecision {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected a decision');
  return result.value as AuthorizationDecision;
}

describe('decision issuance (positive)', () => {
  it('allows an active, authenticated principal with a covering project membership', () => {
    const decision = decisionOf(evaluate(asRequest(), asContext()));
    expect(decision.outcome).toBe('allow');
    if (decision.outcome !== 'allow') return;
    expect(decision.reasons).toEqual([
      'covering-membership',
      'active-principal',
      'authenticated-principal',
    ]);
    expect(decision.evidence).toContain('request.principalId');
    expect(decision.evidence.some((path) => /^memberships\[\d+\]$/.test(path))).toBe(true);
    expect(decision.evidence.some((path) => /^principals\[\d+\]$/.test(path))).toBe(true);
  });

  it('a workspace-wide membership covers every project under the workspace', () => {
    const decision = decisionOf(
      evaluate(
        asRequest(),
        asContext({
          memberships: [
            { principalId: IDS.ADA, tenantId: IDS.TENANT_ACME, workspaceId: IDS.WS_ACME_ENG },
          ],
        }),
      ),
    );
    expect(decision.outcome).toBe('allow');
  });

  it('a tenant-wide membership covers every workspace and project in the tenant', () => {
    const decision = decisionOf(
      evaluate(
        asRequest(),
        asContext({
          memberships: [{ principalId: IDS.ADA, tenantId: IDS.TENANT_ACME }],
        }),
      ),
    );
    expect(decision.outcome).toBe('allow');
  });

  it('a project membership covers only that project — sibling projects need their own membership', () => {
    const sibling = decisionOf(
      evaluate(
        asRequest({
          resource: {
            resourceType: 'world',
            resourceId: 'world:bridge-13-model',
            tenantId: IDS.TENANT_ACME,
            workspaceId: IDS.WS_ACME_ENG,
            projectId: 'project:bridge-13',
          },
        }),
        asContext(),
      ),
    );
    expect(sibling.outcome).toBe('deny');
    if (sibling.outcome !== 'deny') return;
    expect(sibling.denial.code).toBe('cross-project-denied');
  });

  it('a tenant-scoped resource without workspace/project needs only tenant membership', () => {
    const decision = decisionOf(
      evaluate(
        asRequest({
          resource: { resourceType: 'report', resourceId: 'report:q1', tenantId: IDS.TENANT_ACME },
        }),
        asContext(),
      ),
    );
    expect(decision.outcome).toBe('allow');
  });

  it('not-applicable for a platform-scoped resource (no tenant id)', () => {
    const decision = decisionOf(
      evaluate(
        asRequest({
          resource: { resourceType: 'platform-settings', resourceId: 'platform:epoch' },
        }),
        asContext(),
      ),
    );
    expect(decision.outcome).toBe('not-applicable');
    if (decision.outcome !== 'not-applicable') return;
    expect(decision.reason).toBe('resource-not-tenant-scoped');
    expect(decision.evidence).toEqual(['request.resource.tenantId']);
  });
});

describe('deterministic serialization (positive)', () => {
  it('decisions are content-addressed: the digest is stable and key-order independent', () => {
    const first = decisionOf(evaluate(asRequest(), asContext()));
    const digest = computeAuthorizationDecisionDigest(first);
    // Same content, members inserted in a different order — canonical JSON
    // normalizes key order, so the digest is identical.
    const rekeyed = { ...first } as Record<string, unknown>;
    const reordered: Record<string, unknown> = {};
    for (const key of Object.keys(rekeyed).reverse()) {
      reordered[key] = rekeyed[key];
    }
    expect(computeAuthorizationDecisionDigest(reordered as never)).toBe(digest);
  });

  it('non-deterministic ordering asserted against: shuffled contexts yield byte-identical decisions', () => {
    const base = decisionOf(evaluate(asRequest(), asContext()));
    const shuffled = decisionOf(
      evaluate(
        asRequest(),
        asContext({
          principals: [...(context().principals as unknown[])].reverse(),
          memberships: [...(context().memberships as unknown[])].reverse(),
          knownTenants: [...(context().knownTenants as unknown[])].reverse(),
        }),
      ),
    );
    expect(computeAuthorizationDecisionDigest(shuffled)).toBe(
      computeAuthorizationDecisionDigest(base),
    );
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(base));
  });

  it('the decision answers the exact request revision (requestDigest matches)', () => {
    const req = asRequest();
    const decision = decisionOf(evaluate(req, asContext()));
    expect(decision.requestDigest).toBe(computeAuthorizationRequestDigest(req));
  });

  it('duplicate memberships are the same fact (deduplicated, deterministic)', () => {
    const single = decisionOf(evaluate(asRequest(), asContext()));
    const duplicated = decisionOf(
      evaluate(
        asRequest(),
        asContext({
          memberships: [...(context().memberships as unknown[]), ...(context().memberships as unknown[])],
        }),
      ),
    );
    expect(JSON.stringify(duplicated)).toBe(JSON.stringify(single));
  });
});

describe('sealing + round-trips (positive)', () => {
  it('sealAuthorizationDecision round-trips through parseSealedAuthorizationDecision', () => {
    const decision = decisionOf(evaluate(asRequest(), asContext()));
    const sealed = sealAuthorizationDecision(decision);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const parsed = parseSealedAuthorizationDecision(sealed.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.decision).toEqual(sealed.value.decision);
  });
});

describe('policy-target projection (positive)', () => {
  it('projects a request onto the W004 target shape 1:1', () => {
    const target = toPolicyTarget(asRequest());
    expect(target).toEqual({
      tenantId: IDS.TENANT_ACME,
      workspaceId: IDS.WS_ACME_ENG,
      projectId: IDS.PROJ_BRIDGE,
      actionKind: 'world.read',
      resourceType: 'world',
      tags: undefined,
    });
  });

  it('a principal with inactive or unauthenticated facts still parses (decisions, not admission)', () => {
    // Facts are INPUTS, not stored principals: the evaluator denies them
    // (see isolation.negative.test.ts) but admission is not the registry's
    // concern here.
    const suspended = decisionOf(
      evaluate(
        asRequest(),
        asContext({ principals: [adaFact({ status: 'suspended' }), ...(context().principals as unknown[]).slice(1)] }),
      ),
    );
    expect(suspended.outcome).toBe('deny');
  });
});
