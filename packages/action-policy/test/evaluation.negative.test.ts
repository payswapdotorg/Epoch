// Negative evaluation coverage: malformed inputs are typed validation
// errors — NEVER an implicit decision (fail-closed everywhere).
import { describe, expect, it } from 'vitest';
import { evaluateActionPolicy } from '../src/index';
import {
  approvalProposal,
  evaluationInput,
  plainProposal,
  policySet,
  TENANT_A,
  T0,
  T1,
} from './helpers';

describe('evaluateActionPolicy — typed validation failures', () => {
  it('rejects a malformed proposal (W003 schema-violation, precise paths)', () => {
    const proposal = plainProposal() as Record<string, unknown>;
    delete proposal.predictedEffects;
    const outcome = evaluateActionPolicy(evaluationInput({ proposal }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.proposal');
  });

  it('rejects a proposal with a wrong protocol version (version gate first)', () => {
    const proposal = { ...plainProposal(), protocolVersion: '2.0.0' };
    const outcome = evaluateActionPolicy(evaluationInput({ proposal }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('version');
  });

  it('rejects a non-object proposal root', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ proposal: 42 }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects malformed policy documents with re-pathed issue paths', () => {
    const badPolicy = {
      languageVersion: '1.0.0',
      id: 'NOT-KEBAB',
      version: '1.0.0',
      name: 'Bad policy',
      enabled: true,
      applicability: {},
      bindings: [{ constraintId: 'hard-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    };
    const outcome = evaluateActionPolicy(evaluationInput({ policies: [badPolicy] }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.policies[0]');
  });

  it('rejects a non-array policy set', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ policies: 'not-a-policy-set' as unknown as unknown[] }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.policies');
  });

  it('rejects a malformed tenant id (W009 grammar)', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ tenantId: 'acme' }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects a malformed scope (W009 grammar)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ scope: { workspaceId: 'not-a-workspace' } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('requires the approval directive for proposals that demand human approval', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ approval: null }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.approval');
    expect(JSON.stringify(outcome.error)).toContain('deadline');
  });

  it('rejects an approval deadline before the decision instant (inclusive boundary)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ approval: { deadline: T0, maxDelegationDepth: 1 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('deadline');
  });

  it('admits an approval deadline AT the decision instant (inclusive boundary)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ approval: { deadline: T1, maxDelegationDepth: 1 } }),
    );
    expect(outcome.ok).toBe(true);
  });

  it('rejects an out-of-bound delegation depth in the directive input', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ approval: { deadline: '2025-01-18T10:00:00.000Z', maxDelegationDepth: 99 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects a proposal whose authority requirements carry no quorum (W003 invariant)', () => {
    const proposal = {
      ...approvalProposal(),
      authorityRequirements: {
        requiredScopes: ['world:write'],
        requiresHumanApproval: true,
        // approvalQuorum missing: the W003 schema refinement rejects it
        // before the evaluation mapping ever sees it.
      },
    };
    const outcome = evaluateActionPolicy(evaluationInput({ proposal }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('never returns an implicit decision for malformed input (always typed)', () => {
    const malformed: unknown[] = [null, 7, [], 'x', { nonsense: true }];
    for (const proposal of malformed) {
      const input = { ...evaluationInput({}), proposal };
      const outcome = evaluateActionPolicy(input);
      expect(outcome.ok, `proposal ${JSON.stringify(proposal)}`).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe('validation');
      }
    }
  });
});

describe('evaluateActionPolicy — policy-target scope semantics (W004 verbatim)', () => {
  it('a policy scoped to another tenant does not apply (denied no-applicable-policy)', () => {
    const foreignPolicy = policySet({ dropTenantScope: false }) as {
      applicability: { tenantId: string };
    }[];
    foreignPolicy[0]!.applicability.tenantId = 'tenant:other';
    const outcome = evaluateActionPolicy(
      evaluationInput({ policies: foreignPolicy, tenantId: TENANT_A }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('deny');
    expect(outcome.value.content.denial?.code).toBe('no-applicable-policy');
  });
});
