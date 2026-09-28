/**
 * SEVERITY + ESCALATION POLICY AS DATA (the W043 pin): finding class
 * token (+ optional finding-status driver) -> severity -> escalation
 * path (who/what gets notified, after what delay, with what re-notify
 * cadence, escalating to whom). Policy is DATA — sealed, versioned,
 * content-addressed records — never hard-coded branching: swapping a
 * policy record changes escalation with NO code change.
 *
 * - rules key on NEUTRAL finding-class tokens (the closed vocabulary is
 *   @epoch/supervision's; parity is pinned at the service boundary);
 * - rule lookup is deterministic precedence: exact (class + status)
 *   beats class-only beats the default severity/path;
 * - duplicate (class, status) keys are typed admission rejections;
 * - targets are OPAQUE references (role/principal/channel) — the closed
 *   neutral kinds; provider vocabulary is rejected at the seam.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  AlertsPrincipalIdSchema,
  NonNegativeDecimalSchema,
  PolicyRuleIdSchema,
  SemverCoreSchema,
  AlertPolicyIdSchema,
  FindingClassTokenSchema,
} from './primitives';
import {
  ALERT_SEVERITIES,
  ALERTS_RECORD_VERSION,
  ESCALATION_POLICY_SCHEMA_NAME,
  FINDING_STATES,
  NOTIFICATION_TARGET_KINDS,
} from './version';
import { flattenIssues, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { AlertsResult } from './errors';

// --------------------------------------------------------------------------------
// The escalation path (who/what, after what delay, with what cadence).
// --------------------------------------------------------------------------------

/** One notification target: a closed neutral kind plus an opaque reference. */
export const NotificationTargetSchema = z
  .strictObject({
    targetKind: z.enum(NOTIFICATION_TARGET_KINDS),
    targetRef: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'NotificationTarget',
    title: 'NotificationTarget',
    description:
      'One notification target: a closed neutral kind (role, principal, channel) plus an opaque reference — never a provider identity.',
  });

/** One notification target. */
export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;

