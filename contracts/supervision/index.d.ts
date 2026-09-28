/**
 * contracts/supervision — the typed, versioned, provider-neutral public
 * contract surface of the Epoch Delivery Supervision + Alerts domain
 * (W043, the W012 convention). Self-contained TypeScript declarations:
 * no imports, no runtime code, no vendor/provider vocabulary.
 *
 * The runtime implementations are `@epoch/supervision` (the finding
 * production: planned-vs-actual / critical-path / prerequisite /
 * lead-time / consumption / verification / unresolved-unknown checks
 * over the W036 sealed authorities) and `@epoch/alerts` (the
 * severity/escalation policy and the alert lifecycle). This contract
 * defines only the typed shapes — no admission logic, no persistence,
 * no UI lives here.
 *
 * `parity.ts` proves at compile time that every published type is
 * IDENTICAL to the implementations' zod-inferred types; it is compiled
 * by `services/supervision`'s typecheck script (tsconfig.contracts.json)
 * — the only W043 component depending on both kernels. Any drift fails
 * `pnpm typecheck`.
 */

// --------------------------------------------------------------------------------
// Neutral shared grammars.
// --------------------------------------------------------------------------------

/** Opaque tenant identity (`tenant:<slug>`, the W009 grammar). */
export type TenantId = string;

/** Opaque acting principal (`principal:<slug>`, the W009 grammar). */
export type PrincipalId = string;

/** Opaque solution-package identity (`solution:<slug>`). */
export type SolutionId = string;

/** Opaque program-of-work identity (`program:<slug>`). */
export type ProgramId = string;

/** Opaque delivery-record identity (`delivery:<slug>`). */
export type DeliveryId = string;

/** Opaque work-package identity (`work-package:<slug>`). */
export type WorkPackageId = string;

/** Opaque activity identity (`activity:<slug>`). */
export type ActivityId = string;

/** Opaque milestone identity (`milestone:<slug>`). */
export type MilestoneId = string;

/** Opaque supervision-finding identity (`finding:<slug>`). */
export type FindingId = string;

/** Opaque alert-chain identity (`alert:<slug>`). */
export type AlertId = string;

/** Opaque escalation-policy identity (`alert-policy:<slug>`). */
export type AlertPolicyId = string;

/** Opaque escalation-outcome identity (`escalation:<slug>`). */
export type EscalationOutcomeId = string;

/** Opaque notification identity (`notification:<slug>`). */
export type NotificationId = string;

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** UTC calendar instant (`YYYY-MM-DDTHH:MM:SS.mmmZ`). */
export type Timestamp = string;

/** Non-negative decimal amount as a canonical string (no exponent, no sign). */
export type NonNegativeDecimal = string;

/** Semantic version core (MAJOR.MINOR.PATCH). */
export type SemverCore = string;

/** Opaque, bounded, provider-neutral reference string owned by its producing system. */
export type OpaqueReference = string;

/** Unit label (1-32 characters). */
export type UnitLabel = string;

/** Progress fraction in [0, 1]. */
export type ProgressFraction = number;

/** The closed supervision finding classes. */
export type FindingClass =
  | 'planned-vs-actual'
  | 'critical-path-drift'
  | 'missing-prerequisite'
  | 'lead-time-risk'
  | 'consumption-anomaly'
  | 'verification-failure'
  | 'unresolved-unknown';

/** The closed supervision finding statuses (due / drifted / late / blocked). */
export type FindingStatus = 'due' | 'drifted' | 'late' | 'blocked';

/** The closed finding-subject kinds. */
export type FindingSubjectKind =
  | 'solution'
  | 'solution-line'
  | 'work-package'
  | 'activity'
  | 'milestone'
  | 'program'
  | 'delivery'
  | 'gate'
  | 'acquisition'
  | 'info-request'
  | 'execution-issue';

/** The closed anomaly breach classes. */
export type AnomalyBreachClass =
  | 'quantity-overrun'
  | 'quantity-underrun'
  | 'cost-overrun'
  | 'cost-underrun';

/** The closed alert severities. */
export type AlertSeverity = 'info' | 'warning' | 'major' | 'critical';

/** The closed alert-chain head statuses. */
export type AlertStatus = 'raised' | 'escalated' | 'resolved';

