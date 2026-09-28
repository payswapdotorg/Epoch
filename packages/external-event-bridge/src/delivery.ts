/**
 * The delivery machinery (the W042 dispatch pin): typed retry policy as
 * DATA, content-addressed per-attempt receipts, the typed
 * provider-unavailability record with its fallback semantics, and the
 * manual-queue work items an unresolved request becomes (the
 * the external-integration contract failure-and-fallback discipline: Epoch
 * continues normally; requests become pending/manual/alternative work
 * items according to policy; no project truth is fabricated; an
 * unresolved request remains explicit).
 *
 * RETRY IS DATA, NEVER A TIMER: a retry policy is a caller-supplied
 * sequence of attempt INSTANTS (strictly ascending); the reference host
 * executes the schedule deterministically and stamps each receipt with
 * its scheduled instant. Zero wall-clock, zero randomness, zero I/O.
 *
 * RECEIPTS ARE CONTENT-ADDRESSED OUTCOME RECORDS PER DELIVERY ATTEMPT:
 * every attempt (success, retryable or terminal) mints a sealed
 * receipt; a duplicate delivery (the same idempotency key) returns the
 * SEALED PRIOR receipts — never a second effect.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  CausationIdSchema,
  CorrelationIdSchema,
  DeliveryReceiptIdSchema,
  ManualQueueIdSchema,
  OutboundRequestIdSchema,
  PositiveIntegerSchema,
  BridgePrincipalIdSchema,
  BridgeTimestampSchema,
  RecipientRefSchema,
  Sha256HexSchema,
  IntakeReceiptIdSchema,
  ExternalEventIdSchema,
  IdempotencyKeySchema,
} from './primitives';
import { AdapterIdSchema, type AdapterId } from './provenance';
import {
  DELIVERY_ATTEMPT_OUTCOMES,
  DELIVERY_RECEIPT_SCHEMA_NAME,
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  INTAKE_RECEIPT_SCHEMA_NAME,
  MANUAL_QUEUE_SCHEMA_NAME,
  OUTBOUND_REQUEST_CLASSES,
  PROVIDER_FALLBACK_MODES,
  PROVIDER_UNAVAILABLE_REASONS,
  PROVIDER_UNAVAILABLE_SCHEMA_NAME,
} from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';

// --------------------------------------------------------------------------------
// The retry policy (typed DATA — caller-supplied instant sequences).
// --------------------------------------------------------------------------------

/**
 * The retry policy: the caller-supplied attempt instants (1..16,
 * strictly ascending — attempt N executes at instants[N-1]). There are
 * NO timers and NO wall-clock reads anywhere in this kernel: the
 * reference host executes the schedule deterministically and the
 * instants travel as receipt data.
 */
