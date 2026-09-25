/**
 * @epoch/ai-experience — runtime zod validators (v1).
 *
 * Every validator is a STRICT object (unknown — vendor/provider — fields
 * are rejected) with `.meta()` ids for the deterministic JSON Schema
 * emission (src/contract-emission.ts). Foreign vocabularies are RUNTIME
 * reuses (agent-protocol ids/digests/timestamps, event-log stream ids,
 * experience-protocol references) so a grammar change upstream fails this
 * package's compile and tests; the W010 collaboration subject/event
 * grammars are MIRRORED here and parity-pinned by devDependency tests
 * (never runtime imports).
 */
import { z } from 'zod';
import { JsonValueSchema, MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import { EventSequenceSchema, EventStreamIdSchema } from '@epoch/event-log';
import {
  ProjectedEvidenceRefSchema,
  ProjectedReferenceSchema,
  projectedReferenceKey,
} from '@epoch/experience-protocol';
import {
  ACTION_PROPOSAL_ID_PATTERN,
  AGENT_PRESENCE_STATES,
  AI_AGENT_ID_PATTERN,
  AI_EXPERIENCE_RECORD_VERSION,
  AI_PRINCIPAL_ID_PATTERN,
  AI_PROJECT_ID_PATTERN,
  AI_SESSION_ID_PATTERN,
  AI_TENANT_ID_PATTERN,
  AI_WORKSPACE_ID_PATTERN,
  CONTROL_AUTHORITY_KINDS,
  CONTROL_DENIAL_REASONS,
  FOCUS_TARGET_KINDS,
  INTENT_PAYLOAD_VERSION,
  INTERACTION_INTENT_KINDS,
  MAX_BRANCH_LABEL_LENGTH,
  MAX_MOMENT_EVIDENCE,
  MAX_MOMENT_PARTICIPANTS,
  MAX_MOMENT_REFERENCES,
  MAX_NAME_LENGTH,
  MAX_OPEN_DATA_KEYS,
  MAX_ROLE_INTENTS,
  MAX_SCENARIO_REF_LENGTH,
  MAX_SESSION_ROLES,
  MAX_TEXT_LENGTH,
  PEER_PARTICIPANT_KINDS,
  SHA256_HEX_PATTERN,
} from './version';

// ---------------------------------------------------------------------------
// Shared primitives.
// ---------------------------------------------------------------------------

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const Sha256DigestSchema = z.string().regex(SHA256_HEX_PATTERN).meta({
  id: 'Sha256Digest',
  title: 'Sha256Digest',
  description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
});

export const AiExperienceRecordVersionSchema = z
  .literal(AI_EXPERIENCE_RECORD_VERSION)
  .meta({
    id: 'AiExperienceRecordVersion',
    title: 'AiExperienceRecordVersion',
    description: 'Exact record version admitted by this release (1).',
  });

export const AiTenantIdSchema = z.string().regex(AI_TENANT_ID_PATTERN).meta({
  id: 'AiTenantId',
  title: 'AiTenantId',
  description: 'Tenant scope of an AI-collaboration record: "tenant:" followed by a lowercase slug (W009 grammar).',
});

export const AiPrincipalIdSchema = z.string().regex(AI_PRINCIPAL_ID_PATTERN).meta({
  id: 'AiPrincipalId',
  title: 'AiPrincipalId',
  description: 'Collaboration participant principal: "principal:" followed by a lowercase slug (W009 grammar).',
});

export const AiSessionIdSchema = z.string().regex(AI_SESSION_ID_PATTERN).meta({
  id: 'AiSessionId',
  title: 'AiSessionId',
  description: 'Collaboration session identity: "session:" followed by a lowercase slug (W010 grammar).',
});

const AgentIdSchema = z.string().regex(AI_AGENT_ID_PATTERN).meta({
  id: 'AiAgentId',
  title: 'AiAgentId',
  description: 'Registered agent identity: "agent:" followed by a lowercase slug (W003 grammar).',
});

export const AiSessionStateSchema = z.enum(['open', 'closed']).meta({
  id: 'AiSessionState',
  title: 'AiSessionState',
  description: 'Lifecycle state of a collaboration session (W010 vocabulary): open or closed (terminal).',
});

export const AgentPresenceStateSchema = z.enum(AGENT_PRESENCE_STATES).meta({
  id: 'AgentPresenceState',
  title: 'AgentPresenceState',
  description: 'Presence state of a collaboration participant (W010 vocabulary): joining, present, idle, or the terminal left.',
});

export const PeerParticipantKindSchema = z.enum(PEER_PARTICIPANT_KINDS).meta({
  id: 'PeerParticipantKind',
  title: 'PeerParticipantKind',
  description: 'Collaboration peer participant kind — the W011 ParticipantKind subset of humans and agents (peers with typed roles).',
});

export const InteractionIntentKindSchema = z.enum(INTERACTION_INTENT_KINDS).meta({
  id: 'InteractionIntentKind',
  title: 'InteractionIntentKind',
  description: 'Kind of a typed interaction intent — a closed, sorted subset of the Epoch Universal interactions.',
});

export const PlaybackStateSchema = z.enum(['playing', 'paused']).meta({
  id: 'PlaybackState',
  title: 'PlaybackState',
  description: 'The playback state of a collaboration session (pause/resume intents).',
});

/** Sorted, duplicate-free intent-grant array (deterministic set semantics). */
const IntentGrantSchema = z
  .array(InteractionIntentKindSchema)
  .min(1)
  .max(MAX_ROLE_INTENTS)
  .refine(
    (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
    'intent grants must be sorted ascending and duplicate-free (deterministic set semantics)',
  )
  .readonly();

const NonEmptyNameSchema = z.string().min(1).max(MAX_NAME_LENGTH);
const TextSchema = z.string().min(1).max(MAX_TEXT_LENGTH);
const BranchLabelSchema = z.string().min(1).max(MAX_BRANCH_LABEL_LENGTH);

/** Open JSON data record (annotation data / filter criteria), blocklist-scanned at admission. */
const OpenDataSchema = z
  .record(z.string().min(1).max(256), JsonValueSchema)
  .refine(
    (data) => Object.keys(data).length <= MAX_OPEN_DATA_KEYS,
    `open payload data may carry at most ${MAX_OPEN_DATA_KEYS} keys`,
  )
  .readonly();

// ---------------------------------------------------------------------------
// Focus targets (the W010 collaboration subject grammar, mirrored).
// ---------------------------------------------------------------------------

/** The exact-revision action-proposal reference (W003 ProposalReference shape, mirrored). */
export const ActionProposalTargetSchema = z
  .strictObject({
    proposalId: z.string().regex(ACTION_PROPOSAL_ID_PATTERN),
    canonicalDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'ActionProposalTarget',
    title: 'ActionProposalTarget',
    description:
      'Exact-revision action-proposal reference (W003 ProposalReference shape): message id plus the SHA-256 digest of the canonical proposal.',
  });

const WorldEntityTargetSchema = z
  .strictObject({
    kind: z.literal('world-entity'),
    entityId: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'WorldEntityTarget',
    title: 'WorldEntityTarget',
    description: 'World-entity focus target: an opaque W002 entity id (referenced, never embedded).',
  });

const ActionProposalFocusTargetSchema = z
  .strictObject({
    kind: z.literal('action-proposal'),
    proposal: ActionProposalTargetSchema,
  })
  .readonly()
  .meta({
    id: 'ActionProposalFocusTarget',
    title: 'ActionProposalFocusTarget',
    description: 'Action-proposal focus target: an exact-revision W003 proposal reference (referenced, never embedded).',
  });

export const FocusTargetSchema = z
  .discriminatedUnion('kind', [WorldEntityTargetSchema, ActionProposalFocusTargetSchema])
  .meta({
    id: 'FocusTarget',
    title: 'FocusTarget',
    description:
      'What a participant focuses on — the W010 collaboration subject grammar (world entity or exact-revision action proposal), mirrored and parity-pinned.',
  });

export const FocusTargetKindSchema = z.enum(FOCUS_TARGET_KINDS).meta({
  id: 'FocusTargetKind',
  title: 'FocusTargetKind',
  description: 'Kind of a focus target: world-entity or action-proposal (W010 vocabulary).',
});

// ---------------------------------------------------------------------------
// Control authority, provenance, rejection.
// ---------------------------------------------------------------------------

export const ControlAuthoritySchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('session-owner') }).readonly(),
    z.strictObject({ kind: z.literal('role-grant') }).readonly(),
    z
      .strictObject({
        kind: z.literal('explicit-handover'),
        from: AiPrincipalIdSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'ControlAuthority',
    title: 'ControlAuthority',
    description:
      'The authority a takeover claims: session-owner, role-grant, or an explicit handover from the current controller.',
  });

