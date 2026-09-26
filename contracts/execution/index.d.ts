/**
 * Epoch Execution Tracking v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/execution` ownership boundary (Work Order W038). It is
 * self-contained: no imports, no runtime code, no vendor/field-platform
 * vocabulary. The runtime implementation lives in
 * `@epoch/execution-tracking` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (USL1.0 / SD1.0, binding): the ProgramOfWork stays the
 * authoritative schedule dimension — execution-tracking records OBSERVE
 * work-package/activity state by OPAQUE ID, they never re-schedule. The
 * DeliveryRecord stays the delivery-facts authority — execution-tracking
 * produces observations and reconciliation proposals; actualization
 * converts ACCEPTED observations only, through the W036
 * acceptance/actualization path. Evidence authority stays with W006 —
 * field evidence references carry digests, never payloads.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published execution-tracking contract surface. */
export type ExecutionTrackingContractVersion = '1.0.0';

/** The canonical tracking states of a work package or activity. */
export type TrackingState = 'not-started' | 'in-progress' | 'completed' | 'blocked';

/** The resource-usage observation kinds. */
export type ResourceKind = 'labor' | 'equipment' | 'material' | 'resource';

/** The field-evidence capture kinds (W006 digest references). */
export type FieldEvidenceKind = 'photo' | 'sensor-reading' | 'document';

/** The execution-issue record families. */
export type IssueKind = 'change' | 'delay' | 'rework' | 'defect' | 'blocker';

/** The severity vocabulary of every issue family. */
export type IssueSeverity = 'minor' | 'moderate' | 'major' | 'critical';

/** The resolution states of one issue (derived, append-only). */
export type ResolutionState = 'open' | 'resolved' | 'dismissed';

/** The issue-resolution decisions (an issue accepts exactly one). */
export type IssueResolutionDecision = 'resolved' | 'dismissed';

// ---------------------------------------------------------------------------
// Neutral primitives.
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

/** Solution package identity: "solution:" + lowercase slug (W036). */
export type SolutionId = string;

/** Work-package identity: "work-package:" + lowercase slug (W036). */
export type WorkPackageId = string;

/** Activity identity: "activity:" + lowercase slug (W036 grammar). */
export type ActivityId = string;

/** Milestone identity: "milestone:" + lowercase slug (W036). */
export type MilestoneId = string;

/** Delivery record identity: "delivery:" + lowercase slug (W036). */
export type DeliveryId = string;

/** W036 semantic-distinction record id (observation/actual/...). */
export type DistinctionRecordId = string;

/** Tracking-state record identity: "state:" + lowercase slug. */
export type StateId = string;

/** Resource-observation record identity: "resource-observation:" + slug. */
export type ResourceObservationId = string;

/** Field-evidence-link record identity: "evidence-link:" + slug. */
export type EvidenceLinkId = string;

/** Execution-issue record identity (one of the five family prefixes). */
export type IssueRecordId = string;

/** Issue-resolution record identity: "issue-resolution:" + slug. */
export type IssueResolutionId = string;

/** Reconciliation-proposal record identity: "reconciliation:" + slug. */
export type ReconciliationId = string;

/** The low-friction field-capture key (a bare slug). */
export type FieldCaptureKey = string;

/** Execution event stream identity: "stream:" + slug (the W010 grammar). */
export type ExecutionStreamId = string;

/** Non-negative decimal amount as a canonical string (no exponent). */
export type NonNegativeDecimal = string;

/** Opaque bounded reference string owned by its producing system. */
export type OpaqueReference = string;

/** Unit-of-measure label. */
export type UnitLabel = string;

/** JSON Schema record id prefix kinds. */
export type IssueIdPrefix = 'change' | 'delay' | 'rework' | 'defect' | 'blocker';

// ---------------------------------------------------------------------------
// Shared W036 shapes (self-contained mirrors for this boundary).
// ---------------------------------------------------------------------------

/** Provenance of one fact (the W036 convention). */
export type ProvenanceState = {
  readonly kind: 'observed' | 'reported' | 'derived' | 'assumed' | 'imported' | 'unknown';
  readonly sourceRef?: OpaqueReference | undefined;
  readonly actor?: PrincipalId | undefined;
};

