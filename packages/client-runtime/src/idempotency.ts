/**
 * @epoch/client-runtime — the typed IdempotentReplay.
 *
 * W046 pin: "the runtime exports a typed IdempotentReplay (operation key,
 * request fingerprint, replay result contract). Every mutating gateway
 * operation carries an idempotency key; replays return the recorded
 * outcome, never double-apply."
 *
 * Model: the FIRST application of (operationKey, idempotencyKey) with
 * fingerprint F executes the operation and records the outcome; ANY later
 * call with the same key + same fingerprint returns the RECORDED outcome
 * (status 'replayed') without re-executing; the same key with a DIFFERENT
 * fingerprint is the typed `conflict/idempotency-fingerprint-mismatch`
 * error (the key was reused for a different request). Failed executions
 * are not recorded — a retry re-executes (reservation semantics).
 *
 * Deterministic: zero wall-clock, zero randomness; the caller supplies
 * every instant. Stores are async (the persistence SPI is I/O-shaped).
 */
import { z } from 'zod';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  CLIENT_RUNTIME_RECORD_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
  type GatewayOperationName,
} from './version';
import { gatewayError, type GatewayResult } from './errors';

export const IdempotencyKeySchema = z
  .string()
  .regex(IDEMPOTENCY_KEY_PATTERN, 'must be an idempotency key of the form "idem:<slug>"')
  .meta({ id: 'IdempotencyKey', title: 'IdempotencyKey' });

export const RequestFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be a lowercase-hex SHA-256 fingerprint')
  .meta({ id: 'RequestFingerprint', title: 'RequestFingerprint' });

/** The address of an idempotent execution. */
export interface IdempotencyAddress {
  /** The gateway operation this key applies to. */
  readonly operationKey: GatewayOperationName | string;
  /** The caller-assigned idempotency key. */
  readonly idempotencyKey: string;
  /** SHA-256 over the canonical JSON of the request payload. */
  readonly requestFingerprint: Sha256Hex;
}

export const IdempotencyAddressSchema = z
  .strictObject({
    operationKey: z.string().min(1).max(128),
    idempotencyKey: IdempotencyKeySchema,
    requestFingerprint: RequestFingerprintSchema,
  })
  .readonly()
  .meta({ id: 'IdempotencyAddress', title: 'IdempotencyAddress' });

/** The SHA-256 request fingerprint of an idempotent address (hex form). */
export type RequestFingerprint = Sha256Hex;

/** Compute the canonical request fingerprint of a JSON payload. */
export function computeRequestFingerprint(payload: JsonValue): Sha256Hex {
  return canonicalDigest(payload);
}

/** The durable record of one idempotent application. */
export interface IdempotencyRecord {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly operationKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: Sha256Hex;
  /** 'reserved' while an attempt is in flight; 'applied' once recorded. */
  readonly status: 'reserved' | 'applied';
  readonly outcomeDigest: Sha256Hex | null;
  readonly outcome: JsonValue | null;
  readonly recordedAt: string | null;
  readonly attempts: number;
}

export const IdempotencyRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    operationKey: z.string().min(1).max(128),
    idempotencyKey: IdempotencyKeySchema,
    requestFingerprint: RequestFingerprintSchema,
    status: z.enum(['reserved', 'applied']),
    outcomeDigest: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    outcome: JsonValueSchema.nullable(),
    recordedAt: TimestampSchema.nullable(),
    attempts: z.number().int().min(1),
  })
  .readonly()
  .meta({ id: 'IdempotencyRecord', title: 'IdempotencyRecord' });

/**
 * The replay result contract: what a mutating gateway operation returns.
 * `status` distinguishes the first application ('applied') from a replay
 * ('replayed' — the recorded outcome, never re-executed).
 */
export interface IdempotentReplay<T = JsonValue> {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly operationKey: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: Sha256Hex;
  readonly status: 'applied' | 'replayed';
  readonly outcome: T;
  readonly recordedAt: string;
  readonly attempts: number;
}

export const IdempotentReplaySchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    operationKey: z.string().min(1).max(128),
    idempotencyKey: IdempotencyKeySchema,
    requestFingerprint: RequestFingerprintSchema,
    status: z.enum(['applied', 'replayed']),
    outcome: JsonValueSchema,
    recordedAt: TimestampSchema,
    attempts: z.number().int().min(1),
  })
  .readonly()
  .meta({ id: 'IdempotentReplay', title: 'IdempotentReplay' });

/** Outcome of reserving an idempotency address in a store. */
export type IdempotencyReservation =
  | { readonly kind: 'new'; readonly record: IdempotencyRecord }
  | { readonly kind: 'existing'; readonly record: IdempotencyRecord }
  | { readonly kind: 'mismatch'; readonly record: IdempotencyRecord };

/**
 * The provider-neutral idempotency store port. The in-memory reference
 * implementation lives here; `services/application-gateway` binds the same
 * contract to the persistence SPI (in-memory or PostgreSQL).
 */
