/**
 * @epoch/desktop — the typed IPC/envelope bridge (W048).
 *
 * THE ONLY PATH from desktop product code to an Epoch authority: every
 * semantic call is a frozen `GatewayRequestEnvelope` (operation + session
 * ref + correlation + tenant scope + idempotency key + payload) sent
 * through a `GatewayTransport`, and every answer is the typed
 * `GatewayOutcome` / `GatewayError` taxonomy. The bridge:
 *
 *  - refuses operations outside the frozen 32-name vocabulary (named
 *    negative (a): there is no syntax for reaching a kernel directly);
 *  - auto-mints well-formed idempotency keys for mutating operations and
 *    honors caller-supplied keys (J07 offline replay: the SAME key
 *    returns the RECORDED outcome);
 *  - generates deterministic correlation ids (J11 causation chains:
 *    retries carry `causationId` pointing at the original attempt);
 *  - supports the offline network state: when offline, queueable
 *    operations are routed to the offline queue seam and reads fail with
 *    the typed transient error (the client-runtime recovery mapping).
 */
import {
  APPLICATION_GATEWAY_CONTRACT_VERSION,
  gatewayError,
  isGatewayOperationName,
  isMutatingOperation,
  isQueueableOperation,
  type ClientTimestamp,
  type GatewayOperationName,
  type GatewayOutcome,
  type GatewayRequestEnvelope,
  type GatewayResult,
  type IdempotencyKey,
  type JsonValue,
  type SessionRef,
  type TenantScope,
} from '@epoch/client-runtime';
import { IPC_GATEWAY_OPERATIONS, isIpcGatewayOperation } from './surface';
import type { GatewayTransport } from './transport';

/** The bridge construction options. */
export interface DesktopIpcBridgeOptions {
  readonly transport: GatewayTransport;
  /** Timestamps for correlations (caller-supplied: frozen in tests/journeys, wall clock in the app). */
  readonly clock: () => ClientTimestamp;
  /** Deterministic correlation-id stem (default 'desktop'). */
  readonly correlationStem?: string;
  /** Extra gating applied per call (e.g. the offline state). */
  readonly networkGate?: ((request: BridgeCallRequest) => BridgeNetworkDecision) | undefined;
}

/** One bridge call request (the typed product-side surface). */
export interface BridgeCallRequest {
  readonly operation: string;
  readonly payload: JsonValue;
  readonly idempotencyKey?: IdempotencyKey | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
}

/** The network decision for one call while the product is offline. */
export type BridgeNetworkDecision =
  | { readonly effect: 'online' }
  | { readonly effect: 'queue-offline' }
  | { readonly effect: 'fail-transient' };

/** The typed outcome of an offline-routed call. */
export interface OfflineRouted {
  readonly routed: 'offline-queue';
  readonly queueId: string;
}

/** The result of one bridge call: the gateway result or the offline routing. */
export type BridgeCallOutcome = GatewayResult<GatewayOutcome> | { readonly ok: true; readonly offline: OfflineRouted };

/** The bridge call options (queue seam + session refs are bound via setSession). */
export interface BridgeContext {
  readonly session: SessionRef | null;
  readonly tenant: TenantScope | null;
  readonly queueSink?: ((request: GatewayRequestEnvelope) => Promise<{ readonly queueId: string }>) | undefined;
}

/**
 * The typed IPC/envelope bridge. `setContext` binds the session scope
 * (from the platform-safe session store); `call` is the semantic surface.
 */
export class DesktopIpcBridge {
  private readonly transport: GatewayTransport;
  private readonly clock: () => ClientTimestamp;
  private readonly correlationStem: string;
  private readonly networkGate: ((request: BridgeCallRequest) => BridgeNetworkDecision) | undefined;
  private context: BridgeContext = { session: null, tenant: null };
  private correlationCounter = 0;
  private idempotencyCounter = 0;

  constructor(options: DesktopIpcBridgeOptions) {
    this.transport = options.transport;
    this.clock = options.clock;
    this.correlationStem = options.correlationStem ?? 'desktop';
    this.networkGate = options.networkGate;
  }

  /** The transport binding kind (embedded vs tauri-remote). */
  get transportKind(): string {
    return this.transport.kind;
  }

  /** Bind (or clear) the session + tenant scope every envelope carries. */
  setContext(context: BridgeContext): void {
    this.context = context;
  }

  /** The currently bound context (read-only view for the UI). */
  get currentContext(): BridgeContext {
    return this.context;
  }

