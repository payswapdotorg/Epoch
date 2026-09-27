/**
 * CONFIDENCE/CALIBRATION STATE (the W039 pin): typed confidence carried
 * on every forecast + actualization; CALIBRATION is a pure comparison of
 * past forecast revisions against actualized outcomes.
 *
 * - A COMPARISON FACT is the admitted, immutable history this kernel
 *   folds: one past forecast (exact revision) versus one actualized
 *   outcome (exact revision), carrying both measures, the deviation
 *   magnitude, and the forecast-bias direction. Facts are produced by
 *   the variance kernel's prediction-comparison records (W039 variance)
 *   or supplied directly; here they are OPAQUE typed inputs (record
 *   reference + values) — NO runtime edge to the variance kernel (the
 *   opaque-reference discipline).
 * - History is IMMUTABLE: the same comparison-fact id with different
 *   content is a typed `history-immutable`; a different fact for the
 *   SAME (forecast, actual) pair is a typed `history-immutable` — the
 *   historical verdict is fixed forever (re-comparison after new
 *   actuals ships as a comparison against the NEW revision, never a
 *   rewrite).
 * - The CALIBRATION STATE is the deterministic fold over the admitted
 *   comparison facts of one (subject, measure) group: counts by bias
 *   direction, the exact total absolute deviation, the worst deviation
 *   with its comparison reference, and the derived confidence. Sealed
 *   and content-addressed; identical facts derive identical states.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  DistinctionSubjectSchema,
  MeasureSchema,
  SolutionIdSchema,
  TenantIdSchema,
  type Measure,
} from '@epoch/solution-delivery';
import {
  CalibrationIdSchema,
  ComparisonFactIdSchema,
  TimestampSchema,
} from './primitives';
import {
  ACTUALIZATION_RECORD_VERSION,
  CALIBRATION_STATE_SCHEMA_NAME,
  FORECAST_BIAS_DIRECTIONS,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import { addNonNegativeDecimals, compareNonNegativeDecimals, decimalFromFraction, subtractNonNegativeDecimals } from './decimal';
import type { ActualizationResult } from './errors';

// --------------------------------------------------------------------------------
// Comparison facts (the immutable calibration history inputs).
// --------------------------------------------------------------------------------

/**
 * One exact-revision reference to a variance-kernel prediction-comparison
 * record (opaque: this kernel never imports the variance types).
 */
export const ComparisonRecordReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^comparison:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ComparisonRecordReference',
    title: 'ComparisonRecordReference',
    description:
      'One opaque exact-revision reference to a prediction-comparison record (the variance-kernel grammar): record id plus content digest.',
  });

/** One comparison-record reference. */
export type ComparisonRecordReference = z.infer<typeof ComparisonRecordReferenceSchema>;

/** One exact-revision reference to the compared forecast revision. */
export const ForecastSideReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ForecastSideReference',
    title: 'ForecastSideReference',
    description:
      'One exact-revision reference to the W036 Forecast-distinction record a comparison fact judged.',
  });

/** One forecast-side reference. */
export type ForecastSideReference = z.infer<typeof ForecastSideReferenceSchema>;

/** One exact-revision reference to the actualized outcome. */
export const ActualSideReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ActualSideReference',
    title: 'ActualSideReference',
    description:
      'One exact-revision reference to the W036 Actual-distinction record a comparison fact judged against.',
  });

/** One actual-side reference. */
export type ActualSideReference = z.infer<typeof ActualSideReferenceSchema>;

/**
 * The immutable content of one comparison fact: one past forecast versus
 * one actualized outcome, with both measures, the exact deviation
 * magnitude, and the forecast-bias direction.
 */
const comparisonFactShape = z.strictObject({
  schema: z.literal('epoch.actualization.comparison-fact'),
  schemaVersion: z.literal(ACTUALIZATION_RECORD_VERSION),
  factId: ComparisonFactIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  subject: DistinctionSubjectSchema,
  comparisonRef: ComparisonRecordReferenceSchema,
  forecastRef: ForecastSideReferenceSchema,
  actualRef: ActualSideReferenceSchema,
  forecastMeasure: MeasureSchema,
  actualMeasure: MeasureSchema,
  deviation: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
  bias: z.enum(FORECAST_BIAS_DIRECTIONS),
  observedAt: TimestampSchema,
});

