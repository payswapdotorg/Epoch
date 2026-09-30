/**
 * @epoch/persistence — the provider-neutral persistence SPI.
 *
 * The durable-state seam between the application gateway and its storage:
 * typed RECORD-STORE primitives (not SQL-shaped — SQL emission is the
 * PostgreSQL adapter's business, pinned by the golden-SQL corpus), a
 * transaction scope with all-or-nothing commit/rollback, and idempotent
 * versioned migrations. Two implementations of the SAME contract must
 * pass the SAME conformance suite: the in-memory reference and the real
 * PostgreSQL adapter (W046 pin 4).
 *
 * Values are canonical JSON records (stable key order — digests over
 * stored values are byte-stable across implementations). Keys are
 * parametrized, never interpolated. Deterministic: zero wall-clock, zero
 * randomness, zero ordering noise (list is sorted by key).
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { canonicalJsonStringify, canonicalDigest } from '@epoch/agent-protocol';
import { RECORD_KEY_PATTERN, TABLE_NAME_PATTERN, type PersistenceError, type PersistenceResult } from './version';

// Re-exported for one-stop typed consumption from the SPI module.
export type { PersistenceResult } from './version';

/** One stored record entry (key + canonical JSON value). */
export interface RecordEntry {
  readonly key: string;
  readonly value: JsonValue;
}

/** One migration step: a versioned, idempotent table introduction. */
export interface MigrationStep {
  /** Monotonic step version within the plan (order of application). */
  readonly version: number;
  /** The table this step introduces (validated against the grammar). */
  readonly table: string;
  /** Human audit note (never emitted into SQL). */
  readonly description: string;
}

/** An ordered, idempotent migration plan (digest-addressed). */
export interface MigrationPlan {
  readonly steps: readonly MigrationStep[];
}

/** The outcome of applying a migration plan. */
export interface MigrationOutcome {
  readonly applied: readonly string[];
  readonly planDigest: Sha256Hex;
}

/** The record-store primitives available inside a transaction. */
export interface RecordStore {
  /** Insert a record; fails typed `duplicate-key` when the key exists. */
  insert(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>>;
  /** Fetch a record by key (null when absent). */
  get(table: string, key: string): Promise<PersistenceResult<JsonValue | null>>;
  /** Upsert a record (insert-or-replace). */
  put(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>>;
  /** Delete a record; false when the key was absent. */
  delete(table: string, key: string): Promise<PersistenceResult<boolean>>;
  /** List all records of a table, sorted by key ascending. */
  list(table: string): Promise<PersistenceResult<readonly RecordEntry[]>>;
}

/**
 * The persistence session: record-store primitives + transactions +
 * migrations. All operations validate table/key grammar BEFORE any
 * storage interaction (the injection guard is provider-neutral).
 */
export interface PersistenceSession extends RecordStore {
  /**
   * Run a multi-operation unit all-or-nothing: the callback's store is
   * the transaction scope; COMMIT happens only when the callback
   * resolves ok, ROLLBACK otherwise (thrown or failed). A rolled-back
   * transaction is the typed `transaction-rolled-back` error (carrying
   * the callback's failure when there was one).
   */
  transaction<T>(
    callback: (tx: RecordStore) => Promise<PersistenceResult<T>>,
  ): Promise<PersistenceResult<T>>;
  /** Apply an idempotent migration plan (CREATE IF NOT EXISTS semantics). */
  migrate(plan: MigrationPlan): Promise<PersistenceResult<MigrationOutcome>>;
}

/** Validate a table name (typed error on violation). */
export function validateTableName(table: string): PersistenceError | null {
  if (!TABLE_NAME_PATTERN.test(table)) {
    return {
      code: 'validation',
      message: `table name "${table}" violates the table grammar (lowercase dot-namespaced slug)`,
      table,
    };
  }
  return null;
}

/** Validate a record key (typed error on violation). */
export function validateRecordKey(key: string): PersistenceError | null {
  if (!RECORD_KEY_PATTERN.test(key)) {
    return {
      code: 'validation',
      message: `record key "${key}" violates the key grammar (bounded slug)`,
      key,
    };
  }
  return null;

}

/** Validate a stored record is JSON-representable (canonical serializable). */
export function validateRecordValue(record: JsonValue): PersistenceError | null {
  try {
    canonicalJsonStringify(record);
    return null;
  } catch (cause) {
    return { code: 'validation', message: `the record value is not canonical-JSON serializable (${String(cause)})` };
  }
}

/** The deterministic digest of a migration plan (canonical JSON over steps). */
export function migrationPlanDigest(plan: MigrationPlan): Sha256Hex {
  return canonicalDigest(plan.steps as unknown as JsonValue);
}

/** Validate a migration plan (ordered versions, unique, valid tables). */
export function validateMigrationPlan(plan: MigrationPlan): PersistenceError | null {
  let previousVersion = 0;
  const seenTables = new Set<string>();
  for (const step of plan.steps) {
    if (!Number.isSafeInteger(step.version) || step.version <= previousVersion) {
      return {
        code: 'validation',
        message: `migration step versions must be strictly increasing (got ${step.version} after ${previousVersion})`,
      };
    }
    previousVersion = step.version;
    const tableError = validateTableName(step.table);
    if (tableError !== null) return tableError;
    if (seenTables.has(step.table)) {
      return {
        code: 'validation',
        message: `migration plan introduces table "${step.table}" twice`,
        table: step.table,
      };
    }
    seenTables.add(step.table);
  }
  return null;
}

/** The ok constructor (internal + shared conformance helper). */
export function persistenceOk<T>(value: T): PersistenceResult<T> {
  return { ok: true, value };
}

/** The fail constructor. */
export function persistenceFail<T>(error: PersistenceError): PersistenceResult<T> {
  return { ok: false, error };
}