export const ControlAuthorityKindSchema = z.enum(CONTROL_AUTHORITY_KINDS).meta({
  id: 'ControlAuthorityKind',
  title: 'ControlAuthorityKind',
  description: 'The authority a takeover claims: session-owner, role-grant, or explicit-handover.',
});

export const ControlProvenanceSchema = z
  .strictObject({
    actor: AiPrincipalIdSchema,
    occurredAt: TimestampSchema,
    authority: ControlAuthoritySchema,
  })
  .readonly()
  .meta({
    id: 'ControlProvenance',
    title: 'ControlProvenance',
    description: 'Provenance of a control transition: who acted, when (producer-supplied), on what authority.',
  });

export const ControlDenialReasonSchema = z.enum(CONTROL_DENIAL_REASONS).meta({
  id: 'ControlDenialReason',
  title: 'ControlDenialReason',
  description: 'Why a control transition was denied: the role lacks the authority, the actor is not the controller, or the claimed authority does not hold.',
});

export const ControlRejectionSchema = z
  .strictObject({
    actor: AiPrincipalIdSchema,
    occurredAt: TimestampSchema,
    claimedAuthority: ControlAuthoritySchema,
    reason: ControlDenialReasonSchema,
  })
  .readonly()
  .meta({
    id: 'ControlRejection',
    title: 'ControlRejection',
    description: 'Typed rejection of an unauthorized control transition — the full claimed provenance plus the typed denial reason.',
  });

