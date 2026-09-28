/**
 * ERROR AND VARIANCE FEATURES (the W040 pin): typed per-row feature
 * vectors derived from the W039 variance vocabularies — magnitude (the
 * exact deviation), direction (via the class polarity table), magnitude
 * band (via caller-supplied band thresholds, never implicit defaults),
 * variance class, and the attribution cause kind (plus the evidence
 * count). Every derivation is DETERMINISTIC over closed vocabularies;
 * identical inputs derive identical features.
 *
 * The magnitude-band thresholds mirror the W039 variance-kernel
 * `BandThresholds` grammar (minor <= material <= severe canonical
 * decimals — kernel parity with @epoch/variance, a devDependency).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  ERROR_VARIANCE_FEATURES_SCHEMA_NAME,
  LEARNING_ATTRIBUTION_FEATURE_KINDS,
  LEARNING_CALIBRATION_RECORD_VERSION,
  LEARNING_FORECAST_BIAS_DIRECTIONS,
  LEARNING_VARIANCE_CLASS_POLARITY,
  LEARNING_VARIANCE_CLASSES,
  LEARNING_VARIANCE_DIRECTIONS,
  LEARNING_VARIANCE_MAGNITUDE_BANDS,
  ATTRIBUTION_UNATTRIBUTED,
  type LearningForecastBiasDirection,
  type LearningVarianceClass,
  type LearningVarianceDirection,
  type LearningVarianceMagnitudeBand,
} from './version';
import { NonNegativeDecimalSchema } from './primitives';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import { compareNonNegativeDecimals } from './decimal';
import type { LearningResult } from './errors';
import type { VarianceEvidence } from './references';

// --------------------------------------------------------------------------------
// The band thresholds (the W039 variance grammar, mirrored).
// --------------------------------------------------------------------------------

/**
 * The magnitude-band thresholds of dataset assembly — MIRRORED from
 * @epoch/variance's `BandThresholds`: minor <= material <= severe
 * canonical decimals (caller-supplied in the assembly policy; never
 * implicit defaults). Kernel parity with @epoch/variance is pinned by
 * compile-time and runtime tests.
 */
export const LearningBandThresholdsSchema = z
  .strictObject({
    minor: NonNegativeDecimalSchema,
    material: NonNegativeDecimalSchema,
    severe: NonNegativeDecimalSchema,
  })
  .readonly()
  .superRefine((thresholds, ctx) => {
    if (
      compareNonNegativeDecimals(thresholds.minor, thresholds.material) > 0 ||
      compareNonNegativeDecimals(thresholds.material, thresholds.severe) > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'band thresholds must ascend: minor <= material <= severe',
        path: ['material'],
      });
    }
  })
  .meta({
    id: 'LearningBandThresholds',
    title: 'LearningBandThresholds',
    description:
      'The magnitude-band thresholds of dataset assembly: minor <= material <= severe canonical decimals (caller-supplied; never implicit defaults) — the W039 variance grammar, mirrored.',
  });

/** One band-thresholds record (the W039 grammar, mirrored). */
export type LearningBandThresholds = z.infer<typeof LearningBandThresholdsSchema>;

// --------------------------------------------------------------------------------
// The feature record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one error/variance feature record — the
 * typed per-row feature vector: the exact deviation magnitude, the
 * forecast-bias direction (the W039 grammar), the variance class, the
 * derived variance direction (favorable/adverse/neutral via the class
 * polarity table), the derived magnitude band (immaterial/minor/
 * material/severe via the caller-supplied thresholds), and the
 * attribution cause kind plus its evidence count (`unattributed` when
 * the comparison carries no root-cause attribution).
 */
const featureRecordShape = z.strictObject({
  schema: z.literal(ERROR_VARIANCE_FEATURES_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  deviationMagnitude: NonNegativeDecimalSchema,
  bias: z.enum(LEARNING_FORECAST_BIAS_DIRECTIONS),
  varianceClass: z.enum(LEARNING_VARIANCE_CLASSES),
  direction: z.enum(LEARNING_VARIANCE_DIRECTIONS),
  magnitudeBand: z.enum(LEARNING_VARIANCE_MAGNITUDE_BANDS),
  attributionCauseKind: z.enum(LEARNING_ATTRIBUTION_FEATURE_KINDS),
  attributionEvidenceCount: z.number().int().min(0).max(64),
});

export const ErrorVarianceFeaturesSchema = featureRecordShape
  .readonly()
  .superRefine((features, ctx) => {
    if (features.attributionCauseKind === ATTRIBUTION_UNATTRIBUTED && features.attributionEvidenceCount !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'an unattributed feature carries no attribution evidence',
        path: ['attributionEvidenceCount'],
      });
    }
  })
  .meta({
    id: 'ErrorVarianceFeatures',
    title: 'ErrorVarianceFeatures',
    description:
      'The immutable content of one error/variance feature record: deviation magnitude, forecast-bias direction, variance class, derived direction, derived magnitude band, and the attribution cause kind with its evidence count.',
  });

