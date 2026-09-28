/**
 * The entitlements/billing lifecycle event vocabulary over the W010 event
 * shapes (the W024 dispatch pin: append-only events over the W010 shapes;
 * event-log stays a devDep — type-parity, never a runtime edge).
 *
 * - `EntitlementsEventContent` is a STRUCTURAL MIRROR of
 *   @epoch/event-log's `EventContent` (stream, 1-based sequence, tenant
 *   scope, principal actor, causal parent, namespaced payload,
 *   producer-supplied instant). One billing account's lifecycle events
 *   form ONE stream (`stream:billing-<suffix>`, derived deterministically
 *   by `billingStreamIdOf`); one entitlement's seat facts form ONE stream
 *   (`stream:entitlements-<suffix>`); events are FACTS — there is no
 *   mutation API.
 * - The payload family is the closed `entitlements:*`/`billing:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`ENTITLEMENTS_EVENT_DATA_SCHEMAS`); `parseEntitlementsEventData` is
 *   the W010 payload-family discipline applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures seal through
 *   the REAL W010 sealEvent and digest identically through the REAL
 *   computeEventDigest).
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  TimestampSchema,
  canonicalDigest,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BillingAccountIdSchema,
  BillingStreamIdSchema,
  EntitlementIdSchema,
  EntitlementsStreamIdSchema,
  InvoiceIdSchema,
  PrincipalIdSchema,
  SettlementIdSchema,
  SettlementPortIdSchema,
  Sha256HexSchema,
} from './primitives';
import {
  ENTITLEMENTS_EVENT_DISCRIMINATORS,
  ENTITLEMENTS_EVENT_RECORD_VERSION,
} from './version';
import type { EntitlementsEventDiscriminator } from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

// --------------------------------------------------------------------------------
// The W010 structural mirror.
// --------------------------------------------------------------------------------

/** One entitlements/billing event sequence number (1-based, contiguous per stream). */
export const EntitlementsEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'EntitlementsEventSequence',
    title: 'EntitlementsEventSequence',
    description: 'One entitlements/billing event sequence number: 1-based, contiguous per stream.',
  });

/** One entitlements/billing event sequence number. */
export type EntitlementsEventSequence = z.infer<typeof EntitlementsEventSequenceSchema>;

/** The stream of an entitlements/billing event (billing or entitlements family). */
const EventStreamFieldSchema = z.union([BillingStreamIdSchema, EntitlementsStreamIdSchema]);

/** The causal parent reference of an event (strictly earlier in-stream). */
export const EntitlementsCausalParentSchema = z
  .strictObject({
    streamId: EventStreamFieldSchema,
    sequence: EntitlementsEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'EntitlementsCausalParent',
    title: 'EntitlementsCausalParent',
    description: 'Causal parent of an entitlements/billing event: an earlier event in the same stream (the W010 shape).',
  });

/** One event causal parent reference. */
export type EntitlementsCausalParent = z.infer<typeof EntitlementsCausalParentSchema>;

/** The generic event payload of an entitlements/billing event (the W010 shape). */
export const EntitlementsEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'EntitlementsEventPayload',
    title: 'EntitlementsEventPayload',
    description:
      'Typed event payload of an entitlements/billing event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One entitlements/billing event payload. */
export type EntitlementsEventPayload = z.infer<typeof EntitlementsEventPayloadSchema>;

const EntitlementsEventObjectSchema = z
  .strictObject({
    schemaVersion: z.literal(ENTITLEMENTS_EVENT_RECORD_VERSION),
    streamId: EventStreamFieldSchema,
    sequence: EntitlementsEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: EntitlementsCausalParentSchema.nullable(),
    payload: EntitlementsEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .superRefine((event, ctx) => {
    if (
      event.causalParent !== null &&
      event.causalParent.streamId === event.streamId &&
      event.causalParent.sequence >= event.sequence
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a same-stream causal parent must be strictly earlier (broken chain)',
        path: ['causalParent'],
      });
    }
  });

