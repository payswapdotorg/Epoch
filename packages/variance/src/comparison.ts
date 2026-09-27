/**
 * IMMUTABLE HISTORICAL PREDICTION COMPARISON (the W039 pin): comparing
 * forecast revisions, or a forecast to the eventual actual, produces a
 * TYPED comparison record; modifying or replacing a historical
 * prediction comparison is a typed `history-immutable` rejection.
 *
 * - `computePredictionComparison` is the DETERMINISTIC total
 *   computation: the deviation magnitude is the exact fold of the two
 *   measure values (milliseconds for instants); the direction records
 *   whether the LATER side (the refinement, or the actual) exceeded the
 *   EARLIER side (the original forecast); the band compares the
 *   deviation against the caller-supplied tolerance (exact /
 *   within-tolerance / outside-tolerance). Identical inputs derive
 *   identical digests.
 * - The COMPARISON HISTORY is append-only and immutable: the same
 *   comparison id with different content is a typed `history-immutable`
 *   (not a mere version conflict — history is never modified); a
 *   different comparison for the SAME compared pair is a typed
 *   `history-immutable` (the historical verdict of a pair is fixed;
 *   comparison against new actuals ships as a NEW pair — never a
 *   rewrite of the historical prediction).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ComparisonIdSchema,
  MeasureValueSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TimestampSchema,
} from './primitives';
import {
  COMPARISON_BANDS,
  COMPARISON_KINDS,
  PREDICTION_COMPARISON_SCHEMA_NAME,
  VARIANCE_RECORD_VERSION,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import { compareNonNegativeDecimals, decimalFromFraction, subtractNonNegativeDecimals } from './decimal';
import type { VarianceResult } from './errors';
import { VarianceConfidenceSchema } from './variance';

// --------------------------------------------------------------------------------
// The prediction-comparison record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one prediction comparison: the compared pair
 * (an earlier forecast revision vs the later refinement, or a past
 * forecast vs the eventual actual) as opaque exact-revision references,
 * both measure values, the deviation magnitude + direction + band, and
 * the comparison provenance.
 */
const predictionComparisonShape = z.strictObject({
  schema: z.literal(PREDICTION_COMPARISON_SCHEMA_NAME),
  schemaVersion: z.literal(VARIANCE_RECORD_VERSION),
  comparisonId: ComparisonIdSchema,
  tenantId: TenantIdSchema,
  solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
  subjectKind: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(256),
  comparisonKind: z.enum(COMPARISON_KINDS),
  fromRef: z
    .strictObject({
      kind: z.literal('forecast'),
      recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
      contentDigest: Sha256HexSchema,
    })
    .readonly(),
  toRef: z
    .discriminatedUnion('kind', [
      z
        .strictObject({
          kind: z.literal('forecast'),
          recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
          contentDigest: Sha256HexSchema,
        })
        .readonly(),
      z
        .strictObject({
          kind: z.literal('actual'),
          recordId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
          contentDigest: Sha256HexSchema,
        })
        .readonly(),
    ]),
  fromMeasure: MeasureValueSchema,
  toMeasure: MeasureValueSchema,
  deviation: NonNegativeDecimalSchema,
  /** Whether the later side (to) exceeded the earlier side (from). */
  direction: z.enum(['exceeded', 'fell-short', 'exact']),
  band: z.enum(COMPARISON_BANDS),
  confidence: VarianceConfidenceSchema,
  comparedAt: TimestampSchema,
  comparedBy: PrincipalIdSchema,
});

export const PredictionComparisonContentSchema = predictionComparisonShape
  .readonly()
  .superRefine((comparison, ctx) => {
    if (comparison.comparisonKind === 'forecast-revision' && comparison.toRef.kind !== 'forecast') {
      ctx.addIssue({
        code: 'custom',
        message: 'a forecast-revision comparison compares two forecasts (the refinement chain)',
        path: ['toRef'],
      });
    }
    if (comparison.comparisonKind === 'forecast-to-actual' && comparison.toRef.kind !== 'actual') {
      ctx.addIssue({
        code: 'custom',
        message: 'a forecast-to-actual comparison compares a forecast to an eventual actual',
        path: ['toRef'],
      });
    }
    if (comparison.fromRef.recordId === comparison.toRef.recordId) {
      ctx.addIssue({
        code: 'custom',
        message: 'a comparison compares two distinct records',
        path: ['toRef'],
      });
    }
    if (comparison.fromMeasure.kind !== comparison.toMeasure.kind) {
      ctx.addIssue({
        code: 'custom',
        message: 'the compared measures of one prediction comparison share one measure kind',
        path: ['toMeasure'],
      });
    }
  })
  .meta({
    id: 'PredictionComparisonContent',
    title: 'PredictionComparisonContent',
    description:
      'The immutable content of one prediction comparison: the compared pair (forecast revision vs refinement, or forecast vs eventual actual) as opaque exact-revision references, both measure values, the deviation magnitude + direction + band, and the comparison provenance.',
  });

