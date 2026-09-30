/**
 * @epoch/mobile — the typed client bridge to the Application Gateway (W049).
 *
 * W049 Tech Lead pin 1: "The mobile app renders the W018 field surface and
 * talks to the same frozen 32-operation Application Gateway vocabulary
 * through a typed client bridge. No second semantic store."
 *
 * This module is that bridge:
 *
 *  - `MobileGatewayTransport` is the platform transport seam (an
 *    `ApplicationGatewayPort` from @epoch/client-runtime — `call(request)
 *    -> GatewayCallResult`). The product ships TWO bindings:
 *      * `bindInProcessGateway` — the typed in-process binding to the REAL
 *        `@epoch/application-gateway` facade (the W046 composition: the
 *        mobile host embeds the gateway exactly as the W046 tests do; the
 *        single-process composition is the delivered runtime, the HTTP
 *        deployment is the documented transport upgrade — see
 *        docs/product-runtime/limitations.md §5);
 *      * tests/detox inject the same port (with scripted offline behavior)
 *        — no mock of SEMANTICS is ever needed because the real gateway is
 *        embedded.
 *  - `GatewayClient` builds EVERY envelope from the frozen
 *    @epoch/client-runtime schemas: operation (one of the 32), session ref,
 *    correlation (deterministic monotonic `corr:mobile-<n>` — zero
 *    randomness), tenant scope, idempotency key (`idem:<slug>`, REQUIRED on
 *    mutating operations) and the op payload. It maps every failure through
 *    the typed error taxonomy + `clientRecoveryAction` (the W046 error
 *    model), so the UI switches on TYPED recovery actions, never on string
 *    matching.
 *
 * The bridge NEVER: validates payload semantics (the authority does),
 * caches semantic state (the projection cache is digest-addressed and
 * read-only), or produces outcomes locally (recovery actions only).
 */
import {
  APPLICATION_GATEWAY_CONTRACT_VERSION,
  clientRecoveryAction,
  isMutatingOperation,
  type ApplicationGatewayPort,
  type ClientRecoveryAction,
  type GatewayCallResult,
  type GatewayError,
  type GatewayOperationName,
  type GatewayOutcome,
  type GatewayRequestEnvelope,
  type RequestCorrelation,
  type TenantScope,
} from '@epoch/client-runtime';
import type { ApplicationGateway } from '@epoch/application-gateway';
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import { sha256Hex } from './sha256';

/** The platform transport seam (the client-runtime port contract). */
export type MobileGatewayTransport = ApplicationGatewayPort;

/**
 * Bind the REAL Application Gateway facade in-process (the W046 typed
 * library surface). The HTTP/WebSocket transport deployment replaces this
 * binding with the network client — everything above the seam is unchanged.
 */
export function bindInProcessGateway(gateway: ApplicationGateway): MobileGatewayTransport {
  return {
    async call(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
      return gateway.call(request);
    },
  };
}

/** The clock seam (caller-supplied instants; zero wall-clock in the product). */
export type MobileClock = () => Timestamp;

/** The deterministic monotonic correlation generator (`corr:mobile-<n>`). */
export class CorrelationSequence {
  private counter = 0;

  constructor(private readonly prefix: string = 'mobile') {
  }

  /** The next deterministic correlation id. */
  next(): string {
    this.counter += 1;
    return `corr:${this.prefix}-${this.counter}`;
  }

  /** The number of issued ids (test introspection). */
  get issued(): number {
    return this.counter;
  }
}

/** Options of {@link GatewayClient}. */
export interface GatewayClientOptions {
  readonly transport: MobileGatewayTransport;
  readonly clock: MobileClock;
  /** The session scope every call runs under (tenant isolation R12). */
  readonly tenant: TenantScope;
  /** The correlation sequence (deterministic; one per host). */
  readonly correlation?: CorrelationSequence | undefined;
  /** The gateway origin tag (always 'mobile' for this product). */
  readonly origin?: 'mobile' | undefined;
}

/** One typed gateway call outcome: the envelope result or the typed error + recovery action. */
export type MobileCallResult =
  | { readonly ok: true; readonly outcome: GatewayOutcome; readonly correlationId: string }
  | {
      readonly ok: false;
      readonly error: GatewayError;
      readonly correlationId: string;
      readonly recovery: ClientRecoveryAction;
    };

