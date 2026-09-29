/**
 * @epoch/client-runtime — the gateway transport contract.
 *
 * The typed client -> Application Gateway seam: the request envelope
 * (operation + session ref + correlation + tenant scope + idempotency key
 * + op-specific payload), the response outcome envelope, and the
 * `ApplicationGatewayPort` all three product clients bind to their
 * platform transport (W047/W048/W049). The service
 * (`@epoch/application-gateway`) implements this port structurally; a
 * parity test pins the vocabulary equality between this package and the
 * service registry.
 *
 * The payload stays an opaque validated JSON value: operation payload
 * SEMANTICS are validated by the owning authority kernel (the gateway
 * routes, it never re-validates semantic shape — no second authority).
 */
import { z } from 'zod';
import { JsonValueSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { ProjectIdSchema, TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import {
  APPLICATION_GATEWAY_CONTRACT_VERSION,
  APPLICATION_GATEWAY_OPERATION_NAMES,
  CLIENT_RUNTIME_RECORD_VERSION,
  isGatewayOperationName,
  isMutatingOperation,
  type ApplicationGatewayContractVersion,
  type GatewayOperationName,
} from './version';
import { gatewayError, type GatewayError, type GatewayResult } from './errors';
import { RequestCorrelationSchema, type RequestCorrelation } from './correlation';
import { SessionRefSchema, type SessionRef } from './session';
import { IdempotencyKeySchema } from './idempotency';

/** The tenant scope every request declares (must match the session scope). */
export interface TenantScope {
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

export const TenantScopeSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .meta({ id: 'TenantScope', title: 'TenantScope' });

export const GatewayOperationNameSchema = z
  .string()
  .refine(
    isGatewayOperationName,
    'must be a registered Application Gateway operation (the frozen v1 vocabulary)',
  )
  .meta({ id: 'GatewayOperationName', title: 'GatewayOperationName' });

/** The request envelope of every gateway call. */
export interface GatewayRequestEnvelope {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly contractVersion: ApplicationGatewayContractVersion;
  readonly operation: GatewayOperationName;
  readonly session: SessionRef;
  readonly correlation: RequestCorrelation;
  readonly tenant: TenantScope;
  /** REQUIRED on every mutating operation (enforced by requireIdempotencyKey). */
  readonly idempotencyKey?: string | undefined;
  /** Op-specific payload; semantic shape is validated by the owning authority. */
  readonly payload: JsonValue;
}

export const GatewayRequestEnvelopeSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    contractVersion: z.literal(APPLICATION_GATEWAY_CONTRACT_VERSION),
    operation: GatewayOperationNameSchema,
    session: SessionRefSchema,
    correlation: RequestCorrelationSchema,
    tenant: TenantScopeSchema,
    idempotencyKey: IdempotencyKeySchema.optional(),
    payload: JsonValueSchema,
  })
  .readonly()
  .meta({ id: 'GatewayRequestEnvelope', title: 'GatewayRequestEnvelope' });

/**
 * The success outcome envelope: the recorded result, its content digest,
 * the echoed correlation id, and the idempotency replay marker ('replayed'
 * when this call returned a previously recorded outcome).
 */
export interface GatewayOutcome {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly correlationId: string;
  readonly outcomeDigest: Sha256Hex;
  readonly result: JsonValue;
  readonly replayed: boolean;
}

export const GatewayOutcomeSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    correlationId: z.string().min(1).max(128),
    outcomeDigest: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .meta({ id: 'Sha256Hex', title: 'Sha256Hex' }),
    result: JsonValueSchema,
    replayed: z.boolean(),
  })
  .readonly()
  .meta({ id: 'GatewayOutcome', title: 'GatewayOutcome' });

/** The result type of one gateway call (typed errors, never thrown). */
export type GatewayCallResult = GatewayResult<GatewayOutcome>;

/** The reserved operation name for envelope-level failures. */
export const GATEWAY_OPERATION_PLACEHOLDER = 'gateway' as const;

/**
 * Total envelope validation. Malformed envelopes become typed
 * `validation/request-envelope-malformed` errors (never throw).
 */
export function parseGatewayRequestEnvelope(
  payload: unknown,
): GatewayResult<GatewayRequestEnvelope> {
  const parsed = GatewayRequestEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    error: gatewayError({
      class: 'validation',
      code: 'request-envelope-malformed',
      message: 'the gateway request envelope failed schema validation',
      operation: GATEWAY_OPERATION_PLACEHOLDER,
      correlationId: 'corr:unattributed',
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '/',
          code: issue.code,
          message: issue.message,
        })) as unknown as JsonValue[],
      },
    }),
  };
}

/**
 * The idempotency-key enforcement: every MUTATING operation must carry a
 * well-formed key. Returns null when satisfied, the typed error otherwise.
 */
export function requireIdempotencyKey(request: GatewayRequestEnvelope): GatewayError | null {
  if (!isMutatingOperation(request.operation)) return null;
  if (request.idempotencyKey === undefined) {
    return gatewayError({
      class: 'validation',
      code: 'idempotency-key-required',
      message: `mutating operation "${request.operation}" requires an idempotency key`,
      operation: request.operation,
      correlationId: request.correlation.correlationId,
    });
  }
  const keyCheck = IdempotencyKeySchema.safeParse(request.idempotencyKey);
  if (!keyCheck.success) {
    return gatewayError({
      class: 'validation',
      code: 'idempotency-key-required',
      message: 'the idempotency key is malformed (expected "idem:<slug>")',
      operation: request.operation,
      correlationId: request.correlation.correlationId,
    });
  }
  return null;
}

/**
 * The typed transport seam all three clients bind to their platform
 * (HTTP/IPC/in-process). Implementations MUST: validate the envelope,
 * enforce the idempotency-key rule for mutating operations, map every
 * failure into the typed error taxonomy, and echo the correlation id.
 */
export interface ApplicationGatewayPort {
  call(request: GatewayRequestEnvelope): Promise<GatewayCallResult>;
}

/** The frozen v1 operation-name list (for contract emission + parity tests). */
export const GATEWAY_OPERATION_VOCABULARY: readonly GatewayOperationName[] =
  APPLICATION_GATEWAY_OPERATION_NAMES;
