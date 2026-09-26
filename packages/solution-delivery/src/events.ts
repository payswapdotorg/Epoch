/**
 * The delivery lifecycle event vocabulary over the W010 event shapes (the
 * dispatch pin: "delivery lifecycle event vocabulary ... over the W010
 * event shapes via devDep parity — `delivery:*` payload namespace").
 *
 * - `DeliveryEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied instant).
 *   One delivery's lifecycle events form ONE stream
 *   (`stream:delivery-<suffix>`, derived deterministically by
 *   `deliveryStreamIdOf`); events are FACTS — there is no mutation API.
 * - The delivery payload family is the open-namespace `delivery:*`
 *   discriminator set (src/version.ts) with TYPED data payloads for every
 *   kind (`DELIVERY_EVENT_DATA_SCHEMAS`); `parseDeliveryEventData` is the
 *   W010 payload-family discipline applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time via
 *   `src/kernel-parity.ts` (type equality with `EventContent`), runtime
 *   via `test/parity.test.ts` (the same fixtures validate through the
 *   REAL W010 validators; mirrored grammars are pattern-identical).
 */
import { z } from 'zod';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  AcquisitionIdSchema,
  DeliveryStreamIdSchema,
  MilestoneIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
} from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DELIVERY_EVENT_DISCRIMINATORS,
  DELIVERY_EVENT_RECORD_VERSION,
  LIFECYCLE_TRANSITION_RELATIONS,
  UNIVERSAL_LIFECYCLE_STAGES,
  type DeliveryEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

/** One delivery event sequence number (1-based, contiguous per stream). */
export const DeliveryEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'DeliveryEventSequence',
    title: 'DeliveryEventSequence',
    description: 'One delivery-event sequence number: 1-based, contiguous per delivery stream.',
  });

/** One delivery event sequence number. */
export type DeliveryEventSequence = z.infer<typeof DeliveryEventSequenceSchema>;

/** The causal parent reference of a delivery event (strictly earlier). */
export const DeliveryCausalParentSchema = z
  .strictObject({
    streamId: DeliveryStreamIdSchema,
    sequence: DeliveryEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'DeliveryCausalParent',
    title: 'DeliveryCausalParent',
    description:
      'Causal parent of a delivery event: an earlier event in the same delivery stream (the W010 shape).',
  });

/** One delivery causal parent reference. */
export type DeliveryCausalParent = z.infer<typeof DeliveryCausalParentSchema>;

/** The generic event payload of a delivery event (the W010 shape). */
export const DeliveryEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'DeliveryEventPayload',
    title: 'DeliveryEventPayload',
    description:
      'Typed event payload of a delivery event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One delivery event payload. */
export type DeliveryEventPayload = z.infer<typeof DeliveryEventPayloadSchema>;

/**
 * The immutable content of one delivery event — the STRUCTURAL MIRROR of
 * W010's `EventContent` (schemaVersion discriminator, stream, sequence,
 * tenant scope, principal actor, causal parent, payload, producer-supplied
 * occurrence instant).
 */
export const DeliveryEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(DELIVERY_EVENT_RECORD_VERSION),
    streamId: DeliveryStreamIdSchema,
    sequence: DeliveryEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: DeliveryCausalParentSchema.nullable(),
    payload: DeliveryEventPayloadSchema,
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
        message: 'a same-stream causal parent must be strictly earlier',
        path: ['causalParent'],
      });
    }
  })
  .meta({
    id: 'DeliveryEventContent',
    title: 'DeliveryEventContent',
    description:
      'Immutable content of one delivery lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One delivery event content. */
export type DeliveryEventContent = z.infer<typeof DeliveryEventContentSchema>;

/**
 * The SEALED delivery event record: content plus its SHA-256 digest over
 * the canonical JSON of the content (the exact-revision content address).
 */
export const SealedDeliveryEventSchema = z
  .strictObject({
    schemaVersion: z.literal(DELIVERY_EVENT_RECORD_VERSION),
    streamId: DeliveryStreamIdSchema,
    sequence: DeliveryEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: DeliveryCausalParentSchema.nullable(),
    payload: DeliveryEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedDeliveryEvent',
    title: 'SealedDeliveryEvent',
    description:
      'Published delivery event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed delivery event. */
export type SealedDeliveryEvent = z.infer<typeof SealedDeliveryEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every delivery:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `delivery:stage-entered`. */
export const StageEnteredDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    subjectId: z.string().min(1).max(256),
    stage: z.enum(UNIVERSAL_LIFECYCLE_STAGES),
    stageRecordId: z.string().regex(/^stage:[a-z0-9][a-z0-9-]{0,62}$/),
    enteredAt: TimestampSchema,
  })
  .readonly();
export type StageEnteredData = z.infer<typeof StageEnteredDataSchema>;

/** Payload data of `delivery:stage-transition`. */
export const StageTransitionDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    subjectId: z.string().min(1).max(256),
    relation: z.enum(LIFECYCLE_TRANSITION_RELATIONS),
    fromStageRecordId: z.string().regex(/^stage:[a-z0-9][a-z0-9-]{0,62}$/),
    toStageRecordId: z.string().regex(/^stage:[a-z0-9][a-z0-9-]{0,62}$/),
    recordedAt: TimestampSchema,
  })
  .readonly();
