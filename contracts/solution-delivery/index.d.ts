/**
 * Epoch Solution Delivery v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/solution-delivery` ownership boundary (Work Order W036). It
 * is self-contained: no imports, no runtime code, no vendor/brand/Aurum
 * vocabulary. The runtime implementation lives in
 * `@epoch/solution-delivery` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Universal lifecycle version: 1.0.0 (USL1.0)
 *
 * Authority (USL1.0 / DP1.0 / SN1.0): SolutionPackage/SolutionVersion is
 * the approved-solution-intent and baseline authority; DeliveryRecord is
 * the live delivery-facts authority; ProgramOfWork is the authoritative
 * schedule dimension. World Model, Constraint Engine, Simulation,
 * Evaluation, Verification/Evidence, Action Gateway, Experience Runtime
 * and external providers each keep their own authority — this surface
 * only carries opaque references onto them, never embedded copies.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published solution-delivery contract surface. */
export type SolutionDeliveryContractVersion = '1.0.0';

/** The universal solution lifecycle version taught by this contract (USL1.0). */
export type SolutionDeliveryUslVersion = '1.0.0';

/** The eleven universal lifecycle stages (USL1.0, binding). */
export type UniversalLifecycleStage =
  | 'understand'
  | 'decide'
  | 'plan'
  | 'acquire'
  | 'realize'
  | 'observe'
  | 'actualize'
  | 'verify'
  | 'forecast'
  | 'close'
  | 'learn';

/** The typed lifecycle transition relations (never a linear FSM). */
export type LifecycleTransitionRelation =
  | 'precedes'
  | 'branch'
  | 'overlap'
  | 'loop'
  | 'pause'
  | 'resume';

/** The nine semantic-distinction record kinds (USL1.0, binding). */
export type SemanticDistinctionKind =
  | 'prediction'
  | 'estimate'
  | 'baseline'
  | 'commitment'
  | 'observation'
  | 'actual'
  | 'forecast'
  | 'outcome'
  | 'learning';

/** The closed acquisition-variant catalog (procurement is one variant). */
export type AcquisitionVariant =
  | 'external-procurement'
  | 'internal-allocation'
  | 'subscription-license'
  | 'cloud-service-provisioning'
  | 'fabrication-request'
  | 'specialist-capability-assignment'
  | 'data-evidence-acquisition';

/** The closed realization-variant catalog. */
export type RealizationVariant =
  | 'construction-build'
  | 'software-implementation-deployment'
  | 'mechanical-fabrication-assembly'
  | 'electrical-installation-commissioning'
  | 'manufacturing'
  | 'infrastructure-provisioning'
  | 'field-service-repair';

/** Provenance kinds carried on every delivery fact. */
export type ProvenanceKind =
  | 'observed'
  | 'reported'
  | 'derived'
  | 'assumed'
  | 'imported'
  | 'unknown';

/** Freshness vocabulary members. */
export type FreshnessStateKind = 'fresh' | 'aging' | 'stale' | 'unknown';

/** Confidence acquisition methods (the W006/W002 grammar). */
export type ConfidenceMethod =
  | 'stated'
  | 'measured'
  | 'estimated'
  | 'derived'
  | 'imported';

/** Outcome-kind vocabulary. */
export type OutcomeKind =
  | 'delivered'
  | 'accepted'
  | 'handover'
  | 'residual'
  | 'rejected'
  | 'abandoned';

/** The synchronized Solution Navigator projection kinds (SN1.0). */
export type NavigatorProjectionKind =
  | 'world-view'
  | 'solution'
  | 'decision'
  | 'program-of-work'
  | 'schedule'
  | 'acquisition'
  | 'realization'
  | 'verification'
  | 'forecast'
  | 'outcomes'
  | 'learning';

/** The delivery:* lifecycle event payload discriminators (W010 namespace). */
export type DeliveryEventDiscriminator =
  | 'delivery:stage-entered'
  | 'delivery:stage-transition'
  | 'delivery:baseline-approved'
  | 'delivery:baseline-revision'
  | 'delivery:observation-recorded'
  | 'delivery:observation-accepted'
  | 'delivery:observation-rejected'
  | 'delivery:observation-actualized'
  | 'delivery:acquisition-requested'
  | 'delivery:acquisition-fulfilled'
  | 'delivery:milestone-reached'
  | 'delivery:forecast-recorded'
  | 'delivery:outcome-recorded'
  | 'delivery:learning-recorded'
  | 'delivery:info-request-issued';

/** The DP1.0-forbidden authority-claim field names. */
export type ForbiddenAuthorityField =
  | 'lifecycleAuthority'
  | 'baselineAuthority'
  | 'scheduleAuthority'
  | 'deliveryAuthority'
  | 'actualizationAuthority'
  | 'verificationAuthority'
  | 'worldAuthority'
  | 'semanticAuthority'
  | 'mutableActual'
  | 'mutableBaseline'
  | 'mutableForecast';

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

/** Solution line identity: "line:" + lowercase slug. */
export type SolutionLineId = string;

/** Delivery record identity: "delivery:" + lowercase slug. */
export type DeliveryId = string;

/** Program of work identity: "program:" + lowercase slug. */
export type ProgramId = string;

/** Work package identity: "work-package:" + lowercase slug. */
export type WorkPackageId = string;

/** Activity identity: "activity:" + lowercase slug. */
export type ActivityId = string;

/** Milestone identity: "milestone:" + lowercase slug. */
export type MilestoneId = string;

/** Distinction record identity: "<kind>:" + lowercase slug. */
export type DistinctionRecordId = string;

/** Lifecycle stage-record identity: "stage:" + lowercase slug. */
export type StageRecordId = string;

/** Lifecycle transition-record identity: "transition:" + lowercase slug. */
export type TransitionRecordId = string;

/** Acquisition request identity: "acquisition:" + lowercase slug. */
export type AcquisitionId = string;