/** The closed alert resolution kinds. */
export type AlertResolutionKind = 'remediated' | 'false-positive' | 'withdrawn';

/** The closed escalation outcome kinds (the W022 decision mapping). */
export type EscalationOutcomeKind = 'dispatched' | 'blocked-by-gateway' | 'awaiting-approval';

/** The closed notification channel kinds (provider-neutral). */
export type NotificationChannelKind = 'in-app' | 'external-relay';

/** The closed notification target kinds. */
export type NotificationTargetKind = 'role' | 'principal' | 'channel';

/** The W036 uncertainty state (provenance + freshness + confidence, all required). */
export interface UncertaintyState {
  readonly schemaVersion: 1;
  readonly provenance: {
    readonly kind: 'observed' | 'reported' | 'derived' | 'assumed' | 'imported' | 'unknown';
    readonly sourceRef?: string | undefined;
    readonly actor?: string | undefined;
  };
  readonly freshness: {
    readonly state: 'fresh' | 'aging' | 'stale' | 'unknown';
    readonly assessedAt: Timestamp;
  };
  readonly confidence: {
    readonly method: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';
    readonly value: number;
    readonly interval?: { readonly low: number; readonly high: number } | undefined;
    readonly rationale?: string | undefined;
  };
}

// --------------------------------------------------------------------------------
// Supervision core records (the @epoch/supervision surface).
// --------------------------------------------------------------------------------

/** The typed measures one supervision finding observed. */
export interface FindingMeasures {
  readonly plannedStart?: Timestamp | undefined;
  readonly plannedFinish?: Timestamp | undefined;
  readonly actualStart?: Timestamp | undefined;
  readonly actualFinish?: Timestamp | undefined;
  readonly forecastFinish?: Timestamp | undefined;
  readonly actualProgress?: ProgressFraction | undefined;
  readonly targetDate?: Timestamp | undefined;
  readonly daysLate?: NonNegativeDecimal | undefined;
  readonly driftDays?: NonNegativeDecimal | undefined;
  readonly shortfallDays?: NonNegativeDecimal | undefined;
  readonly plannedValue?: NonNegativeDecimal | undefined;
  readonly actualValue?: NonNegativeDecimal | undefined;
  readonly thresholdValue?: NonNegativeDecimal | undefined;
  readonly varianceValue?: string | undefined;
  readonly unit?: UnitLabel | undefined;
  readonly currency?: string | undefined;
  readonly breachClass?: AnomalyBreachClass | undefined;
  readonly impactedActivityIds?: ActivityId[] | undefined;
  readonly missingPrerequisiteIds?: ActivityId[] | undefined;
  readonly blockerRefs?: OpaqueReference[] | undefined;
  readonly issueRecordIds?: string[] | undefined;
  readonly gateId?: string | undefined;
  readonly gatePassed?: boolean | undefined;
  readonly acquisitionRef?: OpaqueReference | undefined;
  readonly requiredBy?: Timestamp | undefined;
  readonly realisticLeadTimeDays?: NonNegativeDecimal | undefined;
  readonly infoRequestId?: string | undefined;
  readonly freshnessState?: 'fresh' | 'aging' | 'stale' | undefined;
}

/** The subject of one supervision finding. */
export interface FindingSubject {
  readonly subjectKind: FindingSubjectKind;
  readonly subjectId: string;
}

/** One exact-revision provenance source of a finding (the W006 convention). */
export interface ProvenanceSource {
  readonly referenceKind:
    | 'program'
    | 'delivery'
    | 'activity'
    | 'work-package'
    | 'milestone'
    | 'gate'
    | 'execution-issue'
    | 'lead-time-record'
    | 'info-request'
    | 'distinction-record';
  readonly referenceId: string;
  readonly contentDigest: Sha256Hex;
}

/** The provenance block of one supervision finding. */
export interface FindingProvenance {
  readonly evaluatedAt: Timestamp;
  readonly evaluatedBy: PrincipalId;
  readonly checkVersion: '1.0.0';
  readonly sources: ProvenanceSource[];
}

