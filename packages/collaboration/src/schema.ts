/**
 * @epoch/collaboration — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (collaboration-vendor products, transport
 * hints, presence-broker fields) cannot enter kernel types (lock rule
 * 13). Every exported schema is part of the published surface emitted
 * under `schemas/`.
 *
 * Runtime vocabulary composition (the W010 dependency policy): world
 * entity ids use @epoch/world-model's `EntityIdSchema` (W002 grammar);
 * action proposal references use @epoch/action-protocol's
 * `ProposalReferenceSchema` (W003 grammar); timestamps use
 * @epoch/agent-protocol's `TimestampSchema`. Tenant/principal id
 * grammars are mirrored from W009 and pinned by devDependency parity
 * tests.
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import { EntityIdSchema } from '@epoch/world-model';
import { ProposalReferenceSchema } from '@epoch/action-protocol';
import {
  COLLABORATION_EVENT_KINDS,
  COLLABORATION_PRINCIPAL_ID_PATTERN,
  COLLABORATION_PROJECT_ID_PATTERN,
  COLLABORATION_SESSION_ID_PATTERN,
  COLLABORATION_TENANT_ID_PATTERN,
  COLLABORATION_WORKSPACE_ID_PATTERN,
  COLLABORATION_SUBJECT_KINDS,
  COLLABORATION_RECORD_VERSION,
  PRESENCE_STATES,
  SESSION_STATES,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Version discriminator on serialized collaboration records (v1). */
export const CollaborationRecordVersionSchema = z
  .literal(COLLABORATION_RECORD_VERSION)
  .meta({
    id: 'CollaborationRecordVersion',
    title: 'CollaborationRecordVersion',
    description:
      'Version discriminator carried by every serialized collaboration record (currently 1).',
  });

/** Opaque collaboration session identity (`session:<slug>`). */
export const CollaborationSessionIdSchema = z
  .string()
  .regex(
    COLLABORATION_SESSION_ID_PATTERN,
    'must be a session id of the form "session:<slug>"',
  )
  .meta({
    id: 'CollaborationSessionId',
    title: 'CollaborationSessionId',
    description: 'Opaque collaboration session identity: "session:" followed by a lowercase slug.',
  });

/** Tenant scope of a session (`tenant:<slug>`). */
export const CollaborationTenantIdSchema = z
  .string()
  .regex(
    COLLABORATION_TENANT_ID_PATTERN,
    'must be a tenant id of the form "tenant:<slug>"',
  )
  .meta({
    id: 'CollaborationTenantId',
    title: 'CollaborationTenantId',
    description: 'Opaque tenant scope of a collaboration session (W009 grammar).',
  });

/** Opaque participant principal id (`principal:<slug>`). */
export const ParticipantPrincipalIdSchema = z
  .string()
  .regex(
    COLLABORATION_PRINCIPAL_ID_PATTERN,
    'must be a principal id of the form "principal:<slug>"',
  )
  .meta({
    id: 'ParticipantPrincipalId',
    title: 'ParticipantPrincipalId',
    description: 'Opaque session participant principal id (W009 grammar).',
  });

/** Optional session scope narrowing (workspace/project). */
export const SessionScopeSchema = z
  .strictObject({
    workspaceId: z
      .string()
      .regex(
        COLLABORATION_WORKSPACE_ID_PATTERN,
        'must be a workspace id of the form "workspace:<slug>"',
      )
      .optional(),
    projectId: z
      .string()
      .regex(
        COLLABORATION_PROJECT_ID_PATTERN,
        'must be a project id of the form "project:<slug>"',
      )
      .optional(),
  })
  .readonly()
  .refine(
    (scope) => scope.projectId === undefined || scope.workspaceId !== undefined,
    'a project-scoped session must also name its workspace (no level skipping)',
  )
  .meta({
    id: 'SessionScope',
    title: 'SessionScope',
    description:
      'Optional tenant-hierarchy narrowing of a session: workspace and (with it) project ids.',
  });

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Session lifecycle states. */
export const SessionStateSchema = z.enum(SESSION_STATES).meta({
  id: 'SessionState',
  title: 'SessionState',
  description: 'Session lifecycle state: open or closed (closed is terminal).',
});

/** Presence states. */
export const PresenceStateSchema = z.enum(PRESENCE_STATES).meta({
  id: 'PresenceState',
  title: 'PresenceState',
  description: 'Presence of a session participant: joining, present, idle, or left (terminal).',
});

/** The coordination subject kinds. */
export const CollaborationSubjectKindSchema = z
  .enum(COLLABORATION_SUBJECT_KINDS)
  .meta({
    id: 'CollaborationSubjectKind',
    title: 'CollaborationSubjectKind',
    description: 'What a coordination subject references: a world entity or an action proposal.',
  });

/** One coordination subject (opaque reference into the shared model). */
export const CollaborationSubjectSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('world-entity'),
        entityId: EntityIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('action-proposal'),
        proposal: ProposalReferenceSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'CollaborationSubject',
    title: 'CollaborationSubject',
    description:
      'Opaque reference into the shared model: a world entity (W002) or an action proposal at an exact revision (W003). Never embedded, never mutated by coordination.',
  });

