// Shared fixtures for the event-log tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern). ZERO clock reads: occurrence instants are
// fixed constants (producer-supplied payload data).
import { sealEvent, EventLog } from '../src/index';
import type { EventLogResult, EventRegistration } from '../src/index';

const T0 = '2026-02-05T12:00:00.000Z';
const T1 = '2026-02-05T12:00:01.000Z';
const T2 = '2026-02-05T12:00:02.000Z';

/** A valid first event of a stream as loose JSON. */
export function firstEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:world-a',
    sequence: 1,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    causalParent: null,
    payload: {
      discriminator: 'world:subjects',
      data: {
        subjects: [{ kind: 'entity', entityId: 'element:column-c4' }],
        note: 'column asserted',
      },
    },
    occurredAt: T0,
    ...overrides,
  };
}

/** A valid second event of `stream:world-a` (causally parented on #1). */
export function secondEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return firstEvent({
    sequence: 2,
    causalParent: { streamId: 'stream:world-a', sequence: 1 },
    payload: {
      discriminator: 'world:subjects',
      data: {
        subjects: [
          { kind: 'relation', relationId: 'rel-'.concat('a'.repeat(64)) },
          { kind: 'entity', entityId: 'element:beam-b7' },
        ],
      },
    },
    occurredAt: T1,
    ...overrides,
  });
}

/** A valid third event of `stream:world-a` (action lifecycle fact). */
export function thirdEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return firstEvent({
    sequence: 3,
    causalParent: { streamId: 'stream:world-a', sequence: 2 },
    payload: {
      discriminator: 'action:lifecycle',
      data: {
        action: {
          proposalId: 'msg-abc-001',
          canonicalDigest: '0'.repeat(64),
        },
        actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
        phase: 'executed',
        detail: { quantity: 12 },
      },
    },
    occurredAt: T2,
    ...overrides,
  });
}

/** A valid open extension event (non-reserved namespace). */
export function extensionEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return firstEvent({
    payload: {
      discriminator: 'acme:inspection-note',
      data: { checklist: 'form-12', passed: true },
    },
    ...overrides,
  });
}

/** A sealed registration for an event (content + recomputed digest). */
export function sealed(event: Record<string, unknown>): EventLogResult<EventRegistration> {
  return sealEvent(event);
}

/** Append a sealed valid event; throws if it fails (positive helpers). */
export function appended(log: EventLog, event: Record<string, unknown>) {
  const sealedEvent = sealed(event);
  if (!sealedEvent.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealedEvent.error)}`);
  }
  const result = log.appendEvent(sealedEvent.value);
  if (!result.ok) {
    throw new Error(`fixture append unexpectedly failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** A log with three events in `stream:world-a` (tenant acme). */
export function logWithThreeEvents(): EventLog {
  const log = new EventLog();
  appended(log, firstEvent());
  appended(log, secondEvent());
  appended(log, thirdEvent());
  return log;
}

export const FIXTURE_INSTANTS = { T0, T1, T2 } as const;
