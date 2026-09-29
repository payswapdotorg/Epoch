/**
 * The Developer Portal lifecycle event vocabulary over the W010 event
 * shapes (the W025 dispatch pin: append-only events over the W010 shapes;
 * event-log stays a devDep — type-parity, never a runtime edge).
 *
 * - `PortalEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied instant).
 *   One listing's portal lifecycle facts form ONE stream
 *   (`stream:portal-listing-<suffix>`, derived deterministically by
 *   `portalListingStreamIdOf`); the developer tenant's tenant-level facts
 *   form ONE stream (`stream:portal-developer-<tenantSuffix>`). Events
 *   are FACTS — there is no mutation API.
 * - The payload family is the closed `portal:*` discriminator set with
 *   TYPED data payloads for every kind (`PORTAL_EVENT_DATA_SCHEMAS`);
 *   `parsePortalEventData` is the W010 payload-family discipline applied
 *   to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `contracts/parity.ts` (type equality with W010 `EventContent`),
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
import {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
  hasUnrecognizedKeys,
  validationError,
  vendorFieldsError,
} from '@epoch/marketplace';
import type { MarketplaceResult } from '@epoch/marketplace';
import {
  PORTAL_EVENT_DISCRIMINATORS,
  PORTAL_EVENT_RECORD_VERSION,
  PORTAL_STREAM_ID_PATTERN,
} from './version';
import type { PortalEventDiscriminator } from './version';

// --------------------------------------------------------------------------------
// The W010 structural mirror.
// --------------------------------------------------------------------------------

/** One portal event sequence number (1-based, contiguous per stream). */
export const PortalEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'PortalEventSequence',
    title: 'PortalEventSequence',
    description: 'One Developer Portal event sequence number: 1-based, contiguous per stream.',
  });

/** One portal event sequence number. */
export type PortalEventSequence = z.infer<typeof PortalEventSequenceSchema>;

/** The stream of a portal event (a portal listing or developer stream). */
const EventStreamFieldSchema = z.string().regex(PORTAL_STREAM_ID_PATTERN, {
  message: 'must be a stream id of the form "stream:<slug>" (the W010 grammar)',
});

/** The causal parent reference of an event (strictly earlier in-stream). */
export const PortalCausalParentSchema = z
  .strictObject({
    streamId: EventStreamFieldSchema,
    sequence: PortalEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'PortalCausalParent',
    title: 'PortalCausalParent',
    description:
      'Causal parent of a Developer Portal event: an earlier event in the same stream (the W010 shape).',
  });

/** One event causal parent reference. */
export type PortalCausalParent = z.infer<typeof PortalCausalParentSchema>;

/** The generic event payload of a portal event (the W010 shape). */
export const PortalEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'PortalEventPayload',
    title: 'PortalEventPayload',
    description:
      'Typed event payload of a Developer Portal event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One portal event payload. */
export type PortalEventPayload = z.infer<typeof PortalEventPayloadSchema>;

