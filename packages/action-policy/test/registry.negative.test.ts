// Registry negative coverage: the typed rejection taxonomy, one test per
// named code — the W022 dispatch pin's negative battery.
import { describe, expect, it } from 'vitest';
import { ActionPolicyRegistry } from '../src/index';
import {
  APPROVER_1,
  APPROVER_2,
  evaluationInput,
  GATEWAY,
  plainProposal,
  TENANT_A,
  TENANT_B,
  T1,
  T2,
  unwrap,
} from './helpers';

function approvalRegistry() {
  const registry = new ActionPolicyRegistry();
  const decision = unwrap(registry.recordDecision(evaluationInput()));
  return { registry, decision };
}

describe('tenant isolation (R12)', () => {
  it('rejects a cross-tenant proposal reference (tenant-isolation-rejected)', () => {
    const { registry } = approvalRegistry();
    // The SAME exact proposal revision (same digest) submitted under
    // another tenant: the revision is grounded in tenant A.
    const outcome = registry.recordDecision(evaluationInput({ tenantId: TENANT_B }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });

  it('admits a DIFFERENT proposal revision under another tenant (per-tenant decisions)', () => {
    const { registry } = approvalRegistry();
    const outcome = registry.recordDecision(
      evaluationInput({ tenantId: TENANT_B, proposal: plainProposal({ proposalId: 'prop-globex-1' }) }),
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.tenantId).toBe(TENANT_B);
      expect(outcome.value.previousDecisionDigest).toBeNull();
    }
  });

  it('rejects a cross-tenant approval of another tenant decision', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_B,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });

  it('rejects foreign-tenant operations on a tenant-pinned registry', () => {
    const registry = new ActionPolicyRegistry({ expectedTenantId: TENANT_A });
    const outcome = registry.recordDecision(evaluationInput({ tenantId: TENANT_B }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });

  it('rejects cross-tenant chain reads', () => {
    const { registry } = approvalRegistry();
    const outcome = registry.decisionChainFor(TENANT_B, 'prop-2025-0042');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('unknown / wrong-kind decisions', () => {
  it('rejects an approval for an unknown decision (unknown-decision)', () => {
    const { registry } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: 'c'.repeat(64),
      proposalRef: { proposalId: 'prop-2025-0042', canonicalDigest: 'd'.repeat(64) },
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('unknown-decision');
  });

  it('rejects an approval of a non-approval decision (decision-not-awaiting-approval)', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('decision-not-awaiting-approval');
  });
});

describe('proposal drift', () => {
  it('rejects an approval of a drifted proposal revision (proposal-drift-rejected)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: {
        proposalId: decision.proposalRef.proposalId,
        canonicalDigest: 'e'.repeat(64), // a DIFFERENT revision
      },
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('proposal-drift-rejected');
    expect(outcome.error.code === 'proposal-drift-rejected' && outcome.error.expectedProposalDigest)
      .toBe(decision.proposalRef.canonicalDigest);
  });

  it('rejects a rejection of a drifted proposal revision (proposal-drift-rejected)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordRejection({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: { proposalId: 'prop-other', canonicalDigest: 'e'.repeat(64) },
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      reason: 'drifted',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('proposal-drift-rejected');
  });
});

describe('approver roles', () => {
  it('rejects an action-gateway authorizer as approver (approver-role-rejected)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: GATEWAY,
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approver-role-rejected');
  });

  it('rejects an approver acting outside the quorum roles (approver-role-rejected)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'junior-intern',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approver-role-rejected');
  });
});

describe('delegation abuse', () => {
  it('rejects delegation deeper than the directive maximum (delegation-depth-exceeded)', () => {
    const { registry, decision } = approvalRegistry();
    // Directive maxDelegationDepth = 1; a path of 3 approvers = depth 2.
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      delegationPath: ['principal:eng-director', 'principal:eng-manager', 'principal:eng-lead'],
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('delegation-depth-exceeded');
    expect(outcome.error.code === 'delegation-depth-exceeded' && outcome.error.encounteredDepth).toBe(2);
  });

  it('rejects a circular delegation path (delegation-cycle)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      delegationPath: ['principal:eng-lead', 'principal:eng-manager', 'principal:eng-lead'],
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('delegation-cycle');
  });

  it('rejects a delegation path not ending at the acting approver (validation)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      // The path ends at a DIFFERENT approver than the acting one.
      delegationPath: ['principal:eng-manager'],
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('admits a within-bound delegated approval (depth 1 of max 1)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      delegationPath: ['principal:eng-director', 'principal:eng-lead'],
      at: T1,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.delegation.depth).toBe(1);
      expect(outcome.value.delegation.path).toEqual(['principal:eng-director', 'principal:eng-lead']);
    }
  });
});

describe('deadline expiry (typed)', () => {
  it('rejects an approval after the deadline (approval-deadline-expired)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: '2025-01-19T00:00:00.000Z', // past the 2025-01-18 deadline
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-deadline-expired');
  });

  it('admits an approval AT the deadline instant (inclusive boundary)', () => {
    const { registry, decision } = approvalRegistry();
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: '2025-01-18T10:00:00.000Z',
    });
    expect(outcome.ok).toBe(true);
  });
});

describe('settled requests (fail-closed terminal states)', () => {
  it('rejects approvals after the quorum was met (approval-request-settled)', () => {
    const { registry, decision } = approvalRegistry();
    unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_2,
      asRole: 'lead-reviewer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-request-settled');
    expect(outcome.error.code === 'approval-request-settled' && outcome.error.status).toBe('approved');
  });

  it('rejects approvals after a rejection (approval-request-settled)', () => {
    const { registry, decision } = approvalRegistry();
    unwrap(
      registry.recordRejection({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        reason: 'No.',
        at: T1,
      }),
    );
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_2,
      asRole: 'lead-reviewer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-request-settled');
    expect(outcome.error.code === 'approval-request-settled' && outcome.error.status).toBe('rejected');
  });

  it('rejects approvals after expiry (approval-request-settled)', () => {
    const { registry, decision } = approvalRegistry();
    registry.expireApprovals('2025-01-19T00:00:00.000Z');
    const outcome = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T2,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-request-settled');
    expect(outcome.error.code === 'approval-request-settled' && outcome.error.status).toBe('expired');
  });
});
