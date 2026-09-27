/**
 * @epoch/actualization-runtime — public API (service layer, Work Order
 * W039).
 *
 * The reference ACTUALIZATION RUNTIME HOST over the @epoch/actualization
 * + @epoch/variance kernels: delivery-record registration, the
 * observation intake through the ObservationSourcePort adapter seam,
 * typed validation assessment + conflict resolution, actualization
 * application EXCLUSIVELY through the W036 DeliveryRecord authority
 * path, variance computation + evidence-grounded attribution, rolling
 * forecast revision emission, comparison-fact admission with calibration
 * folds, the derived actualization-state projection, and the
 * actualization:* event streams (W010-shaped, kernel-sealed).
 */
export { ActualizationRuntime, InMemoryObservationSourceAdapter } from './runtime';
export { seededObservationSource } from './observation-port';
export { RUNTIME_RECORD_VERSION } from './version';
export type {
  ActualizationRuntimeOptions,
  ActualizationServiceError,
  ActualizationServiceResult,
  AuthorizationInput,
  ObservationPollOutcome,
  ObservationSourcePort,
  RuntimeHealth,
  VarianceComputationOutcome,
} from './types';
export type {
  ActualizationStore,
  ObservationIntakeOutcome,
  ReconciliationPolicy,
  RollingForecastDetail,
  SealedActualizationEvent,
  SealedCalibrationState,
  SealedComparisonFact,
  SealedConflictResolution,
  SealedValidationAssessment,
  ActualizationStateProjection,
  ActualizationApplicationResult,
  ActualsToDate,
  DistinctionSubject,
  PlannedMeasure,
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from './types';
export type {
  AttributionLedger,
  BandThresholds,
  CauseRef,
  SealedAttributionRecord,
  SealedPredictionComparison,
  SealedVarianceRecord,
  VarianceClassSummary,
  VarianceLedger,
} from './types';
