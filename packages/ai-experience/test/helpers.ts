/**
 * Shared fixtures for the AI-experience tests. Builders return loose JSON
 * objects so negative tests can corrupt single fields precisely.
 * ZERO clock reads: instants are fixed constants.
 */
import type { ProjectedReference } from '@epoch/experience-protocol';
import { validateSessionDescriptor } from '../src/index';
import type {
  AiCollaborationEvent,
  AiSessionDescriptor,
  InteractionIntent,
  ParticipantRoleDescriptor,
} from '../src/index';

export const TENANT = 'tenant:acme';
export const OTHER_TENANT = 'tenant:globex';
export const SESSION = 'session:design-review';
export const OTHER_SESSION = 'session:other-review';
export const STREAM = 'stream:bridge-12-review';

export const LEAD = 'principal:lead-eng';
export const INSPECTOR = 'principal:inspector';
export const AGENT_PEER = 'principal:agent-reviewer';
export const AGENT_ID = 'agent:reviewer-01';

export const T0 = '2026-02-05T14:00:00.000Z';
export const T1 = '2026-02-05T14:00:01.000Z';
export const T2 = '2026-02-05T14:00:02.000Z';
export const T3 = '2026-02-05T14:00:03.000Z';
export const T4 = '2026-02-05T14:00:04.000Z';
export const T5 = '2026-02-05T14:00:05.000Z';

export const DIGEST_A: string = 'a'.repeat(64);
export const DIGEST_B: string = 'b'.repeat(64);
export const DIGEST_C: string = 'c'.repeat(64);
export const DIGEST_EVIDENCE: string = 'e'.repeat(64);

export const ENTITY_REF: ProjectedReference = {
  kind: 'world-entity',
  tenantId: TENANT,
  entityId: 'element:column-c4',
  contentDigest: DIGEST_A,
};

export const RELATION_REF: ProjectedReference = {
  kind: 'world-relation',
  tenantId: TENANT,
  relationId: `rel-${DIGEST_B}`,
  contentDigest: DIGEST_B,
};

export const OTHER_TENANT_REF: ProjectedReference = {
  kind: 'world-entity',
  tenantId: OTHER_TENANT,
  entityId: 'element:beam-b2',
  contentDigest: DIGEST_C,
};

export const EVIDENCE_REF = {
  kind: 'evidence-record',
  tenantId: TENANT,
  recordDigest: DIGEST_EVIDENCE,
} as const;

export const PROPOSAL_TARGET = {
  proposalId: 'msg-proposal-0001',
  canonicalDigest: DIGEST_C,
} as const;

/** The full interaction grant (every intent kind), sorted. */
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

/** A control-only grant (no take/release authority). */
export const VIEWER_GRANT = ['inspect', 'query', 'select'] as const;

/** One declared role as loose JSON. */
export function role(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    principalId: LEAD,
    participantKind: 'human',
    allowedIntents: [...FULL_GRANT],
    assignedAt: T0,
    ...overrides,
  };
}

/** A valid session descriptor as loose JSON (three declared roles). */
export function session(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: SESSION,
    tenantId: TENANT,
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
    ...overrides,
  };
}

/** One typed journal event as loose JSON (kind-neutral base). */
export function event(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionId: SESSION,
    sequence: 1,
    tenantId: TENANT,
    actor: LEAD,
    occurredAt: T1,
    kind: 'presence.changed',
    ...overrides,
  };
}

/** A presence fact as loose JSON. */
export function presenceEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return event({ participant: AGENT_PEER, presence: 'joining', ...overrides });
}

/** A minimal admitted event set: everyone joins and becomes present; the agent focuses. */
export function joinedEvents(): Record<string, unknown>[] {
  return [
    presenceEvent({ sequence: 1, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'joining' }),
    presenceEvent({ sequence: 2, actor: AGENT_PEER, participant: AGENT_PEER, presence: 'present' }),
    presenceEvent({ sequence: 3, actor: INSPECTOR, participant: INSPECTOR, presence: 'joining' }),
    presenceEvent({ sequence: 4, actor: INSPECTOR, participant: INSPECTOR, presence: 'present' }),
    presenceEvent({ sequence: 5, actor: LEAD, participant: LEAD, presence: 'joining' }),
    presenceEvent({ sequence: 6, actor: LEAD, participant: LEAD, presence: 'present' }),
    event({
      sequence: 7,
      actor: AGENT_PEER,
      kind: 'focus.changed',
      participant: AGENT_PEER,
      target: { kind: 'world-entity', entityId: 'element:column-c4' },
    }),
  ];
}

/** Test helper: assert a typed failure of exactly `code` (readable failures). */
export function expectFailure<C extends string>(
  result: { readonly ok: false; readonly error: { readonly code: string } } | { readonly ok: true },
  code: C,
): { readonly code: C } & Record<string, unknown> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${JSON.stringify(
        result.error,
      )}`,
    );
  }
  return result.error as unknown as { readonly code: C } & Record<string, unknown>;
}

/** The validated typed session descriptor (throws on invalid fixtures). */
export function validSession(overrides: Record<string, unknown> = {}): AiSessionDescriptor {
  const result = validateSessionDescriptor(session(overrides));
  if (!result.ok) {
    throw new Error(`fixture session invalid: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export type { AiCollaborationEvent, AiSessionDescriptor, InteractionIntent, ParticipantRoleDescriptor };