// ---------------------------------------------------------------------------
// Timeline positions.
// ---------------------------------------------------------------------------

/** Nonnegative event sequence (timeline positions include 0 = stream start). */
const NonnegativeSequenceSchema = z
  .number()
  .int('timeline sequences are integers')
  .min(0, 'timeline positions include 0 (the stream start)')
  .max(Number.MAX_SAFE_INTEGER);

export const TimelinePositionSchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    sequence: NonnegativeSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'TimelinePosition',
    title: 'TimelinePosition',
    description:
      'One timeline/replay position: a W010 event-log stream coordinate (inclusive last-applied sequence; 0 denotes the stream start).',
  });

export const StreamBoundSchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    lastSequence: NonnegativeSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'StreamBound',
    title: 'StreamBound',
    description: 'One known stream bound: the stream id and its last applied event sequence.',
  });

export const BranchPointSchema = z
  .strictObject({
    from: TimelinePositionSchema,
    label: BranchLabelSchema.optional(),
    sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .readonly()
  .meta({
    id: 'BranchPoint',
    title: 'BranchPoint',
    description: 'One recorded timeline branch point (from a branch intent).',
  });

// ---------------------------------------------------------------------------
// The interaction-intent union (each member a versioned member).
// ---------------------------------------------------------------------------

const intentVersionLiteral = z.literal(INTENT_PAYLOAD_VERSION);

const AnnotateIntentSchema = z
  .strictObject({
    kind: z.literal('annotate'),
    intentVersion: intentVersionLiteral,
    target: ProjectedReferenceSchema,
    note: TextSchema,
    data: OpenDataSchema.optional(),
  })
  .readonly();

const ApproveIntentSchema = z
  .strictObject({
    kind: z.literal('approve'),
    intentVersion: intentVersionLiteral,
    target: ActionProposalTargetSchema,
  })
  .readonly();

const BranchIntentSchema = z
  .strictObject({
    kind: z.literal('branch'),
    intentVersion: intentVersionLiteral,
    from: TimelinePositionSchema,
    label: BranchLabelSchema.optional(),
  })
  .readonly();

const CompareIntentSchema = z
  .strictObject({
    kind: z.literal('compare'),
    intentVersion: intentVersionLiteral,
    targets: z.tuple([ProjectedReferenceSchema, ProjectedReferenceSchema]),
  })
  .readonly()
  .superRefine((intent, ctx) => {
    if (projectedReferenceKey(intent.targets[0]) === projectedReferenceKey(intent.targets[1])) {
      ctx.addIssue({
        code: 'custom',
        message: 'compare targets must be two distinct references',
        path: ['targets'],
      });
    }
  });

const ExecuteIntentSchema = z
  .strictObject({
    kind: z.literal('execute'),
    intentVersion: intentVersionLiteral,
    target: ActionProposalTargetSchema,
  })
  .readonly();

const FilterIntentSchema = z
  .strictObject({
    kind: z.literal('filter'),
    intentVersion: intentVersionLiteral,
    criteria: OpenDataSchema,
  })
  .readonly();

const FollowAgentIntentSchema = z
  .strictObject({
    kind: z.literal('follow-agent'),
    intentVersion: intentVersionLiteral,
    agentId: AgentIdSchema,
  })
  .readonly();

const InspectIntentSchema = z
  .strictObject({
    kind: z.literal('inspect'),
    intentVersion: intentVersionLiteral,
    target: ProjectedReferenceSchema,
  })
  .readonly();

const PauseIntentSchema = z
  .strictObject({
    kind: z.literal('pause'),
    intentVersion: intentVersionLiteral,
  })
  .readonly();

const QueryIntentSchema = z
  .strictObject({
    kind: z.literal('query'),
    intentVersion: intentVersionLiteral,
    text: TextSchema,
  })
  .readonly();

const ReplayIntentSchema = z
  .strictObject({
    kind: z.literal('replay'),
    intentVersion: intentVersionLiteral,
    position: TimelinePositionSchema,
  })
  .readonly();

const RejectIntentSchema = z
  .strictObject({
    kind: z.literal('reject'),
    intentVersion: intentVersionLiteral,
    target: ActionProposalTargetSchema,
  })
  .readonly();

const ReleaseControlIntentSchema = z
  .strictObject({
    kind: z.literal('release-control'),
    intentVersion: intentVersionLiteral,
  })
  .readonly();

const ResumeIntentSchema = z
  .strictObject({
    kind: z.literal('resume'),
    intentVersion: intentVersionLiteral,
  })
  .readonly();

const SelectIntentSchema = z
  .strictObject({
    kind: z.literal('select'),
    intentVersion: intentVersionLiteral,
    target: ProjectedReferenceSchema,
  })
  .readonly();

const TakeControlIntentSchema = z
  .strictObject({
    kind: z.literal('take-control'),
    intentVersion: intentVersionLiteral,
    authority: ControlAuthoritySchema,
  })
  .readonly();

export const InteractionIntentSchema = z
  .discriminatedUnion('kind', [
    AnnotateIntentSchema,
    ApproveIntentSchema,
    BranchIntentSchema,
    CompareIntentSchema,
    ExecuteIntentSchema,
    FilterIntentSchema,
    FollowAgentIntentSchema,
    InspectIntentSchema,
    PauseIntentSchema,
    QueryIntentSchema,
    ReplayIntentSchema,
    RejectIntentSchema,
    ReleaseControlIntentSchema,
    ResumeIntentSchema,
    SelectIntentSchema,
    TakeControlIntentSchema,
  ])
  .meta({
    id: 'InteractionIntent',
    title: 'InteractionIntent',
    description:
      'The typed interaction-intent union: sixteen versioned members, one per admitted Universal-interaction subset. Agents emit typed intents, never executable UI code.',
  });

// ---------------------------------------------------------------------------
// Role descriptors + session descriptor.
// ---------------------------------------------------------------------------

export const ParticipantRoleDescriptorSchema = z
  .strictObject({
    principalId: AiPrincipalIdSchema,
    participantKind: PeerParticipantKindSchema,
    agentId: AgentIdSchema.optional(),
    allowedIntents: IntentGrantSchema,
    assignedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((role, ctx) => {
    if (role.participantKind === 'agent' && role.agentId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'agent peers must carry their registered agent id (W003 grammar)',
        path: ['agentId'],
      });
    }
    if (role.participantKind === 'human' && role.agentId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'human peers do not carry agent ids',
        path: ['agentId'],
      });
    }
  })
  .meta({
    id: 'ParticipantRoleDescriptor',
    title: 'ParticipantRoleDescriptor',
    description:
      'Human/agent role descriptor: the participant principal, its peer kind, the registered agent id for agent peers, and the granted interaction intents.',
  });