/** Information-acquisition request identity: "info-request:" + lowercase slug. */
export type InfoRequestId = string;

/** External request envelope identity: "external-request:" + lowercase slug. */
export type ExternalRequestId = string;

/** External event envelope identity: "external-event:" + lowercase slug. */
export type ExternalEventId = string;

/** Baseline approval record identity: "approval:" + lowercase slug. */
export type BaselineApprovalId = string;

/** Verification gate identity: "gate:" + lowercase slug. */
export type GateId = string;

/** Blocker record identity: "blocker:" + lowercase slug. */
export type BlockerId = string;

/** Delivery event stream identity: "stream:" + lowercase slug (W010 grammar). */
export type DeliveryStreamId = string;

/** Semantic-version core (MAJOR.MINOR.PATCH, no suffixes). */
export type SemverCore = string;

/** ISO 4217 currency code (three uppercase letters). */
export type CurrencyCode = string;

/** Non-negative decimal amount as a canonical string. */
export type NonNegativeDecimal = string;

/** Positive integer (1 to MAX_SAFE_INTEGER). */
export type PositiveInteger = number;

/** Unit-of-measure label (1-32 characters). */
export type UnitLabel = string;

/** Opaque, bounded, provider-neutral reference string. */
export type OpaqueReference = string;

/** Dot-namespaced qualified name. */
export type QualifiedName = string;

/** Progress fraction between 0 and 1 inclusive. */
export type ProgressFraction = number;

// ---------------------------------------------------------------------------
// Typed error taxonomy (values, never thrown).
// ---------------------------------------------------------------------------

/** One flattened validation issue (dotted path + message). */
export type DeliveryIssue = {
  readonly path: string;
  readonly message: string;
};

/** The complete solution-delivery error-code vocabulary. */
export type DeliveryErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'unknown-solution-reference'
  | 'version-conflict'
  | 'baseline-mutation-rejected'
  | 'cross-tenant-denied'
  | 'schedule-cycle-rejected'
  | 'schedule-integrity-rejected'
  | 'distinction-collapse-rejected'
  | 'unaccepted-actualization-rejected'
  | 'forecast-overwrite-rejected'
  | 'lifecycle-conflict'
  | 'authority-violation-rejected'
  | 'dangling-reference-rejected'
  | 'digest-mismatch';

/** The typed solution-delivery error taxonomy (discriminated on `code`). */
export type DeliveryError =
  | { readonly code: 'validation'; readonly message: string; readonly issues: readonly DeliveryIssue[] }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly DeliveryIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-solution-reference';
      readonly message: string;
      readonly solutionId: string;
      readonly encounteredVersion?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly solutionId: string;
      readonly version: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'baseline-mutation-rejected';
      readonly message: string;
      readonly solutionId: string;
      readonly version: string;
      readonly baselineDigest: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | { readonly code: 'schedule-cycle-rejected'; readonly message: string; readonly cycle: readonly string[] }
  | { readonly code: 'schedule-integrity-rejected'; readonly message: string; readonly issues: readonly DeliveryIssue[] }
  | {
      readonly code: 'distinction-collapse-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly publishedKind: SemanticDistinctionKind;
      readonly encounteredKind: SemanticDistinctionKind;
    }
  | {
      readonly code: 'unaccepted-actualization-rejected';
      readonly message: string;
      readonly observationId: string;
      readonly observationState: 'proposed' | 'accepted' | 'rejected' | 'missing';
    }
  | {
      readonly code: 'forecast-overwrite-rejected';
      readonly message: string;
      readonly forecastRecordId: string;
      readonly refinesRecordId: string;
      readonly refinesKind: SemanticDistinctionKind | 'missing';
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly relation?: LifecycleTransitionRelation | undefined;
    }
  | {
      readonly code: 'authority-violation-rejected';
      readonly message: string;
      readonly encounteredStage?: UniversalLifecycleStage | string | undefined;
      readonly field?: string | undefined;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind:
        | 'world-entity'
        | 'world-relation'
        | 'constraint'
        | 'evidence'
        | 'solution-version'
        | 'work-package'
        | 'activity'
        | 'milestone'
        | 'solution-line'
        | 'observation'
        | 'acquisition-request'
        | 'info-request'
        | 'stage-record';
      readonly referenceId: string;
    }
  | { readonly code: 'digest-mismatch'; readonly message: string; readonly expected: string; readonly encountered: string };

/** Result of a solution-delivery operation: a value or a typed error. */
export type DeliveryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DeliveryError };

// ---------------------------------------------------------------------------
// Uncertainty states (provenance + freshness + confidence on every fact).
// ---------------------------------------------------------------------------

/** Provenance of one delivery fact. */
export type ProvenanceState = {
  readonly kind: ProvenanceKind;
  readonly sourceRef?: OpaqueReference | undefined;
  readonly actor?: PrincipalId | undefined;
};

/** Freshness of one delivery fact. */
export type FreshnessState = {
  readonly state: FreshnessStateKind;
  readonly assessedAt: Timestamp;
};

/** Confidence of one delivery fact. */
export type ConfidenceState = {
  readonly method: ConfidenceMethod;
  readonly value: number;
  readonly interval?: { readonly low: number; readonly high: number } | undefined;
  readonly rationale?: string | undefined;
};

/** The complete uncertainty state carried on every delivery fact. */
export type UncertaintyState = {
  readonly schemaVersion: 1;
  readonly provenance: ProvenanceState;
  readonly freshness: FreshnessState;
  readonly confidence: ConfidenceState;
};

// ---------------------------------------------------------------------------
// Solution packages + immutable version baselines.
// ---------------------------------------------------------------------------

/** Reference to a world-graph entity (the W002 grammar, opaque). */
export type WorldEntityReference = { readonly entityId: string };

/** Reference to a constraint (the W004 grammar, opaque). */
export type ConstraintReference = { readonly constraintId: string };

/** Reference to evidence (the W006 grammar, digest-addressed). */
export type EvidenceReference = { readonly digest: Sha256Hex };

