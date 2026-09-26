// Replay/idempotency coverage (the W022 dispatch pin): duplicate decisions
// echo the SAME decision identity, duplicate approvals echo the sealed
// approval, and a re-evaluation under a CHANGED policy set is a NEW
// decision (the policy digest carried on every record).
import { describe, expect, it } from 'vitest';
import { ActionPolicyRegistry } from '../src/index';
import {
  APPROVER_1,
  APPROVER_2,
  approvalProposal,
  chainHead,
  changedPolicySet,
  evaluationInput,
  plainProposal,
  TENANT_A,
  T1,
  T2,
  unwrap,
} from './helpers';

describe('duplicate-decision (idempotent replay)', () => {
  it('the same proposal digest under the same policy-set digest returns the SAME decision identity', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal(), decidedAt: T1 })),
    );
    const replay = registry.recordDecision(
      evaluationInput({ proposal: plainProposal(), decidedAt: T2 }),
    );
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe('duplicate-decision');
    if (replay.error.code !== 'duplicate-decision') return;
    // The SAME decision identity is echoed.
    expect(replay.error.existingDecisionDigest).toBe(first.contentDigest);
    expect(replay.error.existingDecision.contentDigest).toBe(first.contentDigest);
    // State unchanged: still exactly one decision in the chain.
    const chain = unwrap(registry.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chain).toHaveLength(1);
  });

  it('a re-evaluation under a CHANGED policy set is a NEW decision (policy-digest on every record)', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: plainProposal(), policies: changedPolicySet(), decidedAt: T2 }),
      ),
    );
    expect(second.contentDigest).not.toBe(first.contentDigest);
    expect(second.policySetDigest).not.toBe(first.policySetDigest);
    expect(second.previousDecisionDigest).toBe(first.contentDigest);
    const chain = unwrap(registry.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chain.map((record) => record.policySetDigest)).toEqual([
      first.policySetDigest,
      second.policySetDigest,
    ]);
    // A replay of the FIRST policy set is still the same identity (its
    // idempotency key stands independently per policy-set digest).
    const replayFirst = registry.recordDecision(
      evaluationInput({ proposal: plainProposal() }),
    );
    expect(replayFirst.ok).toBe(false);
    if (!replayFirst.ok) {
      expect(replayFirst.error.code).toBe('duplicate-decision');
      if (replayFirst.error.code === 'duplicate-decision') {
        expect(replayFirst.error.existingDecisionDigest).toBe(first.contentDigest);
      }
    }
  });

  it('a REVISED proposal (new digest, same proposal id) is a new chained decision', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({
          proposal: { ...plainProposal(), rationale: 'revised after review' },
          decidedAt: T2,
        }),
      ),
    );
    expect(second.proposalRef.canonicalDigest).not.toBe(first.proposalRef.canonicalDigest);
    expect(second.previousDecisionDigest).toBe(first.contentDigest);
  });

  it('the duplicate negative does not suppress approval-request opening on the FIRST admission', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
    const request = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(request.status).toBe('pending');
    const replay = registry.recordDecision(evaluationInput({ decidedAt: T2 }));
    expect(replay.ok).toBe(false);
    const requestAfter = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(requestAfter.status).toBe('pending');
    expect(requestAfter.approvals).toHaveLength(0);
  });
});

