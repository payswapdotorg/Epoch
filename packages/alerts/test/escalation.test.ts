// ESCALATION through the W022 authority seam: typed W003 proposals,
// the policy decision FIRST (all three outcomes exercised), and the
// gateway-bypass negatives.
import { describe, expect, it } from 'vitest';
import { parseActionProposal } from '@epoch/action-protocol';
import {
  buildEscalationProposal,
  computeProposalDigest,
  outcomeKindOfDecision,
  planEscalation,
  recordEscalationOutcome,
  verifySealedEscalationOutcome,
} from '../src/index';
import {
  APPROVER,
  GATEWAY,
  PRINCIPAL,
  PROPOSER,
  TENANT,
  T4,
  T5,
  T6,
  alertChain,
  expectError,
  findingSummary,
  unwrap,
} from './fixtures';

/** One escalation proposal over the standard chain head. */
function proposal(chain: readonly ReturnType<typeof alertChain>[number][], overrides: Record<string, unknown> = {}) {
  return unwrap(
    buildEscalationProposal({
      alert: chain[chain.length - 1]!,
      plan: planEscalation({
        alert: chain[chain.length - 1]!,
        delaySeconds: '1800',
        reNotifyCadenceSeconds: '43200',
        notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
        escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
      }),
      proposalId: 'proposal-escalate-excavate-1',
      messageId: 'message-escalate-excavate-1',
      proposedBy: PROPOSER,
      createdAt: T5,
      rationale: 'blocked critical activity past its plan window',
      ...overrides,
    }),
  );
}

/** One W003 authorization decision bound to a proposal. */
function decision(
  target: ReturnType<typeof proposal>,
  decisionOverride: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.authorization-decision',
    messageId: 'message-decision-escalate-1',
    createdAt: T6,
    requestId: 'message-request-escalate-1',
    proposalRef: {
      proposalId: target.proposalId,
      canonicalDigest: computeProposalDigest(target),
    },
    decidedBy: { id: GATEWAY, role: 'action-gateway' },
    decision: { kind: 'authorized', conditions: [] },
    ...decisionOverride,
  };
}

describe('escalation proposals (typed W003 shapes)', () => {
  it('builds a proposal that parses through the REAL W003 pipeline', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const parsed = parseActionProposal(built);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    expect(built.actionType.id).toBe('supervision.alert.escalate');
    expect(built.authorityRequirements.requiredScopes).toEqual(['supervision:alert']);
    expect(built.parameters['alert_revision']).toBe(1);
  });

  it('the escalation plan derives deterministically from the policy path', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const plan = planEscalation({
      alert: chain[chain.length - 1]!,
      delaySeconds: '900',
      reNotifyCadenceSeconds: '14400',
      notify: [
        { targetKind: 'role', targetRef: 'role:site-manager' },
        { targetKind: 'role', targetRef: 'role:program-manager' },
      ],
      escalateTo: [],
    });
    expect(plan.escalationLevel).toBe(1);
    expect(plan.notify).toEqual([
      { targetKind: 'role', targetRef: 'role:program-manager' },
      { targetKind: 'role', targetRef: 'role:site-manager' },
    ]);
  });
});

describe('gateway decision first (all three outcomes exercised)', () => {
  it('authorized -> dispatched', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const outcome = unwrap(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-1',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: decision(built) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(outcome.outcomeKind).toBe('dispatched');
    expect(outcome.decidedByRole).toBe('action-gateway');
    expect(outcome.proposalDigest).toBe(computeProposalDigest(built));
    expect(verifySealedEscalationOutcome(outcome).ok).toBe(true);
  });

  it('denied -> blocked-by-gateway', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const outcome = unwrap(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-2',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: decision(built, {
          decision: { kind: 'denied', code: 'policy-violation', reason: 'out of escalation window' },
        }) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(outcome.outcomeKind).toBe('blocked-by-gateway');
  });

  it('escalated -> awaiting-approval (the requires-approval path)', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const outcome = unwrap(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-3',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: decision(built, {
          decidedBy: { id: APPROVER, role: 'human-approver' },
          decision: { kind: 'escalated', escalatedTo: { id: APPROVER, role: 'human-approver' }, reason: 'major severity requires the night manager' },
        }) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(outcome.outcomeKind).toBe('awaiting-approval');
    expect(outcome.decidedByRole).toBe('human-approver');
  });

  it('outcomeKindOfDecision maps the full W003 decision union', () => {
    expect(outcomeKindOfDecision({ decision: { kind: 'authorized', conditions: [] } } as never)).toBe('dispatched');
    expect(outcomeKindOfDecision({ decision: { kind: 'denied', code: 'other', reason: 'x' } } as never)).toBe('blocked-by-gateway');
    expect(
      outcomeKindOfDecision({
        decision: { kind: 'escalated', escalatedTo: { id: 'x', role: 'human-approver' }, reason: 'x' },
      } as never),
    ).toBe('awaiting-approval');
  });
});

describe('gateway-bypass-rejected (the alerts kernel NEVER executes)', () => {
  it('an UNPARSEABLE decision is decision-unverifiable', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const error = expectError(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-x',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: { nonsense: true } as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('gateway-bypass-rejected');
  });

  it('a decision bound to a DIFFERENT proposal revision is proposal-unbound', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const other = proposal(chain, { proposalId: 'proposal-escalate-excavate-2' });
    const error = expectError(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-x',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: decision(other) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('gateway-bypass-rejected');
  });

  it('an outcome record claiming an EXECUTION effect is decision-missing', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const built = proposal(chain);
    const outcome = unwrap(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-blocked-1',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: built,
        decision: decision(built) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    const error = expectError(verifySealedEscalationOutcome({ ...outcome, executedAt: T6 }));
    expect(error.code).toBe('gateway-bypass-rejected');
  });
});

describe('stale-proposal replay (replay-conflict)', () => {
  it('a proposal targeting an OLD revision replayed against a NEW head is rejected', () => {
    const chain = alertChain([
      findingSummary({ findingStatus: 'due' }),
      findingSummary({ findingStatus: 'late', findingDigest: 'b'.repeat(64) }),
    ]);
    const staleProposal = unwrap(
      buildEscalationProposal({
        alert: chain[0]!,
        plan: planEscalation({
          alert: chain[0]!,
          delaySeconds: '1800',
          reNotifyCadenceSeconds: '43200',
          notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
          escalateTo: [],
        }),
        proposalId: 'proposal-escalate-excavate-stale',
        messageId: 'message-escalate-excavate-stale',
        proposedBy: PROPOSER,
        createdAt: T4,
      }),
    );
    const error = expectError(
      recordEscalationOutcome({
        outcomeId: 'escalation:excavate-stale',
        tenantId: TENANT,
        alert: chain[chain.length - 1]!,
        proposal: staleProposal,
        decision: decision(staleProposal) as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('replay-conflict');
  });
});
