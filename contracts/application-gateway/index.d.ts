/**
 * epoch/application-gateway — self-contained TypeScript declarations of
 * the client-facing Application Gateway contract surface (W046, ACR-005).
 *
 * These declarations are the FROZEN contract shared by the three product
 * clients (web W047 / desktop W048 / mobile W049) and implemented by
 * `services/application-gateway`. They are hand-maintained and
 * parity-pinned: `parity.ts` (compiled by @epoch/client-runtime's
 * `tsconfig.contracts.json`) asserts strict type identity between these
 * declarations and the runtime implementation, so neither side can drift.
 *
 * Runtime validators (zod) + the JSON Schema projection live in
 * `@epoch/client-runtime`; the JSON Schema files are committed under
 * `schemas/` and pinned by the drift test with per-file SHA-256 digests
 * recorded in `manifest.json`.
 */

// ---------------------------------------------------------------------------
// Versions + vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published application-gateway contract surface. */
export type ApplicationGatewayContractVersion = '1.0.0';

/** Version discriminator on serialized client-runtime records (v1). */
export type ClientRuntimeRecordVersion = 1;

/** Version of the client-runtime machinery (queues, replay, projection cache). */
export type ClientRuntimeContractVersion = '1.0.0';

/** One client family (origin of a gateway call). */
export type GatewayOrigin = 'web' | 'desktop' | 'mobile' | 'server';

/** One gateway operation kind: reads never carry idempotency keys. */
export type GatewayOperationKind = 'read' | 'mutate';

/** The name of one Application Gateway operation (the frozen v1 vocabulary). */
export type GatewayOperationName =
  | 'session.issue'
  | 'session.validate'
  | 'session.revoke'
  | 'context.resolve'
  | 'world.snapshot'
  | 'world.entities'
  | 'evidence.intake'
  | 'evidence.get'
  | 'discovery.run'
  | 'action.submit'
  | 'action.approve'
  | 'action.execute'
  | 'action.status'
  | 'constraints.evaluate'
  | 'verification.validateChain'
  | 'solution.sealVersion'
  | 'solution.approveBaseline'
  | 'program.build'
  | 'program.schedule'
  | 'delivery.open'
  | 'delivery.observe'
  | 'delivery.close'
  | 'procurement.quote'
  | 'procurement.order'
  | 'actualization.forecast'
  | 'outcome.learn'
  | 'access.project'
  | 'supervision.check'
  | 'alerts.raise'
  | 'marketplace.entitlement'
  | 'events.read'
  | 'recovery.replay';

/** The frozen v1 operation vocabulary (list form). */
export type GatewayOperationVocabulary = readonly GatewayOperationName[];

/** One entry of the operation registry (a frozen capability declaration). */
export interface GatewayOperation {
  readonly name: GatewayOperationName;
  readonly kind: GatewayOperationKind;
  readonly queueable: boolean;
  readonly description: string;
}

/** One offline-admission rejection code (the five named negatives). */
export type OfflineAdmissionCode =
  | 'local-approval-not-authority'
  | 'local-semantic-mutation-rejected'
  | 'local-identity-minting-rejected'
  | 'local-digest-forgery-rejected'
  | 'idempotency-key-required';

/** Lifecycle states of a queued offline intent. */
export type OfflineIntentState = 'pending' | 'draining' | 'drained' | 'rejected';

// ---------------------------------------------------------------------------
// The recoverable client error taxonomy.
// ---------------------------------------------------------------------------

/** The six error classes of the taxonomy (closed vocabulary). */
export type GatewayErrorClass =
  | 'transient'
  | 'auth-session-expired'
  | 'conflict'
  | 'validation'
  | 'authority-rejected'
  | 'unrecoverable';

/** One fine-grained error code within its class. */
export type GatewayErrorCode =
  // transient
  | 'network-unavailable'
  | 'connector-unavailable'
  | 'gateway-overloaded'
  | 'deadline-exceeded'
  // auth-session-expired
  | 'session-expired'
  | 'session-revoked'
  | 'session-unknown'
  | 'principal-authentication-required'
  // conflict
  | 'idempotency-fingerprint-mismatch'
  | 'idempotency-key-reuse'
  | 'version-conflict'
  | 'duplicate-submission'
  // validation
  | 'request-validation'
  | 'request-envelope-malformed'
  | 'operation-unknown'
  | 'idempotency-key-required'
  | 'tenant-scope-mismatch'
  // authority-rejected
  | 'authority-denied'
  | 'authority-rejected-input'
  // unrecoverable
  | 'contract-version-unsupported'
  | 'internal-invariant-violated'
  | 'response-malformed';

/** One validation issue of a `request-validation` error. */
export interface GatewayValidationIssue {
  readonly path: string;
  readonly code?: string | undefined;
  readonly message: string;
}

/** A JSON value (mirrors the @epoch/agent-protocol canonical value space). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A JSON object of error details (class-specific payload). */
export type GatewayErrorDetails = Readonly<Record<string, JsonValue>>;

