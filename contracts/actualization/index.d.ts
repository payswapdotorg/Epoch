/**
 * Epoch Actualization v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/actualization` ownership boundary (Work Order W039). It is
 * self-contained: no imports, no runtime code, no vendor/brand/Aurum
 * vocabulary. The runtime implementation lives in `@epoch/actualization`
 * (kernel layer); `parity.ts` in this directory proves at compile time
 * that the implementation's zod-inferred types are identical to these
 * declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (USL1.0 / architecture lock rule 16): the W036 DeliveryRecord
 * is the delivery-facts authority (actualization converts ACCEPTED
 * observations through its recordObservation -> acceptObservation ->
 * actualizeObservation path only); the W036 DistinctionLedger is the
 * forecast-record authority (rolling forecasts are W036
 * Forecast-distinction records refining earlier forecasts only). This
 * surface only carries typed references onto those authorities, never
 * embedded copies.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published actualization contract surface. */
export type ActualizationContractVersion = '1.0.0';

/** The typed validation states of one observation group. */
export type ValidationState =
  | 'insufficient'
  | 'corroborated'
  | 'conflicting'
  | 'resolved';

/** The reconciliation-policy agreement modes. */
export type ReconciliationMode = 'exact' | 'tolerance';

/** The reconciliation-policy fold modes (increments vs repeat-measurements). */
export type ReconciliationFoldMode = 'accumulate' | 'snapshot';

/** The lineage node kinds — the five lifecycle-first distinction kinds. */
export type LineageNodeKind =
  | 'prediction'
  | 'baseline'
  | 'commitment'
  | 'actual'
  | 'forecast';

/** The forecast-bias directions of one past-forecast-vs-actual comparison. */
export type ForecastBiasDirection = 'over-forecast' | 'under-forecast' | 'exact';

/** The actualization:* lifecycle event payload discriminators (W010 namespace). */
export type ActualizationEventDiscriminator =
  | 'actualization:observation-intaken'
  | 'actualization:validation-assessed'
  | 'actualization:conflict-resolved'
  | 'actualization:actuals-minted'
  | 'actualization:lineage-linked'
  | 'actualization:forecast-revised'
  | 'actualization:calibration-folded'
  | 'actualization:state-projected';

/** The measure kinds a validation group folds (the W036 measure kinds). */
export type ValidationMeasureKind = 'quantity' | 'cost' | 'progress' | 'instant';

/** The closed realization-variant catalog (the W036 grammar, composed). */
export type RealizationVariant =
  | 'construction-build'
  | 'software-implementation-deployment'
  | 'mechanical-fabrication-assembly'
  | 'electrical-installation-commissioning'
  | 'manufacturing'
  | 'infrastructure-provisioning'
  | 'field-service-repair';

// ---------------------------------------------------------------------------
// Neutral primitives (self-contained mirrors of the shared grammars).
// ---------------------------------------------------------------------------

/** JSON-representable value (finite numbers only). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** UTC instant in the canonical form YYYY-MM-DDTHH:MM:SS.mmmZ. */
export type Timestamp = string;

/** Tenant identity: "tenant:" + lowercase slug (the W009 grammar). */
export type TenantId = string;

/** Acting principal: "principal:" + lowercase slug (the W009 grammar). */
export type PrincipalId = string;

/** Solution package identity: "solution:" + lowercase slug. */
export type SolutionId = string;

/** Delivery record identity: "delivery:" + lowercase slug. */
export type DeliveryId = string;

/** Canonical non-negative decimal amount as a string. */
export type NonNegativeDecimal = string;

// ---------------------------------------------------------------------------
// The composed W036 grammars (mirrors of the solution-delivery shapes).
// ---------------------------------------------------------------------------

/** The subject of one distinction record (the W036 grammar). */
export type DistinctionSubject = {
  readonly solutionId: SolutionId;
  readonly subjectKind:
    | 'solution'
    | 'solution-line'
    | 'work-package'
    | 'activity'
    | 'milestone'
    | 'program'
    | 'delivery';
  readonly subjectId: string;
};

/** A quantity measure (the W036 grammar). */
export type QuantityMeasure = {
  readonly kind: 'quantity';
  readonly value: NonNegativeDecimal;
  readonly unit: string;
};

/** A cost measure (the W036 grammar). */
export type CostMeasure = {
  readonly kind: 'cost';
  readonly amount: NonNegativeDecimal;
  readonly currency: string;
};

/** An instant measure (the W036 grammar). */
export type InstantMeasure = {
  readonly kind: 'instant';
  readonly at: Timestamp;
};

/** A progress measure (the W036 grammar). */
export type ProgressMeasure = {
  readonly kind: 'progress';
  readonly fraction: number;
};

/** One provider-neutral measure (the W036 grammar). */
export type Measure =
  | QuantityMeasure
  | CostMeasure
  | InstantMeasure
  | ProgressMeasure;