/** One solution line: quantity+unit line item with optional unit cost. */
export type SolutionLine = {
  readonly lineId: SolutionLineId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly quantity: { readonly value: NonNegativeDecimal; readonly unit: UnitLabel };
  readonly unitCost?: { readonly amount: NonNegativeDecimal; readonly currency: CurrencyCode } | undefined;
  readonly worldEntityId?: string | undefined;
  readonly acquisitionVariant?: AcquisitionVariant | undefined;
};

/** The immutable content of one solution version. */
export type SolutionVersionContent = {
  readonly schema: 'epoch.solution-delivery.solution-version';
  readonly schemaVersion: 1;
  readonly solutionId: SolutionId;
  readonly version: SemverCore;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly objective?: string | undefined;
  readonly solutionLines: SolutionLine[];
  readonly worldReferences: WorldEntityReference[];
  readonly constraintReferences: ConstraintReference[];
  readonly previousVersionDigest: Sha256Hex | null;
  readonly createdAt: Timestamp;
  readonly createdBy: PrincipalId;
};

/** The sealed solution version envelope (content + content digest). */
export type SealedSolutionVersion = {
  readonly schema: 'epoch.solution-delivery.solution-version';
  readonly schemaVersion: 1;
  readonly solutionId: SolutionId;
  readonly version: SemverCore;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly objective?: string | undefined;
  readonly solutionLines: SolutionLine[];
  readonly worldReferences: WorldEntityReference[];
  readonly constraintReferences: ConstraintReference[];
  readonly previousVersionDigest: Sha256Hex | null;
  readonly createdAt: Timestamp;
  readonly createdBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
};

/** The baseline approval record (a distinct authority act). */
export type BaselineApproval = {
  readonly schema: 'epoch.solution-delivery.baseline-approval';
  readonly schemaVersion: 1;
  readonly approvalId: BaselineApprovalId;
  readonly solutionId: SolutionId;
  readonly tenantId: TenantId;
  readonly version: SemverCore;
  readonly baselineDigest: Sha256Hex;
  readonly approvedBy: PrincipalId;
  readonly approvedAt: Timestamp;
  readonly decisionNote?: string | undefined;
};

/** Deterministic summary of a verified solution version chain. */
export type SolutionChainSummary = {
  readonly solutionId: string;
  readonly tenantId: string;
  readonly versionCount: number;
  readonly headVersion: string;
  readonly headDigest: Sha256Hex;
};

/** The structural world lookup this contract needs (opaque resolution). */
export type WorldEntityLookup = { hasEntity(entityId: string): boolean };

/** The structural constraint lookup this contract needs. */
export type ConstraintLookup = { hasConstraint(constraintId: string): boolean };

/** The structural evidence lookup this contract needs. */
export type EvidenceLookup = { hasEvidence(digest: string): boolean };

// ---------------------------------------------------------------------------
// The nine semantic-distinction record types.
// ---------------------------------------------------------------------------

/** A quantity measure. */
export type QuantityMeasure = {
  readonly kind: 'quantity';
  readonly value: NonNegativeDecimal;
  readonly unit: UnitLabel;
};

/** A cost measure. */
export type CostMeasure = {
  readonly kind: 'cost';
  readonly amount: NonNegativeDecimal;
  readonly currency: CurrencyCode;
};

/** An instant measure. */
export type InstantMeasure = { readonly kind: 'instant'; readonly at: Timestamp };

/** A progress measure. */
export type ProgressMeasure = { readonly kind: 'progress'; readonly fraction: ProgressFraction };

/** One provider-neutral measure. */
export type Measure =
  | QuantityMeasure
  | CostMeasure
  | InstantMeasure
  | ProgressMeasure;

/** The subject kinds a distinction record may attach to. */
export type DistinctionSubjectKind =
  | 'solution'
  | 'solution-line'
  | 'work-package'
  | 'activity'
  | 'milestone'
  | 'program'
  | 'delivery';

/** The subject of one distinction record. */
export type DistinctionSubject = {
  readonly solutionId: SolutionId;
  readonly subjectKind: DistinctionSubjectKind;
  readonly subjectId: string;
};

/** Prediction payload. */
export type PredictionPayload = {
  readonly basisRef?: OpaqueReference | undefined;
  readonly predictedFor?: Timestamp | undefined;
};

/** Estimate payload. */
export type EstimatePayload = {
  readonly method?: OpaqueReference | undefined;
  readonly range?: { readonly low: NonNegativeDecimal; readonly high: NonNegativeDecimal } | undefined;
};

/** Baseline payload (the approved solution version reference). */
export type BaselinePayload = {
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
};

/** Commitment payload. */
export type CommitmentPayload = {
  readonly committedBy: PrincipalId;
  readonly committedAt: Timestamp;
  readonly acquisitionId?: AcquisitionId | undefined;
};

/** Observation payload (evidence capture). */
export type ObservationPayload = {
  readonly deliveryId: DeliveryId;
  readonly observedAt: Timestamp;
  readonly observedBy: PrincipalId;
  readonly evidence: EvidenceReference[];
};

/** Actual payload (converted from an accepted observation). */
export type ActualPayload = {
  readonly deliveryId: DeliveryId;
  readonly derivedFromObservationId: DistinctionRecordId;
  readonly actualizedAt: Timestamp;
  readonly actualizedBy: PrincipalId;
};

/** Forecast payload (forecast lineage only). */
export type ForecastPayload = {
  readonly asOf: Timestamp;
  readonly refines: DistinctionRecordId | null;
};

/** Outcome payload. */
export type OutcomePayload = {
  readonly outcomeKind: OutcomeKind;
  readonly verificationRefs: Sha256Hex[];
  readonly note?: string | undefined;
};

/** Learning payload. */
export type LearningPayload = {
  readonly lesson: string;
  readonly links: DistinctionRecordId[];
};