describe('duplicate-approval (idempotent replay)', () => {
  it('an approval replayed twice returns the sealed result (state unchanged)', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
    const first = unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        note: 'LGTM',
        at: T1,
      }),
    );
    const replay = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: decision.contentDigest,
      proposalRef: decision.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      // Even with drifted aux fields, the (request, approver) replay is
      // the idempotent duplicate: the FIRST sealed approval stands.
      note: 'different note on replay',
      at: T2,
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe('duplicate-approval');
    if (replay.error.code !== 'duplicate-approval') return;
    expect(replay.error.approverId).toBe(APPROVER_1.id);
    expect(replay.error.existingApproval.contentDigest).toBe(first.contentDigest);
    expect(replay.error.existingApproval.note).toBe('LGTM');
    // State unchanged: one approval, request settled once.
    const request = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(request.approvals).toHaveLength(1);
    expect(request.status).toBe('approved');
  });

  it('a DISTINCT approver is not a duplicate (quorum counting is per approver)', () => {
    const registry = new ActionPolicyRegistry();
    // Quorum 2: build a two-approver proposal.
    const proposal = {
      ...approvalProposal(),
      authorityRequirements: {
        requiredScopes: ['world:write'],
        requiresHumanApproval: true,
        approvalQuorum: { approvals: 2, roles: ['senior-structural-engineer', 'lead-reviewer'] },
      },
    };
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal, approval: { deadline: '2025-01-18T10:00:00.000Z', maxDelegationDepth: 1 } })),
    );
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
    const requestMid = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(requestMid.status).toBe('pending');
    unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_2,
        asRole: 'lead-reviewer',
        at: T1,
      }),
    );
    const requestDone = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(requestDone.status).toBe('approved');
    expect(requestDone.approvals).toHaveLength(2);
  });
});

describe('policy re-evaluation semantics (supersession)', () => {
  it('a re-decision under a changed policy set SUPERSEDES the pending approval request', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput()));
    const request = unwrap(registry.approvalRequest(first.contentDigest));
    expect(request.status).toBe('pending');
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ policies: changedPolicySet(), decidedAt: T2 }),
      ),
    );
    expect(second.outcome).toBe('requires-approval');
    const superseded = unwrap(registry.approvalRequest(first.contentDigest));
    expect(superseded.status).toBe('superseded');
    expect(superseded.supersededBy).toBe(second.contentDigest);
    // Approvals against the superseded request are settled.
    const lateApproval = registry.recordApproval({
      tenantId: TENANT_A,
      decisionDigest: first.contentDigest,
      proposalRef: first.proposalRef,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: T2,
    });
    expect(lateApproval.ok).toBe(false);
    if (!lateApproval.ok) {
      expect(lateApproval.error.code).toBe('approval-request-settled');
    }
    // The NEW decision's request is open.
    const newRequest = unwrap(registry.approvalRequest(second.contentDigest));
    expect(newRequest.status).toBe('pending');
  });

  it('an approved request is also superseded by a re-decision (approvals never transfer)', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput()));
    unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: first.contentDigest,
        proposalRef: first.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    expect(unwrap(registry.approvalRequest(first.contentDigest)).status).toBe('approved');
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ policies: changedPolicySet(), decidedAt: T2 }),
      ),
    );
    const superseded = unwrap(registry.approvalRequest(first.contentDigest));
    expect(superseded.status).toBe('superseded');
    expect(superseded.supersededBy).toBe(second.contentDigest);
    // The approvals stay on the historical record but authorize nothing new.
    expect(superseded.approvals).toHaveLength(1);
    const chain = unwrap(registry.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chainHead(chain).contentDigest).toBe(second.contentDigest);
  });

  it('a rejected request is terminal — a re-decision does not resurrect it', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput()));
    unwrap(
      registry.recordRejection({
        tenantId: TENANT_A,
        decisionDigest: first.contentDigest,
        proposalRef: first.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        reason: 'Rejected on safety grounds.',
        at: T1,
      }),
    );
    unwrap(
      registry.recordDecision(evaluationInput({ policies: changedPolicySet(), decidedAt: T2 })),
    );
    const rejected = unwrap(registry.approvalRequest(first.contentDigest));
    expect(rejected.status).toBe('rejected');
  });

  it('a re-decision after expiry keeps the expiry terminal (history is append-only)', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput()));
    registry.expireApprovals('2025-01-19T00:00:00.000Z');
    unwrap(
      registry.recordDecision(evaluationInput({ policies: changedPolicySet(), decidedAt: T2 })),
    );
    const expired = unwrap(registry.approvalRequest(first.contentDigest));
    expect(expired.status).toBe('expired');
  });
});
