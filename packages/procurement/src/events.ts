/**
 * The procurement lifecycle event vocabulary over the W010 event shapes
 * (the W037 dispatch pin: "every step emits `procurement:*` events
 * (W010-shaped, one package = one stream `stream:procurement-<suffix>`,
 * digests admitted by the REAL sealEvent — runtime parity tests)").
 *
 * - `ProcurementEventContent` is a STRUCTURAL MIRROR of
 *   @epoch/event-log's `EventContent` (stream, 1-based sequence, tenant
 *   scope, principal actor, causal parent, namespaced payload,
 *   producer-supplied instant). One acquisition package's lifecycle
 *   events form ONE stream (`stream:procurement-<suffix>`, derived
 *   deterministically by `procurementStreamIdOf`); events are FACTS —
 *   there is no mutation API.
 * - The procurement payload family is the open-namespace
 *   `procurement:*` discriminator set with TYPED data payloads for
 *   every kind (`PROCUREMENT_EVENT_DATA_SCHEMAS`);
 *   `parseProcurementEventData` is the W010 payload-family discipline
 *   applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures seal through
 *   the REAL W010 sealEvent and digest identically through the REAL
 *   computeEventDigest).
 */
import { z } from 'zod';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { JsonValueSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  PrincipalIdSchema,
  ProcurementStreamIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  canonicalDigest,
} from './primitives';
import {
  PROCUREMENT_EVENT_DISCRIMINATORS,
  PROCUREMENT_EVENT_RECORD_VERSION,
  SUPPLIER_DELIVERY_STATES,
  type ProcurementEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';

/** One procurement event sequence number (1-based, contiguous per stream). */
export const ProcurementEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'ProcurementEventSequence',
    title: 'ProcurementEventSequence',
    description:
      'One procurement-event sequence number: 1-based, contiguous per procurement stream.',
  });

/** One procurement event sequence number. */
export type ProcurementEventSequence = z.infer<typeof ProcurementEventSequenceSchema>;

/** The causal parent reference of a procurement event (strictly earlier in-stream). */
export const ProcurementCausalParentSchema = z
  .strictObject({
    streamId: ProcurementStreamIdSchema,
    sequence: ProcurementEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'ProcurementCausalParent',
    title: 'ProcurementCausalParent',
    description:
      'Causal parent of a procurement event: an earlier event in the same procurement stream (the W010 shape).',
  });

/** One procurement causal parent reference. */
export type ProcurementCausalParent = z.infer<typeof ProcurementCausalParentSchema>;

/** The generic event payload of a procurement event (the W010 shape). */
export const ProcurementEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'ProcurementEventPayload',
    title: 'ProcurementEventPayload',
    description:
      'Typed event payload of a procurement event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One procurement event payload. */
export type ProcurementEventPayload = z.infer<typeof ProcurementEventPayloadSchema>;

/**
 * The immutable content of one procurement event — the STRUCTURAL
 * MIRROR of W010's `EventContent` (schemaVersion discriminator,
 * stream, sequence, tenant scope, principal actor, causal parent,
 * namespaced payload, producer-supplied occurrence instant).
 */
export const ProcurementEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(PROCUREMENT_EVENT_RECORD_VERSION),
    streamId: ProcurementStreamIdSchema,
    sequence: ProcurementEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ProcurementCausalParentSchema.nullable(),
    payload: ProcurementEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly()
  .superRefine((event, ctx) => {
    if (
      event.causalParent !== null &&
      event.causalParent.streamId === event.streamId &&
      event.causalParent.sequence >= event.sequence
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a same-stream causal parent must be strictly earlier',
        path: ['causalParent'],
      });
    }
  })
  .meta({
    id: 'ProcurementEventContent',
    title: 'ProcurementEventContent',
    description:
      'Immutable content of one procurement lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One procurement event content. */
export type ProcurementEventContent = z.infer<typeof ProcurementEventContentSchema>;

/**
 * The SEALED procurement event record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the exact-revision content
 * address).
 */
export const SealedProcurementEventSchema = z
  .strictObject({
    schemaVersion: z.literal(PROCUREMENT_EVENT_RECORD_VERSION),
    streamId: ProcurementStreamIdSchema,
    sequence: ProcurementEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: ProcurementCausalParentSchema.nullable(),
    payload: ProcurementEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedProcurementEvent',
    title: 'SealedProcurementEvent',
    description:
      'Published procurement event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed procurement event. */
export type SealedProcurementEvent = z.infer<typeof SealedProcurementEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every procurement:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `procurement:package-assembled`. */
export const PackageAssembledDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    acquisitionId: z.string().regex(/^acquisition:[a-z0-9][a-z0-9-]{0,62}$/),
    variant: z.string().min(1).max(64),
    assembledAt: TimestampSchema,
  })
  .readonly();
export type PackageAssembledData = z.infer<typeof PackageAssembledDataSchema>;

/** Payload data of `procurement:quote-received`. */
export const QuoteReceivedDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    quoteId: z.string().regex(/^quote:[a-z0-9][a-z0-9-]{0,62}$/),
    supplierId: z.string().regex(/^supplier:[a-z0-9][a-z0-9-]{0,62}$/),
    revision: z.number().int().min(1),
    submittedAt: TimestampSchema,
  })
  .readonly();
export type QuoteReceivedData = z.infer<typeof QuoteReceivedDataSchema>;

/** Payload data of `procurement:quote-selected`. */
export const QuoteSelectedDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    selectionId: z.string().regex(/^selection:[a-z0-9][a-z0-9-]{0,62}$/),
    selectedQuoteId: z.string().regex(/^quote:[a-z0-9][a-z0-9-]{0,62}$/),
    decidedAt: TimestampSchema,
  })
  .readonly();
