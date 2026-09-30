/**
 * @epoch/desktop — the desktop persistence session (W048).
 *
 * The typed record-store seam that makes the embedded Application
 * Gateway's OWN durable records (sessions mirror, idempotency, the
 * correlation ledger) survive app close/relaunch (J12): the
 * `PersistenceSession` SPI from @epoch/persistence implemented over the
 * host durable store (`epoch_durable_*`). This is the W048 instance of
 * "durable state flows through the Gateway envelopes + client-runtime
 * persistence/session seams" — the desktop stores the gateway's
 * RECORD-STORE primitives, never kernel semantic objects.
 *
 * Transaction semantics: the desktop is a single-writer context, so a
 * transaction stages writes into a local overlay and commits
 * all-or-nothing into the backing map (rollback discards the overlay) —
 * the same observable contract the in-memory reference provides.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  persistenceFail,
  persistenceOk,
  validateRecordKey,
  validateTableName,
  validateRecordValue,
  type MigrationOutcome,
  type MigrationPlan,
  type PersistenceSession,
  type RecordEntry,
  type RecordStore,
} from '@epoch/persistence';
import type { PersistenceError, PersistenceResult } from '@epoch/persistence';
import type { HostCommandPort } from '../ipc/host';

const KEY_PREFIX = 'epoch.persistence.';

/** One table's contents, JSON-encoded per record. */
interface TableData {
  readonly records: Map<string, string>;
}

/** The desktop persistence session over the host durable store. */
export class DesktopPersistenceSession implements PersistenceSession {
  private readonly tables = new Map<string, TableData>();
  private readonly migrations = new Set<string>();

  constructor(private readonly host: HostCommandPort) {}

