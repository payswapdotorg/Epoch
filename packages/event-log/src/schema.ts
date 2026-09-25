/**
 * @epoch/event-log — runtime zod validators for the published contract
 * types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (broker names, database hints, vendor
 * envelope extensions) cannot enter kernel types through the event-log
 * door (same policy as the W002-W009 validators). Every exported schema
 * is part of the published surface emitted under `schemas/`.
 *
 * Runtime vocabulary composition (the W010 dependency policy):
 * - entity ids use @epoch/world-model's `EntityIdSchema` directly (W002
 *   grammar — genuine runtime composition);
 * - proposal/action-type references use @epoch/action-protocol's
 *   validators directly (W003 grammar);
 * - timestamps use @epoch/agent-protocol's `TimestampSchema` (canonical
 *   UTC form + real-calendar-instant refinement);
 * - the world relation id grammar (`rel-<sha256>`) is mirrored (W002 does
 *   not export it standalone) and pinned by the runtime parity test that
 *   materializes real relations through the WorldModel API
 *   (test/world-parity.test.ts — the W011 precedent).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import { EntityIdSchema } from '@epoch/world-model';
import { ActionTypeReferenceSchema, ProposalReferenceSchema } from '@epoch/action-protocol';
import {
  ACTION_EVENT_PHASES,
  EVENT_ACTOR_PATTERN,
  EVENT_KIND_DISCRIMINATOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_TENANT_ID_PATTERN,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Version discriminator on serialized event-log records (v1). */
export const EventLogRecordVersionSchema = z.literal(EVENT_LOG_RECORD_VERSION).meta({
  id: 'EventLogRecordVersion',
  title: 'EventLogRecordVersion',
  description:
    'Version discriminator carried by every serialized event-log record and snapshot (currently 1).',
});

/** Opaque event stream identity (`stream:<slug>`). */
export const EventStreamIdSchema = z
  .string()
  .regex(EVENT_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"')
  .meta({
    id: 'EventStreamId',
    title: 'EventStreamId',
    description:
      'Opaque event stream identity: the unit of total order; every event in a stream carries a contiguous 1-based sequence.',
  });

/** Tenant scope of an event (`tenant:<slug>`). */
export const EventTenantIdSchema = z
  .string()
  .regex(EVENT_TENANT_ID_PATTERN, 'must be a tenant id of the form "tenant:<slug>"')
  .meta({
    id: 'EventTenantId',
    title: 'EventTenantId',
    description: 'Opaque tenant scope of an event: "tenant:" followed by a lowercase slug (W009 grammar).',
  });

/** Acting principal of an event (`principal:<slug>`). */
export const EventActorSchema = z
  .string()
  .regex(EVENT_ACTOR_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'EventActor',
    title: 'EventActor',
    description: 'Opaque acting principal of an event: "principal:" followed by a lowercase slug (W009 grammar).',
  });

/** Event-kind discriminator (`namespace:name`). */
export const EventKindDiscriminatorSchema = z
  .string()
  .regex(
    EVENT_KIND_DISCRIMINATOR_PATTERN,
    'must be a namespaced event kind (namespace:name, lowercase segments, e.g. "world:subjects")',
  )
  .meta({
    id: 'EventKindDiscriminator',
    title: 'EventKindDiscriminator',
    description:
      'Namespaced event-kind discriminator selecting the payload data contract; the "world" and "action" namespaces are kernel-reserved.',
  });

/** One event sequence number (1-based, contiguous per stream). */
export const EventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'EventSequence',
    title: 'EventSequence',
    description: 'One event sequence number: 1-based, strictly contiguous per stream (the stream cursor).',
  });

/** The causal parent reference (intra- or cross-stream, strictly earlier). */
export const CausalEventReferenceSchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    sequence: EventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'CausalEventReference',
    title: 'CausalEventReference',
    description:
      'Causal parent of an event: an appended event of any stream (cross-stream references are how streams intersect).',
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

/** Opaque JSON data bag of an event payload (open extension payloads). */
export const EventDataSchema = z
  .record(z.string().min(1).max(256), JsonValueSchema)
  .readonly()
  .meta({
    id: 'EventData',
    title: 'EventData',
    description: 'Opaque JSON data of an event payload; the discriminator selects its interpretation.',
  });

/** The typed payload of one event. */
export const EventPayloadSchema = z
  .strictObject({
    discriminator: EventKindDiscriminatorSchema,
    data: EventDataSchema,
  })
  .readonly()
  .meta({
    id: 'EventPayload',
    title: 'EventPayload',
    description:
      'Typed event payload: namespaced discriminator plus opaque JSON data (kernel payload contracts for reserved namespaces).',
  });

