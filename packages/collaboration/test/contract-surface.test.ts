// Published-surface integrity: the exported vocabularies, id patterns,
// presence transition table, and coordination kinds are exactly the
// architecture-pinned sets; serialized projections validate.
import { describe, expect, it } from 'vitest';
import {
  COLLABORATION_CONTRACT_VERSION,
  COLLABORATION_EVENT_KINDS,
  COLLABORATION_PRINCIPAL_ID_PATTERN,
  COLLABORATION_RECORD_VERSION,
  COLLABORATION_SCHEMA_SURFACE,
  COLLABORATION_SESSION_ID_PATTERN,
  COLLABORATION_SUBJECT_KINDS,
  COLLABORATION_TENANT_ID_PATTERN,
  PRESENCE_STATES,
  PRESENCE_TRANSITIONS,
  SESSION_STATES,
  CollaborationSnapshotSchema,
  SessionStateInfoSchema,
} from '../src/index';
import { hubWithClosedSession } from './helpers';

describe('collaboration published surface', () => {
  it('version constants are pinned', () => {
    expect(COLLABORATION_CONTRACT_VERSION).toBe('1.0.0');
    expect(COLLABORATION_RECORD_VERSION).toBe(1);
  });

  it('session/tenant/participant ids are kind-prefixed opaque slugs', () => {
    expect('session:design-review').toMatch(COLLABORATION_SESSION_ID_PATTERN);
    expect('tenant:acme').toMatch(COLLABORATION_TENANT_ID_PATTERN);
    expect('principal:lead-eng').toMatch(COLLABORATION_PRINCIPAL_ID_PATTERN);
    expect('Slack:room').not.toMatch(COLLABORATION_SESSION_ID_PATTERN);
    expect('session:').not.toMatch(COLLABORATION_SESSION_ID_PATTERN);
    expect('slack-channel').not.toMatch(COLLABORATION_SESSION_ID_PATTERN);
  });

  it('the coordination kind vocabulary is closed and coordination-only', () => {
    expect([...COLLABORATION_EVENT_KINDS]).toEqual([
      'participant.joined',
      'participant.left',
      'participant.presence',
      'subject.focused',
      'subject.released',
      'coordination.note',
      'session.closed',
    ]);
    // No world-model mutation vocabulary, no authorization vocabulary.
    const joined = COLLABORATION_EVENT_KINDS.join(' ');
    expect(joined.includes('write')).toBe(false);
    expect(joined.includes('authorize')).toBe(false);
    expect(joined.includes('approve')).toBe(false);
    expect(joined.includes('permission')).toBe(false);
  });

  it('the presence vocabulary and transition table are pinned', () => {
    expect([...PRESENCE_STATES]).toEqual(['joining', 'present', 'idle', 'left']);
    expect(PRESENCE_TRANSITIONS).toEqual({
      joining: ['present', 'left'],
      present: ['present', 'idle', 'left'],
      idle: ['idle', 'present', 'left'],
      left: [],
    });
    expect([...SESSION_STATES]).toEqual(['open', 'closed']);
    expect([...COLLABORATION_SUBJECT_KINDS]).toEqual(['world-entity', 'action-proposal']);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = COLLABORATION_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(types);
  });

  it('serialized projections validate against the published validators', () => {
    const hub = hubWithClosedSession();
    const snapshot = hub.snapshot();
    expect(CollaborationSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const state = hub.sessionState('session:design-review');
    if (!state.ok) throw new Error(state.error.message);
    expect(SessionStateInfoSchema.safeParse(state.value).success).toBe(true);
  });
});