export const COMPARISON_FACT_SCHEMA_NAME = 'epoch.actualization.comparison-fact' as const;

export const ComparisonFactContentSchema = comparisonFactShape
  .readonly()
  .superRefine((fact, ctx) => {
    if (fact.forecastMeasure.kind !== fact.actualMeasure.kind) {
      ctx.addIssue({
        code: 'custom',
        message: 'the forecast and actual measures of one comparison fact share one measure kind',
        path: ['actualMeasure'],
      });
    }
    if (fact.forecastMeasure.kind === 'quantity' && fact.actualMeasure.kind === 'quantity') {
      if (fact.forecastMeasure.unit !== fact.actualMeasure.unit) {
        ctx.addIssue({
          code: 'custom',
          message: 'the forecast and actual measures of one comparison fact share one unit',
          path: ['actualMeasure'],
        });
      }
    }
    if (fact.forecastMeasure.kind === 'cost' && fact.actualMeasure.kind === 'cost') {
      if (fact.forecastMeasure.currency !== fact.actualMeasure.currency) {
        ctx.addIssue({
          code: 'custom',
          message: 'the forecast and actual measures of one comparison fact share one currency',
          path: ['actualMeasure'],
        });
      }
    }
    if (fact.forecastRef.recordId === fact.actualRef.recordId) {
      ctx.addIssue({
        code: 'custom',
        message: 'a comparison fact compares two distinct records',
        path: ['actualRef'],
      });
    }
  })
  .meta({
    id: 'ComparisonFactContent',
    title: 'ComparisonFactContent',
    description:
      'The immutable content of one comparison fact: the comparison-record reference, the compared forecast and actual exact revisions with their measures, the exact deviation magnitude, and the forecast-bias direction.',
  });

/** One comparison-fact content. */
export type ComparisonFactContent = z.infer<typeof ComparisonFactContentSchema>;

/** The SEALED comparison fact: content plus its SHA-256 content digest. */
export const SealedComparisonFactSchema = z
  .strictObject({
    ...comparisonFactShape.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedComparisonFact',
    title: 'SealedComparisonFact',
    description:
      'The sealed comparison fact: immutable content plus its SHA-256 content digest (exact-revision addressing of the calibration history).',
  });

/** One sealed comparison fact. */
export type SealedComparisonFact = z.infer<typeof SealedComparisonFactSchema>;

