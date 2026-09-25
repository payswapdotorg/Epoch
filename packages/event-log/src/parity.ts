/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W010 event-log
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 *
 * Tenancy/identity shape parity (the kernel-to-kernel devDep precedent):
 * `src/kernel-parity.ts` additionally pins the MIRRORED tenant/principal id
 * grammars against @epoch/tenancy and @epoch/identity — those are
 * devDependency parity checks, never runtime couplings.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { ActionTypeReference, ProposalReference } from '@epoch/action-protocol';
import type {
  ActionLifecycleEventData,
  CausalEventReference,
  EventActor,
  EventContent,
  EventKindDiscriminator,
  EventLogIssue,
  EventLogSnapshot,
  EventPayload,
  EventRecord,
  EventRegistration,
  EventSequence,
  EventStreamId,
  EventSubject,
  EventTenantId,
  StreamInfo,
  WorldSubjectsEventData,
} from './types';
import type {
  ActionLifecycleEventDataSchema,
  CausalEventReferenceSchema,
  EventActorSchema,
  EventContentSchema,
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

export type EventLogSchemaSync = [
  Expect<Equals<z.infer<typeof EventLogRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof EventStreamIdSchema>, EventStreamId>>,
  Expect<Equals<z.infer<typeof EventTenantIdSchema>, EventTenantId>>,
  Expect<Equals<z.infer<typeof EventActorSchema>, EventActor>>,
  Expect<Equals<z.infer<typeof EventKindDiscriminatorSchema>, EventKindDiscriminator>>,
  Expect<Equals<z.infer<typeof EventSequenceSchema>, EventSequence>>,
  Expect<Equals<z.infer<typeof CausalEventReferenceSchema>, CausalEventReference>>,
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, Sha256Hex>>,
  Expect<Equals<z.infer<typeof EventPayloadSchema>, EventPayload>>,
  Expect<Equals<z.infer<typeof EventSubjectSchema>, EventSubject>>,
  Expect<Equals<z.infer<typeof WorldSubjectsEventDataSchema>, WorldSubjectsEventData>>,
  Expect<Equals<z.infer<typeof ActionLifecycleEventDataSchema>, ActionLifecycleEventData>>,
  Expect<Equals<z.infer<typeof EventLogIssueSchema>, EventLogIssue>>,
  Expect<Equals<z.infer<typeof StreamInfoSchema>, StreamInfo>>,
  Expect<Equals<z.infer<typeof EventLogSnapshotSchema>, EventLogSnapshot>>,
];

/**
 * The envelope/record/registration schemas are pinned member-for-member
 * (causal invariants — cycle-freedom and parent existence — are enforced
 * by the admission machinery, not by schema refinements).
 */
export type EventLogContentSync = [
  Expect<Equals<z.output<typeof EventContentSchema>, EventContent>>,
  Expect<Equals<z.output<typeof EventRecordSchema>, EventRecord>>,
  Expect<Equals<z.output<typeof EventRegistrationSchema>, EventRegistration>>,
];

/** Result/error surface shape sanity. */
export type EventLogResultSync = [
  Expect<Equals<EventRecord['contentDigest'], Sha256Hex>>,
  Expect<Equals<EventRecord['event'], EventContent>>,
  Expect<Equals<EventLogSnapshot['records'], readonly EventRecord[]>>,
  Expect<Equals<EventLogSnapshot['streams'], readonly StreamInfo[]>>,
  Expect<Equals<EventPayload['data'], Readonly<Record<string, JsonValue>>>>,
  Expect<Equals<ActionLifecycleEventData['action'], ProposalReference>>,
  Expect<Equals<ActionLifecycleEventData['actionType'], ActionTypeReference>>,
  Expect<Equals<WorldSubjectsEventData['subjects'], readonly EventSubject[]>>,
];