export type QuoteSelectedData = z.infer<typeof QuoteSelectedDataSchema>;

/** Payload data of `procurement:commitment-linked`. */
export const CommitmentLinkedDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    commitmentRecordId: z.string().regex(/^commitment:[a-z0-9][a-z0-9-]{0,62}$/),
    committedAt: TimestampSchema,
  })
  .readonly();
export type CommitmentLinkedData = z.infer<typeof CommitmentLinkedDataSchema>;

/** Payload data of `procurement:po-issued` and `procurement:po-amended`. */
export const PoIssuedDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    poId: z.string().regex(/^po:[a-z0-9][a-z0-9-]{0,62}$/),
    poVersion: z.number().int().min(1),
    issuedAt: TimestampSchema,
  })
  .readonly();
export type PoIssuedData = z.infer<typeof PoIssuedDataSchema>;

/** Payload data of `procurement:delivery-transition-recorded`. */
export const DeliveryTransitionRecordedDataSchema = z
  .strictObject({
    poId: z.string().regex(/^po:[a-z0-9][a-z0-9-]{0,62}$/),
    from: z.enum(SUPPLIER_DELIVERY_STATES),
    to: z.enum(SUPPLIER_DELIVERY_STATES),
    occurredAt: TimestampSchema,
  })
  .readonly();
export type DeliveryTransitionRecordedData = z.infer<typeof DeliveryTransitionRecordedDataSchema>;

/** Payload data of `procurement:receipt-recorded`. */
export const ReceiptRecordedDataSchema = z
  .strictObject({
    poId: z.string().regex(/^po:[a-z0-9][a-z0-9-]{0,62}$/),
    transitionId: z.string().regex(/^po-transition:[a-z0-9][a-z0-9-]{0,62}$/),
    observationRecordId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    lineCount: z.number().int().min(0),
    occurredAt: TimestampSchema,
  })
  .readonly();
export type ReceiptRecordedData = z.infer<typeof ReceiptRecordedDataSchema>;

/** Payload data of `procurement:substitution-requested`. */
export const SubstitutionRequestedDataSchema = z
  .strictObject({
    poId: z.string().regex(/^po:[a-z0-9][a-z0-9-]{0,62}$/),
    substitutionId: z.string().regex(/^substitution:[a-z0-9][a-z0-9-]{0,62}$/),
    requestedAt: TimestampSchema,
  })
  .readonly();
export type SubstitutionRequestedData = z.infer<typeof SubstitutionRequestedDataSchema>;

/** Payload data of `procurement:substitution-decided`. */
export const SubstitutionDecidedDataSchema = z
  .strictObject({
    poId: z.string().regex(/^po:[a-z0-9][a-z0-9-]{0,62}$/),
    substitutionId: z.string().regex(/^substitution:[a-z0-9][a-z0-9-]{0,62}$/),
    decision: z.enum(['accepted', 'rejected']),
    decidedAt: TimestampSchema,
  })
  .readonly();
export type SubstitutionDecidedData = z.infer<typeof SubstitutionDecidedDataSchema>;

/** Payload data of `procurement:status-projected`. */
export const StatusProjectedDataSchema = z
  .strictObject({
    packageId: z.string().regex(/^package:[a-z0-9][a-z0-9-]{0,62}$/),
    state: z.string().min(1).max(64),
    asOf: TimestampSchema,
  })
  .readonly();
export type StatusProjectedData = z.infer<typeof StatusProjectedDataSchema>;

/**
 * The typed payload-data schema for every `procurement:*` event kind
 * (the W010 payload-family discipline, applied to the whole
 * procurement vocabulary).
 */
export const PROCUREMENT_EVENT_DATA_SCHEMAS: Readonly<
  Record<ProcurementEventDiscriminator, z.ZodType>
> = {
  'procurement:package-assembled': PackageAssembledDataSchema,
  'procurement:quote-received': QuoteReceivedDataSchema,
  'procurement:quote-selected': QuoteSelectedDataSchema,
  'procurement:commitment-linked': CommitmentLinkedDataSchema,
  'procurement:po-issued': PoIssuedDataSchema,
  'procurement:po-amended': PoIssuedDataSchema,
  'procurement:delivery-transition-recorded': DeliveryTransitionRecordedDataSchema,
  'procurement:receipt-recorded': ReceiptRecordedDataSchema,
  'procurement:substitution-requested': SubstitutionRequestedDataSchema,
  'procurement:substitution-decided': SubstitutionDecidedDataSchema,
  'procurement:status-projected': StatusProjectedDataSchema,
};

/** Compute the content digest of a procurement event (canonical JSON). */
export function computeProcurementEventDigest(event: ProcurementEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid procurement-event content into its published record. */
export function sealProcurementEvent(
  event: unknown,
): ProcurementResult<SealedProcurementEvent> {
  const parsed = ProcurementEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed procurement event (schema + digest recomputation). */
export function verifySealedProcurementEvent(
  sealed: unknown,
): ProcurementResult<SealedProcurementEvent> {
  const parsed = SealedProcurementEventSchema.safeParse(sealed);
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
        message:
          'sealed procurement event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of a `procurement:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the procurement vocabulary and the data must satisfy the typed shape.
 */
export function parseProcurementEventData(
  payload: ProcurementEventPayload,
): ProcurementResult<Record<string, JsonValue>> {
  const schema = (
    PROCUREMENT_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>
  )[payload.discriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the procurement:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${PROCUREMENT_EVENT_DISCRIMINATORS.join(', ')}`,
          },
        ],
      },
    };
  }
  const parsed = schema.safeParse(payload.data);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}
