/**
 * Alerts primitives: the package-local id grammars plus shared
 * provider-neutral primitives (W003 action-protocol re-exports used by
 * the escalation seam).
 */
import { z } from 'zod';
import {
  ALERT_ID_PATTERN,
  ALERT_POLICY_ID_PATTERN,
  ALERTS_PRINCIPAL_ID_PATTERN,
  ESCALATION_OUTCOME_ID_PATTERN,
  FINDING_CLASS_TOKEN_PATTERN,
  FINDING_ID_MIRROR_PATTERN,
  NOTIFICATION_ID_PATTERN,
  POLICY_RULE_ID_PATTERN,
  SUBJECT_KIND_TOKEN_PATTERN,
} from './version';

/** Alert id (`alert:<slug>`). */
export const AlertIdSchema = z.string().regex(ALERT_ID_PATTERN).meta({
  id: 'AlertId',
  title: 'AlertId',
  description: 'Opaque alert-chain identity: "alert:<slug>", derived deterministically from the finding it watches.',
});

/** One alert id. */
export type AlertId = z.infer<typeof AlertIdSchema>;

/** Escalation-policy id (`alert-policy:<slug>`). */
export const AlertPolicyIdSchema = z.string().regex(ALERT_POLICY_ID_PATTERN).meta({
  id: 'AlertPolicyId',
  title: 'AlertPolicyId',
  description: 'Opaque escalation-policy identity: "alert-policy:<slug>".',
});

/** One escalation-policy id. */
export type AlertPolicyId = z.infer<typeof AlertPolicyIdSchema>;

/** Escalation-policy rule id (`rule:<slug>`). */
export const PolicyRuleIdSchema = z.string().regex(POLICY_RULE_ID_PATTERN).meta({
  id: 'PolicyRuleId',
  title: 'PolicyRuleId',
  description: 'Opaque escalation-policy rule identity: "rule:<slug>".',
});

/** One policy rule id. */
export type PolicyRuleId = z.infer<typeof PolicyRuleIdSchema>;

/** Escalation outcome id (`escalation:<slug>`). */
export const EscalationOutcomeIdSchema = z.string().regex(ESCALATION_OUTCOME_ID_PATTERN).meta({
  id: 'EscalationOutcomeId',
  title: 'EscalationOutcomeId',
  description: 'Opaque escalation-outcome identity: "escalation:<slug>".',
});

/** One escalation outcome id. */
export type EscalationOutcomeId = z.infer<typeof EscalationOutcomeIdSchema>;

/** Notification id (`notification:<slug>`). */
export const NotificationIdSchema = z.string().regex(NOTIFICATION_ID_PATTERN).meta({
  id: 'NotificationId',
  title: 'NotificationId',
  description: 'Opaque notification identity: "notification:<slug>".',
});

/** One notification id. */
export type NotificationId = z.infer<typeof NotificationIdSchema>;

/** Alerts principal id (the W009 principal grammar, mirrored). */
export const AlertsPrincipalIdSchema = z.string().regex(ALERTS_PRINCIPAL_ID_PATTERN).meta({
  id: 'AlertsPrincipalId',
  title: 'AlertsPrincipalId',
  description: 'Opaque acting principal of the alerts domain: "principal:<slug>" (the W009 grammar).',
});

/** One alerts principal id. */
export type AlertsPrincipalId = z.infer<typeof AlertsPrincipalIdSchema>;

/** A neutral finding-class token (the supervision class tokens). */
export const FindingClassTokenSchema = z.string().regex(FINDING_CLASS_TOKEN_PATTERN).meta({
  id: 'FindingClassToken',
  title: 'FindingClassToken',
  description: 'A neutral finding-class token: kebab-case, bounded (the closed vocabulary is @epoch/supervision\'s).',
});

/** One finding-class token. */
export type FindingClassToken = z.infer<typeof FindingClassTokenSchema>;

/** A neutral subject-kind token (the supervision subject kinds). */
export const SubjectKindTokenSchema = z.string().regex(SUBJECT_KIND_TOKEN_PATTERN).meta({
  id: 'SubjectKindToken',
  title: 'SubjectKindToken',
  description: 'A neutral subject-kind token: kebab-case, bounded (the closed vocabulary is @epoch/supervision\'s).',
});

/** One subject-kind token. */
export type SubjectKindToken = z.infer<typeof SubjectKindTokenSchema>;

/** Finding id (the supervision finding ids, mirrored). */
export const FindingIdMirrorSchema = z.string().regex(FINDING_ID_MIRROR_PATTERN).meta({
  id: 'FindingId',
  title: 'FindingId',
  description: 'Opaque supervision-finding identity (the @epoch/supervision grammar), mirrored for typed consumption.',
});

/** One mirrored finding id. */
export type FindingIdMirror = z.infer<typeof FindingIdMirrorSchema>;

export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';

export { canonicalDigest, sha256Hex } from '@epoch/agent-protocol';
export type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
export { TimestampSchema } from '@epoch/agent-protocol';

/**
 * Non-negative decimal — MIRRORED from the shared
 * `NON_NEGATIVE_DECIMAL_PATTERN` grammar (canonical decimal string, no
 * exponent, no sign; the W036/W038 precedent for digest-safe exact
 * arithmetic).
 */
export const NonNegativeDecimalSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a non-negative decimal string (no exponent, no sign)')
  .meta({
    id: 'NonNegativeDecimal',
    title: 'NonNegativeDecimal',
    description: 'Non-negative decimal amount as a canonical string (digest-safe, no exponent form).',
  });

/** One non-negative decimal. */
export type NonNegativeDecimal = z.infer<typeof NonNegativeDecimalSchema>;

/** Semantic version core — MIRRORED from the shared `SEMVER_CORE_PATTERN` grammar. */
export const SemverCoreSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version core of the form MAJOR.MINOR.PATCH')
  .meta({
    id: 'SemverCore',
    title: 'SemverCore',
    description: 'Semantic version core (no prerelease/build suffixes).',
  });

/** One semantic version core. */
export type SemverCore = z.infer<typeof SemverCoreSchema>;
