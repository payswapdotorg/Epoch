/**
 * The actualization lifecycle event vocabulary over the W010 event
 * shapes (the W039 dispatch pin: "every step emits `actualization:*`
 * events (W010-shaped) sealed by the kernel").
 *
 * - `ActualizationEventContent` is a STRUCTURAL MIRROR of
 *   @epoch/event-log's `EventContent` (stream, 1-based sequence, tenant
 *   scope, principal actor, causal parent, namespaced payload,
 *   producer-supplied instant). One delivery's actualization lifecycle
 *   events form ONE stream (`stream:actualization-<suffix>`, derived
 *   deterministically by `actualizationStreamIdOf`); events are FACTS —
 *   there is no mutation API.
 * - The actualization payload family is the open-namespace
 *   `actualization:*` discriminator set with TYPED data payloads for
 *   every kind (`ACTUALIZATION_EVENT_DATA_SCHEMAS`);
 *   `parseActualizationEventData` is the W010 payload-family discipline
 *   applied to the whole vocabulary.
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
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DeliveryIdSchema,
  PrincipalIdSchema,
  REALIZATION_VARIANTS,
  Sha256HexSchema,
} from '@epoch/solution-delivery';
import {
  ACTUALIZATION_EVENT_DISCRIMINATORS,
  ACTUALIZATION_EVENT_RECORD_VERSION,
  VALIDATION_STATES,
  type ActualizationEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ActualizationResult } from './errors';

/** One actualization event sequence number (1-based, contiguous per stream). */
export const ActualizationEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'ActualizationEventSequence',
    title: 'ActualizationEventSequence',
    description:
      'One actualization-event sequence number: 1-based, contiguous per actualization stream.',
  });

/** One actualization event sequence number. */
export type ActualizationEventSequence = z.infer<typeof ActualizationEventSequenceSchema>;

/** The causal parent reference of an actualization event (strictly earlier in-stream). */
export const ActualizationCausalParentSchema = z
  .strictObject({
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: ActualizationEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'ActualizationCausalParent',
    title: 'ActualizationCausalParent',
    description:
      'Causal parent of an actualization event: an earlier event in the same actualization stream (the W010 shape).',
  });

/** One actualization causal parent reference. */
export type ActualizationCausalParent = z.infer<typeof ActualizationCausalParentSchema>;

/** The generic event payload of an actualization event (the W010 shape). */
export const ActualizationEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'ActualizationEventPayload',
    title: 'ActualizationEventPayload',
    description:
      'Typed event payload of an actualization event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One actualization event payload. */
export type ActualizationEventPayload = z.infer<typeof ActualizationEventPayloadSchema>;

/**
 * The immutable content of one actualization event — the STRUCTURAL
 * MIRROR of W010's `EventContent` (schemaVersion discriminator, stream,
 * sequence, tenant scope, principal actor, causal parent, payload,
 * producer-supplied occurrence instant).
 */
export const ActualizationEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(ACTUALIZATION_EVENT_RECORD_VERSION),
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: ActualizationEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ActualizationCausalParentSchema.nullable(),
    payload: ActualizationEventPayloadSchema,
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
    id: 'ActualizationEventContent',
    title: 'ActualizationEventContent',
    description:
      'Immutable content of one actualization lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One actualization event content. */
export type ActualizationEventContent = z.infer<typeof ActualizationEventContentSchema>;

/**
 * The SEALED actualization event record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the exact-revision content
 * address).
 */
export const SealedActualizationEventSchema = z
  .strictObject({
    schemaVersion: z.literal(ACTUALIZATION_EVENT_RECORD_VERSION),
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: ActualizationEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ActualizationCausalParentSchema.nullable(),
    payload: ActualizationEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedActualizationEvent',
    title: 'SealedActualizationEvent',
    description:
      'Published actualization event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed actualization event. */
export type SealedActualizationEvent = z.infer<typeof SealedActualizationEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every actualization:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `actualization:observation-intaken`. */
export const ObservationIntakenDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    observationId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    subjectKind: z.string().min(1).max(64),
    measureKind: z.enum(['quantity', 'cost', 'progress', 'instant']),
    admission: z.enum(['recorded', 'duplicate-observation']),
    intakenAt: TimestampSchema,
  })
  .readonly();
export type ObservationIntakenData = z.infer<typeof ObservationIntakenDataSchema>;

/** Payload data of `actualization:validation-assessed`. */
export const ValidationAssessedDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    assessmentId: z.string().regex(/^validation:[a-z0-9][a-z0-9-]{0,62}$/),
    state: z.enum(VALIDATION_STATES),
    observationCount: z.number().int().min(0).max(4096),
    measureKind: z.enum(['quantity', 'cost', 'progress', 'instant']),
    deviationMagnitude: z.string().min(1).max(64),
    assessedAt: TimestampSchema,
  })
  .readonly();
export type ValidationAssessedData = z.infer<typeof ValidationAssessedDataSchema>;

/** Payload data of `actualization:conflict-resolved`. */
export const ConflictResolvedDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    resolutionId: z.string().regex(/^resolution:[a-z0-9][a-z0-9-]{0,62}$/),
    assessmentId: z.string().regex(/^validation:[a-z0-9][a-z0-9-]{0,62}$/),
    selectedCount: z.number().int().min(1).max(4096),
    excludedCount: z.number().int().min(0).max(4096),
    resolvedAt: TimestampSchema,
  })
  .readonly();
