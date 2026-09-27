/**
 * The variance schema-surface registry: every data type published at the
 * `@epoch/variance` ownership boundary, paired with its zod schema.
 *
 * The W039 owned surfaces include NO contracts/variance tree — this
 * in-package surface under `packages/variance/schemas` (the
 * W006/W007/W009/W023 in-package convention) is the kernel's published
 * contract, drift-pinned byte-for-byte by test/contract-drift.test.ts.
 */
import { type ZodType } from 'zod';
import {
  AttributionIdSchema,
  ComparedLineRefSchema,
  ComparisonIdSchema,
  CostMeasureSchema,
  InstantMeasureSchema,
  MeasureValueSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  ProgressMeasureSchema,
  QuantityMeasureSchema,
  Sha256HexSchema,
  TimestampSchema,
  VarianceIdSchema,
  VarianceRecordRefSchema,
} from './primitives';
import {
  BandThresholdsSchema,
  SealedVarianceRecordSchema,
  VarianceConfidenceSchema,
  VarianceRecordContentSchema,
} from './variance';
import {
  AttributionRecordContentSchema,
  CauseRefSchema,
  SealedAttributionRecordSchema,
} from './attribution';
import {
  PredictionComparisonContentSchema,
  SealedPredictionComparisonSchema,
} from './comparison';
import { TenantIdSchema } from '@epoch/tenancy';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The full published schema surface of @epoch/variance. */
export const VARIANCE_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'VarianceId', schema: VarianceIdSchema },
  { type: 'AttributionId', schema: AttributionIdSchema },
  { type: 'ComparisonId', schema: ComparisonIdSchema },
  { type: 'QuantityMeasure', schema: QuantityMeasureSchema },
  { type: 'CostMeasure', schema: CostMeasureSchema },
  { type: 'InstantMeasure', schema: InstantMeasureSchema },
  { type: 'ProgressMeasure', schema: ProgressMeasureSchema },
  { type: 'MeasureValue', schema: MeasureValueSchema },
  { type: 'ComparedLineRef', schema: ComparedLineRefSchema },
  { type: 'VarianceRecordRef', schema: VarianceRecordRefSchema },
  { type: 'VarianceConfidence', schema: VarianceConfidenceSchema },
  { type: 'BandThresholds', schema: BandThresholdsSchema },
  { type: 'VarianceRecordContent', schema: VarianceRecordContentSchema },
  { type: 'SealedVarianceRecord', schema: SealedVarianceRecordSchema },
  { type: 'CauseRef', schema: CauseRefSchema },
  { type: 'AttributionRecordContent', schema: AttributionRecordContentSchema },
  { type: 'SealedAttributionRecord', schema: SealedAttributionRecordSchema },
  { type: 'PredictionComparisonContent', schema: PredictionComparisonContentSchema },
  { type: 'SealedPredictionComparison', schema: SealedPredictionComparisonSchema },
];
