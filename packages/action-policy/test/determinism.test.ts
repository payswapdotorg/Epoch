// Determinism coverage: same inputs -> same decision identity; input order
// never leaks into policy-set digests, decision digests or snapshots.
import { describe, expect, it } from 'vitest';
import {
  ActionPolicyRegistry,
  canonicalizePolicySet,
  evaluateActionPolicy,
  sealDecision,
} from '../src/index';
import {
  APPROVER_1,
  approvalProposal,
  changedPolicySet,
  evaluationInput,
  plainProposal,
  policySet,
  TENANT_A,
  T1,
  unwrap,
} from './helpers';

describe('evaluation determinism', () => {
  it('the same proposal + the same policy digest produce the SAME decision identity', () => {
    const inputA = evaluationInput({ proposal: plainProposal(), decidedAt: T1 });
    const inputB = evaluationInput({ proposal: plainProposal(), decidedAt: T1 });
    const a = unwrap(evaluateActionPolicy(inputA));
    const b = unwrap(evaluateActionPolicy(inputB));
    // The sealable content (with a null chain link) digests identically.
    const sealedA = unwrap(sealDecision(a.content, null));
    const sealedB = unwrap(sealDecision(b.content, null));
    expect(sealedA.contentDigest).toBe(sealedB.contentDigest);
  });

  it('policy-set INPUT ORDER never leaks into the digest or the decision', () => {
    const ordered = unwrap(canonicalizePolicySet(changedPolicySet()));
    const reversed = unwrap(canonicalizePolicySet([...changedPolicySet()].reverse()));
    expect(reversed.digest).toBe(ordered.digest);
    const a = unwrap(
      evaluateActionPolicy(
        evaluationInput({
          proposal: plainProposal(),
          policies: changedPolicySet(),
          spend: 50,
        }),
      ),
    );
    const b = unwrap(
      evaluateActionPolicy(
        evaluationInput({
          proposal: plainProposal(),
          policies: [...changedPolicySet()].reverse(),
          spend: 50,
        }),
      ),
    );
    expect(b.content.policySetDigest).toBe(a.content.policySetDigest);
    const sealedA = unwrap(sealDecision(a.content, null));
    const sealedB = unwrap(sealDecision(b.content, null));
    expect(sealedB.contentDigest).toBe(sealedA.contentDigest);
  });

  it('key-order differences inside the proposal never leak (canonical JSON)', () => {
    const proposal = plainProposal();
    const reordered = {
      expiresAt: proposal.expiresAt,
      evidenceRefs: proposal.evidenceRefs,
      rationale: proposal.rationale,
      authorityRequirements: proposal.authorityRequirements,
      reversibility: proposal.reversibility,
      sideEffects: proposal.sideEffects,
      predictedEffects: proposal.predictedEffects,
      preconditions: proposal.preconditions,
      parameters: proposal.parameters,
      target: proposal.target,
      actionType: proposal.actionType,
      proposedBy: proposal.proposedBy,
      proposalId: proposal.proposalId,
      createdAt: proposal.createdAt,
      messageId: proposal.messageId,
      messageKind: proposal.messageKind,
      protocolVersion: proposal.protocolVersion,
    };
    const a = unwrap(evaluateActionPolicy(evaluationInput({ proposal })));
    const b = unwrap(evaluateActionPolicy(evaluationInput({ proposal: reordered })));
    expect(b.proposalRef.canonicalDigest).toBe(a.proposalRef.canonicalDigest);
  });
});

describe('registry determinism', () => {
  it('two registries fed the same admission history hold byte-identical snapshots', () => {
    function history(): ActionPolicyRegistry {
      const registry = new ActionPolicyRegistry();
      unwrap(
        registry.recordDecision(evaluationInput({ proposal: plainProposal(), decidedAt: T1 })),
      );
      const approvalDecision = unwrap(registry.recordDecision(evaluationInput()));
      unwrap(
        registry.recordApproval({
          tenantId: TENANT_A,
          decisionDigest: approvalDecision.contentDigest,
          proposalRef: approvalDecision.proposalRef,
          decidedBy: APPROVER_1,
          asRole: 'senior-structural-engineer',
          at: T1,
        }),
      );
      registry.expireApprovals('2026-01-01T00:00:00.000Z');
      return registry;
    }
    expect(JSON.stringify(history().snapshot())).toBe(JSON.stringify(history().snapshot()));
  });

  it('admission order across independent proposals never leaks into the snapshot', () => {
    const first = plainProposal({ proposalId: 'prop-aaa' });
    const second = plainProposal({ proposalId: 'prop-bbb' });
    const registryA = new ActionPolicyRegistry();
    unwrap(registryA.recordDecision(evaluationInput({ proposal: first })));
    unwrap(registryA.recordDecision(evaluationInput({ proposal: second })));
    const registryB = new ActionPolicyRegistry();
    unwrap(registryB.recordDecision(evaluationInput({ proposal: second })));
    unwrap(registryB.recordDecision(evaluationInput({ proposal: first })));
    expect(JSON.stringify(registryA.snapshot())).toBe(JSON.stringify(registryB.snapshot()));
  });

  it('the expired sweep is deterministic (ordered by decision digest)', () => {
    const registry = new ActionPolicyRegistry();
    unwrap(registry.recordDecision(evaluationInput({ proposal: approvalProposal({ proposalId: 'prop-zzz' }) })));
    unwrap(registry.recordDecision(evaluationInput({ proposal: approvalProposal({ proposalId: 'prop-aaa' }) })));
    const expired = registry.expireApprovals('2026-01-01T00:00:00.000Z');
    expect(expired).toHaveLength(2);
    // Ordered by decision digest (deterministic), covering both requests.
    const ids = expired.map((record) => record.proposalRef.proposalId);
    expect([...ids].sort()).toEqual(['prop-aaa', 'prop-zzz']);
    expect(new Set(ids).size).toBe(2);
    // A re-sweep is idempotent (nothing new expires).
    expect(registry.expireApprovals('2026-02-01T00:00:00.000Z')).toHaveLength(0);
  });
});

describe('policy set digest stability (policy re-evaluation semantics)', () => {
  it('equal policy sets under reordering share one digest; different sets differ', () => {
    const base = unwrap(canonicalizePolicySet(policySet()));
    const reordered = unwrap(canonicalizePolicySet([...policySet()].reverse()));
    const changed = unwrap(canonicalizePolicySet(changedPolicySet()));
    expect(reordered.digest).toBe(base.digest);
    expect(changed.digest).not.toBe(base.digest);
  });
});
