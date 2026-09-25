/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the AI-experience
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in
 * src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { ProjectedEvidenceRef } from '@epoch/experience-protocol';
import type {
  ActionProposalTarget,
  AiCollaborationEvent,
  AiCollaborationEventRecord,
  AiCollaborationEventRegistration,
  AiSessionDescriptor,
  AiSessionScope,
  AiExperienceIssue,
  BranchPoint,
  ControlAuthority,
  ControlProvenance,
  ControlRejection,
  EngineeringMomentContent,
  EngineeringMomentRecord,
  ExperienceGraphReference,
  FocusTarget,
  InteractionIntent,
  MirroredCollaborationEventRecord,
  MomentParticipantState,
  ParticipantRoleDescriptor,
  ScenarioReference,
  StreamBound,
  TimelinePosition,
} from './types';
import type {
  ActionProposalTargetSchema,
  AiCollaborationEventRecordSchema,
  AiCollaborationEventRegistrationSchema,
  AiCollaborationEventSchema,
  AiSessionDescriptorSchema,
  AiSessionScopeSchema,
  AiExperienceIssueSchema,
  BranchPointSchema,
  ControlAuthoritySchema,
  ControlProvenanceSchema,
  ControlRejectionSchema,
  EngineeringMomentContentSchema,
  EngineeringMomentRecordSchema,
  ExperienceGraphReferenceSchema,
  FocusTargetSchema,
  InteractionIntentSchema,
  MirroredCollaborationEventRecordSchema,
  MomentParticipantStateSchema,
  ParticipantRoleDescriptorSchema,
  ProjectedEvidenceRefSchema,
  ScenarioReferenceSchema,
  StreamBoundSchema,
  TimelinePositionSchema,
} from './schema';

export type AiSchemaSync = [
  Expect<Equals<z.infer<typeof AiSessionDescriptorSchema>, AiSessionDescriptor>>,
  Expect<Equals<z.infer<typeof AiSessionScopeSchema>, AiSessionScope>>,
  Expect<Equals<z.infer<typeof ParticipantRoleDescriptorSchema>, ParticipantRoleDescriptor>>,
  Expect<Equals<z.infer<typeof ControlAuthoritySchema>, ControlAuthority>>,
  Expect<Equals<z.infer<typeof ControlProvenanceSchema>, ControlProvenance>>,
  Expect<Equals<z.infer<typeof ControlRejectionSchema>, ControlRejection>>,
  Expect<Equals<z.infer<typeof FocusTargetSchema>, FocusTarget>>,
  Expect<Equals<z.infer<typeof ActionProposalTargetSchema>, ActionProposalTarget>>,
  Expect<Equals<z.infer<typeof InteractionIntentSchema>, InteractionIntent>>,
  Expect<Equals<z.infer<typeof TimelinePositionSchema>, TimelinePosition>>,
  Expect<Equals<z.infer<typeof StreamBoundSchema>, StreamBound>>,
  Expect<Equals<z.infer<typeof BranchPointSchema>, BranchPoint>>,
  Expect<Equals<z.infer<typeof AiCollaborationEventSchema>, AiCollaborationEvent>>,
  Expect<Equals<z.infer<typeof AiCollaborationEventRecordSchema>, AiCollaborationEventRecord>>,
  Expect<
    Equals<z.infer<typeof AiCollaborationEventRegistrationSchema>, AiCollaborationEventRegistration>
  >,
  Expect<Equals<z.infer<typeof MirroredCollaborationEventRecordSchema>, MirroredCollaborationEventRecord>>,
  Expect<Equals<z.infer<typeof MomentParticipantStateSchema>, MomentParticipantState>>,
  Expect<Equals<z.infer<typeof ExperienceGraphReferenceSchema>, ExperienceGraphReference>>,
  Expect<Equals<z.infer<typeof ScenarioReferenceSchema>, ScenarioReference>>,
  Expect<Equals<z.infer<typeof ProjectedEvidenceRefSchema>, ProjectedEvidenceRef>>,
  Expect<Equals<z.infer<typeof EngineeringMomentContentSchema>, EngineeringMomentContent>>,
  Expect<Equals<z.infer<typeof EngineeringMomentRecordSchema>, EngineeringMomentRecord>>,
  Expect<Equals<z.infer<typeof AiExperienceIssueSchema>, AiExperienceIssue>>,
];
