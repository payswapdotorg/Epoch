// Shared fixtures for the replay tests: a deterministic counter-style
// state spec folded over event-log history. ZERO clock reads — all event
// instants are fixed constants.
import { EventLog, sealEvent, type EventContent } from '@epoch/event-log';
import type { ReplaySpec, TracedReconstruction } from '../src/index';

const T0 = '2026-02-05T12:00:00.000Z';
const T1 = '2026-02-05T12:00:01.000Z';
const T2 = '2026-02-05T12:00:02.000Z';
const T3 = '2026-02-05T12:00:03.000Z';

/** The example reconstruction state: deterministic counters. */
export interface CountersState {
  entityAssertions: number;
  actionEvents: number;
  notes: string[];
}

export const initialCounters: CountersState = {
  entityAssertions: 0,
  actionEvents: 0,
  notes: [],
};

/** The example replay spec: one handler per event kind, pure functions. */
export const countersSpec: ReplaySpec<CountersState> = {
  initialState: initialCounters,
  handlers: [
    {
      discriminator: 'world:subjects',
      apply: (state, event) => ({
        ...state,
        entityAssertions:
          state.entityAssertions +
          ((event.payload.data as { subjects?: unknown[] }).subjects?.length ?? 0),
      }),
    },
    {
      discriminator: 'action:lifecycle',
      apply: (state) => ({ ...state, actionEvents: state.actionEvents + 1 }),
    },
    {
      discriminator: 'acme:inspection-note',
      apply: (state, event) => ({
        ...state,
        notes: [...state.notes, String((event.payload.data as { checklist?: unknown }).checklist)],
      }),
    },
  ],
  projectState: (state) => ({
    actionEvents: state.actionEvents,
    entityAssertions: state.entityAssertions,
    notes: state.notes,
  }),
};

/** A world-subjects event as loose JSON. */
export function worldEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
        subjects: [
          { kind: 'entity', entityId: 'element:column-c4' },
          { kind: 'entity', entityId: 'element:beam-b7' },
        ],
      },
    },
    occurredAt: T0,
    ...overrides,
  };
}

/** An action lifecycle event as loose JSON. */
export function actionEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:world-a',
    sequence: 2,
    tenantId: 'tenant:acme',
    actor: 'principal:crane-ops',
    causalParent: { streamId: 'stream:world-a', sequence: 1 },
    payload: {
      discriminator: 'action:lifecycle',
      data: {
        action: { proposalId: 'msg-abc-001', canonicalDigest: '0'.repeat(64) },
        actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
        phase: 'executed',
        detail: { quantity: 12 },
      },
    },
    occurredAt: T1,
    ...overrides,
  };
}

/** An extension-note event as loose JSON. */
export function noteEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:world-a',
    sequence: 3,
    tenantId: 'tenant:acme',
    actor: 'principal:inspector',
    causalParent: { streamId: 'stream:world-a', sequence: 2 },
    payload: {
      discriminator: 'acme:inspection-note',
      data: { checklist: 'form-12', passed: true },
    },
    occurredAt: T2,
    ...overrides,
  };
}

/** A second-stream event (cross-stream causal child). */
export function followUpEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:world-b',
    sequence: 1,
    tenantId: 'tenant:acme',
    actor: 'principal:inspector',
    causalParent: { streamId: 'stream:world-a', sequence: 3 },
    payload: {
      discriminator: 'acme:inspection-note',
      data: { checklist: 'form-99' },
    },
    occurredAt: T3,
    ...overrides,
  };
}

/** Append a sealed valid event; throws on failure. */
export function append(log: EventLog, event: Record<string, unknown>): void {
  const sealed = sealEvent(event);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  const appended = log.appendEvent(sealed.value);
  if (!appended.ok) {
    throw new Error(`fixture append failed: ${JSON.stringify(appended.error)}`);
  }
}

/** A log with three events in `stream:world-a`. */
export function logWithThreeEvents(): EventLog {
  const log = new EventLog();
  append(log, worldEvent());
  append(log, actionEvent());
  append(log, noteEvent());
  return log;
}

/** A log with intersecting streams (world-b causally depends on world-a). */
export function logWithIntersectingStreams(): EventLog {
  const log = logWithThreeEvents();
  append(log, followUpEvent());
  return log;
}

/** Unwrap a fold result (positive helpers). */
export function unwrapFold<S>(
  result: { ok: boolean; value?: TracedReconstruction<S>; error?: unknown },
): TracedReconstruction<S> {
  if (!result.ok) {
    throw new Error(`fixture fold failed: ${JSON.stringify(result.error)}`);
  }
  return (result as { ok: true; value: TracedReconstruction<S> }).value;
}

export const FIXTURE_INSTANTS = { T0, T1, T2, T3 } as const;
export type { EventContent };
