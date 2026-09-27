/**
 * Epoch Learning Calibration v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/learning-calibration` ownership boundary (Work Order W040).
 * It is self-contained: no imports, no runtime code, no vendor/brand
 * vocabulary. The runtime implementation lives in
 * `@epoch/learning-calibration` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's
 * zod-inferred types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (USL1.0 / architecture lock): the W036 DistinctionLedger and
 * DeliveryRecord are the delivery-facts authority; the W039
 * actualization/variance kernels are the comparison-fact and variance
 * authority. This surface only folds SEALED records from those
 * authorities (read-only, history-immutable — no write path exists) and
 * carries typed references onto them, never replacement copies.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published learning-calibration contract surface. */
export type LearningCalibrationContractVersion = '1.0.0';

/** The W039 observation-group validation states (mirrored). */
export type LearningValidationState =
  | 'insufficient'
  | 'corroborated'
  | 'conflicting'
  | 'resolved';

/** The W039 forecast-bias directions (mirrored). */
export type LearningForecastBiasDirection = 'over-forecast' | 'under-forecast' | 'exact';

/** The typed eligibility states of one outcome-learning candidate. */
export type LearningEligibilityState =
  | 'eligible'
  | 'excluded-unvalidated'
  | 'excluded-unresolved'
  | 'excluded-foreign-tenant';

/** The typed exclusion states (the eligibility states minus `eligible`). */
export type LearningExclusionState =
  | 'excluded-unvalidated'
  | 'excluded-unresolved'
  | 'excluded-foreign-tenant';

/** The closed exclusion-reason vocabulary. */
export type LearningExclusionReason =
  | 'tenant-mismatch'
  | 'outcome-kind-unaccepted'
  | 'outcome-kind-residual'
  | 'observation-group-insufficient'
  | 'observation-group-conflicting';

/** The W039 variance classes (mirrored). */
export type LearningVarianceClass =
  | 'quantity'
  | 'price-rate'
  | 'productivity'
  | 'schedule'
  | 'waste'
  | 'rework'
  | 'change'
  | 'external-condition';

/** The W039 variance directions (mirrored). */
export type LearningVarianceDirection = 'favorable' | 'adverse' | 'neutral';

/** The W039 magnitude bands (mirrored). */
export type LearningVarianceMagnitudeBand = 'immaterial' | 'minor' | 'material' | 'severe';

/** The W039 attribution cause kinds (mirrored). */
export type LearningAttributionCauseKind =
  | 'change-record'
  | 'issue-record'
  | 'external-condition';

/** The attribution feature kinds (mirrored kinds plus `unattributed`). */
export type LearningAttributionFeatureKind =
  | 'change-record'
  | 'issue-record'
  | 'external-condition'
  | 'unattributed';

/** The measure classes of dataset rows and model applicability. */
export type LearningMeasureClass = 'quantity' | 'cost' | 'progress' | 'instant';

/** The calibration-metric summary kinds every metric set folds. */
export type LearningMetricSummaryKind = 'bias' | 'mean-absolute-error' | 'hit-rate';

/** The W005-convention justification kinds of metric sets and proposals. */
export type LearningJustificationKind =
  | 'dataset'
  | 'model'
  | 'fold-definition'
  | 'observation';

/** The learning:* lifecycle event payload discriminators (W010 namespace). */
export type LearningEventDiscriminator =
  | 'learning:record-intaken'
  | 'learning:dataset-assembled'
  | 'learning:dataset-replayed'
  | 'learning:metrics-folded'
  | 'learning:revision-proposed'
  | 'learning:revision-admitted'
  | 'learning:state-projected'
  | 'learning:pack-view-projected';

/** The W036 closed realization-variant catalog (composed). */
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

/** Canonical non-negative decimal amount as a string. */
export type NonNegativeDecimal = string;

/** Qualified (dotted) name. */
export type QualifiedName = string;

/** Semantic-version core string (MAJOR.MINOR.PATCH). */
export type SemverCore = string;

/** Unit label of a quantity measure. */
export type UnitLabel = string;

/** ISO-4217-style currency code (three uppercase letters). */
export type CurrencyCode = string;

// ---------------------------------------------------------------------------
// Record identities (kind-prefixed opaque slugs).
// ---------------------------------------------------------------------------

/** Outcome-learning candidate identity: "candidate:<slug>". */
export type LearningCandidateId = string;

/** Learning-dataset identity: "dataset:<slug>". */
export type LearningDatasetId = string;