export const AiSessionScopeSchema = z
  .strictObject({
    workspaceId: z.string().regex(AI_WORKSPACE_ID_PATTERN).optional(),
    projectId: z.string().regex(AI_PROJECT_ID_PATTERN).optional(),
  })
  .readonly()
  .superRefine((scope, ctx) => {
    if (scope.projectId !== undefined && scope.workspaceId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a project narrowing requires its workspace (W009 hierarchy)',
        path: ['workspaceId'],
      });
    }
  })
  .meta({
    id: 'AiSessionScope',
    title: 'AiSessionScope',
    description: 'Optional tenant-hierarchy narrowing of a collaboration session (W009/W010 grammars).',
  });

export const AiSessionDescriptorSchema = z
  .strictObject({
    schemaVersion: AiExperienceRecordVersionSchema,
    sessionId: AiSessionIdSchema,
    tenantId: AiTenantIdSchema,
    scope: AiSessionScopeSchema.optional(),
    displayName: NonEmptyNameSchema,
    openedBy: AiPrincipalIdSchema,
    openedAt: TimestampSchema,
    roles: z
      .array(ParticipantRoleDescriptorSchema)
      .min(1)
      .max(MAX_SESSION_ROLES)
      .readonly(),
  })
  .readonly()
  .superRefine((session, ctx) => {
    const ids = session.roles.map((role) => role.principalId);
    for (let i = 1; i < ids.length; i += 1) {
      if (ids[i] < ids[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'roles must be sorted by principalId ascending (deterministic serialization)',
          path: ['roles'],
        });
        break;
      }
      if (ids[i] === ids[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'role principal ids must be unique',
          path: ['roles'],
        });
        break;
      }
    }
    if (!ids.includes(session.openedBy)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the opening principal must hold a declared role',
        path: ['openedBy'],
      });
    }
  })
  .meta({
    id: 'AiSessionDescriptor',
    title: 'AiSessionDescriptor',
    description:
      'The typed, tenant-scoped AI-collaboration session descriptor — the opening fact with declared peer roles; every subsequent semantic is an event, never a mutation.',
  });

