// Registry positive coverage: decision recording, chain growth, approval
// requests, snapshot determinism + restore round-trip.
import { describe, expect, it } from 'vitest';
import {
  ActionPolicyRegistry,
  verifyDecisionChain,
} from '../src/index';
import {
  APPROVER_1,
  chainHead,
  changedPolicySet,
  evaluationInput,
  plainProposal,
  TENANT_A,
  TENANT_B,
  T1,
  T2,
  unwrap,
} from './helpers';

describe('recordDecision', () => {
  it('records an allow decision with a null chain link (first of the chain)', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    expect(decision.outcome).toBe('allow');
    expect(decision.previousDecisionDigest).toBeNull();
    expect(unwrap(registry.getDecision(decision.contentDigest)).contentDigest).toBe(
      decision.contentDigest,
    );
  });

  it('chains a re-decision of the same proposal under a changed policy set', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: plainProposal(), policies: changedPolicySet() }),
      ),
    );
    expect(second.policySetDigest).not.toBe(first.policySetDigest);
    expect(second.previousDecisionDigest).toBe(first.contentDigest);
    const chain = unwrap(registry.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chain).toHaveLength(2);
    expect(chainHead(chain).contentDigest).toBe(second.contentDigest);
  });

  it('opens an approval request for a requires-approval decision', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
    expect(decision.outcome).toBe('requires-approval');
    const request = unwrap(registry.approvalRequest(decision.contentDigest));
    expect(request.status).toBe('pending');
    expect(request.approvals).toHaveLength(0);
    expect(request.directive.quorum.approvals).toBe(1);
  });

  it('opens NO request for allow/deny decisions', () => {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(
      registry.recordDecision(evaluationInput({ proposal: plainProposal() })),
    );
    const request = registry.approvalRequest(decision.contentDigest);
    expect(request.ok).toBe(false);
    if (!request.ok) {
      expect(request.error.code).toBe('unknown-decision');
    }
  });
});

describe('snapshot determinism + restore round-trip', () => {
  function populatedRegistry(): ActionPolicyRegistry {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
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
    unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: plainProposal({ proposalId: 'prop-2025-0043' }) }),
      ),
    );
    return registry;
  }

  it('emits byte-identical snapshots for the same admission history', () => {
    const snapshotA = populatedRegistry().snapshot();
    const snapshotB = populatedRegistry().snapshot();
    expect(JSON.stringify(snapshotA)).toBe(JSON.stringify(snapshotB));
  });

  it('restores a registry from a snapshot (state round-trip)', () => {
    const original = populatedRegistry();
    const restored = unwrap(ActionPolicyRegistry.fromSnapshot(original.snapshot()));
    expect(JSON.stringify(restored.snapshot())).toBe(JSON.stringify(original.snapshot()));
    // The restored registry keeps admitting new records consistently.
    const next = unwrap(
      restored.recordDecision(
        evaluationInput({
          proposal: plainProposal({ proposalId: 'prop-2025-0044' }),
          decidedAt: T2,
        }),
      ),
    );
    expect(next.previousDecisionDigest).toBeNull();
    // The approved request state survived the round-trip.
    const approved = restored
      .snapshot()
      .requests.find((request) => request.status === 'approved');
    expect(approved).toBeDefined();
    expect(approved?.approvals).toHaveLength(1);
    expect(approved?.approvals[0]?.decidedBy.id).toBe(APPROVER_1.id);
  });

  it('restores with the host tenant pin intact', () => {
    const registry = new ActionPolicyRegistry({ expectedTenantId: TENANT_A });
    unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    const restored = unwrap(
      ActionPolicyRegistry.fromSnapshot(registry.snapshot(), { expectedTenantId: TENANT_A }),
    );
    const foreign = restored.recordDecision(
      evaluationInput({ tenantId: TENANT_B, proposal: plainProposal() }),
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe('tenant-isolation-rejected');
    }
  });

  it('rejects a tampered snapshot (decision digest tamper detection)', () => {
    const snapshot = populatedRegistry().snapshot();
    const tampered = {
      ...snapshot,
      decisions: snapshot.decisions.map((decision) =>
        decision.outcome === 'allow'
          ? { ...decision, decidedAt: '2026-06-06T06:06:06.006Z' }
          : decision,
      ),
    };
    const outcome = ActionPolicyRegistry.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('digest-mismatch');
  });

  it('rejects a snapshot with an inconsistent request state', () => {
    const snapshot = populatedRegistry().snapshot();
    // The approved request (1 approval, quorum 1) is tampered to 'pending'
    // — a pending request already meeting its quorum is inconsistent.
    const tampered = {
      ...snapshot,
      requests: snapshot.requests.map((request) =>
        request.status === 'approved' ? { ...request, status: 'pending' } : request,
      ),
    };
    const outcome = ActionPolicyRegistry.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('quorum');
  });

  it('rejects a version-skewed snapshot (schemaVersion gate)', () => {
    const snapshot = { ...populatedRegistry().snapshot(), schemaVersion: 2 };
    const outcome = ActionPolicyRegistry.fromSnapshot(snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('restores and re-verifies decision chains', () => {
    const registry = new ActionPolicyRegistry();
    unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: { ...plainProposal(), rationale: 'revised' } }),
      ),
    );
    const restored = unwrap(ActionPolicyRegistry.fromSnapshot(registry.snapshot()));
    const chain = unwrap(restored.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chain).toHaveLength(2);
    expect(verifyDecisionChain(chain).ok).toBe(true);
  });
});
