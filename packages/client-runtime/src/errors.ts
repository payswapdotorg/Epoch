/**
 * @epoch/client-runtime — the recoverable client error taxonomy.
 *
 * Six typed error classes with typed discriminators so all three product
 * clients (web/desktop/mobile) can map any gateway failure to a UI state:
 * offline re-queue vs. re-authenticate vs. conflict surface vs. input
 * correction vs. authority feedback vs. hard failure (W046 Tech Lead pin:
 * "No client-local semantic errors" — every semantic rejection arrives as
 * `authority-rejected` carrying the authority's own typed error).
 *
 * Errors are VALUES (plain serializable JSON records), never thrown across
 * the client/gateway boundary; `GatewayError` is a discriminated union on
 * the `class` field. Every class round-trips losslessly through the
 * serialization boundary (`serializeGatewayError` / `parseGatewayError`).
 */
import { z } from 'zod';
import { JsonValue, JsonValueSchema } from '@epoch/agent-protocol';
import { CLIENT_RUNTIME_RECORD_VERSION } from './version';

/** The six error classes of the taxonomy (closed vocabulary). */
export const GATEWAY_ERROR_CLASSES = [
  'transient',
  'auth-session-expired',
  'conflict',
  'validation',
  'authority-rejected',
  'unrecoverable',
] as const;

/** One error class of the taxonomy. */
export type GatewayErrorClass = (typeof GATEWAY_ERROR_CLASSES)[number];

/** Transient failure codes (retryable: re-queue / retry with backoff). */
export const TRANSIENT_ERROR_CODES = [
  'network-unavailable',
  'connector-unavailable',
  'gateway-overloaded',
  'deadline-exceeded',
] as const;

/** Session failure codes (re-authentication required). */
export const AUTH_SESSION_ERROR_CODES = [
  'session-expired',
  'session-revoked',
  'session-unknown',
  'principal-authentication-required',
] as const;

/** Conflict failure codes (surface the conflict; never auto-retry). */
export const CONFLICT_ERROR_CODES = [
  'idempotency-fingerprint-mismatch',
  'idempotency-key-reuse',
  'version-conflict',
  'duplicate-submission',
] as const;

/** Validation failure codes (input correction required). */
export const VALIDATION_ERROR_CODES = [
  'request-validation',
  'request-envelope-malformed',
  'operation-unknown',
  'idempotency-key-required',
  'tenant-scope-mismatch',
] as const;

/**
 * Authority rejection: the composed Epoch authority (kernel/service) said
 * no. The authority's own typed error code + error record ride verbatim —
 * the gateway NEVER invents semantic errors of its own.
 */
export const AUTHORITY_REJECTED_CODES = ['authority-denied', 'authority-rejected-input'] as const;

/** Unrecoverable failure codes (hard failure; no retry, no requeue). */
export const UNRECOVERABLE_ERROR_CODES = [
  'contract-version-unsupported',
  'internal-invariant-violated',
  'response-malformed',
] as const;

/** One fine-grained error code within its class. */
export type GatewayErrorCode =
  | (typeof TRANSIENT_ERROR_CODES)[number]
  | (typeof AUTH_SESSION_ERROR_CODES)[number]
  | (typeof CONFLICT_ERROR_CODES)[number]
  | (typeof VALIDATION_ERROR_CODES)[number]
  | (typeof AUTHORITY_REJECTED_CODES)[number]
  | (typeof UNRECOVERABLE_ERROR_CODES)[number];

/** A JSON object of error details (class-specific payload). */
export type GatewayErrorDetails = Readonly<Record<string, JsonValue>>;

/**
 * One typed gateway error. Discriminated by `class`; `details` carries the
 * class-specific typed payload:
 *  - `transient`: `{ retryAfterMs?: number }`;
 *  - `auth-session-expired`: `{ sessionId, reauthRequired: true }`;
 *  - `conflict`: `{ idempotencyKey?, recordedFingerprint?, requestFingerprint? }`;
 *  - `validation`: `{ issues: readonly {path,code?,message}[] }`;
 *  - `authority-rejected`: `{ authority, authorityCode, authorityError }`;
 *  - `unrecoverable`: `{ hint? }`.
 */
export interface GatewayError {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly class: GatewayErrorClass;
  readonly code: GatewayErrorCode;
  readonly message: string;
  readonly operation: string;
  readonly correlationId: string;
  /** Derived from the class, stated explicitly for client switches. */
  readonly retryable: boolean;
  readonly details?: GatewayErrorDetails | undefined;
}

/**
 * The recovery action a client should take for an error class — the typed
 * discriminator that maps errors to UI states (offline queue vs. re-auth vs.
 * hard failure).
 */
export const CLIENT_RECOVERY_ACTIONS = [
  'retry-with-backoff',
  'requeue-offline',
  're-authenticate',
  'surface-conflict',
  'surface-input',
  'surface-authority-rejection',
  'surface-failure',
] as const;

/** One client recovery action. */
export type ClientRecoveryAction = (typeof CLIENT_RECOVERY_ACTIONS)[number];

