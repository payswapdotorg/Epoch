/**
 * Adapter SDK contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors @epoch/verification): serialized adapter
 * documents (descriptors, request/response envelopes) carry a
 * `schemaVersion` discriminator admitted only at the exact current
 * version; skew surfaces as a `validation` issue at path
 * ["schemaVersion"]. {@link ADAPTER_SDK_CONTRACT_VERSION} versions the
 * published contract surface (`schemas/` + the typed index export).
 */

/** Version of the published adapter-sdk contract surface (schemas/ + types). */
export const ADAPTER_SDK_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter descriptor. */
export const ADAPTER_DESCRIPTOR_VERSION = 1 as const;

/** Version discriminator carried by every serialized invocation envelope. */
export const ADAPTER_ENVELOPE_VERSION = 1 as const;

/**
 * Machine-readable execution-failure codes for `action`-category adapters
 * (W007 vocabulary — the W003 action protocol owns proposals and
 * authorization decisions; adapters EXECUTE authorized interventions
 * against external targets, and report neutral failure codes).
 */
export const ACTION_FAILURE_CODES = [
  'precondition-not-met',
  'target-unavailable',
  'execution-rejected',
  'internal-error',
] as const;

/** Neutral failure code reported by a failed action execution. */
export type ActionFailureCode = (typeof ACTION_FAILURE_CODES)[number];