/** One prediction-comparison content. */
export type PredictionComparisonContent = z.infer<typeof PredictionComparisonContentSchema>;

/** The SEALED prediction comparison: content plus its SHA-256 content digest. */
export const SealedPredictionComparisonSchema = z
  .strictObject({
    ...predictionComparisonShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedPredictionComparison',
    title: 'SealedPredictionComparison',
    description:
      'The sealed prediction comparison: immutable content plus its SHA-256 content digest (exact-revision addressing of the immutable comparison history).',
  });

/** One sealed prediction comparison. */
export type SealedPredictionComparison = z.infer<typeof SealedPredictionComparisonSchema>;

/** Compute the content digest of a prediction-comparison content (canonical JSON). */
export function computePredictionComparisonDigest(
  content: PredictionComparisonContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid prediction-comparison content into its published record. */
export function sealPredictionComparison(
  content: unknown,
): VarianceResult<SealedPredictionComparison> {
  const parsed = PredictionComparisonContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed prediction comparison (schema + digest recomputation). */
export function verifySealedPredictionComparison(
  sealed: unknown,
): VarianceResult<SealedPredictionComparison> {
  const parsed = SealedPredictionComparisonSchema.safeParse(sealed);
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
          'sealed prediction comparison digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The deterministic computation.
// --------------------------------------------------------------------------------

/** The input of one prediction-comparison computation. */
export interface ComputeComparisonInput {
  readonly comparisonId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly comparisonKind: 'forecast-revision' | 'forecast-to-actual';
  /** The earlier side: always a forecast record. */
  readonly fromRef: { kind: 'forecast'; recordId: string; contentDigest: string };
  /** The later side: the refinement forecast, or the eventual actual. */
  readonly toRef:
    | { kind: 'forecast'; recordId: string; contentDigest: string }
    | { kind: 'actual'; recordId: string; contentDigest: string };
  readonly fromMeasure: unknown;
  readonly toMeasure: unknown;
  /** The tolerance decimal of the within-tolerance band (mandatory). */
  readonly tolerance: string;
  readonly confidence: unknown;
  readonly comparedAt: string;
  readonly comparedBy: string;
}

/** The measure value string of one side (the exact decimal fold basis). */
function measureValueOf(measure: { kind: string; value?: string; amount?: string; fraction?: number; at?: string }): string {
  switch (measure.kind) {
    case 'quantity':
      return measure.value!;
    case 'cost':
      return measure.amount!;
    case 'progress':
      return decimalFromFraction(measure.fraction!);
    case 'instant':
      return String(Date.parse(measure.at!));
    default:
      return '';
  }
}

/**
 * Compute one prediction comparison — the DETERMINISTIC total function:
 *
 * - the compared measures must share one measure kind (and unit or
 *   currency where applicable);
 * - the DEVIATION is the exact fold |to - from| (milliseconds for
 *   instants);
 * - the DIRECTION records whether the later side exceeded, fell short
 *   of, or exactly matched the earlier side;
 * - the BAND compares the deviation against the caller-supplied
 *   tolerance: 0 -> `exact`, <= tolerance -> `within-tolerance`, else
 *   `outside-tolerance`;
 * - the result is the SEALED comparison record; identical inputs derive
 *   identical digests.
 */
export function computePredictionComparison(
  input: ComputeComparisonInput,
): VarianceResult<SealedPredictionComparison> {
  const from = MeasureValueSchema.safeParse(input.fromMeasure);
  if (!from.success) {
    return { ok: false, error: validationError(from.error) };
  }
  const to = MeasureValueSchema.safeParse(input.toMeasure);
  if (!to.success) {
    return { ok: false, error: validationError(to.error) };
  }
  if (from.data.kind !== to.data.kind) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the earlier measure is a ${from.data.kind} but the later measure is a ${to.data.kind} — one comparison folds one measure kind`,
        baselineKind: from.data.kind,
        actualKind: to.data.kind,
        subject: input.comparisonId,
      },
    };
  }
  if (from.data.kind === 'quantity' && to.data.kind === 'quantity' && from.data.unit !== to.data.unit) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the earlier measure unit is "${from.data.unit}" but the later measure carries "${to.data.unit}" — one comparison folds one unit`,
        baselineKind: `quantity:${from.data.unit}`,
        actualKind: `quantity:${to.data.unit}`,
        subject: input.comparisonId,
      },
    };
  }
  if (from.data.kind === 'cost' && to.data.kind === 'cost' && from.data.currency !== to.data.currency) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the earlier measure currency is "${from.data.currency}" but the later measure carries "${to.data.currency}" — one comparison folds one currency`,
        baselineKind: `cost:${from.data.currency}`,
        actualKind: `cost:${to.data.currency}`,
        subject: input.comparisonId,
      },
    };
  }
  const tolerance = NonNegativeDecimalSchema.safeParse(input.tolerance);
  if (!tolerance.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the comparison tolerance must be a canonical non-negative decimal string',
        issues: [{ path: 'tolerance', message: 'invalid canonical decimal' }],
      },
    };
  }
  const fromValue = measureValueOf(from.data);
  const toValue = measureValueOf(to.data);
  const difference = subtractNonNegativeDecimals(toValue, fromValue);
  const deviation = difference.magnitude;
  const direction = compareNonNegativeDecimals(deviation, '0') === 0 ? 'exact' : difference.negative ? 'fell-short' : 'exceeded';
  const band =
    compareNonNegativeDecimals(deviation, '0') === 0
      ? 'exact'
      : compareNonNegativeDecimals(deviation, tolerance.data) <= 0
        ? 'within-tolerance'
        : 'outside-tolerance';
  const content = {
    schema: PREDICTION_COMPARISON_SCHEMA_NAME,
    schemaVersion: VARIANCE_RECORD_VERSION,
    comparisonId: input.comparisonId,
    tenantId: input.tenantId,
    solutionId: input.solutionId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    comparisonKind: input.comparisonKind,
    fromRef: input.fromRef,
    toRef: input.toRef,
    fromMeasure: from.data,
    toMeasure: to.data,
    deviation,
    direction,
    band,
    confidence: input.confidence,
    comparedAt: input.comparedAt,
    comparedBy: input.comparedBy,
  };
  return sealPredictionComparison(content);
}

// --------------------------------------------------------------------------------
// The immutable comparison history (append-only, never replaced).
// --------------------------------------------------------------------------------

/** The state of one comparison history after admissions. */
export interface ComparisonHistory {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly comparisons: readonly SealedPredictionComparison[];
}

/** An empty comparison history for one (tenant, solution) scope. */
export function openComparisonHistory(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
}): ComparisonHistory {
  return { tenantId: scope.tenantId, solutionId: scope.solutionId, comparisons: [] };
}

/**
 * Admit a sealed prediction comparison into the history (append-only,
 * IMMUTABLE):
 *
 * - the comparison verifies (tamper detection);
 * - the tenant/solution scope must match;
 * - the same comparison id with different content is a typed
 *   `history-immutable` — a recorded historical comparison is never
 *   modified or replaced;
 * - a different comparison for the SAME (from, to) compared pair is a
 *   typed `history-immutable` — the historical verdict of a pair is
 *   fixed forever; comparison against new actuals ships as a NEW pair;
 * - exact re-admission is idempotent.
 */
export function admitPredictionComparison(
  history: ComparisonHistory,
  comparison: unknown,
): VarianceResult<ComparisonHistory> {
  const verified = verifySealedPredictionComparison(comparison);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== history.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `comparison "${admitted.comparisonId}" belongs to tenant "${admitted.tenantId}" but the history is scoped to "${history.tenantId}" (R12)`,
        expectedTenantId: history.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.comparisonId,
      },
    };
  }
  if (admitted.solutionId !== history.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `comparison "${admitted.comparisonId}" subjects solution "${admitted.solutionId}" but the history is scoped to "${history.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'comparison/history solution mismatch' }],
      },
    };
  }
  const existingById = history.comparisons.find(
    (candidate) => candidate.comparisonId === admitted.comparisonId,
  );
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: history };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `comparison "${admitted.comparisonId}" is already recorded with different content — the historical comparison record is immutable; changed content ships as a NEW comparison id`,
        subject: 'prediction-comparison',
        subjectId: admitted.comparisonId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const existingPair = history.comparisons.find(
    (candidate) =>
      candidate.fromRef.recordId === admitted.fromRef.recordId &&
      candidate.toRef.recordId === admitted.toRef.recordId,
  );
  if (existingPair !== undefined) {
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `the (${admitted.fromRef.recordId}, ${admitted.toRef.recordId}) pair is already judged by comparison "${existingPair.comparisonId}" — the historical verdict of a compared pair is immutable; comparison against new actuals ships as a NEW pair, never a rewrite of the historical prediction`,
        subject: 'prediction-comparison-pair',
        subjectId: `${admitted.fromRef.recordId}->${admitted.toRef.recordId}`,
        publishedDigest: existingPair.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...history, comparisons: [...history.comparisons, admitted] } };
}

/** The history fold: comparisons sorted by comparisonId (deterministic). */
export function foldPredictionComparisons(
  history: ComparisonHistory,
): readonly SealedPredictionComparison[] {
  return [...history.comparisons].sort((a, b) => (a.comparisonId < b.comparisonId ? -1 : 1));
}