/**
 * The immutable content of one semantic-distinction record (kind
 * discriminator selects the measure/payload shape).
 */
export type DistinctionRecordContent =
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'prediction';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: PredictionPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'estimate';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: EstimatePayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'baseline';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly payload: BaselinePayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'commitment';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: CommitmentPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'observation';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: ObservationPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'actual';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: ActualPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'forecast';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly measure: Measure;
      readonly payload: ForecastPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'outcome';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly payload: OutcomePayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    }
  | {
      readonly schema: 'epoch.solution-delivery.distinction-record';
      readonly schemaVersion: 1;
      readonly kind: 'learning';
      readonly recordId: DistinctionRecordId;
      readonly tenantId: TenantId;
      readonly subject: DistinctionSubject;
      readonly payload: LearningPayload;
      readonly recordedAt: Timestamp;
      readonly recordedBy: PrincipalId;
      readonly uncertainty: UncertaintyState;
    };

/** The sealed semantic-distinction record (content + digest). */
export type SealedDistinctionRecord =
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'prediction';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: PredictionPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'estimate';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: EstimatePayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'baseline';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly payload: BaselinePayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'commitment';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: CommitmentPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'observation';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: ObservationPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'actual';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: ActualPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'forecast';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly measure: Measure;
          readonly payload: ForecastPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'outcome';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly payload: OutcomePayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  }
  | {

          readonly schema: 'epoch.solution-delivery.distinction-record';
          readonly schemaVersion: 1;
          readonly kind: 'learning';
          readonly recordId: DistinctionRecordId;
          readonly tenantId: TenantId;
          readonly subject: DistinctionSubject;
          readonly payload: LearningPayload;
          readonly recordedAt: Timestamp;
          readonly recordedBy: PrincipalId;
          readonly uncertainty: UncertaintyState;
    
    readonly contentDigest: Sha256Hex;
  };

/** The sealed observation record (kind `observation`). */
export type ObservationRecord = {

        readonly schema: 'epoch.solution-delivery.distinction-record';
        readonly schemaVersion: 1;
        readonly kind: 'observation';
        readonly recordId: DistinctionRecordId;
        readonly tenantId: TenantId;
        readonly subject: DistinctionSubject;
        readonly measure: Measure;
        readonly payload: ObservationPayload;
        readonly recordedAt: Timestamp;
        readonly recordedBy: PrincipalId;
        readonly uncertainty: UncertaintyState;
    
  readonly contentDigest: Sha256Hex;
};

/** The sealed actual record (kind `actual`). */
export type ActualRecord = {

        readonly schema: 'epoch.solution-delivery.distinction-record';
        readonly schemaVersion: 1;
        readonly kind: 'actual';
        readonly recordId: DistinctionRecordId;
        readonly tenantId: TenantId;
        readonly subject: DistinctionSubject;
        readonly measure: Measure;
        readonly payload: ActualPayload;
        readonly recordedAt: Timestamp;
        readonly recordedBy: PrincipalId;
        readonly uncertainty: UncertaintyState;
    
  readonly contentDigest: Sha256Hex;
};

/** The append-only distinction ledger (reference machinery). */
export type DistinctionLedger = {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly records: readonly SealedDistinctionRecord[];
};

// ---------------------------------------------------------------------------
// Program of work (the authoritative schedule dimension).
// ---------------------------------------------------------------------------

/** One resource assignment. */
export type ResourceAssignment = {
  readonly resourceId: OpaqueReference;
  readonly quantity: NonNegativeDecimal;
  readonly unit: UnitLabel;
};

/** One work-package approval. */
export type WorkApproval = {
  readonly approvedBy: PrincipalId;
  readonly approvedAt: Timestamp;
  readonly note?: string | undefined;
};

/** One verification gate on an activity. */
export type VerificationGate = {
  readonly gateId: GateId;
  readonly activityId: ActivityId;
  readonly title: string;
  readonly method: OpaqueReference;
  readonly criteria?: string | undefined;
  readonly evidence: EvidenceReference[];
  readonly passedAt?: Timestamp | undefined;
  readonly passedBy?: PrincipalId | undefined;
};

/** One blocker on an activity. */
export type BlockerRecord = {
  readonly blockerId: BlockerId;
  readonly description: string;
  readonly raisedAt: Timestamp;
  readonly raisedBy: PrincipalId;
  readonly impact?: string | undefined;
};

/** One activity of the realization graph. */
export type Activity = {
  readonly activityId: ActivityId;
  readonly workPackageId: WorkPackageId;
  readonly title: string;
  readonly realizationVariant?: RealizationVariant | undefined;
  readonly plannedQuantity?: { readonly value: NonNegativeDecimal; readonly unit: UnitLabel } | undefined;
  readonly plannedCost?: { readonly amount: NonNegativeDecimal; readonly currency: CurrencyCode } | undefined;
  readonly plannedStart?: Timestamp | undefined;
  readonly plannedFinish?: Timestamp | undefined;
  readonly predecessors: ActivityId[];
  readonly successors: ActivityId[];
  readonly resources: ResourceAssignment[];
  readonly responsibleActor?: PrincipalId | undefined;
  readonly constraintReferences: ConstraintReference[];
  readonly actualProgress?: ProgressFraction | undefined;
  readonly actualStart?: Timestamp | undefined;
  readonly actualFinish?: Timestamp | undefined;
  readonly blockers: BlockerRecord[];
  readonly evidence: EvidenceReference[];
  readonly confidence?: ConfidenceState | undefined;
  readonly forecastFinish?: Timestamp | undefined;
};

/** One work package of the realization graph. */
export type WorkPackage = {
  readonly workPackageId: WorkPackageId;
  readonly title: string;
  readonly description?: string | undefined;
  readonly solutionLineId?: SolutionLineId | undefined;
  readonly worldEntityId?: string | undefined;
  readonly realizationVariant: RealizationVariant;
  readonly plannedStart?: Timestamp | undefined;
  readonly plannedFinish?: Timestamp | undefined;
  readonly responsibleActor?: PrincipalId | undefined;
  readonly resources: ResourceAssignment[];
  readonly constraintReferences: ConstraintReference[];
  readonly approvals: WorkApproval[];
  readonly verificationGates: VerificationGate[];
  readonly activities: Activity[];
};

