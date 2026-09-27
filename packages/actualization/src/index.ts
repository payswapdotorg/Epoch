/**
 * @epoch/actualization — public API (kernel layer, Work Order W039).
 *
 * The ACTUALIZATION, VARIANCE-INPUT AND FORECAST SPINE over the W036
 * solution-delivery kernel (USL1.0, binding: "Observe/Actualize —
 * capture what actually happened and reconcile it into validated
 * delivery state" / "Forecast — project remaining work ... forecasts
 * never overwrite historical predictions, baselines or actuals"):
 *
 * - OBSERVATION INTAKE + TYPED VALIDATION STATES: sealed W036
 *   Observation-distinction records (the common spine W038 field
 *   observations and W037 supplier-delivery receipts already produce)
 *   are admitted append-only and folded, per (subject, measure) group,
 *   into typed validation states (insufficient / corroborated /
 *   conflicting) under a typed reconciliation policy (exact or tolerance
 *   agreement, corroboration quorum); conflicting groups resolve
 *   through SEALED conflict resolutions that partition the observation
 *   set exactly (the effective state becomes `resolved`);
 * - ACTUALIZATION through the W036 AUTHORITY PATH ONLY: the
 *   deterministic fold `applyActualization` converts validated
 *   observations into authoritative actuals EXCLUSIVELY via
 *   recordObservation -> acceptObservation -> actualizeObservation (the
 *   W036 DeliveryRecord authority) — this package NEVER writes Actual
 *   records directly (`actualization-bypass-rejected`; the W038
 *   precedent). Replay is idempotent (already-actualized observations
 *   skip);
 * - LINEAGE across universal lifecycle realizations: typed
 *   exact-revision edges chaining prediction -> baseline -> commitment
 *   -> actual -> forecast under every realization variant —
 *   content-addressed, revision-precise, traversable in BOTH directions,
 *   acyclic (the W037 commitment-reference discipline);
 * - ROLLING COMPLETION AND COST FORECASTS: deterministic functions
 *   producing the NEXT forecast revision from current actuals +
 *   remaining plan (exact fixed-point decimal folds); forecasts are NEW
 *   sealed W036 Forecast-distinction records — append-only revisions
 *   refining EARLIER FORECASTS only, never mutations (`forecast-overwrite-rejected`
 *   surfaces from the W036 ledger);
 * - CONFIDENCE/CALIBRATION STATE: typed confidence carried on every
 *   forecast; comparison FACTS (immutable history — `history-immutable`)
 *   fold deterministically into sealed calibration states (bias counts,
 *   exact total absolute deviation, worst deviation, derived
 *   confidence);
 * - the `actualization:*` event vocabulary over the W010 event shapes;
 *   - the derived actualization-state projection (pure fold, never
 *   stored).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023/W036 convention), the
 * public core-record surface at contracts/actualization/ (the W012
 * convention), both pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ACTUALIZATION_CONTRACT_VERSION,
  ACTUALIZATION_EVENT_DISCRIMINATORS,
  ACTUALIZATION_EVENT_RECORD_VERSION,
  ACTUALIZATION_PRINCIPAL_ID_PATTERN,
  ACTUALIZATION_RECORD_VERSION,
  ACTUALIZATION_STREAM_ID_PATTERN,
  CALIBRATION_ID_PATTERN,
  COMPARISON_FACT_ID_PATTERN,
  FORECAST_BIAS_DIRECTIONS,
  LINEAGE_ID_PATTERN,
  LINEAGE_NODE_KINDS,
  LINEAGE_STAGE_ORDER,
  RECONCILIATION_MODES,
  RESOLUTION_ID_PATTERN,
  VALIDATION_ID_PATTERN,
  VALIDATION_STATES,
  actualIdOfObservation,
  actualizationStreamIdOf,
  kindPrefixOf,
  lineageStageOrdinal,
} from './version';
export type {
  ActualizationEventDiscriminator,
  ForecastBiasDirection,
  LineageNodeKind,
  ReconciliationFoldMode,
  ReconciliationMode,
  ValidationState,
} from './version';

// Primitives (zod schemas + types).
export {
  AssessmentReferenceSchema,
  CalibrationIdSchema,
  ComparisonFactIdSchema,
  ConflictResolutionIdSchema,
  ForecastRevisionReferenceSchema,
  LineageEdgeIdSchema,
  ObservationReferenceSchema,
  ValidationAssessmentIdSchema,
} from './primitives';
export type {
  AssessmentReference,
  CalibrationId,
  ComparisonFactId,
  ConflictResolutionId,
  ForecastRevisionReference,
  LineageEdgeId,
  ObservationReference,
  ValidationAssessmentId,
} from './primitives';
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
} from './primitives';
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
} from './primitives';
export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';
export {
  CONFIDENCE_METHODS,
  DistinctionSubjectSchema,
  MeasureSchema,
  UncertaintyStateSchema,
} from '@epoch/solution-delivery';
export type {
  ConfidenceMethod,
  DistinctionSubject,
  Measure,
  UncertaintyState,
} from '@epoch/solution-delivery';

// Typed error taxonomy + result.
export type {
  ActualizationError,
  ActualizationErrorCode,
  ActualizationIssue,
  ActualizationResult,
} from './errors';

// Exact decimal-string arithmetic (the W036 decimal.ts precedent extended).
export {
  addNonNegativeDecimals,
  clampSubtractNonNegativeDecimals,
  compareNonNegativeDecimals,
  decimalFromFraction,
  multiplyNonNegativeDecimals,
  subtractNonNegativeDecimals,
} from './decimal';
export type { SignedDifference } from './decimal';

// Validation states + the deterministic reconciliation fold.
export {
  ConflictResolutionContentSchema,
  DEFAULT_RECONCILIATION_QUORUM,
  ReconciliationPolicySchema,
  SealedConflictResolutionSchema,
  SealedValidationAssessmentSchema,
  ValidationAssessmentContentSchema,
  VALIDATION_MEASURE_KINDS,
  admitObservationRecord,
  assessValidation,
  computeConflictResolutionDigest,
  computeValidationAssessmentDigest,
  effectiveGroupState,
  sealConflictResolution,
  sealValidationAssessment,
  verifySealedConflictResolution,
  verifySealedValidationAssessment,
} from './validation';
export type {
  ConflictResolutionContent,
  ObservationIntakeOutcome,
  ReconciliationPolicy,
  SealedConflictResolution,
  SealedValidationAssessment,
  ValidationAssessmentContent,
  ValidationMeasureKind,
  ValidationStateFromAssessment,
} from './validation';

// The W036 authority-path application (the ONLY bridge to actuals).
export {
  applyActualization,
  applyGroupActualization,
} from './reconciliation';
export type {
  ActualizationApplicationOutcome,
  ActualizationApplicationResult,
  ReconciliationApplication,
} from './reconciliation';

// Lineage across universal lifecycle realizations.
export {
  LineageEdgeContentSchema,
  LineageNodeRefSchema,
  SealedLineageEdgeSchema,
  admitLineageEdge,
  computeLineageEdgeDigest,
  foldLineageEdges,
  lineageEdgesOf,
  lineageNodeKey,
  openLineageStore,
  sealLineageEdge,
  traceLineageBackward,
  traceLineageForward,
  verifySealedLineageEdge,
} from './lineage';
export type {
  LineageEdgeContent,
  LineageNodeRef,
  LineageStore,
  LineageTrace,
  SealedLineageEdge,
} from './lineage';

// Rolling completion + cost forecasts (W036 Forecast-distinction records).
export {
  ActualsToDateSchema,
  PlannedCostSchema,
  PlannedMeasureSchema,
  PlannedQuantitySchema,
  admitForecastRevision,
  rollForecast,
} from './forecast';
export type {
  ActualsToDate,
  PlannedCost,
  PlannedMeasure,
  PlannedQuantity,
  RollingForecastDetail,
  RollingForecastInput,
} from './forecast';
export type { DistinctionLedger, SealedDistinctionRecord } from '@epoch/solution-delivery';

// Confidence/calibration state (comparison facts + the calibration fold).
export {
  COMPARISON_FACT_SCHEMA_NAME,
  CalibrationStateContentSchema,
  ComparisonFactContentSchema,
  ComparisonRecordReferenceSchema,
  ForecastSideReferenceSchema,
  ActualSideReferenceSchema,
  SealedCalibrationStateSchema,
  SealedComparisonFactSchema,
  computeCalibrationStateDigest,
  computeComparisonFactDigest,
  foldCalibration,
  sealCalibrationState,
  sealComparisonFact,
  verifySealedCalibrationState,
  verifySealedComparisonFact,
} from './calibration';
export type {
  ActualSideReference,
  CalibrationConfidence,
  CalibrationStateContent,
  ComparisonFactContent,
  ComparisonRecordReference,
  ForecastSideReference,
  SealedCalibrationState,
  SealedComparisonFact,
} from './calibration';

// The `actualization:*` event vocabulary over the W010 event shapes.
export {
  ACTUALIZATION_EVENT_DATA_SCHEMAS,
  ActualizationCausalParentSchema,
  ActualizationEventContentSchema,
  ActualizationEventPayloadSchema,
  ActualizationEventSequenceSchema,
  SealedActualizationEventSchema,
  ActualsMintedDataSchema,
  CalibrationFoldedDataSchema,
  ConflictResolvedDataSchema,
  ForecastRevisedDataSchema,
  LineageLinkedDataSchema,
  ObservationIntakenDataSchema,
  StateProjectedDataSchema,
  ValidationAssessedDataSchema,
  computeActualizationEventDigest,
  parseActualizationEventData,
  sealActualizationEvent,
  verifySealedActualizationEvent,
} from './events';
export type {
  ActualizationCausalParent,
  ActualizationEventContent,
  ActualizationEventPayload,
  ActualizationEventSequence,
  SealedActualizationEvent,
  ActualsMintedData,
  CalibrationFoldedData,
  ConflictResolvedData,
  ForecastRevisedData,
  LineageLinkedData,
  ObservationIntakenData,
  StateProjectedData,
  ValidationAssessedData,
} from './events';

// The reference in-memory store + admission surface.
export {
  admitComparisonFact,
  admitConflictResolution,
  currentAssessments,
  effectiveValidationStates,
  foldComparisonFacts,
  foldObservations,
  foldResolutions,
  intakeObservation,
  openActualizationStore,
} from './store';
export type { ActualizationStore } from './store';

// The derived actualization-state projection.
export { projectActualizationState } from './state';
export type {
  ActualizationStateProjection,
  ValidationGroupRow,
} from './state';

// W036 error-taxonomy adapter (typed rejections surfaced, never swallowed).
export { adaptDeliveryResult, mapDeliveryError } from './w036-adapter';

// The W036 authority verifiers (composed re-exports — actualization folds
// the delivery-facts authority, it never re-implements it).
export { verifySealedDeliveryRecord, foldDeliveryActuals } from '@epoch/solution-delivery';
export type {
  DeliveryActualsSummary,
  DeliveryActualTotal,
  SealedDeliveryRecord,
} from '@epoch/solution-delivery';

// Published schema surface + contract emission.
export {
  ACTUALIZATION_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  ACTUALIZATION_CONTRACT_DIR,
  ACTUALIZATION_PUBLIC_CONTRACT_DIR,
  renderActualizationContractFiles,
  renderActualizationPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
