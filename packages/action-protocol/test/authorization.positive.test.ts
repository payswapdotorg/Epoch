// Authorization messages — positive cases: requests and all three decision
// kinds (authorized, denied, escalated) round-trip through validation and
// canonical serialization; decisions bind to the exact revision of the
// proposal via its canonical digest (evidence addressing).
import { describe, expect, it } from 'vitest';
import {
  parseAuthorizationDecision,
  parseAuthorizationRequest,
  validateAuthorizationRequest,
} from '../src/authorization';
import type { Decision } from '../src/authorization';
import { DENIAL_CODES } from '../src/authorization';
import { parseActionProposal } from '../src/proposal';
import { validAuthorizationDecision, validAuthorizationRequest, validProposal } from './fixtures';

describe('parseAuthorizationRequest (positive)', () => {
  it('admits a valid request and returns canonical evidence form', () => {
    const outcome = parseAuthorizationRequest(validAuthorizationRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.requestId).toBe('authzreq-2025-0001');
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits requests from all three requesting roles', () => {
    for (const role of ['action-gateway', 'agent-runtime', 'human']) {
      const request = validAuthorizationRequest();
      request.requestedBy = { id: 'principal-1', role } as never;
      const outcome = parseAuthorizationRequest(request);
      expect(outcome.ok, role).toBe(true);
    }
  });

  it('admits requests without simulation/evaluation context', () => {
    const request = validAuthorizationRequest();
    request.context = undefined;
    const outcome = parseAuthorizationRequest(request);
    expect(outcome.ok).toBe(true);
  });

  it('validateAuthorizationRequest returns the parsed value', () => {
    const value = validateAuthorizationRequest(validAuthorizationRequest());
    expect(value.requestedScopes).toEqual(['world:write', 'external:scheduling:write']);
  });
});

describe('parseAuthorizationDecision (positive)', () => {
  it('admits an authorized decision with conditions and a validity deadline', () => {
    const outcome = parseAuthorizationDecision(validAuthorizationDecision());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.decision.kind).toBe('authorized');
    expect(outcome.canonicalJson).toContain('"conditions":[');
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits a condition-free authorization', () => {
    const decision = validAuthorizationDecision({
      decision: { kind: 'authorized', conditions: [] },
    });
    const outcome = parseAuthorizationDecision(decision);
    expect(outcome.ok).toBe(true);
  });

  it('admits a human-approver authorization', () => {
    const decision = validAuthorizationDecision();
    decision.decidedBy = { id: 'approver:jane', role: 'human-approver' };
    const outcome = parseAuthorizationDecision(decision);
    expect(outcome.ok).toBe(true);
  });

  it('admits every denial code', () => {
    for (const code of DENIAL_CODES) {
      const decision = validAuthorizationDecision({
        decision: { kind: 'denied', code, reason: 'Documented reason.' },
      });
      const outcome = parseAuthorizationDecision(decision);
      expect(outcome.ok, code).toBe(true);
    }
  });

  it('admits an escalated decision', () => {
    const decision = validAuthorizationDecision({
      decision: {
        kind: 'escalated',
        escalatedTo: { id: 'approver:structural-board', role: 'human-approver' },
        reason: 'Scope exceeds the gateway delegation.',
      },
    });
    const outcome = parseAuthorizationDecision(decision);
    expect(outcome.ok).toBe(true);
  });
});

describe('exact-revision evidence binding (positive)', () => {
  it('a decision can bind to the exact digest of the admitted proposal', () => {
    const proposalOutcome = parseActionProposal(validProposal());
    expect(proposalOutcome.ok).toBe(true);
    if (!proposalOutcome.ok) return;

    const request = validAuthorizationRequest({ proposalDigest: proposalOutcome.digest });
    const requestOutcome = parseAuthorizationRequest(request);
    expect(requestOutcome.ok).toBe(true);
    if (!requestOutcome.ok) return;
    expect(requestOutcome.value.proposalRef.canonicalDigest).toBe(proposalOutcome.digest);

    const decision = validAuthorizationDecision({ proposalDigest: proposalOutcome.digest });
    const decisionOutcome = parseAuthorizationDecision(decision);
    expect(decisionOutcome.ok).toBe(true);
    if (!decisionOutcome.ok) return;
    expect(decisionOutcome.value.proposalRef.canonicalDigest).toBe(proposalOutcome.digest);
  });

  it('identical decisions produce identical digests regardless of member order', () => {
    const decision = validAuthorizationDecision();
    const shuffled = Object.fromEntries(Object.entries(decision).reverse()) as typeof decision;
    const a = parseAuthorizationDecision(decision);
    const b = parseAuthorizationDecision(shuffled);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.digest).toBe(b.digest);
  });

  it('every decision kind is exhaustively representable', () => {
    const decisions: Decision[] = [
      { kind: 'authorized', conditions: [] },
      { kind: 'denied', code: 'policy-violation', reason: 'r' },
      {
        kind: 'escalated',
        escalatedTo: { id: 'approver:x', role: 'human-approver' },
        reason: 'r',
      },
    ];
    for (const d of decisions) {
      const outcome = parseAuthorizationDecision(validAuthorizationDecision({ decision: d }));
      expect(outcome.ok, d.kind).toBe(true);
    }
  });
});
