/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), and
 * the ObservationSourcePort adapter seam (external observation sources —
 * W038 field systems, W037 supplier systems — live BEHIND it; the core
 * never names a vendor).
 */
import type {
  ActualizationError,
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
} from '@epoch/actualization';
import type {
  AttributionLedger,
  BandThresholds,
  CauseRef,
  SealedAttributionRecord,
  SealedPredictionComparison,
  SealedVarianceRecord,
  VarianceClassSummary,
  VarianceError,
  VarianceLedger,
} from '@epoch/variance';
import type {
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';

// The sealed W036 records the host registers/folds (type re-exports for
// the service surface — the runtime dependency is @epoch/actualization;
// the W036 record TYPES surface through its index re-exports).
export type { SealedDeliveryRecord, SealedDistinctionRecord, UncertaintyState };
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
};
export type {
  AttributionLedger,
  BandThresholds,
  CauseRef,
  SealedAttributionRecord,
  SealedPredictionComparison,
  SealedVarianceRecord,
  VarianceLedger,
  VarianceClassSummary,
};

/** The typed service-error union: kernel errors + service-owned codes. */
export type ActualizationServiceError =
  | ActualizationError
  | VarianceError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-delivery';
      readonly message: string;
      readonly deliveryId: string;
    }
  | {
      readonly code: 'unknown-store';
      readonly message: string;
      readonly deliveryId: string;
    };

/** Total-result wrapper of every service entry point. */
export type ActualizationServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ActualizationServiceError };

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of the {@link ActualizationRuntime} constructor. */
export interface ActualizationRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The ObservationSourcePort adapter seam (external observation
   * sources — W038 field systems, W037 supplier systems). Defaults to
   * the in-memory reference adapter. The core never names a vendor.
   */
  readonly observationSourcePort?: ObservationSourcePort | undefined;
}

/**
 * The ObservationSourcePort adapter seam: external observation sources
 * (W038 field systems, W037 supplier systems) submit sealed W036
 * Observation-distinction records behind this port; the host polls and
 * admits them through the kernel intake. Provider semantics stay behind
 * adapters — the core never names a vendor.
 */
export interface ObservationSourcePort {
  /** Poll the pending submissions of one delivery scope (deterministic order). */
  pollObservations(options: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
  }): ActualizationServiceResult<readonly SealedDistinctionRecord[]>;
  /** Submit one sealed observation record into the pending queue. */
  submit(options: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly observation: SealedDistinctionRecord;
  }): ActualizationServiceResult<null>;
}

/** The outcome of one observation-source poll intake. */
export interface ObservationPollOutcome {
  readonly observationId: string;
  readonly admission: 'recorded' | 'duplicate-observation';
}

/** The outcome of one variance computation + admission. */
export interface VarianceComputationOutcome {
  readonly record: SealedVarianceRecord;
  readonly summary: readonly VarianceClassSummary[];
}

/** The derived runtime health snapshot. */
export interface RuntimeHealth {
  readonly deliveryCount: number;
  readonly observationCount: number;
  readonly resolutionCount: number;
  readonly actualCount: number;
  readonly varianceCount: number;
  readonly attributionCount: number;
  readonly comparisonFactCount: number;
  readonly forecastRevisionCount: number;
  readonly eventCount: number;
}
