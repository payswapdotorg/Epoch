/**
 * Marketplace usage accounting: metered usage as APPEND-ONLY TYPED EVENTS
 * over the W010 event shapes (the dispatch pin: "usage-accounting records
 * (metered usage as append-only typed events over the W010 event shapes via
 * devDep parity)").
 *
 * - `UsageEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 * `EventContent` (stream, 1-based sequence, tenant scope, principal actor,
 * causal parent, namespaced payload, producer-supplied instant). One
 * entitlement's metered usage is ONE stream (`stream:usage-<suffix>`,
 * derived deterministically by `usageStreamIdOf`); events are FACTS — there
 * is no mutation API anywhere.
 * - The usage payload family is the open-namespace `marketplace:usage`
 * discriminator with typed data: entitlement id, listing id, exact
 * published version digest, metered units (canonical decimal string), unit
 * name, metering instant. Mirrors the W010 payload-family discipline
 * (generic event payload data + a typed family parser).
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time via
 *   `src/kernel-parity.ts` (type equality with `EventContent`), runtime via
 *   `test/parity.test.ts` (the same fixtures validate through the REAL W010
 *   validators; mirrored grammars are pattern-identical).
 * - `foldUsageEvents` is a deterministic projection: input order is
 *   irrelevant (events sort by (streamId, sequence)), totals use exact
 *   decimal-string arithmetic, and digests sort ascending.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
} from './primitives';
import {
  MARKETPLACE_RECORD_VERSION,
  USAGE_EVENT_DISCRIMINATOR,
  USAGE_EVENT_RECORD_VERSION,
  USAGE_STREAM_ID_PATTERN,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { MarketplaceResult } from './errors';

/**
 * The typed payload data of a `marketplace:usage` event: the metered-usage
 * fact of one entitlement against one exact published listing version.
 */
export const UsageEventDataSchema = z
  .strictObject({
    entitlementId: EntitlementIdSchema,
    listingId: ListingIdSchema,
    listingVersionDigest: Sha256HexSchema,
    units: NonNegativeDecimalSchema,
    unitName: z.string().min(1).max(64).optional(),
    meteredAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'UsageEventData',
    title: 'UsageEventData',
    description:
      'Payload data of a marketplace:usage event: entitlement id, listing id, exact published version digest, metered units (canonical decimal string), optional unit name, and the metering instant.',
  });

/** One usage-event payload data record. */
export type UsageEventData = z.infer<typeof UsageEventDataSchema>;

/** Opaque usage stream identity — MIRRORED from W010 EVENT_STREAM_ID_PATTERN. */
export const UsageStreamIdSchema = z
  .string()
  .regex(USAGE_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:<slug>"')
  .meta({
    id: 'UsageStreamId',
    title: 'UsageStreamId',
    description: 'Opaque usage-stream identity: "stream:" followed by a lowercase slug (the W010 stream grammar).',
  });

/** One usage stream id. */
export type UsageStreamId = z.infer<typeof UsageStreamIdSchema>;

/** One usage event sequence number (1-based, contiguous per stream). */
export const UsageEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'UsageEventSequence',
    title: 'UsageEventSequence',
    description: 'One usage-event sequence number: 1-based, contiguous per usage stream.',
  });

/** One usage event sequence number. */
export type UsageEventSequence = z.infer<typeof UsageEventSequenceSchema>;

/** The causal parent reference of a usage event (strictly earlier). */
export const UsageCausalParentSchema = z
  .strictObject({
    streamId: UsageStreamIdSchema,
    sequence: UsageEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'UsageCausalParent',
    title: 'UsageCausalParent',
    description: 'Causal parent of a usage event: an earlier event in the same usage stream (the W010 shape).',
  });

/** One usage causal parent reference. */
export type UsageCausalParent = z.infer<typeof UsageCausalParentSchema>;

/** The generic event payload of a usage event (the W010 shape). */
export const UsageEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'UsageEventPayload',
    title: 'UsageEventPayload',
    description: 'Typed event payload of a usage event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One usage event payload. */
export type UsageEventPayload = z.infer<typeof UsageEventPayloadSchema>;