/** Dataset-row identity: "row:<slug>". */
export type LearningRowId = string;

/** Typed exclusion-record identity: "exclusion:<slug>". */
export type LearningExclusionId = string;

/** Calibration-metric-set identity: "metrics:<slug>". */
export type LearningMetricId = string;

/** Model registry identity: "model:<slug>". */
export type LearningModelId = string;

/** Model-revision identity: "model-revision:<slug>". */
export type LearningRevisionId = string;

/** Model-revision-proposal identity: "proposal:<slug>". */
export type LearningProposalId = string;

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
export type Measure = QuantityMeasure | CostMeasure | InstantMeasure | ProgressMeasure;

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

/** The outcome payload of a W036 Outcome-distinction record. */
export type OutcomePayload = {
  readonly outcomeKind:
    | 'delivered'
    | 'accepted'
    | 'handover'
    | 'residual'
    | 'rejected'
    | 'abandoned';
  readonly verificationRefs: Sha256Hex[];
  readonly note?: string | undefined;
};

/** The sealed W036 OUTCOME-distinction record (the composed authority record). */
export type SealedOutcomeRecord = {
  readonly schema: 'epoch.solution-delivery.distinction-record';
  readonly schemaVersion: 1;
  readonly recordId: string;
  readonly tenantId: TenantId;
  readonly subject: DistinctionSubject;
  readonly kind: 'outcome';
  readonly payload: OutcomePayload;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly uncertainty: UncertaintyState;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The opaque W039 comparison-fact mirror (kernel parity with actualization).
// ---------------------------------------------------------------------------

/** One exact-revision reference to a variance-kernel comparison record. */
export type ComparisonRecordReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** One exact-revision reference to the compared forecast revision. */
export type ForecastSideReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** One exact-revision reference to the actualized outcome side. */
export type ActualSideReference = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** The mirrored W039 comparison-fact content (identical to the W039 record). */
export type ComparisonFactInput = {
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
  readonly bias: LearningForecastBiasDirection;
  readonly observedAt: Timestamp;
};

/** The sealed comparison-fact input (content plus its content digest). */
export type SealedComparisonFactInput = {
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
  readonly bias: LearningForecastBiasDirection;
  readonly observedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Evidence records + the domain-pack reference (DP1.0 by typed reference).
// ---------------------------------------------------------------------------

/** The validation-state evidence of the observation group behind the actual. */
export type ValidationStateEvidence = {
  readonly state: LearningValidationState;
  readonly assessmentRef: {
    readonly recordId: string;
    readonly contentDigest: Sha256Hex;
  };
};

/** One opaque typed root-cause attribution (the W039 cause grammar). */
export type LearningCauseRef =
  | {
      readonly causeKind: 'change-record';
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    }
  | {
      readonly causeKind: 'issue-record';
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    }
  | {
      readonly causeKind: 'external-condition';
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    };

/** The variance evidence of the compared deviation. */
export type VarianceEvidence = {
  readonly varianceClass: LearningVarianceClass;
  readonly varianceRecordRef: {
    readonly recordId: string;
    readonly contentDigest: Sha256Hex;
  };
  readonly attribution: {
    readonly cause: LearningCauseRef;
    readonly evidence: Sha256Hex[];
  } | null;
};

/** The typed exact-revision domain-pack reference (the W036 pack profile). */
export type PackReference = {
  readonly packId: string;
  readonly packVersion: SemverCore;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The outcome-learning candidate + typed exclusion records.
// ---------------------------------------------------------------------------

/** The immutable content of one outcome-learning candidate. */
export type OutcomeLearningCandidate = {
  readonly schema: 'epoch.learning-calibration.candidate';
  readonly schemaVersion: 1;
  readonly candidateId: LearningCandidateId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly comparisonFact: SealedComparisonFactInput;
  readonly outcome: SealedOutcomeRecord;
  readonly validationEvidence: ValidationStateEvidence;
  readonly varianceEvidence: VarianceEvidence;
  readonly packRef: PackReference;
  readonly realizationVariant: RealizationVariant;
};

/** The sealed outcome-learning candidate. */
export type SealedOutcomeLearningCandidate = {
  readonly schema: 'epoch.learning-calibration.candidate';
  readonly schemaVersion: 1;
  readonly candidateId: LearningCandidateId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly comparisonFact: SealedComparisonFactInput;
  readonly outcome: SealedOutcomeRecord;
  readonly validationEvidence: ValidationStateEvidence;
  readonly varianceEvidence: VarianceEvidence;
  readonly packRef: PackReference;
  readonly realizationVariant: RealizationVariant;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one typed exclusion record (never a silent drop). */
export type ExclusionRecordContent = {
  readonly schema: 'epoch.learning-calibration.exclusion-record';
  readonly schemaVersion: 1;
  readonly exclusionId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly candidateRef: {
    readonly recordId: LearningCandidateId;
    readonly contentDigest: Sha256Hex;
  };
  readonly state: LearningExclusionState;
  readonly reasons: LearningExclusionReason[];
};

/** The sealed typed exclusion record. */
export type SealedExclusionRecord = {
  readonly schema: 'epoch.learning-calibration.exclusion-record';
  readonly schemaVersion: 1;
  readonly exclusionId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly candidateRef: {
    readonly recordId: LearningCandidateId;
    readonly contentDigest: Sha256Hex;
  };
  readonly state: LearningExclusionState;
  readonly reasons: LearningExclusionReason[];
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Error/variance features + band thresholds.
// ---------------------------------------------------------------------------

/** The magnitude-band thresholds of dataset assembly (the W039 grammar, mirrored). */
export type LearningBandThresholds = {
  readonly minor: NonNegativeDecimal;
  readonly material: NonNegativeDecimal;
  readonly severe: NonNegativeDecimal;
};

/** The per-row error/variance feature vector. */
export type ErrorVarianceFeatures = {
  readonly schema: 'epoch.learning-calibration.error-variance-features';
  readonly schemaVersion: 1;
  readonly deviationMagnitude: NonNegativeDecimal;
  readonly bias: LearningForecastBiasDirection;
  readonly varianceClass: LearningVarianceClass;
  readonly direction: LearningVarianceDirection;
  readonly magnitudeBand: LearningVarianceMagnitudeBand;
  readonly attributionCauseKind: LearningAttributionFeatureKind;
  readonly attributionEvidenceCount: number;
};

// ---------------------------------------------------------------------------
// The prediction-to-outcome dataset.
// ---------------------------------------------------------------------------

/** The immutable content of one dataset row. */
export type DatasetRowContent = {
  readonly schema: 'epoch.learning-calibration.dataset-row';
  readonly schemaVersion: 1;
  readonly rowId: LearningRowId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly predictionRef: ForecastSideReference;
  readonly outcomeRef: {
    readonly recordId: string;
    readonly contentDigest: Sha256Hex;
  };
  readonly actualRef: ActualSideReference;
  readonly comparisonRef: ComparisonRecordReference;
  readonly measureClass: LearningMeasureClass;
  readonly unit?: UnitLabel | undefined;
  readonly currency?: CurrencyCode | undefined;
  readonly features: ErrorVarianceFeatures;
  readonly packRef: PackReference;
  readonly realizationVariant: RealizationVariant;
  readonly observedAt: Timestamp;
  readonly provenance: {
    readonly comparisonFact: {
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    };
    readonly outcomeRecord: {
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    };
  };
};

/** The sealed dataset row. */
export type SealedDatasetRow = {
  readonly schema: 'epoch.learning-calibration.dataset-row';
  readonly schemaVersion: 1;
  readonly rowId: LearningRowId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: DistinctionSubject;
  readonly predictionRef: ForecastSideReference;
  readonly outcomeRef: {
    readonly recordId: string;
    readonly contentDigest: Sha256Hex;
  };
  readonly actualRef: ActualSideReference;
  readonly comparisonRef: ComparisonRecordReference;
  readonly measureClass: LearningMeasureClass;
  readonly unit?: UnitLabel | undefined;
  readonly currency?: CurrencyCode | undefined;
  readonly features: ErrorVarianceFeatures;
  readonly packRef: PackReference;
  readonly realizationVariant: RealizationVariant;
  readonly observedAt: Timestamp;
  readonly provenance: {
    readonly comparisonFact: {
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    };
    readonly outcomeRecord: {
      readonly recordId: string;
      readonly contentDigest: Sha256Hex;
    };
  };
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one learning dataset (the deterministic fold). */
export type LearningDatasetContent = {
  readonly schema: 'epoch.learning-calibration.dataset';
  readonly schemaVersion: 1;
  readonly datasetId: LearningDatasetId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly assemblyPolicy: {
    readonly bandThresholds: LearningBandThresholds;
    readonly eligibilityRulesetVersion: 1;
  };
  readonly rows: SealedDatasetRow[];
  readonly exclusions: SealedExclusionRecord[];
  readonly eligibleCount: number;
  readonly excludedCount: number;
  readonly inputDigests: Sha256Hex[];
};

/** The sealed learning dataset. */
export type SealedLearningDataset = {
  readonly schema: 'epoch.learning-calibration.dataset';
  readonly schemaVersion: 1;
  readonly datasetId: LearningDatasetId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly assemblyPolicy: {
    readonly bandThresholds: LearningBandThresholds;
    readonly eligibilityRulesetVersion: 1;
  };
  readonly rows: SealedDatasetRow[];
  readonly exclusions: SealedExclusionRecord[];
  readonly eligibleCount: number;
  readonly excludedCount: number;
  readonly inputDigests: Sha256Hex[];
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Calibration metrics.
// ---------------------------------------------------------------------------

/** The applicability scope of one fold (and of the model revision it calibrates). */
export type LearningApplicability = {
  readonly measureClass: LearningMeasureClass;
  readonly packId: string | null;
  readonly realizationVariant: RealizationVariant | null;
};

/** The declared tolerance bands of one hit-rate fold (non-degenerate scales). */
export type ToleranceBands = NonNegativeDecimal[];

/** One signed deviation value: sign + canonical magnitude. */
export type SignedDeviation = {
  readonly negative: boolean;
  readonly magnitude: NonNegativeDecimal;
};

/** The bias summary of one fold. */
export type BiasSummary = {
  readonly overCount: number;
  readonly underCount: number;
  readonly exactCount: number;
  readonly overTotalDeviation: NonNegativeDecimal;
  readonly underTotalDeviation: NonNegativeDecimal;
  readonly netDeviation: SignedDeviation;
  readonly meanDeviation: SignedDeviation;
};

/** The MAE-class summary of one fold. */
export type MeanAbsoluteErrorSummary = {
  readonly totalAbsoluteDeviation: NonNegativeDecimal;
  readonly mean: NonNegativeDecimal;
  readonly worstDeviation: {
    readonly rowId: LearningRowId;
    readonly deviation: NonNegativeDecimal;
  } | null;
};

/** One hit-rate summary at a declared tolerance band. */
export type HitRateSummary = {
  readonly tolerance: NonNegativeDecimal;
  readonly withinCount: number;
  readonly outsideCount: number;
  readonly hitRate: NonNegativeDecimal;
};

/** One per-domain-pack breakdown slice. */
export type PackBreakdown = {
  readonly packId: string;
  readonly rowCount: number;
  readonly overCount: number;
  readonly underCount: number;
  readonly exactCount: number;
  readonly totalAbsoluteDeviation: NonNegativeDecimal;
};

/** One per-realization-variant breakdown slice. */
export type VariantBreakdown = {
  readonly realizationVariant: RealizationVariant;
  readonly rowCount: number;
  readonly overCount: number;
  readonly underCount: number;
  readonly exactCount: number;
  readonly totalAbsoluteDeviation: NonNegativeDecimal;
};

/** One W005-convention machine-referenceable justification entry. */
export type MetricJustification = {
  readonly kind: LearningJustificationKind;
  readonly reference: string;
};

/** The immutable content of one calibration-metric set. */
export type CalibrationMetricSetContent = {
  readonly schema: 'epoch.learning-calibration.calibration-metric-set';
  readonly schemaVersion: 1;
  readonly metricId: LearningMetricId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly modelRef: {
    readonly modelId: LearningModelId;
    readonly revisionId: LearningRevisionId;
    readonly contentDigest: Sha256Hex;
  };
  readonly foldDefinition: {
    readonly datasetRef: {
      readonly datasetId: LearningDatasetId;
      readonly contentDigest: Sha256Hex;
    };
    readonly applicability: LearningApplicability;
    readonly toleranceBands: ToleranceBands;
    readonly metricSpecVersion: 1;
  };
  readonly summaryKinds: LearningMetricSummaryKind[];
  readonly selectedRowCount: number;
  readonly bias: BiasSummary;
  readonly meanAbsoluteError: MeanAbsoluteErrorSummary;
  readonly hitRates: HitRateSummary[];
  readonly packBreakdowns: PackBreakdown[];
  readonly variantBreakdowns: VariantBreakdown[];
  readonly justification: MetricJustification[];
};

/** The sealed calibration-metric set. */
export type SealedCalibrationMetricSet = {
  readonly schema: 'epoch.learning-calibration.calibration-metric-set';
  readonly schemaVersion: 1;
  readonly metricId: LearningMetricId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly modelRef: {
    readonly modelId: LearningModelId;
    readonly revisionId: LearningRevisionId;
    readonly contentDigest: Sha256Hex;
  };
  readonly foldDefinition: {
    readonly datasetRef: {
      readonly datasetId: LearningDatasetId;
      readonly contentDigest: Sha256Hex;
    };
    readonly applicability: LearningApplicability;
    readonly toleranceBands: ToleranceBands;
    readonly metricSpecVersion: 1;
  };
  readonly summaryKinds: LearningMetricSummaryKind[];
  readonly selectedRowCount: number;
  readonly bias: BiasSummary;
  readonly meanAbsoluteError: MeanAbsoluteErrorSummary;
  readonly hitRates: HitRateSummary[];
  readonly packBreakdowns: PackBreakdown[];
  readonly variantBreakdowns: VariantBreakdown[];
  readonly justification: MetricJustification[];
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The model registry (controlled updates through proposals only).
// ---------------------------------------------------------------------------

/** One exact-revision dataset reference of a revision lineage. */
export type DatasetLineageRef = {
  readonly datasetId: LearningDatasetId;
  readonly contentDigest: Sha256Hex;
};

/** One exact-revision changing-observation reference of a revision lineage. */
export type ChangingObservationRef = {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one model revision. */
export type ModelRevisionContent = {
  readonly schema: 'epoch.learning-calibration.model-revision';
  readonly schemaVersion: 1;
  readonly revisionId: LearningRevisionId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly modelId: LearningModelId;
  readonly sequence: number;
  readonly supersedes: {
    readonly revisionId: LearningRevisionId;
    readonly contentDigest: Sha256Hex;
  } | null;
  readonly applicability: LearningApplicability;
  readonly parameters: {
    readonly name: QualifiedName;
    readonly value: NonNegativeDecimal;
  }[];
  readonly lineage: {
    readonly datasets: DatasetLineageRef[];
    readonly changingObservations: ChangingObservationRef[];
  };
  readonly revisedAt: Timestamp;
  readonly revisedBy: PrincipalId;
  readonly note?: string | undefined;
};

/** The sealed model revision. */
export type SealedModelRevision = {
  readonly schema: 'epoch.learning-calibration.model-revision';
  readonly schemaVersion: 1;
  readonly revisionId: LearningRevisionId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly modelId: LearningModelId;
  readonly sequence: number;
  readonly supersedes: {
    readonly revisionId: LearningRevisionId;
    readonly contentDigest: Sha256Hex;
  } | null;
  readonly applicability: LearningApplicability;
  readonly parameters: {
    readonly name: QualifiedName;
    readonly value: NonNegativeDecimal;
  }[];
  readonly lineage: {
    readonly datasets: DatasetLineageRef[];
    readonly changingObservations: ChangingObservationRef[];
  };
  readonly revisedAt: Timestamp;
  readonly revisedBy: PrincipalId;
  readonly note?: string | undefined;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one model-revision proposal (the ONLY update path). */
export type ModelRevisionProposalContent = {
  readonly schema: 'epoch.learning-calibration.model-revision-proposal';
  readonly schemaVersion: 1;
  readonly proposalId: LearningProposalId;
  readonly draft: ModelRevisionContent;
  readonly justification: MetricJustification[];
  readonly proposedAt: Timestamp;
  readonly proposedBy: PrincipalId;
};

/** The sealed model-revision proposal. */
export type SealedModelRevisionProposal = {
  readonly schema: 'epoch.learning-calibration.model-revision-proposal';
  readonly schemaVersion: 1;
  readonly proposalId: LearningProposalId;
  readonly draft: ModelRevisionContent;
  readonly justification: MetricJustification[];
  readonly proposedAt: Timestamp;
  readonly proposedBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The learning:* events over the W010 event shapes.
// ---------------------------------------------------------------------------

/** One learning event sequence number (1-based, contiguous per stream). */
export type LearningEventSequence = number;

/** The causal parent reference of a learning event. */
export type LearningCausalParent = {
  readonly streamId: string;
  readonly sequence: LearningEventSequence;
};

/** The typed payload of a learning event (the W010 shape). */
export type LearningEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** The immutable content of one learning event (the W010 event shape). */
export type LearningEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: LearningEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: LearningCausalParent | null;
  readonly payload: LearningEventPayload;
  readonly occurredAt: Timestamp;
};

/** The sealed learning event record. */
export type SealedLearningEvent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: LearningEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: LearningCausalParent | null;
  readonly payload: LearningEventPayload;
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};
