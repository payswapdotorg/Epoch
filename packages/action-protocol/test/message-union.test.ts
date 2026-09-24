// The discriminated message union: parseActionProtocolMessage routes every
// message kind through its own admission pipeline and rejects unknown
// kinds with typed errors.
import { describe, expect, it } from 'vitest';
import { parseActionProtocolMessage } from '../src/message';
import {
  validAuthorizationDecision,
  validAuthorizationRequest,
  validProposal,
} from './fixtures';

describe('parseActionProtocolMessage', () => {
  it('routes proposals to the proposal pipeline', () => {
    const outcome = parseActionProtocolMessage(validProposal());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.messageKind).toBe('action.proposal');
      expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('routes authorization requests to the request pipeline', () => {
    const outcome = parseActionProtocolMessage(validAuthorizationRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.messageKind).toBe('action.authorization-request');
  });

  it('routes authorization decisions to the decision pipeline', () => {
    const outcome = parseActionProtocolMessage(validAuthorizationDecision());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.messageKind).toBe('action.authorization-decision');
  });

  it('rejects unknown message kinds with a typed schema-violation', () => {
    const unknown = { ...validProposal(), messageKind: 'action.teleport' };
    const outcome = parseActionProtocolMessage(unknown);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('rejects agent-protocol messages with a typed schema-violation', () => {
    const foreign = {
      protocolVersion: '1.0.0',
      messageKind: 'agent.registration',
    };
    const outcome = parseActionProtocolMessage(foreign);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('runs the version gate before the union schema', () => {
    const stale = { ...validProposal(), protocolVersion: '0.9.0' };
    const outcome = parseActionProtocolMessage(stale);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });

  it('rejects non-object inputs with a typed error', () => {
    for (const input of ['x', 42, null, []]) {
      const outcome = parseActionProtocolMessage(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});
