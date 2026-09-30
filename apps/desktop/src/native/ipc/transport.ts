/**
 * @epoch/desktop — the gateway transports (W048).
 *
 * How a gateway call physically travels. The BRIDGE
 * (src/native/ipc/bridge.ts) is transport-neutral: it builds the frozen
 * envelope and maps failures into the typed taxonomy; the transports
 * below are the two sanctioned bindings of the SAME
 * `ApplicationGatewayPort` contract:
 *
 *  - `EmbeddedGatewayTransport` — the W046 single-process composition:
 *    the Application Gateway (+ its authorities) runs in-process, seeded
 *    from the deterministic product fixtures for packaged local
 *    validation (dev-server mode, E2E, journey runs, and the packaged
 *    app's local deployment). The gateway is THE authority in this mode —
 *    the desktop never mutates semantic state around it.
 *
 *  - `TauriGatewayTransport` — the deployed-gateway mode: the envelope
 *    crosses the Tauri IPC seam (`epoch_gateway_call`) and the Rust host
 *    forwards it to the configured HTTPS endpoint. The Rust side also
 *    enforces the operation allowlist (defense in depth: the 32 frozen
 *    names are the only operations it will forward).
 *
 * There is deliberately NO direct kernel transport: any call that is not
 * one of the 32 frozen operations has no path to an authority (named
 * negative (a)).
 */
import {
  parseGatewayError,
  gatewayError,
  type ApplicationGatewayPort,
  type GatewayCallResult,
  type GatewayError,
  type GatewayRequestEnvelope,
} from '@epoch/client-runtime';

/** The transport binding kinds. */
export type GatewayTransportKind = 'embedded' | 'tauri-remote';

/** A transport binding for gateway request envelopes. */
export interface GatewayTransport {
  readonly kind: GatewayTransportKind;
  call(request: GatewayRequestEnvelope): Promise<GatewayCallResult>;
}

/** The transient connector error every transport failure maps to. */
export function connectorUnavailableError(operation: string, correlationId: string, message: string): GatewayError {
  return gatewayError({
    class: 'transient',
    code: 'connector-unavailable',
    message,
    operation,
    correlationId,
    details: { retryAfterMs: 1000 },
  });
}

// ---------------------------------------------------------------------------
// Embedded: the in-process Application Gateway (W046 single-process mode).
// ---------------------------------------------------------------------------

/**
 * The embedded transport: direct in-process delegation to a REAL
 * Application Gateway instance. Used for dev-server mode, the packaged
 * app's local (fixture-backed) deployment, E2E and journey runs.
 */
export class EmbeddedGatewayTransport implements GatewayTransport {
  readonly kind = 'embedded' as const;

  constructor(private readonly port: ApplicationGatewayPort) {}

  async call(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
    return this.port.call(request);
  }
}

// ---------------------------------------------------------------------------
// Tauri remote: envelope forwarding through the native host.
// ---------------------------------------------------------------------------

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

async function loadTauriInvoke(): Promise<TauriInvoke> {
  const core = (await import('@tauri-apps/api/core')) as { invoke: TauriInvoke };
  return core.invoke;
}

/**
 * The remote transport: `invoke('epoch_gateway_call')` -> Rust -> HTTPS
 * endpoint. Failures (no endpoint, network down, non-Tauri context) map
 * to the typed `transient/connector-unavailable` error so the product
 * runtime can re-queue or retry — never a bare throw.
 */
export class TauriGatewayTransport implements GatewayTransport {
  readonly kind = 'tauri-remote' as const;
  private readonly invoke: TauriInvoke;

  constructor(options: { readonly invoke?: TauriInvoke } = {}) {
    this.invoke =
      options.invoke ??
      ((cmd: string, args?: Record<string, unknown>) =>
        loadTauriInvoke().then((loaded) => loaded(cmd, args)));
  }

  async call(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
    let raw: unknown;
    try {
      raw = await this.invoke('epoch_gateway_call', { request });
    } catch (cause) {
      return {
        ok: false,
        error: connectorUnavailableError(
          request.operation,
          request.correlation.correlationId,
          `the native gateway connector is unavailable (${String(cause)})`,
        ),
      };
    }
    // The Rust host returns the SERIALIZED GatewayCallResult (ok outcome
    // envelope or serialized typed error) — parse defensively: a malformed
    // payload is the typed `response-malformed` unrecoverable error,
    // never a throw, never a silent open.
    if (isRecord(raw) && raw['ok'] === true && isRecord(raw['value'])) {
      return { ok: true, value: raw['value'] as never };
    }
    if (isRecord(raw) && raw['ok'] === false) {
      const parsed = parseGatewayError(raw['error']);
      if (parsed.ok) return { ok: false, error: parsed.value };
    }
    return {
      ok: false,
      error: gatewayError({
        class: 'unrecoverable',
        code: 'response-malformed',
        message: 'the remote gateway connector returned a malformed result envelope',
        operation: request.operation,
        correlationId: request.correlation.correlationId,
        details: { hint: 'the endpoint must answer with the serialized GatewayCallResult contract' },
      }),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A transport factory: picks the binding for the product configuration.
 * `embedded` binds the provided in-process gateway port; `remote` binds
 * the Tauri forwarding transport.
 */
export function createTransport(options: {
  readonly mode: 'embedded' | 'remote';
  readonly embeddedPort?: ApplicationGatewayPort | undefined;
  readonly invoke?: TauriInvoke | undefined;
}): GatewayTransport {
  if (options.mode === 'embedded') {
    if (options.embeddedPort === undefined) {
      throw new Error('the embedded transport requires the ApplicationGatewayPort binding');
    }
    return new EmbeddedGatewayTransport(options.embeddedPort);
  }
  return new TauriGatewayTransport(options.invoke !== undefined ? { invoke: options.invoke } : {});
}
