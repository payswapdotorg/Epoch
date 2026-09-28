/**
 * The alerts schema-surface registry: every data type published at the
 * `@epoch/alerts` ownership boundary, paired with its zod schema.
 *
 * W043 publishes the IN-PACKAGE full surface under
 * `packages/alerts/schemas` (the W006/W007/W009/W023/W036/W038
 * in-package precedent). The PUBLIC core-record projection under
 * `contracts/supervision` (the W012 convention) is composed with the
 * supervision-kernel core records by the supervision-runtime service
 * (the only W043 component depending on both kernels).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { type ZodType } from 'zod';
import {
  AlertIdSchema,
  AlertPolicyIdSchema,
  AlertsPrincipalIdSchema,
  EscalationOutcomeIdSchema,
  FindingClassTokenSchema,
  FindingIdMirrorSchema,
  NotificationIdSchema,
  PolicyRuleIdSchema,
  SubjectKindTokenSchema,
} from './primitives';
import {
  EscalationPathSchema,
  NotificationTargetSchema,
  PolicyRuleSchema,
  EscalationPolicyContentSchema,
  SealedEscalationPolicySchema,
} from './policy';
import {
  AlertFindingSummarySchema,
  AlertRecordContentSchema,
  SealedAlertRecordSchema,
} from './alerts';
import {
  EscalationOutcomeContentSchema,
  SealedEscalationOutcomeSchema,
} from './escalation';
import {
  NotificationRecordContentSchema,
  SealedNotificationRecordSchema,
} from './notifications';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The FULL published schema surface of @epoch/alerts. */
export const ALERTS_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AlertId', schema: AlertIdSchema },
  { type: 'AlertPolicyId', schema: AlertPolicyIdSchema },
  { type: 'AlertsPrincipalId', schema: AlertsPrincipalIdSchema },
  { type: 'EscalationOutcomeId', schema: EscalationOutcomeIdSchema },
  { type: 'FindingClassToken', schema: FindingClassTokenSchema },
  { type: 'FindingIdMirror', schema: FindingIdMirrorSchema },
  { type: 'NotificationId', schema: NotificationIdSchema },
  { type: 'PolicyRuleId', schema: PolicyRuleIdSchema },
  { type: 'SubjectKindToken', schema: SubjectKindTokenSchema },
  { type: 'NotificationTarget', schema: NotificationTargetSchema },
  { type: 'EscalationPath', schema: EscalationPathSchema },
  { type: 'PolicyRule', schema: PolicyRuleSchema },
  { type: 'EscalationPolicyContent', schema: EscalationPolicyContentSchema },
  { type: 'SealedEscalationPolicy', schema: SealedEscalationPolicySchema },
  { type: 'AlertFindingSummary', schema: AlertFindingSummarySchema },
  { type: 'AlertRecordContent', schema: AlertRecordContentSchema },
  { type: 'SealedAlertRecord', schema: SealedAlertRecordSchema },
  { type: 'EscalationOutcomeContent', schema: EscalationOutcomeContentSchema },
  { type: 'SealedEscalationOutcome', schema: SealedEscalationOutcomeSchema },
  { type: 'NotificationRecordContent', schema: NotificationRecordContentSchema },
  { type: 'SealedNotificationRecord', schema: SealedNotificationRecordSchema },
] as const;

/**
 * The CORE record subset of the public contract projection
 * (`contracts/supervision`, the W012 convention).
 */
export const ALERTS_CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'NotificationTarget', schema: NotificationTargetSchema },
  { type: 'EscalationPath', schema: EscalationPathSchema },
  { type: 'PolicyRule', schema: PolicyRuleSchema },
  { type: 'SealedEscalationPolicy', schema: SealedEscalationPolicySchema },
  { type: 'AlertFindingSummary', schema: AlertFindingSummarySchema },
  { type: 'SealedAlertRecord', schema: SealedAlertRecordSchema },
  { type: 'SealedEscalationOutcome', schema: SealedEscalationOutcomeSchema },
  { type: 'SealedNotificationRecord', schema: SealedNotificationRecordSchema },
] as const;
