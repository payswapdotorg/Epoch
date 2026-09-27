/**
 * Provider-neutral zod primitives of the variance kernel. Every schema
 * here is a JSON-representable data shape; no field encodes a vendor,
 * brand, marketplace, ERP, PM tool, or API surface (architecture lock
 * rule 13).
 *
 * Composition policy (the frozen W039 dependency policy: runtime deps
 * are @epoch/agent-protocol, @epoch/tenancy and zod ONLY): digest
 * machinery, timestamps and the JSON value space are REUSED from
 * @epoch/agent-protocol; tenant ids are REUSED from @epoch/tenancy. The
 * MEASURE-VALUE space is a structural mirror of the W036 measure grammar
 * (quantity/cost/instant/progress) — locally owned because there is no
 * runtime edge to @epoch/solution-delivery, and pinned to the real W036
 * types by compile-time kernel parity (src/kernel-parity.ts) plus
 * runtime parity tests (devDependencies only). The principal grammar is
 * MIRRORED from @epoch/event-log and pinned by runtime parity tests.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ATTRIBUTION_ID_PATTERN,
  COMPARISON_ID_PATTERN,
  COMPARED_LINE_ID_PATTERNS,
  VARIANCE_ID_PATTERN,
  VARIANCE_PRINCIPAL_ID_PATTERN,
  type ComparedLineKind,
} from './version';

// --------------------------------------------------------------------------------
// Neutral primitives.
// --------------------------------------------------------------------------------

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 content digest as lowercase hex (the exact-revision address form). */
export const Sha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Hex',
    title: 'Sha256Hex',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** SHA-256 digest string type. */
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/** Canonical non-negative decimal amount as a string (the fixed-point discipline). */
export const NonNegativeDecimalSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a canonical non-negative decimal string')
  .meta({
    id: 'NonNegativeDecimal',
    title: 'NonNegativeDecimal',
    description:
      'Non-negative decimal amount as a canonical string (digest-safe, no exponent form — the fixed-point discipline).',
  });

/** One non-negative decimal amount. */
export type NonNegativeDecimal = z.infer<typeof NonNegativeDecimalSchema>;

/** Acting principal grammar — MIRRORED from the W009/W010 identity grammar. */
export const PrincipalIdSchema = z
  .string()
  .regex(VARIANCE_PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description: 'Opaque acting principal: "principal:" followed by a lowercase slug (the W009 identity grammar).',
  });

/** One principal id. */
export type PrincipalId = z.infer<typeof PrincipalIdSchema>;

/** Tenant identity (the W009 tenancy grammar, composed at runtime). */
export { TenantIdSchema };
export type { TenantId } from '@epoch/tenancy';

/** Timestamp (the agent-protocol canonical UTC grammar, composed at runtime). */
export { TimestampSchema };
export type { Timestamp } from '@epoch/agent-protocol';

// --------------------------------------------------------------------------------
// The measure-value space (structural mirror of the W036 Measure grammar).
// --------------------------------------------------------------------------------

/** A quantity measure value: canonical decimal value plus a unit label. */
export const QuantityMeasureSchema = z
  .strictObject({
    kind: z.literal('quantity'),
    value: NonNegativeDecimalSchema,
    unit: z.string().min(1).max(32),
  })
  .readonly()
  .meta({
    id: 'QuantityMeasure',
    title: 'QuantityMeasure',
    description:
      'A quantity measure value: canonical decimal value plus a unit-of-measure label (the W036 measure grammar).',
  });

/** One quantity measure value. */
export type QuantityMeasure = z.infer<typeof QuantityMeasureSchema>;

