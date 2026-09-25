/**
 * @epoch/document-adapter-host — contract versions and closed
 * vocabularies (service layer, W028).
 *
 * The host is the long-running IN-MEMORY reference behavior: no
 * persistence, no network, no real processes (later Work Orders add
 * those behind this seam). The typed derivation model — document
 * admission, the provisional lifecycle, the evidence chains, the W007
 * registration shapes, and the kernel error taxonomy — is owned by
 * @epoch/document-adapter (kernel) and consumed here at runtime; the
 * host adds ONLY the session/error vocabulary a long-running service
 * needs.
 */

/** Version of the published host contract surface (types + validators). */
export const DOCUMENT_ADAPTER_HOST_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized host document. */
export const HOST_RECORD_VERSION = 1 as const;

/** The fixed, neutral service name of this host. */
export const DOCUMENT_ADAPTER_SERVICE_NAME = 'document-adapter' as const;

/**
 * Opaque ingestion idempotency key (host-supplied typed data): stable
 * identifier of one ingestion intent. The same key with the same
 * document digest is an idempotent re-run; the same key with a
 * DIFFERENT digest is the typed rejection `idempotency-conflict`
 * (duplicate suppression).
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Opaque session identity: `sess:` + 64 lowercase hex (content-derived). */
export const SESSION_ID_PATTERN = /^sess:[0-9a-f]{64}$/;

/**
 * Liveness vocabulary (typed data): a host is `ready` when it accepts
 * ingestion and advances sessions. There is no degraded state to report
 * in the in-memory reference behavior — future adapters behind this
 * seam may extend the vocabulary.
 */
export const HOST_STATUSES = ['ready'] as const;

/** One liveness status. */
export type HostStatus = (typeof HOST_STATUSES)[number];

/**
 * The service-specific error codes (the kernel taxonomy passes through
 * unchanged; these name purely host-level failures).
 */
export const HOST_ERROR_CODES = [
  'unknown-session',
  'idempotency-conflict',
  'registration-conflict',
] as const;

/** One service-specific error code (see src/errors.ts). */
export type HostErrorCode = (typeof HOST_ERROR_CODES)[number];
