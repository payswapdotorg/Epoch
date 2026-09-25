/**
 * The AI-experience schema surface registry: every data type published at
 * the `@epoch/ai-experience` ownership boundary, paired with its zod
 * schema (W015 publishes its versioned contract surface inside the
 * package — the W007/W008/W009/W010 convention; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ActionProposalTargetSchema,
  AiCollaborationEventKindSchema,
  AiCollaborationEventRecordSchema,
  AiCollaborationEventRegistrationSchema,
  AiCollaborationEventSchema,
  AiExperienceIssueSchema,
  AiExperienceRecordVersionSchema,
  AiSessionDescriptorSchema,
  AiSessionScopeSchema,
  AiSessionStateSchema,
  AiTenantIdSchema,
  AgentPresenceStateSchema,
  BranchPointSchema,
  ControlAuthorityKindSchema,
  ControlAuthoritySchema,
  ControlDenialReasonSchema,
  ControlProvenanceSchema,
  ControlRejectionSchema,
  EngineeringMomentContentSchema,
  EngineeringMomentRecordSchema,
  ExperienceGraphReferenceSchema,
  FocusTargetKindSchema,
  FocusTargetSchema,
  InteractionIntentKindSchema,
  InteractionIntentSchema,
  MirroredCollaborationEventKindSchema,
  MirroredCollaborationEventRecordSchema,
  MomentParticipantStateSchema,
  ParticipantRoleDescriptorSchema,
  PeerParticipantKindSchema,
  PlaybackStateSchema,
  ProjectedEvidenceRefSchema,
  ScenarioReferenceSchema,
  Sha256DigestSchema,
  StreamBoundSchema,
  TimelinePositionSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the AI-experience contract v1. */
export const AI_EXPERIENCE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionProposalTarget', schema: ActionProposalTargetSchema },
  { type: 'AgentPresenceState', schema: AgentPresenceStateSchema },
  { type: 'AiCollaborationEvent', schema: AiCollaborationEventSchema },
  { type: 'AiCollaborationEventKind', schema: AiCollaborationEventKindSchema },
  { type: 'AiCollaborationEventRecord', schema: AiCollaborationEventRecordSchema },
  { type: 'AiCollaborationEventRegistration', schema: AiCollaborationEventRegistrationSchema },
  { type: 'AiExperienceIssue', schema: AiExperienceIssueSchema },
  { type: 'AiExperienceRecordVersion', schema: AiExperienceRecordVersionSchema },
  { type: 'AiSessionDescriptor', schema: AiSessionDescriptorSchema },
  { type: 'AiSessionScope', schema: AiSessionScopeSchema },
  { type: 'AiSessionState', schema: AiSessionStateSchema },
  { type: 'AiTenantId', schema: AiTenantIdSchema },
  { type: 'BranchPoint', schema: BranchPointSchema },
  { type: 'ControlAuthority', schema: ControlAuthoritySchema },
  { type: 'ControlAuthorityKind', schema: ControlAuthorityKindSchema },
  { type: 'ControlDenialReason', schema: ControlDenialReasonSchema },
  { type: 'ControlProvenance', schema: ControlProvenanceSchema },
  { type: 'ControlRejection', schema: ControlRejectionSchema },
  { type: 'EngineeringMomentContent', schema: EngineeringMomentContentSchema },
  { type: 'EngineeringMomentRecord', schema: EngineeringMomentRecordSchema },
  { type: 'ExperienceGraphReference', schema: ExperienceGraphReferenceSchema },
  { type: 'FocusTarget', schema: FocusTargetSchema },
  { type: 'FocusTargetKind', schema: FocusTargetKindSchema },
  { type: 'InteractionIntent', schema: InteractionIntentSchema },
  { type: 'InteractionIntentKind', schema: InteractionIntentKindSchema },
  { type: 'MirroredCollaborationEventKind', schema: MirroredCollaborationEventKindSchema },
  { type: 'MirroredCollaborationEventRecord', schema: MirroredCollaborationEventRecordSchema },
  { type: 'MomentParticipantState', schema: MomentParticipantStateSchema },
  { type: 'ParticipantRoleDescriptor', schema: ParticipantRoleDescriptorSchema },
  { type: 'PeerParticipantKind', schema: PeerParticipantKindSchema },
  { type: 'PlaybackState', schema: PlaybackStateSchema },
  { type: 'ProjectedEvidenceRef', schema: ProjectedEvidenceRefSchema },
  { type: 'ScenarioReference', schema: ScenarioReferenceSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'StreamBound', schema: StreamBoundSchema },
  { type: 'TimelinePosition', schema: TimelinePositionSchema },
];
