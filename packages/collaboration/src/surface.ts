/**
 * The collaboration schema surface registry: every data type published at
 * the `@epoch/collaboration` ownership boundary, paired with its zod
 * schema (W010 publishes its versioned contract surface inside the
 * package, the W007/W008/W009 convention; see src/contract-emission.ts
 * and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  CollaborationEventKindSchema,
  CollaborationEventRecordSchema,
  CollaborationEventSchema,
  CollaborationIssueSchema,
  CollaborationRecordVersionSchema,
  CollaborationSessionIdSchema,
  CollaborationSessionRecordSchema,
  CollaborationSessionSchema,
  CollaborationSnapshotSchema,
  CollaborationSubjectKindSchema,
  CollaborationSubjectSchema,
  CollaborationTenantIdSchema,
  CoordinationDataSchema,
  ParticipantPresenceSchema,
  ParticipantPrincipalIdSchema,
  PresenceStateSchema,
  SessionRegistrationSchema,
  SessionScopeSchema,
  SessionStateInfoSchema,
  SessionStateSchema,
  Sha256DigestSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the collaboration contract v1. */
export const COLLABORATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'CollaborationEvent', schema: CollaborationEventSchema },
  { type: 'CollaborationEventKind', schema: CollaborationEventKindSchema },
  { type: 'CollaborationEventRecord', schema: CollaborationEventRecordSchema },
  { type: 'CollaborationIssue', schema: CollaborationIssueSchema },
  { type: 'CollaborationRecordVersion', schema: CollaborationRecordVersionSchema },
  { type: 'CollaborationSession', schema: CollaborationSessionSchema },
  { type: 'CollaborationSessionId', schema: CollaborationSessionIdSchema },
  { type: 'CollaborationSessionRecord', schema: CollaborationSessionRecordSchema },
  { type: 'CollaborationSnapshot', schema: CollaborationSnapshotSchema },
  { type: 'CollaborationSubject', schema: CollaborationSubjectSchema },
  { type: 'CollaborationSubjectKind', schema: CollaborationSubjectKindSchema },
  { type: 'CollaborationTenantId', schema: CollaborationTenantIdSchema },
  { type: 'CoordinationData', schema: CoordinationDataSchema },
  { type: 'ParticipantPresence', schema: ParticipantPresenceSchema },
  { type: 'ParticipantPrincipalId', schema: ParticipantPrincipalIdSchema },
  { type: 'PresenceState', schema: PresenceStateSchema },
  { type: 'SessionRegistration', schema: SessionRegistrationSchema },
  { type: 'SessionScope', schema: SessionScopeSchema },
  { type: 'SessionState', schema: SessionStateSchema },
  { type: 'SessionStateInfo', schema: SessionStateInfoSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
];