export type StageTransitionData = z.infer<typeof StageTransitionDataSchema>;

/** Payload data of `delivery:baseline-approved`. */
export const BaselineApprovedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    baselineDigest: Sha256HexSchema,
    approvedBy: PrincipalIdSchema,
    approvedAt: TimestampSchema,
  })
  .readonly();
export type BaselineApprovedData = z.infer<typeof BaselineApprovedDataSchema>;

/** Payload data of `delivery:baseline-revision`. */
export const BaselineRevisionDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    previousVersionDigest: Sha256HexSchema.nullable(),
    contentDigest: Sha256HexSchema,
    createdAt: TimestampSchema,
  })
  .readonly();
export type BaselineRevisionData = z.infer<typeof BaselineRevisionDataSchema>;

/** Payload data of the observation event kinds. */
export const ObservationEventDataSchema = z
  .strictObject({
    deliveryId: z.string().regex(/^delivery:[a-z0-9][a-z0-9-]{0,62}$/),
    observationId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    at: TimestampSchema,
  })
  .readonly();
export type ObservationEventData = z.infer<typeof ObservationEventDataSchema>;

/** Payload data of `delivery:observation-actualized`. */
export const ObservationActualizedDataSchema = z
  .strictObject({
    deliveryId: z.string().regex(/^delivery:[a-z0-9][a-z0-9-]{0,62}$/),
    observationId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    actualId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
    actualizedAt: TimestampSchema,
  })
  .readonly();
export type ObservationActualizedData = z.infer<typeof ObservationActualizedDataSchema>;

/** Payload data of `delivery:acquisition-requested`. */
export const AcquisitionRequestedDataSchema = z
  .strictObject({
    acquisitionId: AcquisitionIdSchema,
    variant: z.enum([
      'external-procurement',
      'internal-allocation',
      'subscription-license',
      'cloud-service-provisioning',
      'fabrication-request',
      'specialist-capability-assignment',
      'data-evidence-acquisition',
    ]),
    requestedAt: TimestampSchema,
  })
  .readonly();
export type AcquisitionRequestedData = z.infer<typeof AcquisitionRequestedDataSchema>;

/** Payload data of `delivery:acquisition-fulfilled`. */
export const AcquisitionFulfilledDataSchema = z
  .strictObject({
    acquisitionId: AcquisitionIdSchema,
    fulfilledAt: TimestampSchema,
  })
  .readonly();
export type AcquisitionFulfilledData = z.infer<typeof AcquisitionFulfilledDataSchema>;

/** Payload data of `delivery:milestone-reached`. */
export const MilestoneReachedDataSchema = z
  .strictObject({
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    milestoneId: MilestoneIdSchema,
    reachedAt: TimestampSchema,
  })
  .readonly();
export type MilestoneReachedData = z.infer<typeof MilestoneReachedDataSchema>;

/** Payload data of `delivery:forecast-recorded`. */
export const ForecastRecordedDataSchema = z
  .strictObject({
    forecastRecordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
    asOf: TimestampSchema,
    refines: z
      .string()
      .regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/)
      .nullable(),
  })
  .readonly();
