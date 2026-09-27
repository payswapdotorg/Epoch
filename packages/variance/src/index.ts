/**
 * @epoch/variance — public API (kernel layer, Work Order W039).
 *
 * The EXPLAINABLE PREDICTED-VS-ACTUAL VARIANCE layer over opaque typed
 * references (USL1.0: prediction/baseline/commitment/actual/forecast
 * are lifecycle-first concepts; forecasts never overwrite historical
 * predictions, baselines or actuals):
 *
 * - THE FULL VARIANCE CLASS SET as TYPED sealed records: quantity,
 *   price/rate, productivity, schedule, waste, rework, change and
 *   external-condition — each comparing a baseline/commitment/forecast
 *   line to actualized values with MAGNITUDE + DIRECTION (+ band) under
 *   a closed zod vocabulary; the deterministic polarity table maps each
 *   class to its favorable direction;
 * - ROOT-CAUSE ATTRIBUTION WITH EVIDENCE: typed attribution records
 *   linking a variance to its cause (a change record, a W038 issue, an
 *   external condition) by W006-convention evidence references —
 *   attribution without evidence is a typed
 *   `attribution-evidence-required` rejection;
 * - IMMUTABLE HISTORICAL PREDICTION COMPARISON: comparing forecast
 *   revisions, or a forecast to the eventual actual, produces a typed
 *   sealed comparison record; modifying or replacing a recorded
 *   historical comparison (same id, different content — or a different
 *   comparison for the same pair) is a typed `history-immutable`
 *   rejection;
 * - OPAQUE EXACT-REVISED compared-line references (the W037
 *   commitment-reference discipline) — NO runtime edge to the
 *   actualization or solution-delivery kernels; the measure-value space
 *   is a structural mirror of the W036 measure grammar pinned by
 *   compile-time kernel parity + runtime parity tests.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), and the committed in-package JSON
 * Schema projection under schemas/ (the W007/W009/W023/W036 convention)
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ATTRIBUTION_CAUSE_KINDS,
  ATTRIBUTION_ID_PATTERN,
  COMPARISON_BANDS,
  COMPARISON_ID_PATTERN,
  COMPARISON_KINDS,
  COMPARED_LINE_ID_PATTERNS,
  COMPARED_LINE_KINDS,
  PREDICTION_COMPARISON_SCHEMA_NAME,
  VARIANCE_CLASSES,
  VARIANCE_CLASS_POLARITY,
  VARIANCE_CONTRACT_VERSION,
  VARIANCE_DIRECTIONS,
  VARIANCE_ID_PATTERN,
  VARIANCE_MAGNITUDE_BANDS,
  VARIANCE_PRINCIPAL_ID_PATTERN,
  VARIANCE_RECORD_SCHEMA_NAME,
  VARIANCE_RECORD_VERSION,
  kindPrefixOf,
} from './version';
export type {
  AttributionCauseKind,
  ComparedLineKind,
  ComparisonBand,
  ComparisonKind,
  VarianceClass,
  VarianceDirection,
  VarianceMagnitudeBand,
} from './version';

// Primitives (zod schemas + types).
export {
  AttributionIdSchema,
  ComparisonIdSchema,
  ComparedLineRefSchema,
  CostMeasureSchema,
  InstantMeasureSchema,
  MeasureValueSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  ProgressMeasureSchema,
  QuantityMeasureSchema,
  Sha256HexSchema,
  TenantIdSchema,
  TimestampSchema,
  VarianceIdSchema,
  VarianceRecordRefSchema,
  SHA256_HEX_PATTERN,
} from './primitives';
export type {
  AttributionId,
  ComparisonId,
  ComparedLineRef,
  CostMeasure,
  InstantMeasure,
  MeasureValue,
  NonNegativeDecimal,
  PrincipalId,
  ProgressMeasure,
  QuantityMeasure,
  Sha256Hex,
  TenantId,
  Timestamp,
  VarianceId,
  VarianceRecordRef,
} from './primitives';

// Typed error taxonomy + result.
export type {
  VarianceError,
  VarianceErrorCode,
  VarianceIssue,
  VarianceResult,
} from './errors';

// Exact decimal-string arithmetic (the W036 decimal.ts discipline, local).
export {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  decimalFromFraction,
  subtractNonNegativeDecimals,
} from './decimal';
export type { SignedDifference } from './decimal';

// The variance class set as typed sealed records.
export {
  BandThresholdsSchema,
  SealedVarianceRecordSchema,
  VarianceConfidenceSchema,
  VarianceRecordContentSchema,
  admitVarianceRecord,
  computeVarianceRecordDigest,
  computeVariance,
  foldVarianceRecords,
  foldVarianceSummary,
  openVarianceLedger,
  sealVarianceRecord,
  verifySealedVarianceRecord,
} from './variance';
export type {
  BandThresholds,
  ComputeVarianceInput,
  SealedVarianceRecord,
  VarianceClassSummary,
  VarianceConfidence,
  VarianceLedger,
  VarianceRecordContent,
} from './variance';

// Root-cause attribution with evidence.
export {
  AttributionRecordContentSchema,
  CauseRefSchema as AttributionCauseRefSchema,
  SealedAttributionRecordSchema,
  admitAttributionRecord,
  causesOf,
  computeAttributionRecordDigest,
  foldAttributionRecords,
  openAttributionLedger,
  requireAttributionEvidence,
  sealAttributionRecord,
  verifySealedAttributionRecord,
} from './attribution';
export type {
  AttributionLedger,
  AttributionRecordContent,
  CauseRef,
  SealedAttributionRecord,
} from './attribution';

// Immutable historical prediction comparison.
export {
  PredictionComparisonContentSchema,
  SealedPredictionComparisonSchema,
  admitPredictionComparison,
  computePredictionComparison,
  computePredictionComparisonDigest,
  foldPredictionComparisons,
  openComparisonHistory,
  sealPredictionComparison,
  verifySealedPredictionComparison,
} from './comparison';
export type {
  ComparisonHistory,
  ComputeComparisonInput,
  PredictionComparisonContent,
  SealedPredictionComparison,
} from './comparison';

// Published schema surface + contract emission.
export { VARIANCE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  VARIANCE_CONTRACT_DIR,
  renderVarianceContractFiles,
  typeToKebabCase,
} from './contract-emission';
