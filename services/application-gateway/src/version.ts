/**
 * @epoch/application-gateway — versions + the durable table registry.
 */

/** Version of the application-gateway service contract. */
export const APPLICATION_GATEWAY_SERVICE_VERSION = '1.0.0' as const;

/** Version discriminator on serialized gateway records (v1). */
export const GATEWAY_RECORD_VERSION = 1 as const;