/** Provenance of one delivery fact (the W036 grammar). */
export type ProvenanceState = {
  readonly kind:
    | 'observed'
    | 'reported'
    | 'derived'
    | 'assumed'
    | 'imported'
    | 'unknown';
  readonly sourceRef?: string | undefined;
  readonly actor?: PrincipalId | undefined;
};

/** Freshness of one delivery fact (the W036 grammar). */
export type FreshnessState = {
  readonly state: 'fresh' | 'aging' | 'stale' | 'unknown';
  readonly assessedAt: Timestamp;
};

/** Confidence of one delivery fact (the W036 grammar, W006-shaped). */
export type ConfidenceState = {
  readonly method: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';
  readonly value: number;
  readonly interval?: { readonly low: number; readonly high: number } | undefined;
  readonly rationale?: string | undefined;
};

/** The complete uncertainty state (the W036 grammar). */
export type UncertaintyState = {
  readonly schemaVersion: 1;
  readonly provenance: ProvenanceState;
  readonly freshness: FreshnessState;
  readonly confidence: ConfidenceState;
};

// ---------------------------------------------------------------------------
// Exact-revision reference grammars.
// ---------------------------------------------------------------------------

/** One W036 Observation-distinction record reference (exact revision). */
export type ObservationReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** One validation-assessment reference (exact revision). */
export type AssessmentReference = {
  readonly assessmentId: string;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The reconciliation policy.
// ---------------------------------------------------------------------------

/** The reconciliation policy of one validation fold. */
export type ReconciliationPolicy = {
  readonly mode: ReconciliationMode;
  readonly foldMode?: ReconciliationFoldMode | undefined;
  readonly tolerance?: NonNegativeDecimal | undefined;
  readonly quorum?: number | undefined;
};

// ---------------------------------------------------------------------------
// Validation assessments + conflict resolutions.
// ---------------------------------------------------------------------------

/** The immutable content of one validation assessment (the derived fold). */
export type ValidationAssessmentContent = {
  readonly schema: 'epoch.actualization.validation-assessment';
  readonly schemaVersion: 1;
  readonly assessmentId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly subject: DistinctionSubject;
  readonly measureKind: ValidationMeasureKind;
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly policy: ReconciliationPolicy;
  readonly observationRefs: ObservationReference[];
  readonly state: 'insufficient' | 'corroborated' | 'conflicting';
  readonly foldedMeasure: Measure;
  readonly deviationMagnitude: NonNegativeDecimal;
};

/** The sealed validation assessment (content + content digest). */
export type SealedValidationAssessment = {
  readonly schema: 'epoch.actualization.validation-assessment';
  readonly schemaVersion: 1;
  readonly assessmentId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly subject: DistinctionSubject;
  readonly measureKind: ValidationMeasureKind;
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly policy: ReconciliationPolicy;
  readonly observationRefs: ObservationReference[];
  readonly state: 'insufficient' | 'corroborated' | 'conflicting';
  readonly foldedMeasure: Measure;
  readonly deviationMagnitude: NonNegativeDecimal;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one conflict resolution. */
export type ConflictResolutionContent = {
  readonly schema: 'epoch.actualization.conflict-resolution';
  readonly schemaVersion: 1;
  readonly resolutionId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly assessmentRef: AssessmentReference;
  readonly selectedObservationRefs: ObservationReference[];
  readonly excludedObservationRefs: ObservationReference[];
  readonly resolvedBy: PrincipalId;
  readonly resolvedAt: Timestamp;
  readonly rationale?: string | undefined;
};

/** The sealed conflict resolution (content + content digest). */
export type SealedConflictResolution = {
  readonly schema: 'epoch.actualization.conflict-resolution';
  readonly schemaVersion: 1;
  readonly resolutionId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly assessmentRef: AssessmentReference;
  readonly selectedObservationRefs: ObservationReference[];
  readonly excludedObservationRefs: ObservationReference[];
  readonly resolvedBy: PrincipalId;
  readonly resolvedAt: Timestamp;
  readonly rationale?: string | undefined;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Lineage (exact-revision edges over the five lifecycle-first kinds).
// ---------------------------------------------------------------------------

/** One lineage node reference (exact revision, kind-checked). */
export type LineageNodeRef =
  | { readonly kind: 'prediction'; readonly recordId: string; readonly contentDigest: Sha256Hex }
  | { readonly kind: 'baseline'; readonly recordId: string; readonly contentDigest: Sha256Hex }
  | { readonly kind: 'commitment'; readonly recordId: string; readonly contentDigest: Sha256Hex }
  | { readonly kind: 'actual'; readonly recordId: string; readonly contentDigest: Sha256Hex }
  | { readonly kind: 'forecast'; readonly recordId: string; readonly contentDigest: Sha256Hex };

/** The immutable content of one lineage edge. */
export type LineageEdgeContent = {
  readonly schema: 'epoch.actualization.lineage-edge';
  readonly schemaVersion: 1;
  readonly edgeId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly realizationVariant: RealizationVariant;
  readonly subject: DistinctionSubject;
  readonly from: LineageNodeRef;
  readonly to: LineageNodeRef;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly note?: string | undefined;
};

/** The sealed lineage edge (content + content digest). */
export type SealedLineageEdge = {
  readonly schema: 'epoch.actualization.lineage-edge';
  readonly schemaVersion: 1;
  readonly edgeId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly realizationVariant: RealizationVariant;
  readonly subject: DistinctionSubject;
  readonly from: LineageNodeRef;
  readonly to: LineageNodeRef;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly note?: string | undefined;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Comparison facts + calibration states.
// ---------------------------------------------------------------------------

/** One opaque exact-revision reference to a prediction-comparison record. */
export type ComparisonRecordReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** One exact-revision reference to the compared forecast revision. */
export type ForecastSideReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** One exact-revision reference to the actualized outcome. */
export type ActualSideReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one comparison fact (calibration history). */
export type ComparisonFactContent = {
  readonly schema: 'epoch.actualization.comparison-fact';
  readonly schemaVersion: 1;
  readonly factId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly comparisonRef: ComparisonRecordReference;
  readonly forecastRef: ForecastSideReference;
  readonly actualRef: ActualSideReference;
  readonly forecastMeasure: Measure;
  readonly actualMeasure: Measure;
  readonly deviation: NonNegativeDecimal;
  readonly bias: ForecastBiasDirection;
  readonly observedAt: Timestamp;
};

/** The sealed comparison fact (content + content digest). */
export type SealedComparisonFact = {
  readonly schema: 'epoch.actualization.comparison-fact';
  readonly schemaVersion: 1;
  readonly factId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly comparisonRef: ComparisonRecordReference;
  readonly forecastRef: ForecastSideReference;
  readonly actualRef: ActualSideReference;
  readonly forecastMeasure: Measure;
  readonly actualMeasure: Measure;
  readonly deviation: NonNegativeDecimal;
  readonly bias: ForecastBiasDirection;
  readonly observedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};

/** The derived confidence of one calibration fold. */
export type CalibrationConfidence = {
  readonly method: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';
  readonly value: number;
  readonly rationale: string;
};

/** The immutable content of one calibration state (the derived fold). */
export type CalibrationStateContent = {
  readonly schema: 'epoch.actualization.calibration-state';
  readonly schemaVersion: 1;
  readonly calibrationId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly measureKind: ValidationMeasureKind;
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly comparisonRefs: ComparisonRecordReference[];
  readonly comparisonCount: number;
  readonly overCount: number;
  readonly underCount: number;
  readonly exactCount: number;
  readonly totalAbsoluteDeviation: NonNegativeDecimal;
  readonly worstDeviation:
    | { readonly comparisonRef: ComparisonRecordReference; readonly deviation: NonNegativeDecimal }
    | null;
  readonly confidence: CalibrationConfidence;
};

/** The sealed calibration state (content + content digest). */
export type SealedCalibrationState = {
  readonly schema: 'epoch.actualization.calibration-state';
  readonly schemaVersion: 1;
  readonly calibrationId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly measureKind: ValidationMeasureKind;
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly comparisonRefs: ComparisonRecordReference[];
  readonly comparisonCount: number;
  readonly overCount: number;
  readonly underCount: number;
  readonly exactCount: number;
  readonly totalAbsoluteDeviation: NonNegativeDecimal;
  readonly worstDeviation:
    | { readonly comparisonRef: ComparisonRecordReference; readonly deviation: NonNegativeDecimal }
    | null;
  readonly confidence: CalibrationConfidence;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The actualization:* events over the W010 event shapes.
// ---------------------------------------------------------------------------

/** One actualization-event sequence number (1-based, contiguous per stream). */
export type ActualizationEventSequence = number;

/** The causal parent reference of an actualization event (the W010 shape). */
export type ActualizationCausalParent = {
  readonly streamId: string;
  readonly sequence: ActualizationEventSequence;
};

/** The generic event payload of an actualization event (the W010 shape). */
export type ActualizationEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** The immutable content of one actualization event (the W010 mirror). */
export type ActualizationEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: ActualizationEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: ActualizationCausalParent | null;
  readonly payload: ActualizationEventPayload;
  readonly occurredAt: Timestamp;
};

/** The sealed actualization event (content + digest). */
export type SealedActualizationEvent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: ActualizationEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: ActualizationCausalParent | null;
  readonly payload: ActualizationEventPayload;
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};
