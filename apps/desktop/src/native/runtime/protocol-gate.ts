/**
 * @epoch/desktop — the update/protocol compatibility gate (W048).
 *
 * THE NAMED NEGATIVE (c) ARTIFACT: the product REFUSES to open an
 * incompatible protocol envelope version — typed
 * `unrecoverable/contract-version-unsupported`, never a silent open,
 * never a partial application. Three refusal points:
 *
 *  1. `checkUpdateCandidate` — an update (or sidegrade/rollback candidate)
 *     whose protocol triple does not match this build's accepted set is
 *     REFUSED before anything is applied; the product keeps running the
 *     current version.
 *  2. `admitPersistedRecord` — records restored from durable local state
 *     (sessions mirror, offline queue, projection cache, gateway
 *     persistence) carry the protocol envelope they were written with; an
 *     incompatible record is REFUSED (never opened): the caller discards
 *     it and recovers through re-authentication / re-fetch / re-enqueue —
 *     the J11 recovery paths, never data corruption.
 *  3. `assertRequestProtocol` — the bridge never builds or sends an
 *     envelope against a foreign contract version.
 */
import { gatewayError, type GatewayError } from '@epoch/client-runtime';
import {
  DESKTOP_GATEWAY_CONTRACT_VERSION,
  DESKTOP_HOST_PROTOCOL_VERSION,
  DESKTOP_PRODUCT_VERSION,
  DESKTOP_PROTOCOL_ENVELOPE,
  DESKTOP_RECORD_SCHEMA_VERSION,
  type DesktopProtocolEnvelope,
} from '../version';

/** A typed protocol refusal (the named negative (c) surface). */
export interface ProtocolRefusal {
  readonly refused: true;
  readonly reason:
    | 'gateway-contract-unsupported'
    | 'host-protocol-unsupported'
    | 'record-schema-unsupported'
    | 'envelope-malformed';
  readonly message: string;
  readonly expected: DesktopProtocolEnvelope;
  readonly received: LooseProtocolEnvelope | null;
}

/** The typed gateway-error form of a protocol refusal. */
export function protocolRefusalError(refusal: ProtocolRefusal): GatewayError {
  return gatewayError({
    class: 'unrecoverable',
    code: 'contract-version-unsupported',
    message: refusal.message,
    operation: 'gateway',
    correlationId: 'corr:unattributed',
    details: {
      hint: `the desktop product refuses to open protocol envelopes other than gateway contract ${DESKTOP_GATEWAY_CONTRACT_VERSION} / host ${DESKTOP_HOST_PROTOCOL_VERSION} / schema ${DESKTOP_RECORD_SCHEMA_VERSION}`,
    },
  });
}

/** The loose received-protocol view (what a candidate actually carried). */
interface LooseProtocolEnvelope {
  readonly schemaVersion?: number | undefined;
  readonly productVersion?: string | undefined;
  readonly protocol?:
    | {
        readonly gatewayContract?: string | undefined;
        readonly hostProtocol?: string | undefined;
        readonly recordSchema?: number | undefined;
      }
    | undefined;
}

function asProtocolEnvelope(value: unknown): LooseProtocolEnvelope | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const protocol = record['protocol'];
  const looseProtocol: LooseProtocolEnvelope['protocol'] =
    typeof protocol === 'object' && protocol !== null && !Array.isArray(protocol)
      ? {
          gatewayContract:
            typeof (protocol as Record<string, unknown>)['gatewayContract'] === 'string'
              ? ((protocol as Record<string, unknown>)['gatewayContract'] as string)
              : undefined,
          hostProtocol:
            typeof (protocol as Record<string, unknown>)['hostProtocol'] === 'string'
              ? ((protocol as Record<string, unknown>)['hostProtocol'] as string)
              : undefined,
          recordSchema:
            typeof (protocol as Record<string, unknown>)['recordSchema'] === 'number'
              ? ((protocol as Record<string, unknown>)['recordSchema'] as number)
              : undefined,
        }
      : undefined;
  return {
    schemaVersion: typeof record['schemaVersion'] === 'number' ? record['schemaVersion'] : undefined,
    productVersion: typeof record['productVersion'] === 'string' ? record['productVersion'] : undefined,
    protocol: looseProtocol,
  };
}

