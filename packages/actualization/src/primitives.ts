/**
 * Provider-neutral zod primitives of the actualization kernel. Every
 * schema here is a JSON-representable data shape; no field encodes a
 * vendor, brand, marketplace, ERP, PM tool, or API surface (architecture
 * lock rule 13).
 *
 * Composition policy (the W036/W037/W038 runtime-composition precedent):
 * digest machinery, timestamps and the JSON value space are REUSED from
 * @epoch/agent-protocol; tenant ids are REUSED from @epoch/tenancy; the
 * W036 distinction grammars (record ids, subjects, measures, uncertainty
 * states, distinction records, delivery records) are REUSED from
 * @epoch/solution-delivery (genuine runtime composition — this kernel
 * folds W036 records, never mirrors them). The principal and event-stream
 * grammars are MIRRORED from @epoch/event-log and pinned by runtime
 * parity tests (the kernel-to-kernel devDependency precedent).
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  UnitLabelSchema,
  CurrencyCodeSchema,
} from '@epoch/solution-delivery';
import {
  CALIBRATION_ID_PATTERN,
  COMPARISON_FACT_ID_PATTERN,
  LINEAGE_ID_PATTERN,
  RESOLUTION_ID_PATTERN,
  VALIDATION_ID_PATTERN,
} from './version';

// Re-exported for the package surface: the composed W036/agent-protocol
// grammars the actualization records are built from.
export {
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  NonNegativeDecimalSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
};
export type {
  CurrencyCode,
  DeliveryId,
  DistinctionRecordId,
  NonNegativeDecimal,
  PositiveInteger,
  PrincipalId,
  SemverCore,
  Sha256Hex,
  SolutionId,
  Timestamp,
  UnitLabel,
} from '@epoch/solution-delivery';
export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';

/** Validation-assessment record identity: `validation:<slug>`. */
export const ValidationAssessmentIdSchema = z
  .string()
  .regex(VALIDATION_ID_PATTERN, 'must be a validation id of the form "validation:<slug>"')
  .meta({
    id: 'ValidationAssessmentId',
    title: 'ValidationAssessmentId',
    description:
      'Opaque validation-assessment record identity: "validation:" followed by a lowercase slug.',
  });

/** One validation-assessment record id. */
export type ValidationAssessmentId = z.infer<typeof ValidationAssessmentIdSchema>;

/** Conflict-resolution record identity: `resolution:<slug>`. */
export const ConflictResolutionIdSchema = z
  .string()
  .regex(RESOLUTION_ID_PATTERN, 'must be a resolution id of the form "resolution:<slug>"')
  .meta({
    id: 'ConflictResolutionId',
    title: 'ConflictResolutionId',
    description:
      'Opaque conflict-resolution record identity: "resolution:" followed by a lowercase slug.',
  });

/** One conflict-resolution record id. */
export type ConflictResolutionId = z.infer<typeof ConflictResolutionIdSchema>;

/** Lineage-edge record identity: `lineage:<slug>`. */
export const LineageEdgeIdSchema = z
  .string()
  .regex(LINEAGE_ID_PATTERN, 'must be a lineage id of the form "lineage:<slug>"')
  .meta({
    id: 'LineageEdgeId',
    title: 'LineageEdgeId',
    description: 'Opaque lineage-edge record identity: "lineage:" followed by a lowercase slug.',
  });

/** One lineage-edge record id. */
export type LineageEdgeId = z.infer<typeof LineageEdgeIdSchema>;

/** Calibration-state record identity: `calibration:<slug>`. */
export const CalibrationIdSchema = z
  .string()
  .regex(CALIBRATION_ID_PATTERN, 'must be a calibration id of the form "calibration:<slug>"')
  .meta({
    id: 'CalibrationId',
    title: 'CalibrationId',
    description:
      'Opaque calibration-state record identity: "calibration:" followed by a lowercase slug.',
  });

/** One calibration-state record id. */
export type CalibrationId = z.infer<typeof CalibrationIdSchema>;

/** Comparison-fact record identity: `comparison-fact:<slug>`. */
export const ComparisonFactIdSchema = z
  .string()
  .regex(
    COMPARISON_FACT_ID_PATTERN,
    'must be a comparison-fact id of the form "comparison-fact:<slug>"',
  )
  .meta({
    id: 'ComparisonFactId',
    title: 'ComparisonFactId',
    description:
      'Opaque comparison-fact record identity: "comparison-fact:" followed by a lowercase slug.',
  });

/** One comparison-fact record id. */
export type ComparisonFactId = z.infer<typeof ComparisonFactIdSchema>;

/**
 * One exact-revision observation reference — the W038/W037 intake
 * linkage grammar (structurally the W037 `ObservationReference`): the
 * kind-prefixed W036 observation record id plus its content digest.
 */
export const ObservationReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ObservationReference',
    title: 'ObservationReference',
    description:
      'One W036 Observation-distinction record reference: the kind-prefixed record id plus its exact content digest (the observation-intake linkage grammar shared with W037/W038).',
  });

/** One observation reference. */
export type ObservationReference = z.infer<typeof ObservationReferenceSchema>;

/**
 * One exact-revision validation-assessment reference: the assessment id
 * plus the digest of the exact assessment revision being bound.
 */
export const AssessmentReferenceSchema = z
  .strictObject({
    assessmentId: ValidationAssessmentIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'AssessmentReference',
    title: 'AssessmentReference',
    description:
      'One validation-assessment reference: the assessment id plus the exact content digest of the assessment revision being bound (conflict resolutions bind exact revisions).',
  });

/** One assessment reference. */
export type AssessmentReference = z.infer<typeof AssessmentReferenceSchema>;

/** One exact-revision forecast-revision reference (the refinement chain link). */
export const ForecastRevisionReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ForecastRevisionReference',
    title: 'ForecastRevisionReference',
    description:
      'One W036 Forecast-distinction record reference: the forecast record id plus its exact content digest (the rolling-forecast refinement chain link).',
  });

/** One forecast-revision reference. */
export type ForecastRevisionReference = z.infer<typeof ForecastRevisionReferenceSchema>;
