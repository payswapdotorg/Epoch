/**
 * The bridge lifecycle event vocabulary over the W010 event shapes (the
 * W042 dispatch pin: "`bridge:*` events W010-shaped").
 *
 * - `BridgeEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (compile-time `Equals` pin in src/parity.ts; runtime
 *   seal/digest parity in test/parity.test.ts — the same event seals
 *   through the REAL W010 `sealEvent` and digests identically). One
 *   tenant's bridge lifecycle forms ONE stream (`stream:bridge-<slug>`,
 *   derived deterministically by `bridgeStreamIdOf`); events are FACTS
 *   — there is no mutation API.
 * - The payload family is the open-namespace `bridge:*` discriminator
 *   set with TYPED data payloads for every kind;
 *   `parseBridgeEventData` is the W010 payload-family discipline
 *   applied to the whole vocabulary.
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BridgePrincipalIdSchema,
  BridgeStreamIdSchema,
  Sha256HexSchema,
  BridgeTimestampSchema,
} from './primitives';
import {
  BRIDGE_EVENT_SCHEMA_NAME,
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
} from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';
import type { BridgeEventDiscriminator } from './version';

// --------------------------------------------------------------------------------
// The W010-shaped event record.
// --------------------------------------------------------------------------------

/** One bridge event sequence number (1-based, contiguous per stream). */
export const BridgeEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'BridgeEventSequence',
    title: 'BridgeEventSequence',
    description: 'One bridge event sequence number: 1-based, contiguous per bridge stream.',
  });

/** One bridge event sequence number. */
export type BridgeEventSequence = z.infer<typeof BridgeEventSequenceSchema>;

/** The causal parent reference of a bridge event (strictly earlier in-stream). */
export const BridgeCausalParentSchema = z
  .strictObject({
    streamId: BridgeStreamIdSchema,
    sequence: BridgeEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'BridgeCausalParent',
    title: 'BridgeCausalParent',
    description: 'Causal parent of a bridge event: an earlier event in the same stream (the W010 shape).',
  });

/** One bridge causal parent reference. */
export type BridgeCausalParent = z.infer<typeof BridgeCausalParentSchema>;

/** The generic event payload of a bridge event (the W010 shape). */
export const BridgeEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'BridgeEventPayload',
    title: 'BridgeEventPayload',
    description:
      'Typed event payload of a bridge event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One bridge event payload. */
export type BridgeEventPayload = z.infer<typeof BridgeEventPayloadSchema>;

/** The zod field map of the bridge-event content (shared with the sealed record). */
const BRIDGE_EVENT_FIELDS = {
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  streamId: BridgeStreamIdSchema,
  sequence: BridgeEventSequenceSchema,
  tenantId: TenantIdSchema,
  actor: BridgePrincipalIdSchema,
  causalParent: BridgeCausalParentSchema.nullable(),
  payload: BridgeEventPayloadSchema,
  occurredAt: BridgeTimestampSchema,
} as const;

/**
 * The immutable content of one bridge event — the STRUCTURAL MIRROR of
 * W010's `EventContent`.
 */
