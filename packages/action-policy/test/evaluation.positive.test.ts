// Positive evaluation coverage: the deterministic outcome mapping over the
// W004 composite (allow / deny / requires-approval), full provenance, the
// policy-set digest, and order-independence.
import { describe, expect, it } from 'vitest';
import {
  canonicalizePolicySet,
  evaluateActionPolicy,
  toActionPolicyTarget,
} from '../src/index';
import {
  approvalProposal,
  changedPolicySet,
  emptyResolver,
  evaluationInput,
  plainProposal,
  policySet,
  TENANT_A,
  WORKSPACE,
  T1,
  unwrap,
} from './helpers';

describe('evaluateActionPolicy — outcomes', () => {
  it('allows a compliant proposal that does not require human approval', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ proposal: plainProposal(), spend: 10 }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('allow');
    expect(outcome.value.content.denial).toBeUndefined();
    expect(outcome.value.content.approval).toBeUndefined();
  });

  it('maps an allow-with-penalties composite to allow (penalties carried in provenance)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({
        proposal: plainProposal(),
        policies: changedPolicySet(),
        scope: { workspaceId: WORKSPACE },
        spend: 50,
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('allow');
    expect(outcome.value.composite.decision).toBe('allow-with-penalties');
    expect(outcome.value.composite.totalPenalty).toBe(4);
  });

  it('requires approval for a compliant proposal that demands human approval', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ spend: 10 }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { content } = outcome.value;
    expect(content.outcome).toBe('requires-approval');
    expect(content.approval).toBeDefined();
    expect(content.approval?.quorum).toEqual({
      approvals: 1,
      roles: ['senior-structural-engineer', 'lead-reviewer'],
    });
    expect(content.approval?.approverScope).toEqual({ tenantId: TENANT_A });
    expect(content.approval?.deadline).toBe('2025-01-18T10:00:00.000Z');
    expect(content.approval?.maxDelegationDepth).toBe(1);
  });

  it('carries the workspace/project scope into the approver scope', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({ scope: { workspaceId: WORKSPACE } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.approval?.approverScope).toEqual({
      tenantId: TENANT_A,
      workspaceId: WORKSPACE,
    });
  });

  it('denies constraint-blocked proposals with the blocking provenance', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ spend: 150 }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { content } = outcome.value;
    expect(content.outcome).toBe('deny');
    expect(content.denial?.code).toBe('constraint-blocked');
    expect(content.denial?.reason).toContain('hard-budget');
    expect(content.provenance.composite.blocking).toHaveLength(1);
    expect(content.provenance.composite.blocking[0]?.constraintId).toBe('hard-budget');
  });

  it('denies fail-closed on unresolved constraints (typed unresolved-constraint)', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ resolveConstraint: emptyResolver }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('deny');
    expect(outcome.value.content.denial?.code).toBe('unresolved-constraint');
  });

  it('denies out-of-policy actions (typed no-applicable-policy, never fail-open)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({
        proposal: plainProposal({ actionTypeId: 'hvac.filter.replace' }),
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('deny');
    expect(outcome.value.content.denial?.code).toBe('no-applicable-policy');
    expect(outcome.value.composite.decision).toBe('not-applicable');
  });

  it('denies expired proposals (typed proposal-expired) with provenance still carried', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({
        proposal: plainProposal({ expiresAt: '2025-01-15T11:00:00.000Z' }),
        decidedAt: T1,
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { content } = outcome.value;
    expect(content.outcome).toBe('deny');
    expect(content.denial?.code).toBe('proposal-expired');
    // The policy evaluation still happened: provenance is complete.
    expect(content.provenance.composite.decision).toBe('allow');
  });

  it('evaluates a proposal AT the expiry boundary instant normally (inclusive boundary)', () => {
    const outcome = evaluateActionPolicy(
      evaluationInput({
        proposal: plainProposal({ expiresAt: T1 }),
        decidedAt: T1,
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.content.outcome).toBe('allow');
  });
});

describe('evaluateActionPolicy — provenance and digests', () => {
  it('carries the FULL W004 resolution (matched policies, precedence, trace) verbatim', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ proposal: plainProposal() }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { provenance } = outcome.value.content;
    expect(provenance.resolution.applicable.map((policy) => policy.policyId)).toEqual([
      'tenant-budget-policy',
    ]);
    expect(provenance.resolution.applicable[0]?.precedence).toEqual({ tier: 'tenant', rank: 5 });
    expect(provenance.resolution.bindings).toEqual([{ constraintId: 'hard-budget' }]);
    expect(provenance.resolution.trace).toEqual([
      {
        policyId: 'tenant-budget-policy',
        action: 'add',
        bindingsAdded: 1,
        effectiveBindingCount: 1,
      },
    ]);
    expect(provenance.policies).toEqual([
      { policyId: 'tenant-budget-policy', version: '1.0.0' },
    ]);
  });

  it('addresses the policy set by digest and the proposal by exact revision', () => {
    const outcome = evaluateActionPolicy(evaluationInput({ proposal: plainProposal() }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const canonical = unwrap(canonicalizePolicySet(policySet()));
    expect(outcome.value.content.policySetDigest).toBe(canonical.digest);
    expect(outcome.value.proposalRef.proposalId).toBe('prop-2025-0042');
    expect(outcome.value.proposalRef.canonicalDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.value.content.proposalRef).toEqual(outcome.value.proposalRef);
  });

  it('canonicalizes the policy set in W004 precedence order regardless of input order', () => {
    const ordered = unwrap(canonicalizePolicySet(changedPolicySet()));
    const reversed = unwrap(canonicalizePolicySet([...changedPolicySet()].reverse()));
    expect(reversed.digest).toBe(ordered.digest);
    // The canonical order mirrors the W004 resolution fold order
    // (ascending precedence key: tier, rank, id — later = higher
    // precedence), so the workspace tier precedes the tenant tier here.
    expect(ordered.documents.map((document) => document.id)).toEqual([
      'workspace-preferences',
      'tenant-budget-policy',
    ]);
    // Entries are sorted by policyId (deterministic serialization).
    expect(ordered.entries.map((entry) => entry.policyId)).toEqual([
      'tenant-budget-policy',
      'workspace-preferences',
    ]);
  });

  it('projects the proposal onto the W004 policy target', () => {
    const proposal = approvalProposal();
    expect(toActionPolicyTarget(proposal, TENANT_A, { workspaceId: WORKSPACE })).toEqual({
      tenantId: TENANT_A,
      workspaceId: WORKSPACE,
      projectId: undefined,
      actionKind: 'structural.element.reinforce',
      resourceType: 'world-entity',
      tags: undefined,
    });
  });
});
