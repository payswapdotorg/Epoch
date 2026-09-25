/**
 * Feature-module fixtures: plain-JSON records in the exact shapes the
 * `@epoch/ai-experience` package emits (pinned package-side by
 * `packages/ai-experience/test/feature-projection.test.ts`). ZERO clock
 * reads: instants are fixed constants.
 */
import type {
  AiCollaborationEvent,
  AiSessionDescriptor,
  CollaborationProjection,
  EngineeringMomentRecord,
} from '../contracts';

export const TENANT = 'tenant:acme';
export const SESSION = 'session:design-review';
export const STREAM = 'stream:bridge-12-review';
export const LEAD = 'principal:lead-eng';
export const INSPECTOR = 'principal:inspector';
export const AGENT_PEER = 'principal:agent-reviewer';
export const AGENT_ID = 'agent:reviewer-01';
export const DIGEST_A = 'a'.repeat(64);
export const DIGEST_EVIDENCE = 'e'.repeat(64);
export const DIGEST_MOMENT = 'f'.repeat(64);

export const T0 = '2026-02-05T14:00:00.000Z';
export const T1 = '2026-02-05T14:00:01.000Z';
export const T2 = '2026-02-05T14:00:02.000Z';
export const T3 = '2026-02-05T14:00:03.000Z';
export const T4 = '2026-02-05T14:00:04.000Z';

export const FULL_GRANT = [
  'annotate',
  'approve',
  'branch',
  'compare',
  'execute',
  'filter',
  'follow-agent',
  'inspect',
  'pause',
  'query',
  'reject',
  'release-control',
  'replay',
  'resume',
  'select',
  'take-control',
] as const;

export const VIEWER_GRANT = ['inspect', 'query', 'select'] as const;

export const ENTITY_REF = {
  kind: 'world-entity',
  tenantId: TENANT,
  entityId: 'element:column-c4',
  contentDigest: DIGEST_A,
} as const;

/** A valid session descriptor (the package's opening-fact record). */
export function sessionFixture(): AiSessionDescriptor {
  return {
    schemaVersion: 1,
    sessionId: SESSION,
    tenantId: TENANT,
    scope: { workspaceId: 'workspace:acme-eng', projectId: 'project:bridge-12' },
    displayName: 'Bridge 12 design review',
    openedBy: LEAD,
    openedAt: T0,
    roles: [
      {
        principalId: AGENT_PEER,
        participantKind: 'agent',
        agentId: AGENT_ID,
        allowedIntents: [...FULL_GRANT],
        assignedAt: T0,
      },
      {
        principalId: INSPECTOR,
        participantKind: 'human',
        allowedIntents: [...VIEWER_GRANT],
        assignedAt: T0,
      },
      {
        principalId: LEAD,
        participantKind: 'human',
        allowedIntents: [...FULL_GRANT],
        assignedAt: T0,
      },
    ],
  };
}

/** A valid typed journal event (the package's session-journal record). */
export function eventFixture(
  overrides: Partial<AiCollaborationEvent> = {},
): AiCollaborationEvent {
  return {
    schemaVersion: 1,
    sessionId: SESSION,
    sequence: 1,
    tenantId: TENANT,
    actor: LEAD,
    occurredAt: T1,
    kind: 'presence.changed',
    participant: AGENT_PEER,
    presence: 'joining',
    ...overrides,
  };
}

