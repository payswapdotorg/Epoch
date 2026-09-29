/**
 * @epoch/authentication — public API (kernel layer, Work Order W046).
 *
 * The provider-neutral auth/session seam over the W009 kernels:
 * - session issuance projected from VERIFIED @epoch/identity
 *   authentication results (content-addressed session ids; zero
 *   randomness, zero wall-clock);
 * - the session lifecycle (active -> expired / revoked) with digest
 *   discipline (lifecycle transitions never rewrite the content
 *   address);
 * - deterministic snapshots + restore-from-durable-records (the service
 *   mirrors records through the persistence SPI);
 * - tenant-safe authorization propagation (request construction from a
 *   session scope; decisions stay @epoch/authorization's fail-closed
 *   evaluator — this seam NEVER decides, NEVER grants).
 *
 * NO IdP, NO network, NO secret storage: assertions are descriptors;
 * tokens are never modeled. Authentication is a RESULT
 * (@epoch/identity); a session is a projected acting context, never an
 * authorization (lock rule 12).
 */

// Versions + vocabularies.
export {
  AUTHENTICATION_SEAM_CONTRACT_VERSION,
  AUTHENTICATION_SEAM_RECORD_VERSION,
  SESSION_ERROR_CODES,
  SESSION_ID_PATTERN,
  SESSION_LIFECYCLE_STATES,
  SESSION_TIMESTAMP_PATTERN,
  SHA256_HEX_PATTERN,
} from './version';
export type {
  SeamSha256Hex,
  SeamTimestamp,
  SessionErrorCode,
  SessionId,
  SessionIssue,
  SessionError,
  SessionLifecycleState,
  SessionResult,
} from './version';

// Published types.
export type {
  SessionContent,
  SessionIssueInput,
  SessionRecord,
  SessionRegistration,
} from './types';

// Runtime validators.
export {
  SeamRecordVersionSchema,
  SeamSha256HexSchema,
  SessionContentSchema,
  SessionErrorCodeSchema,
  SessionIdSchema,
  SessionLifecycleStateSchema,
  SessionRecordSchema,
  SessionRegistrationSchema,
} from './schema';

// Digest discipline.
export {
  canonicalSessionJson,
  computeSessionDigest,
  deriveSessionId,
  sealSession,
  sessionRecordFor,
  verifySessionDigest,
  verifySessionRecord,
} from './digest';

// The reference session manager.
export {
  SessionManager,
  addMsToInstant,
  type SessionManagerOptions,
} from './manager';

// Authorization propagation (never decides).
export {
  authorizationRequestFor,
  evaluateAuthorization,
  sessionAuthorizationContext,
} from './authz';