export interface IdempotencyStore {
  /** Reserve the address; returns the typed reservation outcome. */
  reserve(address: IdempotencyAddress): Promise<IdempotencyReservation>;
  /** Record the applied outcome (idempotent; first write wins). */
  record(address: IdempotencyAddress, outcome: JsonValue, at: string): Promise<IdempotencyRecord>;
  /** Look up the record for a key (null when never reserved). */
  lookup(operationKey: string, idempotencyKey: string): Promise<IdempotencyRecord | null>;
}

/** The reference in-memory store (deterministic, insertion-ordered reads sorted by key). */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  private keyOf(operationKey: string, idempotencyKey: string): string {
    return `${operationKey}\u0000${idempotencyKey}`;
  }

  async reserve(address: IdempotencyAddress): Promise<IdempotencyReservation> {
    const key = this.keyOf(address.operationKey, address.idempotencyKey);
    const existing = this.records.get(key);
    if (existing === undefined) {
      const record: IdempotencyRecord = {
        schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
        operationKey: address.operationKey,
        idempotencyKey: address.idempotencyKey,
        requestFingerprint: address.requestFingerprint,
        status: 'reserved',
        outcomeDigest: null,
        outcome: null,
        recordedAt: null,
        attempts: 1,
      };
      this.records.set(key, record);
      return { kind: 'new', record };
    }
    if (existing.requestFingerprint !== address.requestFingerprint) {
      return { kind: 'mismatch', record: existing };
    }
    return { kind: 'existing', record: { ...existing, attempts: existing.attempts + 1 } };
  }

  async record(address: IdempotencyAddress, outcome: JsonValue, at: string): Promise<IdempotencyRecord> {
    const key = this.keyOf(address.operationKey, address.idempotencyKey);
    const existing = this.records.get(key);
    if (existing !== undefined && existing.status === 'applied') {
      return existing; // first write wins — never double-apply
    }
    const recorded: IdempotencyRecord = {
      schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
      operationKey: address.operationKey,
      idempotencyKey: address.idempotencyKey,
      requestFingerprint: address.requestFingerprint,
      status: 'applied',
      outcomeDigest: canonicalDigest(outcome),
      outcome,
      recordedAt: at,
      attempts: existing?.attempts ?? 1,
    };
    this.records.set(key, recorded);
    return recorded;
  }

  async lookup(operationKey: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.keyOf(operationKey, idempotencyKey)) ?? null;
  }

  /** Number of tracked addresses (test/diagnostics only). */
  get size(): number {
    return this.records.size;
  }

  /** Deterministic snapshot (sorted by operationKey then key). */
  snapshot(): readonly IdempotencyRecord[] {
    return [...this.records.values()].sort((a, b) =>
      a.operationKey === b.operationKey
        ? a.idempotencyKey < b.idempotencyKey
          ? -1
          : 1
        : a.operationKey < b.operationKey
          ? -1
          : 1,
    );
  }
}

/**
 * The typed replay engine. `executor` performs the operation's side effect
 * and returns its typed result; the engine guarantees:
 *  - first call: executes + records; returns status 'applied';
 *  - replay (same address, already applied): returns the RECORDED outcome
 *    with status 'replayed' — the executor is NOT invoked;
 *  - same key, different fingerprint: typed conflict error, executor NOT
 *    invoked;
 *  - reserved-but-unapplied (a prior attempt failed before recording):
 *    re-executes (retry semantics).
 */
export async function applyIdempotent<T>(
  store: IdempotencyStore,
  address: IdempotencyAddress,
  executor: () => Promise<GatewayResult<T>>,
  at: string,
): Promise<GatewayResult<IdempotentReplay<T>>> {
  const reservation = await store.reserve(address);
  if (reservation.kind === 'mismatch') {
    return {
      ok: false,
      error: gatewayError({
        class: 'conflict',
        code: 'idempotency-fingerprint-mismatch',
        message:
          'the idempotency key was already used for a request with a different fingerprint',
        operation: address.operationKey,
        correlationId: 'corr:unattributed',
        details: {
          idempotencyKey: address.idempotencyKey,
          requestFingerprint: address.requestFingerprint,
          recordedFingerprint: reservation.record.requestFingerprint,
        },
      }),
    };
  }
  if (reservation.kind === 'existing' && reservation.record.status === 'applied') {
    return {
      ok: true,
      value: {
        schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
        operationKey: address.operationKey,
        idempotencyKey: address.idempotencyKey,
        requestFingerprint: address.requestFingerprint,
        status: 'replayed',
        outcome: reservation.record.outcome as T,
        recordedAt: reservation.record.recordedAt as string,
        attempts: reservation.record.attempts,
      },
    };
  }
  // 'new', or 'existing' still reserved (a prior attempt failed before
  // recording) — execute.
  const executed = await executor();
  if (!executed.ok) {
    return executed; // failure: not recorded; a retry re-executes
  }
  const recorded = await store.record(address, executed.value as unknown as JsonValue, at);
  return {
    ok: true,
    value: {
      schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
      operationKey: address.operationKey,
      idempotencyKey: address.idempotencyKey,
      requestFingerprint: address.requestFingerprint,
      status: 'applied',
      outcome: executed.value,
      recordedAt: recorded.recordedAt as string,
      attempts: recorded.attempts,
    },
  };
}
