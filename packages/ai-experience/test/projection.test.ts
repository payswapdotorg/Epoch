// The deterministic collaboration projection: presence transitions,
// focus, follows, playback, timeline, branches, annotations, moments,
// and the determinism contract (order-independence, sorted outputs).
import { describe, expect, it } from 'vitest';
import { projectCollaboration } from '../src/index';
import {
  AGENT_ID,
  AGENT_PEER,
  ENTITY_REF,
  INSPECTOR,
  LEAD,
  SESSION,
  STREAM,
  TENANT,
  T1,
  T2,
  event,
  expectFailure,
  joinedEvents,
  presenceEvent,
  validSession,
} from './helpers';
import { canonicalJsonStringify } from '@epoch/agent-protocol';

describe('presence transitions (the mirrored W010 table)', () => {
  it('folds the legal joining -> present -> idle -> present chain', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
      presenceEvent({ sequence: 3, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'idle' }),
      presenceEvent({ sequence: 4, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.presence[0]?.presence).toBe('present');
  });

  it('folds heartbeats (re-assertion of a reached state)', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
      presenceEvent({ sequence: 3, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
      presenceEvent({ sequence: 4, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'idle' }),
      presenceEvent({ sequence: 5, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'idle' }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.presence[0]?.presence).toBe('idle');
  });

  it('rejects the illegal joining -> idle jump', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'idle' }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects a presence event for an unseen participant appearing as present', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects a presence transition out of the terminal left (except the membership rejoin)', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'left' }),
      presenceEvent({ sequence: 3, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('folds the membership-sourced rejoin (left -> joining)', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'left' }),
      presenceEvent({ sequence: 3, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.presence[0]?.presence).toBe('joining');
  });

  it('rejects presence facts for principals without a declared role', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: 'principal:ghost', participant: 'principal:ghost' }),
    ]);
    expectFailure(projection, 'validation');
  });
});

describe('focus, follows, playback, timeline', () => {
  it('folds focus changes and releases per participant', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({ sequence: 8, actor: AGENT_PEER, kind: 'focus.released', participant: AGENT_PEER }),
      event({
        sequence: 9,
        actor: INSPECTOR,
        kind: 'focus.changed',
        participant: INSPECTOR,
        target: { kind: 'action-proposal', proposal: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) } },
      }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.focus).toHaveLength(1);
    expect(projection.value.focus[0]?.principalId).toBe(INSPECTOR);
    expect(projection.value.focus[0]?.target.kind).toBe('action-proposal');
  });

  it('folds follow-agent intents into follow edges', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({
        sequence: 8,
        actor: INSPECTOR,
        kind: 'intent.emitted',
        intent: { kind: 'follow-agent', intentVersion: 1, agentId: AGENT_ID },
      }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.follows).toEqual([
      { followerPrincipalId: INSPECTOR, agentId: AGENT_ID, lastSequence: 8 },
    ]);
  });

  it('folds pause/resume into the playback state', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({ sequence: 8, actor: LEAD, kind: 'intent.emitted', intent: { kind: 'pause', intentVersion: 1 } }),
      event({ sequence: 9, actor: LEAD, kind: 'intent.emitted', intent: { kind: 'resume', intentVersion: 1 } }),
      event({ sequence: 10, actor: LEAD, kind: 'intent.emitted', intent: { kind: 'pause', intentVersion: 1 } }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.playback).toBe('paused');
  });

  it('folds a replay intent into the timeline position and branches into branch points', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({
        sequence: 8,
        actor: LEAD,
        kind: 'intent.emitted',
        intent: { kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: 3 } },
      }),
      event({
        sequence: 9,
        actor: LEAD,
        kind: 'intent.emitted',
        intent: { kind: 'branch', intentVersion: 1, from: { streamId: STREAM, sequence: 3 }, label: 'alt-steel' },
      }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.timelinePosition).toEqual({ streamId: STREAM, sequence: 3 });
    expect(projection.value.branchPoints).toEqual([
      { from: { streamId: STREAM, sequence: 3 }, label: 'alt-steel', sequence: 9 },
    ]);
  });

  it('folds select/compare/filter/query/annotate into the view block and annotations', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({ sequence: 8, actor: LEAD, kind: 'intent.emitted', intent: { kind: 'select', intentVersion: 1, target: ENTITY_REF } }),
      event({
        sequence: 9,
        actor: INSPECTOR,
        kind: 'intent.emitted',
        intent: { kind: 'annotate', intentVersion: 1, target: ENTITY_REF, note: 'check cover' },
      }),
      event({
        sequence: 10,
        actor: LEAD,
        kind: 'intent.emitted',
        intent: { kind: 'query', intentVersion: 1, text: 'which columns fail?' },
      }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.view.selection).toEqual(ENTITY_REF);
    expect(projection.value.view.lastQuery).toBe('which columns fail?');
    expect(projection.value.annotations).toEqual([
      { participant: INSPECTOR, target: ENTITY_REF, note: 'check cover', sequence: 9 },
    ]);
  });
});

