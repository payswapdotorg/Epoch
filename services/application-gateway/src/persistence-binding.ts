/**
 * @epoch/application-gateway — the persistence bindings: the typed
 * durable stores the gateway itself owns (idempotency records, session
 * mirrors, correlation ledger) over the provider-neutral persistence
 * SPI. PostgreSQL is the durable authority when the SPI is bound to the
 * Postgres adapter (ACR-005); the in-memory default keeps the reference
 * behavior deterministic.
 */
import {
  canonicalDigest,
  type JsonValue,
  type Sha256Hex,
  type Timestamp,
} from '@epoch/agent-protocol';
import type { PersistenceSession } from '@epoch/persistence';
import { PostgresPersistence } from '@epoch/persistence';
import type { PostgresWirePort } from '@epoch/persistence';
import {
  applyIdempotent,
  type IdempotencyRecord,
  type IdempotencyAddress,
  type IdempotencyReservation,
  type IdempotencyStore,
  type GatewayResult,
} from '@epoch/client-runtime';
import { gatewayError, ok as okResult, fail as failResult } from '@epoch/client-runtime';
import type { SessionRecord } from '@epoch/authentication';
import { SessionManager } from '@epoch/authentication';

/** The gateway's durable tables (SQL-safe identifiers, grammar-validated). */
export const GATEWAY_TABLES = {
  idempotency: 'gateway_idempotency',
  sessions: 'gateway_sessions',
  correlations: 'gateway_correlations',
} as const;

/** The gateway's migration plan (idempotent CREATE IF NOT EXISTS). */
export const GATEWAY_MIGRATION_PLAN = {
  steps: [
    { version: 1, table: GATEWAY_TABLES.idempotency, description: 'idempotency records (apply/replay/dedupe)' },
    { version: 2, table: GATEWAY_TABLES.sessions, description: 'session record mirrors (durable session authority)' },
    { version: 3, table: GATEWAY_TABLES.correlations, description: 'correlation ledger entries (gateway -> kernel trace)' },
  ],
} as const;

/**
 * The persisted idempotency store: implements the client-runtime
 * IdempotencyStore contract over the persistence SPI (in-memory or
 * PostgreSQL — the SAME code path).
 */
export class PersistedIdempotencyStore implements IdempotencyStore {
  constructor(private readonly persistence: PersistenceSession) {}

  async reserve(address: IdempotencyAddress): Promise<IdempotencyReservation> {
    const key = idempotencyRowKey(address.operationKey, address.idempotencyKey);
    const existing = await this.loadRecord(key);
    if (existing === null) {
      const record: IdempotencyRecord = {
        schemaVersion: 1,
        operationKey: address.operationKey,
        idempotencyKey: address.idempotencyKey,
        requestFingerprint: address.requestFingerprint,
        status: 'reserved',
        outcomeDigest: null,
        outcome: null,
        recordedAt: null,
        attempts: 1,
      };
      const inserted = await this.persistence.insert(GATEWAY_TABLES.idempotency, key, record as unknown as JsonValue);
      if (!inserted.ok) {
        // Lost an insertion race: reload.
        const raced = await this.loadRecord(key);
        if (raced !== null) return reservationOf(raced, address);
      }
      return { kind: 'new', record };
    }
    return reservationOf(existing, address);
  }

  async record(address: IdempotencyAddress, outcome: JsonValue, at: string): Promise<IdempotencyRecord> {
    const key = idempotencyRowKey(address.operationKey, address.idempotencyKey);
    const existing = await this.loadRecord(key);
    if (existing !== null && existing.status === 'applied') {
      return existing; // first write wins — never double-apply
    }
    const recorded: IdempotencyRecord = {
      schemaVersion: 1,
      operationKey: address.operationKey,
      idempotencyKey: address.idempotencyKey,
      requestFingerprint: address.requestFingerprint,
      status: 'applied',
      outcomeDigest: canonicalDigest(outcome),
      outcome,
      recordedAt: at,
      attempts: existing?.attempts ?? 1,
    };
    await this.persistence.put(GATEWAY_TABLES.idempotency, key, recorded as unknown as JsonValue);
    return recorded;
  }

  async lookup(operationKey: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.loadRecord(idempotencyRowKey(operationKey, idempotencyKey));
  }