/** Milestone status vocabulary. */
export type MilestoneStatus = 'planned' | 'reached' | 'missed';

/** One milestone record. */
export type MilestoneRecord = {
  readonly milestoneId: MilestoneId;
  readonly title: string;
  readonly targetDate?: Timestamp | undefined;
  readonly activityIds: ActivityId[];
  readonly status: MilestoneStatus;
  readonly reachedAt?: Timestamp | undefined;
  readonly evidence: EvidenceReference[];
};

/** The immutable content of one program of work. */
export type ProgramOfWorkContent = {
  readonly schema: 'epoch.solution-delivery.program-of-work';
  readonly schemaVersion: 1;
  readonly programId: ProgramId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
  readonly title: string;
  readonly workPackages: WorkPackage[];
  readonly milestones: MilestoneRecord[];
  readonly createdAt: Timestamp;
  readonly createdBy: PrincipalId;
};

/** The sealed program of work (content + digest). */
export type SealedProgramOfWork = {
  readonly schema: 'epoch.solution-delivery.program-of-work';
  readonly schemaVersion: 1;
  readonly programId: ProgramId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
  readonly title: string;
  readonly workPackages: WorkPackage[];
  readonly milestones: MilestoneRecord[];
  readonly createdAt: Timestamp;
  readonly createdBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
};

/** One quantity-schedule row. */
export type QuantityScheduleRow = {
  readonly workPackageId: string;
  readonly activityId: string;
  readonly unit: string;
  readonly plannedValue: string;
};

/** One quantity total per unit. */
export type QuantityTotal = { readonly unit: string; readonly totalValue: string };

/** The deterministic quantity schedule. */
export type QuantitySchedule = {
  readonly rows: readonly QuantityScheduleRow[];
  readonly totals: readonly QuantityTotal[];
};

/** One cost-schedule row. */
export type CostScheduleRow = {
  readonly workPackageId: string;
  readonly activityId: string;
  readonly currency: string;
  readonly plannedAmount: string;
};

/** One cost total per currency. */
export type CostTotal = { readonly currency: string; readonly totalAmount: string };

/** The deterministic cost schedule. */
export type CostSchedule = {
  readonly rows: readonly CostScheduleRow[];
  readonly totals: readonly CostTotal[];
};

/** One resource-schedule row. */
export type ResourceScheduleRow = {
  readonly resourceId: string;
  readonly unit: string;
  readonly totalQuantity: string;
  readonly workPackageIds: readonly string[];
};

/** The deterministic resource schedule. */
export type ResourceSchedule = { readonly rows: readonly ResourceScheduleRow[] };

/** One milestone-schedule row. */
export type MilestoneScheduleRow = {
  readonly milestoneId: string;
  readonly title: string;
  readonly status: string;
  readonly targetDate?: string | undefined;
  readonly reachedAt?: string | undefined;
  readonly activityIds: readonly string[];
};

/** The deterministic milestone schedule. */
export type MilestoneSchedule = {
  readonly rows: readonly MilestoneScheduleRow[];
  readonly counts: Readonly<Record<string, number>>;
};

/** The realization-variant summary. */
export type RealizationSummary = {
  readonly counts: Readonly<Record<RealizationVariant, number>>;
};

// ---------------------------------------------------------------------------
// Delivery records (the delivery-facts authority).
// ---------------------------------------------------------------------------

/** Delivery lifecycle status. */
export type DeliveryStatus = 'open' | 'closed';

/** The immutable content of one delivery record state. */
export type DeliveryRecordContent = {
  readonly schema: 'epoch.solution-delivery.delivery-record';
  readonly schemaVersion: 1;
  readonly deliveryId: DeliveryId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
  readonly openedAt: Timestamp;
  readonly openedBy: PrincipalId;
  readonly status: DeliveryStatus;
  readonly closedAt?: Timestamp | undefined;
  readonly closedBy?: PrincipalId | undefined;
  readonly observations: ObservationRecord[];
  readonly acceptedObservationIds: DistinctionRecordId[];
  readonly rejectedObservationIds: DistinctionRecordId[];
  readonly actuals: ActualRecord[];
};

/** The sealed delivery record (content + digest). */
export type SealedDeliveryRecord = {
  readonly schema: 'epoch.solution-delivery.delivery-record';
  readonly schemaVersion: 1;
  readonly deliveryId: DeliveryId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
  readonly openedAt: Timestamp;
  readonly openedBy: PrincipalId;
  readonly status: DeliveryStatus;
  readonly closedAt?: Timestamp | undefined;
  readonly closedBy?: PrincipalId | undefined;
  readonly observations: ObservationRecord[];
  readonly acceptedObservationIds: DistinctionRecordId[];
  readonly rejectedObservationIds: DistinctionRecordId[];
  readonly actuals: ActualRecord[];
  readonly contentDigest: Sha256Hex;
};

/** The acceptance provenance of one observation. */
export type ObservationAcceptance = {
  readonly acceptedBy: string;
  readonly acceptedAt: string;
};

/** The rejection provenance of one observation. */
export type ObservationRejection = {
  readonly rejectedBy: string;
  readonly rejectedAt: string;
  readonly reason?: string | undefined;
};

/** The actualization provenance of one observation. */
export type Actualization = {
  readonly actualId: string;
  readonly actualizedBy: string;
  readonly actualizedAt: string;
};

/** The closing provenance of a delivery. */
export type DeliveryClosing = { readonly closedBy: string; readonly closedAt: string };

/** One actual-total row of the delivery state. */
export type DeliveryActualTotal = {
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly measureKind: 'quantity' | 'cost';
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly total: string;
};