  /**
   * Call one gateway operation. Operations outside the frozen vocabulary
   * are REFUSED LOCALLY (typed validation error, never sent) — the strict
   * subset rule. Mutating operations get an idempotency key (caller's or
   * auto-minted). Offline routing follows the network gate decision.
   */
  async call(request: BridgeCallRequest): Promise<BridgeCallOutcome> {
    if (!isGatewayOperationName(request.operation) || !isIpcGatewayOperation(request.operation)) {
      return {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'operation-unknown',
          message: `"${request.operation}" is not on the desktop IPC surface (the frozen Application Gateway vocabulary)`,
          operation: 'gateway',
          correlationId: request.correlationId ?? 'corr:unattributed',
          details: { issues: [{ path: 'operation', message: 'not a registered gateway operation' }] },
        }),
      };
    }
    const operation = request.operation as GatewayOperationName;
    const correlationId = request.correlationId ?? this.nextCorrelationId();
    const idempotencyKey =
      isMutatingOperation(operation) && request.idempotencyKey === undefined
        ? this.nextIdempotencyKey(operation)
        : request.idempotencyKey;

    // The offline network gate decides BEFORE any transport interaction.
    if (this.networkGate !== undefined) {
      const decision = this.networkGate(request);
      if (decision.effect === 'queue-offline') {
        if (!isQueueableOperation(operation)) {
          return {
            ok: false,
            error: gatewayError({
              class: 'transient',
              code: 'network-unavailable',
              message: `"${operation}" cannot run while offline and is not queueable; retry when online`,
              operation,
              correlationId,
              details: { retryAfterMs: 2000 },
            }),
          };
        }
        const envelope = this.buildEnvelope(operation, request.payload, correlationId, idempotencyKey, request.causationId);
        if (envelope === null) return { ok: false, error: noSessionError(operation, correlationId) };
        if (this.context.queueSink === undefined) {
          return {
            ok: false,
            error: gatewayError({
              class: 'validation',
              code: 'request-validation',
              message: 'the offline queue seam is not bound',
              operation,
              correlationId,
            }),
          };
        }
        const queued = await this.context.queueSink(envelope);
        return { ok: true, offline: { routed: 'offline-queue', queueId: queued.queueId } };
      }
      if (decision.effect === 'fail-transient') {
        return {
          ok: false,
          error: gatewayError({
            class: 'transient',
            code: 'network-unavailable',
            message: `"${operation}" failed: the product is offline`,
            operation,
            correlationId,
            details: { retryAfterMs: 2000 },
          }),
        };
      }
    }

    const envelope = this.buildEnvelope(operation, request.payload, correlationId, idempotencyKey, request.causationId);
    if (envelope === null) return { ok: false, error: noSessionError(operation, correlationId) };
    return this.transport.call(envelope);
  }

  /** Expose the underlying transport (drain + test seams only). */
  get transportBinding(): GatewayTransport {
    return this.transport;
  }

  private buildEnvelope(
    operation: GatewayOperationName,
    payload: JsonValue,
    correlationId: string,
    idempotencyKey: IdempotencyKey | undefined,
    causationId: string | undefined,
  ): GatewayRequestEnvelope | null {
    // The bootstrap exception (the gateway's own pipeline rule): only
    // session.issue may travel with an unbound session (the placeholder
    // reference); every other operation requires a bound session.
    if (operation === 'session.issue') {
      return {
        schemaVersion: 1,
        contractVersion: APPLICATION_GATEWAY_CONTRACT_VERSION,
        operation,
        session: this.context.session ?? { schemaVersion: 1, sessionId: 'session:bootstrap' },
        correlation: {
          schemaVersion: 1,
          correlationId,
          ...(causationId !== undefined ? { causationId } : {}),
          origin: 'desktop',
          issuedAt: this.clock(),
        },
        tenant: this.context.tenant ?? { tenantId: BOOTSTRAP_TENANT },
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
        payload,
      };
    }
    if (this.context.session === null || this.context.tenant === null) return null;
    return {
      schemaVersion: 1,
      contractVersion: APPLICATION_GATEWAY_CONTRACT_VERSION,
      operation,
      session: this.context.session,
      correlation: {
        schemaVersion: 1,
        correlationId,
        ...(causationId !== undefined ? { causationId } : {}),
        origin: 'desktop',
        issuedAt: this.clock(),
      },
      tenant: this.context.tenant,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      payload,
    };
  }

  private nextCorrelationId(): string {
    this.correlationCounter += 1;
    return `corr:${this.correlationStem}-${String(this.correlationCounter).padStart(4, '0')}`;
  }

  private nextIdempotencyKey(operation: GatewayOperationName): IdempotencyKey {
    this.idempotencyCounter += 1;
    return `idem:${this.correlationStem}-${operation.replace(/[^a-z0-9]+/g, '-')}-${String(this.idempotencyCounter).padStart(4, '0')}`;
  }
}

/** The placeholder tenant for the session.issue bootstrap (the gateway rejects scope mismatches server-side). */
const BOOTSTRAP_TENANT = 'tenant:bootstrap';

function noSessionError(operation: GatewayOperationName, correlationId: string) {
  return gatewayError({
    class: 'auth-session-expired',
    code: 'principal-authentication-required',
    message: 'no session is bound to the bridge (authenticate first)',
    operation,
    correlationId,
    details: { sessionId: 'session:unbound', reauthRequired: true },
  });
}

/** The frozen vocabulary list the bridge enforces (re-export for tests/UI). */
export const BRIDGE_OPERATION_SURFACE: readonly string[] = IPC_GATEWAY_OPERATIONS;
