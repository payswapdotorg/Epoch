/**
 * Service-level version constants and host vocabularies.
 */

/** The service identity reported by health/describe surfaces. */
export const SECURITY_RUNTIME_SERVICE_NAME = 'epoch.security-runtime' as const;

/** Version discriminator carried by host receipts and projections. */
export const SECURITY_RUNTIME_RECORD_VERSION = 1 as const;

/** Version of the published service contract surface. */
export const SECURITY_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;
