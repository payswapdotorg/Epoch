/**
 * The event-log schema surface registry: every data type published at
 * the `@epoch/event-log` ownership boundary, paired with its zod schema
 * (W010 publishes its versioned contract surface inside the package, the
 * W007/W008/W009 convention; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ActionLifecycleEventDataSchema,
  CausalEventReferenceSchema,
  EventActorSchema,
 EventDataSchema,
  EventKindDiscriminatorSchema,
  EventLogIssueSchema,
  EventLogRecordVersionSchema,
  EventLogSnapshotSchema,
  EventPayloadSchema,
  EventRecordSchema,
  EventRegistrationSchema,
  EventSequenceSchema,
  EventStreamIdSchema,
  EventSubjectSchema,
  EventTenantIdSchema,
  Sha256DigestSchema,
  StreamInfoSchema,
  WorldSubjectsEventDataSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the event-log contract v1. */
export const EVENT_LOG_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionLifecycleEventData', schema: ActionLifecycleEventDataSchema },
  { type: 'CausalEventReference', schema: CausalEventReferenceSchema },
  { type: 'EventActor', schema: EventActorSchema },
  { type: 'EventData', schema: EventDataSchema },
  { type: 'EventKindDiscriminator', schema: EventKindDiscriminatorSchema },
  { type: 'EventLogIssue', schema: EventLogIssueSchema },
  { type: 'EventLogRecordVersion', schema: EventLogRecordVersionSchema },
  { type: 'EventLogSnapshot', schema: EventLogSnapshotSchema },
  { type: 'EventPayload', schema: EventPayloadSchema },
  { type: 'EventRecord', schema: EventRecordSchema },
  { type: 'EventRegistration', schema: EventRegistrationSchema },
  { type: 'EventSequence', schema: EventSequenceSchema },
  { type: 'EventStreamId', schema: EventStreamIdSchema },
  { type: 'EventSubject', schema: EventSubjectSchema },
  { type: 'EventTenantId', schema: EventTenantIdSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'StreamInfo', schema: StreamInfoSchema },
  { type: 'WorldSubjectsEventData', schema: WorldSubjectsEventDataSchema },
];