// ---------------------------------------------------------------------------
// The typed AI-collaboration event (session-journal shape over W010).
// ---------------------------------------------------------------------------

export const AiCollaborationEventKindSchema = z
  .enum([
    'control.denied',
    'control.released',
    'control.taken',
    'focus.changed',
    'focus.released',
    'intent.emitted',
    'moment.captured',
    'presence.changed',
    'session.closed',
  ])
  .meta({
    id: 'AiCollaborationEventKind',
    title: 'AiCollaborationEventKind',
    description: 'Kind of a typed AI-collaboration event: presence, focus, control transitions/denials, emitted intents, captured moments, or the terminal session close.',
  });

export const AiCollaborationEventSchema = z
  .strictObject({
    schemaVersion: AiExperienceRecordVersionSchema,
    sessionId: AiSessionIdSchema,
    sequence: z
      .number()
      .int('journal sequences are integers')
      .min(1, 'journal sequences start at 1')
      .max(Number.MAX_SAFE_INTEGER),
    tenantId: AiTenantIdSchema,
    actor: AiPrincipalIdSchema,
    occurredAt: TimestampSchema,
    kind: AiCollaborationEventKindSchema,
    participant: AiPrincipalIdSchema.optional(),
    presence: AgentPresenceStateSchema.optional(),
    target: FocusTargetSchema.optional(),
    provenance: ControlProvenanceSchema.optional(),
    supersededController: AiPrincipalIdSchema.optional(),
    rejection: ControlRejectionSchema.optional(),
    intent: InteractionIntentSchema.optional(),
    momentDigest: Sha256DigestSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'AiCollaborationEvent',
    title: 'AiCollaborationEvent',
    description:
      'Immutable typed AI-collaboration event in the W010 session-journal envelope grammar: sequence, tenant scope, acting principal, event kind, and the producer-supplied occurrence instant.',
  });

export const AiCollaborationEventRecordSchema = z
  .strictObject({
    event: AiCollaborationEventSchema,
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'AiCollaborationEventRecord',
    title: 'AiCollaborationEventRecord',
    description: 'Published AI-collaboration event record: immutable content plus its content address.',
  });

