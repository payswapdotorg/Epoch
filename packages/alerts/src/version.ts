/**
 * Alerts contract versions and the closed vocabularies (W043).
 *
 * The alerts kernel owns the SEVERITY/ESCALATION POLICY and the ALERT
 * LIFECYCLE over supervision findings (the finding production is
 * @epoch/supervision's authority — the two kernels never link at
 * runtime; compatibility is pinned by the supervision-runtime service's
 * compile-time parity module + runtime parity tests).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open
 * string) and provider-neutral: no entry names a vendor, brand,
 * marketplace or notification surface. External channels stay behind
 * the NotificationPort seam (this package ships ONE in-memory reference
 * adapter; concrete relays are future adapters — the W042 external
 * event bridge does not exist yet, and nothing here requires it).
 *
 * THE AUTHORITY SPLIT (lock rules 3/16):
 * - Action Gateway (W022) — escalation ACTIONS are typed W003 action
 *   proposals authorized by the gateway FIRST; this kernel never
 *   executes anything (`gateway-bypass-rejected`).
 * - Supervision (@epoch/supervision) — the finding vocabulary. Policy
 *   rules key on NEUTRAL finding-class tokens; the finding-status
 *   driver grammar (due/late/drifted/blocked) is mirrored here and
 *   parity-pinned at the service boundary.
 * - Tenancy (W009) — tenant scoping on every record
 *   (`tenant-isolation-rejected`).
 */

/** Version of the published alerts contract surface (schemas/ + types). */
export const ALERTS_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized alerts record. */
export const ALERTS_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Id grammars (kind-prefixed, opaque, provider-neutral).
// --------------------------------------------------------------------------------

/** Alert id grammar: `alert:<slug>`. */
export const ALERT_ID_PATTERN = /^alert:[a-z0-9][a-z0-9-]{0,62}$/;

/** Escalation-policy id grammar: `alert-policy:<slug>`. */
export const ALERT_POLICY_ID_PATTERN = /^alert-policy:[a-z0-9][a-z0-9-]{0,58}$/;

/** Escalation-policy rule id grammar: `rule:<slug>`. */
export const POLICY_RULE_ID_PATTERN = /^rule:[a-z0-9][a-z0-9-]{0,62}$/;

/** Escalation outcome id grammar: `escalation:<slug>`. */
export const ESCALATION_OUTCOME_ID_PATTERN = /^escalation:[a-z0-9][a-z0-9-]{0,58}$/;

/** Notification id grammar: `notification:<slug>`. */
export const NOTIFICATION_ID_PATTERN = /^notification:[a-z0-9][a-z0-9-]{0,54}$/;

/** Alerts principal id grammar (the W009 principal grammar, mirrored). */
export const ALERTS_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Neutral finding-class token grammar (the supervision class tokens). */
export const FINDING_CLASS_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** Neutral subject-kind token grammar (the supervision subject kinds). */
export const SUBJECT_KIND_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/** Finding id grammar (the supervision finding ids, mirrored). */
export const FINDING_ID_MIRROR_PATTERN = /^finding:[a-z0-9][a-z0-9-]{0,62}$/;

// --------------------------------------------------------------------------------
// Severities (policy-controlled, severity-classified alerts).
// --------------------------------------------------------------------------------

/** The closed alert severities. */
export const ALERT_SEVERITIES = ['info', 'warning', 'major', 'critical'] as const;

/** One alert severity. */
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

// --------------------------------------------------------------------------------
// Finding-status driver grammar (mirrored from @epoch/supervision;
// parity-pinned at the service boundary).
// --------------------------------------------------------------------------------

/** The finding-status drivers of alert revisions (the supervision mirror). */
export const FINDING_STATES = ['due', 'drifted', 'late', 'blocked'] as const;

/** One finding status driver. */
export type FindingState = (typeof FINDING_STATES)[number];

// --------------------------------------------------------------------------------
// Alert lifecycle.
// --------------------------------------------------------------------------------

/** The closed alert-chain head statuses. */
export const ALERT_STATUSES = ['raised', 'escalated', 'resolved'] as const;

/** One alert status. */
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** The closed alert resolution kinds. */
export const ALERT_RESOLUTION_KINDS = ['remediated', 'false-positive', 'withdrawn'] as const;

/** One alert resolution kind. */
export type AlertResolutionKind = (typeof ALERT_RESOLUTION_KINDS)[number];

// --------------------------------------------------------------------------------
// Escalation outcomes (the W022 authority seam).
// --------------------------------------------------------------------------------

/**
 * The closed escalation outcome kinds — the typed record of what the
 * gateway decision produced (the decision itself is W003
 * AuthorizationDecision vocabulary consumed at admission):
 * `dispatched` (authorized), `blocked-by-gateway` (denied),
 * `awaiting-approval` (escalated to a human approver).
 */
export const ESCALATION_OUTCOME_KINDS = [
  'dispatched',
  'blocked-by-gateway',
  'awaiting-approval',
] as const;

/** One escalation outcome kind. */
export type EscalationOutcomeKind = (typeof ESCALATION_OUTCOME_KINDS)[number];

// --------------------------------------------------------------------------------
// Notifications (the NotificationPort seam).
// --------------------------------------------------------------------------------

/**
 * The closed notification channel kinds — provider-neutral by
 * construction. `in-app` is the reference adapter's channel (alerts
 * remain in Epoch); `external-relay` is the future W042 bridge hook.
 * A channel kind outside this closed set is provider vocabulary:
 * typed `provider-vocabulary-rejected` at the seam.
 */
export const NOTIFICATION_CHANNEL_KINDS = ['in-app', 'external-relay'] as const;

/** One notification channel kind. */
export type NotificationChannelKind = (typeof NOTIFICATION_CHANNEL_KINDS)[number];

/** The closed notification target kinds (opaque references). */
export const NOTIFICATION_TARGET_KINDS = ['role', 'principal', 'channel'] as const;

/** One notification target kind. */
export type NotificationTargetKind = (typeof NOTIFICATION_TARGET_KINDS)[number];

// --------------------------------------------------------------------------------
// Schema discriminators (the sealed-envelope discipline).
// --------------------------------------------------------------------------------

export const ESCALATION_POLICY_SCHEMA_NAME = 'epoch.alerts.escalation-policy' as const;
export const ALERT_RECORD_SCHEMA_NAME = 'epoch.alerts.alert' as const;
export const ESCALATION_OUTCOME_SCHEMA_NAME = 'epoch.alerts.escalation-outcome' as const;
export const NOTIFICATION_SCHEMA_NAME = 'epoch.alerts.notification' as const;

// --------------------------------------------------------------------------------
// The escalation action type (W003 vocabulary; constant proposal shape).
// --------------------------------------------------------------------------------

/** The action-type id of every escalation proposal. */
export const ESCALATION_ACTION_TYPE_ID = 'supervision.alert.escalate' as const;

/** The action-type version of every escalation proposal. */
export const ESCALATION_ACTION_TYPE_VERSION = '1.0.0' as const;

/** The authority scope every escalation proposal requests. */
export const ESCALATION_AUTHORITY_SCOPE = 'supervision:alert' as const;

// --------------------------------------------------------------------------------
// Vocabulary helpers.
// --------------------------------------------------------------------------------

/** The prefix of an alert id (`alert`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