/** One error/variance feature record content. */
export type ErrorVarianceFeatures = z.infer<typeof ErrorVarianceFeaturesSchema>;

/** Compute the content digest of a feature record (canonical JSON). */
export function computeErrorVarianceFeaturesDigest(content: ErrorVarianceFeatures): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

// --------------------------------------------------------------------------------
// The deterministic derivations (closed vocabularies, zero float math).
// --------------------------------------------------------------------------------

/**
 * DERIVE the magnitude band of one deviation under the caller-supplied
 * thresholds (deterministic): zero deviation is `immaterial`; a
 * deviation at or below the minor threshold is `minor`; at or below
 * the material threshold is `material`; anything above is `severe`.
 */
export function deriveMagnitudeBand(
  deviation: string,
  thresholds: LearningBandThresholds,
): LearningVarianceMagnitudeBand {
  if (compareNonNegativeDecimals(deviation, '0') === 0) {
    return 'immaterial';
  }
  if (compareNonNegativeDecimals(deviation, thresholds.minor) <= 0) {
    return 'minor';
  }
  if (compareNonNegativeDecimals(deviation, thresholds.material) <= 0) {
    return 'material';
  }
  return 'severe';
}

/**
 * DERIVE the variance direction of one deviation from its class and
 * forecast-bias direction (deterministic under the class polarity
 * table — the W039 mirror):
 * - `higher-is-favorable` classes: the actual exceeding the forecast
 *   (`under-forecast` bias) is FAVORABLE; the forecast overshooting
 *   (`over-forecast`) is ADVERSE;
 * - `lower-is-favorable` classes: the mirror image;
 * - `direction-neutral` classes (change): always NEUTRAL;
 * - an exact comparison is always NEUTRAL.
 */
export function deriveDirection(
  varianceClass: LearningVarianceClass,
  bias: LearningForecastBiasDirection,
): LearningVarianceDirection {
  if (bias === 'exact') {
    return 'neutral';
  }
  const polarity = LEARNING_VARIANCE_CLASS_POLARITY[varianceClass];
  if (polarity === 'direction-neutral') {
    return 'neutral';
  }
  if (polarity === 'higher-is-favorable') {
    return bias === 'under-forecast' ? 'favorable' : 'adverse';
  }
  return bias === 'over-forecast' ? 'favorable' : 'adverse';
}

/**
 * DERIVE the complete error/variance feature record of one comparison
 * (deterministic fold over the fact's deviation/bias and the variance
 * evidence): the direction and band derivations above plus the
 * attribution cause kind (the evidence-grounded cause when present,
 * `unattributed` otherwise).
 */
export function deriveErrorVarianceFeatures(
  deviation: string,
  bias: LearningForecastBiasDirection,
  thresholds: LearningBandThresholds,
  varianceEvidence: VarianceEvidence,
): LearningResult<ErrorVarianceFeatures> {
  // The caller-supplied thresholds VALIDATE first (ascending minor <=
  // material <= severe — never implicit, never silently accepted
  // out-of-order thresholds).
  const validatedThresholds = LearningBandThresholdsSchema.safeParse(thresholds);
  if (!validatedThresholds.success) {
    return { ok: false, error: validationError(validatedThresholds.error) };
  }
  const content: ErrorVarianceFeatures = {
    schema: ERROR_VARIANCE_FEATURES_SCHEMA_NAME,
    schemaVersion: LEARNING_CALIBRATION_RECORD_VERSION,
    deviationMagnitude: deviation,
    bias,
    varianceClass: varianceEvidence.varianceClass,
    direction: deriveDirection(varianceEvidence.varianceClass, bias),
    magnitudeBand: deriveMagnitudeBand(deviation, thresholds),
    attributionCauseKind: varianceEvidence.attribution !== null
      ? varianceEvidence.attribution.cause.causeKind
      : ATTRIBUTION_UNATTRIBUTED,
    attributionEvidenceCount: varianceEvidence.attribution !== null
      ? varianceEvidence.attribution.evidence.length
      : 0,
  };
  const parsed = ErrorVarianceFeaturesSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Verify feature-record content (schema validation; the record is content-addressed inside its row). */
export function verifyErrorVarianceFeatures(content: unknown): LearningResult<ErrorVarianceFeatures> {
  const parsed = ErrorVarianceFeaturesSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