/** A cost measure value: canonical decimal amount plus an ISO 4217 currency. */
export const CostMeasureSchema = z
  .strictObject({
    kind: z.literal('cost'),
    amount: NonNegativeDecimalSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .readonly()
  .meta({
    id: 'CostMeasure',
    title: 'CostMeasure',
    description:
      'A cost measure value: canonical decimal amount plus an ISO 4217 currency code (the W036 measure grammar).',
  });

/** One cost measure value. */
export type CostMeasure = z.infer<typeof CostMeasureSchema>;

/** An instant measure value: a point in time. */
export const InstantMeasureSchema = z
  .strictObject({
    kind: z.literal('instant'),
    at: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'InstantMeasure',
    title: 'InstantMeasure',
    description: 'An instant measure value: a point in time in the canonical UTC form (the W036 measure grammar).',
  });

/** One instant measure value. */
export type InstantMeasure = z.infer<typeof InstantMeasureSchema>;

/** A progress measure value: a 0..1 completion fraction. */
export const ProgressMeasureSchema = z
  .strictObject({
    kind: z.literal('progress'),
    fraction: z.number().min(0).max(1),
  })
  .readonly()
  .meta({
    id: 'ProgressMeasure',
    title: 'ProgressMeasure',
    description: 'A progress measure value: a completion fraction between 0 and 1 (the W036 measure grammar).',
  });

/** One progress measure value. */
export type ProgressMeasure = z.infer<typeof ProgressMeasureSchema>;

/** One measure value (the W036 measure grammar mirror). */
export const MeasureValueSchema = z
  .discriminatedUnion('kind', [
    QuantityMeasureSchema,
    CostMeasureSchema,
    InstantMeasureSchema,
    ProgressMeasureSchema,
  ])
  .meta({
    id: 'MeasureValue',
    title: 'MeasureValue',
    description:
      'One measure value: quantity (value+unit), cost (amount+currency), instant, or progress (0..1 fraction) — the W036 measure grammar, mirrored for the opaque-reference variance fold.',
  });

/** One measure value. */
export type MeasureValue = z.infer<typeof MeasureValueSchema>;

// --------------------------------------------------------------------------------
// Opaque exact-revision compared-line references.
// --------------------------------------------------------------------------------

function comparedLineRefSchema<K extends ComparedLineKind>(kind: K) {
  return z
    .strictObject({
      kind: z.literal(kind),
      recordId: z.string().regex(COMPARED_LINE_ID_PATTERNS[kind]),
      contentDigest: Sha256HexSchema,
    })
    .readonly();
}

/**
 * One compared-line reference: an OPAQUE exact-revision reference to a
 * lifecycle-first W036 record (prediction/baseline/commitment/forecast
 * on the baseline side; actual on the actual side) — the W037
 * commitment-reference discipline (kind-prefixed record id + content
 * digest, never an embedded copy).
 */
export const ComparedLineRefSchema = z
  .discriminatedUnion('kind', [
    comparedLineRefSchema('prediction'),
    comparedLineRefSchema('baseline'),
    comparedLineRefSchema('commitment'),
    comparedLineRefSchema('forecast'),
    comparedLineRefSchema('actual'),
  ] as const)
  .meta({
    id: 'ComparedLineRef',
    title: 'ComparedLineRef',
    description:
      'One compared-line reference: a lifecycle-first distinction kind, its kind-prefixed W036 record id, and the exact content digest of that revision (opaque; never an embedded copy).',
  });

/** One compared-line reference. */
export type ComparedLineRef = z.infer<typeof ComparedLineRefSchema>;

// --------------------------------------------------------------------------------
// Record identities.
// --------------------------------------------------------------------------------

/** Variance-record identity: `variance:<slug>`. */
export const VarianceIdSchema = z
  .string()
  .regex(VARIANCE_ID_PATTERN, 'must be a variance id of the form "variance:<slug>"')
  .meta({
    id: 'VarianceId',
    title: 'VarianceId',
    description: 'Opaque variance-record identity: "variance:" followed by a lowercase slug.',
  });

/** One variance record id. */
export type VarianceId = z.infer<typeof VarianceIdSchema>;

/** Attribution-record identity: `attribution:<slug>`. */
export const AttributionIdSchema = z
  .string()
  .regex(ATTRIBUTION_ID_PATTERN, 'must be an attribution id of the form "attribution:<slug>"')
  .meta({
    id: 'AttributionId',
    title: 'AttributionId',
    description: 'Opaque attribution-record identity: "attribution:" followed by a lowercase slug.',
  });

/** One attribution record id. */
export type AttributionId = z.infer<typeof AttributionIdSchema>;

/** Prediction-comparison identity: `comparison:<slug>`. */
export const ComparisonIdSchema = z
  .string()
  .regex(COMPARISON_ID_PATTERN, 'must be a comparison id of the form "comparison:<slug>"')
  .meta({
    id: 'ComparisonId',
    title: 'ComparisonId',
    description: 'Opaque prediction-comparison identity: "comparison:" followed by a lowercase slug.',
  });

/** One prediction-comparison id. */
export type ComparisonId = z.infer<typeof ComparisonIdSchema>;

/** One exact-revision variance-record reference. */
export const VarianceRecordRefSchema = z
  .strictObject({
    recordId: VarianceIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'VarianceRecordRef',
    title: 'VarianceRecordRef',
    description:
      'One exact-revision variance-record reference: the record id plus its content digest (the attribution binding grammar).',
  });

/** One variance-record reference. */
export type VarianceRecordRef = z.infer<typeof VarianceRecordRefSchema>;
