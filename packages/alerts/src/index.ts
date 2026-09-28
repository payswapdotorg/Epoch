/**
 * @epoch/alerts — public API (kernel layer, Work Order W043).
 *
 * The SEVERITY/ESCALATION POLICY and the ALERT LIFECYCLE over
 * supervision findings (the finding production is @epoch/supervision's
 * authority — the two kernels never link at runtime; compatibility is
 * pinned by the supervision-runtime service's compile-time parity
 * module + runtime parity tests):
 *
 * - POLICY AS DATA: sealed, versioned escalation-policy records
 *   (finding class token + optional status driver -> severity ->
 *   escalation path with notify targets, escalation delay and
 *   re-notify cadence); deterministic rule precedence (exact >
 *   class-only > default) — swapping a policy record changes
 *   escalation with NO code change;
 * - ALERT RECORDS as append-only REVISION CHAINS: idempotent
 *   deduplication (the same finding state re-evaluated produces the
 *   sealed prior alert — duplicate = sealed prior record); state
 *   transitions (due -> late -> blocked) append new revisions carrying
 *   `previousRevisionDigest`, never mutations; resolution is terminal
 *   (a recurring finding ships as a new alert identity);
 * - ESCALATION ACTIONS as typed W003 action proposals through the W022
 *   authority seam: policy decision FIRST (allow / deny /
 *   requires-approval via the REAL W003 AuthorizationDecision
 *   pipeline), then typed outcome records (dispatched /
 *   blocked-by-gateway / awaiting-approval) — the kernel NEVER
 *   executes anything (`gateway-bypass-rejected`);
 * - TYPED NOTIFICATIONS through the OPTIONAL NotificationPort seam:
 *   ONE in-memory reference adapter; the closed neutral channel
 *   vocabulary keeps provider vocabulary OUT of the kernel
 *   (`provider-vocabulary-rejected`); dispatch is replay-safe
 *   (duplicate receipts by digest);
 * - TENANT ISOLATION (R12) on every record
 *   (`tenant-isolation-rejected`).
 *
 * NO persistence, NO UI, NO provider vocabulary, NO external
 * providers, NO execution. Deterministic: zero wall-clock, zero
 * randomness — every instant is caller-supplied.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023/W036/W038 convention),
 * the public core-record surface at contracts/supervision/ (composed
 * with the supervision core records by the supervision-runtime service).
 */

// Version + vocabularies.
export {
  ALERT_ID_PATTERN,
  ALERT_POLICY_ID_PATTERN,
  ALERT_RESOLUTION_KINDS,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERTS_CONTRACT_VERSION,
  ALERTS_PRINCIPAL_ID_PATTERN,
  ALERTS_RECORD_VERSION,
  ESCALATION_ACTION_TYPE_ID,
  ESCALATION_ACTION_TYPE_VERSION,
  ESCALATION_AUTHORITY_SCOPE,
  ESCALATION_OUTCOME_ID_PATTERN,
  ESCALATION_OUTCOME_KINDS,
  ESCALATION_POLICY_SCHEMA_NAME,
  FINDING_CLASS_TOKEN_PATTERN,
  FINDING_ID_MIRROR_PATTERN,
  FINDING_STATES,
  NOTIFICATION_CHANNEL_KINDS,
  NOTIFICATION_ID_PATTERN,
  NOTIFICATION_TARGET_KINDS,
  POLICY_RULE_ID_PATTERN,
  SUBJECT_KIND_TOKEN_PATTERN,
  kindPrefixOf,
} from './version';
export type {
  AlertResolutionKind,
  AlertSeverity,
  AlertStatus,
  EscalationOutcomeKind,
  FindingState,
  NotificationChannelKind,
  NotificationTargetKind,
} from './version';