/** Map an error to the recovery action every client should take. */
export function clientRecoveryAction(error: GatewayError): ClientRecoveryAction {
  switch (error.class) {
    case 'transient':
      return 'retry-with-backoff';
    case 'auth-session-expired':
      return 're-authenticate';
    case 'conflict':
      return 'surface-conflict';
    case 'validation':
      return 'surface-input';
    case 'authority-rejected':
      return 'surface-authority-rejection';
    case 'unrecoverable':
      return 'surface-failure';
  }
}

// ---------------------------------------------------------------------------
// Zod surface (runtime validation + the JSON Schema contract projection).
// ---------------------------------------------------------------------------

/** One validation issue of a `request-validation` error. */
export interface GatewayValidationIssue {
  readonly path: string;
  readonly code?: string | undefined;
  readonly message: string;
}

export const GatewayValidationIssueSchema = z
  .strictObject({
    path: z.string().min(1).max(256),
    code: z.string().min(1).max(64).optional(),
    message: z.string().min(1).max(512),
  })
  .readonly()
  .meta({ id: 'GatewayValidationIssue', title: 'GatewayValidationIssue' });

export const GatewayErrorClassSchema = z
  .enum(GATEWAY_ERROR_CLASSES)
  .meta({ id: 'GatewayErrorClass', title: 'GatewayErrorClass' });

export const GatewayErrorCodeSchema = z
  .union([
    z.enum(TRANSIENT_ERROR_CODES),
    z.enum(AUTH_SESSION_ERROR_CODES),
    z.enum(CONFLICT_ERROR_CODES),
    z.enum(VALIDATION_ERROR_CODES),
    z.enum(AUTHORITY_REJECTED_CODES),
    z.enum(UNRECOVERABLE_ERROR_CODES),
  ])
  .meta({ id: 'GatewayErrorCode', title: 'GatewayErrorCode' });

export const GatewayErrorDetailsSchema = z
  .record(z.string().min(1).max(64), JsonValueSchema)
  .readonly()
  .meta({ id: 'GatewayErrorDetails', title: 'GatewayErrorDetails' });

export const GatewayErrorSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    class: GatewayErrorClassSchema,
    code: GatewayErrorCodeSchema,
    message: z.string().min(1).max(1024),
    operation: z.string().min(1).max(128),
    correlationId: z.string().min(1).max(128),
    retryable: z.boolean(),
    details: GatewayErrorDetailsSchema.optional(),
  })
  .readonly()
  .meta({ id: 'GatewayError', title: 'GatewayError' });

/** The typed total result of a gateway call. */
export type GatewayResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GatewayError };

// ---------------------------------------------------------------------------
// Constructors (typed, total — never throw).
// ---------------------------------------------------------------------------

/** Build a typed success result. */
export function ok<T>(value: T): GatewayResult<T> {
  return { ok: true, value };
}

/** Build a typed failure result. */
export function fail<T>(error: GatewayError): GatewayResult<T> {
  return { ok: false, error };
}

const CORRELATION_PLACEHOLDER = 'corr:unattributed';

/** Build a typed gateway error value. */
export function gatewayError(input: {
  readonly class: GatewayErrorClass;
  readonly code: GatewayErrorCode;
  readonly message: string;
  readonly operation: string;
  readonly correlationId: string;
  readonly retryable?: boolean;
  readonly details?: GatewayErrorDetails | undefined;
}): GatewayError {
  const retryable =
    input.retryable ?? (input.class === 'transient' ? true : false);
  return {
    schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
    class: input.class,
    code: input.code,
    message: input.message,
    operation: input.operation,
    correlationId: input.correlationId || CORRELATION_PLACEHOLDER,
    retryable,
    details: input.details,
  };
}

/** A validation error from a zod failure (typed issue projection). */
export function zodIssuesToGatewayIssues(error: z.ZodError): readonly GatewayValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '/',
    code: issue.code,
    message: issue.message,
  }));
}

/** A request-validation error carrying typed issues. */
export function requestValidationError(
  operation: string,
  correlationId: string,
  message: string,
  issues: readonly GatewayValidationIssue[],
): GatewayError {
  return gatewayError({
    class: 'validation',
    code: 'request-validation',
    message,
    operation,
    correlationId,
    details: { issues: issues as unknown as JsonValue[] },
  });
}

// ---------------------------------------------------------------------------
// Serialization boundary (every class round-trips losslessly).
// ---------------------------------------------------------------------------

/** Serialize a typed error to a plain JSON value (the wire form). */
export function serializeGatewayError(error: GatewayError): JsonValue {
  return JSON.parse(JSON.stringify(error)) as JsonValue;
}

/**
 * Parse a serialized error back to the typed union. Total: a payload that
 * does not validate becomes a typed `response-malformed` unrecoverable
 * error (never throws, never silently coerces).
 */
export function parseGatewayError(payload: unknown): GatewayResult<GatewayError> {
  const parsed = GatewayErrorSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    error: gatewayError({
      class: 'unrecoverable',
      code: 'response-malformed',
      message: 'a serialized gateway error failed schema validation',
      operation: 'gateway',
      correlationId: CORRELATION_PLACEHOLDER,
      details: { issues: zodIssuesToGatewayIssues(parsed.error) as unknown as JsonValue[] },
    }),
  };
}

