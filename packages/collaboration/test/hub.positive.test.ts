// Positive round-trips: session lifecycle, membership, presence,
// coordination journal, deterministic snapshots, and restore.
import { describe, expect, it } from 'vitest';
import { CollaborationHub, sealSession } from '../src/index';
import {
  append,
  create,
  focusEvent,
  hubWithClosedSession,
  hubWithSession,
  joinEvent,
  presenceEvent,
  session,
} from './helpers';

describe('collaboration sessions (positive)', () => {
  it('admits a sealed session record and projects it open', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    const state = hub.sessionState('session:design-review');
    if (!state.ok) throw new Error(state.error.message);
    expect(state.value.state).toBe('open');
    expect(state.value.session.displayName).toBe('Bridge 12 design review');
    expect(state.value.participants).toEqual([]);
    expect(state.value.lastSequence).toBe(0);
    expect(hub.sessionCount).toBe(1);
  });

  it('sealing is canonical: key order does not affect the session digest', () => {
    const a = sealSession(session());
    const reordered = session();
    const sealed = sealSession({
      openedAt: reordered.openedAt,
      createdBy: reordered.createdBy,
      displayName: reordered.displayName,
      scope: reordered.scope,
      tenantId: reordered.tenantId,
      sessionId: reordered.sessionId,
      schemaVersion: reordered.schemaVersion,
    });
    if (!a.ok || !sealed.ok) throw new Error('fixtures must seal');
    expect(a.value.digest).toBe(sealed.value.digest);
  });
});

describe('collaboration membership & presence (positive)', () => {
  it('a join event admits a participant (presence joining)', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    append(hub, joinEvent());
    const participants = hub.participants('session:design-review');
    if (!participants.ok) throw new Error(participants.error.message);
    expect(participants.value).toEqual([
      { principalId: 'principal:inspector', presence: 'joining', lastSequence: 1 },
    ]);
  });

  it('presence transitions project (joining -> present -> idle -> present)', () => {
    const hub = hubWithSession(); // join + present
    append(
      hub,
      presenceEvent({
        sequence: 3,
        presence: 'idle',
        occurredAt: '2026-02-05T14:00:02.500Z',
      }),
    );
    append(
      hub,
      presenceEvent({
        sequence: 4,
        presence: 'present',
        occurredAt: '2026-02-05T14:00:02.900Z',
      }),
    );
    const participants = hub.participants('session:design-review');
    if (!participants.ok) throw new Error(participants.error.message);
    expect(participants.value[0]?.presence).toBe('present');
    expect(participants.value[0]?.lastSequence).toBe(4);
  });

  it('a leave event removes the participant from the ACTIVE projection', () => {
    const hub = hubWithSession();
    append(
      hub,
      {
        ...joinEvent(),
        sequence: 3,
        kind: 'participant.left',
        occurredAt: '2026-02-05T14:00:03.000Z',
      },
    );
    const participants = hub.participants('session:design-review');
    if (!participants.ok) throw new Error(participants.error.message);
    expect(participants.value).toEqual([]);
    // ...and rejoin is a new join event.
    append(
      hub,
      joinEvent({ sequence: 4, occurredAt: '2026-02-05T14:00:03.500Z' }),
    );
    const rejoined = hub.participants('session:design-review');
    if (!rejoined.ok) throw new Error(rejoined.error.message);
    expect(rejoined.value[0]?.presence).toBe('joining');
  });

  it('presence heartbeats may re-assert the current state', () => {
    const hub = hubWithSession(); // inspector: present
    append(
      hub,
      presenceEvent({ sequence: 3, presence: 'present' }),
    );
    expect(hub.sessionState('session:design-review').ok).toBe(true);
  });
});

describe('collaboration coordination journal (positive)', () => {
  it('focus events carry shared-model subjects opaquely', () => {
    const hub = hubWithSession();
    append(hub, focusEvent());
    const journal = hub.readJournal('session:design-review');
    if (!journal.ok) throw new Error(journal.error.message);
    expect(journal.value).toHaveLength(3);
    expect(journal.value[2]?.event.subject).toEqual({
      kind: 'world-entity',
      entityId: 'element:column-c4',
    });
  });

  it('coordination notes carry typed data envelopes', () => {
    const hub = hubWithSession();
    append(hub, focusEvent());
    append(
      hub,
      {
        ...focusEvent(),
        sequence: 4,
        kind: 'coordination.note',
        subject: undefined,
        data: { topic: 'load-case-review', status: 'agreed' },
        occurredAt: '2026-02-05T14:00:04.000Z',
      },
    );
    const journal = hub.readJournal('session:design-review');
    if (!journal.ok) throw new Error(journal.error.message);
    expect(journal.value[3]?.event.kind).toBe('coordination.note');
    expect(journal.value[3]?.event.data).toEqual({
      topic: 'load-case-review',
      status: 'agreed',
    });
  });

  it('the terminal session.closed event closes the session', () => {
    const hub = hubWithClosedSession();
    const state = hub.sessionState('session:design-review');
    if (!state.ok) throw new Error(state.error.message);
    expect(state.value.state).toBe('closed');
    expect(state.value.eventCount).toBe(4);
  });

  it('journal reads are cursor-based and bounded', () => {
    const hub = hubWithClosedSession();
    const tail = hub.readJournal('session:design-review', { after: 2 });
    if (!tail.ok) throw new Error(tail.error.message);
    expect(tail.value.map((record) => record.event.sequence)).toEqual([3, 4]);
    const one = hub.readJournal('session:design-review', { limit: 1 });
    if (!one.ok) throw new Error(one.error.message);
    expect(one.value.map((record) => record.event.sequence)).toEqual([1]);
  });
});

describe('collaboration snapshots (positive)', () => {
  it('snapshot -> restore -> snapshot is a byte-identical round-trip', () => {
    const hub = hubWithClosedSession();
    const snapshot = hub.snapshot();
    const restored = CollaborationHub.fromSnapshot(snapshot);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
    expect(restored.value.sessionCount).toBe(1);
  });

  it('two hubs fed the same facts emit byte-identical snapshots', () => {
    const build = () => hubWithClosedSession();
    expect(build().snapshot()).toEqual(build().snapshot());
  });

  it('session listings are sorted regardless of creation order', () => {
    const hub = new CollaborationHub();
    create(hub, session({ sessionId: 'session:zulu' }));
    create(hub, session({ sessionId: 'session:alpha' }));
    expect(hub.listSessions().map((record) => record.session.sessionId)).toEqual([
      'session:alpha',
      'session:zulu',
    ]);
  });
});