// Primitives (zod schemas + types).
export {
  AlertIdSchema,
  AlertPolicyIdSchema,
  AlertsPrincipalIdSchema,
  EscalationOutcomeIdSchema,
  FindingClassTokenSchema,
  FindingIdMirrorSchema,
  NotificationIdSchema,
  NonNegativeDecimalSchema,
  PolicyRuleIdSchema,
  SemverCoreSchema,
  SubjectKindTokenSchema,
  canonicalDigest,
  sha256Hex,
} from './primitives';
export type {
  AlertId,
  AlertPolicyId,
  AlertsPrincipalId,
  EscalationOutcomeId,
  FindingClassToken,
  FindingIdMirror,
  NotificationId,
  NonNegativeDecimal,
  PolicyRuleId,
  SemverCore,
  SubjectKindToken,
} from './primitives';
export type { TenantId } from '@epoch/tenancy';
export type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';

// W003 action-protocol re-exports used by consumers of this surface (the
// escalation seam's proposal/decision vocabulary).
export type {
  ActionProposal,
  AuthorizationDecision,
  AuthorizationRequest,
  Decision,
  ProposalReference,
} from '@epoch/action-protocol';

// Typed error taxonomy + result.
export type { AlertsError, AlertsErrorCode, AlertsIssue, AlertsResult } from './errors';

// Flattened-issue + seam classifiers (the W043 pins).
export {
  flattenIssues,
  gatewayBypassError,
  hasUnrecognizedKeys,
  providerVocabularyError,
  validationError,
  vendorFieldsError,
} from './issues';

// Severity + escalation policy (POLICY AS DATA).
export {
  admitEscalationPolicy,
  computeEscalationPolicyDigest,
  EscalationPathSchema,
  EscalationPolicyContentSchema,
  NotificationTargetSchema,
  PolicyRuleSchema,
  resolvePolicyRule,
  SealedEscalationPolicySchema,
  verifySealedEscalationPolicy,
} from './policy';
export type {
  EscalationPath,
  EscalationPolicyContent,
  NotificationTarget,
  PolicyRule,
  PolicyRuleDecision,
  SealedEscalationPolicy,
} from './policy';

// Alert records (append-only revision chains + idempotent raise).
export {
  AlertFindingSummarySchema,
  AlertRecordContentSchema,
  computeAlertRecordDigest,
  escalateAlert,
  foldAlertChains,
  raiseAlert,
  resolveAlert,
  SealedAlertRecordSchema,
  verifySealedAlertRecord,
} from './alerts';
export type {
  AlertChainFold,
  AlertChainRow,
  AlertFindingSummary,
  AlertRaiseOutcome,
  AlertRecordContent,
  EscalateAlertOptions,
  RaiseAlertOptions,
  ResolveAlertOptions,
  SealedAlertRecord,
} from './alerts';

// Escalation through the W022 authority seam.
export {
  buildEscalationProposal,
  computeProposalDigest,
  EscalationOutcomeContentSchema,
  outcomeKindOfDecision,
  planEscalation,
  recordEscalationOutcome,
  SealedEscalationOutcomeSchema,
  verifySealedEscalationOutcome,
} from './escalation';
export type {
  BuildEscalationProposalOptions,
  EscalationOutcomeContent,
  EscalationPlan,
  PlanEscalationOptions,
  RecordEscalationOutcomeOptions,
  SealedEscalationOutcome,
} from './escalation';

// Typed notifications through the NotificationPort seam.
export {
  buildNotification,
  InMemoryNotificationAdapter,
  NotificationRecordContentSchema,
  SealedNotificationRecordSchema,
  verifySealedNotification,
} from './notifications';
export type {
  BuildNotificationOptions,
  NotificationDispatchRequest,
  NotificationPort,
  NotificationReceipt,
  NotificationRecordContent,
  SealedNotificationRecord,
} from './notifications';

// Published schema surface + contract emission.
export {
  ALERTS_SCHEMA_SURFACE,
  ALERTS_CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  ALERTS_CONTRACT_DIR,
  renderAlertsContractFiles,
  typeToKebabCase,
} from './contract-emission';
