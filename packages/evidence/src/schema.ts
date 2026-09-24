/**
 * @epoch/evidence — runtime zod validators for the published contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the evidence
 * door (same policy as the W002 world-model provenance validators). Every
 * exported schema is part of the published surface emitted under `schemas/`.
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import {
  CONFIDENCE_METHODS,
  EVIDENCE_KINDS,
  EVIDENCE_RECORD_VERSION,
  INTERVAL_BIASES,
} from './version';

/** Proof-grade digest: lowercase hex SHA-256, exactly 64 characters. */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** RFC 6838-style media type (type "/" subtype), lowercase. */
export const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

/** SHA-256 digest as lowercase hex — the exact-revision address form. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'urn:epoch:evidence:sha256-digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Serialized-form version discriminator for evidence records (v1). */
export const EvidenceVersionSchema = z.literal(EVIDENCE_RECORD_VERSION).meta({
  id: 'urn:epoch:evidence:record-version',
  title: 'EvidenceRecordVersion',
  description: 'Version discriminator carried by every serialized evidence record (currently 1).',
});

/** Evidence kind vocabulary (W002-aligned). */
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS).meta({
  id: 'urn:epoch:evidence:evidence-kind',
  title: 'EvidenceKind',
  description: 'Kind of evidence: document, measurement, observation, computation, assertion, external, other.',
});

/** Confidence acquisition method (W002-aligned). */
export const ConfidenceMethodSchema = z.enum(CONFIDENCE_METHODS).meta({
  id: 'urn:epoch:evidence:confidence-method',
  title: 'ConfidenceMethod',
  description: 'How a confidence figure was obtained: stated, measured, estimated, derived, imported.',
});

/** Directional bias for interval estimates (W002-aligned). */
export const IntervalBiasSchema = z.enum(INTERVAL_BIASES).meta({
  id: 'urn:epoch:evidence:interval-bias',
  title: 'IntervalBias',
  description: 'Directional bias admitted for interval confidence estimates: none, low, high.',
});

const ConfidenceValue = z.number().min(0).max(1);

const PointDistribution = z
  .strictObject({
    kind: z.literal('point'),
    value: ConfidenceValue,
  })
  .readonly();

const IntervalDistribution = z
  .strictObject({
    kind: z.literal('interval'),
    lower: ConfidenceValue,
    upper: ConfidenceValue,
    bias: IntervalBiasSchema.optional(),
  })
  .readonly();

const SetDistribution = z
  .strictObject({
    kind: z.literal('set'),
    values: z.array(ConfidenceValue).min(1).readonly(),
    weights: z.array(z.number().min(0)).readonly().optional(),
  })
  .readonly();

/**
 * Confidence distribution — the W002 world-model model of uncertainty
 * (point / interval / weighted set), reused verbatim so evidence confidence
 * and world-model assertion confidence are the same shape where they meet.
 */
export const ConfidenceDistributionSchema = z
  .discriminatedUnion('kind', [PointDistribution, IntervalDistribution, SetDistribution])
  .superRefine((value, ctx) => {
    if (value.kind === 'interval' && value.lower > value.upper) {
      ctx.addIssue({
        code: 'custom',
        message: 'interval lower bound must not exceed upper bound',
        path: ['lower'],
      });
    }
    if (value.kind === 'set' && value.weights !== undefined && value.weights.length !== value.values.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'weights must align with values',
        path: ['weights'],
      });
    }
  })
  .meta({
    id: 'urn:epoch:evidence:confidence-distribution',
    title: 'ConfidenceDistribution',
    description: 'Bounded [0,1] uncertainty distribution: point, interval, or weighted set (W002-aligned).',
  });

/** Confidence attached to an evidence record (the W002 `Confidence` shape). */
export const ConfidenceSchema = z
  .strictObject({
    distribution: ConfidenceDistributionSchema,
    method: ConfidenceMethodSchema.optional(),
    rationale: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:evidence:confidence',
    title: 'Confidence',
    description: 'Uncertainty attached to an evidence record: distribution, acquisition method, rationale.',
  });

/** Exact-revision reference: the artifact revision this evidence is about. */
export const ExactRevisionRefSchema = z
  .strictObject({
    artifactId: z.string().min(1).max(256),
    revision: z.string().min(1).max(128),
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:evidence:exact-revision-ref',
    title: 'ExactRevisionRef',
    description: 'Reference to the exact artifact revision: opaque artifact id, revision label, and SHA-256 content digest.',
  });

/** Producer reference: which run/actor/method produced the evidence. */
export const EvidenceProductionSchema = z
  .strictObject({
    runId: z.string().min(1).max(256),
    actorId: z.string().min(1).max(256),
    methodId: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:evidence:evidence-production',
    title: 'EvidenceProduction',
    description: 'Opaque identifiers of the run, executing actor, and (optional) method that produced the evidence.',
  });

/** Evidence payload: media-typed JSON data plus optional opaque locator. */
export const EvidencePayloadSchema = z
  .strictObject({
    mediaType: z.string().max(255).regex(MEDIA_TYPE_PATTERN),
    data: JsonValueSchema,
    locator: z.string().min(1).max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:evidence:evidence-payload',
    title: 'EvidencePayload',
    description: 'JSON-representable payload plus media type and optional out-of-band locator.',
  });

/** The evidence record itself — content-addressed via canonical SHA-256. */
export const EvidenceRecordSchema = z
  .strictObject({
    schemaVersion: EvidenceVersionSchema,
    kind: EvidenceKindSchema,
    subject: ExactRevisionRefSchema,
    producedBy: EvidenceProductionSchema,
    observedAt: TimestampSchema,
    content: EvidencePayloadSchema,
    confidence: ConfidenceSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:evidence:evidence-record',
    title: 'EvidenceRecord',
    description: 'Exact-revision, content-addressed evidence record with producer reference and confidence/uncertainty.',
  });
