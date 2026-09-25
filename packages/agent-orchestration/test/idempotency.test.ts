// Idempotency keys (the W020 replay/idempotency pin): keys are
// deterministic pure functions of the typed operation scope — identical
// scopes derive identical keys, distinct scopes derive distinct keys, and
// key derivation never reads wall-clock or arrival order.
import { describe, expect, it } from 'vitest';
import { EventLog, sealEvent } from '@epoch/event-log';
import {
  deriveEventIdempotencyKey,
  deriveSessionIdempotencyKey,
} from '../src/index';
import { T0 } from './helpers';

function eventFixture(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    streamId: 'stream:world-a',
    sequence: 1,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    causalParent: null,
    payload: {
      discriminator: 'action:lifecycle',
      data: {
        action: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
        actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
        phase: 'executed',
      },
    },
    occurredAt: T0,
    ...overrides,
  };
}

describe('idempotency keys', () => {
  it('derive the same key for the same event against the same session', () => {
    const sealed = sealEvent(eventFixture());
    if (!sealed.ok) throw new Error('fixture must seal');
    const log = new EventLog();
    const appended = log.appendEvent(sealed.value);
    if (!appended.ok) throw new Error(appended.error.message);
    const record = appended.value;
    const a = deriveEventIdempotencyKey({ sessionId: 'session:run-001', event: record });
    const b = deriveEventIdempotencyKey({ sessionId: 'session:run-001', event: record });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('derive distinct keys for distinct sessions, coordinates and digests', () => {
    const sealed = sealEvent(eventFixture());
    if (!sealed.ok) throw new Error('fixture must seal');
    const log = new EventLog();
    const first = log.appendEvent(sealed.value);
    if (!first.ok) throw new Error(first.error.message);
    const secondSealed = sealEvent(
      eventFixture({
        sequence: 2,
        causalParent: { streamId: 'stream:world-a', sequence: 1 },
        payload: {
          discriminator: 'action:lifecycle',
          data: {
            action: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
            phase: 'authorized',
          },
        },
      }),
    );
    if (!secondSealed.ok) throw new Error('fixture must seal');
    const second = log.appendEvent(secondSealed.value);
    if (!second.ok) throw new Error(second.error.message);

    const keyA = deriveEventIdempotencyKey({ sessionId: 'session:run-001', event: first.value });
    const keyB = deriveEventIdempotencyKey({ sessionId: 'session:run-002', event: first.value });
    const keyC = deriveEventIdempotencyKey({ sessionId: 'session:run-001', event: second.value });
    expect(new Set([keyA, keyB, keyC]).size).toBe(3);
  });

  it('session-creation keys are stable per (sessionId, planDigest) and distinct otherwise', () => {
    const a = deriveSessionIdempotencyKey({
      sessionId: 'session:run-001',
      planDigest: 'a'.repeat(64),
    });
    const b = deriveSessionIdempotencyKey({
      sessionId: 'session:run-001',
      planDigest: 'a'.repeat(64),
    });
    const c = deriveSessionIdempotencyKey({
      sessionId: 'session:run-001',
      planDigest: 'b'.repeat(64),
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
