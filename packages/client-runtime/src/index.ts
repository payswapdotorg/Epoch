/**
 * @epoch/client-runtime — public API (experience layer, Work Order W046).
 *
 * The shared client runtime for all three product clients (web W047 /
 * desktop W048 / mobile W049, ACR-005):
 *
 * - the frozen Application Gateway operation vocabulary + the typed
 *   request/response envelopes (`version.ts`, `transport.ts`);
 * - the recoverable client error taxonomy with typed discriminators
 *   mapping to client recovery actions (`errors.ts`);
 * - request correlation propagated through gateway -> kernel calls
 *   (`correlation.ts`);
 * - the typed IdempotentReplay: apply / replay / dedupe with recorded
 *   outcomes — replays never double-apply (`idempotency.ts`);
 * - offline admission: PENDING PROJECTIONS of user intent only, with the
 *   five named admission negatives, drained through the Action Gateway
 *   replay port with idempotency keys (`offline.ts`);
 * - client session references + pure lifecycle predicates (`session.ts`)
 *   — session state authority is @epoch/authentication's;
 * - the read-only, digest-addressed projection cache (`projection.ts`);
 * - the deterministic emission of `contracts/application-gateway/`
 *   (manifest + per-contract digests) (`surface.ts`, `contract-emission.ts`).
 *
 * Deterministic: zero wall-clock, zero randomness — instants are
 * caller-supplied. NO client transport implementation, NO UI, NO network,
 * NO semantic authority (the gateway composes authorities; it never
 * becomes one).
 */

// Versions + vocabularies + the frozen operation registry.
export {
  APPLICATION_GATEWAY_CONTRACT_VERSION,
  APPLICATION_GATEWAY_OPERATION_NAMES,
  APPLICATION_GATEWAY_OPERATIONS,
  CAUSATION_ID_PATTERN,
  CLIENT_RUNTIME_CONTRACT_VERSION,
  CLIENT_RUNTIME_RECORD_VERSION,
  CLIENT_TIMESTAMP_PATTERN,
  CORRELATION_ID_PATTERN,
  GATEWAY_ORIGINS,
  GATEWAY_OPERATION_KINDS,
  IDEMPOTENCY_KEY_PATTERN,
  OFFLINE_ADMISSION_CODES,
  OFFLINE_INTENT_STATES,
  OPERATION_BY_NAME,
  QUEUEABLE_OPERATIONS,
  QUEUE_ID_PATTERN,
  SESSION_ID_PATTERN,
  SHA256_HEX_PATTERN,
  isGatewayOperationName,
  isMutatingOperation,
  isQueueableOperation,
} from './version';
export type {
  ApplicationGatewayContractVersion,
  CausationId,
  ClientRuntimeContractVersion,
  ClientRuntimeRecordVersion,
  ClientTimestamp,
  CorrelationId,
  GatewayOperation,
  GatewayOperationVocabulary,
  GatewayOperationKind,
  GatewayOperationName,
  GatewayOrigin,
  IdempotencyKey,
  OfflineAdmissionCode,
  OfflineIntentState,
  QueueId,
  SessionId,
  Sha256Hex,
} from './version';

// Error taxonomy.
export {
  AUTHORITY_REJECTED_CODES,
  AUTH_SESSION_ERROR_CODES,
  CLIENT_RECOVERY_ACTIONS,
  CONFLICT_ERROR_CODES,
  GATEWAY_ERROR_CLASSES,
  GatewayErrorCodeSchema,
  GatewayErrorSchema,
  GatewayValidationIssueSchema,
  TRANSIENT_ERROR_CODES,
  UNRECOVERABLE_ERROR_CODES,
  VALIDATION_ERROR_CODES,
  clientRecoveryAction,
  fail,
  gatewayError,
  ok,
  parseGatewayError,
  requestValidationError,
  serializeGatewayError,
  zodIssuesToGatewayIssues,
} from './errors';
export type {
  ClientRecoveryAction,
  GatewayError,
  GatewayErrorClass,
  GatewayErrorDetails,
  GatewayErrorCode,
  GatewayResult,
  GatewayValidationIssue,
} from './errors';

// Correlation.
export {
  CausationIdSchema,
  CorrelationIdSchema,
  GatewayOriginSchema,
  RequestCorrelationSchema,
  parseRequestCorrelation,
} from './correlation';
export type { RequestCorrelation } from './correlation';

// Session references.
export {
  CLIENT_SESSION_STATES,
  ClientSessionSchema,
  ClientSessionStateSchema,
  SessionIdSchema,
  SessionRefSchema,
  isSessionUsable,
} from './session';
export type { ClientSession, ClientSessionState, SessionRef } from './session';

// Idempotent replay.
export {
  IdempotencyAddressSchema,
  IdempotencyKeySchema,
  IdempotentReplaySchema,
  IdempotencyRecordSchema,
  InMemoryIdempotencyStore,
  RequestFingerprintSchema,
  applyIdempotent,
  computeRequestFingerprint,
} from './idempotency';
export type {
  IdempotencyAddress,
  IdempotencyRecord,
  IdempotentReplay,
  IdempotencyReservation,
  IdempotencyStore,
  RequestFingerprint,
} from './idempotency';

// Offline admission.
export {
  FORGED_IDENTITY_FIELDS,
  FORGED_OUTCOME_FIELDS,
  FORGED_VERIFICATION_FIELDS,
  OFFLINE_QUEUEABLE_OPERATIONS,
  OfflineQueueScopeSchema,
  OfflineProjectionQueue,
  QUEUEABLE_OPERATION_TABLE,
  QueuedIntentSchema,
  offlineAdmissionToGatewayError,
} from './offline';
export type {
  DrainOutcome,
  OfflineAdmission,
  OfflineAdmissionRejection,
  OfflineIntentInput,
  OfflineQueueScope,
  OfflineReplayPort,
  QueuedIntent,
} from './offline';

// Transport contract.
export {
  GATEWAY_OPERATION_PLACEHOLDER,
  GATEWAY_OPERATION_VOCABULARY,
  GatewayOperationNameSchema,
  GatewayOutcomeSchema,
  GatewayRequestEnvelopeSchema,
  TenantScopeSchema,
  parseGatewayRequestEnvelope,
  requireIdempotencyKey,
} from './transport';
export type {
  ApplicationGatewayPort,
  GatewayCallResult,
  GatewayOutcome,
  GatewayRequestEnvelope,
  TenantScope,
} from './transport';

// Projection cache.
export { ProjectionCache, ProjectionCacheEntrySchema } from './projection';
export type { ProjectionCacheEntry } from './projection';

// Published schema surface + contract emission.
export { APPLICATION_GATEWAY_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  APPLICATION_GATEWAY_CONTRACT_DIR,
  renderApplicationGatewayContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Shared primitives re-exported for one-stop typed consumption (parity-pinned
// against contracts/application-gateway/index.d.ts).
export type { JsonValue } from '@epoch/agent-protocol';

// Compile-time contract parity (type-only).
export type { ClientRuntimeLiteralSync, ClientRuntimeSchemaSync } from './parity';
