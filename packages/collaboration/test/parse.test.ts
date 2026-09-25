// Total admission of serialized collaboration documents: version gates,
// digest verification, snapshot ordering — and the tampered-snapshot
// negatives.
import { describe, expect, it } from 'vitest';
import {
  CollaborationHub,
  parseCollaborationSession,
  parseCollaborationSnapshot,
  sealSession,
} from '../src/index';
import { append, create, hubWithSession, joinEvent, presenceEvent, session } from './helpers';

describe('parseCollaborationSession', () => {
  it('admits a stored session record unchanged', () => {
    const sealed = sealSession(session());
    if (!sealed.ok) throw new Error('fixture must seal');
    const parsed = parseCollaborationSession(
      JSON.parse(JSON.stringify(sealed.value.session)),
    );
    expect(parsed.ok).toBe(true);
  });

  it('rejects version skew with a typed error', () => {
    const skewed = JSON.parse(JSON.stringify(session()));
    skewed.schemaVersion = 2;
    const parsed = parseCollaborationSession(skewed);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('version-unsupported');
    }
  });

  it('rejects a non-object root with a typed validation error', () => {
    const parsed = parseCollaborationSession('not-an-object');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });
});

describe('parseCollaborationSnapshot', () => {
  it('admits a canonical snapshot unchanged', () => {
    const hub = hubWithSession();
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot()));
    expect(parseCollaborationSnapshot(snapshot).ok).toBe(true);
  });

  it('rejects a tampered session record (content mutated after the fact)', () => {
    const hub = hubWithSession();
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot())) as Record<string, unknown>;
    const sessions = snapshot.sessions as Array<Record<string, unknown>>;
    const first = sessions[0] as Record<string, unknown>;
    const sessionContent = first.session as Record<string, unknown>;
    sessionContent.displayName = 'Tampered name';
    const parsed = parseCollaborationSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('digest-mismatch');
    }
  });

  it('rejects a tampered journal event (content mutated after the fact)', () => {
    const hub = hubWithSession();
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot())) as Record<string, unknown>;
    const events = snapshot.events as Array<Record<string, unknown>>;
    const first = events[0] as Record<string, unknown>;
    const eventContent = first.event as Record<string, unknown>;
    eventContent.occurredAt = '2026-12-31T23:59:59.999Z';
    const parsed = parseCollaborationSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('digest-mismatch');
    }
  });

  it('rejects events that are not canonically sorted', () => {
    const hub = hubWithSession();
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot()));
    snapshot.events.reverse();
    const parsed = parseCollaborationSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });

  it('rejects a snapshot with a duplicated journal coordinate', () => {
    const hub = hubWithSession();
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot()));
    snapshot.events.push(JSON.parse(JSON.stringify(snapshot.events[0])));
    const parsed = parseCollaborationSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
      expect(parsed.error.message).toContain('duplicate');
    }
  });

  it('restore refuses a snapshot whose journal has a sequence gap', () => {
    const hub = new CollaborationHub();
    create(hub, session());
    append(hub, joinEvent());
    append(hub, presenceEvent());
    const snapshot = JSON.parse(JSON.stringify(hub.snapshot()));
    // Drop the FIRST event: the journal would have to open at 2 — a gap.
    snapshot.events.splice(0, 1);
    const restored = CollaborationHub.fromSnapshot(snapshot);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe('sequence-gap');
    }
  });
});
