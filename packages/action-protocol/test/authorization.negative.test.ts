// Authorization messages — negative cases: the authority split is the
// security boundary under test. Agents cannot be expressed as the source
// of an authorization decision; denials require reasons and valid codes;
// decisions bind to well-formed exact-revision proposal references.
import { describe, expect, it } from 'vitest';
import {
  parseAuthorizationDecision,
  parseAuthorizationRequest,
} from '../src/authorization';
import type { AuthorizationDecision, AuthorizationRequest } from '../src/authorization';
import { validAuthorizationDecision, validAuthorizationRequest } from './fixtures';

describe('parseAuthorizationDecision (negative: authority split)', () => {
  it('rejects decisions whose authorizer role is an agent', () => {
    for (const role of ['agent', 'agent-runtime', 'model', 'program', 'solver']) {
      const decision = validAuthorizationDecision();
      decision.decidedBy = { id: 'agent:stress-checker', role } as never;
      const outcome = parseAuthorizationDecision(decision);
      expect(outcome.ok, `role=${role}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });

  it('rejects self-authorized-looking decisions via unknown-field discipline', () => {
    for (const smuggled of [
      { proposedBy: 'agent:stress-checker' },
      { selfAuthorized: true },
      { executedBy: 'agent:stress-checker' },
    ]) {
      const decision = { ...validAuthorizationDecision(), ...smuggled };
      const outcome = parseAuthorizationDecision(decision);
      expect(outcome.ok, JSON.stringify(smuggled)).toBe(false);
    }
  });
});

describe('parseAuthorizationDecision (negative: decision semantics)', () => {
  it('rejects denials without a reason', () => {
    const decision = validAuthorizationDecision({
      decision: { kind: 'denied', code: 'policy-violation' } as never,
    });
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });

  it('rejects unknown denial codes', () => {
    const decision = validAuthorizationDecision({
      decision: { kind: 'denied', code: 'vibes', reason: 'r' } as never,
    });
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });

  it('rejects unknown decision kinds', () => {
    const decision = validAuthorizationDecision({
      decision: { kind: 'maybe' } as never,
    });
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });

  it('rejects escalations without a target authorizer', () => {
    const decision = validAuthorizationDecision({
      decision: { kind: 'escalated', reason: 'r' } as never,
    });
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });

  it('rejects escalations targeting an agent role', () => {
    const decision = validAuthorizationDecision({
      decision: {
        kind: 'escalated',
        escalatedTo: { id: 'agent:stress-checker', role: 'agent-runtime' },
        reason: 'r',
      } as never,
    });
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });

  it('rejects conditions with empty descriptions', () => {
    const decision = validAuthorizationDecision();
    decision.decision = {
      kind: 'authorized',
      conditions: [{ description: '' }],
    };
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });
});

describe('parseAuthorizationDecision (negative: proposal binding)', () => {
  it('rejects proposal references with malformed digests', () => {
    for (const canonicalDigest of [
      'a'.repeat(63),
      'a'.repeat(65),
      'A'.repeat(64),
      'z'.repeat(64),
      '',
    ]) {
      const decision = validAuthorizationDecision({ proposalDigest: canonicalDigest });
      const outcome = parseAuthorizationDecision(decision);
      expect(outcome.ok, `digest=${canonicalDigest}`).toBe(false);
    }
  });

  it('rejects decisions missing the proposal reference or request id', () => {
    const missingProposal = validAuthorizationDecision() as Partial<AuthorizationDecision>;
    delete missingProposal.proposalRef;
    expect(parseAuthorizationDecision(missingProposal).ok).toBe(false);

    const missingRequest = validAuthorizationDecision() as Partial<AuthorizationDecision>;
    delete missingRequest.requestId;
    expect(parseAuthorizationDecision(missingRequest).ok).toBe(false);
  });
});

describe('parseAuthorizationRequest (negative)', () => {
  it('rejects requests without a justification (auditability)', () => {
    const request = validAuthorizationRequest();
    request.justification = '';
    expect(parseAuthorizationRequest(request).ok).toBe(false);
  });

  it('rejects requests with empty requested scopes', () => {
    const request = validAuthorizationRequest();
    request.requestedScopes = [];
    expect(parseAuthorizationRequest(request).ok).toBe(false);
  });

  it('rejects unknown requesting roles', () => {
    const request = validAuthorizationRequest();
    request.requestedBy = { id: 'x', role: 'policy-engine' } as never;
    expect(parseAuthorizationRequest(request).ok).toBe(false);
  });

  it('rejects malformed context references', () => {
    const request = validAuthorizationRequest();
    request.context = { simulationRunRef: '' };
    const outcome = parseAuthorizationRequest(request);
    expect(outcome.ok).toBe(false);
  });

  it('rejects requests missing their proposal reference', () => {
    const request = validAuthorizationRequest() as Partial<AuthorizationRequest>;
    delete request.proposalRef;
    expect(parseAuthorizationRequest(request).ok).toBe(false);
  });
});

describe('authorization messages (negative: envelope discipline)', () => {
  it('reports version-mismatch on both message kinds', () => {
    const request = { ...validAuthorizationRequest(), protocolVersion: '2.0.0' };
    const requestOutcome = parseAuthorizationRequest(request);
    expect(requestOutcome.ok).toBe(false);
    if (!requestOutcome.ok) expect(requestOutcome.error.kind).toBe('version-mismatch');

    const decision = { ...validAuthorizationDecision(), protocolVersion: '0.1.0' };
    const decisionOutcome = parseAuthorizationDecision(decision);
    expect(decisionOutcome.ok).toBe(false);
    if (!decisionOutcome.ok) expect(decisionOutcome.error.kind).toBe('version-mismatch');
  });

  it('reports kind-mismatch across the two authorization message kinds', () => {
    const request = {
      ...validAuthorizationRequest(),
      messageKind: 'action.authorization-decision',
    };
    const outcome = parseAuthorizationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.encountered).toBe('action.authorization-decision');
      }
    }
  });

  it('rejects unknown fields on authorization messages', () => {
    const decision = { ...validAuthorizationDecision(), override: true };
    expect(parseAuthorizationDecision(decision).ok).toBe(false);
  });
});