/**
 * The typed client bridge: EVERY mobile -> gateway call goes through here,
 * on the frozen 32-operation vocabulary, with the idempotency-key rule and
 * the typed error -> recovery-action mapping applied uniformly.
 */
export class GatewayClient {
  private readonly transport: MobileGatewayTransport;
  private readonly clock: MobileClock;
  private readonly tenant: TenantScope;
  private readonly correlation: CorrelationSequence;
  private readonly origin: 'mobile';

  constructor(options: GatewayClientOptions) {
    this.transport = options.transport;
    this.clock = options.clock;
    this.tenant = options.tenant;
    this.correlation = options.correlation ?? new CorrelationSequence();
    this.origin = options.origin ?? 'mobile';
  }

  /** The correlation sequence (shared with the offline drain for causation chains). */
  get correlations(): CorrelationSequence {
    return this.correlation;
  }

  /**
   * Derive the deterministic idempotency key from the intent identity: the
   * SHA-256 of (operation, the canonical payload) shortened to a slug — the
   * SAME intent always derives the SAME key (the client-side half of the
   * exactly-once replay contract; the server records the key).
   */
  idempotencyKeyFor(operation: GatewayOperationName, payload: JsonValue): string {
    const digest = sha256Hex(
      new TextEncoder().encode(`${operation}\n${stableJsonStringify(payload)}`),
    );
    return `idem:mobile-${digest.slice(0, 24)}`;
  }

  /** Build (but do not send) one request envelope. */
  buildRequest(input: {
    readonly operation: GatewayOperationName;
    readonly sessionId: string;
    readonly payload: JsonValue;
    readonly idempotencyKey?: string | undefined;
    readonly causationId?: string | undefined;
  }): GatewayRequestEnvelope {
    const correlation: RequestCorrelation = {
      schemaVersion: 1,
      correlationId: this.correlation.next(),
      ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
      origin: this.origin,
      issuedAt: this.clock(),
    };
    const mutating = isMutatingOperation(input.operation);
    const idempotencyKey =
      input.idempotencyKey !== undefined
        ? input.idempotencyKey
        : mutating
          ? this.idempotencyKeyFor(input.operation, input.payload)
          : undefined;
    return {
      schemaVersion: 1,
      contractVersion: APPLICATION_GATEWAY_CONTRACT_VERSION,
      operation: input.operation,
      session: { schemaVersion: 1, sessionId: input.sessionId },
      correlation,
      tenant: this.tenant,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      payload: input.payload,
    };
  }

  /** One typed gateway call. */
  async call(input: {
    readonly operation: GatewayOperationName;
    readonly sessionId: string;
    readonly payload: JsonValue;
    readonly idempotencyKey?: string | undefined;
    readonly causationId?: string | undefined;
  }): Promise<MobileCallResult> {
    const request = this.buildRequest(input);
    const correlationId = request.correlation.correlationId;
    const result = await this.transport.call(request);
    if (result.ok) {
      return { ok: true, outcome: result.value, correlationId };
    }
    return {
      ok: false,
      error: result.error,
      correlationId,
      recovery: clientRecoveryAction(result.error),
    };
  }

  /**
   * Call and unwrap the recorded result (typed errors ride as the
   * MobileCallResult — the caller switches on `recovery`).
   */
  async callForResult(input: {
    readonly operation: GatewayOperationName;
    readonly sessionId: string;
    readonly payload: JsonValue;
    readonly idempotencyKey?: string | undefined;
    readonly causationId?: string | undefined;
  }): Promise<{ readonly ok: true; readonly result: JsonValue; readonly outcomeDigest: Sha256Hex; readonly replayed: boolean; readonly correlationId: string } | { readonly ok: false; readonly error: GatewayError; readonly correlationId: string; readonly recovery: ClientRecoveryAction }> {
    const called = await this.call(input);
    if (!called.ok) return called;
    return {
      ok: true,
      result: called.outcome.result,
      outcomeDigest: called.outcome.outcomeDigest,
      replayed: called.outcome.replayed,
      correlationId: called.correlationId,
    };
  }
}

/** Stable canonical JSON stringification (sorted keys, no whitespace — the digest input form). */
export function stableJsonStringify(value: JsonValue): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item as JsonValue)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, JsonValue>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`;
}