/** The escalation path of one policy rule. */
export const EscalationPathSchema = z
  .strictObject({
    notify: z.array(NotificationTargetSchema).min(1).max(16),
    escalationDelaySeconds: NonNegativeDecimalSchema,
    reNotifyCadenceSeconds: NonNegativeDecimalSchema,
    escalateTo: z.array(NotificationTargetSchema).max(16),
  })
  .readonly()
  .superRefine((path, ctx) => {
    for (const field of ['notify', 'escalateTo'] as const) {
      const targets = path[field];
      for (let i = 1; i < targets.length; i += 1) {
        const key = (target: NotificationTarget) => `${target.targetKind}\u0000${target.targetRef}`;
        if (key(targets[i]!) < key(targets[i - 1]!)) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted by (targetKind, targetRef) ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
        if (key(targets[i]!) === key(targets[i - 1]!)) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be duplicate-free by (targetKind, targetRef)`,
            path: [field],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'EscalationPath',
    title: 'EscalationPath',
    description:
      'The escalation path of one policy rule: the notify targets, the escalation delay (seconds), the re-notify cadence (seconds), and the next escalation tier.',
  });

/** One escalation path. */
export type EscalationPath = z.infer<typeof EscalationPathSchema>;

// --------------------------------------------------------------------------------
// Policy rules + the policy record.
// --------------------------------------------------------------------------------

/** One policy rule: finding class token (+ optional status driver) -> severity -> escalation path. */
export const PolicyRuleSchema = z
  .strictObject({
    ruleId: PolicyRuleIdSchema,
    findingClass: FindingClassTokenSchema,
    findingStatus: z.enum(FINDING_STATES).optional(),
    severity: z.enum(ALERT_SEVERITIES),
    escalation: EscalationPathSchema,
  })
  .readonly()
  .meta({
    id: 'PolicyRule',
    title: 'PolicyRule',
    description:
      'One escalation-policy rule: the finding-class token (optionally scoped to one finding-status driver), the mapped severity, and the escalation path.',
  });

/** One policy rule. */
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/** The immutable content of one escalation policy (everything except the digest). */
export const EscalationPolicyContentSchema = z
  .strictObject({
    schema: z.literal(ESCALATION_POLICY_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    policyId: AlertPolicyIdSchema,
    tenantId: TenantIdSchema,
    policyVersion: SemverCoreSchema,
    title: z.string().min(1).max(256),
    defaultSeverity: z.enum(ALERT_SEVERITIES),
    defaultEscalation: EscalationPathSchema,
    rules: z.array(PolicyRuleSchema).max(128),
    activatedAt: TimestampSchema,
    activatedBy: AlertsPrincipalIdSchema,
  })
  .readonly()
  .superRefine((policy, ctx) => {
    for (let i = 1; i < policy.rules.length; i += 1) {
      const key = (rule: PolicyRule) =>
        `${rule.findingClass}\u0000${rule.findingStatus ?? '*'}`;
      if (key(policy.rules[i]!) < key(policy.rules[i - 1]!)) {
        ctx.addIssue({
          code: 'custom',
          message: 'rules must be sorted by (findingClass, findingStatus) ascending (deterministic serialization)',
          path: ['rules'],
        });
        break;
      }
      if (key(policy.rules[i]!) === key(policy.rules[i - 1]!)) {
        ctx.addIssue({
          code: 'custom',
          message: 'rules must be duplicate-free by (findingClass, findingStatus) — rule precedence is deterministic',
          path: ['rules'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'EscalationPolicyContent',
    title: 'EscalationPolicyContent',
    description:
      'The immutable content of one escalation policy: identity, tenant scope, policy version, default severity and escalation, the sorted rules, and activation provenance.',
  });

/** One escalation-policy content. */
export type EscalationPolicyContent = z.infer<typeof EscalationPolicyContentSchema>;

/** The SEALED escalation policy: content plus its SHA-256 content digest. */
export const SealedEscalationPolicySchema = z
  .strictObject({
    schema: z.literal(ESCALATION_POLICY_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    policyId: AlertPolicyIdSchema,
    tenantId: TenantIdSchema,
    policyVersion: SemverCoreSchema,
    title: z.string().min(1).max(256),
    defaultSeverity: z.enum(ALERT_SEVERITIES),
    defaultEscalation: EscalationPathSchema,
    rules: z.array(PolicyRuleSchema).max(128),
    activatedAt: TimestampSchema,
    activatedBy: AlertsPrincipalIdSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedEscalationPolicy',
    title: 'SealedEscalationPolicy',
    description:
      'The sealed escalation policy: immutable policy-as-data content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed escalation policy. */
export type SealedEscalationPolicy = z.infer<typeof SealedEscalationPolicySchema>;

/** Compute the content digest of an escalation-policy content. */
export function computeEscalationPolicyDigest(content: EscalationPolicyContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Admit (validate + seal) an escalation policy. */
export function admitEscalationPolicy(input: unknown): AlertsResult<SealedEscalationPolicy> {
  const parsed = EscalationPolicyContentSchema.safeParse(input);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeEscalationPolicyDigest(parsed.data) },
  };
}

/** Verify a sealed escalation policy: schema + digest recomputation. */
export function verifySealedEscalationPolicy(sealed: unknown): AlertsResult<SealedEscalationPolicy> {
  const parsed = SealedEscalationPolicySchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed escalation policy digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.policyId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic rule lookup (policy-as-data evaluation).
// --------------------------------------------------------------------------------

/** The resolved decision of one policy lookup. */
export interface PolicyRuleDecision {
  readonly matched: boolean;
  readonly ruleId: string | null;
  readonly severity: (typeof ALERT_SEVERITIES)[number];
  readonly escalation: EscalationPath;
}

/**
 * Resolve the policy decision for one (findingClass, findingStatus):
 * deterministic precedence — exact (class + status) beats class-only
 * beats the policy defaults. Pure; no code change can move a class
 * between severities without a new policy record (policy is data).
 */
export function resolvePolicyRule(
  policy: SealedEscalationPolicy,
  findingClass: string,
  findingStatus: string,
): PolicyRuleDecision {
  const exact = policy.rules.find(
    (rule) => rule.findingClass === findingClass && rule.findingStatus === findingStatus,
  );
  if (exact !== undefined) {
    return { matched: true, ruleId: exact.ruleId, severity: exact.severity, escalation: exact.escalation };
  }
  const byClass = policy.rules.find(
    (rule) => rule.findingClass === findingClass && rule.findingStatus === undefined,
  );
  if (byClass !== undefined) {
    return { matched: true, ruleId: byClass.ruleId, severity: byClass.severity, escalation: byClass.escalation };
  }
  return {
    matched: false,
    ruleId: null,
    severity: policy.defaultSeverity,
    escalation: policy.defaultEscalation,
  };
}

/** Flatten issues re-export (surface helper used by tests + hosts). */
export { flattenIssues };
