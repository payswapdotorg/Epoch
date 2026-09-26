// Digest discipline: round-trip serialization + digest verification for
// every public record type, tamper detection, and chain verification.
import { describe, expect, it } from 'vitest';
import {
  ActionPolicyRegistry,
  sealApproval,
  sealDecision,
  verifyDecisionChain,
  verifySealedApproval,
  verifySealedDecision,
  verifySealedExpiry,
  verifySealedRejection,
} from '../src/index';
import {
  APPROVER_1,
  APPROVER_2,
  chainHead,
  evaluationInput,
  plainProposal,
  TENANT_A,
  T1,
  unwrap,
} from './helpers';

function recordedDecision() {
  const registry = new ActionPolicyRegistry();
  return unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
}

describe('decision sealing + round-trip', () => {
  it('seals valid content and verifies it (digest round-trip)', () => {
    const decision = recordedDecision();
    const roundTrip = verifySealedDecision(JSON.parse(JSON.stringify(decision)));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.ok && roundTrip.value.contentDigest).toBe(decision.contentDigest);
  });

  it('rejects a tampered decision digest (typed digest-mismatch)', () => {
    const decision = recordedDecision();
    const tampered = {
      ...decision,
      contentDigest: 'f'.repeat(64),
    };
    const outcome = verifySealedDecision(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok || outcome.error.code !== 'digest-mismatch') return;
    expect(outcome.error.expected).toBe(decision.contentDigest);
    expect(outcome.error.encountered).toBe('f'.repeat(64));
  });

  it('rejects a tampered decision CONTENT (digest no longer matches)', () => {
    const decision = recordedDecision();
    const tampered = { ...decision, decidedAt: '2026-01-01T00:00:00.000Z' };
    const outcome = verifySealedDecision(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('digest-mismatch');
  });

  it('rejects a malformed decision record (typed validation)', () => {
    const outcome = verifySealedDecision({ nonsense: true });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects a version-skewed decision record (schemaVersion gate)', () => {
    const decision = { ...recordedDecision(), schemaVersion: 2 };
    const outcome = verifySealedDecision(decision);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('seals through sealDecision with an explicit chain link', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: { ...plainProposal(), rationale: 'changed' } }),
      ),
    );
    expect(second.previousDecisionDigest).toBe(first.contentDigest);
    const { contentDigest: originalDigest, ...content } = second;
    const sealed = sealDecision(content, second.previousDecisionDigest);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.contentDigest).toBe(originalDigest);
    }
  });
});

describe('approval/rejection/expiry sealing + round-trips', () => {
  function approvalFixture() {
    const registry = new ActionPolicyRegistry();
    const decision = unwrap(registry.recordDecision(evaluationInput()));
    return { registry, decision };
  }

  it('seals and verifies an approval record (round-trip + digest)', () => {
    const { registry, decision } = approvalFixture();
    const approval = unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    const roundTrip = verifySealedApproval(JSON.parse(JSON.stringify(approval)));
    expect(roundTrip.ok).toBe(true);
    const tampered = verifySealedApproval({ ...approval, note: 'tampered' });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.error.code).toBe('digest-mismatch');
    }
  });

  it('seals through sealApproval and rejects tampered digests', () => {
    const { registry, decision } = approvalFixture();
    const approval = unwrap(
      registry.recordApproval({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_2,
        asRole: 'lead-reviewer',
        at: T1,
      }),
    );
    const { contentDigest: originalDigest, ...content } = approval;
    const resealed = sealApproval(content);
    expect(resealed.ok).toBe(true);
    if (resealed.ok) {
      expect(resealed.value.contentDigest).toBe(originalDigest);
    }
  });

  it('seals and verifies a rejection record', () => {
    const { registry, decision } = approvalFixture();
    const rejection = unwrap(
      registry.recordRejection({
        tenantId: TENANT_A,
        decisionDigest: decision.contentDigest,
        proposalRef: decision.proposalRef,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        reason: 'The simulation evidence is stale.',
        at: T1,
      }),
    );
    expect(verifySealedRejection(JSON.parse(JSON.stringify(rejection))).ok).toBe(true);
    const tampered = verifySealedRejection({ ...rejection, reason: 'no reason' });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.error.code).toBe('digest-mismatch');
    }
  });

  it('seals and verifies an expiry record (typed approval-timeout)', () => {
    const registry = new ActionPolicyRegistry();
    unwrap(registry.recordDecision(evaluationInput()));
    const expired = registry.expireApprovals('2025-01-19T00:00:00.000Z');
    expect(expired).toHaveLength(1);
    expect(verifySealedExpiry(JSON.parse(JSON.stringify(expired[0]!))).ok).toBe(true);
    const tampered = verifySealedExpiry({ ...expired[0]!, expiredAt: '2025-01-01T00:00:00.000Z' });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) {
      expect(tampered.error.code).toBe('digest-mismatch');
    }
  });
});

describe('decision chain verification (W023 version-chain style)', () => {
  it('verifies an intact chain (first link null, then digest-to-digest)', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: { ...plainProposal(), rationale: 'revised rationale' } }),
      ),
    );
    expect(first.previousDecisionDigest).toBeNull();
    expect(second.previousDecisionDigest).toBe(first.contentDigest);
    const chain = unwrap(registry.decisionChainFor(TENANT_A, 'prop-2025-0042'));
    expect(chain.map((record) => record.contentDigest)).toEqual([
      first.contentDigest,
      second.contentDigest,
    ]);
    expect(verifyDecisionChain(chain).ok).toBe(true);
  });

  it('rejects a broken chain link (typed chain-broken)', () => {
    const registry = new ActionPolicyRegistry();
    const first = unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    const second = unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: { ...plainProposal(), rationale: 'revised rationale' } }),
      ),
    );
    const broken = [{ ...second, previousDecisionDigest: 'a'.repeat(64) }, first];
    const outcome = verifyDecisionChain(broken);
    expect(outcome.ok).toBe(false);
    if (outcome.ok || outcome.error.code !== 'chain-broken') return;
    expect(outcome.error.encountered).toBe('a'.repeat(64));
  });

  it('rejects a chain whose first record carries a non-null link (typed chain-broken)', () => {
    const decision = recordedDecision();
    // Re-seal the content VALIDLY with a bogus chain link: the record is
    // internally consistent (its digest covers the link), but the chain
    // still cannot start from a non-null link.
    const { contentDigest: originalDigest, ...content } = decision;
    const resealed = unwrap(sealDecision(content, 'b'.repeat(64)));
    const outcome = verifyDecisionChain([resealed]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok || outcome.error.code !== 'chain-broken') return;
    expect(outcome.error.expected).toBeNull();
    expect(outcome.error.encountered).toBe('b'.repeat(64));
    expect(resealed.contentDigest).not.toBe(originalDigest);
  });

  it('verifies through the registry (verifyDecisionChain)', () => {
    const registry = new ActionPolicyRegistry();
    unwrap(registry.recordDecision(evaluationInput({ proposal: plainProposal() })));
    unwrap(
      registry.recordDecision(
        evaluationInput({ proposal: { ...plainProposal(), rationale: 'revised' } }),
      ),
    );
    const verified = unwrap(registry.verifyDecisionChain(TENANT_A, 'prop-2025-0042'));
    expect(verified).toHaveLength(2);
    expect(chainHead(verified).previousDecisionDigest).toBe(verified[0]!.contentDigest);
  });
});