const PortalEventObjectSchema = z
  .strictObject({
    schemaVersion: z.literal(PORTAL_EVENT_RECORD_VERSION),
    streamId: EventStreamFieldSchema,
    sequence: PortalEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: PortalCausalParentSchema.nullable(),
    payload: PortalEventPayloadSchema,
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
 * The immutable content of one Developer Portal event — the STRUCTURAL
 * MIRROR of W010's `EventContent`.
 */
export const PortalEventContentSchema = PortalEventObjectSchema.readonly().meta({
  id: 'PortalEventContent',
  title: 'PortalEventContent',
  description:
    'Immutable content of one Developer Portal lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
});

/** One portal event content. */
export type PortalEventContent = z.infer<typeof PortalEventContentSchema>;

/**
 * The SEALED portal event record: content plus its SHA-256 digest over
 * the canonical JSON of the content (the exact-revision content
 * address).
 */
export const SealedPortalEventSchema = z
  .strictObject({ ...PortalEventObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedPortalEvent',
    title: 'SealedPortalEvent',
    description:
      'Published Developer Portal event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed portal event. */
export type SealedPortalEvent = z.infer<typeof SealedPortalEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every event kind.
// --------------------------------------------------------------------------------

/** Payload data of `portal:listing-created`. */
export const ListingCreatedDataSchema = z
  .strictObject({
    listingId: ListingIdSchema,
    draftDigest: Sha256HexSchema,
    displayName: z.string().min(1).max(128),
  })
  .readonly();
export type ListingCreatedData = z.infer<typeof ListingCreatedDataSchema>;

/** Payload data of `portal:draft-updated`. */
export const DraftUpdatedDataSchema = z
  .strictObject({
    listingId: ListingIdSchema,
    draftDigest: Sha256HexSchema,
  })
  .readonly();
export type DraftUpdatedData = z.infer<typeof DraftUpdatedDataSchema>;

/** Payload data of `portal:listing-submitted`. */
export const ListingSubmittedDataSchema = z
  .strictObject({
    listingId: ListingIdSchema,
  })
  .readonly();
export type ListingSubmittedData = z.infer<typeof ListingSubmittedDataSchema>;

/** Payload data of `portal:version-published`. */
export const VersionPublishedDataSchema = z
  .strictObject({
    listingId: ListingIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    contentDigest: Sha256HexSchema,
    previousVersionDigest: Sha256HexSchema.nullable(),
    chainLength: z.number().int().min(1),
  })
  .readonly();
export type VersionPublishedData = z.infer<typeof VersionPublishedDataSchema>;

/** Payload data of `portal:listing-retired`. */
export const ListingRetiredDataSchema = z
  .strictObject({
    listingId: ListingIdSchema,
  })
  .readonly();
export type ListingRetiredData = z.infer<typeof ListingRetiredDataSchema>;

/** Payload data of `portal:grant-adopted`. */
export const GrantAdoptedDataSchema = z
  .strictObject({
    entitlementId: EntitlementIdSchema,
    listingId: ListingIdSchema,
    acquiringTenantId: TenantIdSchema,
  })
  .readonly();
export type GrantAdoptedData = z.infer<typeof GrantAdoptedDataSchema>;

/** Payload data of `portal:grant-revoked`. */
export const GrantRevokedDataSchema = z
  .strictObject({
    entitlementId: EntitlementIdSchema,
    listingId: ListingIdSchema,
  })
  .readonly();
export type GrantRevokedData = z.infer<typeof GrantRevokedDataSchema>;

/** Payload data of `portal:revenue-adopted`. */
export const RevenueAdoptedDataSchema = z
  .strictObject({
    revenueId: z.string().regex(/^revenue:[a-z0-9][a-z0-9-]{0,62}$/),
    listingId: ListingIdSchema,
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly();
export type RevenueAdoptedData = z.infer<typeof RevenueAdoptedDataSchema>;

/** Payload data of `portal:billing-account-adopted`. */
export const BillingAccountAdoptedDataSchema = z
  .strictObject({
    accountId: z.string().regex(/^billing-account:[a-z0-9][a-z0-9-]{0,54}$/),
    accountDigest: Sha256HexSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly();
export type BillingAccountAdoptedData = z.infer<typeof BillingAccountAdoptedDataSchema>;

/**
 * The typed payload-data schema for every `portal:*` event kind (the W010
 * payload-family discipline, applied to the whole vocabulary).
 */
export const PORTAL_EVENT_DATA_SCHEMAS: Readonly<Record<PortalEventDiscriminator, z.ZodType>> = {
  'portal:listing-created': ListingCreatedDataSchema,
  'portal:draft-updated': DraftUpdatedDataSchema,
  'portal:listing-submitted': ListingSubmittedDataSchema,
  'portal:version-published': VersionPublishedDataSchema,
  'portal:listing-retired': ListingRetiredDataSchema,
  'portal:grant-adopted': GrantAdoptedDataSchema,
  'portal:grant-revoked': GrantRevokedDataSchema,
  'portal:revenue-adopted': RevenueAdoptedDataSchema,
  'portal:billing-account-adopted': BillingAccountAdoptedDataSchema,
};

/** Whether a discriminator belongs to the closed `portal:*` vocabulary. */
export function isPortalEventDiscriminator(value: string): value is PortalEventDiscriminator {
  return (PORTAL_EVENT_DISCRIMINATORS as readonly string[]).includes(value);
}

/**
 * Parse one portal event payload against its typed data schema: an
 * unknown discriminator or malformed data is a typed `validation`
 * rejection (never a guess).
 */
export function parsePortalEventData(payload: unknown): MarketplaceResult<PortalEventPayload> {
  const parsed = PortalEventPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  if (!isPortalEventDiscriminator(parsed.data.discriminator)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `"${parsed.data.discriminator}" is not a portal event discriminator (closed vocabulary)`,
        issues: [{ path: 'payload.discriminator', message: 'unknown portal event discriminator' }],
      },
    };
  }
  const data = PORTAL_EVENT_DATA_SCHEMAS[parsed.data.discriminator].safeParse(parsed.data.data);
  if (!data.success) {
    if (hasUnrecognizedKeys(data.error)) {
      return { ok: false, error: vendorFieldsError(data.error) };
    }
    return { ok: false, error: validationError(data.error) };
  }
  return { ok: true, value: { ...parsed.data, data: data.data as Readonly<Record<string, JsonValue>> } };
}

// --------------------------------------------------------------------------------
// Sealing (content addressing + tamper detection).
// --------------------------------------------------------------------------------

/** Compute the canonical content digest of a portal event. */
export function computePortalEventDigest(content: PortalEventContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Seal valid portal event content into its published record (content +
 * recomputed digest). Total: invalid content — including payloads outside
 * the typed `portal:*` family — yields the typed error (strict-object
 * rejections classify as `vendor-fields-rejected`).
 */
export function sealPortalEvent(event: unknown): MarketplaceResult<SealedPortalEvent> {
  const payload = PortalEventPayloadSchema.safeParse(
    (event as { payload?: unknown } | null | undefined)?.payload,
  );
  if (payload.success) {
    const data = parsePortalEventData(payload.data);
    if (!data.ok) {
      return data;
    }
  }
  const parsed = PortalEventObjectSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const typedPayload = parsePortalEventData(parsed.data.payload);
  if (!typedPayload.ok) {
    return typedPayload;
  }
  const content: PortalEventContent = { ...parsed.data, payload: typedPayload.value };
  return { ok: true, value: { ...content, contentDigest: computePortalEventDigest(content) } };
}

/**
 * Verify a sealed portal event: schema validation + digest recomputation.
 * A claimed digest that does not match the recomputed canonical SHA-256 of
 * the content is the typed `digest-mismatch` (tamper detection).
 */
export function verifySealedPortalEvent(sealed: unknown): MarketplaceResult<SealedPortalEvent> {
  const parsed = SealedPortalEventSchema.safeParse(sealed);
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
          'sealed portal event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
