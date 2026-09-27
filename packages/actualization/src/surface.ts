/**
 * The actualization schema-surface registry: every data type published
 * at the `@epoch/actualization` ownership boundary, paired with its
 * zod schema.
 *
 * W039 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under `packages/actualization/schemas`
 *   (the W006/W007/W009/W023/W036 in-package convention) — every entry
 *   below;
 * - the PUBLIC core-record projection under
 *   `contracts/actualization/schemas` (the W012 convention) — the
 *   CORE_RECORD_SURFACE subset (see src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { type ZodType } from 'zod';
import {
  CalibrationIdSchema,
  ComparisonFactIdSchema,
  ConflictResolutionIdSchema,
  ForecastRevisionReferenceSchema,
  LineageEdgeIdSchema,
  ObservationReferenceSchema,
  AssessmentReferenceSchema,
  ValidationAssessmentIdSchema,
  PrincipalIdSchema,
  TimestampSchema,
  Sha256HexSchema,
  NonNegativeDecimalSchema,
  PositiveIntegerSchema,
  DeliveryIdSchema,
  SolutionIdSchema,
} from './primitives';
import {
  ReconciliationPolicySchema,
  SealedValidationAssessmentSchema,
  ValidationAssessmentContentSchema,
  ConflictResolutionContentSchema,
  SealedConflictResolutionSchema,
} from './validation';
import {
  LineageNodeRefSchema,
  LineageEdgeContentSchema,
  SealedLineageEdgeSchema,
} from './lineage';
import {
  PlannedMeasureSchema,
  PlannedQuantitySchema,
  PlannedCostSchema,
  ActualsToDateSchema,
} from './forecast';
import {
  ComparisonFactContentSchema,
  SealedComparisonFactSchema,
  ComparisonRecordReferenceSchema,
  ForecastSideReferenceSchema,
  ActualSideReferenceSchema,
  CalibrationStateContentSchema,
  SealedCalibrationStateSchema,
  CalibrationConfidenceSchema,
} from './calibration';
import {
  ActualizationEventContentSchema,
  SealedActualizationEventSchema,
  ActualizationEventPayloadSchema,
  ActualizationCausalParentSchema,
  ActualizationEventSequenceSchema,
  ObservationIntakenDataSchema,
  ValidationAssessedDataSchema,
  ConflictResolvedDataSchema,
  ActualsMintedDataSchema,
  LineageLinkedDataSchema,
  ForecastRevisedDataSchema,
  CalibrationFoldedDataSchema,
  StateProjectedDataSchema,
} from './events';
import {
  DistinctionSubjectSchema,
  MeasureSchema,
  UncertaintyStateSchema,
} from '@epoch/solution-delivery';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The full published schema surface of @epoch/actualization. */
export const ACTUALIZATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'DeliveryId', schema: DeliveryIdSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'PositiveInteger', schema: PositiveIntegerSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'UncertaintyState', schema: UncertaintyStateSchema },
  { type: 'ValidationAssessmentId', schema: ValidationAssessmentIdSchema },
  { type: 'ConflictResolutionId', schema: ConflictResolutionIdSchema },
  { type: 'LineageEdgeId', schema: LineageEdgeIdSchema },
  { type: 'CalibrationId', schema: CalibrationIdSchema },
  { type: 'ComparisonFactId', schema: ComparisonFactIdSchema },
  { type: 'ObservationReference', schema: ObservationReferenceSchema },
  { type: 'AssessmentReference', schema: AssessmentReferenceSchema },
  { type: 'ForecastRevisionReference', schema: ForecastRevisionReferenceSchema },
  { type: 'ComparisonRecordReference', schema: ComparisonRecordReferenceSchema },
  { type: 'ForecastSideReference', schema: ForecastSideReferenceSchema },
  { type: 'ActualSideReference', schema: ActualSideReferenceSchema },
  { type: 'ReconciliationPolicy', schema: ReconciliationPolicySchema },
  { type: 'ValidationAssessmentContent', schema: ValidationAssessmentContentSchema },
  { type: 'SealedValidationAssessment', schema: SealedValidationAssessmentSchema },
  { type: 'ConflictResolutionContent', schema: ConflictResolutionContentSchema },
  { type: 'SealedConflictResolution', schema: SealedConflictResolutionSchema },
  { type: 'LineageNodeRef', schema: LineageNodeRefSchema },
  { type: 'LineageEdgeContent', schema: LineageEdgeContentSchema },
  { type: 'SealedLineageEdge', schema: SealedLineageEdgeSchema },
  { type: 'PlannedQuantity', schema: PlannedQuantitySchema },
  { type: 'PlannedCost', schema: PlannedCostSchema },
  { type: 'PlannedMeasure', schema: PlannedMeasureSchema },
  { type: 'ActualsToDate', schema: ActualsToDateSchema },
  { type: 'ComparisonFactContent', schema: ComparisonFactContentSchema },
  { type: 'SealedComparisonFact', schema: SealedComparisonFactSchema },
  { type: 'CalibrationConfidence', schema: CalibrationConfidenceSchema },
  { type: 'CalibrationStateContent', schema: CalibrationStateContentSchema },
  { type: 'SealedCalibrationState', schema: SealedCalibrationStateSchema },
  { type: 'ActualizationEventSequence', schema: ActualizationEventSequenceSchema },
  { type: 'ActualizationCausalParent', schema: ActualizationCausalParentSchema },
  { type: 'ActualizationEventPayload', schema: ActualizationEventPayloadSchema },
  { type: 'ActualizationEventContent', schema: ActualizationEventContentSchema },
  { type: 'SealedActualizationEvent', schema: SealedActualizationEventSchema },
  { type: 'ObservationIntakenData', schema: ObservationIntakenDataSchema },
  { type: 'ValidationAssessedData', schema: ValidationAssessedDataSchema },
  { type: 'ConflictResolvedData', schema: ConflictResolvedDataSchema },
  { type: 'ActualsMintedData', schema: ActualsMintedDataSchema },
  { type: 'LineageLinkedData', schema: LineageLinkedDataSchema },
  { type: 'ForecastRevisedData', schema: ForecastRevisedDataSchema },
  { type: 'CalibrationFoldedData', schema: CalibrationFoldedDataSchema },
  { type: 'StateProjectedData', schema: StateProjectedDataSchema },
];