/** The immutable content of one supervision finding. */
export interface SupervisionFindingContent {
  readonly schema: 'epoch.supervision.finding';
  readonly schemaVersion: 1;
  readonly findingId: FindingId;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly programId: ProgramId;
  readonly deliveryId: DeliveryId;
  readonly findingClass: FindingClass;
  readonly status: FindingStatus;
  readonly subject: FindingSubject;
  readonly title: string;
  readonly detail: string;
  readonly measures: FindingMeasures;
  readonly provenance: FindingProvenance;
  readonly milestoneId?: MilestoneId | undefined;
}

/** The sealed supervision finding: content plus its SHA-256 content digest. */
export interface SealedSupervisionFinding extends SupervisionFindingContent {
  readonly contentDigest: Sha256Hex;
}

/** The impact-reference mirror of one execution-issue summary. */
export interface IssueSummaryImpact {
  readonly workPackageIds: WorkPackageId[];
  readonly activityIds: ActivityId[];
  readonly milestoneIds: MilestoneId[];
}

/** One execution-issue summary (the W038 record projected for supervision). */
export interface ExecutionIssueSummary {
  readonly schema: 'epoch.supervision.execution-issue-summary';
  readonly schemaVersion: 1;
  readonly recordId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly issueKind: 'change' | 'delay' | 'rework' | 'defect' | 'blocker';
  readonly severity: 'minor' | 'moderate' | 'major' | 'critical';
  readonly resolutionState: 'open' | 'resolved' | 'dismissed';
  readonly impact: IssueSummaryImpact;
  readonly raisedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
}

/** The exact-revision source-record reference of one lead-time input. */
export interface LeadTimeSourceRecord {
  readonly recordId: string;
  readonly contentDigest: Sha256Hex;
}

/** One acquisition/lead-time risk input (the W037 shapes, mirrored). */
export interface LeadTimeRiskInput {
  readonly schema: 'epoch.supervision.lead-time-risk-input';
  readonly schemaVersion: 1;
  readonly leadTimeInputId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly acquisitionRef: OpaqueReference;
  readonly requiredBy: Timestamp;
  readonly realisticLeadTimeDays: NonNegativeDecimal;
  readonly observedAt: Timestamp;
  readonly sourceRecord: LeadTimeSourceRecord;
  readonly uncertainty: UncertaintyState;
  readonly impactedActivityIds: ActivityId[];
}

/** The typed threshold rules of consumption/cost anomaly checks. */
export interface SupervisionThresholds {
  readonly quantityOverrunRatio: NonNegativeDecimal;
  readonly costOverrunRatio: NonNegativeDecimal;
  readonly quantityUnderrunRatio: NonNegativeDecimal;
  readonly costUnderrunRatio: NonNegativeDecimal;
}

/** The immutable content of one supervision pass. */
export interface SupervisionPassContent {
  readonly schema: 'epoch.supervision.supervision-pass';
  readonly schemaVersion: 1;
  readonly passId: string;
  readonly tenantId: TenantId;
  readonly solutionId: SolutionId;
  readonly programId: ProgramId;
  readonly programDigest: Sha256Hex;
  readonly deliveryId: DeliveryId;
  readonly deliveryDigest: Sha256Hex;
  readonly solutionVersion: SemverCore;
  readonly solutionVersionDigest: Sha256Hex;
  readonly evaluatedAt: Timestamp;
  readonly evaluatedBy: PrincipalId;
  readonly thresholds: SupervisionThresholds;
  readonly findings: SealedSupervisionFinding[];
  readonly findingCounts: {
    readonly byClass: Record<string, number>;
    readonly byStatus: Record<string, number>;
  };
}

/** The sealed supervision pass: content plus its SHA-256 content digest. */
export interface SealedSupervisionPass extends SupervisionPassContent {
  readonly contentDigest: Sha256Hex;
}

/** A self-contained JSON value (the shared protocol grammar). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** The sealed supervision event (the W010 event shape, the `supervision:` namespace). */
export interface SealedSupervisionEvent {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: number;
  readonly tenantId: TenantId;
  readonly actor: PrincipalId;
  readonly causalParent: { readonly streamId: string; readonly sequence: number } | null;
  readonly payload: {
    readonly discriminator: string;
    readonly data: Readonly<Record<string, JsonValue>>;
  };
  readonly occurredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
}

// --------------------------------------------------------------------------------
// Alerts core records (the @epoch/alerts surface).
// --------------------------------------------------------------------------------

/** One notification target: a closed neutral kind plus an opaque reference. */
export interface NotificationTarget {
  readonly targetKind: NotificationTargetKind;
  readonly targetRef: string;
}

