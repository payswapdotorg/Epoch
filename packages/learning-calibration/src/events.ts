/**
 * The learning lifecycle event vocabulary over the W010 event shapes
 * (the W039/W036 event discipline): every step of the learning host
 * emits `learning:*` events sealed by the kernel.
 *
 * - `LearningEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied
 *   instant). One solution scope's learning lifecycle events form ONE
 *   stream (`stream:learning-<suffix>`, derived deterministically by
 *   {@link learningStreamIdOf}); events are FACTS — there is no
 *   mutation API.
 * - The learning payload family is the open-namespace `learning:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`LEARNING_EVENT_DATA_SCHEMAS`); `parseLearningEventData` is the
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
import { TenantIdSchema } from '@epoch/tenancy';
import {
  PrincipalIdSchema,
  SolutionIdSchema,
  Sha256HexSchema,
} from './primitives';
import {
  LEARNING_EVENT_DISCRIMINATORS,
  LEARNING_EVENT_RECORD_VERSION,
  learningStreamIdOf,
  type LearningEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';

/** One learning event sequence number (1-based, contiguous per stream). */
export const LearningEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'LearningEventSequence',
    title: 'LearningEventSequence',
    description:
      'One learning-event sequence number: 1-based, contiguous per learning stream.',
  });

/** One learning event sequence number. */
export type LearningEventSequence = z.infer<typeof LearningEventSequenceSchema>;

/** The causal parent reference of a learning event (strictly earlier in-stream). */
export const LearningCausalParentSchema = z
  .strictObject({
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: LearningEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'LearningCausalParent',
    title: 'LearningCausalParent',
    description:
      'Causal parent of a learning event: an earlier event in the same learning stream (the W010 shape).',
  });

/** One learning causal parent reference. */
export type LearningCausalParent = z.infer<typeof LearningCausalParentSchema>;

/** The generic event payload of a learning event (the W010 shape). */
export const LearningEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'LearningEventPayload',
    title: 'LearningEventPayload',
    description:
      'Typed event payload of a learning event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One learning event payload. */
export type LearningEventPayload = z.infer<typeof LearningEventPayloadSchema>;

/**
 * The immutable content of one learning event — the STRUCTURAL MIRROR
 * of W010's `EventContent` (schemaVersion discriminator, stream,
 * sequence, tenant scope, principal actor, causal parent, payload,
 * producer-supplied occurrence instant).
 */
export const LearningEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(LEARNING_EVENT_RECORD_VERSION),
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: LearningEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: LearningCausalParentSchema.nullable(),
    payload: LearningEventPayloadSchema,
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
    id: 'LearningEventContent',
    title: 'LearningEventContent',
    description:
      'Immutable content of one learning lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One learning event content. */
export type LearningEventContent = z.infer<typeof LearningEventContentSchema>;

/**
 * The SEALED learning event record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the exact-revision content
 * address).
 */
export const SealedLearningEventSchema = z
  .strictObject({
    schemaVersion: z.literal(LEARNING_EVENT_RECORD_VERSION),
    streamId: z.string().regex(/^stream:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: LearningEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: LearningCausalParentSchema.nullable(),
    payload: LearningEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedLearningEvent',
    title: 'SealedLearningEvent',
    description:
      'Published learning event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed learning event. */
export type SealedLearningEvent = z.infer<typeof SealedLearningEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every learning:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `learning:record-intaken`. */
export const RecordIntakenDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    candidateId: z.string().regex(/^candidate:[a-z0-9][a-z0-9-]{0,62}$/),
    subjectKind: z.string().min(1).max(64),
    admission: z.enum(['intaken', 'duplicate-candidate']),
    intakenAt: TimestampSchema,
  })
  .readonly();
export type RecordIntakenData = z.infer<typeof RecordIntakenDataSchema>;

/** Payload data of `learning:dataset-assembled`. */
export const DatasetAssembledDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    datasetId: z.string().regex(/^dataset:[a-z0-9][a-z0-9-]{0,62}$/),
    datasetDigest: Sha256HexSchema,
    eligibleCount: z.number().int().min(0).max(4096),
    excludedCount: z.number().int().min(0).max(4096),
    assembledAt: TimestampSchema,
  })
  .readonly();
export type DatasetAssembledData = z.infer<typeof DatasetAssembledDataSchema>;

/** Payload data of `learning:dataset-replayed`. */
export const DatasetReplayedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    datasetId: z.string().regex(/^dataset:[a-z0-9][a-z0-9-]{0,62}$/),
    datasetDigest: Sha256HexSchema,
    replayedAt: TimestampSchema,
  })
  .readonly();