/**
 * The CORE record surface: the public projection published at
 * `contracts/actualization` (the W012 convention) — the record types a
 * domain pack or downstream consumer binds to.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'DeliveryId', schema: DeliveryIdSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'UncertaintyState', schema: UncertaintyStateSchema },
  { type: 'ObservationReference', schema: ObservationReferenceSchema },
  { type: 'AssessmentReference', schema: AssessmentReferenceSchema },
  { type: 'ReconciliationPolicy', schema: ReconciliationPolicySchema },
  { type: 'ValidationAssessmentContent', schema: ValidationAssessmentContentSchema },
  { type: 'SealedValidationAssessment', schema: SealedValidationAssessmentSchema },
  { type: 'ConflictResolutionContent', schema: ConflictResolutionContentSchema },
  { type: 'SealedConflictResolution', schema: SealedConflictResolutionSchema },
  { type: 'LineageNodeRef', schema: LineageNodeRefSchema },
  { type: 'LineageEdgeContent', schema: LineageEdgeContentSchema },
  { type: 'SealedLineageEdge', schema: SealedLineageEdgeSchema },
  { type: 'ComparisonFactContent', schema: ComparisonFactContentSchema },
  { type: 'SealedComparisonFact', schema: SealedComparisonFactSchema },
  { type: 'CalibrationStateContent', schema: CalibrationStateContentSchema },
  { type: 'SealedCalibrationState', schema: SealedCalibrationStateSchema },
  { type: 'ActualizationEventContent', schema: ActualizationEventContentSchema },
  { type: 'SealedActualizationEvent', schema: SealedActualizationEventSchema },
];