/**
 * The immutable content of one entitlements/billing event — the
 * STRUCTURAL MIRROR of W010's `EventContent`.
 */
export const EntitlementsEventContentSchema = EntitlementsEventObjectSchema.readonly().meta({
  id: 'EntitlementsEventContent',
  title: 'EntitlementsEventContent',
  description:
    'Immutable content of one entitlements/billing lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
});

/** One entitlements/billing event content. */
export type EntitlementsEventContent = z.infer<typeof EntitlementsEventContentSchema>;

/** The SEALED entitlements/billing event record: content plus its SHA-256 digest. */
export const SealedEntitlementsEventSchema = z
  .strictObject({ ...EntitlementsEventObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedEntitlementsEvent',
    title: 'SealedEntitlementsEvent',
    description:
      'Published entitlements/billing event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed entitlements/billing event. */
export type SealedEntitlementsEvent = z.infer<typeof SealedEntitlementsEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every event kind.
// --------------------------------------------------------------------------------

/** Payload data of `entitlements:seat-assigned`. */
export const SeatAssignedDataSchema = z
  .strictObject({
    seatAssignmentId: z.string().regex(/^seat:[a-z0-9][a-z0-9-]{0,62}$/),
    seatAssignmentDigest: Sha256HexSchema,
    entitlementId: EntitlementIdSchema,
    principalId: PrincipalIdSchema,
    assignedAt: TimestampSchema,
  })
  .readonly();
export type SeatAssignedData = z.infer<typeof SeatAssignedDataSchema>;

/** Payload data of `entitlements:seat-released`. */
export const SeatReleasedDataSchema = z
  .strictObject({
    releaseId: z.string().regex(/^seat-release:[a-z0-9][a-z0-9-]{0,58}$/),
    releaseDigest: Sha256HexSchema,
    seatAssignmentId: z.string().regex(/^seat:[a-z0-9][a-z0-9-]{0,62}$/),
    entitlementId: EntitlementIdSchema,
    releasedAt: TimestampSchema,
  })
  .readonly();
export type SeatReleasedData = z.infer<typeof SeatReleasedDataSchema>;

/** Payload data of `billing:account-opened`. */
export const AccountOpenedDataSchema = z
  .strictObject({
    accountId: BillingAccountIdSchema,
    accountDigest: Sha256HexSchema,
    currency: z.string().regex(/^[A-Z]{3}$/),
    openedAt: TimestampSchema,
  })
  .readonly();
export type AccountOpenedData = z.infer<typeof AccountOpenedDataSchema>;

/** Payload data of `billing:invoice-drafted`. */
export const InvoiceDraftedDataSchema = z
  .strictObject({
    invoiceId: InvoiceIdSchema,
    invoiceDigest: Sha256HexSchema,
    accountId: BillingAccountIdSchema,
    lineCount: z.number().int().min(1),
    totalAmount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    draftedAt: TimestampSchema,
  })
  .readonly();
export type InvoiceDraftedData = z.infer<typeof InvoiceDraftedDataSchema>;

/** Payload data of `billing:invoice-issued`. */
export const InvoiceIssuedDataSchema = z
  .strictObject({
    invoiceId: InvoiceIdSchema,
    invoiceDigest: Sha256HexSchema,
    accountId: BillingAccountIdSchema,
    totalAmount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    issuedAt: TimestampSchema,
  })
  .readonly();
export type InvoiceIssuedData = z.infer<typeof InvoiceIssuedDataSchema>;

/** Payload data of `billing:invoice-settled`. */
export const InvoiceSettledDataSchema = z
  .strictObject({
    invoiceId: InvoiceIdSchema,
    invoiceDigest: Sha256HexSchema,
    accountId: BillingAccountIdSchema,
    settlementId: SettlementIdSchema,
    settlementPortId: SettlementPortIdSchema,
    totalAmount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    settledAt: TimestampSchema,
  })
  .readonly();
export type InvoiceSettledData = z.infer<typeof InvoiceSettledDataSchema>;

/** Payload data of `billing:invoice-voided`. */
export const InvoiceVoidedDataSchema = z
  .strictObject({
    invoiceId: InvoiceIdSchema,
    invoiceDigest: Sha256HexSchema,
    accountId: BillingAccountIdSchema,
    voidedAt: TimestampSchema,
  })
  .readonly();
export type InvoiceVoidedData = z.infer<typeof InvoiceVoidedDataSchema>;

/**
 * The typed payload-data schema for every `entitlements:*`/`billing:*`
 * event kind (the W010 payload-family discipline, applied to the whole
 * vocabulary).
 */
export const ENTITLEMENTS_EVENT_DATA_SCHEMAS: Readonly<
  Record<EntitlementsEventDiscriminator, z.ZodType>
> = {
  'entitlements:seat-assigned': SeatAssignedDataSchema,
  'entitlements:seat-released': SeatReleasedDataSchema,
  'billing:account-opened': AccountOpenedDataSchema,
  'billing:invoice-drafted': InvoiceDraftedDataSchema,
  'billing:invoice-issued': InvoiceIssuedDataSchema,
  'billing:invoice-settled': InvoiceSettledDataSchema,
  'billing:invoice-voided': InvoiceVoidedDataSchema,
};

/** Compute the content digest of one event (identical to W010's computeEventDigest). */
export function computeEntitlementsEventDigest(event: EntitlementsEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid entitlements/billing event content into its published record. Total. */
export function sealEntitlementsEvent(event: unknown): EntitlementsResult<SealedEntitlementsEvent> {
  const parsed = EntitlementsEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const content = parsed.data;
  const payloadSchema =
    ENTITLEMENTS_EVENT_DATA_SCHEMAS[content.payload.discriminator as EntitlementsEventDiscriminator];
  if (payloadSchema !== undefined) {
    const payload = payloadSchema.safeParse(content.payload.data);
    if (!payload.success) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the payload data does not satisfy the "${content.payload.discriminator}" payload contract`,
          issues: payload.error.issues.map((issue) => ({
            path: `payload.data.${issue.path.map(String).join('.')}`,
            message: issue.message,
          })),
        },
      };
    }
  }
  return {
    ok: true,
    value: { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) },
  };
}

/**
 * Verify a sealed entitlements/billing event: schema + payload-family
 * validation plus digest recomputation (tamper detection). Total.
 */
export function verifySealedEntitlementsEvent(
  sealed: unknown,
): EntitlementsResult<SealedEntitlementsEvent> {
  const parsed = SealedEntitlementsEventSchema.safeParse(sealed);
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
        message: 'sealed entitlements/billing event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: `${parsed.data.streamId}#${parsed.data.sequence}`,
      },
    };
  }
  return sealEntitlementsEvent(content);
}

/**
 * Parse (validate) the typed payload data of one event discriminator
 * (the W010 payload-family discipline).
 */
export function parseEntitlementsEventData(
  discriminator: string,
  data: unknown,
): EntitlementsResult<Record<string, JsonValue>> {
  const schema = ENTITLEMENTS_EVENT_DATA_SCHEMAS[discriminator as EntitlementsEventDiscriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `"${discriminator}" is not an entitlements:*/billing:* payload discriminator`,
        issues: [{ path: 'discriminator', message: 'unknown entitlements/billing event discriminator' }],
      },
    };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the payload data does not satisfy the "${discriminator}" payload contract`,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}

/** Whether one discriminator belongs to the closed vocabulary. */
export function isEntitlementsEventDiscriminator(value: string): value is EntitlementsEventDiscriminator {
  return (ENTITLEMENTS_EVENT_DISCRIMINATORS as readonly string[]).includes(value);
}