describe('member consistency (per-kind event members)', () => {
  it('rejects a presence event without a participant', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, presence: 'joining', participant: undefined }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects an intent.emitted event without the intent', () => {
    const projection = projectCollaboration(validSession(), [
      event({ sequence: 1, actor: LEAD, kind: 'intent.emitted' }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects a moment.captured event without the digest', () => {
    const projection = projectCollaboration(validSession(), [
      event({ sequence: 1, actor: LEAD, kind: 'moment.captured' }),
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects an event carrying members of a foreign kind', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, intent: { kind: 'pause', intentVersion: 1 } }),
    ]);
    expectFailure(projection, 'validation');
  });
});

describe('determinism (the projection contract)', () => {
  it('input order does not matter: shuffled event sets project identically', () => {
    const events = joinedEvents();
    const forward = projectCollaboration(validSession(), events);
    const backward = projectCollaboration(validSession(), [...events].reverse());
    const rotated = projectCollaboration(validSession(), [events[3]!, events[0]!, events[6]!, events[1]!, events[5]!, events[2]!, events[4]!]);
    expect(forward.ok && backward.ok && rotated.ok).toBe(true);
    if (!forward.ok || !backward.ok || !rotated.ok) return;
    expect(canonicalJsonStringify(forward.value as never)).toBe(
      canonicalJsonStringify(backward.value as never),
    );
    expect(canonicalJsonStringify(forward.value as never)).toBe(
      canonicalJsonStringify(rotated.value as never),
    );
  });

  it('exposes sorted arrays (no insertion-order leaks)', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: LEAD, participant: LEAD, presence: 'joining' }),
      presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
      presenceEvent({ sequence: 3, actor: INSPECTOR, participant: INSPECTOR, presence: 'joining' }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    const ids = projection.value.presence.map((entry) => entry.principalId);
    expect(ids).toEqual([...ids].sort());
  });

  it('zero wall-clock, zero randomness: two folds of the same facts are identical', () => {
    const first = projectCollaboration(validSession(), joinedEvents());
    const second = projectCollaboration(validSession(), joinedEvents());
    expect(canonicalJsonStringify(first as never)).toBe(
      canonicalJsonStringify(second as never),
    );
  });
});

describe('moment capture folding', () => {
  it('records captured moments by digest and sequence', () => {
    const digest = 'f'.repeat(64);
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      event({ sequence: 8, actor: LEAD, kind: 'moment.captured', momentDigest: digest }),
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.moments).toEqual([{ momentDigest: digest, sequence: 8 }]);
  });
});

describe('invalid input records', () => {
  it('rejects structurally invalid events', () => {
    const projection = projectCollaboration(validSession(), [
      { schemaVersion: 2, sessionId: SESSION, sequence: 1, tenantId: TENANT, actor: LEAD, occurredAt: T1, kind: 'presence.changed' },
    ]);
    expectFailure(projection, 'validation');
  });

  it('rejects non-object events', () => {
    const projection = projectCollaboration(validSession(), ['not-an-event']);
    expectFailure(projection, 'validation');
  });

  it('an empty event set projects the opening state', () => {
    const projection = projectCollaboration(validSession(), []);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.state).toBe('open');
    expect(projection.value.presence).toEqual([]);
    expect(projection.value.eventCount).toBe(0);
    expect(projection.value.lastSequence).toBe(0);
    expect(projection.value.playback).toBe('playing');
    expect(projection.value.timelinePosition).toBeUndefined();
  });

  it('honors a caller-supplied initial timeline position', () => {
    const projection = projectCollaboration(validSession(), [], {
      initialPosition: { streamId: STREAM, sequence: 2 },
    });
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(projection.value.timelinePosition).toEqual({ streamId: STREAM, sequence: 2 });
  });

  it('folds an event set drawn from different actors at a shared instant (T2 determinism)', () => {
    const projection = projectCollaboration(validSession(), [
      presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining', occurredAt: T2 }),
      presenceEvent({ sequence: 2, actor: INSPECTOR, participant: INSPECTOR, presence: 'joining', occurredAt: T2 }),
    ]);
    expect(projection.ok).toBe(true);
  });
});