  private async loadRecord(key: string): Promise<IdempotencyRecord | null> {
    const got = await this.persistence.get(GATEWAY_TABLES.idempotency, key);
    if (!got.ok) return null;
    if (got.value === null) return null;
    const candidate = got.value as unknown as IdempotencyRecord;
    if (candidate.status !== 'reserved' && candidate.status !== 'applied') return null;
    return candidate;
  }
}

function reservationOf(existing: IdempotencyRecord, address: IdempotencyAddress): IdempotencyReservation {
  if (existing.requestFingerprint !== address.requestFingerprint) {
    return { kind: 'mismatch', record: existing };
  }
  return { kind: 'existing', record: { ...existing, attempts: existing.attempts + 1 } };
}

function idempotencyRowKey(operationKey: string, idempotencyKey: string): string {
  // Row keys must satisfy the record-key grammar (no \u0000).
  return `${operationKey}::${idempotencyKey}`;
}

/**
 * The correlation ledger: one row per gateway call, recording the
 * operation, the correlation id, the authority package delegated to and
 * the outcome digest — the durable trace of gateway -> kernel calls.
 */
export interface CorrelationLedgerEntry {
  readonly schemaVersion: 1;
  readonly correlationId: string;
  readonly operation: string;
  readonly authority: string;
  readonly at: Timestamp;
  readonly outcomeDigest: Sha256Hex | null;
  readonly replayed: boolean;
}

export class CorrelationLedger {
  constructor(private readonly persistence: PersistenceSession) {}

  async record(entry: CorrelationLedgerEntry): Promise<void> {
    const key = `${entry.at}::${entry.correlationId}::${entry.operation}`;
    await this.persistence.put(GATEWAY_TABLES.correlations, key, entry as unknown as JsonValue);
  }

  async entriesFor(correlationId: string): Promise<readonly CorrelationLedgerEntry[]> {
    const listed = await this.persistence.list(GATEWAY_TABLES.correlations);
    if (!listed.ok) return [];
    return listed.value
      .map((row) => row.value as unknown as CorrelationLedgerEntry)
      .filter((entry) => entry.correlationId === correlationId)
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }

  async size(): Promise<number> {
    const listed = await this.persistence.list(GATEWAY_TABLES.correlations);
    return listed.ok ? listed.value.length : 0;
  }
}

/**
 * The durable session mirror: sessions issued through the gateway are
 * mirrored into the SPI (PostgreSQL when bound); a fresh process
 * restores them into a new SessionManager (the durable authority for
 * session RECORDS; the manager is the in-process cache).
 */
export class SessionMirror {
  constructor(private readonly persistence: PersistenceSession) {}

  async mirrorSession(record: SessionRecord): Promise<void> {
    await this.persistence.put(
      GATEWAY_TABLES.sessions,
      record.session.sessionId,
      record as unknown as JsonValue,
    );
  }

  async restoreInto(manager: SessionManager): Promise<number> {
    const listed = await this.persistence.list(GATEWAY_TABLES.sessions);
    if (!listed.ok) return 0;
    const restored = manager.restoreSessions(listed.value.map((row) => row.value));
    return restored.ok ? restored.value : 0;
  }

  async all(): Promise<readonly SessionRecord[]> {
    const listed = await this.persistence.list(GATEWAY_TABLES.sessions);
    if (!listed.ok) return [];
    return listed.value.map((row) => row.value as unknown as SessionRecord);
  }
}

/** Prepare the gateway tables on a persistence session (idempotent). */
export async function migrateGatewayTables(
  persistence: PersistenceSession,
): Promise<GatewayResult<{ applied: readonly string[] }>> {
  const migrated = await persistence.migrate(GATEWAY_MIGRATION_PLAN);
  if (!migrated.ok) {
    return failResult(
      gatewayError({
        class: 'unrecoverable',
        code: 'internal-invariant-violated',
        message: `the gateway table migration failed: ${migrated.error.message}`,
        operation: 'gateway',
        correlationId: 'corr:unattributed',
      }),
    );
  }
  return okResult({ applied: migrated.value.applied });
}

/** Create the PostgreSQL-backed gateway persistence (over a bound wire port). */
export function createPostgresGatewayPersistence(wire: PostgresWirePort): PostgresPersistence {
  return new PostgresPersistence(wire);
}

/** Re-export the shared replay engine for the gateway's operation wrapping. */
export { applyIdempotent };