export const RetryPolicySchema = z
  .strictObject({
    attemptInstants: z.array(BridgeTimestampSchema).min(1).max(16).readonly(),
  })
  .readonly()
  .superRefine((policy, ctx) => {
    for (let i = 1; i < policy.attemptInstants.length; i += 1) {
      if (policy.attemptInstants[i]! <= policy.attemptInstants[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'attemptInstants must be strictly ascending (a backoff schedule never rewinds)',
          path: ['attemptInstants'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'RetryPolicy',
    title: 'RetryPolicy',
    description:
      'The typed retry policy: caller-supplied attempt instants (strictly ascending backoff schedule as DATA — no timers).',
  });

/** One retry policy. */
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/** The number of attempts one retry policy schedules. */
export function attemptCountOf(policy: RetryPolicy): number {
  return policy.attemptInstants.length;
}

// --------------------------------------------------------------------------------
// The per-attempt delivery receipt.
// --------------------------------------------------------------------------------

/** The zod field map of the delivery-receipt content (shared with the sealed record). */
const DELIVERY_RECEIPT_FIELDS = {
  schema: z.literal(DELIVERY_RECEIPT_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  receiptId: DeliveryReceiptIdSchema,
  tenantId: TenantIdSchema,
  requestId: OutboundRequestIdSchema,
  requestClass: z.enum(OUTBOUND_REQUEST_CLASSES),
  attemptNo: PositiveIntegerSchema,
  scheduledAt: BridgeTimestampSchema,
  outcome: z.enum(DELIVERY_ATTEMPT_OUTCOMES),
  providerAdapterId: AdapterIdSchema,
  providerDeliveryRef: z.string().min(1).max(256).optional(),
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  detail: z.string().min(1).max(2048).optional(),
} as const;

/** The immutable content of one delivery-attempt receipt. */
export const DeliveryReceiptContentSchema = z
  .strictObject({ ...DELIVERY_RECEIPT_FIELDS })
  .superRefine((receipt, ctx) => {
    if (receipt.outcome === 'success' && receipt.providerDeliveryRef === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a successful delivery attempt carries the provider delivery reference',
        path: ['providerDeliveryRef'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'DeliveryReceiptContent',
    title: 'DeliveryReceiptContent',
    description:
      'The immutable content of one delivery-attempt receipt: receipt id, tenant scope, the request it serves, the attempt number, the scheduled instant (the retry-policy data), the typed outcome, the delivering provider, the provider delivery reference on success, and the correlation/causation ids.',
  });

/** One delivery-receipt content. */
export type DeliveryReceiptContent = z.infer<typeof DeliveryReceiptContentSchema>;

/** The SEALED delivery receipt: content plus its canonical digest. */
export const SealedDeliveryReceiptSchema = z
  .strictObject({ ...DELIVERY_RECEIPT_FIELDS, contentDigest: Sha256HexSchema })
  .superRefine((receipt, ctx) => {
    if (receipt.outcome === 'success' && receipt.providerDeliveryRef === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a successful delivery attempt carries the provider delivery reference',
        path: ['providerDeliveryRef'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'SealedDeliveryReceipt',
    title: 'SealedDeliveryReceipt',
    description:
      'Published delivery receipt: immutable per-attempt outcome content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed delivery receipt. */
export type SealedDeliveryReceipt = z.infer<typeof SealedDeliveryReceiptSchema>;

/** Compute the content digest of a delivery receipt. */
export function computeDeliveryReceiptDigest(content: DeliveryReceiptContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid delivery-receipt content into its published record. */
export function sealDeliveryReceipt(content: unknown): BridgeResult<SealedDeliveryReceipt> {
  const parsed = DeliveryReceiptContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeDeliveryReceiptDigest(parsed.data) },
  };
}

/** Verify a sealed delivery receipt: schema + recomputed digest. */
export function verifySealedDeliveryReceipt(sealed: unknown): BridgeResult<SealedDeliveryReceipt> {
  const parsed = SealedDeliveryReceiptSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `delivery receipt "${parsed.data.receiptId}" failed digest verification (tampered or mismatched record)`,
        expected: recomputed,
        encountered: contentDigest,
        subject: parsed.data.receiptId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The provider-unavailability record (fallback semantics attached).
// --------------------------------------------------------------------------------

/** The zod field map of the provider-unavailability content (shared with the sealed record). */
const PROVIDER_UNAVAILABLE_FIELDS = {
  schema: z.literal(PROVIDER_UNAVAILABLE_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  tenantId: TenantIdSchema,
  requestId: OutboundRequestIdSchema,
  requestClass: z.enum(OUTBOUND_REQUEST_CLASSES),
  reason: z.enum(PROVIDER_UNAVAILABLE_REASONS),
  candidateAdapterIds: z.array(AdapterIdSchema).max(64).readonly(),
  preferredAdapterId: AdapterIdSchema.optional(),
  fallbackMode: z.enum(PROVIDER_FALLBACK_MODES).optional(),
  detectedAt: BridgeTimestampSchema,
} as const;

/** The immutable content of one provider-unavailability record. */
export const ProviderUnavailableContentSchema = z
  .strictObject({ ...PROVIDER_UNAVAILABLE_FIELDS })
  .superRefine((record, ctx) => {
    for (let i = 1; i < record.candidateAdapterIds.length; i += 1) {
      if (record.candidateAdapterIds[i]! <= record.candidateAdapterIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message:
            'candidateAdapterIds must be sorted ascending and duplicate-free (canonicalized resolution — order-independent)',
          path: ['candidateAdapterIds'],
        });
        break;
      }
    }
  })
  .readonly()
  .meta({
    id: 'ProviderUnavailableContent',
    title: 'ProviderUnavailableContent',
    description:
      'The immutable content of one provider-unavailability record: the request it concerns, the typed reason, the canonicalized candidate list the class resolution considered, the preferred provider if any, the fallback mode if a policy applied, and the caller-supplied detection instant. The request stays explicitly unresolved — no project truth is fabricated.',
  });

/** One provider-unavailability content. */
export type ProviderUnavailableContent = z.infer<typeof ProviderUnavailableContentSchema>;

/** The SEALED provider-unavailability record: content plus its digest. */
export const SealedProviderUnavailableSchema = z
  .strictObject({ ...PROVIDER_UNAVAILABLE_FIELDS, contentDigest: Sha256HexSchema })
  .superRefine((record, ctx) => {
    for (let i = 1; i < record.candidateAdapterIds.length; i += 1) {
      if (record.candidateAdapterIds[i]! <= record.candidateAdapterIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'candidateAdapterIds must be sorted ascending and duplicate-free',
          path: ['candidateAdapterIds'],
        });
        break;
      }
    }
  })
  .readonly()
  .meta({
    id: 'SealedProviderUnavailable',
    title: 'SealedProviderUnavailable',
    description:
      'Published provider-unavailability record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed provider-unavailability record. */
export type SealedProviderUnavailable = z.infer<typeof SealedProviderUnavailableSchema>;

/** Compute the content digest of a provider-unavailability record. */
export function computeProviderUnavailableDigest(content: ProviderUnavailableContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid provider-unavailability content into its published record. */
export function sealProviderUnavailable(content: unknown): BridgeResult<SealedProviderUnavailable> {
  const parsed = ProviderUnavailableContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeProviderUnavailableDigest(parsed.data) },
  };
}

/** Verify a sealed provider-unavailability record: schema + recomputed digest. */
export function verifySealedProviderUnavailable(
  sealed: unknown,
): BridgeResult<SealedProviderUnavailable> {
  const parsed = SealedProviderUnavailableSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `provider-unavailability record for request "${parsed.data.requestId}" failed digest verification`,
        expected: recomputed,
        encountered: contentDigest,
        subject: parsed.data.requestId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The fallback directive (typed DATA).
// --------------------------------------------------------------------------------

/**
 * The typed fallback directive (the spec's fallback modes): a
 * designated fallback provider, a manual queue work item, or the next
 * alternative provider of the same class.
 */
export const ProviderFallbackDirectiveSchema = z
  .discriminatedUnion('mode', [
    z
      .strictObject({
        mode: z.literal('fallback'),
        fallbackAdapterId: AdapterIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        mode: z.literal('manual-queue'),
      })
      .readonly(),
    z
      .strictObject({
        mode: z.literal('alternative-provider'),
        excludeAdapterIds: z.array(AdapterIdSchema).max(64).readonly(),
      })
      .readonly()
      .superRefine((directive, ctx) => {
        for (let i = 1; i < directive.excludeAdapterIds.length; i += 1) {
          if (directive.excludeAdapterIds[i]! <= directive.excludeAdapterIds[i - 1]!) {
            ctx.addIssue({
              code: 'custom',
              message: 'excludeAdapterIds must be sorted ascending and duplicate-free',
              path: ['excludeAdapterIds'],
            });
            break;
          }
        }
      }),
  ])
  .meta({
    id: 'ProviderFallbackDirective',
    title: 'ProviderFallbackDirective',
    description:
      'The typed fallback directive: a designated fallback provider, a manual-queue work item, or the next alternative provider of the same class (excluded ids carried as sorted data).',
  });

/** One provider fallback directive. */
export type ProviderFallbackDirective = z.infer<typeof ProviderFallbackDirectiveSchema>;

// --------------------------------------------------------------------------------
// The manual-queue record (an unresolved request stays explicit).
// --------------------------------------------------------------------------------

/** The zod field map of the manual-queue content (shared with the sealed record). */
const MANUAL_QUEUE_FIELDS = {
  schema: z.literal(MANUAL_QUEUE_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  recordId: ManualQueueIdSchema,
  tenantId: TenantIdSchema,
  requestId: OutboundRequestIdSchema,
  requestClass: z.enum(OUTBOUND_REQUEST_CLASSES),
  recipientRef: RecipientRefSchema,
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  requestDigest: Sha256HexSchema,
  reason: z.enum(['provider-unavailable', 'delivery-terminal']),
  unavailabilityDigest: Sha256HexSchema.optional(),
  resolution: z.literal('pending'),
  queuedAt: BridgeTimestampSchema,
  queuedBy: BridgePrincipalIdSchema,
} as const;

/** The immutable content of one manual-queue record. */
export const ManualQueueRecordContentSchema = z
  .strictObject({ ...MANUAL_QUEUE_FIELDS })
  .readonly()
  .meta({
    id: 'ManualQueueRecordContent',
    title: 'ManualQueueRecordContent',
    description:
      'The immutable content of one manual-queue record: the request that became a pending manual work item (explicitly unresolved), why, and the caller-supplied queueing provenance.',
  });

/** One manual-queue record content. */
export type ManualQueueRecordContent = z.infer<typeof ManualQueueRecordContentSchema>;

/** The SEALED manual-queue record: content plus its digest. */
export const SealedManualQueueRecordSchema = z
  .strictObject({ ...MANUAL_QUEUE_FIELDS, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedManualQueueRecord',
    title: 'SealedManualQueueRecord',
    description:
      'Published manual-queue record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed manual-queue record. */
export type SealedManualQueueRecord = z.infer<typeof SealedManualQueueRecordSchema>;

/** Compute the content digest of a manual-queue record. */
export function computeManualQueueRecordDigest(content: ManualQueueRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid manual-queue content into its published record. */
export function sealManualQueueRecord(content: unknown): BridgeResult<SealedManualQueueRecord> {
  const parsed = ManualQueueRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeManualQueueRecordDigest(parsed.data) },
  };
}

/** Verify a sealed manual-queue record: schema + recomputed digest. */
export function verifySealedManualQueueRecord(
  sealed: unknown,
): BridgeResult<SealedManualQueueRecord> {
  const parsed = SealedManualQueueRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `manual-queue record "${parsed.data.recordId}" failed digest verification`,
        expected: recomputed,
        encountered: contentDigest,
        subject: parsed.data.recordId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The intake receipt (inbound duplicate delivery = sealed prior receipt).
// --------------------------------------------------------------------------------

/** The zod field map of the intake-receipt content (shared with the sealed record). */
const INTAKE_RECEIPT_FIELDS = {
  schema: z.literal(INTAKE_RECEIPT_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  receiptId: IntakeReceiptIdSchema,
  tenantId: TenantIdSchema,
  eventId: ExternalEventIdSchema,
  eventDigest: Sha256HexSchema,
  idempotencyKey: IdempotencyKeySchema,
  disposition: z.enum(['admitted', 'duplicate-returned']),
  proposalDigest: Sha256HexSchema.optional(),
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  receivedAt: BridgeTimestampSchema,
} as const;

/** The immutable content of one intake receipt. */
export const IntakeReceiptContentSchema = z
  .strictObject({ ...INTAKE_RECEIPT_FIELDS })
  .readonly()
  .meta({
    id: 'IntakeReceiptContent',
    title: 'IntakeReceiptContent',
    description:
      'The immutable content of one intake receipt: the external event it receipts (id + exact digest), the idempotency key, the admission disposition (a duplicate delivery returns the sealed prior receipt), the intake-proposal digest when one was produced, and the caller-supplied receipt instant.',
  });

/** One intake-receipt content. */
export type IntakeReceiptContent = z.infer<typeof IntakeReceiptContentSchema>;

/** The SEALED intake receipt: content plus its canonical digest. */
export const SealedIntakeReceiptSchema = z
  .strictObject({ ...INTAKE_RECEIPT_FIELDS, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedIntakeReceipt',
    title: 'SealedIntakeReceipt',
    description:
      'Published intake receipt: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed intake receipt. */
export type SealedIntakeReceipt = z.infer<typeof SealedIntakeReceiptSchema>;

/** Compute the content digest of an intake receipt. */
export function computeIntakeReceiptDigest(content: IntakeReceiptContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid intake-receipt content into its published record. */
export function sealIntakeReceipt(content: unknown): BridgeResult<SealedIntakeReceipt> {
  const parsed = IntakeReceiptContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeIntakeReceiptDigest(parsed.data) },
  };
}

/** Verify a sealed intake receipt: schema + recomputed digest. */
export function verifySealedIntakeReceipt(sealed: unknown): BridgeResult<SealedIntakeReceipt> {
  const parsed = SealedIntakeReceiptSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `intake receipt "${parsed.data.receiptId}" failed digest verification`,
        expected: recomputed,
        encountered: contentDigest,
        subject: parsed.data.receiptId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Convenience re-export for the runtime host. */
export type { AdapterId };