/** Freshness of one fact (the W036 convention). */
export type FreshnessState = {
  readonly state: 'fresh' | 'aging' | 'stale' | 'unknown';
  readonly assessedAt: Timestamp;
};

/** Confidence of one fact (the W036/W006 convention). */
export type ConfidenceState = {
  readonly method: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';
  readonly value: number;
  readonly interval?: { readonly low: number; readonly high: number } | undefined;
  readonly rationale?: string | undefined;
};

/** The mandatory uncertainty state on every execution observation. */
export type UncertaintyState = {
  readonly schemaVersion: 1;
  readonly provenance: ProvenanceState;
  readonly freshness: FreshnessState;
  readonly confidence: ConfidenceState;
};

/** A quantity measure (W036). */
export type QuantityMeasure = {
  readonly kind: 'quantity';
  readonly value: NonNegativeDecimal;
  readonly unit: UnitLabel;
};

/** A cost measure (W036). */
export type CostMeasure = {
  readonly kind: 'cost';
  readonly amount: NonNegativeDecimal;
  readonly currency: string;
};

/** An instant measure (W036). */
export type InstantMeasure = { readonly kind: 'instant'; readonly at: Timestamp };

/** A progress measure (W036). */
export type ProgressMeasure = { readonly kind: 'progress'; readonly fraction: number };

/** One provider-neutral measure (W036). */
export type Measure = QuantityMeasure | CostMeasure | InstantMeasure | ProgressMeasure;

// ---------------------------------------------------------------------------
// Field evidence references (W006 digests + capture context, never payloads).
// ---------------------------------------------------------------------------

/** One field-evidence reference: the W006 digest plus capture context. */
export type FieldEvidenceLink = {
  readonly digest: Sha256Hex;
  readonly evidenceKind: FieldEvidenceKind;
  readonly capturedAt: Timestamp;
  readonly capturedBy: PrincipalId;
  readonly captureMethod?: OpaqueReference | undefined;
  readonly note?: string | undefined;
};

/** The immutable content of one field-evidence-link record. */
export type FieldEvidenceLinkRecordContent = {
  readonly schema: 'epoch.execution-tracking.field-evidence-link';
  readonly schemaVersion: 1;
  readonly recordId: EvidenceLinkId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly digest: Sha256Hex;
  readonly evidenceKind: FieldEvidenceKind;
  readonly capturedAt: Timestamp;
  readonly capturedBy: PrincipalId;
  readonly captureMethod?: OpaqueReference | undefined;
  readonly note?: string | undefined;
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly linkedObservationId?: DistinctionRecordId | undefined;
  readonly linkedTrackingRecordId?: StateId | undefined;
  readonly captureKey?: FieldCaptureKey | undefined;
  readonly recordedAt: Timestamp;
};