/** The deterministic actuals summary of a delivery state. */
export type DeliveryActualsSummary = {
  readonly actualCount: number;
  readonly observationCounts: {
    readonly total: number;
    readonly accepted: number;
    readonly rejected: number;
    readonly proposed: number;
  };
  readonly totals: readonly DeliveryActualTotal[];
};

// ---------------------------------------------------------------------------
// The universal lifecycle + domain pack profiles.
// ---------------------------------------------------------------------------

/** The lifecycle subject kinds. */
export type LifecycleSubjectKind = 'solution-package' | 'delivery-record';

/** The subject whose lifecycle the stage records trace. */
export type LifecycleSubject = {
  readonly solutionId: SolutionId;
  readonly subjectKind: LifecycleSubjectKind;
  readonly subjectId: string;
};

/** The projected status of one stage record (derived from transitions). */
export type StageProjectedStatus = 'active' | 'paused';

/** One lifecycle stage record. */
export type LifecycleStageRecord = {
  readonly schema: 'epoch.solution-delivery.lifecycle-stage';
  readonly schemaVersion: 1;
  readonly recordId: StageRecordId;
  readonly tenantId: TenantId;
  readonly subject: LifecycleSubject;
  readonly stage: UniversalLifecycleStage;
  readonly enteredAt: Timestamp;
  readonly enteredBy: PrincipalId;
  readonly note?: string | undefined;
};

/** One lifecycle transition record (a typed relation between stage records). */
export type LifecycleTransitionRecord = {
  readonly schema: 'epoch.solution-delivery.lifecycle-transition';
  readonly schemaVersion: 1;
  readonly recordId: TransitionRecordId;
  readonly tenantId: TenantId;
  readonly subject: LifecycleSubject;
  readonly relation: LifecycleTransitionRelation;
  readonly fromStageRecordId: StageRecordId;
  readonly toStageRecordId: StageRecordId;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly note?: string | undefined;
};

/** The lifecycle graph state (stages + transitions, canonically ordered). */
export type LifecycleGraph = {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly stages: readonly LifecycleStageRecord[];
  readonly transitions: readonly LifecycleTransitionRecord[];
};

/** One lifecycle stage projection (fold output). */
export type LifecycleStageProjection = {
  readonly recordId: string;
  readonly stage: UniversalLifecycleStage;
  readonly subjectId: string;
  readonly enteredAt: string;
  readonly status: StageProjectedStatus;
  readonly relationsOut: readonly { readonly relation: LifecycleTransitionRelation; readonly toStageRecordId: string }[];
  readonly relationsIn: readonly { readonly relation: LifecycleTransitionRelation; readonly fromStageRecordId: string }[];
};

/** One pack projection rule. */
export type ProjectionRule = {
  readonly projection: NavigatorProjectionKind;
  readonly presentation: string;
};

/** The machine-readable domain-pack profile (DP1.0). */
export type SolutionPackProfile = {
  readonly schema: 'epoch.solution-delivery.pack-profile';
  readonly schemaVersion: 1;
  readonly packId: QualifiedName;
  readonly packVersion: SemverCore;
  readonly tenantId: TenantId;
  readonly supportedLifecycleVersion: string;
  readonly stageVocabulary: { [stage in UniversalLifecycleStage]: string };
  readonly projectionRules: ProjectionRule[];
  readonly measurementNote?: string | undefined;
  readonly capabilityDependencies?: QualifiedName[] | undefined;
  readonly migrationNote?: string | undefined;
};

// ---------------------------------------------------------------------------
// Acquisition (the universal Acquire contract).
// ---------------------------------------------------------------------------

/** One acquisition line. */
export type AcquisitionLine = {
  readonly description: string;
  readonly quantity: NonNegativeDecimal;
  readonly unit: UnitLabel;
  readonly solutionLineId?: SolutionLineId | undefined;
  readonly externalPartyRef?: OpaqueReference | undefined;
};

/** The variant-specific request detail (discriminated by `variant`). */
export type AcquisitionRequestDetail =
  | { readonly variant: 'external-procurement'; readonly lines: AcquisitionLine[] }
  | {
      readonly variant: 'internal-allocation';
      readonly resourceRef: OpaqueReference;
      readonly quantity: NonNegativeDecimal;
      readonly unit: UnitLabel;
      readonly fromScope?: OpaqueReference | undefined;
    }
  | {
      readonly variant: 'subscription-license';
      readonly licenseRef?: OpaqueReference | undefined;
      readonly seats: number;
      readonly termNote?: string | undefined;
    }
  | {
      readonly variant: 'cloud-service-provisioning';
      readonly serviceKind: string;
      readonly capacityNote?: string | undefined;
    }
  | {
      readonly variant: 'fabrication-request';
      readonly designRef?: OpaqueReference | undefined;
      readonly quantity: NonNegativeDecimal;
      readonly unit: UnitLabel;
    }
  | {
      readonly variant: 'specialist-capability-assignment';
      readonly capabilityRef: OpaqueReference;
      readonly assignee?: PrincipalId | undefined;
    }
  | { readonly variant: 'data-evidence-acquisition'; readonly subjectRef: OpaqueReference };

/** One acquisition request record. */
export type AcquisitionRequestRecord = {
  readonly schema: 'epoch.solution-delivery.acquisition-request';
  readonly schemaVersion: 1;
  readonly acquisitionId: AcquisitionId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId?: DeliveryId | undefined;
  readonly detail: AcquisitionRequestDetail;
  readonly requestedAt: Timestamp;
  readonly requestedBy: PrincipalId;
  readonly neededBy?: Timestamp | undefined;
  readonly note?: string | undefined;
};

/** One acquisition fulfillment record. */
export type AcquisitionFulfillmentRecord = {
  readonly schema: 'epoch.solution-delivery.acquisition-fulfillment';
  readonly schemaVersion: 1;
  readonly fulfillmentId: string;
  readonly tenantId: TenantId;
  readonly acquisitionId: AcquisitionId;
  readonly fulfilledAt: Timestamp;
  readonly fulfilledBy: PrincipalId;
  readonly externalReference?: OpaqueReference | undefined;
  readonly note?: string | undefined;
};