/**
 * World-model relation id grammar, mirrored from @epoch/world-model's
 * RelationSchema (`rel-<sha256-of-key>`). Pinned by the runtime parity
 * test (test/world-parity.test.ts) which materializes real relations
 * through the WorldModel API and asserts acceptance.
 */
export const WORLD_RELATION_ID_PATTERN = /^rel-[0-9a-f]{64}$/;

const WorldRelationIdSchema = z
  .string()
  .regex(WORLD_RELATION_ID_PATTERN, 'must be a world-model relation id of the form "rel-<sha256>"')
  .meta({
    id: 'WorldRelationId',
    title: 'WorldRelationId',
    description: 'World-model relation identity: rel-<sha256-of-key> (owned by @epoch/world-model).',
  });

/** One reference to a world-graph subject (entity or relation). */
export const EventSubjectSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('entity'),
        entityId: EntityIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('relation'),
        relationId: WorldRelationIdSchema,
      })
      .readonly(),
  ])
  .meta({
    id: 'EventSubject',
    title: 'EventSubject',
    description:
      'Opaque reference to a world-graph subject: an entity id or a relation id (W002 vocabulary), never an embedded object.',
  });

/** The typed data of a `world:subjects` kernel payload. */
export const WorldSubjectsEventDataSchema = z
  .strictObject({
    subjects: z.array(EventSubjectSchema).min(1).max(100).readonly(),
    note: z.string().min(1).max(2000).optional(),
  })
  .readonly()
  .meta({
    id: 'WorldSubjectsEventData',
    title: 'WorldSubjectsEventData',
    description:
      'Payload data for the reserved "world:subjects" event kind: one or more world-graph subjects plus an optional note.',
  });

/** The typed data of an `action:lifecycle` kernel payload. */
export const ActionLifecycleEventDataSchema = z
  .strictObject({
    action: ProposalReferenceSchema,
    actionType: ActionTypeReferenceSchema,
    phase: z.enum(ACTION_EVENT_PHASES),
    detail: EventDataSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'ActionLifecycleEventData',
    title: 'ActionLifecycleEventData',
    description:
      'Payload data for the reserved "action:lifecycle" event kind: exact-revision proposal reference, action type, and lifecycle phase (W003 vocabulary).',
  });

/**
 * The immutable content of one logged event (the envelope minus the
 * digest). Runtime refinements beyond the schema: none — the causal
 * invariants (existence, cycle-freedom) need log state and are enforced
 * by the admission machinery (src/event-log.ts).
 */
export const EventContentSchema = z
  .strictObject({
    schemaVersion: EventLogRecordVersionSchema,
    streamId: EventStreamIdSchema,
    sequence: EventSequenceSchema,
    tenantId: EventTenantIdSchema,
    actor: EventActorSchema,
    causalParent: CausalEventReferenceSchema.nullable(),
    payload: EventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'EventContent',
    title: 'EventContent',
    description:
      'Immutable content of one logged event: stream, sequence, tenant scope, actor, causal parent, typed payload, and the producer-supplied occurrence instant.',
  });

/** The published event record: content plus its content address. */
export const EventRecordSchema = z
  .strictObject({
    event: EventContentSchema,
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'EventRecord',
    title: 'EventRecord',
    description:
      'Published event record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** A creation envelope: event content plus the CLAIMED digest. */
export const EventRegistrationSchema = z
  .strictObject({
    event: EventContentSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'EventRegistration',
    title: 'EventRegistration',
    description: 'Creation envelope: event content plus the claimed canonical SHA-256 digest (tamper-checked at admission).',
  });

/** Deterministic per-stream projection. */
export const StreamInfoSchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    tenantId: EventTenantIdSchema,
    firstSequence: EventSequenceSchema,
    lastSequence: EventSequenceSchema,
    eventCount: z.number().int().min(1),
  })
  .readonly()
  .meta({
    id: 'StreamInfo',
    title: 'StreamInfo',
    description:
      'Deterministic per-stream projection: tenant scope, first/last sequence (the cursor), and event count.',
  });

/** One flattened validation issue. */
export const EventLogIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'EventLogIssue',
    title: 'EventLogIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/**
 * The deterministic whole-log projection: streams sorted by streamId,
 * records sorted by (streamId, sequence). Runtime refinement (not
 * representable in the structural JSON Schema projection): records must
 * be sorted and complete per stream — enforced by `parseEventLogSnapshot`
 * and `EventLog.fromSnapshot`.
 */
export const EventLogSnapshotSchema = z
  .strictObject({
    schemaVersion: EventLogRecordVersionSchema,
    streams: z.array(StreamInfoSchema).readonly(),
    records: z.array(EventRecordSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'EventLogSnapshot',
    title: 'EventLogSnapshot',
    description:
      'Deterministic, serialization-friendly whole-log projection: stream infos sorted by streamId, records sorted by (streamId, sequence).',
  });
