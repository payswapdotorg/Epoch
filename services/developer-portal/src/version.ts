/**
 * Service-level version constants and portal vocabularies (W025).
 *
 * The mirrored grammars (`PORTAL_EVENT_RECORD_VERSION`,
 * `PORTAL_STREAM_ID_PATTERN`) follow the W023/W024 kernel-mirror policy:
 * they are byte-identical constants from @epoch/event-log (W010), pinned
 * by the runtime parity test — never a runtime dependency.
 */

/** The service identity reported by health/describe surfaces. */
export const DEVELOPER_PORTAL_HOST_SERVICE_NAME = 'epoch.developer-portal-host' as const;

/** Version discriminator carried by host receipts and projections. */
export const HOST_RECORD_VERSION = 1 as const;

/** The contract version reported by the describe surface. */
export const DEVELOPER_PORTAL_CONTRACT_VERSION = '1.0.0' as const;

/**
 * The idempotency-key grammar (opaque, bounded — the W028/W024 host
 * pattern).
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * The portal event record version — MIRRORED from @epoch/event-log's
 * `EVENT_LOG_RECORD_VERSION` (portal lifecycle events are append-only
 * typed events over the W010 event shapes). The runtime parity test
 * asserts the constants are equal; a future W010 bump intentionally breaks
 * that parity and surfaces as a review gate.
 */
export const PORTAL_EVENT_RECORD_VERSION = 1 as const;

/**
 * Portal event-stream identity — MIRRORED from @epoch/event-log's
 * `EVENT_STREAM_ID_PATTERN` (W010 grammar): `stream:<slug>`.
 */
export const PORTAL_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The closed `portal:*` event discriminator vocabulary (the W010
 * open-namespace payload family owned by this service). One discriminator
 * per portal lifecycle fact; each has a TYPED data payload schema
 * (`PORTAL_EVENT_DATA_SCHEMAS` in src/events.ts).
 */
export const PORTAL_EVENT_DISCRIMINATORS = [
  'portal:listing-created',
  'portal:draft-updated',
  'portal:listing-submitted',
  'portal:version-published',
  'portal:listing-retired',
  'portal:grant-adopted',
  'portal:grant-revoked',
  'portal:revenue-adopted',
  'portal:billing-account-adopted',
] as const;

/** One portal event discriminator. */
export type PortalEventDiscriminator = (typeof PORTAL_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Deterministic stream-id derivation.
// --------------------------------------------------------------------------------

/** The slug suffix of a kind-prefixed id (the segment after `:`; empty if absent). */
function idSuffixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(separator + 1);
}

/**
 * Derive the portal event stream id of one listing (deterministic): one
 * listing's portal lifecycle facts form ONE stream.
 */
export function portalListingStreamIdOf(listingId: string): string {
  return `stream:portal-listing-${idSuffixOf(listingId)}`;
}

/**
 * Derive the developer event stream id of one developer tenant
 * (deterministic): the tenant-level portal facts (billing-account
 * adoption) form ONE stream.
 */
export function portalDeveloperStreamIdOf(tenantId: string): string {
  return `stream:portal-developer-${idSuffixOf(tenantId)}`;
}
