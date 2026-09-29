/**
 * @epoch/persistence — the in-memory reference implementation.
 *
 * Deterministic, zero wall-clock: the SAME conformance suite that runs
 * against the PostgreSQL adapter runs here. Transactions clone the
 * affected state and commit atomically (all-or-nothing by construction).
 */
import type { JsonValue } from '@epoch/agent-protocol';
import {
  migrationPlanDigest,
  persistenceFail,
  persistenceOk,
  validateMigrationPlan,
  validateRecordKey,
  validateRecordValue,
  validateTableName,
  type MigrationOutcome,
  type MigrationPlan,
  type PersistenceSession,
  type PersistenceResult,
  type RecordEntry,
  type RecordStore,
} from './spi';

/** The in-memory reference persistence session. */
export class InMemoryPersistence implements PersistenceSession {
  private readonly tables = new Map<string, Map<string, string>>();
  private readonly migrationsApplied = new Set<string>();

  /** Number of tracked tables. */
  get tableCount(): number {
    return this.tables.size;
  }

  /** Total tracked records across tables. */
  get recordCount(): number {
    let total = 0;
    for (const table of this.tables.values()) total += table.size;
    return total;
  }

  async insert(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const guard = this.guard(table, key, record);
    if (guard !== null) return persistenceFail(guard);
    const rows = this.tableOf(table);
    if (rows.has(key)) {
      return persistenceFail({
        code: 'duplicate-key',
        message: `record "${key}" already exists in table "${table}"`,
        table,
        key,
      });
    }
    rows.set(key, JSON.stringify(record));
    return persistenceOk(undefined);
  }

  async get(table: string, key: string): Promise<PersistenceResult<JsonValue | null>> {
    const guard = this.guard(table, key, null);
    if (guard !== null) return persistenceFail(guard);
    const raw = this.tableOf(table).get(key);
    return persistenceOk(raw === undefined ? null : (JSON.parse(raw) as JsonValue));
  }

  async put(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const guard = this.guard(table, key, record);
    if (guard !== null) return persistenceFail(guard);
    this.tableOf(table).set(key, JSON.stringify(record));
    return persistenceOk(undefined);
  }

  async delete(table: string, key: string): Promise<PersistenceResult<boolean>> {
    const guard = this.guard(table, key, null);
    if (guard !== null) return persistenceFail(guard);
    const rows = this.tableOf(table);
    const existed = rows.delete(key);
    return persistenceOk(existed);
  }

  async list(table: string): Promise<PersistenceResult<readonly RecordEntry[]>> {
    const guard = validateTableName(table);
    if (guard !== null) return persistenceFail(guard);
    const entries = [...this.tableOf(table).entries()]
      .map(([key, raw]) => ({ key, value: JSON.parse(raw) as JsonValue }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    return persistenceOk(entries);
  }

  async transaction<T>(
    callback: (tx: RecordStore) => Promise<PersistenceResult<T>>,
  ): Promise<PersistenceResult<T>> {
    // Clone the whole state (reference impl: small stores; the Postgres
    // adapter drives real BEGIN/COMMIT/ROLLBACK instead).
    const snapshot = this.cloneState();
    const tx: RecordStore = {
      insert: (table, key, record) => this.insert(table, key, record),
      get: (table, key) => this.get(table, key),
      put: (table, key, record) => this.put(table, key, record),
      delete: (table, key) => this.delete(table, key),
      list: (table) => this.list(table),
    };
    let outcome: PersistenceResult<T>;
    try {
      outcome = await callback(tx);
    } catch (cause) {
      this.restoreState(snapshot);
      return persistenceFail({
        code: 'transaction-rolled-back',
        message: 'the transaction callback threw; all effects were rolled back',
        cause: String(cause),
      });
    }
    if (!outcome.ok) {
      this.restoreState(snapshot);
      return persistenceFail({
        code: 'transaction-rolled-back',
        message: 'the transaction callback failed; all effects were rolled back',
        cause: outcome.error.message,
      });
    }
    return outcome;
  }

  async migrate(plan: MigrationPlan): Promise<PersistenceResult<MigrationOutcome>> {
    const planError = validateMigrationPlan(plan);
    if (planError !== null) return persistenceFail(planError);
    const applied: string[] = [];
    for (const step of plan.steps) {
      if (!this.migrationsApplied.has(step.table)) {
        this.tableOf(step.table); // idempotent introduction
        this.migrationsApplied.add(step.table);
      }
      applied.push(step.table);
    }
    return persistenceOk({ applied, planDigest: migrationPlanDigest(plan) });
  }

  /** Deterministic whole-store snapshot (test + restore diagnostics). */
  snapshotState(): Readonly<Record<string, readonly RecordEntry[]>> {
    const out: Record<string, RecordEntry[]> = {};
    for (const [table, rows] of [...this.tables.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      out[table] = [...rows.entries()]
        .map(([key, raw]) => ({ key, value: JSON.parse(raw) as JsonValue }))
        .sort((a, b) => (a.key < b.key ? -1 : 1));
    }
    return out;
  }

  private tableOf(table: string): Map<string, string> {
    let rows = this.tables.get(table);
    if (rows === undefined) {
      rows = new Map<string, string>();
      this.tables.set(table, rows);
    }
    return rows;
  }

  private guard(
    table: string,
    key: string,
    record: JsonValue | null,
  ): ReturnType<typeof validateTableName> {
    const tableError = validateTableName(table);
    if (tableError !== null) return tableError;
    const keyError = validateRecordKey(key);
    if (keyError !== null) return keyError;
    if (record !== null) {
      const valueError = validateRecordValue(record);
      if (valueError !== null) return valueError;
    }
    return null;
  }

  private cloneState(): Map<string, Map<string, string>> {
    const clone = new Map<string, Map<string, string>>();
    for (const [table, rows] of this.tables) {
      clone.set(table, new Map(rows));
    }
    return clone;
  }

  private restoreState(snapshot: Map<string, Map<string, string>>): void {
    this.tables.clear();
    for (const [table, rows] of snapshot) {
      this.tables.set(table, new Map(rows));
    }
  }
}