export const AiCollaborationEventRegistrationSchema = z
  .strictObject({
    event: AiCollaborationEventSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'AiCollaborationEventRegistration',
    title: 'AiCollaborationEventRegistration',
    description: 'AI-collaboration event creation envelope: content plus the digest claimed for it.',
  });

// ---------------------------------------------------------------------------
// The mirrored W010 collaboration event record (adapter input).
// ---------------------------------------------------------------------------

export const MirroredCollaborationEventKindSchema = z
  .enum([
    'participant.joined',
    'participant.left',
    'participant.presence',
    'subject.focused',
    'subject.released',
    'coordination.note',
    'session.closed',
  ])
  .meta({
    id: 'MirroredCollaborationEventKind',
    title: 'MirroredCollaborationEventKind',
    description: 'The W010 collaboration coordination-event kind vocabulary (mirrored for the adapter input).',
  });

export const MirroredCollaborationEventRecordSchema = z
  .strictObject({
    event: z
      .strictObject({
        schemaVersion: z.literal(1),
        sessionId: AiSessionIdSchema,
        sequence: z
          .number()
          .int('journal sequences are integers')
          .min(1, 'journal sequences start at 1')
          .max(Number.MAX_SAFE_INTEGER),
        tenantId: AiTenantIdSchema,
        actor: AiPrincipalIdSchema,
        kind: MirroredCollaborationEventKindSchema,
        participant: AiPrincipalIdSchema.optional(),
        presence: AgentPresenceStateSchema.optional(),
        subject: FocusTargetSchema.optional(),
        data: OpenDataSchema.optional(),
        occurredAt: TimestampSchema,
      })
      .readonly(),
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'MirroredCollaborationEventRecord',
    title: 'MirroredCollaborationEventRecord',
    description:
      'The mirrored W010 CollaborationEventRecord shape (exact @epoch/collaboration grammar) — the adapter input for collaboration journal events; parity-pinned by devDependency tests.',
  });

// ---------------------------------------------------------------------------
// Engineering Moments.
// ---------------------------------------------------------------------------

export const ExperienceGraphReferenceSchema = z
  .strictObject({
    graphKind: z.enum(['2d', '3d', 'animation', 'narrative', 'timeline-replay', 'presence', 'controls']).meta({
      id: 'MomentExperienceGraphKind',
      title: 'MomentExperienceGraphKind',
      description: 'The W011 Experience Graph kind of a moment visual state (W011 vocabulary).',
    }),
    graphDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'ExperienceGraphReference',
    title: 'ExperienceGraphReference',
    description: 'Reference to the W011 Experience Graph that is an Engineering Moment visual state (digest only — never embedded).',
  });

export const ScenarioReferenceSchema = z
  .strictObject({
    scenarioId: z.string().min(1).max(MAX_SCENARIO_REF_LENGTH),
  })
  .readonly()
  .meta({
    id: 'ScenarioReference',
    title: 'ScenarioReference',
    description: 'Opaque scenario reference — the world scenario an Engineering Moment belongs to.',
  });

export const MomentParticipantStateSchema = z
  .strictObject({
    principalId: AiPrincipalIdSchema,
    participantKind: PeerParticipantKindSchema,
    agentId: AgentIdSchema.optional(),
    presence: AgentPresenceStateSchema,
    focus: FocusTargetSchema.optional(),
    holdsControl: z.boolean(),
  })
  .readonly()
  .superRefine((state, ctx) => {
    if (state.participantKind === 'agent' && state.agentId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'agent participants must carry their registered agent id',
        path: ['agentId'],
      });
    }
    if (state.participantKind === 'human' && state.agentId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'human participants do not carry agent ids',
        path: ['agentId'],
      });
    }
  })
  .meta({
    id: 'MomentParticipantState',
    title: 'MomentParticipantState',
    description: 'One participant state captured in an Engineering Moment: presence, focus, and whether the participant holds control.',
  });

// Evidence-record references are the W011 vocabulary, RUNTIME-reused
// (never mirrored): @epoch/experience-protocol's ProjectedEvidenceRefSchema
// is the canonical validator; the emitted JSON Schema projects it as a
// shared $defs entry keyed by its upstream meta id.

