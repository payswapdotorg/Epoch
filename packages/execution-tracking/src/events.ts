/**
 * The execution lifecycle event vocabulary over the W010 event shapes
 * (the W038 dispatch pin: "emits `execution:*` events (W010-shaped, one
 * stream per work package `stream:execution-<suffix>`, digests admitted
 * by the REAL sealEvent — runtime parity tests)").
 *
 * - `ExecutionEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied
 *   instant). One work package's execution lifecycle events form ONE
 *   stream (`stream:execution-<suffix>`, derived deterministically by
 *   `executionStreamIdOf`); events are FACTS — there is no mutation API.
 * - The execution payload family is the open-namespace `execution:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`EXECUTION_EVENT_DATA_SCHEMAS`); `parseExecutionEventData` is the
 *   W010 payload-family discipline applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures seal through
 *   the REAL W010 sealEvent and digest identically through the REAL
 *   computeEventDigest).
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  TimestampSchema,
  canonicalDigest,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  MilestoneIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  ActivityIdSchema,
  EvidenceLinkIdSchema,
  ExecutionStreamIdSchema,
  IssueRecordIdSchema,
  ReconciliationIdSchema,
  ResourceObservationIdSchema,
  StateIdSchema,
} from './primitives';
import {
  EXECUTION_EVENT_DISCRIMINATORS,
  EXECUTION_EVENT_RECORD_VERSION,
  FIELD_EVIDENCE_KINDS,
  ISSUE_KINDS,
  ISSUE_SEVERITIES,
  RESOURCE_KINDS,
  TRACKING_STATES,
  type ExecutionEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

/** One execution event sequence number (1-based, contiguous per stream). */
export const ExecutionEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'ExecutionEventSequence',
    title: 'ExecutionEventSequence',
    description: 'One execution-event sequence number: 1-based, contiguous per execution stream.',
  });

/** One execution event sequence number. */
export type ExecutionEventSequence = z.infer<typeof ExecutionEventSequenceSchema>;

/** The causal parent reference of an execution event (strictly earlier in-stream). */
export const ExecutionCausalParentSchema = z
  .strictObject({
    streamId: ExecutionStreamIdSchema,
    sequence: ExecutionEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'ExecutionCausalParent',
    title: 'ExecutionCausalParent',
    description:
      'Causal parent of an execution event: an earlier event in the same execution stream (the W010 shape).',
  });

/** One execution causal parent reference. */
export type ExecutionCausalParent = z.infer<typeof ExecutionCausalParentSchema>;

/** The generic event payload of an execution event (the W010 shape). */
export const ExecutionEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'ExecutionEventPayload',
    title: 'ExecutionEventPayload',
    description:
      'Typed event payload of an execution event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One execution event payload. */
export type ExecutionEventPayload = z.infer<typeof ExecutionEventPayloadSchema>;

/**
 * The immutable content of one execution event — the STRUCTURAL MIRROR of
 * W010's `EventContent` (schemaVersion discriminator, stream, sequence,
 * tenant scope, principal actor, causal parent, payload, producer-
 * supplied occurrence instant).
 */
export const ExecutionEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(EXECUTION_EVENT_RECORD_VERSION),
    streamId: ExecutionStreamIdSchema,
    sequence: ExecutionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ExecutionCausalParentSchema.nullable(),
    payload: ExecutionEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly()
  .superRefine((event, ctx) => {
    if (
      event.causalParent !== null &&
      event.causalParent.streamId === event.streamId &&
      event.causalParent.sequence >= event.sequence
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a same-stream causal parent must be strictly earlier (broken chain)',
        path: ['causalParent'],
      });
    }
  })
  .meta({
    id: 'ExecutionEventContent',
    title: 'ExecutionEventContent',
    description:
      'Immutable content of one execution lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One execution event content. */
export type ExecutionEventContent = z.infer<typeof ExecutionEventContentSchema>;

/**
 * The SEALED execution event record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the exact-revision content
 * address).
 */
export const SealedExecutionEventSchema = z
  .strictObject({
    schemaVersion: z.literal(EXECUTION_EVENT_RECORD_VERSION),
    streamId: ExecutionStreamIdSchema,
    sequence: ExecutionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ExecutionCausalParentSchema.nullable(),
    payload: ExecutionEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedExecutionEvent',
    title: 'SealedExecutionEvent',
    description:
      'Published execution event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed execution event. */
export type SealedExecutionEvent = z.infer<typeof SealedExecutionEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every execution:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `execution:tracking-recorded`. */
export const TrackingRecordedDataSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    trackingRecordId: StateIdSchema,
    fromState: z.enum(TRACKING_STATES).nullable(),
    toState: z.enum(TRACKING_STATES),
    observedAt: TimestampSchema,
  })
  .readonly();
export type TrackingRecordedData = z.infer<typeof TrackingRecordedDataSchema>;

/** Payload data of `execution:observation-recorded`. */
export const ObservationRecordedDataSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    deliveryId: DeliveryIdSchema,
    observationId: DistinctionRecordIdSchema,
    subjectKind: z.string().min(1).max(64),
    measureKind: z.string().min(1).max(64),
    observedAt: TimestampSchema,
  })
  .readonly();
export type ObservationRecordedData = z.infer<typeof ObservationRecordedDataSchema>;

