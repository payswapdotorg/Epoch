/**
 * Compile-time conformance assertions for the W043 public contract
 * surface (contracts/supervision).
 *
 * Mirrors `contracts/execution/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementations
 * (`@epoch/supervision` + `@epoch/alerts`) and asserts strict type
 * identity for every surface type, so the self-contained declarations
 * cannot drift from the zod-inferred implementation types. Compiled by
 * `services/supervision`'s `typecheck` script (tsconfig.contracts.json)
 * — the only W043 component depending on both kernels; any drift fails
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as supervision from '@epoch/supervision';
import type * as alerts from '@epoch/alerts';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless `T` is `true`. */
type Expect<T extends true> = T;

// Neutral shared grammars.
export type TenantIdParity = Expect<Equals<contracts.TenantId, supervision.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, supervision.PrincipalId>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, supervision.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, supervision.Timestamp>>;
export type NonNegativeDecimalParity = Expect<
  Equals<contracts.NonNegativeDecimal, supervision.NonNegativeDecimal>
>;
export type ActivityIdParity = Expect<Equals<contracts.ActivityId, supervision.ActivityIdMirror>>;
export type FindingClassParity = Expect<
  Equals<contracts.FindingClass, supervision.FindingClass>
>;
export type FindingStatusParity = Expect<
  Equals<contracts.FindingStatus, supervision.FindingStatus>
>;
export type AnomalyBreachClassParity = Expect<
  Equals<contracts.AnomalyBreachClass, supervision.AnomalyBreachClass>
>;

// Supervision core records.
export type FindingMeasuresParity = Expect<
  Equals<contracts.FindingMeasures, supervision.FindingMeasures>
>;
export type FindingSubjectParity = Expect<
  Equals<contracts.FindingSubject, supervision.FindingSubject>
>;
export type ProvenanceSourceParity = Expect<
  Equals<contracts.ProvenanceSource, supervision.ProvenanceSource>
>;
export type FindingProvenanceParity = Expect<
  Equals<contracts.FindingProvenance, supervision.FindingProvenance>
>;
export type SupervisionFindingContentParity = Expect<
  Equals<contracts.SupervisionFindingContent, supervision.SupervisionFindingContent>
>;
export type SealedSupervisionFindingParity = Expect<
  Equals<contracts.SealedSupervisionFinding, supervision.SealedSupervisionFinding>
>;
export type IssueSummaryImpactParity = Expect<
  Equals<contracts.IssueSummaryImpact, supervision.IssueSummaryImpact>
>;
export type ExecutionIssueSummaryParity = Expect<
  Equals<contracts.ExecutionIssueSummary, supervision.ExecutionIssueSummary>
>;
export type LeadTimeSourceRecordParity = Expect<
  Equals<contracts.LeadTimeSourceRecord, supervision.LeadTimeSourceRecord>
>;
export type LeadTimeRiskInputParity = Expect<
  Equals<contracts.LeadTimeRiskInput, supervision.LeadTimeRiskInput>
>;
export type SupervisionThresholdsParity = Expect<
  Equals<contracts.SupervisionThresholds, supervision.SupervisionThresholds>
>;
export type SupervisionPassContentParity = Expect<
  Equals<contracts.SupervisionPassContent, supervision.SupervisionPassContent>
>;
export type SealedSupervisionPassParity = Expect<
  Equals<contracts.SealedSupervisionPass, supervision.SealedSupervisionPass>
>;
export type SealedSupervisionEventParity = Expect<
  Equals<contracts.SealedSupervisionEvent, supervision.SealedSupervisionEvent>
>;

// Alerts core records.
export type AlertSeverityParity = Expect<Equals<contracts.AlertSeverity, alerts.AlertSeverity>>;
export type AlertStatusParity = Expect<Equals<contracts.AlertStatus, alerts.AlertStatus>>;
export type AlertResolutionKindParity = Expect<
  Equals<contracts.AlertResolutionKind, alerts.AlertResolutionKind>
>;
export type EscalationOutcomeKindParity = Expect<
  Equals<contracts.EscalationOutcomeKind, alerts.EscalationOutcomeKind>
>;
export type NotificationChannelKindParity = Expect<
  Equals<contracts.NotificationChannelKind, alerts.NotificationChannelKind>
>;
export type NotificationTargetKindParity = Expect<
  Equals<contracts.NotificationTargetKind, alerts.NotificationTargetKind>
>;
export type NotificationTargetParity = Expect<
  Equals<contracts.NotificationTarget, alerts.NotificationTarget>
>;
export type EscalationPathParity = Expect<Equals<contracts.EscalationPath, alerts.EscalationPath>>;
export type PolicyRuleParity = Expect<Equals<contracts.PolicyRule, alerts.PolicyRule>>;
export type SealedEscalationPolicyParity = Expect<
  Equals<contracts.SealedEscalationPolicy, alerts.SealedEscalationPolicy>
>;
export type AlertFindingSummaryParity = Expect<
  Equals<contracts.AlertFindingSummary, alerts.AlertFindingSummary>
>;
export type SealedAlertRecordParity = Expect<
  Equals<contracts.SealedAlertRecord, alerts.SealedAlertRecord>
>;
export type SealedEscalationOutcomeParity = Expect<
  Equals<contracts.SealedEscalationOutcome, alerts.SealedEscalationOutcome>
>;
export type SealedNotificationRecordParity = Expect<
  Equals<contracts.SealedNotificationRecord, alerts.SealedNotificationRecord>
>;