/** Compute the content digest of a comparison-fact content (canonical JSON). */
export function computeComparisonFactDigest(content: ComparisonFactContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid comparison-fact content into its published record. */
export function sealComparisonFact(
  content: unknown,
): ActualizationResult<SealedComparisonFact> {
  const parsed = ComparisonFactContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed comparison fact (schema + digest recomputation). */
export function verifySealedComparisonFact(
  sealed: unknown,
): ActualizationResult<SealedComparisonFact> {
  const parsed = SealedComparisonFactSchema.safeParse(sealed);
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
          'sealed comparison fact digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The calibration-state fold.
// --------------------------------------------------------------------------------

/** The derived confidence of one calibration state (the fold output). */
export const CalibrationConfidenceSchema = z
  .strictObject({
    method: z.enum(['stated', 'measured', 'estimated', 'derived', 'imported']),
    value: z.number().min(0).max(1),
    rationale: z.string().min(1).max(2048),
  })
  .readonly()
  .meta({
    id: 'CalibrationConfidence',
    title: 'CalibrationConfidence',
    description:
      'The derived confidence of one calibration fold: method "derived", the exact-fraction value, and the deterministic rationale.',
  });

/** One calibration confidence. */
export type CalibrationConfidence = z.infer<typeof CalibrationConfidenceSchema>;

/**
 * The immutable content of one calibration state: the deterministic fold
 * over the comparison facts of one (subject, measure) group — counts by
 * bias direction, the exact total absolute deviation, the worst
 * deviation with its comparison reference, and the derived confidence.
 */
const calibrationStateShape = z.strictObject({
  schema: z.literal(CALIBRATION_STATE_SCHEMA_NAME),
  schemaVersion: z.literal(ACTUALIZATION_RECORD_VERSION),
  calibrationId: CalibrationIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  subject: DistinctionSubjectSchema,
  measureKind: z.enum(['quantity', 'cost', 'progress', 'instant']),
  unit: z.string().min(1).max(32).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  comparisonRefs: z.array(ComparisonRecordReferenceSchema).max(4096),
  comparisonCount: z.number().int().min(0).max(4096),
  overCount: z.number().int().min(0).max(4096),
  underCount: z.number().int().min(0).max(4096),
  exactCount: z.number().int().min(0).max(4096),
  totalAbsoluteDeviation: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
  worstDeviation: z
    .strictObject({
      comparisonRef: ComparisonRecordReferenceSchema,
      deviation: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    })
    .readonly()
    .nullable(),
  confidence: CalibrationConfidenceSchema,
});

export const CalibrationStateContentSchema = calibrationStateShape
  .readonly()
  .superRefine((state, ctx) => {
    for (let i = 1; i < state.comparisonRefs.length; i += 1) {
      if (state.comparisonRefs[i]!.recordId < state.comparisonRefs[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'comparisonRefs must be sorted by recordId ascending (deterministic serialization)',
          path: ['comparisonRefs'],
        });
        break;
      }
      if (state.comparisonRefs[i]!.recordId === state.comparisonRefs[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'comparisonRefs must be duplicate-free by recordId',
          path: ['comparisonRefs'],
        });
        break;
      }
    }
    if (state.comparisonCount !== state.comparisonRefs.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'comparisonCount must equal comparisonRefs.length',
        path: ['comparisonCount'],
      });
    }
    if (state.overCount + state.underCount + state.exactCount !== state.comparisonCount) {
      ctx.addIssue({
        code: 'custom',
        message: 'the bias counts must sum to comparisonCount',
        path: ['overCount'],
      });
    }
    if (state.measureKind === 'quantity' && state.unit === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a quantity-calibrated state carries its unit',
        path: ['unit'],
      });
    }
    if (state.measureKind === 'cost' && state.currency === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a cost-calibrated state carries its currency',
        path: ['currency'],
      });
    }
  })
  .meta({
    id: 'CalibrationStateContent',
    title: 'CalibrationStateContent',
    description:
      'The immutable content of one calibration state: the deterministic fold over one comparison-fact group — bias counts, exact total absolute deviation, worst deviation, and the derived confidence.',
  });

/** One calibration-state content. */
export type CalibrationStateContent = z.infer<typeof CalibrationStateContentSchema>;

/** The SEALED calibration state: content plus its SHA-256 content digest. */
export const SealedCalibrationStateSchema = z
  .strictObject({
    ...calibrationStateShape.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedCalibrationState',
    title: 'SealedCalibrationState',
    description:
      'The sealed calibration state: immutable fold content plus its SHA-256 content digest (exact-revision addressing of the derived state).',
  });

/** One sealed calibration state. */
export type SealedCalibrationState = z.infer<typeof SealedCalibrationStateSchema>;