/** One typed gateway error (discriminated union member on `class`). */
export interface GatewayError {
  readonly schemaVersion: 1;
  readonly class: GatewayErrorClass;
  readonly code: GatewayErrorCode;
  readonly message: string;
  readonly operation: string;
  readonly correlationId: string;
  /** Derived from the class, stated explicitly for client switches. */
  readonly retryable: boolean;
  readonly details?: GatewayErrorDetails | undefined;
}

/** The recovery action a client should take for an error class. */
export type ClientRecoveryAction =
  | 'retry-with-backoff'
  | 'requeue-offline'
  | 're-authenticate'
  | 'surface-conflict'
  | 'surface-input'
  | 'surface-authority-rejection'
  | 'surface-failure';

// ---------------------------------------------------------------------------
// Correlation.
// ---------------------------------------------------------------------------

/** Correlation identifier (`corr:<slug>`). */
export type CorrelationId = string;

/** Causation identifier (an originating `corr:<slug>`). */
export type CausationId = string;

/** One request correlation: the trace identity of a single gateway call. */
export interface RequestCorrelation {
  readonly schemaVersion: 1;
  readonly correlationId: string;
  readonly causationId?: string | undefined;
  readonly origin: GatewayOrigin;
  readonly issuedAt: string;
}

// ---------------------------------------------------------------------------
// Session references.
// ---------------------------------------------------------------------------

/** Session lifecycle states (the session seam owns transitions). */
export type ClientSessionState = 'active' | 'expired' | 'revoked';

/** Session identifier (`session:<slug>`). */
export type SessionId = string;

/** The client session record (a projection of an authentication result). */
export interface ClientSession {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly state: ClientSessionState;
}

/** The minimal session reference carried by every gateway request. */
export interface SessionRef {
  readonly schemaVersion: 1;
  readonly sessionId: string;
}

// ---------------------------------------------------------------------------
// Idempotency (the typed IdempotentReplay).
// ---------------------------------------------------------------------------

/** Idempotency key (`idem:<slug>`). */
export type IdempotencyKey = string;

/** SHA-256 request fingerprint (lowercase hex, 64 chars). */
export type RequestFingerprint = string;

/** The address of an idempotent execution. */
export interface IdempotencyAddress {
  readonly operationKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

/** The durable record of one idempotent application. */
export interface IdempotencyRecord {
  readonly schemaVersion: 1;
  readonly operationKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: 'reserved' | 'applied';
  readonly outcomeDigest: string | null;
  readonly outcome: JsonValue | null;
  readonly recordedAt: string | null;
  readonly attempts: number;
}

/** The replay result contract: what a mutating gateway operation returns. */
export interface IdempotentReplay {
  readonly schemaVersion: 1;
  readonly operationKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: 'applied' | 'replayed';
  readonly outcome: JsonValue;
  readonly recordedAt: string;
  readonly attempts: number;
}

// ---------------------------------------------------------------------------
// Offline admission.
// ---------------------------------------------------------------------------

/** The session scope an offline queue is bound to (no scope minting). */
export interface OfflineQueueScope {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
}

/** One queued PENDING PROJECTION of a user intent. */
export interface QueuedIntent {
  readonly schemaVersion: 1;
  readonly queueId: string;
  readonly sessionId: string;
  readonly correlation: RequestCorrelation;
  readonly idempotencyKey: string;
  readonly operation: GatewayOperationName;
  readonly payload: JsonValue;
  readonly enqueuedAt: string;
  readonly state: OfflineIntentState;
  readonly attempts: number;
  readonly lastAttemptAt?: string | undefined;
  readonly lastErrorCode?: string | undefined;
}

// ---------------------------------------------------------------------------
// Transport contract.
// ---------------------------------------------------------------------------

/** The tenant scope every request declares (must match the session scope). */
export interface TenantScope {
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The request envelope of every gateway call. */
export interface GatewayRequestEnvelope {
  readonly schemaVersion: 1;
  readonly contractVersion: ApplicationGatewayContractVersion;
  readonly operation: GatewayOperationName;
  readonly session: SessionRef;
  readonly correlation: RequestCorrelation;
  readonly tenant: TenantScope;
  readonly idempotencyKey?: string | undefined;
  readonly payload: JsonValue;
}

/** The success outcome envelope of a gateway call. */
export interface GatewayOutcome {
  readonly schemaVersion: 1;
  readonly correlationId: string;
  readonly outcomeDigest: string;
  readonly result: JsonValue;
  readonly replayed: boolean;
}

// ---------------------------------------------------------------------------
// Projection cache.
// ---------------------------------------------------------------------------

/** One cached server projection (immutable, digest-addressed). */
export interface ProjectionCacheEntry {
  readonly schemaVersion: 1;
  readonly digest: string;
  readonly revision: number;
  readonly fetchedAt: string;
  readonly content: JsonValue;
}