/** Payload data of `execution:resource-observation-recorded`. */
export const ResourceObservationRecordedDataSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    resourceObservationId: ResourceObservationIdSchema,
    resourceKind: z.enum(RESOURCE_KINDS),
    unit: z.string().min(1).max(32),
    quantity: z.string().min(1).max(64),
    usageAt: TimestampSchema,
  })
  .readonly();
export type ResourceObservationRecordedData = z.infer<typeof ResourceObservationRecordedDataSchema>;

/** Payload data of `execution:evidence-linked`. */
export const EvidenceLinkedDataSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    evidenceLinkId: EvidenceLinkIdSchema,
    evidenceDigest: Sha256HexSchema,
    evidenceKind: z.enum(FIELD_EVIDENCE_KINDS),
    capturedAt: TimestampSchema,
  })
  .readonly();
export type EvidenceLinkedData = z.infer<typeof EvidenceLinkedDataSchema>;

/** Payload data of `execution:issue-raised`. */
export const IssueRaisedDataSchema = z
  .strictObject({
    issueRecordId: IssueRecordIdSchema,
    issueKind: z.enum(ISSUE_KINDS),
    severity: z.enum(ISSUE_SEVERITIES),
    workPackageId: WorkPackageIdSchema,
    raisedAt: TimestampSchema,
  })
  .readonly();
export type IssueRaisedData = z.infer<typeof IssueRaisedDataSchema>;

/** Payload data of `execution:issue-resolved`. */
export const IssueResolvedDataSchema = z
  .strictObject({
    issueRecordId: IssueRecordIdSchema,
    issueKind: z.enum(ISSUE_KINDS),
    resolution: z.enum(['resolved', 'dismissed']),
    resolvedAt: TimestampSchema,
  })
  .readonly();
export type IssueResolvedData = z.infer<typeof IssueResolvedDataSchema>;

/** Payload data of `execution:reconciliation-proposed`. */
export const ReconciliationProposedDataSchema = z
  .strictObject({
    proposalId: ReconciliationIdSchema,
    deliveryId: DeliveryIdSchema,
    observationCount: z.number().int().min(1),
    proposedAt: TimestampSchema,
  })
  .readonly();
export type ReconciliationProposedData = z.infer<typeof ReconciliationProposedDataSchema>;

/** Payload data of `execution:reconciliation-applied`. */
export const ReconciliationAppliedDataSchema = z
  .strictObject({
    proposalId: ReconciliationIdSchema,
    deliveryId: DeliveryIdSchema,
    actualizedCount: z.number().int().min(0),
    alreadyActualizedCount: z.number().int().min(0),
    actualizedAt: TimestampSchema,
  })
  .readonly();
export type ReconciliationAppliedData = z.infer<typeof ReconciliationAppliedDataSchema>;

/** Payload data of `execution:state-projected`. */
export const StateProjectedDataSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    state: z.enum(TRACKING_STATES),
    milestoneIds: z.array(MilestoneIdSchema).max(64),
    asOf: TimestampSchema,
  })
  .readonly();
export type StateProjectedData = z.infer<typeof StateProjectedDataSchema>;

/**
 * The typed payload-data schema for every `execution:*` event kind (the
 * W010 payload-family discipline, applied to the whole execution
 * vocabulary).
 */
export const EXECUTION_EVENT_DATA_SCHEMAS: Readonly<
  Record<ExecutionEventDiscriminator, z.ZodType>
> = {
  'execution:tracking-recorded': TrackingRecordedDataSchema,
  'execution:observation-recorded': ObservationRecordedDataSchema,
  'execution:resource-observation-recorded': ResourceObservationRecordedDataSchema,
  'execution:evidence-linked': EvidenceLinkedDataSchema,
  'execution:issue-raised': IssueRaisedDataSchema,
  'execution:issue-resolved': IssueResolvedDataSchema,
  'execution:reconciliation-proposed': ReconciliationProposedDataSchema,
  'execution:reconciliation-applied': ReconciliationAppliedDataSchema,
  'execution:state-projected': StateProjectedDataSchema,
};

/**
 * Compute the content digest of an execution event: the SHA-256 of its
 * canonical JSON serialization — identical to W010's computeEventDigest
 * for the same content (pinned by the runtime parity test). Throws on
 * invalid content; producers validate first (`sealExecutionEvent` is the
 * total form).
 */
export function computeExecutionEventDigest(event: ExecutionEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid execution-event content into its published record. */
export function sealExecutionEvent(event: unknown): ExecutionResult<SealedExecutionEvent> {
  const parsed = ExecutionEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed execution event: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedExecutionEvent(sealed: unknown): ExecutionResult<SealedExecutionEvent> {
  const parsed = SealedExecutionEventSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed execution event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of an `execution:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the execution vocabulary and the data must satisfy the typed shape.
 */
export function parseExecutionEventData(
  payload: ExecutionEventPayload,
): ExecutionResult<Record<string, JsonValue>> {
  const schema = (EXECUTION_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>)[
    payload.discriminator
  ];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the execution:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${EXECUTION_EVENT_DISCRIMINATORS.join(', ')}`,
          },
        ],
      },
    };
  }
  const parsed = schema.safeParse(payload.data);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}
