// Shared fixtures for the collaboration tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely.
// ZERO clock reads: instants are fixed constants.
import { CollaborationHub, sealEvent, sealSession } from '../src/index';
import type {
  CollaborationEventRegistration,
  CollaborationResult,
  SessionRegistration,
} from '../src/index';

const T0 = '2026-02-05T14:00:00.000Z';
const T1 = '2026-02-05T14:00:01.000Z';
const T2 = '2026-02-05T14:00:02.000Z';
const T3 = '2026-02-05T14:00:03.000Z';
const T4 = '2026-02-05T14:00:04.000Z';

/** A valid session record as loose JSON. */
export function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    tenantId: 'tenant:acme',
    scope: { workspaceId: 'workspace:acme-eng', projectId: 'project:bridge-12' },
    displayName: 'Bridge 12 design review',
    createdBy: 'principal:lead-eng',
    openedAt: T0,
    ...overrides,
  };
}

/** A sealed session registration. */
export function sealedSession(
  overrides: Record<string, unknown> = {},
): CollaborationResult<SessionRegistration> {
  return sealSession(session(overrides));
}

/** A valid first journal event (a join) as loose JSON. */
export function joinEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    sequence: 1,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    kind: 'participant.joined',
    participant: 'principal:inspector',
    occurredAt: T1,
    ...overrides,
  };
}

/** A valid presence event as loose JSON. */
export function presenceEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    sequence: 2,
    tenantId: 'tenant:acme',
    actor: 'principal:inspector',
    kind: 'participant.presence',
    participant: 'principal:inspector',
    presence: 'present',
    occurredAt: T2,
    ...overrides,
  };
}

/** A valid subject-focus event as loose JSON. */
export function focusEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    sequence: 3,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    kind: 'subject.focused',
    subject: { kind: 'world-entity', entityId: 'element:column-c4' },
    occurredAt: T3,
    ...overrides,
  };
}

/** A valid close event as loose JSON. */
export function closeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    sequence: 4,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    kind: 'session.closed',
    occurredAt: T4,
    ...overrides,
  };
}

/** A sealed event registration. */
export function sealedEvent(
  event: Record<string, unknown>,
): CollaborationResult<CollaborationEventRegistration> {
  return sealEvent(event);
}

/** Append a sealed valid event; throws on failure. */
export function append(
  hub: CollaborationHub,
  event: Record<string, unknown>,
): void {
  const sealed = sealEvent(event);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  const appended = hub.appendEvent(sealed.value);
  if (!appended.ok) {
    throw new Error(`fixture append failed: ${JSON.stringify(appended.error)}`);
  }
}

/** Create a sealed valid session; throws on failure. */
export function create(hub: CollaborationHub, sess: Record<string, unknown>): void {
  const sealed = sealSession(sess);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  const created = hub.createSession(sealed.value);
  if (!created.ok) {
    throw new Error(`fixture create failed: ${JSON.stringify(created.error)}`);
  }
}

/** A hub with one open session and one joined, present participant. */
export function hubWithSession(): CollaborationHub {
  const hub = new CollaborationHub();
  create(hub, session());
  append(hub, joinEvent());
  append(hub, presenceEvent());
  return hub;
}

/** A hub whose session is closed (journal of 4 events). */
export function hubWithClosedSession(): CollaborationHub {
  const hub = hubWithSession();
  append(hub, focusEvent());
  append(hub, closeEvent());
  return hub;
}

export const FIXTURE_INSTANTS = { T0, T1, T2, T3, T4 } as const;