export type ForecastRecordedData = z.infer<typeof ForecastRecordedDataSchema>;

/** Payload data of `delivery:outcome-recorded`. */
export const OutcomeRecordedDataSchema = z
  .strictObject({
    outcomeRecordId: z.string().regex(/^outcome:[a-z0-9][a-z0-9-]{0,62}$/),
    outcomeKind: z.enum([
      'delivered',
      'accepted',
      'handover',
      'residual',
      'rejected',
      'abandoned',
    ]),
    recordedAt: TimestampSchema,
  })
  .readonly();
export type OutcomeRecordedData = z.infer<typeof OutcomeRecordedDataSchema>;

/** Payload data of `delivery:learning-recorded`. */
export const LearningRecordedDataSchema = z
  .strictObject({
    learningRecordId: z.string().regex(/^learning:[a-z0-9][a-z0-9-]{0,62}$/),
    recordedAt: TimestampSchema,
  })
  .readonly();
export type LearningRecordedData = z.infer<typeof LearningRecordedDataSchema>;

/** Payload data of `delivery:info-request-issued`. */
export const InfoRequestIssuedDataSchema = z
  .strictObject({
    requestId: z.string().regex(/^info-request:[a-z0-9][a-z0-9-]{0,62}$/),
    decisionImpact: z.enum(['material', 'immaterial']),
    issuedAt: TimestampSchema,
  })
  .readonly();
export type InfoRequestIssuedData = z.infer<typeof InfoRequestIssuedDataSchema>;

/**
 * The typed payload-data schema for every `delivery:*` event kind (the
 * W010 payload-family discipline, applied to the whole delivery
 * vocabulary).
 */
export const DELIVERY_EVENT_DATA_SCHEMAS: Readonly<
  Record<DeliveryEventDiscriminator, z.ZodType>
> = {
  'delivery:stage-entered': StageEnteredDataSchema,
  'delivery:stage-transition': StageTransitionDataSchema,
  'delivery:baseline-approved': BaselineApprovedDataSchema,
  'delivery:baseline-revision': BaselineRevisionDataSchema,
  'delivery:observation-recorded': ObservationEventDataSchema,
  'delivery:observation-accepted': ObservationEventDataSchema,
  'delivery:observation-rejected': ObservationEventDataSchema,
  'delivery:observation-actualized': ObservationActualizedDataSchema,
  'delivery:acquisition-requested': AcquisitionRequestedDataSchema,
  'delivery:acquisition-fulfilled': AcquisitionFulfilledDataSchema,
  'delivery:milestone-reached': MilestoneReachedDataSchema,
  'delivery:forecast-recorded': ForecastRecordedDataSchema,
  'delivery:outcome-recorded': OutcomeRecordedDataSchema,
  'delivery:learning-recorded': LearningRecordedDataSchema,
  'delivery:info-request-issued': InfoRequestIssuedDataSchema,
};

/**
 * Compute the content digest of a delivery event: the SHA-256 of its
 * canonical JSON serialization — identical to W010's computeEventDigest
 * for the same content (pinned by the runtime parity test). Throws on
 * invalid content; producers validate first (`sealDeliveryEvent` is the
 * total form).
 */
export function computeDeliveryEventDigest(event: DeliveryEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid delivery-event content into its published record. */
export function sealDeliveryEvent(event: unknown): DeliveryResult<SealedDeliveryEvent> {
  const parsed = DeliveryEventContentSchema.safeParse(event);
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
 * Verify a sealed delivery event: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedDeliveryEvent(sealed: unknown): DeliveryResult<SealedDeliveryEvent> {
  const parsed = SealedDeliveryEventSchema.safeParse(sealed);
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
        message: 'sealed delivery event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of a `delivery:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the delivery vocabulary and the data must satisfy the typed shape.
 */
export function parseDeliveryEventData(
  payload: DeliveryEventPayload,
): DeliveryResult<Record<string, JsonValue>> {
  const schema = (DELIVERY_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>)[
    payload.discriminator
  ];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the delivery:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${DELIVERY_EVENT_DISCRIMINATORS.join(', ')}`,
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
