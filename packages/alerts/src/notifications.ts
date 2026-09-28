/**
 * TYPED NOTIFICATIONS through the OPTIONAL NotificationPort seam (the
 * W043 pin):
 *
 * - notification records are typed, content-addressed, tenant-scoped
 *   data carrying the alert revision they concern;
 * - the channel vocabulary is CLOSED and provider-neutral (`in-app`,
 *   `external-relay`): a channel kind or target kind outside the closed
 *   neutral sets is provider vocabulary — typed
 *   `provider-vocabulary-rejected` at the seam, BEFORE generic
 *   validation (the kernel never names a provider);
 * - the NotificationPort is the CONTRACT: ONE in-memory reference
 *   adapter ships here; concrete relays (the W042 external-event
 *   bridge) are future adapters — nothing requires one;
 * - dispatch is REPLAY-SAFE: re-dispatching the same notification
 *   through the reference adapter yields the same receipt with
 *   `duplicate: true` (idempotent by digest; zero clocks, zero
 *   randomness — the dispatch instant is caller-supplied).
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { AlertsPrincipalIdSchema, NotificationIdSchema } from './primitives';
import {
  ALERTS_RECORD_VERSION,
  ALERT_SEVERITIES,
  FINDING_STATES,
  NOTIFICATION_CHANNEL_KINDS,
  NOTIFICATION_SCHEMA_NAME,
  NOTIFICATION_TARGET_KINDS,
} from './version';
import type { NotificationChannelKind } from './version';
import type { SealedAlertRecord } from './alerts';
import { NotificationTargetSchema, type NotificationTarget } from './policy';
import { hasUnrecognizedKeys, providerVocabularyError, validationError, vendorFieldsError } from './issues';
import type { AlertsResult } from './errors';

// --------------------------------------------------------------------------------
// The notification record.
// --------------------------------------------------------------------------------

/** The immutable content of one notification. */
export const NotificationRecordContentSchema = z
  .strictObject({
    schema: z.literal(NOTIFICATION_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    notificationId: NotificationIdSchema,
    tenantId: TenantIdSchema,
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: z.string().regex(/^[0-9a-f]{64}$/),
    alertRevision: z.number().int().min(1),
    severity: z.enum(ALERT_SEVERITIES),
    findingClass: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    findingStatus: z.enum(FINDING_STATES),
    subjectKind: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    subjectId: z.string().min(1).max(256),
    channelKind: z.enum(NOTIFICATION_CHANNEL_KINDS),
    targets: z.array(NotificationTargetSchema).min(1).max(16),
    title: z.string().min(1).max(256),
    body: z.string().min(1).max(4096),
    dispatchedAt: TimestampSchema,
    dispatchedBy: AlertsPrincipalIdSchema,
  })
  .readonly()
  .superRefine((notification, ctx) => {
    for (let i = 1; i < notification.targets.length; i += 1) {
      const key = (target: NotificationTarget) => `${target.targetKind}\u0000${target.targetRef}`;
      if (key(notification.targets[i]!) < key(notification.targets[i - 1]!)) {
        ctx.addIssue({
          code: 'custom',
          message: 'targets must be sorted by (targetKind, targetRef) ascending (deterministic serialization)',
          path: ['targets'],
        });
        break;
      }
      if (key(notification.targets[i]!) === key(notification.targets[i - 1]!)) {
        ctx.addIssue({
          code: 'custom',
          message: 'targets must be duplicate-free by (targetKind, targetRef)',
          path: ['targets'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'NotificationRecordContent',
    title: 'NotificationRecordContent',
    description:
      'The immutable content of one notification: identity, tenant scope, the alert revision it concerns, the mapped severity and finding anchors, the closed neutral channel kind, the sorted targets, and the title/body/dispatch provenance.',
  });

/** One notification content. */
export type NotificationRecordContent = z.infer<typeof NotificationRecordContentSchema>;

/** The SEALED notification: content plus its SHA-256 content digest. */
export const SealedNotificationRecordSchema = z
  .strictObject({
    schema: z.literal(NOTIFICATION_SCHEMA_NAME),
    schemaVersion: z.literal(ALERTS_RECORD_VERSION),
    notificationId: NotificationIdSchema,
    tenantId: TenantIdSchema,
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: z.string().regex(/^[0-9a-f]{64}$/),
    alertRevision: z.number().int().min(1),
    severity: z.enum(ALERT_SEVERITIES),
    findingClass: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    findingStatus: z.enum(FINDING_STATES),
    subjectKind: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
    subjectId: z.string().min(1).max(256),
    channelKind: z.enum(NOTIFICATION_CHANNEL_KINDS),
    targets: z.array(NotificationTargetSchema).min(1).max(16),
    title: z.string().min(1).max(256),
    body: z.string().min(1).max(4096),
    dispatchedAt: TimestampSchema,
    dispatchedBy: AlertsPrincipalIdSchema,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedNotificationRecord',
    title: 'SealedNotificationRecord',
    description:
      'The sealed notification: immutable typed content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed notification record. */
export type SealedNotificationRecord = z.infer<typeof SealedNotificationRecordSchema>;

/** Options of one notification construction. */
export interface BuildNotificationOptions {
  readonly notificationId: string;
  readonly alert: SealedAlertRecord;
  readonly channelKind: NotificationChannelKind;
  readonly targets: readonly NotificationTarget[];
  readonly title: string;
  readonly body: string;
  readonly dispatchedAt: string;
  readonly dispatchedBy: string;
}

/**
 * Build (validate + seal) one notification for an alert revision. The
 * PROVIDER-VOCABULARY pre-classifier runs FIRST: a channel kind or
 * target kind outside the closed neutral vocabularies is a typed
 * `provider-vocabulary-rejected` (never a generic validation issue).
 */
export function buildNotification(options: BuildNotificationOptions): AlertsResult<SealedNotificationRecord> {
  if (!NOTIFICATION_CHANNEL_KINDS.includes(options.channelKind as never)) {
    return {
      ok: false,
      error: providerVocabularyError(options.notificationId, { channelKind: options.channelKind }),
    };
  }
  for (const target of options.targets) {
    if (!NOTIFICATION_TARGET_KINDS.includes(target.targetKind as never)) {
      return {
        ok: false,
        error: providerVocabularyError(options.notificationId, { targetKind: target.targetKind }),
      };
    }
  }
  const sortedTargets = [...options.targets].sort((a, b) =>
    a.targetKind !== b.targetKind
      ? a.targetKind < b.targetKind
        ? -1
        : 1
      : a.targetRef < b.targetRef
        ? -1
        : 1,
  );
  const content: NotificationRecordContent = {
    schema: NOTIFICATION_SCHEMA_NAME,
    schemaVersion: ALERTS_RECORD_VERSION,
    notificationId: options.notificationId,
    tenantId: options.alert.tenantId,
    alertId: options.alert.alertId,
    alertDigest: options.alert.contentDigest,
    alertRevision: options.alert.revision,
    severity: options.alert.severity,
    findingClass: options.alert.findingClass,
    findingStatus: options.alert.findingStatus,
    subjectKind: options.alert.subjectKind,
    subjectId: options.alert.subjectId,
    channelKind: options.channelKind,
    targets: sortedTargets,
    title: options.title,
    body: options.body,
    dispatchedAt: options.dispatchedAt,
    dispatchedBy: options.dispatchedBy,
  };
  const parsed = NotificationRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed notification: schema + digest recomputation. */
export function verifySealedNotification(sealed: unknown): AlertsResult<SealedNotificationRecord> {
  const parsed = SealedNotificationRecordSchema.safeParse(sealed);
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
        message: 'sealed notification digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.notificationId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The NotificationPort seam (the contract; ONE reference adapter).
// --------------------------------------------------------------------------------

/** One dispatch request handed to the port. */
export interface NotificationDispatchRequest {
  readonly notification: SealedNotificationRecord;
  readonly dispatchedAt: string;
  readonly dispatchedBy: string;
}

/** The typed receipt of one dispatch attempt. */
export interface NotificationReceipt {
  readonly notificationId: string;
  readonly notificationDigest: string;
  readonly channelKind: NotificationChannelKind;
  readonly acceptedAt: string;
  readonly duplicate: boolean;
}

/**
 * THE NOTIFICATION PORT (the W043 contract): external channels live
 * behind this seam. The core never names a provider; the channel kind
 * and target kinds are closed neutral vocabularies. The port receives
 * SEALED notifications and returns typed receipts — it never mutates
 * alert state.
 */
export interface NotificationPort {
  dispatch(request: NotificationDispatchRequest): AlertsResult<NotificationReceipt>;
}

/**
 * The ONE in-memory reference adapter: records dispatches keyed by
 * notification digest; re-dispatching the same notification returns the
 * same receipt with `duplicate: true` (replay-safe). No clocks, no
 * randomness, no network, no vendor names — concrete relays replace it
 * with real adapters of the same interface.
 */
export class InMemoryNotificationAdapter implements NotificationPort {
  private readonly receipts = new Map<string, NotificationReceipt>();

  dispatch(request: NotificationDispatchRequest): AlertsResult<NotificationReceipt> {
    const verified = verifySealedNotification(request.notification);
    if (!verified.ok) {
      return verified;
    }
    const notification = verified.value;
    const existing = this.receipts.get(notification.contentDigest);
    if (existing !== undefined) {
      return { ok: true, value: existing };
    }
    const receipt: NotificationReceipt = {
      notificationId: notification.notificationId,
      notificationDigest: notification.contentDigest,
      channelKind: notification.channelKind,
      acceptedAt: request.dispatchedAt,
      duplicate: false,
    };
    this.receipts.set(notification.contentDigest, receipt);
    return { ok: true, value: receipt };
  }

  /** The recorded receipts, canonically ordered (deterministic reads). */
  recordedReceipts(): readonly NotificationReceipt[] {
    return [...this.receipts.values()].sort((a, b) =>
      a.notificationId < b.notificationId ? -1 : 1,
    );
  }

  /** The number of distinct dispatched notifications. */
  get size(): number {
    return this.receipts.size;
  }
}