/** A valid event stream covering the collaboration semantics. */
export function eventFixtures(): AiCollaborationEvent[] {
  return [
    eventFixture({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
    eventFixture({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
    eventFixture({ sequence: 3, actor: INSPECTOR, participant: INSPECTOR, presence: 'joining' }),
    eventFixture({ sequence: 4, actor: INSPECTOR, participant: INSPECTOR, presence: 'present' }),
    eventFixture({ sequence: 5, actor: LEAD, participant: LEAD, presence: 'joining' }),
    eventFixture({ sequence: 6, actor: LEAD, participant: LEAD, presence: 'present' }),
    eventFixture({
      sequence: 7,
      actor: AGENT_PEER,
      kind: 'focus.changed',
      participant: AGENT_PEER,
      target: { kind: 'world-entity', entityId: 'element:column-c4' },
    }),
    eventFixture({
      sequence: 8,
      actor: LEAD,
      kind: 'control.taken',
      provenance: { actor: LEAD, occurredAt: T2, authority: { kind: 'role-grant' } },
    }),
    eventFixture({
      sequence: 9,
      actor: INSPECTOR,
      kind: 'control.denied',
      rejection: {
        actor: INSPECTOR,
        occurredAt: T2,
        claimedAuthority: { kind: 'role-grant' },
        reason: 'actor-lacks-control-authority',
      },
    }),
    eventFixture({
      sequence: 10,
      actor: INSPECTOR,
      kind: 'intent.emitted',
      intent: { kind: 'follow-agent', intentVersion: 1, agentId: AGENT_ID },
    }),
    eventFixture({
      sequence: 11,
      actor: LEAD,
      kind: 'intent.emitted',
      intent: { kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: 5 } },
    }),
    eventFixture({
      sequence: 12,
      actor: LEAD,
      kind: 'intent.emitted',
      intent: { kind: 'pause', intentVersion: 1 },
    }),
    eventFixture({
      sequence: 13,
      actor: INSPECTOR,
      kind: 'intent.emitted',
      intent: { kind: 'annotate', intentVersion: 1, target: ENTITY_REF, note: 'check the cover width' },
    }),
    eventFixture({
      sequence: 14,
      actor: LEAD,
      kind: 'moment.captured',
      momentDigest: DIGEST_MOMENT,
    }),
  ];
}

/** A valid collaboration projection (the package's fold output). */
export function projectionFixture(): CollaborationProjection {
  const events = eventFixtures();
  const roles = new Map(sessionFixture().roles.map((role) => [role.principalId, role]));
  const presence = [AGENT_PEER, INSPECTOR, LEAD].map((principalId, index) => ({
    principalId,
    participantKind: roles.get(principalId)!.participantKind,
    agentId: roles.get(principalId)!.agentId,
    presence: 'present' as const,
    lastSequence: index + 3,
  }));
  return {
    session: sessionFixture(),
    state: 'open',
    presence,
    focus: [
      {
        principalId: AGENT_PEER,
        target: { kind: 'world-entity', entityId: 'element:column-c4' },
        lastSequence: 7,
      },
    ],
    controller: LEAD,
    controlDenials: [
      {
        actor: INSPECTOR,
        occurredAt: T2,
        claimedAuthority: { kind: 'role-grant' },
        reason: 'actor-lacks-control-authority',
      },
    ],
    follows: [{ followerPrincipalId: INSPECTOR, agentId: AGENT_ID, lastSequence: 10 }],
    playback: 'paused',
    timelinePosition: { streamId: STREAM, sequence: 5 },
    branchPoints: [
      { from: { streamId: STREAM, sequence: 3 }, label: 'alt-steel', sequence: 11 },
    ],
    annotations: [
      { participant: INSPECTOR, target: ENTITY_REF, note: 'check the cover width', sequence: 13 },
    ],
    moments: [{ momentDigest: DIGEST_MOMENT, sequence: 14 }],
    view: {
      selection: ENTITY_REF,
      lastQuery: 'which columns fail the check?',
    },
    eventCount: events.length,
    lastSequence: events.length,
  };
}

/** A valid Engineering Moment record (the package's sealed record). */
export function momentFixture(): EngineeringMomentRecord {
  return {
    moment: {
      schemaVersion: 1,
      sessionId: SESSION,
      tenantId: TENANT,
      capturedBy: LEAD,
      capturedAt: T4,
      label: 'column check',
      worldSnapshot: [ENTITY_REF],
      agentState: [
        {
          principalId: AGENT_PEER,
          participantKind: 'agent',
          agentId: AGENT_ID,
          presence: 'present',
          focus: { kind: 'world-entity', entityId: 'element:column-c4' },
          holdsControl: false,
        },
      ],
      humanState: [
        {
          principalId: INSPECTOR,
          participantKind: 'human',
          presence: 'present',
          holdsControl: false,
        },
        {
          principalId: LEAD,
          participantKind: 'human',
          presence: 'present',
          holdsControl: true,
        },
      ],
      visualState: { graphKind: 'presence', graphDigest: DIGEST_A },
      timelinePosition: { streamId: STREAM, sequence: 5 },
      evidence: [{ kind: 'evidence-record', tenantId: TENANT, recordDigest: DIGEST_EVIDENCE }],
      scenario: { scenarioId: 'scenario:bridge-12-review' },
      availableActions: [...FULL_GRANT],
    },
    momentDigest: DIGEST_MOMENT,
  };
}
