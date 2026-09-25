// Engineering Moments: the shareable/replayable record — round-trip +
// digest verification + tamper rejection + the named negatives (dangling
// evidence, invalid replay position, cross-tenant references) and
// boundaries.
import { describe, expect, it } from 'vitest';
import {
  captureEngineeringMoment,
  projectCollaboration,
  sealMoment,
  serializeMoment,
  verifyMomentDigest,
  computeMomentDigest,
  type CollaborationProjection,
  type EngineeringMomentRecord,
} from '../src/index';
import {
  AGENT_ID,
  AGENT_PEER,
  DIGEST_A,
  DIGEST_EVIDENCE,
  ENTITY_REF,
  EVIDENCE_REF,
  INSPECTOR,
  LEAD,
  OTHER_TENANT,
  SESSION,
  STREAM,
  TENANT,
  T4,
  expectFailure,
  joinedEvents,
  validSession,
} from './helpers';

function projection(): CollaborationProjection {
  const result = projectCollaboration(validSession(), joinedEvents());
  if (!result.ok) {
    throw new Error(`fixture projection failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function captureInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session: validSession(),
    projection: projection(),
    worldSnapshot: [ENTITY_REF],
    visualState: { graphKind: 'presence', graphDigest: DIGEST_A },
    evidence: [EVIDENCE_REF],
    knownEvidence: [DIGEST_EVIDENCE],
    streamBounds: [{ streamId: STREAM, lastSequence: 7 }],
    timelinePosition: { streamId: STREAM, sequence: 7 },
    scenario: { scenarioId: 'scenario:bridge-12-review' },
    capturedBy: LEAD,
    capturedAt: T4,
    label: 'column check',
    ...overrides,
  };
}

describe('moment capture (positives)', () => {
  it('captures the binding seven components, content-addressed', () => {
    const result = captureEngineeringMoment(captureInput() as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const record = result.value as EngineeringMomentRecord;
    expect(record.moment.sessionId).toBe(SESSION);
    expect(record.moment.tenantId).toBe(TENANT);
    expect(record.moment.worldSnapshot).toEqual([ENTITY_REF]);
    expect(record.moment.agentState).toEqual([
      {
        principalId: AGENT_PEER,
        participantKind: 'agent',
        agentId: AGENT_ID,
        presence: 'present',
        focus: { kind: 'world-entity', entityId: 'element:column-c4' },
        holdsControl: false,
      },
    ]);
    expect(record.moment.humanState.map((state) => state.principalId)).toEqual([
      INSPECTOR,
      LEAD,
    ]);
    expect(record.moment.visualState).toEqual({ graphKind: 'presence', graphDigest: DIGEST_A });
    expect(record.moment.timelinePosition).toEqual({ streamId: STREAM, sequence: 7 });
    expect(record.moment.evidence).toEqual([EVIDENCE_REF]);
    expect(record.moment.scenario).toEqual({ scenarioId: 'scenario:bridge-12-review' });
    expect(record.moment.availableActions.length).toBeGreaterThan(0);
    expect(record.momentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('derives available actions from the union of role grants (sorted, deduped)', () => {
    const result = captureEngineeringMoment(captureInput() as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const actions = (result.value as EngineeringMomentRecord).moment.availableActions;
    expect(actions).toEqual([...actions].sort());
    expect(new Set(actions).size).toBe(actions.length);
    // The inspector's viewer grant is subsumed by the full grants.
    expect(actions).toContain('select');
    expect(actions).toContain('take-control');
  });

  it('defaults the timeline position to the projection position', () => {
    const withReplay = projectCollaboration(validSession(), [
      ...joinedEvents(),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 8,
        tenantId: TENANT,
        actor: LEAD,
        occurredAt: T4,
        kind: 'intent.emitted',
        intent: { kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: 5 } },
      },
    ]);
    expect(withReplay.ok).toBe(true);
    if (!withReplay.ok) return;
    const input = captureInput({
      projection: withReplay.value,
      timelinePosition: undefined,
    });
    input.timelinePosition = undefined;
    const result = captureEngineeringMoment(input as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as EngineeringMomentRecord).moment.timelinePosition).toEqual({
      streamId: STREAM,
      sequence: 5,
    });
  });
});

describe('moment capture (named negatives)', () => {
  it('rejects a capture by a principal that is not a present participant', () => {
    const result = captureEngineeringMoment(captureInput({ capturedBy: 'principal:ghost' }) as never);
    expectFailure(result, 'validation');
  });

  it('rejects a capture by a participant that has left', () => {
    const left = projectCollaboration(validSession(), [
      ...joinedEvents(),
      {
        schemaVersion: 1,
        sessionId: SESSION,
        sequence: 8,
        tenantId: TENANT,
        actor: INSPECTOR,
        occurredAt: T4,
        kind: 'presence.changed',
        participant: INSPECTOR,
        presence: 'left',
      },
    ]);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    const result = captureEngineeringMoment(
      captureInput({ projection: left.value, capturedBy: INSPECTOR }) as never,
    );
    expectFailure(result, 'validation');
  });

  it('rejects a cross-tenant world-snapshot reference (R12)', () => {
    const result = captureEngineeringMoment(
      captureInput({ worldSnapshot: [{ ...ENTITY_REF, tenantId: OTHER_TENANT }] }) as never,
    );
    const denial = expectFailure(result, 'cross-tenant-denied');
    expect(denial.expectedTenantId).toBe(TENANT);
    expect(denial.encounteredTenantId).toBe(OTHER_TENANT);
  });

  it('rejects a cross-tenant evidence reference (R12)', () => {
    const result = captureEngineeringMoment(
      captureInput({ evidence: [{ ...EVIDENCE_REF, tenantId: OTHER_TENANT }] }) as never,
    );
    expectFailure(result, 'cross-tenant-denied');
  });

  it('rejects a dangling evidence reference (unknown-evidence-reference)', () => {
    const unknown = '0'.repeat(64);
    const result = captureEngineeringMoment(
      captureInput({ evidence: [{ ...EVIDENCE_REF, recordDigest: unknown }] }) as never,
    );
    const rejection = expectFailure(result, 'unknown-evidence-reference');
    expect(rejection.recordDigest).toBe(unknown);
  });

  it('rejects a timeline position on an unknown stream (replay-position-invalid)', () => {
    const result = captureEngineeringMoment(
      captureInput({ timelinePosition: { streamId: 'stream:ghost', sequence: 1 } }) as never,
    );
    expectFailure(result, 'replay-position-invalid');
  });

  it('rejects a timeline position beyond the stream bound (replay-position-invalid)', () => {
    const result = captureEngineeringMoment(
      captureInput({ timelinePosition: { streamId: STREAM, sequence: 8 } }) as never,
    );
    expectFailure(result, 'replay-position-invalid');
  });

  it('rejects a moment without a timeline position', () => {
    const input = captureInput();
    input.timelinePosition = undefined;
    // A projection without a replay position supplies no default either.
    input.projection = { ...(input.projection as object), timelinePosition: undefined };
    const result = captureEngineeringMoment(input as never);
    expectFailure(result, 'validation');
  });

  it('rejects a moment with no available actions (empty roles)', () => {
    const result = captureEngineeringMoment(captureInput({ roles: [] }) as never);
    expectFailure(result, 'validation');
  });
});

describe('moment digest discipline', () => {
  it('round-trips: seal -> serialize -> verify reproduces the content and digest', () => {
    const captured = captureEngineeringMoment(captureInput() as never);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const record = captured.value as EngineeringMomentRecord;
    const serialized = serializeMoment(record.moment);
    const reparsed = sealMoment(JSON.parse(serialized));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.value.momentDigest).toBe(record.momentDigest);
    expect(reparsed.value.moment).toEqual(record.moment);
    expect(computeMomentDigest(record.moment)).toBe(record.momentDigest);
  });

  it('verifyMomentDigest accepts the sealed record', () => {
    const captured = captureEngineeringMoment(captureInput() as never);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const verified = verifyMomentDigest(captured.value as EngineeringMomentRecord);
    expect(verified.ok).toBe(true);
  });

  it('rejects a tampered record (digest-mismatch)', () => {
    const captured = captureEngineeringMoment(captureInput() as never);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const record = captured.value as EngineeringMomentRecord;
    const tampered = {
      moment: { ...record.moment, label: 'tampered label' },
      momentDigest: record.momentDigest,
    };
    const rejection = expectFailure(verifyMomentDigest(tampered as never), 'digest-mismatch');
    expect(rejection.expected).not.toBe(rejection.encountered);
  });

  it('equal inputs produce equal digests; a changed field changes the digest', () => {
    const first = captureEngineeringMoment(captureInput() as never);
    const second = captureEngineeringMoment(captureInput() as never);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect((first.value as EngineeringMomentRecord).momentDigest).toBe(
      (second.value as EngineeringMomentRecord).momentDigest,
    );
    const changed = captureEngineeringMoment(captureInput({ label: 'other' }) as never);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect((changed.value as EngineeringMomentRecord).momentDigest).not.toBe(
      (first.value as EngineeringMomentRecord).momentDigest,
    );
  });
});

describe('moment boundaries', () => {
  it('admits the boundary timeline position 0 (the stream start)', () => {
    const result = captureEngineeringMoment(
      captureInput({ timelinePosition: { streamId: STREAM, sequence: 0 } }) as never,
    );
    expect(result.ok).toBe(true);
  });

  it('admits the boundary last-sequence position', () => {
    const result = captureEngineeringMoment(
      captureInput({ timelinePosition: { streamId: STREAM, sequence: 7 } }) as never,
    );
    expect(result.ok).toBe(true);
  });

  it('admits multiple sorted evidence references (deduped by digest)', () => {
    const other = '1'.repeat(64);
    const result = captureEngineeringMoment(
      captureInput({
        evidence: [
          { ...EVIDENCE_REF, recordDigest: other },
          { ...EVIDENCE_REF },
        ],
        knownEvidence: [DIGEST_EVIDENCE, other],
      }) as never,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const evidence = (result.value as EngineeringMomentRecord).moment.evidence;
    expect(evidence.map((ref) => ref.recordDigest)).toEqual([DIGEST_EVIDENCE, other].sort());
  });

  it('normalizes unsorted snapshot input into the canonical sorted order', () => {
    const result = captureEngineeringMoment(
      captureInput({
        worldSnapshot: [{ ...ENTITY_REF, entityId: 'element:zzz' }, ENTITY_REF],
      }) as never,
    );
    // The capture sorts internally: callers may supply any order; the
    // sealed record is canonically ordered (deterministic serialization).
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = (result.value as unknown as { moment: { worldSnapshot: { entityId: string }[] } })
      .moment.worldSnapshot;
    expect(snapshot.map((ref) => ref.entityId)).toEqual(['element:column-c4', 'element:zzz']);
  });
});
