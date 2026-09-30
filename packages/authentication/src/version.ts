/**
 * @epoch/authentication — versions, id grammars and closed vocabularies
 * (W046 / ACR-005).
 *
 * The session grammar mirrors the W046 client-runtime session grammar
 * (`packages/client-runtime/src/version.ts`) — kernel-to-kernel grammar
 * parity is pinned by tests, never by runtime coupling (the W045
 * pattern; @epoch/authentication is a kernel and cannot import the
 * experience layer).
 */

/** Version of the published authentication-seam contract surface. */
export const AUTHENTICATION_SEAM_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator on serialized session records (v1). */
export const AUTHENTICATION_SEAM_RECORD_VERSION = 1 as const;

/** Session identifier: `session:` + lowercase slug (mirrors the W046 client grammar). */
export const SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** UTC instant in the canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export const SESSION_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Session lifecycle states (active is the only issuing state). */
export const SESSION_LIFECYCLE_STATES = ['active', 'expired', 'revoked'] as const;

/** One session lifecycle state. */
export type SessionLifecycleState = (typeof SESSION_LIFECYCLE_STATES)[number];

/** Session identifier (`session:<slug>`). */
export type SessionId = string;

/** UTC instant in canonical form. */
export type SeamTimestamp = string;

/** Lowercase hex SHA-256 digest. */
export type SeamSha256Hex = string;

/**
 * Typed session-seam error codes (fail-closed; cross-tenant access is
 * rejected by construction — R12).
 */
export const SESSION_ERROR_CODES = [
  'validation',
  'digest-mismatch',
  'duplicate-session',
  'session-unknown',
  'session-expired',
  'session-revoked',
  'authentication-not-verified',
  'authentication-tenant-mismatch',
  'expiry-before-issue',
  'tenant-isolation-rejected',
] as const;

/** One typed session-seam error code. */
export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[number];

/** One typed session-seam issue (validation detail). */
export interface SessionIssue {
  readonly path: string;
  readonly message: string;
}

/** One typed session-seam error (a value, never thrown). */
export interface SessionError {
  readonly code: SessionErrorCode;
  readonly message: string;
  readonly issues?: readonly SessionIssue[] | undefined;
  readonly sessionId?: SessionId | undefined;
}

/** The total result type of every seam operation. */
export type SessionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SessionError };
