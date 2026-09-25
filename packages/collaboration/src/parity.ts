/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W010
 * collaboration contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in
 * src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { ProposalReference } from '@epoch/action-protocol';
import type {
  CollaborationEvent,
  CollaborationEventRecord,
  CollaborationIssue,
  CollaborationSession,
  CollaborationSessionId,
  CollaborationSessionRecord,
  CollaborationSnapshot,
  CollaborationSubject,
  CollaborationTenantId,
  ParticipantPresence,
  ParticipantPrincipalId,
  SessionScope,
  SessionStateInfo,
} from './types';
import type {
  CollaborationEventKind,
  CollaborationSubjectKind,
  PresenceState,
} from './version';
import type {
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
  ParticipantPresenceSchema,
  ParticipantPrincipalIdSchema,
  PresenceStateSchema,
  SessionScopeSchema,
  SessionStateInfoSchema,
  Sha256DigestSchema,
} from './schema';

export type CollaborationSchemaSync = [
  Expect<Equals<z.infer<typeof CollaborationRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof CollaborationSessionIdSchema>, CollaborationSessionId>>,
  Expect<Equals<z.infer<typeof CollaborationTenantIdSchema>, CollaborationTenantId>>,
  Expect<
    Equals<z.infer<typeof ParticipantPrincipalIdSchema>, ParticipantPrincipalId>
  >,
  Expect<Equals<z.output<typeof SessionScopeSchema>, SessionScope>>,
  Expect<Equals<z.infer<typeof CollaborationEventKindSchema>, CollaborationEventKind>>,
  Expect<Equals<z.infer<typeof PresenceStateSchema>, PresenceState>>,
  Expect<
    Equals<z.infer<typeof CollaborationSubjectKindSchema>, CollaborationSubjectKind>
  >,
  Expect<Equals<z.output<typeof CollaborationSubjectSchema>, CollaborationSubject>>,
  Expect<Equals<z.output<typeof CollaborationSessionSchema>, CollaborationSession>>,
  Expect<
    Equals<z.output<typeof CollaborationSessionRecordSchema>, CollaborationSessionRecord>
  >,
  Expect<Equals<z.output<typeof CollaborationEventSchema>, CollaborationEvent>>,
  Expect<
    Equals<z.output<typeof CollaborationEventRecordSchema>, CollaborationEventRecord>
  >,
  Expect<Equals<z.infer<typeof CollaborationIssueSchema>, CollaborationIssue>>,
  Expect<Equals<z.output<typeof ParticipantPresenceSchema>, ParticipantPresence>>,
  Expect<Equals<z.output<typeof SessionStateInfoSchema>, SessionStateInfo>>,
  Expect<Equals<z.infer<typeof CollaborationSnapshotSchema>, CollaborationSnapshot>>,
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, Sha256Hex>>,
];

/** Result/error surface shape sanity. */
export type CollaborationResultSync = [
  Expect<Equals<CollaborationSessionRecord['sessionDigest'], Sha256Hex>>,
  Expect<Equals<CollaborationEventRecord['contentDigest'], Sha256Hex>>,
  Expect<Equals<CollaborationSnapshot['sessions'], readonly CollaborationSessionRecord[]>>,
  Expect<Equals<CollaborationSnapshot['events'], readonly CollaborationEventRecord[]>>,
  Expect<Equals<CollaborationSubject, ProposalReference extends never ? never : CollaborationSubject>>,
];