/** The sealed field-evidence-link record (content + digest). */
export type SealedFieldEvidenceLink = {
  readonly schema: 'epoch.execution-tracking.field-evidence-link';
  readonly schemaVersion: 1;
  readonly recordId: EvidenceLinkId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly digest: Sha256Hex;
  readonly evidenceKind: FieldEvidenceKind;
  readonly capturedAt: Timestamp;
  readonly capturedBy: PrincipalId;
  readonly captureMethod?: OpaqueReference | undefined;
  readonly note?: string | undefined;
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly linkedObservationId?: DistinctionRecordId | undefined;
  readonly linkedTrackingRecordId?: StateId | undefined;
  readonly captureKey?: FieldCaptureKey | undefined;
  readonly recordedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Work-package/activity state tracking (append-only chains, opaque ids).
// ---------------------------------------------------------------------------

/** The subject of one tracking record. */
export type TrackingSubject = {
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
};

/** The immutable content of one tracking-state record. */
export type TrackingStateRecordContent = {
  readonly schema: 'epoch.execution-tracking.tracking-state';
  readonly schemaVersion: 1;
  readonly recordId: StateId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: TrackingSubject;
  readonly fromState: TrackingState;
  readonly toState: TrackingState;
  readonly cause: string;
  readonly note?: string | undefined;
  readonly observedAt: Timestamp;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
};

/** The sealed tracking-state record (content + digest). */
export type SealedTrackingStateRecord = {
  readonly schema: 'epoch.execution-tracking.tracking-state';
  readonly schemaVersion: 1;
  readonly recordId: StateId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly subject: TrackingSubject;
  readonly fromState: TrackingState;
  readonly toState: TrackingState;
  readonly cause: string;
  readonly note?: string | undefined;
  readonly observedAt: Timestamp;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Resource observations (labor/equipment/material usage).
// ---------------------------------------------------------------------------

/** The immutable content of one resource-usage observation. */
export type ResourceObservationContent = {
  readonly schema: 'epoch.execution-tracking.resource-observation';
  readonly schemaVersion: 1;
  readonly recordId: ResourceObservationId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly resourceKind: ResourceKind;
  readonly resourceId: OpaqueReference;
  readonly quantity: NonNegativeDecimal;
  readonly unit: UnitLabel;
  readonly usageAt: Timestamp;
  readonly observedBy: PrincipalId;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
};

/** The sealed resource-observation record (content + digest). */
export type SealedResourceObservation = {
  readonly schema: 'epoch.execution-tracking.resource-observation';
  readonly schemaVersion: 1;
  readonly recordId: ResourceObservationId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly resourceKind: ResourceKind;
  readonly resourceId: OpaqueReference;
  readonly quantity: NonNegativeDecimal;
  readonly unit: UnitLabel;
  readonly usageAt: Timestamp;
  readonly observedBy: PrincipalId;
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Changes, delays, rework, defects and blockers.
// ---------------------------------------------------------------------------

/** The impact reference set: opaque ProgramOfWork schedule items touched. */
export type IssueImpact = {
  readonly workPackageIds: WorkPackageId[];
  readonly activityIds: ActivityId[];
  readonly milestoneIds: MilestoneId[];
};

/** Rework provenance: the ORIGINAL work records the rework redoes. */
export type ReworkReference = {
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly originalTrackingRecordId?: StateId | undefined;
  readonly reason: string;
};

/** Blocker dependency semantics: what is blocked, by what, and why. */
export type BlockerSemantics = {
  readonly workPackageId: WorkPackageId;
  readonly activityId?: ActivityId | undefined;
  readonly blockedByRef: OpaqueReference;
  readonly reason: string;
};

/** The immutable content of one execution-issue record. */
export type IssueRecordContent = {
  readonly schema: 'epoch.execution-tracking.issue-record';
  readonly schemaVersion: 1;
  readonly recordId: IssueRecordId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly issueKind: IssueKind;
  readonly title: string;
  readonly description?: string | undefined;
  readonly severity: IssueSeverity;
  readonly impact: IssueImpact;
  readonly reworkOf?: ReworkReference | undefined;
  readonly blocked?: BlockerSemantics | undefined;
  readonly raisedAt: Timestamp;
  readonly raisedBy: PrincipalId;
  readonly recordedAt: Timestamp;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
};

/** The sealed execution-issue record (content + digest). */
export type SealedIssueRecord = {
  readonly schema: 'epoch.execution-tracking.issue-record';
  readonly schemaVersion: 1;
  readonly recordId: IssueRecordId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly issueKind: IssueKind;
  readonly title: string;
  readonly description?: string | undefined;
  readonly severity: IssueSeverity;
  readonly impact: IssueImpact;
  readonly reworkOf?: ReworkReference | undefined;
  readonly blocked?: BlockerSemantics | undefined;
  readonly raisedAt: Timestamp;
  readonly raisedBy: PrincipalId;
  readonly recordedAt: Timestamp;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly uncertainty: UncertaintyState;
  readonly contentDigest: Sha256Hex;
};

/** The immutable content of one issue-resolution record. */
export type IssueResolutionContent = {
  readonly schema: 'epoch.execution-tracking.issue-resolution';
  readonly schemaVersion: 1;
  readonly recordId: IssueResolutionId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly issueRecordId: IssueRecordId;
  readonly resolution: IssueResolutionDecision;
  readonly resolvedAt: Timestamp;
  readonly resolvedBy: PrincipalId;
  readonly note?: string | undefined;
  readonly evidenceLinks: FieldEvidenceLink[];
};

/** The sealed issue-resolution record (content + digest). */
export type SealedIssueResolution = {
  readonly schema: 'epoch.execution-tracking.issue-resolution';
  readonly schemaVersion: 1;
  readonly recordId: IssueResolutionId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly issueRecordId: IssueRecordId;
  readonly resolution: IssueResolutionDecision;
  readonly resolvedAt: Timestamp;
  readonly resolvedBy: PrincipalId;
  readonly note?: string | undefined;
  readonly evidenceLinks: FieldEvidenceLink[];
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Reconciliation proposals (the Observation != Actual separation).
// ---------------------------------------------------------------------------

/** One proposed observation-to-actual pairing. */
export type ReconciliationEntry = {
  readonly observationId: DistinctionRecordId;
  readonly proposedActualId: string;
};

/** The immutable content of one reconciliation proposal. */
export type ReconciliationProposalContent = {
  readonly schema: 'epoch.execution-tracking.reconciliation-proposal';
  readonly schemaVersion: 1;
  readonly recordId: ReconciliationId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly entries: ReconciliationEntry[];
  readonly proposedAt: Timestamp;
  readonly proposedBy: PrincipalId;
  readonly rationale?: string | undefined;
};

/** The sealed reconciliation proposal (content + digest). */
export type SealedReconciliationProposal = {
  readonly schema: 'epoch.execution-tracking.reconciliation-proposal';
  readonly schemaVersion: 1;
  readonly recordId: ReconciliationId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly entries: ReconciliationEntry[];
  readonly proposedAt: Timestamp;
  readonly proposedBy: PrincipalId;
  readonly rationale?: string | undefined;
  readonly contentDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// The low-friction field capture (single-call intake).
// ---------------------------------------------------------------------------

/** The linkage anchor of one field capture. */
export type CaptureSubject =
  | { readonly kind: 'work-package'; readonly id: WorkPackageId }
  | { readonly kind: 'activity'; readonly id: ActivityId }
  | { readonly kind: 'milestone'; readonly id: MilestoneId };

/** One resource usage reported by a field capture. */
export type CaptureResourceUsage = {
  readonly resourceKind: ResourceKind;
  readonly resourceId: OpaqueReference;
  readonly quantity: NonNegativeDecimal;
  readonly unit: UnitLabel;
  readonly usageAt: Timestamp;
};

/** The low-friction field capture: ONE call carries everything observed. */
export type FieldCapture = {
  readonly captureKey: FieldCaptureKey;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly deliveryId: DeliveryId;
  readonly observedAt: Timestamp;
  readonly observedBy: PrincipalId;
  readonly recordedAt?: Timestamp | undefined;
  readonly subjectRef: CaptureSubject;
  readonly measure: Measure;
  readonly resourceUsages?: CaptureResourceUsage[] | undefined;
  readonly evidenceLinks?: FieldEvidenceLink[] | undefined;
  readonly uncertainty: UncertaintyState;
};

// ---------------------------------------------------------------------------
// The execution:* event vocabulary (the W010 mirror).
// ---------------------------------------------------------------------------

/** One execution event sequence number (1-based, contiguous per stream). */
export type ExecutionEventSequence = number;

/** The causal parent reference of an execution event. */
export type ExecutionCausalParent = {
  readonly streamId: ExecutionStreamId;
  readonly sequence: ExecutionEventSequence;
};

/** The typed event payload of an execution event (the W010 shape). */
export type ExecutionEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** The immutable content of one execution event (the W010 mirror). */
export type ExecutionEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: ExecutionStreamId;
  readonly sequence: ExecutionEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: ExecutionCausalParent | null;
  readonly payload: ExecutionEventPayload;
  readonly occurredAt: Timestamp;
};

/** The sealed execution event (content + digest). */
export type SealedExecutionEvent = {
  readonly schemaVersion: 1;
  readonly streamId: ExecutionStreamId;
  readonly sequence: ExecutionEventSequence;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: ExecutionCausalParent | null;
  readonly payload: ExecutionEventPayload;
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
};
