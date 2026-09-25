// Guard tests: the runtime type guards accept the package's emitted
// record shapes and reject corrupted records at JSON boundaries.
import {
  isAgentPresenceState,
  isAiCollaborationEvent,
  isAiSessionDescriptor,
  isCollaborationProjection,
  isEngineeringMomentRecord,
  isInteractionIntentKind,
  isParticipantRoleDescriptor,
  isPeerParticipantKind,
  isPrincipalId,
  isSha256Digest,
  isSessionId,
  isTenantId,
  isTimelinePosition,
} from '../guards';
import {
  eventFixture,
  momentFixture,
  projectionFixture,
  sessionFixture,
} from './fixtures';

describe('primitive guards', () => {
  it('accepts the vocabulary members and rejects everything else', () => {
    for (const state of ['joining', 'present', 'idle', 'left']) {
      expect(isAgentPresenceState(state)).toBe(true);
    }
    expect(isAgentPresenceState('invisible')).toBe(false);
    expect(isAgentPresenceState(42)).toBe(false);

    for (const kind of ['agent', 'human']) {
      expect(isPeerParticipantKind(kind)).toBe(true);
    }
    expect(isPeerParticipantKind('system')).toBe(false);

    expect(isInteractionIntentKind('take-control')).toBe(true);
    expect(isInteractionIntentKind('teleport')).toBe(false);
    expect(isInteractionIntentKind(null)).toBe(false);
  });

  it('accepts the opaque id grammars and rejects malformed ids', () => {
    expect(isPrincipalId('principal:lead-eng')).toBe(true);
    expect(isPrincipalId('lead-eng')).toBe(false);
    expect(isPrincipalId('principal:Not-Lower')).toBe(false);
    expect(isSessionId('session:design-review')).toBe(true);
    expect(isSessionId('design-review')).toBe(false);
    expect(isTenantId('tenant:acme')).toBe(true);
    expect(isTenantId('acme')).toBe(false);
  });

  it('accepts only lowercase 64-hex digests', () => {
    expect(isSha256Digest('a'.repeat(64))).toBe(true);
    expect(isSha256Digest('A'.repeat(64))).toBe(false);
    expect(isSha256Digest('a'.repeat(63))).toBe(false);
    expect(isSha256Digest('a'.repeat(65))).toBe(false);
  });

  it('accepts nonnegative integer timeline positions only', () => {
    expect(isTimelinePosition({ streamId: 'stream:x', sequence: 0 })).toBe(true);
    expect(isTimelinePosition({ streamId: 'stream:x', sequence: 7 })).toBe(true);
    expect(isTimelinePosition({ streamId: 'stream:x', sequence: -1 })).toBe(false);
    expect(isTimelinePosition({ streamId: 'stream:x', sequence: 1.5 })).toBe(false);
    expect(isTimelinePosition({ streamId: 'stream:x' })).toBe(false);
  });
});

describe('record guards', () => {
  it('accepts a valid role descriptor', () => {
    const role = sessionFixture().roles[0]!;
    expect(isParticipantRoleDescriptor(role)).toBe(true);
    expect(
      isParticipantRoleDescriptor({ ...role, allowedIntents: ['teleport'] as never }),
    ).toBe(false);
    expect(isParticipantRoleDescriptor({ ...role, principalId: 'lead-eng' })).toBe(false);
  });

  it('accepts a valid session descriptor and rejects corruptions', () => {
    expect(isAiSessionDescriptor(sessionFixture())).toBe(true);
    expect(isAiSessionDescriptor({ ...sessionFixture(), schemaVersion: 2 })).toBe(false);
    expect(isAiSessionDescriptor({ ...sessionFixture(), tenantId: 'acme' })).toBe(false);
    expect(isAiSessionDescriptor({ ...sessionFixture(), roles: [] })).toBe(false);
    expect(isAiSessionDescriptor(null)).toBe(false);
  });

  it('accepts valid typed events and rejects corruptions', () => {
    expect(isAiCollaborationEvent(eventFixture())).toBe(true);
    expect(isAiCollaborationEvent(eventFixture({ schemaVersion: 2 }))).toBe(false);
    expect(isAiCollaborationEvent(eventFixture({ kind: 'time.traveled' as never }))).toBe(false);
    expect(isAiCollaborationEvent(eventFixture({ sequence: 0 }))).toBe(false);
    expect(isAiCollaborationEvent(eventFixture({ tenantId: 'acme' }))).toBe(false);
    expect(isAiCollaborationEvent(eventFixture({ momentDigest: 'not-a-digest' }))).toBe(false);
    expect(isAiCollaborationEvent('nope')).toBe(false);
  });

  it('accepts a valid projection and rejects corruptions', () => {
    expect(isCollaborationProjection(projectionFixture())).toBe(true);
    expect(
      isCollaborationProjection({ ...projectionFixture(), state: 'half-open' }),
    ).toBe(false);
    expect(
      isCollaborationProjection({ ...projectionFixture(), playback: 'buffering' }),
    ).toBe(false);
    expect(isCollaborationProjection({ ...projectionFixture(), presence: 'nope' })).toBe(false);
    expect(isCollaborationProjection({ ...projectionFixture(), session: null })).toBe(false);
  });

  it('accepts a valid Engineering Moment record and rejects corruptions', () => {
    expect(isEngineeringMomentRecord(momentFixture())).toBe(true);
    expect(
      isEngineeringMomentRecord({ ...momentFixture(), momentDigest: 'zzz' }),
    ).toBe(false);
    const emptyEvidence = momentFixture();
    (emptyEvidence.moment as unknown as { evidence: unknown[] }).evidence = [];
    expect(isEngineeringMomentRecord(emptyEvidence)).toBe(false);
    const noActions = momentFixture();
    (noActions.moment as unknown as { availableActions: unknown[] }).availableActions = [];
    expect(isEngineeringMomentRecord(noActions)).toBe(false);
    expect(isEngineeringMomentRecord(undefined)).toBe(false);
  });
});
