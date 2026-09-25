/**
 * Service-level version constants and host vocabularies.
 */

/** The service identity reported by health/describe surfaces. */
export const MARKETPLACE_HOST_SERVICE_NAME = 'epoch.marketplace-host' as const;

/** Version discriminator carried by host receipts and projections. */
export const HOST_RECORD_VERSION = 1 as const;

/** The idempotency-key grammar (opaque, bounded — the W028 pattern). */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
