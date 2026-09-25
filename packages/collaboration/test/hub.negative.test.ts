// NEGATIVE collaboration cases — the W010 pins: cross-tenant
// create/append/join(read) rejections, sequence integrity (gap,
// duplicate, out-of-order), digest tamper, membership and presence
// boundary errors, session-closed, version skew, and vendor-field
// rejection. Every failure is a TYPED error value; nothing throws.
import { describe, expect, it } from 'vitest';
import { CollaborationHub, sealEvent, sealSession } from '../src/index';
import type { CollaborationError, CollaborationEventRegistration, SessionRegistration } from '../src/index';
import {
  create,
  focusEvent,
  hubWithSession,
  joinEvent,
  presenceEvent,
  session,
} from './helpers';

function registration(event: Record<string, unknown>): CollaborationEventRegistration {
  const sealed = sealEvent(event);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

function sessionReg(sess: Record<string, unknown>): SessionRegistration {
  const sealed = sealSession(sess);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

function expectError(
  result: { ok: boolean; error?: CollaborationError },
  code: CollaborationError['code'],
): CollaborationError {
  expect(result.ok).toBe(false);
  const error = (result as { ok: false; error: CollaborationError }).error;
  expect(error.code).toBe(code);
  return error;
}

describe('collaboration admission (negative — tenant isolation, R12)', () => {
  it('rejects a cross-tenant session creation on a tenant-scoped hub', () => {
    const hub = new CollaborationHub({ expectedTenantId: 'tenant:acme' });
    const error = expectError(
      hub.createSession(sessionReg(session({ tenantId: 'tenant:globex' }))),
      'cross-tenant-denied',
    );
    if (error.code === 'cross-tenant-denied') {
      expect(error.expectedTenantId).toBe('tenant:acme');
      expect(error.encounteredTenantId).toBe('tenant:globex');
    }
  });

  it('rejects a cross-tenant coordination append on a tenant-scoped hub', () => {
    const hub = new CollaborationHub({ expectedTenantId: 'tenant:acme' });
    create(hub, session());
    const error = expectError(
      hub.appendEvent(registration(joinEvent({ tenantId: 'tenant:globex' }))),
      'cross-tenant-denied',
    );
    if (error.code === 'cross-tenant-denied') {
      expect(error.encounteredTenantId).toBe('tenant:globex');
    }
  });

  it('rejects a cross-tenant append to an existing session (session tenant is fixed)', () => {
    const hub = hubWithSession(); // session fixed to tenant:acme
    const error = expectError(
      hub.appendEvent(
        registration(focusEvent({ tenantId: 'tenant:globex', sequence: 3 })),
      ),
      'cross-tenant-denied',
    );
    if (error.code === 'cross-tenant-denied') {
      expect(error.sessionId).toBe('session:design-review');
    }
  });

  it('rejects a CROSS-TENANT JOIN attempt (read as another tenant) with the typed error', () => {
    const hub = hubWithSession();
    const join = hub.sessionState('session:design-review', {
      asTenant: 'tenant:globex',
    });
    const error = expectError(join, 'cross-tenant-denied');
    if (error.code === 'cross-tenant-denied') {
      expect(error.expectedTenantId).toBe('tenant:acme');
      expect(error.encounteredTenantId).toBe('tenant:globex');
    }
    // And the journal read is likewise denied.
    expectError(
      hub.readJournal('session:design-review', { asTenant: 'tenant:globex' }),
      'cross-tenant-denied',
    );
    // While the OWN tenant reads fine.
    expect(hub.sessionState('session:design-review', { asTenant: 'tenant:acme' }).ok).toBe(true);
  });
});

describe('collaboration admission (negative — sequence integrity)', () => {
  it('rejects a journal sequence gap', () => {
    const hub = hubWithSession();
    const error = expectError(
      hub.appendEvent(registration(focusEvent({ sequence: 5 }))),
      'sequence-gap',
    );
    if (error.code === 'sequence-gap') {
      expect(error.expectedSequence).toBe(3);
      expect(error.encounteredSequence).toBe(5);
    }
  });

  it('rejects a duplicate journal sequence', () => {
    const hub = hubWithSession();
    const error = expectError(
      hub.appendEvent(registration(presenceEvent({ sequence: 2 }))),
      'duplicate-sequence',
    );
    if (error.code === 'duplicate-sequence') {
      expect(error.sequence).toBe(2);
    }
  });

  it('rejects an out-of-order journal append', () => {
    const hub = hubWithSession();
    // Sequences below the cursor that are not existing coordinates are
    // impossible in a contiguous journal; the stale coordinate 1 exists
    // and is a duplicate — but a DIFFERENT event at sequence 1 still
    // collides (journal coordinates are unique forever).
    const error = expectError(
      hub.appendEvent(registration(joinEvent({ sequence: 1 }))),
      'duplicate-sequence',
    );
    expect(error.code).toBe('duplicate-sequence');
  });

  it('a new session journal must open at sequence 1', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    const error = expectError(
      hub.appendEvent(registration(joinEvent({ sequence: 4 }))),
      'sequence-gap',
    );
    if (error.code === 'sequence-gap') {
      expect(error.expectedSequence).toBe(1);
    }
  });
});

describe('collaboration admission (negative — digest tamper)', () => {
  it('rejects a session creation whose claimed digest does not match', () => {
    const hub = new CollaborationHub();
    const sealed = sessionReg(session());
    const forged = sealed.digest.startsWith('f') ? '0'.repeat(64) : 'f'.repeat(64);
    const error = expectError(
      hub.createSession({ session: sealed.session, digest: forged }),
      'digest-mismatch',
    );
    if (error.code === 'digest-mismatch') {
      expect(error.expected).toBe(sealed.digest);
      expect(error.encountered).toBe(forged);
    }
  });

  it('rejects an event append whose content was mutated after sealing', () => {
    const hub = hubWithSession();
    const sealed = registration(focusEvent({ sequence: 3 }));
    const mutated = {
      ...sealed.event,
      kind: 'coordination.note' as const,
      subject: undefined,
      data: { sneaky: true },
    };
    const error = expectError(
      hub.appendEvent({ event: mutated, digest: sealed.digest }),
      'digest-mismatch',
    );
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('collaboration admission (negative — session & lifecycle gates)', () => {
  it('rejects a duplicate session id (session ids are unique forever)', () => {
    const hub = hubWithSession();
    const error = expectError(
      hub.createSession(sessionReg(session({ openedAt: '2026-02-05T18:00:00.000Z' }))),
      'duplicate-session',
    );
    if (error.code === 'duplicate-session') {
      expect(error.sessionId).toBe('session:design-review');
    }
  });

  it('rejects operating on an unknown session', () => {
    const hub = new CollaborationHub();
    expectError(hub.sessionState('session:ghost'), 'unknown-session');
    expectError(hub.readJournal('session:ghost'), 'unknown-session');
    expectError(
      hub.appendEvent(registration(joinEvent({ sessionId: 'session:ghost' }))),
      'unknown-session',
    );
  });

  it('rejects appends to a closed session (journal is immutable history)', () => {
    const hub = hubWithSession();
    // Close the session first.
    hub.appendEvent(
      registration({
        ...joinEvent(),
        sequence: 3,
        kind: 'session.closed',
        participant: undefined,
        occurredAt: '2026-02-05T14:00:03.000Z',
      }),
    );
    const error = expectError(
      hub.appendEvent(registration(focusEvent({ sequence: 4 }))),
      'session-closed',
    );
    if (error.code === 'session-closed') {
      expect(error.sessionId).toBe('session:design-review');
    }
  });
});

describe('collaboration admission (negative — membership & presence)', () => {
  it('rejects joining an already-active participant (duplicate-participant)', () => {
    const hub = hubWithSession(); // inspector joined
    const error = expectError(
      hub.appendEvent(
        registration(
          joinEvent({ sequence: 3, occurredAt: '2026-02-05T14:00:02.500Z' }),
        ),
      ),
      'duplicate-participant',
    );
    if (error.code === 'duplicate-participant') {
      expect(error.principalId).toBe('principal:inspector');
    }
  });

  it('rejects leaving a non-member (unknown-participant)', () => {
    const hub = hubWithSession();
    const error = expectError(
      hub.appendEvent(
        registration(
          joinEvent({
            sequence: 3,
            kind: 'participant.left',
            participant: 'principal:field-tech',
            occurredAt: '2026-02-05T14:00:02.500Z',
          }),
        ),
      ),
      'unknown-participant',
    );
    if (error.code === 'unknown-participant') {
      expect(error.principalId).toBe('principal:field-tech');
    }
  });

  it('rejects presence for a non-member (unknown-participant)', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    const error = expectError(
      hub.appendEvent(registration(presenceEvent({ sequence: 1 }))),
      'unknown-participant',
    );
    if (error.code === 'unknown-participant') {
      expect(error.principalId).toBe('principal:inspector');
    }
  });

  it('rejects an illegal presence transition (left cannot be set by a presence event)', () => {
    const hub = hubWithSession();
    const sealed = sealEvent(
      presenceEvent({ sequence: 3, presence: 'left' }),
    );
    // The member gate rejects presence "left" first (validation).
    expectError(
      hub.appendEvent(
        sealed.ok ? sealed.value : registration(presenceEvent({ sequence: 3 })),
      ),
      'validation',
    );
  });

  it('rejects the joining -> idle presence transition with the typed error', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    const joined = hub.appendEvent(registration(joinEvent({ sequence: 1 })));
    if (!joined.ok) throw new Error('fixture join failed');
    const error = expectError(
      hub.appendEvent(registration(presenceEvent({ sequence: 2, presence: 'idle' }))),
      'invalid-presence-transition',
    );
    if (error.code === 'invalid-presence-transition') {
      expect(error.from).toBe('joining');
      expect(error.to).toBe('idle');
      expect(error.principalId).toBe('principal:inspector');
    }
  });

  it('rejects a presence event for a participant who has left (unknown-participant)', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    appendPresence(hub, { sequence: 2, presence: 'present' });
    hub.appendEvent(
      registration(
        joinEvent({
          sequence: 3,
          kind: 'participant.left',
          occurredAt: '2026-02-05T14:00:01.500Z',
        }),
      ),
    );
    const error = expectError(
      hub.appendEvent(
        registration(presenceEvent({ sequence: 4, presence: 'present' })),
      ),
      'unknown-participant',
    );
    expect(error.code).toBe('unknown-participant');
  });
});

function appendPresence(
  hub: CollaborationHub,
  overrides: Record<string, unknown>,
): void {
  const join = hub.appendEvent(registration(joinEvent({ sequence: 1 })));
  if (!join.ok) throw new Error('fixture join failed');
  const presence = hub.appendEvent(
    registration(presenceEvent({ sequence: 2, ...overrides })),
  );
  if (!presence.ok) {
    throw new Error(`fixture presence failed: ${JSON.stringify(presence.error)}`);
  }
}

describe('collaboration admission (negative — validation & version gates)', () => {
  it('rejects a session with an unknown (vendor) field', () => {
    const sealed = sealSession(session({ slackChannel: '#design' }));
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
      if (sealed.error.code === 'validation') {
        expect(JSON.stringify(sealed.error.issues)).toContain('slackChannel');
      }
    }
  });

  it('rejects an event with an unknown (vendor) field', () => {
    const sealed = sealEvent(joinEvent({ websocketRoom: 'ws-42' }));
    expect(sealed.ok).toBe(false);
  });

  it('rejects malformed participant principal ids (not opaque principal references)', () => {
    const sealed = sealEvent(joinEvent({ participant: 'user:ada' }));
    expect(sealed.ok).toBe(false);
  });

  it('rejects malformed session/tenant ids', () => {
    expect(sealSession(session({ sessionId: 'room:design-review' })).ok).toBe(false);
    expect(sealSession(session({ tenantId: 'org:acme' })).ok).toBe(false);
  });

  it('rejects a project-scoped session without its workspace (no level skipping)', () => {
    const sealed = sealSession(
      session({ scope: { projectId: 'project:bridge-12' } }),
    );
    expect(sealed.ok).toBe(false);
  });

  it('rejects schemaVersion skew with the typed version-unsupported error', () => {
    const hub = new CollaborationHub();
    const error = expectError(
      hub.createSession({
        session: session({ schemaVersion: 2 }),
        digest: '0'.repeat(64),
      } as never),
      'version-unsupported',
    );
    if (error.code === 'version-unsupported') {
      expect(error.encountered).toBe('2');
    }
  });

  it('rejects membership events that do not name a participant', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    const error = expectError(
      hub.appendEvent(
        registration(joinEvent({ sequence: 1, participant: undefined })),
      ),
      'validation',
    );
    if (error.code === 'validation') {
      expect(JSON.stringify(error.issues)).toContain('participant');
    }
  });

  it('rejects presence events without a presence state (the member gate)', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    appendJoinOnly(hub);
    const error = expectError(
      hub.appendEvent(registration(presenceEvent({ sequence: 2, presence: undefined }))),
      'validation',
    );
    if (error.code === 'validation') {
      expect(JSON.stringify(error.issues)).toContain('presence');
    }
  });

  it('rejects focus events without a subject', () => {
    const hub = hubWithSession();
    const error = expectError(
      hub.appendEvent(
        registration(focusEvent({ sequence: 3, subject: undefined })),
      ),
      'validation',
    );
    if (error.code === 'validation') {
      expect(JSON.stringify(error.issues)).toContain('subject');
    }
  });

  it('rejects the session.closed event carrying extraneous members', () => {
    const hub = hubWithSession();
    expectError(
      hub.appendEvent(
        registration(closeEventFixture({ sequence: 3, participant: 'principal:inspector' })),
      ),
      'validation',
    );
  });
});

function appendJoinOnly(hub: CollaborationHub): void {
  const joined = hub.appendEvent(registration(joinEvent({ sequence: 1 })));
  if (!joined.ok) throw new Error('fixture join failed');
}

function closeEventFixture(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: 'session:design-review',
    sequence: 3,
    tenantId: 'tenant:acme',
    actor: 'principal:lead-eng',
    kind: 'session.closed',
    occurredAt: '2026-02-05T14:00:03.000Z',
    ...overrides,
  };
}
