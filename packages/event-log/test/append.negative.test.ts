// NEGATIVE admission cases — the W010 sequence-integrity pin (out of
// order, gap, duplicate, digest tamper, cross-tenant, unknown/cyclic
// causal parent, version skew, vendor fields, reserved-namespace
// payloads). Every failure is a TYPED error value; nothing throws.
import { describe, expect, it } from 'vitest';
import { EventLog, sealEvent } from '../src/index';
import type { EventLogError, EventRegistration } from '../src/index';
import {
  appended,
  firstEvent,
  logWithThreeEvents,
  secondEvent,
  thirdEvent,
} from './helpers';

function registration(event: Record<string, unknown>): EventRegistration {
  const sealed = sealEvent(event);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

function expectError(
  result: { ok: boolean; error?: EventLogError },
  code: EventLogError['code'],
): EventLogError {
  expect(result.ok).toBe(false);
  const error = (result as { ok: false; error: EventLogError }).error;
  expect(error.code).toBe(code);
  return error;
}

describe('event-log admission (negative — sequence integrity)', () => {
  it('rejects a sequence gap with the typed sequence-gap error', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    const gap = log.appendEvent(registration(secondEvent({ sequence: 3 })));
    const error = expectError(gap, 'sequence-gap');
    if (error.code === 'sequence-gap') {
      expect(error.expectedSequence).toBe(2);
      expect(error.encounteredSequence).toBe(3);
    }
  });

  it('rejects a new stream not opening at sequence 1', () => {
    const log = new EventLog();
    const error = expectError(
      log.appendEvent(registration(firstEvent({ sequence: 4 }))),
      'sequence-gap',
    );
    if (error.code === 'sequence-gap') {
      expect(error.expectedSequence).toBe(1);
    }
  });

  it('rejects an out-of-order append below the cursor', () => {
    const log = logWithThreeEvents();
    // Sequence 2 exists, but craft sequence 2.5-like: sequence below last
    // that is NOT a duplicate coordinate is impossible in a contiguous
    // stream; the duplicate coordinate is covered below. Use a fresh
    // stream where sequence 1 exists and append sequence 1 again after
    // sequence 2 was admitted — append order: 1, 2, then 1 again.
    const error = expectError(
      log.appendEvent(registration(firstEvent())),
      'duplicate-sequence',
    );
    if (error.code === 'duplicate-sequence') {
      expect(error.sequence).toBe(1);
    }
  });

  it('rejects a duplicate sequence with the typed duplicate-sequence error', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    const error = expectError(
      log.appendEvent(registration(firstEvent())),
      'duplicate-sequence',
    );
    if (error.code === 'duplicate-sequence') {
      expect(error.streamId).toBe('stream:world-a');
      expect(error.sequence).toBe(1);
    }
  });

  it('out-of-order: an event at an existing-but-stale coordinate that is NOT the same content still collides', () => {
    const log = logWithThreeEvents();
    // Sequence 1 exists with different content (a different actor): the
    // coordinate is taken — duplicate-sequence (facts are immutable).
    const error = expectError(
      log.appendEvent(registration(firstEvent({ actor: 'principal:other' }))),
      'duplicate-sequence',
    );
    if (error.code === 'duplicate-sequence') {
      expect(error.sequence).toBe(1);
    }
  });
});