// ---------------------------------------------------------------------------
// Information-acquisition requests (the decision-sufficiency rule).
// ---------------------------------------------------------------------------

/** The materiality of an unknown's expected decision impact. */
export type DecisionImpactMateriality = 'material' | 'immaterial';

/** Which decision the requested information can change. */
export type DecisionImpactKind =
  | 'solution-selection'
  | 'constraint-compliance'
  | 'safety-boundary'
  | 'authority-boundary'
  | 'verification-result'
  | 'cost-basis'
  | 'schedule-basis'
  | 'resource-allocation';

/** The decision impact of the requested information. */
export type DecisionImpact = {
  readonly stage: UniversalLifecycleStage;
  readonly decisionKind: DecisionImpactKind;
  readonly materiality: DecisionImpactMateriality;
  readonly rationale: string;
};

/** The freshness requirement of one request. */
export type FreshnessRequirement = {
  readonly state: 'fresh' | 'aging' | 'stale';
  readonly assessedAt: Timestamp;
};

/** One information-acquisition request. */
export type InformationAcquisitionRequest = {
  readonly schema: 'epoch.solution-delivery.info-request';
  readonly schemaVersion: 1;
  readonly requestId: InfoRequestId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly requestedInformation: string;
  readonly decisionImpact: DecisionImpact;
  readonly freshnessRequirement?: FreshnessRequirement | undefined;
  readonly requestedFrom?: OpaqueReference | undefined;
  readonly issuedAt: Timestamp;
  readonly issuedBy: PrincipalId;
  readonly status: 'open' | 'fulfilled' | 'abandoned';
  readonly fulfillment?:
    | {
        readonly evidence: EvidenceReference[];
        readonly fulfilledAt: Timestamp;
        readonly fulfilledBy: PrincipalId;
        readonly uncertainty: UncertaintyState;
      }
    | undefined;
};

// ---------------------------------------------------------------------------
// Provider-neutral external request/event seam.
// ---------------------------------------------------------------------------

/** The typed outbound request kinds. */
export type ExternalRequestKind =
  | 'acquisition-order'
  | 'information-request'
  | 'status-check'
  | 'alert';

/** The typed inbound event kinds. */
export type ExternalEventKind =
  | 'observation-report'
  | 'status-update'
  | 'acknowledgment';

/** The outbound external-request envelope. */
export type ExternalRequestEnvelope = {
  readonly schema: 'epoch.solution-delivery.external-request';
  readonly schemaVersion: 1;
  readonly requestId: ExternalRequestId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly kind: ExternalRequestKind;
  readonly targetSystemRef: OpaqueReference;
  readonly correlationKey: string;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly issuedAt: Timestamp;
  readonly issuedBy: PrincipalId;
};

/** The inbound external-event envelope. */
export type ExternalEventEnvelope = {
  readonly schema: 'epoch.solution-delivery.external-event';
  readonly schemaVersion: 1;
  readonly eventId: ExternalEventId;
  readonly tenantId: TenantId;
  readonly kind: ExternalEventKind;
  readonly sourceSystemRef: OpaqueReference;
  readonly correlationKey: string;
  readonly payload: Readonly<Record<string, JsonValue>>;
  readonly occurredAt: Timestamp;
};

/** The correlated pairing of one inbound event with its outbound request. */
export type CorrelatedExchange = {
  readonly request: ExternalRequestEnvelope;
  readonly event: ExternalEventEnvelope;
};

/** The adapter context: how one correlated event becomes an observation. */
export type ExternalObservationContext = {
  readonly observationRecordId: string;
  readonly deliveryId: string;
  readonly subject: DistinctionSubject;
  readonly measure: Measure;
  readonly observedBy: string;
  readonly observedAt: string;
  readonly uncertainty: UncertaintyState;
};

// ---------------------------------------------------------------------------
// The delivery:* event vocabulary (the W010 event shapes).
// ---------------------------------------------------------------------------

/** One delivery event sequence number. */
export type DeliveryEventSequence = number;

/** The causal parent reference of a delivery event. */
export type DeliveryCausalParent = {
  readonly streamId: DeliveryStreamId;
  readonly sequence: DeliveryEventSequence;
};

/** The typed event payload of a delivery event (the W010 shape). */
export type DeliveryEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** The immutable content of one delivery event (the W010 mirror). */
export type DeliveryEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: DeliveryStreamId;
  readonly sequence: DeliveryEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: DeliveryCausalParent | null;
  readonly payload: DeliveryEventPayload;
  readonly occurredAt: Timestamp;
};

/** The sealed delivery event (content + digest). */
export type SealedDeliveryEvent = {
  readonly schemaVersion: 1;
  readonly streamId: DeliveryStreamId;
  readonly sequence: DeliveryEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: DeliveryCausalParent | null;
  readonly payload: DeliveryEventPayload;
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};

/** Payload data of `delivery:stage-entered`. */
export type StageEnteredData = {
  readonly solutionId: SolutionId;
  readonly subjectId: string;
  readonly stage: UniversalLifecycleStage;
  readonly stageRecordId: StageRecordId;
  readonly enteredAt: Timestamp;
};

/** Payload data of `delivery:stage-transition`. */
export type StageTransitionData = {
  readonly solutionId: SolutionId;
  readonly subjectId: string;
  readonly relation: LifecycleTransitionRelation;
  readonly fromStageRecordId: StageRecordId;
  readonly toStageRecordId: StageRecordId;
  readonly recordedAt: Timestamp;
};

/** Payload data of `delivery:baseline-approved`. */
export type BaselineApprovedData = {
  readonly solutionId: SolutionId;
  readonly version: string;
  readonly baselineDigest: Sha256Hex;
  readonly approvedBy: PrincipalId;
  readonly approvedAt: Timestamp;
};