/** The escalation path of one policy rule. */
export interface EscalationPath {
  readonly notify: NotificationTarget[];
  readonly escalationDelaySeconds: NonNegativeDecimal;
  readonly reNotifyCadenceSeconds: NonNegativeDecimal;
  readonly escalateTo: NotificationTarget[];
}

/** One escalation-policy rule. */
export interface PolicyRule {
  readonly ruleId: string;
  readonly findingClass: string;
  readonly findingStatus?: FindingStatus | undefined;
  readonly severity: AlertSeverity;
  readonly escalation: EscalationPath;
}

/** The sealed escalation policy: policy-as-data content plus its digest. */
export interface SealedEscalationPolicy {
  readonly schema: 'epoch.alerts.escalation-policy';
  readonly schemaVersion: 1;
  readonly policyId: AlertPolicyId;
  readonly tenantId: TenantId;
  readonly policyVersion: SemverCore;
  readonly title: string;
  readonly defaultSeverity: AlertSeverity;
  readonly defaultEscalation: EscalationPath;
  readonly rules: PolicyRule[];
  readonly activatedAt: Timestamp;
  readonly activatedBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
}

/** One supervision finding projected for alert processing. */
export interface AlertFindingSummary {
  readonly findingId: FindingId;
  readonly findingDigest: Sha256Hex;
  readonly findingClass: string;
  readonly findingStatus: FindingStatus;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly title: string;
  readonly detectedAt: Timestamp;
}

/** The sealed alert revision: immutable content plus its SHA-256 content digest. */
export interface SealedAlertRecord {
  readonly schema: 'epoch.alerts.alert';
  readonly schemaVersion: 1;
  readonly alertId: AlertId;
  readonly tenantId: TenantId;
  readonly revision: number;
  readonly previousRevisionDigest: Sha256Hex | null;
  readonly findingId: FindingId;
  readonly findingDigest: Sha256Hex;
  readonly findingClass: string;
  readonly findingStatus: FindingStatus;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly severity: AlertSeverity;
  readonly policyId: AlertPolicyId;
  readonly policyDigest: Sha256Hex;
  readonly status: AlertStatus;
  readonly title: string;
  readonly raisedAt: Timestamp;
  readonly raisedBy: PrincipalId;
  readonly escalatedAt?: Timestamp | undefined;
  readonly escalationLevel?: number | undefined;
  readonly resolvedAt?: Timestamp | undefined;
  readonly resolvedBy?: PrincipalId | undefined;
  readonly resolutionKind?: AlertResolutionKind | undefined;
  readonly contentDigest: Sha256Hex;
}

/** The sealed escalation outcome: a gateway-decision record plus its digest. */
export interface SealedEscalationOutcome {
  readonly schema: 'epoch.alerts.escalation-outcome';
  readonly schemaVersion: 1;
  readonly outcomeId: EscalationOutcomeId;
  readonly tenantId: TenantId;
  readonly alertId: AlertId;
  readonly alertDigest: Sha256Hex;
  readonly alertRevision: number;
  readonly escalationLevel: number;
  readonly outcomeKind: EscalationOutcomeKind;
  readonly proposalId: string;
  readonly proposalDigest: Sha256Hex;
  readonly decisionMessageId: string;
  readonly decisionDigest: Sha256Hex;
  readonly decidedByRole: 'action-gateway' | 'human-approver';
  readonly recordedAt: Timestamp;
  readonly recordedBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
}

/** The sealed notification: typed content plus its SHA-256 content digest. */
export interface SealedNotificationRecord {
  readonly schema: 'epoch.alerts.notification';
  readonly schemaVersion: 1;
  readonly notificationId: NotificationId;
  readonly tenantId: TenantId;
  readonly alertId: AlertId;
  readonly alertDigest: Sha256Hex;
  readonly alertRevision: number;
  readonly severity: AlertSeverity;
  readonly findingClass: string;
  readonly findingStatus: FindingStatus;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly channelKind: NotificationChannelKind;
  readonly targets: NotificationTarget[];
  readonly title: string;
  readonly body: string;
  readonly dispatchedAt: Timestamp;
  readonly dispatchedBy: PrincipalId;
  readonly contentDigest: Sha256Hex;
}