/** Compare a candidate envelope against THIS build's accepted triple. */
export function checkProtocolCompatibility(candidate: unknown): ProtocolRefusal | null {
  const received = asProtocolEnvelope(candidate);
  if (received === null) {
    return {
      refused: true,
      reason: 'envelope-malformed',
      message: 'the protocol envelope is malformed (expected the typed DesktopProtocolEnvelope shape)',
      expected: DESKTOP_PROTOCOL_ENVELOPE,
      received: null,
    };
  }
  const protocol = received.protocol ?? {};
  if (protocol.gatewayContract !== DESKTOP_GATEWAY_CONTRACT_VERSION) {
    return {
      refused: true,
      reason: 'gateway-contract-unsupported',
      message: `the gateway contract "${String(protocol.gatewayContract)}" is incompatible with this build's "${DESKTOP_GATEWAY_CONTRACT_VERSION}"`,
      expected: DESKTOP_PROTOCOL_ENVELOPE,
      received,
    };
  }
  if (protocol.hostProtocol !== DESKTOP_HOST_PROTOCOL_VERSION) {
    return {
      refused: true,
      reason: 'host-protocol-unsupported',
      message: `the native host protocol "${String(protocol.hostProtocol)}" is incompatible with this build's "${DESKTOP_HOST_PROTOCOL_VERSION}"`,
      expected: DESKTOP_PROTOCOL_ENVELOPE,
      received,
    };
  }
  if (protocol.recordSchema !== DESKTOP_RECORD_SCHEMA_VERSION || received.schemaVersion !== 1) {
    return {
      refused: true,
      reason: 'record-schema-unsupported',
      message: `the record schema ${String(protocol.recordSchema)}/${String(received.schemaVersion)} is incompatible with this build's ${DESKTOP_RECORD_SCHEMA_VERSION}/1`,
      expected: DESKTOP_PROTOCOL_ENVELOPE,
      received,
    };
  }
  return null;
}

/**
 * An update candidate (from an updater channel / a downloaded release
 * manifest). The product opens it ONLY when the protocol triple matches
 * exactly; otherwise the update is REFUSED and the current version keeps
 * running. `test/native-protocol-gate.test.ts` pins the refusal.
 */
export interface UpdateCandidate {
  readonly schemaVersion: number;
  readonly productVersion: string;
  readonly protocol: {
    readonly gatewayContract: string;
    readonly hostProtocol: string;
    readonly recordSchema: number;
  };
  readonly notes?: string | undefined;
}

/** The outcome of an update check: applied (compatible) or refused (typed). */
export type UpdateCheckOutcome =
  | { readonly ok: true; readonly candidate: UpdateCandidate }
  | { readonly ok: false; readonly refusal: ProtocolRefusal };

/** Check an update candidate against this build's protocol set. */
export function checkUpdateCandidate(candidate: unknown): UpdateCheckOutcome {
  const refusal = checkProtocolCompatibility(candidate);
  if (refusal !== null) return { ok: false, refusal };
  return { ok: true, candidate: candidate as UpdateCandidate };
}

/**
 * A persisted local record wrapper: every durable write the product makes
 * carries the protocol envelope, so relaunch (J12) can refuse incompatible
 * records instead of corrupting state.
 */
export interface PersistedRecordEnvelope<T> {
  readonly schemaVersion: number;
  readonly productVersion: string;
  readonly protocol: {
    readonly gatewayContract: string;
    readonly hostProtocol: string;
    readonly recordSchema: number;
  };
  readonly record: T;
}

/** Wrap a record with THIS build's protocol envelope before persisting. */
export function sealPersistedRecord<T>(record: T): PersistedRecordEnvelope<T> {
  return {
    schemaVersion: 1,
    productVersion: DESKTOP_PRODUCT_VERSION,
    protocol: {
      gatewayContract: DESKTOP_GATEWAY_CONTRACT_VERSION,
      hostProtocol: DESKTOP_HOST_PROTOCOL_VERSION,
      recordSchema: DESKTOP_RECORD_SCHEMA_VERSION,
    },
    record,
  };
}

/**
 * Open a persisted record: REFUSED (never opened) when the protocol
 * envelope is incompatible with this build — the caller discards the
 * record and recovers (re-auth / re-fetch / re-enqueue), never a partial
 * or coerced read.
 */
export type PersistedRecordOutcome<T> =
  | { readonly ok: true; readonly record: T }
  | { readonly ok: false; readonly refusal: ProtocolRefusal };

export function admitPersistedRecord<T>(payload: unknown): PersistedRecordOutcome<T> {
  const refusal = checkProtocolCompatibility(payload);
  if (refusal !== null) return { ok: false, refusal };
  const envelope = payload as PersistedRecordEnvelope<T>;
  return { ok: true, record: envelope.record };
}

/**
 * Assert the REQUEST protocol: the bridge never sends an envelope with a
 * contract version other than the frozen one (config errors surface as a
 * typed refusal at startup, not as mystery server rejections).
 */
export function assertRequestProtocol(contractVersion: string): ProtocolRefusal | null {
  if (contractVersion !== DESKTOP_GATEWAY_CONTRACT_VERSION) {
    return {
      refused: true,
      reason: 'gateway-contract-unsupported',
      message: `refusing to send envelopes of gateway contract "${contractVersion}" (this build speaks "${DESKTOP_GATEWAY_CONTRACT_VERSION}")`,
      expected: DESKTOP_PROTOCOL_ENVELOPE,
      received: null,
    };
  }
  return null;
}