/** Payload data of `delivery:baseline-revision`. */
export type BaselineRevisionData = {
  readonly solutionId: SolutionId;
  readonly version: string;
  readonly previousVersionDigest: Sha256Hex | null;
  readonly contentDigest: Sha256Hex;
  readonly createdAt: Timestamp;
};

/** Payload data of the observation event kinds. */
export type ObservationEventData = {
  readonly deliveryId: DeliveryId;
  readonly observationId: DistinctionRecordId;
  readonly at: Timestamp;
};

/** Payload data of `delivery:observation-actualized`. */
export type ObservationActualizedData = {
  readonly deliveryId: DeliveryId;
  readonly observationId: DistinctionRecordId;
  readonly actualId: DistinctionRecordId;
  readonly actualizedAt: Timestamp;
};

/** Payload data of `delivery:acquisition-requested`. */
export type AcquisitionRequestedData = {
  readonly acquisitionId: AcquisitionId;
  readonly variant: AcquisitionVariant;
  readonly requestedAt: Timestamp;
};

/** Payload data of `delivery:acquisition-fulfilled`. */
export type AcquisitionFulfilledData = {
  readonly acquisitionId: AcquisitionId;
  readonly fulfilledAt: Timestamp;
};

/** Payload data of `delivery:milestone-reached`. */
export type MilestoneReachedData = {
  readonly programId: ProgramId;
  readonly milestoneId: MilestoneId;
  readonly reachedAt: Timestamp;
};

/** Payload data of `delivery:forecast-recorded`. */
export type ForecastRecordedData = {
  readonly forecastRecordId: DistinctionRecordId;
  readonly asOf: Timestamp;
  readonly refines: DistinctionRecordId | null;
};

/** Payload data of `delivery:outcome-recorded`. */
export type OutcomeRecordedData = {
  readonly outcomeRecordId: DistinctionRecordId;
  readonly outcomeKind: OutcomeKind;
  readonly recordedAt: Timestamp;
};

/** Payload data of `delivery:learning-recorded`. */
export type LearningRecordedData = {
  readonly learningRecordId: DistinctionRecordId;
  readonly recordedAt: Timestamp;
};

/** Payload data of `delivery:info-request-issued`. */
export type InfoRequestIssuedData = {
  readonly requestId: InfoRequestId;
  readonly decisionImpact: DecisionImpactMateriality;
  readonly issuedAt: Timestamp;
};

// ---------------------------------------------------------------------------
// Solution Navigator projections (SN1.0).
// ---------------------------------------------------------------------------

/** The inputs of one Navigator projection. */
export type NavigatorInputs = {
  readonly solutionChain: readonly SealedSolutionVersion[];
  readonly approvals?: readonly BaselineApproval[] | undefined;
  readonly program?: SealedProgramOfWork | undefined;
  readonly delivery?: SealedDeliveryRecord | undefined;
  readonly ledger?: DistinctionLedger | undefined;
  readonly acquisitions?: readonly AcquisitionRequestRecord[] | undefined;
  readonly packProfile?: SolutionPackProfile | undefined;
};

/** One world-entity view. */
export type WorldEntityView = {
  readonly entityId: string;
  readonly solutionLineIds: readonly string[];
};

/** One work-package view. */
export type WorkPackageView = {
  readonly workPackageId: string;
  readonly realizationVariant: string;
  readonly activityIds: readonly string[];
  readonly solutionLineId?: string | undefined;
  readonly worldEntityId?: string | undefined;
};

/** One verification-gate view. */
export type VerificationGateView = {
  readonly gateId: string;
  readonly activityId: string;
  readonly title: string;
  readonly passedAt?: string | undefined;
};

/** One acquisition view. */
export type AcquisitionRequestView = {
  readonly acquisitionId: string;
  readonly variant: string;
  readonly requestedAt: string;
  readonly deliveryId?: string | undefined;
};

/** One observation view. */
export type ObservationView = {
  readonly recordId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly observedAt: string;
  readonly accepted: boolean;
};

/** One actual view. */
export type ActualView = {
  readonly recordId: string;
  readonly derivedFromObservationId: string;
  readonly actualizedAt: string;
};

/** The synchronized Navigator projection (the SN1.0 views). */
export type NavigatorProjection = {
  readonly solutionId: string;
  readonly tenantId: string;
  readonly headVersion: string;
  readonly headDigest: string;
  readonly baselineApproved: boolean;
  readonly worldView: readonly WorldEntityView[];
  readonly solution: readonly {
    readonly lineId: string;
    readonly title: string;
    readonly quantity: { readonly value: string; readonly unit: string };
    readonly worldEntityId?: string | undefined;
  }[];
  readonly decision: readonly BaselineApproval[];
  readonly programOfWork: readonly WorkPackageView[];
  readonly schedule: {
    readonly quantity: QuantitySchedule;
    readonly cost: CostSchedule;
    readonly resource: ResourceSchedule;
    readonly milestone: MilestoneSchedule;
  };
  readonly acquisition: readonly AcquisitionRequestView[];
  readonly realization: RealizationSummary;
  readonly verification: readonly VerificationGateView[];
  readonly observations: readonly ObservationView[];
  readonly actuals: readonly ActualView[];
  readonly forecast: readonly SealedDistinctionRecord[];
  readonly outcomes: readonly SealedDistinctionRecord[];
  readonly learning: readonly SealedDistinctionRecord[];
  readonly packProfile?: SolutionPackProfile | undefined;
};

/** The identity-preserving chain from one world entity. */
export type WorldEntityChain = {
  readonly entityId: string;
  readonly solutionLineIds: readonly string[];
  readonly workPackageIds: readonly string[];
  readonly activityIds: readonly string[];
  readonly observationIds: readonly string[];
  readonly actualIds: readonly string[];
  readonly gateIds: readonly string[];
  readonly outcomeIds: readonly string[];
};