function refineMomentParticipantList(
  moment: { agentState: readonly unknown[]; humanState: readonly unknown[] },
  label: 'agentState' | 'humanState',
  ctx: z.RefinementCtx,
): void {
  const states = moment[label] as readonly {
    principalId: string;
    participantKind: string;
  }[];
  const expected = label === 'agentState' ? 'agent' : 'human';
  for (let i = 0; i < states.length; i += 1) {
    if (states[i].participantKind !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} entries must be ${expected} participants`,
        path: [label, i, 'participantKind'],
      });
    }
  }
  for (let i = 1; i < states.length; i += 1) {
    if (states[i].principalId < states[i - 1].principalId) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be sorted by principalId ascending`,
        path: [label],
      });
      break;
    }
    if (states[i].principalId === states[i - 1].principalId) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} principal ids must be unique`,
        path: [label],
      });
      break;
    }
  }
}

export const EngineeringMomentContentSchema = z
  .strictObject({
    schemaVersion: AiExperienceRecordVersionSchema,
    sessionId: AiSessionIdSchema,
    tenantId: AiTenantIdSchema,
    capturedBy: AiPrincipalIdSchema,
    capturedAt: TimestampSchema,
    label: NonEmptyNameSchema.optional(),
    worldSnapshot: z
      .array(ProjectedReferenceSchema)
      .min(1)
      .max(MAX_MOMENT_REFERENCES)
      .readonly(),
    agentState: z.array(MomentParticipantStateSchema).max(MAX_MOMENT_PARTICIPANTS).readonly(),
    humanState: z.array(MomentParticipantStateSchema).max(MAX_MOMENT_PARTICIPANTS).readonly(),
    visualState: ExperienceGraphReferenceSchema,
    timelinePosition: TimelinePositionSchema,
    evidence: z.array(ProjectedEvidenceRefSchema).min(1).max(MAX_MOMENT_EVIDENCE).readonly(),
    scenario: ScenarioReferenceSchema,
    availableActions: IntentGrantSchema,
  })
  .readonly()
  .superRefine((moment, ctx) => {
    const snapshotKeys = moment.worldSnapshot.map(projectedReferenceKey);
    for (let i = 1; i < snapshotKeys.length; i += 1) {
      if (snapshotKeys[i] < snapshotKeys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'worldSnapshot must be sorted by (kind, target id) ascending',
          path: ['worldSnapshot'],
        });
        break;
      }
      if (snapshotKeys[i] === snapshotKeys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'worldSnapshot must be duplicate-free by (kind, target id)',
          path: ['worldSnapshot'],
        });
        break;
      }
    }
    const evidenceKeys = moment.evidence.map((ref) => ref.recordDigest);
    for (let i = 1; i < evidenceKeys.length; i += 1) {
      if (evidenceKeys[i] < evidenceKeys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be sorted by record digest ascending',
          path: ['evidence'],
        });
        break;
      }
      if (evidenceKeys[i] === evidenceKeys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be duplicate-free by record digest',
          path: ['evidence'],
        });
        break;
      }
    }
    refineMomentParticipantList(moment, 'agentState', ctx);
    refineMomentParticipantList(moment, 'humanState', ctx);
    const controllers = [
      ...moment.agentState.filter((state) => state.holdsControl),
      ...moment.humanState.filter((state) => state.holdsControl),
    ];
    if (controllers.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'at most one participant may hold control in a moment',
        path: ['agentState'],
      });
    }
  })
  .meta({
    id: 'EngineeringMomentContent',
    title: 'EngineeringMomentContent',
    description:
      'The shareable/replayable collaboration unit: world snapshot, agent state, human state, visual state, timeline position, evidence, scenario, and available actions — all opaque, tenant-scoped references.',
  });

export const EngineeringMomentRecordSchema = z
  .strictObject({
    moment: EngineeringMomentContentSchema,
    momentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'EngineeringMomentRecord',
    title: 'EngineeringMomentRecord',
    description: 'The sealed Engineering Moment record: content plus its SHA-256 content address (the shareable identity).',
  });

// ---------------------------------------------------------------------------
// Issues.
// ---------------------------------------------------------------------------

export const AiExperienceIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'AiExperienceIssue',
    title: 'AiExperienceIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

export { MessageIdSchema, TimestampSchema, EventStreamIdSchema, EventSequenceSchema, ProjectedEvidenceRefSchema };