describe('event-log admission (negative — digest tamper)', () => {
  it('rejects an append whose claimed digest does not match the content', () => {
    const log = new EventLog();
    const sealed = registration(firstEvent());
    // A syntactically valid hex digest that differs from the real one.
    const forged = sealed.digest.startsWith('f')
      ? '0'.repeat(64)
      : 'f'.repeat(64);
    const tampered: EventRegistration = { event: sealed.event, digest: forged };
    const error = expectError(log.appendEvent(tampered), 'digest-mismatch');
    if (error.code === 'digest-mismatch') {
      expect(error.expected).toBe(sealed.digest);
      expect(error.encountered).toBe(forged);
    }
  });

  it('rejects a content mutated after sealing (digest no longer matches)', () => {
    const log = new EventLog();
    const sealed = registration(firstEvent());
    const mutatedContent = {
      ...sealed.event,
      payload: {
        ...sealed.event.payload,
        data: { ...sealed.event.payload.data, tampered: true },
      },
    };
    const error = expectError(
      log.appendEvent({ event: mutatedContent, digest: sealed.digest }),
      'digest-mismatch',
    );
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('event-log admission (negative — tenant isolation, R12)', () => {
  it('rejects a cross-tenant append to a log scoped to a tenant', () => {
    const log = new EventLog({ expectedTenantId: 'tenant:acme' });
    const error = expectError(
      log.appendEvent(registration(firstEvent({ tenantId: 'tenant:globex' }))),
      'cross-tenant-denied',
    );
    if (error.code === 'cross-tenant-denied') {
      expect(error.expectedTenantId).toBe('tenant:acme');
      expect(error.encounteredTenantId).toBe('tenant:globex');
    }
  });

  it('rejects a cross-tenant append to an existing stream (stream tenant is fixed)', () => {
    const log = new EventLog();
    appended(log, firstEvent()); // fixes stream:world-a to tenant:acme
    const error = expectError(
      log.appendEvent(
        registration(secondEvent({ tenantId: 'tenant:globex' })),
      ),
      'cross-tenant-denied',
    );
    if (error.code === 'cross-tenant-denied') {
      expect(error.streamId).toBe('stream:world-a');
    }
  });

  it('the same tenant may run many streams; a cross-tenant read of an unknown stream stays typed', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    appended(log, firstEvent({ streamId: 'stream:world-b' }));
    expect(log.streamCount).toBe(2);
    expectError(log.streamInfo('stream:missing'), 'unknown-stream');
  });
});

describe('event-log admission (negative — causal integrity)', () => {
  it('rejects a same-stream FUTURE causal parent (causal-cycle, even though it is also missing)', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    // Parent #9 in the same stream with the event at #2: same-stream
    // parents must be strictly earlier — the pure cycle property fires
    // before existence resolution.
    const error = expectError(
      log.appendEvent(
        registration(secondEvent({ causalParent: { streamId: 'stream:world-a', sequence: 9 } })),
      ),
      'causal-cycle',
    );
    if (error.code === 'causal-cycle') {
      expect(error.parentSequence).toBe(9);
    }
  });

  it('rejects a dangling CROSS-STREAM causal parent (unknown-parent)', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    // The referenced stream has no history at all.
    const error = expectError(
      log.appendEvent(
        registration(
          secondEvent({ causalParent: { streamId: 'stream:world-b', sequence: 1 } }),
        ),
      ),
      'unknown-parent',
    );
    if (error.code === 'unknown-parent') {
      expect(error.parentSequence).toBe(1);
    }
  });

  it('admits an EXISTING cross-stream causal parent (streams intersect)', () => {
    const log = new EventLog();
    appended(log, firstEvent()); // stream:world-a #1
    appended(
      log,
      firstEvent({
        streamId: 'stream:world-b',
        payload: { discriminator: 'acme:note', data: {} },
      }),
    ); // stream:world-b #1
    // stream:world-a #2 caused by stream:world-b #1 — a legal intersection.
    const admitted = log.appendEvent(
      registration(secondEvent({ causalParent: { streamId: 'stream:world-b', sequence: 1 } })),
    );
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.event.causalParent).toEqual({
        streamId: 'stream:world-b',
        sequence: 1,
      });
    }
  });

  it('rejects a self-referential causal parent (causal-cycle)', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    const error = expectError(
      log.appendEvent(
        registration(secondEvent({ causalParent: { streamId: 'stream:world-a', sequence: 2 } })),
      ),
      'causal-cycle',
    );
    if (error.code === 'causal-cycle') {
      expect(error.parentSequence).toBe(2);
      expect(error.sequence).toBe(2);
    }
  });

  it('rejects a future causal parent (causal-cycle)', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    // Event #2 claims parent #3 (future in the same stream): the parent
    // coordinate is strictly later — typed causal-cycle.
    const error = expectError(
      log.appendEvent(
        registration(secondEvent({ causalParent: { streamId: 'stream:world-a', sequence: 3 } })),
      ),
      'causal-cycle',
    );
    expect(error.code).toBe('causal-cycle');
  });
});

describe('event-log admission (negative — validation & version gates)', () => {
  it('rejects an event with an unknown (vendor) field', () => {
    const sealed = sealEvent(firstEvent({ kafkaOffset: 4207 }));
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
      if (sealed.error.code === 'validation') {
        expect(JSON.stringify(sealed.error.issues)).toContain('kafkaOffset');
      }
    }
  });

  it('rejects a malformed stream id', () => {
    const sealed = sealEvent(firstEvent({ streamId: 'topic://world-a' }));
    expect(sealed.ok).toBe(false);
  });

  it('rejects a malformed actor id (not a principal reference)', () => {
    const sealed = sealEvent(firstEvent({ actor: 'openai:gpt-5' }));
    expect(sealed.ok).toBe(false);
  });

  it('rejects a malformed discriminator', () => {
    const sealed = sealEvent(
      firstEvent({
        payload: { discriminator: 'not namespaced', data: {} },
      }),
    );
    expect(sealed.ok).toBe(false);
  });

  it('rejects schemaVersion skew with the typed version-unsupported error', () => {
    const log = new EventLog();
    const error = expectError(
      log.appendEvent({ event: firstEvent({ schemaVersion: 2 }) as never, digest: '0'.repeat(64) }),
      'version-unsupported',
    );
    if (error.code === 'version-unsupported') {
      expect(error.encountered).toBe('2');
    }
  });

  it('rejects an action lifecycle payload with a bad proposal reference', () => {
    const sealed = sealEvent(
      thirdEvent({
        payload: {
          discriminator: 'action:lifecycle',
          data: {
            action: { proposalId: 'msg-x', canonicalDigest: 'not-a-digest' },
            actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
            phase: 'executed',
          },
        },
      }),
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('rejects a world-subjects payload with a bad relation id', () => {
    const sealed = sealEvent(
      secondEvent({
        payload: {
          discriminator: 'world:subjects',
          data: { subjects: [{ kind: 'relation', relationId: 'rel-not-a-digest' }] },
        },
      }),
    );
    expect(sealed.ok).toBe(false);
  });

  it('rejects an unknown kernel kind inside a reserved namespace', () => {
    const sealed = sealEvent(
      firstEvent({
        payload: { discriminator: 'world:custom-thing', data: {} },
      }),
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
      if (sealed.error.code === 'validation') {
        expect(JSON.stringify(sealed.error.issues)).toContain('reserved');
      }
    }
  });

  it('rejects a world-subjects payload with no subjects', () => {
    const sealed = sealEvent(
      firstEvent({
        payload: {
          discriminator: 'world:subjects',
          data: { subjects: [] },
        },
      }),
    );
    expect(sealed.ok).toBe(false);
  });

  it('rejects a malformed occurredAt timestamp', () => {
    const sealed = sealEvent(firstEvent({ occurredAt: 'not-a-timestamp' }));
    expect(sealed.ok).toBe(false);
  });
});