export type ConflictResolvedData = z.infer<typeof ConflictResolvedDataSchema>;

/** Payload data of `actualization:actuals-minted`. */
export const ActualsMintedDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    assessmentId: z.string().regex(/^validation:[a-z0-9][a-z0-9-]{0,62}$/),
    mintedCount: z.number().int().min(0).max(4096),
    alreadyMintedCount: z.number().int().min(0).max(4096),
    deliveryDigest: Sha256HexSchema,
    actualizedAt: TimestampSchema,
  })
  .readonly();
export type ActualsMintedData = z.infer<typeof ActualsMintedDataSchema>;

/** Payload data of `actualization:lineage-linked`. */
export const LineageLinkedDataSchema = z
  .strictObject({
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    edgeId: z.string().regex(/^lineage:[a-z0-9][a-z0-9-]{0,62}$/),
    realizationVariant: z.enum(REALIZATION_VARIANTS),
    fromKind: z.enum(['prediction', 'baseline', 'commitment', 'actual', 'forecast']),
    fromRecordId: z.string().min(1).max(128),
    toKind: z.enum(['prediction', 'baseline', 'commitment', 'actual', 'forecast']),
    toRecordId: z.string().min(1).max(128),
    recordedAt: TimestampSchema,
  })
  .readonly();
export type LineageLinkedData = z.infer<typeof LineageLinkedDataSchema>;

/** Payload data of `actualization:forecast-revised`. */
export const ForecastRevisedDataSchema = z
  .strictObject({
    forecastRecordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
    subjectKind: z.string().min(1).max(64),
    measureKind: z.enum(['quantity', 'cost']),
    atCompletion: z.string().min(1).max(64),
    remaining: z.string().min(1).max(64),
    asOf: TimestampSchema,
    refines: z
      .string()
      .regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/)
      .nullable(),
  })
  .readonly();
export type ForecastRevisedData = z.infer<typeof ForecastRevisedDataSchema>;

/** Payload data of `actualization:calibration-folded`. */
export const CalibrationFoldedDataSchema = z
  .strictObject({
    calibrationId: z.string().regex(/^calibration:[a-z0-9][a-z0-9-]{0,62}$/),
    comparisonCount: z.number().int().min(0).max(4096),
    overCount: z.number().int().min(0).max(4096),
    underCount: z.number().int().min(0).max(4096),
    exactCount: z.number().int().min(0).max(4096),
    totalAbsoluteDeviation: z.string().min(1).max(64),
    foldedAt: TimestampSchema,
  })
  .readonly();
export type CalibrationFoldedData = z.infer<typeof CalibrationFoldedDataSchema>;

/** Payload data of `actualization:state-projected`. */
export const StateProjectedDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    deliveryDigest: Sha256HexSchema,
    observationCount: z.number().int().min(0).max(4096),
    actualCount: z.number().int().min(0).max(4096),
    groupCount: z.number().int().min(0).max(4096),
    projectedAt: TimestampSchema,
  })
  .readonly();
export type StateProjectedData = z.infer<typeof StateProjectedDataSchema>;

/**
 * The typed payload-data schema for every `actualization:*` event kind
 * (the W010 payload-family discipline, applied to the whole
 * actualization vocabulary).
 */
export const ACTUALIZATION_EVENT_DATA_SCHEMAS: Readonly<
  Record<ActualizationEventDiscriminator, z.ZodType>
> = {
  'actualization:observation-intaken': ObservationIntakenDataSchema,
  'actualization:validation-assessed': ValidationAssessedDataSchema,
  'actualization:conflict-resolved': ConflictResolvedDataSchema,
  'actualization:actuals-minted': ActualsMintedDataSchema,
  'actualization:lineage-linked': LineageLinkedDataSchema,
  'actualization:forecast-revised': ForecastRevisedDataSchema,
  'actualization:calibration-folded': CalibrationFoldedDataSchema,
  'actualization:state-projected': StateProjectedDataSchema,
};

/**
 * Compute the content digest of an actualization event: the SHA-256 of
 * its canonical JSON serialization — identical to W010's
 * computeEventDigest for the same content (pinned by the runtime parity
 * test).
 */
export function computeActualizationEventDigest(event: ActualizationEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid actualization-event content into its published record. */
export function sealActualizationEvent(
  event: unknown,
): ActualizationResult<SealedActualizationEvent> {
  const parsed = ActualizationEventContentSchema.safeParse(event);
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
 * Verify a sealed actualization event: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedActualizationEvent(
  sealed: unknown,
): ActualizationResult<SealedActualizationEvent> {
  const parsed = SealedActualizationEventSchema.safeParse(sealed);
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
        message:
          'sealed actualization event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of an `actualization:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the actualization vocabulary and the data must satisfy the typed
 * shape.
 */
export function parseActualizationEventData(
  payload: ActualizationEventPayload,
): ActualizationResult<Record<string, JsonValue>> {
  const schema = (
    ACTUALIZATION_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>
  )[payload.discriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the actualization:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${ACTUALIZATION_EVENT_DISCRIMINATORS.join(', ')}`,
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