export type DatasetReplayedData = z.infer<typeof DatasetReplayedDataSchema>;

/** Payload data of `learning:metrics-folded`. */
export const MetricsFoldedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    metricId: z.string().regex(/^metrics:[a-z0-9][a-z0-9-]{0,62}$/),
    modelId: z.string().regex(/^model:[a-z0-9][a-z0-9-]{0,62}$/),
    revisionId: z.string().regex(/^model-revision:[a-z0-9][a-z0-9-]{0,62}$/),
    datasetId: z.string().regex(/^dataset:[a-z0-9][a-z0-9-]{0,62}$/),
    selectedRowCount: z.number().int().min(1).max(4096),
    foldedAt: TimestampSchema,
  })
  .readonly();
export type MetricsFoldedData = z.infer<typeof MetricsFoldedDataSchema>;

/** Payload data of `learning:revision-proposed`. */
export const RevisionProposedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    proposalId: z.string().regex(/^proposal:[a-z0-9][a-z0-9-]{0,62}$/),
    modelId: z.string().regex(/^model:[a-z0-9][a-z0-9-]{0,62}$/),
    revisionId: z.string().regex(/^model-revision:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: z.number().int().min(1).max(1024),
    proposedAt: TimestampSchema,
  })
  .readonly();
export type RevisionProposedData = z.infer<typeof RevisionProposedDataSchema>;

/** Payload data of `learning:revision-admitted`. */
export const RevisionAdmittedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    proposalId: z.string().regex(/^proposal:[a-z0-9][a-z0-9-]{0,62}$/),
    modelId: z.string().regex(/^model:[a-z0-9][a-z0-9-]{0,62}$/),
    revisionId: z.string().regex(/^model-revision:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: z.number().int().min(1).max(1024),
    admittedAt: TimestampSchema,
  })
  .readonly();
export type RevisionAdmittedData = z.infer<typeof RevisionAdmittedDataSchema>;

/** Payload data of `learning:state-projected`. */
export const StateProjectedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    candidateCount: z.number().int().min(0).max(4096),
    datasetCount: z.number().int().min(0).max(4096),
    metricCount: z.number().int().min(0).max(65536),
    modelCount: z.number().int().min(0).max(4096),
    revisionCount: z.number().int().min(0).max(65536),
    projectedAt: TimestampSchema,
  })
  .readonly();
export type StateProjectedData = z.infer<typeof StateProjectedDataSchema>;

/** Payload data of `learning:pack-view-projected`. */
export const PackViewProjectedDataSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    packId: z.string().min(1).max(256),
    rowCount: z.number().int().min(1).max(4096),
    projectedAt: TimestampSchema,
  })
  .readonly();
export type PackViewProjectedData = z.infer<typeof PackViewProjectedDataSchema>;

/**
 * The typed payload-data schema for every `learning:*` event kind (the
 * W010 payload-family discipline, applied to the whole learning
 * vocabulary).
 */
export const LEARNING_EVENT_DATA_SCHEMAS: Readonly<
  Record<LearningEventDiscriminator, z.ZodType>
> = {
  'learning:record-intaken': RecordIntakenDataSchema,
  'learning:dataset-assembled': DatasetAssembledDataSchema,
  'learning:dataset-replayed': DatasetReplayedDataSchema,
  'learning:metrics-folded': MetricsFoldedDataSchema,
  'learning:revision-proposed': RevisionProposedDataSchema,
  'learning:revision-admitted': RevisionAdmittedDataSchema,
  'learning:state-projected': StateProjectedDataSchema,
  'learning:pack-view-projected': PackViewProjectedDataSchema,
};

/**
 * Compute the content digest of a learning event: the SHA-256 of its
 * canonical JSON serialization — identical to W010's computeEventDigest
 * for the same content (pinned by the runtime parity test).
 */
export function computeLearningEventDigest(event: LearningEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid learning-event content into its published record. */
export function sealLearningEvent(
  event: unknown,
): LearningResult<SealedLearningEvent> {
  const parsed = LearningEventContentSchema.safeParse(event);
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
 * Verify a sealed learning event: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedLearningEvent(
  sealed: unknown,
): LearningResult<SealedLearningEvent> {
  const parsed = SealedLearningEventSchema.safeParse(sealed);
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
          'sealed learning event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of a `learning:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the learning vocabulary and the data must satisfy the typed shape.
 */
export function parseLearningEventData(
  payload: LearningEventPayload,
): LearningResult<Record<string, JsonValue>> {
  const schema = (
    LEARNING_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>
  )[payload.discriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the learning:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${LEARNING_EVENT_DISCRIMINATORS.join(', ')}`,
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

export { learningStreamIdOf };
