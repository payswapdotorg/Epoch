/**
 * Marketplace trust metadata as W006-SHAPED evidence records
 * (extension-architecture.md Trust + Marketplace sections, binding).
 *
 * The record shape is a STRUCTURAL MIRROR of @epoch/evidence's
 * `EvidenceRecord` (kind vocabulary, exact-revision subject reference,
 * production provenance, observed instant, media-typed payload, confidence):
 * marketplace listings vouch for the capability revisions they reference
 * with the same evidence grammar the kernel already owns. Compatibility is
 * pinned WITHOUT a runtime dependency — the kernel-to-kernel devDependency
 * precedent (W002/W006-W009/W011/W013/W028):
 *
 * - compile time: `src/kernel-parity.ts` proves the mirror is type-equal to
 *   `EvidenceRecord`;
 * - runtime: `test/parity.test.ts` validates the same fixtures through the
 *   REAL @epoch/evidence validators and asserts digest equality.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { Sha256HexSchema } from './primitives';
import {
  CONFIDENCE_METHODS,
  INTERVAL_BIASES,
  TRUST_EVIDENCE_KINDS,
} from './version';

/** RFC 6838-style media type (type "/" subtype), lowercase — MIRRORED from W006. */
export const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;

/** Trust-evidence kind vocabulary — MIRRORED from W006 EVIDENCE_KINDS. */
export const TrustEvidenceKindSchema = z.enum(TRUST_EVIDENCE_KINDS).meta({
  id: 'TrustEvidenceKind',
  title: 'TrustEvidenceKind',
  description:
    'Kind of trust evidence: document, measurement, observation, computation, assertion, external, other (the W006 evidence-kind vocabulary).',
});

/** Confidence acquisition method — MIRRORED from W006. */
export const TrustConfidenceMethodSchema = z.enum(CONFIDENCE_METHODS).meta({
  id: 'TrustConfidenceMethod',
  title: 'TrustConfidenceMethod',
  description:
    'How a confidence figure was obtained: stated, measured, estimated, derived, imported (the W006 vocabulary).',
});

/** Directional bias for interval estimates — MIRRORED from W006. */
export const TrustIntervalBiasSchema = z.enum(INTERVAL_BIASES).meta({
  id: 'TrustIntervalBias',
  title: 'TrustIntervalBias',
  description: 'Directional bias admitted for interval confidence estimates: none, low, high (the W006 vocabulary).',
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
    bias: TrustIntervalBiasSchema.optional(),
  })
  .readonly();

const SetDistribution = z
  .strictObject({
    kind: z.literal('set'),
    values: z.array(ConfidenceValue).min(1).readonly(),
    weights: z.array(z.number().min(0)).readonly().optional(),
  })
  .readonly();

/** Confidence distribution — MIRRORED from W006 (point/interval/set). */
export const TrustConfidenceDistributionSchema = z
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
    id: 'TrustConfidenceDistribution',
    title: 'TrustConfidenceDistribution',
    description: 'Bounded [0,1] uncertainty distribution: point, interval, or weighted set (the W006 shape).',
  });

/** Confidence attached to a trust-evidence record — MIRRORED from W006. */
export const TrustConfidenceSchema = z
  .strictObject({
    distribution: TrustConfidenceDistributionSchema,
    method: TrustConfidenceMethodSchema.optional(),
    rationale: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'TrustConfidence',
    title: 'TrustConfidence',
    description:
      'Uncertainty attached to a trust-evidence record: distribution, acquisition method, rationale (the W006 shape).',
  });

/** Exact-revision subject reference — MIRRORED from W006 ExactRevisionRef. */
export const TrustExactRevisionRefSchema = z
  .strictObject({
    artifactId: z.string().min(1).max(256),
    revision: z.string().min(1).max(128),
    digest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'TrustExactRevisionRef',
    title: 'TrustExactRevisionRef',
    description:
      'Reference to the exact artifact revision the trust evidence is about: opaque artifact id, revision label, and SHA-256 content digest (the W006 shape).',
  });