  /** Load the persisted tables from the host durable store (relaunch). */
  async restore(): Promise<void> {
    const keys = await this.host.durable.keys();
    this.tables.clear();
    this.migrations.clear();
    for (const key of keys) {
      if (!key.startsWith(KEY_PREFIX)) continue;
      const table = key.slice(KEY_PREFIX.length);
      const raw = await this.host.durable.get(key);
      if (raw === null) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // a corrupt table file is discarded (J11 recovery)
      }
      if (!Array.isArray(parsed)) continue;
      const records = new Map<string, string>();
      for (const entry of parsed as unknown[]) {
        if (
          typeof entry === 'object' &&
          entry !== null &&
          'key' in entry &&
          'value' in entry &&
          typeof (entry as Record<string, unknown>)['key'] === 'string'
        ) {
          records.set((entry as Record<string, unknown>)['key'] as string, JSON.stringify((entry as Record<string, unknown>)['value']));
        }
      }
      this.tables.set(table, { records });
    }
  }

  /** Flush every dirty table to the host durable store (app close / commit). */
  async flush(): Promise<void> {
    for (const [table, data] of this.tables) {
      const entries: { key: string; value: JsonValue }[] = [];
      for (const [key, raw] of data.records) {
        entries.push({ key, value: JSON.parse(raw) as JsonValue });
      }
      entries.sort((a, b) => (a.key < b.key ? -1 : 1));
      await this.host.durable.set(KEY_PREFIX + table, JSON.stringify(entries));
    }
  }

  async insert(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const error = this.validate(table, key, record);
    if (error !== null) return persistenceFail(error);
    const data = this.tableData(table);
    if (data.records.has(key)) {
      return persistenceFail({ code: 'duplicate-key', message: `record "${key}" already exists in "${table}"`, table, key });
    }
    data.records.set(key, canonical(record));
    return persistenceOk(undefined);
  }

  async get(table: string, key: string): Promise<PersistenceResult<JsonValue | null>> {
    const error = this.validate(table, key, null);
    if (error !== null && error.code === 'validation') return persistenceFail(error);
    const data = this.tables.get(table);
    if (data === undefined) return persistenceOk(null);
    const raw = data.records.get(key);
    return persistenceOk(raw === undefined ? null : (JSON.parse(raw) as JsonValue));
  }

  async put(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const error = this.validate(table, key, record);
    if (error !== null) return persistenceFail(error);
    this.tableData(table).records.set(key, canonical(record));
    return persistenceOk(undefined);
  }

  async delete(table: string, key: string): Promise<PersistenceResult<boolean>> {
    const data = this.tables.get(table);
    if (data === undefined) return persistenceOk(false);
    return persistenceOk(data.records.delete(key));
  }

  async list(table: string): Promise<PersistenceResult<readonly RecordEntry[]>> {
    const data = this.tables.get(table);
    if (data === undefined) return persistenceOk([]);
    const entries: RecordEntry[] = [...data.records.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, raw]) => ({ key, value: JSON.parse(raw) as JsonValue }));
    return persistenceOk(entries);
  }

  async transaction<T>(
    callback: (tx: RecordStore) => Promise<PersistenceResult<T>>,
  ): Promise<PersistenceResult<T>> {
    // Stage into an overlay; commit only when the callback resolves ok.
    const overlay = new Map<string, string>();
    const txStore: RecordStore = {
      insert: async (table, key, record) => {
        const error = this.validate(table, key, record);
        if (error !== null) return persistenceFail(error);
        if (this.tableData(table).records.has(key) || overlay.has(`${table}\u0000${key}`)) {
          return persistenceFail({ code: 'duplicate-key', message: `record "${key}" already exists in "${table}"`, table, key });
        }
        overlay.set(`${table}\u0000${key}`, canonical(record));
        return persistenceOk(undefined);
      },
      get: async (table, key) => {
        const staged = overlay.get(`${table}\u0000${key}`);
        if (staged !== undefined) return persistenceOk(JSON.parse(staged) as JsonValue);
        return this.get(table, key);
      },
      put: async (table, key, record) => {
        const error = this.validate(table, key, record);
        if (error !== null) return persistenceFail(error);
        overlay.set(`${table}\u0000${key}`, canonical(record));
        return persistenceOk(undefined);
      },
      delete: async (table, key) => {
        const had =
          overlay.delete(`${table}\u0000${key}`) || this.tableData(table).records.delete(key);
        return persistenceOk(had);
      },
      list: async (table) => {
        const merged = new Map<string, string>();
        const base = this.tables.get(table);
        if (base !== undefined) {
          for (const [key, raw] of base.records) merged.set(key, raw);
        }
        for (const [composite, raw] of overlay) {
          if (composite.startsWith(`${table}\u0000`)) merged.set(composite.slice(table.length + 1), raw);
        }
        const entries: RecordEntry[] = [...merged.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([key, raw]) => ({ key, value: JSON.parse(raw) as JsonValue }));
        return persistenceOk(entries);
      },
    };
    const outcome = await callback(txStore);
    if (!outcome.ok) return outcome;
    for (const [composite, raw] of overlay) {
      const separator = composite.indexOf('\u0000');
      const table = composite.slice(0, separator);
      const key = composite.slice(separator + 1);
      this.tableData(table).records.set(key, raw);
    }
    return outcome;
  }

  async migrate(plan: MigrationPlan): Promise<PersistenceResult<MigrationOutcome>> {
    const applied: string[] = [];
    for (const step of plan.steps) {
      if (this.migrations.has(step.table)) continue; // CREATE IF NOT EXISTS
      this.migrations.add(step.table);
      if (!this.tables.has(step.table)) this.tables.set(step.table, { records: new Map() });
      applied.push(step.table);
    }
    const digest = canonicalDigest(plan.steps as unknown as JsonValue);
    return persistenceOk({ applied, planDigest: digest });
  }

  private tableData(table: string): TableData {
    let data = this.tables.get(table);
    if (data === undefined) {
      data = { records: new Map() };
      this.tables.set(table, data);
    }
    return data;
  }

  private validate(table: string, key: string, record: JsonValue | null): PersistenceError | null {
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
}

function canonical(record: JsonValue): string {
  return JSON.stringify(record);
}
