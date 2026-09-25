// Feature-projection parity: the serialized key sets of every
// @epoch/ai-experience record type the W015 web feature module consumes
// are pinned here (the app manifest is frozen during W015, so the
// feature module's contracts are structural mirrors — this test is the
// compile-time-independent pin that keeps them from drifting). The key
// lists below are exactly the fields the feature contracts declare in
// apps/web/src/features/agents/contracts.ts.
import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  admitIntent,
  captureEngineeringMoment,
  projectCollaboration,
  validateSessionDescriptor,
} from '../src/index';
import {
  AGENT_PEER,
  INSPECTOR,
  LEAD,
  SESSION,
  STREAM,
  TENANT,
  event,
  joinedEvents,
  presenceEvent,
  validSession,
  ENTITY_REF,
  EVIDENCE_REF,
  DIGEST_EVIDENCE,
  T2,
  T4,
  AGENT_ID,
} from './helpers';

/** The sorted key set of a record serialized through canonical JSON. */
function keySet(value: JsonValue): string[] {
  const parsed = JSON.parse(canonicalJsonStringify(value)) as Record<string, unknown>;
  return Object.keys(parsed).sort();
}

describe('the feature contracts track the package record shapes', () => {
  it('the session descriptor serializes exactly the contracted fields', () => {
    const session = validateSessionDescriptor(validSession());
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    expect(keySet(session.value as unknown as JsonValue)).toEqual([
      'displayName',
      'openedAt',
      'openedBy',
      'roles',
      'schemaVersion',
      'sessionId',
      'tenantId',
    ]);
    const roleKeys = keySet(session.value.roles[0] as unknown as JsonValue);
    expect(roleKeys).toEqual([
      'agentId',
      'allowedIntents',
      'assignedAt',
      'participantKind',
      'principalId',
    ]);
  });

  it('the typed journal event serializes exactly the contracted fields', () => {
    const keys = keySet(
      event({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }) as never,
    );
    expect(keys).toEqual([
      'actor',
      'kind',
      'occurredAt',
      'participant',
      'presence',
      'schemaVersion',
      'sequence',
      'sessionId',
      'tenantId',
    ]);
    // The optional members are carried only by their kinds.
    const taken = admitIntent(
      {
        sessionId: SESSION,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        sequence: 20,
        intent: { kind: 'take-control', intentVersion: 1, authority: { kind: 'role-grant' } },
      },
      { session: validSession(), control: { controller: undefined } },
    );
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(keySet(taken.value as unknown as JsonValue)).toEqual([
      'actor',
      'kind',
      'occurredAt',
      'provenance',
      'schemaVersion',
      'sequence',
      'sessionId',
      'tenantId',
    ]);
    const provenanceKeys = keySet(
      (taken.value as { provenance: unknown }).provenance as never,
    );
    expect(provenanceKeys).toEqual(['actor', 'authority', 'occurredAt']);
  });

  it('the projection serializes exactly the contracted fields', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      presenceEvent({ sequence: 8, actor: INSPECTOR, participant: INSPECTOR, presence: 'left' }),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 9,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        kind: 'control.taken',
        provenance: { actor: LEAD, occurredAt: T2, authority: { kind: 'role-grant' } },
      },
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 10,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        kind: 'intent.emitted',
        intent: {
          kind: 'replay',
          intentVersion: 1,
          position: { streamId: STREAM, sequence: 5 },
        },
      },
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    expect(keySet(projection.value as unknown as JsonValue)).toEqual([
      'annotations',
      'branchPoints',
      'controlDenials',
      'controller',
      'eventCount',
      'focus',
      'follows',
      'lastSequence',
      'moments',
      'playback',
      'presence',
      'session',
      'state',
      'timelinePosition',
      'view',
    ]);
    const presenceKeys = keySet(projection.value.presence[0] as unknown as JsonValue);
    expect(presenceKeys).toEqual([
      'agentId',
      'lastSequence',
      'participantKind',
      'presence',
      'principalId',
    ]);
    const viewKeys = keySet(projection.value.view as never);
    expect(viewKeys).toEqual([]);
    // A view with intents set carries exactly the contracted members.
    const withView = projectCollaboration(validSession(), [
      ...joinedEvents(),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 8,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        kind: 'intent.emitted',
        intent: { kind: 'select', intentVersion: 1, target: ENTITY_REF },
      },
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 9,
        tenantId: TENANT,
        actor: INSPECTOR,
        occurredAt: T2,
        kind: 'intent.emitted',
        intent: { kind: 'query', intentVersion: 1, text: 'which columns fail?' },
      },
    ]);
    expect(withView.ok).toBe(true);
    if (!withView.ok) return;
    expect(keySet(withView.value.view as never)).toEqual(['lastQuery', 'selection']);
  });

  it('the Engineering Moment record serializes exactly the contracted fields', () => {
    const projection = projectCollaboration(validSession(), [
      ...joinedEvents(),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 8,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T2,
        kind: 'intent.emitted',
        intent: {
          kind: 'replay',
          intentVersion: 1,
          position: { streamId: STREAM, sequence: 5 },
        },
      },
    ]);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    const moment = captureEngineeringMoment({
      session: validSession(),
      projection: projection.value,
      worldSnapshot: [ENTITY_REF],
      visualState: { graphKind: 'presence', graphDigest: 'a'.repeat(64) },
      evidence: [EVIDENCE_REF],
      knownEvidence: [DIGEST_EVIDENCE],
      streamBounds: [{ streamId: STREAM, lastSequence: 7 }],
      scenario: { scenarioId: 'scenario:bridge-12-review' },
      capturedBy: LEAD,
      capturedAt: T4,
      label: 'column check',
    });
    expect(moment.ok).toBe(true);
    if (!moment.ok) return;
    expect(keySet(moment.value as unknown as JsonValue)).toEqual(['moment', 'momentDigest']);
    expect(keySet(moment.value.moment as unknown as JsonValue)).toEqual([
      'agentState',
      'availableActions',
      'capturedAt',
      'capturedBy',
      'evidence',
      'humanState',
      'label',
      'scenario',
      'schemaVersion',
      'sessionId',
      'tenantId',
      'timelinePosition',
      'visualState',
      'worldSnapshot',
    ]);
    const participantKeys = keySet(moment.value.moment.agentState[0] as unknown as JsonValue);
    expect(participantKeys).toEqual([
      'agentId',
      'focus',
      'holdsControl',
      'participantKind',
      'presence',
      'principalId',
    ]);
    expect(keySet(moment.value.moment.visualState as never)).toEqual(['graphDigest', 'graphKind']);
    expect(keySet(moment.value.moment.scenario as never)).toEqual(['scenarioId']);
  });

  it('the agent participant states carry the registered agent id (the follow vocabulary)', () => {
    const projection = projectCollaboration(validSession(), joinedEvents());
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    const agent = projection.value.presence.find((entry) => entry.principalId === AGENT_PEER);
    expect(agent?.agentId).toBe(AGENT_ID);
    expect(agent?.participantKind).toBe('agent');
  });
});