/** Compute the content digest of a calibration-state content (canonical JSON). */
export function computeCalibrationStateDigest(content: CalibrationStateContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid calibration-state content into its published record. */
export function sealCalibrationState(
  content: unknown,
): ActualizationResult<SealedCalibrationState> {
  const parsed = CalibrationStateContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed calibration state (schema + digest recomputation). */
export function verifySealedCalibrationState(
  sealed: unknown,
): ActualizationResult<SealedCalibrationState> {
  const parsed = SealedCalibrationStateSchema.safeParse(sealed);
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
          'sealed calibration state digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The measure value string of one side of a comparison (exact decimal). */
function measureValueOf(measure: Measure): string {
  switch (measure.kind) {
    case 'quantity':
      return measure.value;
    case 'cost':
      return measure.amount;
    case 'progress':
      return decimalFromFraction(measure.fraction);
    case 'instant':
      return String(Date.parse(measure.at));
  }
}

/**
 * Deterministically derive the calibration id of one group fold:
 * `calibration:<subject>-<measure-kind>-<digest-prefix>` over the sorted
 * comparison-reference set — identical fact sets derive identical ids
 * (replay idempotence).
 */
function deriveCalibrationId(
  subject: { readonly subjectKind: string; readonly subjectId: string },
  measureKind: string,
  refs: readonly ComparisonRecordReference[],
): string {
  const subjectSlug = `${subject.subjectKind}-${subject.subjectId}`
    .replace(/:/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const setDigest = canonicalDigest(
    refs.map((ref) => ({ recordId: ref.recordId, contentDigest: ref.contentDigest })) as unknown as JsonValue,
  );
  return `calibration:${subjectSlug}-${measureKind}-${setDigest.slice(0, 8)}`;
}

/**
 * Fold the CALIBRATION STATE of one (subject, measure) group from its
 * admitted comparison facts (the deterministic pure fold):
 *
 * - comparison refs sort by recordId; bias counts tally exactly;
 * - the total absolute deviation is the exact decimal SUM;
 * - the worst deviation is the maximum deviation with its comparison
 *   reference (deterministic: first by maximum deviation, then by
 *   recordId);
 * - the derived confidence value is the exact-hit fraction
 *   (exactCount / comparisonCount, 0 when empty);
 * - every fact must share the group's measure kind (and unit/currency
 *   where applicable) — mixed measure spaces are a typed `validation`
 *   rejection;
 * - every fact must verify (tamper detection) and match the supplied
 *   scope (tenant/solution).
 */
export function foldCalibration(
  scope: { readonly tenantId: string; readonly solutionId: string },
  subject: { readonly solutionId: string; readonly subjectKind: string; readonly subjectId: string },
  facts: readonly SealedComparisonFact[],
): ActualizationResult<SealedCalibrationState> {
  if (facts.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'a calibration fold requires at least one comparison fact',
        issues: [{ path: 'facts', message: 'empty comparison history' }],
      },
    };
  }
  const verifiedFacts: SealedComparisonFact[] = [];
  for (const fact of facts) {
    const verified = verifySealedComparisonFact(fact);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.tenantId !== scope.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `comparison fact "${verified.value.factId}" belongs to tenant "${verified.value.tenantId}" but the calibration scope is "${scope.tenantId}" (R12)`,
          expectedTenantId: scope.tenantId,
          encounteredTenantId: verified.value.tenantId,
          subject: verified.value.factId,
        },
      };
    }
    if (verified.value.solutionId !== scope.solutionId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${verified.value.factId}" subjects solution "${verified.value.solutionId}" but the calibration scope is "${scope.solutionId}"`,
          issues: [{ path: 'solutionId', message: 'fact/scope solution mismatch' }],
        },
      };
    }
    if (
      verified.value.subject.subjectKind !== subject.subjectKind ||
      verified.value.subject.subjectId !== subject.subjectId
    ) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${verified.value.factId}" subjects (${verified.value.subject.subjectKind}, ${verified.value.subject.subjectId}) but the calibration group is (${subject.subjectKind}, ${subject.subjectId})`,
          issues: [{ path: 'subject', message: 'fact/subject group mismatch' }],
        },
      };
    }
    verifiedFacts.push(verified.value);
  }
  const measureKind = verifiedFacts[0]!.forecastMeasure.kind;
  const unit =
    measureKind === 'quantity'
      ? (verifiedFacts[0]!.forecastMeasure as { readonly unit: string }).unit
      : undefined;
  const currency =
    measureKind === 'cost'
      ? (verifiedFacts[0]!.forecastMeasure as { readonly currency: string }).currency
      : undefined;
  for (const fact of verifiedFacts) {
    if (fact.forecastMeasure.kind !== measureKind) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${fact.factId}" folds a ${fact.forecastMeasure.kind} measure but the calibration group folds ${measureKind} — one calibration state folds one measure space`,
          issues: [{ path: 'forecastMeasure', message: 'mixed measure kinds in the calibration group' }],
        },
      };
    }
    if (measureKind === 'quantity' && fact.forecastMeasure.kind === 'quantity' && unit !== undefined && fact.forecastMeasure.unit !== unit) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${fact.factId}" carries unit "${fact.forecastMeasure.unit}" but the calibration group folds "${unit}"`,
          issues: [{ path: 'forecastMeasure.unit', message: 'mixed units in the calibration group' }],
        },
      };
    }
    if (measureKind === 'cost' && fact.forecastMeasure.kind === 'cost' && currency !== undefined && fact.forecastMeasure.currency !== currency) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${fact.factId}" carries currency "${fact.forecastMeasure.currency}" but the calibration group folds "${currency}"`,
          issues: [{ path: 'forecastMeasure.currency', message: 'mixed currencies in the calibration group' }],
        },
      };
    }
    // The deviation magnitude must equal the exact fold of the two
    // measures (the fact is honest history).
    const expectedDeviation = exactDeviation(fact.forecastMeasure, fact.actualMeasure);
    if (expectedDeviation !== fact.deviation) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${fact.factId}" claims deviation ${fact.deviation} but the exact fold of its measures derives ${expectedDeviation}`,
          issues: [{ path: 'deviation', message: 'deviation does not match the measure fold' }],
        },
      };
    }
    const expectedBias = biasOf(fact.forecastMeasure, fact.actualMeasure);
    if (expectedBias !== fact.bias) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison fact "${fact.factId}" claims bias "${fact.bias}" but its measures derive "${expectedBias}"`,
          issues: [{ path: 'bias', message: 'bias does not match the measure fold' }],
        },
      };
    }
  }

  const sorted = [...verifiedFacts].sort((a, b) => (a.factId < b.factId ? -1 : 1));
  const comparisonRefs = sorted.map((fact) => fact.comparisonRef);
  // Deduplicate by comparison record reference (one comparison record
  // grounds at most one fact per group).
  const seen = new Set<string>();
  for (const ref of comparisonRefs) {
    if (seen.has(ref.recordId)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `comparison record "${ref.recordId}" grounds more than one fact in the group — one comparison record grounds exactly one fact`,
          issues: [{ path: 'comparisonRef', message: 'duplicate comparison reference' }],
        },
      };
    }
    seen.add(ref.recordId);
  }
  let over = 0;
  let under = 0;
  let exact = 0;
  let totalDeviation = '0';
  let worst: { comparisonRef: ComparisonRecordReference; deviation: string } | null = null;
  for (const fact of sorted) {
    if (fact.bias === 'over-forecast') over += 1;
    else if (fact.bias === 'under-forecast') under += 1;
    else exact += 1;
    totalDeviation = addNonNegativeDecimals(totalDeviation, fact.deviation);
    if (
      worst === null ||
      compareNonNegativeDecimals(fact.deviation, worst.deviation) > 0 ||
      (compareNonNegativeDecimals(fact.deviation, worst.deviation) === 0 &&
        fact.comparisonRef.recordId < worst.comparisonRef.recordId)
    ) {
      worst = { comparisonRef: fact.comparisonRef, deviation: fact.deviation };
    }
  }
  const count = sorted.length;
  const content = {
    schema: CALIBRATION_STATE_SCHEMA_NAME,
    schemaVersion: ACTUALIZATION_RECORD_VERSION,
    calibrationId: deriveCalibrationId(subject, measureKind, comparisonRefs),
    tenantId: scope.tenantId,
    solutionId: scope.solutionId,
    subject: {
      solutionId: scope.solutionId,
      subjectKind: subject.subjectKind,
      subjectId: subject.subjectId,
    },
    measureKind,
    ...(unit !== undefined ? { unit } : {}),
    ...(currency !== undefined ? { currency } : {}),
    comparisonRefs,
    comparisonCount: count,
    overCount: over,
    underCount: under,
    exactCount: exact,
    totalAbsoluteDeviation: totalDeviation,
    worstDeviation: worst,
    confidence: {
      method: 'derived' as const,
      value: exact / count,
      rationale: `${exact}/${count} past comparisons of this group were exact (over ${over}, under ${under}); total absolute deviation ${totalDeviation}`,
    },
  };
  return sealCalibrationState(content);
}

/** The exact deviation magnitude of two measures (decimal fold). */
function exactDeviation(forecast: Measure, actual: Measure): string {
  return subtractNonNegativeDecimals(measureValueOf(forecast), measureValueOf(actual)).magnitude;
}

/** The bias direction of two measures (deterministic). */
function biasOf(forecast: Measure, actual: Measure): 'over-forecast' | 'under-forecast' | 'exact' {
  const comparison = compareNonNegativeDecimals(measureValueOf(forecast), measureValueOf(actual));
  if (comparison > 0) return 'over-forecast';
  if (comparison < 0) return 'under-forecast';
  return 'exact';
}