/** The immutable session record (the session's opening fact). */
export const CollaborationSessionSchema = z
  .strictObject({
    schemaVersion: CollaborationRecordVersionSchema,
    sessionId: CollaborationSessionIdSchema,
    tenantId: CollaborationTenantIdSchema,
    scope: SessionScopeSchema.optional(),
    displayName: z.string().min(1).max(200),
    createdBy: ParticipantPrincipalIdSchema,
    openedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'CollaborationSession',
    title: 'CollaborationSession',
    description:
      'Immutable collaboration session record: tenant-scoped, optionally workspace/project-narrowed, opened by a principal at a producer-supplied instant.',
  });

/** A session creation envelope (content + claimed digest). */
export const SessionRegistrationSchema = z
  .strictObject({
    session: CollaborationSessionSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'SessionRegistration',
    title: 'SessionRegistration',
    description: 'Session creation envelope: record plus the claimed canonical SHA-256 digest.',
  });

/** The published session record: content plus its content address. */
export const CollaborationSessionRecordSchema = z
  .strictObject({
    session: CollaborationSessionSchema,
    sessionDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'CollaborationSessionRecord',
    title: 'CollaborationSessionRecord',
    description: 'Published session record: immutable content plus its content address.',
  });

/** One session-scoped coordination event kind. */
export const CollaborationEventKindSchema = z
  .enum(COLLABORATION_EVENT_KINDS)
  .meta({
    id: 'CollaborationEventKind',
    title: 'CollaborationEventKind',
    description:
      'Closed vocabulary of session-scoped coordination kinds: membership, presence, subject focus, notes, and the terminal session.closed.',
  });

/** Opaque JSON data of a coordination envelope (coordination.note payloads). */
export const CoordinationDataSchema = z
  .record(z.string().min(1).max(256), JsonValueSchema)
  .readonly()
  .meta({
    id: 'CoordinationData',
    title: 'CoordinationData',
    description: 'Opaque JSON data of a session-scoped coordination envelope.',
  });

/**
 * The immutable content of one coordination event. The per-kind member
 * consistency (participant/presence/subject presence) is a runtime
 * refinement enforced by the admission machinery (src/hub.ts) so the
 * typed errors carry precise paths and codes.
 */
export const CollaborationEventSchema = z
  .strictObject({
    schemaVersion: CollaborationRecordVersionSchema,
    sessionId: CollaborationSessionIdSchema,
    sequence: z
      .number()
      .int('journal sequences are integers')
      .min(1, 'journal sequences start at 1')
      .max(Number.MAX_SAFE_INTEGER),
    tenantId: CollaborationTenantIdSchema,
    actor: ParticipantPrincipalIdSchema,
    kind: CollaborationEventKindSchema,
    participant: ParticipantPrincipalIdSchema.optional(),
    presence: PresenceStateSchema.optional(),
    subject: CollaborationSubjectSchema.optional(),
    data: CoordinationDataSchema.optional(),
    occurredAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'CollaborationEvent',
    title: 'CollaborationEvent',
    description:
      'Immutable session-scoped coordination event: sequence, tenant scope, acting principal, coordination kind, and the producer-supplied occurrence instant.',
  });

/** The published coordination event record. */
export const CollaborationEventRecordSchema = z
  .strictObject({
    event: CollaborationEventSchema,
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'CollaborationEventRecord',
    title: 'CollaborationEventRecord',
    description:
      'Published coordination event record: immutable content plus its content address.',
  });

/** A coordination event creation envelope. */
export const CollaborationEventRegistrationSchema = z
  .strictObject({
    event: CollaborationEventSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'CollaborationEventRegistration',
    title: 'CollaborationEventRegistration',
    description: 'Coordination event creation envelope: content plus the claimed digest.',
  });

/** The membership projection of one participant. */
export const ParticipantPresenceSchema = z
  .strictObject({
    principalId: ParticipantPrincipalIdSchema,
    presence: PresenceStateSchema,
    lastSequence: z.number().int().min(1),
  })
  .readonly()
  .meta({
    id: 'ParticipantPresence',
    title: 'ParticipantPresence',
    description: 'Membership projection of one session participant: principal, presence, last touch.',
  });

/** The session state projection. */
export const SessionStateInfoSchema = z
  .strictObject({
    session: CollaborationSessionSchema,
    state: SessionStateSchema,
    participants: z.array(ParticipantPresenceSchema).readonly(),
    lastSequence: z.number().int().min(0),
    eventCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'SessionStateInfo',
    title: 'SessionStateInfo',
    description:
      'Session state projection: lifecycle, membership/presence, and the journal cursor.',
  });

/** One flattened validation issue. */
export const CollaborationIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'CollaborationIssue',
    title: 'CollaborationIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** The deterministic whole-hub projection. */
export const CollaborationSnapshotSchema = z
  .strictObject({
    schemaVersion: CollaborationRecordVersionSchema,
    sessions: z.array(CollaborationSessionRecordSchema).readonly(),
    events: z.array(CollaborationEventRecordSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'CollaborationSnapshot',
    title: 'CollaborationSnapshot',
    description:
      'Deterministic whole-hub projection: sessions sorted by id, coordination journals sorted by (session, sequence).',
  });