/** Production provenance — MIRRORED from W006 EvidenceProduction. */
export const TrustEvidenceProductionSchema = z
  .strictObject({
    runId: z.string().min(1).max(256),
    actorId: z.string().min(1).max(256),
    methodId: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'TrustEvidenceProduction',
    title: 'TrustEvidenceProduction',
    description:
      'Opaque identifiers of the run, executing actor, and (optional) method that produced the trust evidence (the W006 shape).',
  });

/** Media-typed payload — MIRRORED from W006 EvidencePayload. */
export const TrustEvidencePayloadSchema = z
  .strictObject({
    mediaType: z.string().max(255).regex(MEDIA_TYPE_PATTERN),
    data: JsonValueSchema,
    locator: z.string().min(1).max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'TrustEvidencePayload',
    title: 'TrustEvidencePayload',
    description: 'JSON-representable payload plus media type and optional out-of-band locator (the W006 shape).',
  });

/**
 * One marketplace trust-evidence record: W006-shaped evidence vouching for
 * the exact capability revision a listing version references (the subject
 * points at the capability manifest: artifactId = capability id, revision =
 * capability version, digest = manifest digest). The record's identity is
 * the SHA-256 of its canonical JSON (content addressing).
 */
export const TrustEvidenceRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: TrustEvidenceKindSchema,
    subject: TrustExactRevisionRefSchema,
    producedBy: TrustEvidenceProductionSchema,
    observedAt: TimestampSchema,
    content: TrustEvidencePayloadSchema,
    confidence: TrustConfidenceSchema,
  })
  .readonly()
  .meta({
    id: 'TrustEvidenceRecord',
    title: 'TrustEvidenceRecord',
    description:
      'One W006-shaped trust-evidence record: kind, exact-revision subject, production provenance, observed instant, media-typed payload, and confidence.',
  });

/** One trust-evidence record. */
export type TrustEvidenceRecord = z.infer<typeof TrustEvidenceRecordSchema>;

/** One confidence struct attached to trust evidence. */
export type TrustConfidence = z.infer<typeof TrustConfidenceSchema>;

/** One confidence distribution. */
export type TrustConfidenceDistribution = z.infer<typeof TrustConfidenceDistributionSchema>;

/** One exact-revision subject reference. */
export type TrustExactRevisionRef = z.infer<typeof TrustExactRevisionRefSchema>;

/** One production-provenance record. */
export type TrustEvidenceProduction = z.infer<typeof TrustEvidenceProductionSchema>;

/** One media-typed payload. */
export type TrustEvidencePayload = z.infer<typeof TrustEvidencePayloadSchema>;

/** One trust-evidence kind. */
export type TrustEvidenceKind = z.infer<typeof TrustEvidenceKindSchema>;

/** One confidence acquisition method. */
export type TrustConfidenceMethod = z.infer<typeof TrustConfidenceMethodSchema>;

/** One interval bias. */
export type TrustIntervalBias = z.infer<typeof TrustIntervalBiasSchema>;

/**
 * Content-addressed identity of a trust-evidence record: the SHA-256 of its
 * canonical JSON serialization — identical to W006's computeEvidenceDigest
 * for the same content (pinned by the runtime parity test). Throws on an
 * invalid record; producers validate first (parseTrustEvidenceRecord is the
 * total form).
 */
export function computeTrustEvidenceDigest(record: TrustEvidenceRecord): Sha256Hex {
  return canonicalDigest(record as unknown as JsonValue);
}

/**
 * Canonical ordering key of trust-evidence records within one listing
 * version: the content digest ascending. The listing-version schema
 * enforces that embedded trust evidence is sorted and duplicate-free by
 * this key (deterministic serialization — no insertion-order leaks).
 */
export function trustEvidenceOrderKey(record: TrustEvidenceRecord): Sha256Hex {
  return computeTrustEvidenceDigest(record);
}