export const BridgeEventContentSchema = z
  .strictObject({ ...BRIDGE_EVENT_FIELDS })
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
  .readonly()
  .meta({
    id: 'BridgeEventContent',
    title: 'BridgeEventContent',
    description:
      'Immutable content of one bridge lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One bridge event content. */
export type BridgeEventContent = z.infer<typeof BridgeEventContentSchema>;

/** The SEALED bridge event record: content plus its canonical SHA-256 digest. */
export const SealedBridgeEventSchema = z
  .strictObject({ ...BRIDGE_EVENT_FIELDS, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedBridgeEvent',
    title: 'SealedBridgeEvent',
    description:
      'Published bridge event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed bridge event. */
export type SealedBridgeEvent = z.infer<typeof SealedBridgeEventSchema>;

/** Compute the content digest of a bridge event. */
export function computeBridgeEventDigest(content: BridgeEventContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid bridge-event content into its published record. */
export function sealBridgeEvent(content: unknown): BridgeResult<SealedBridgeEvent> {
  const parsed = BridgeEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const discriminatorCheck = parseBridgeEventData(
    parsed.data.payload.discriminator,
    parsed.data.payload.data,
  );
  if (!discriminatorCheck.ok) return discriminatorCheck;
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeBridgeEventDigest(parsed.data) },
  };
}

/** Verify a sealed bridge event: schema + payload family + recomputed digest. */
export function verifySealedBridgeEvent(sealed: unknown): BridgeResult<SealedBridgeEvent> {
  const parsed = SealedBridgeEventSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const discriminatorCheck = parseBridgeEventData(
    parsed.data.payload.discriminator,
    parsed.data.payload.data,
  );
  if (!discriminatorCheck.ok) return discriminatorCheck;
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `bridge event ${parsed.data.streamId}#${parsed.data.sequence} carries a tampered content digest`,
        expected: recomputed,
        encountered: parsed.data.contentDigest,
        subject: `${parsed.data.streamId}#${parsed.data.sequence}`,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The typed payload data of every bridge:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `bridge:provider-registered`. */
export const ProviderRegisteredDataSchema = z
  .strictObject({
    registrationId: z.string().min(1).max(256),
    adapterId: z.string().min(1).max(256),
    adapterDescriptorDigest: Sha256HexSchema,
    capabilityId: z.string().min(1).max(256),
    inboundClassCount: z.number().int().min(0),
    outboundClassCount: z.number().int().min(0),
  })
  .readonly();
export type ProviderRegisteredData = z.infer<typeof ProviderRegisteredDataSchema>;

/** Payload data of `bridge:event-received`. */
export const EventReceivedDataSchema = z
  .strictObject({
    eventId: z.string().min(1).max(256),
    eventClass: z.string().min(1).max(64),
    eventDigest: Sha256HexSchema,
    idempotencyKey: z.string().min(1).max(128),
    sourceAdapterId: z.string().min(1).max(256),
  })
  .readonly();
export type EventReceivedData = z.infer<typeof EventReceivedDataSchema>;

/** Payload data of `bridge:intake-proposed`. */
export const IntakeProposedDataSchema = z
  .strictObject({
    proposalId: z.string().min(1).max(256),
    sourceEventId: z.string().min(1).max(256),
    proposalDigest: Sha256HexSchema,
    correlationId: z.string().min(1).max(128),
  })
  .readonly();
export type IntakeProposedData = z.infer<typeof IntakeProposedDataSchema>;

/** Payload data of `bridge:request-dispatched`. */
export const RequestDispatchedDataSchema = z
  .strictObject({
    requestId: z.string().min(1).max(256),
    requestClass: z.string().min(1).max(64),
    recipientRef: z.string().min(1).max(256),
    providerAdapterId: z.string().min(1).max(256),
    projectionDigest: Sha256HexSchema,
    idempotencyKey: z.string().min(1).max(128),
    attemptCount: z.number().int().min(1),
  })
  .readonly();
export type RequestDispatchedData = z.infer<typeof RequestDispatchedDataSchema>;

/** Payload data of `bridge:receipt-recorded`. */
export const ReceiptRecordedDataSchema = z
  .strictObject({
    receiptId: z.string().min(1).max(256),
    requestId: z.string().min(1).max(256),
    attemptNo: z.number().int().min(1),
    outcome: z.enum(['success', 'retryable', 'terminal']),
    providerAdapterId: z.string().min(1).max(256),
    receiptDigest: Sha256HexSchema,
  })
  .readonly();
export type ReceiptRecordedData = z.infer<typeof ReceiptRecordedDataSchema>;

/** Payload data of `bridge:fallback-applied`. */
export const FallbackAppliedDataSchema = z
  .strictObject({
    requestId: z.string().min(1).max(256),
    requestClass: z.string().min(1).max(64),
    mode: z.enum(['fallback', 'manual-queue', 'alternative-provider']),
    fromAdapterId: z.string().min(1).max(256),
    toAdapterId: z.string().min(1).max(256),
  })
  .readonly();
export type FallbackAppliedData = z.infer<typeof FallbackAppliedDataSchema>;

/** Payload data of `bridge:manual-queued`. */
export const ManualQueuedDataSchema = z
  .strictObject({
    recordId: z.string().min(1).max(256),
    requestId: z.string().min(1).max(256),
    requestClass: z.string().min(1).max(64),
    recordDigest: Sha256HexSchema,
    reason: z.enum(['provider-unavailable', 'delivery-terminal']),
  })
  .readonly();
export type ManualQueuedData = z.infer<typeof ManualQueuedDataSchema>;

/** Payload data of `bridge:provider-unavailable`. */
export const ProviderUnavailableDataSchema = z
  .strictObject({
    requestId: z.string().min(1).max(256),
    requestClass: z.string().min(1).max(64),
    reason: z.string().min(1).max(64),
    candidateAdapterIds: z.array(z.string().min(1).max(256)).max(64),
    fallbackMode: z.string().min(1).max(64),
  })
  .readonly();
export type ProviderUnavailableData = z.infer<typeof ProviderUnavailableDataSchema>;

/** The typed data schema of each bridge:* discriminator. */
export const BRIDGE_EVENT_DATA_SCHEMAS: Readonly<
  Record<BridgeEventDiscriminator, z.ZodType>
> = {
  'bridge:provider-registered': ProviderRegisteredDataSchema,
  'bridge:event-received': EventReceivedDataSchema,
  'bridge:intake-proposed': IntakeProposedDataSchema,
  'bridge:request-dispatched': RequestDispatchedDataSchema,
  'bridge:receipt-recorded': ReceiptRecordedDataSchema,
  'bridge:fallback-applied': FallbackAppliedDataSchema,
  'bridge:manual-queued': ManualQueuedDataSchema,
  'bridge:provider-unavailable': ProviderUnavailableDataSchema,
};

/**
 * The W010 payload-family discipline applied to the bridge vocabulary:
 * the discriminator must be a known `bridge:*` kind and the data must
 * satisfy that kind's typed schema (reserved-namespace payloads are
 * always structurally validated — this package applies the same
 * discipline to its own open namespace).
 */
export function parseBridgeEventData(
  discriminator: string,
  data: Readonly<Record<string, JsonValue>>,
): BridgeResult<undefined> {
  if (!(discriminator in BRIDGE_EVENT_DATA_SCHEMAS)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `"${discriminator}" is not a bridge:* payload discriminator`,
        issues: [{ path: 'discriminator', message: `encountered "${discriminator}"` }],
      },
    };
  }
  const schema = BRIDGE_EVENT_DATA_SCHEMAS[discriminator as BridgeEventDiscriminator]!;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return { ok: true, value: undefined };
}

/** The schema discriminator of bridge events (the serialized record name). */
export const BRIDGE_EVENT_RECORD_SCHEMA_NAME = BRIDGE_EVENT_SCHEMA_NAME;