/**
 * The immutable content of one usage event — the STRUCTURAL MIRROR of W010's
 * `EventContent` (schemaVersion discriminator, stream, sequence, tenant
 * scope, principal actor, causal parent, payload, producer-supplied
 * occurrence instant).
 */
export const UsageEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(USAGE_EVENT_RECORD_VERSION),
    streamId: UsageStreamIdSchema,
    sequence: UsageEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: UsageCausalParentSchema.nullable(),
    payload: UsageEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'UsageEventContent',
    title: 'UsageEventContent',
    description:
      'Immutable content of one metered-usage event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One usage event content. */
export type UsageEventContent = z.infer<typeof UsageEventContentSchema>;

/**
 * The SEALED usage event record: content plus its SHA-256 digest over the
 * canonical JSON of the content (the exact-revision content address).
 */
export const SealedUsageEventSchema = z
  .strictObject({
    schemaVersion: z.literal(USAGE_EVENT_RECORD_VERSION),
    streamId: UsageStreamIdSchema,
    sequence: UsageEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: UsageCausalParentSchema.nullable(),
    payload: UsageEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedUsageEvent',
    title: 'SealedUsageEvent',
    description:
      'Published usage event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed usage event. */
export type SealedUsageEvent = z.infer<typeof SealedUsageEventSchema>;

/** The deterministic usage account (fold projection over usage events). */
export const UsageAccountSchema = z
  .strictObject({
    schemaVersion: z.literal(MARKETPLACE_RECORD_VERSION),
    entitlementId: EntitlementIdSchema,
    tenantId: TenantIdSchema,
    listingId: ListingIdSchema,
    listingVersionDigest: Sha256HexSchema,
    streamId: UsageStreamIdSchema,
    eventCount: z.number().int().min(0),
    totalUnits: NonNegativeDecimalSchema,
    firstEventAt: TimestampSchema.optional(),
    lastEventAt: TimestampSchema.optional(),
    eventDigests: z.array(Sha256HexSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'UsageAccount',
    title: 'UsageAccount',
    description:
      'Deterministic usage account of one entitlement: metered-event count, exact decimal total units, first/last instants, and the sorted event content digests.',
  });

/** One usage account. */
export type UsageAccount = z.infer<typeof UsageAccountSchema>;

/**
 * Content-addressed identity of a usage event: the SHA-256 of its canonical
 * JSON serialization — identical to W010's computeEventDigest for the same
 * content (pinned by the runtime parity test). Throws on invalid content;
 * producers validate first (`sealUsageEvent` is the total form).
 */
export function computeUsageEventDigest(event: UsageEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/**
 * Seal valid usage-event content into its published record (content +
 * recomputed digest). Total; strict-object rejections classify as
 * `vendor-fields-rejected`, everything else as `validation`.
 */
export function sealUsageEvent(event: unknown): MarketplaceResult<SealedUsageEvent> {
  const parsed = UsageEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed usage event: schema validation + digest recomputation
 * (tamper detection — `digest-mismatch`).
 */
export function verifySealedUsageEvent(sealed: unknown): MarketplaceResult<SealedUsageEvent> {
  const parsed = SealedUsageEventSchema.safeParse(sealed);
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
        message: 'sealed usage event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of a `marketplace:usage` event (the W010
 * payload-family discipline): the discriminator must select the
 * `marketplace:usage` family and the data must satisfy the typed shape.
 */
export function parseUsageEventData(payload: UsageEventPayload): MarketplaceResult<UsageEventData> {
  if (payload.discriminator !== USAGE_EVENT_DISCRIMINATOR) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select the "${USAGE_EVENT_DISCRIMINATOR}" family`,
        issues: [
          {
            path: 'discriminator',
            message: `expected "${USAGE_EVENT_DISCRIMINATOR}", encountered "${payload.discriminator}"`,
          },
        ],
      },
    };
  }
  const parsed = UsageEventDataSchema.safeParse(payload.data);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Split a canonical non-negative decimal into (scaled value, fraction digits). */
function splitDecimal(value: string): [bigint, number] {
  const separator = value.indexOf('.');
  if (separator === -1) {
    return [BigInt(value), 0];
  }
  const fraction = value.slice(separator + 1);
  return [BigInt(value.slice(0, separator) + fraction), fraction.length];
}

/**
 * EXACT decimal-string addition (non-negative canonical decimals only):
 * bigint-scaled, trailing-zero-trimming, canonical output. Deterministic
 * and commutative — fold totals never depend on event order.
 */
export function addNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  const sum = aAligned + bAligned;
  if (scale === 0) {
    return sum.toString();
  }
  const text = sum.toString().padStart(scale + 1, '0');
  const integerPart = text.slice(0, -scale);
  let fractionPart = text.slice(-scale);
  fractionPart = fractionPart.replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}

/**
 * Fold sealed usage events into the deterministic usage account of one
 * entitlement. Input order is irrelevant: events are ordered by
 * (streamId, sequence) before folding; totals are exact decimal sums; the
 * event digests are sorted ascending. All events must be sealed-verified
 * usage events of the SAME entitlement and tenant (mixed input is a typed
 * `validation` rejection), and every payload must parse as the
 * `marketplace:usage` family.
 */
export function foldUsageEvents(
  events: readonly SealedUsageEvent[],
  filter: { entitlementId: string; tenantId: string },
): MarketplaceResult<UsageAccount> {
  if (events.length === 0) {
    return {
      ok: false,
      error: {
        code: 'unknown-entitlement',
        message: `no usage events recorded for entitlement "${filter.entitlementId}"`,
        entitlementId: filter.entitlementId,
      },
    };
  }
  const ordered = [...events].sort((a, b) => {
    if (a.streamId !== b.streamId) return a.streamId < b.streamId ? -1 : 1;
    return a.sequence - b.sequence;
  });
  let totalUnits = '0';
  let firstEventAt: string | undefined;
  let lastEventAt: string | undefined;
  let listingId: string | undefined;
  let listingVersionDigest: string | undefined;
  let streamId: string | undefined;
  const digests: Sha256Hex[] = [];
  for (const event of ordered) {
    const verified = verifySealedUsageEvent(event);
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }
    if (verified.value.tenantId !== filter.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `usage event ${verified.value.streamId}#${verified.value.sequence} belongs to tenant "${verified.value.tenantId}" but the fold is scoped to "${filter.tenantId}" (R12 multi-tenant isolation)`,
          expectedTenantId: filter.tenantId,
          encounteredTenantId: verified.value.tenantId,
        },
      };
    }
    const data = parseUsageEventData(verified.value.payload);
    if (!data.ok) {
      return { ok: false, error: data.error };
    }
    if (data.value.entitlementId !== filter.entitlementId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `usage event ${verified.value.streamId}#${verified.value.sequence} meters entitlement "${data.value.entitlementId}" but the fold is scoped to "${filter.entitlementId}"`,
          issues: [
            {
              path: 'payload.data.entitlementId',
              message: 'fold input mixes entitlements',
            },
          ],
        },
      };
    }
    if (listingId === undefined) {
      listingId = data.value.listingId;
      listingVersionDigest = data.value.listingVersionDigest;
      streamId = verified.value.streamId;
    } else if (
      data.value.listingId !== listingId ||
      data.value.listingVersionDigest !== listingVersionDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'fold input mixes listings or listing versions for one entitlement',
          issues: [
            {
              path: 'payload.data.listingId',
              message: 'fold input must describe one listing version per entitlement',
            },
          ],
        },
      };
    }
    totalUnits = addNonNegativeDecimals(totalUnits, data.value.units);
    const occurredAt = verified.value.occurredAt;
    if (firstEventAt === undefined || occurredAt < firstEventAt) {
      firstEventAt = occurredAt;
    }
    if (lastEventAt === undefined || occurredAt > lastEventAt) {
      lastEventAt = occurredAt;
    }
    digests.push(verified.value.contentDigest);
  }
  return {
    ok: true,
    value: {
      schemaVersion: MARKETPLACE_RECORD_VERSION,
      entitlementId: filter.entitlementId,
      tenantId: filter.tenantId,
      listingId: listingId!,
      listingVersionDigest: listingVersionDigest!,
      streamId: streamId!,
      eventCount: ordered.length,
      totalUnits,
      firstEventAt,
      lastEventAt,
      eventDigests: digests.sort(),
    },
  };
}
