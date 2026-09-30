/**
 * @epoch/persistence — the real PostgreSQL adapter over the wire port.
 *
 * Implements the SAME SPI contract as the in-memory reference: the
 * shared conformance suite runs identically against both (W046 pin 4).
 * Transactions drive real BEGIN/COMMIT/ROLLBACK on a dedicated wire
 * session; the callback's failures roll the transaction back
 * (all-or-nothing). Driver binding happens in the SERVICE layer
 * (services/application-gateway: bindPgPool / bindPgliteEngine) — this
 * adapter only speaks the neutral wire port.
 */
import type { JsonValue } from '@epoch/agent-protocol';
import {
  persistenceFail,
  persistenceOk,
  validateMigrationPlan,
  type MigrationOutcome,
  type MigrationPlan,
  type PersistenceSession,
  type PersistenceResult,
  type RecordEntry,
  type RecordStore,
} from '../spi';
import { migrationPlanDigest } from '../spi';
import type { PersistenceError } from '../version';
import type { PostgresWirePort, PostgresWireResult } from './wire';
import {
  SQL_BEGIN,
  SQL_COMMIT,
  SQL_ROLLBACK,
  sqlCreateTable,
  sqlDelete,
  sqlDropTable,
  sqlGet,
  sqlInsert,
  sqlList,
  sqlPut,
  type SqlStatement,
} from './sql';

/** Options of the PostgreSQL adapter. */
export interface PostgresPersistenceOptions {
  /** When true, missing tables are NOT auto-created on first use (strict mode). */
  readonly strictTables?: boolean | undefined;
}

/** The real PostgreSQL persistence session (over an injected wire port). */
export class PostgresPersistence implements PersistenceSession {
  constructor(
    private readonly wire: PostgresWirePort,
    private readonly options: PostgresPersistenceOptions = {},
  ) {}

  async insert(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const statement = sqlInsert(table, key, record);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    // ON CONFLICT DO NOTHING: zero affected rows means the key existed.
    if (result.value.rowCount === 0) {
      return persistenceFail({
        code: 'duplicate-key',
        message: `record "${key}" already exists in table "${table}"`,
        table,
        key,
      });
    }
    return persistenceOk(undefined);
  }

  async get(table: string, key: string): Promise<PersistenceResult<JsonValue | null>> {
    const statement = sqlGet(table, key);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    const row = result.value.rows[0];
    return persistenceOk(row === undefined ? null : decodeValue(row['value']));
  }

  async put(table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> {
    const statement = sqlPut(table, key, record);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    return persistenceOk(undefined);
  }

  async delete(table: string, key: string): Promise<PersistenceResult<boolean>> {
    const statement = sqlDelete(table, key);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    return persistenceOk((result.value.rowCount ?? 0) > 0);
  }

  async list(table: string): Promise<PersistenceResult<readonly RecordEntry[]>> {
    const statement = sqlList(table);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    return persistenceOk(
      result.value.rows.map((row: Record<string, unknown>) => ({
        key: String(row['key']),
        value: decodeValue(row['value']),
      })),
    );
  }

  async transaction<T>(
    callback: (tx: RecordStore) => Promise<PersistenceResult<T>>,
  ): Promise<PersistenceResult<T>> {
    try {
      return await this.wire.withSession(async (session) => {
        await session.query(SQL_BEGIN.sql, SQL_BEGIN.params);
        const channel = async (statement: SqlStatement): Promise<PersistenceResult<PostgresWireResult>> => {
          try {
            return persistenceOk(await session.query(statement.sql, statement.params));
          } catch (cause) {
            return persistenceFail({
              code: 'adapter-error',
              message: `the PostgreSQL wire session rejected a statement: ${String(cause)}`,
              cause: String(cause),
            });
          }
        };
        const tx = storeOver(channel);
        let result: PersistenceResult<T>;
        try {
          result = await callback(tx);
        } catch (cause) {
          // The callback threw INSIDE the session: roll back before release.
          await session.query(SQL_ROLLBACK.sql, SQL_ROLLBACK.params);
          return persistenceFail<T>({
            code: 'transaction-rolled-back',
            message: 'the transaction callback threw; all effects were rolled back',
            cause: String(cause),
          });
        }
        if (!result.ok) {
          await session.query(SQL_ROLLBACK.sql, SQL_ROLLBACK.params);
          return persistenceFail<T>({
            code: 'transaction-rolled-back',
            message: 'the transaction callback failed; all effects were rolled back',
            cause: result.error.message,
          });
        }
        await session.query(SQL_COMMIT.sql, SQL_COMMIT.params);
        return result;
      });
    } catch (cause) {
      // The session channel itself failed (connect/transport level).
      return persistenceFail({
        code: 'transaction-rolled-back',
        message: 'the transaction session failed; all effects were rolled back',
        cause: String(cause),
      });
    }
  }

  async migrate(plan: MigrationPlan): Promise<PersistenceResult<MigrationOutcome>> {
    const planError = validateMigrationPlan(plan);
    if (planError !== null) return persistenceFail(planError);
    const applied: string[] = [];
    for (const step of plan.steps) {
      const statement = sqlCreateTable(step.table);
      if ('code' in statement) return persistenceFail(statement);
      const result = await this.exec(statement);
      if (!result.ok) return result;
      applied.push(step.table);
    }
    return persistenceOk({ applied, planDigest: migrationPlanDigest(plan) });
  }

  /** Drop a table (test/cleanup helper — NOT part of the SPI). */
  async dropTable(table: string): Promise<PersistenceResult<void>> {
    const statement = sqlDropTable(table);
    if ('code' in statement) return persistenceFail(statement);
    const result = await this.exec(statement);
    if (!result.ok) return result;
    return persistenceOk(undefined);
  }

  /** Execute one statement on the auto-commit channel. */
  private async exec(statement: SqlStatement): Promise<PersistenceResult<PostgresWireResult>> {
    try {
      const result = await this.wire.query(statement.sql, statement.params);
      return persistenceOk(result);
    } catch (cause) {
      return persistenceFail({
        code: 'adapter-error',
        message: `the PostgreSQL wire channel rejected a statement: ${String(cause)}`,
        cause: String(cause),
      });
    }
  }
}

/** Build a RecordStore over one execution channel (autocommit or a wire session). */
function storeOver(
  channel: (statement: SqlStatement) => Promise<PersistenceResult<PostgresWireResult>>,
): RecordStore {
  const run = async (statement: SqlStatement | PersistenceError): Promise<PersistenceResult<PostgresWireResult>> => {
    if ('code' in statement) return persistenceFail(statement);
    return channel(statement);
  };
  const insert = async (table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> => {
    const result = await run(sqlInsert(table, key, record));
    if (!result.ok) return result;
    if (result.value.rowCount === 0) {
      return persistenceFail({
        code: 'duplicate-key',
        message: `record "${key}" already exists in table "${table}"`,
        table,
        key,
      });
    }
    return persistenceOk(undefined);
  };
  const get = async (table: string, key: string): Promise<PersistenceResult<JsonValue | null>> => {
    const result = await run(sqlGet(table, key));
    if (!result.ok) return result;
    const row = result.value.rows[0];
    return persistenceOk(row === undefined ? null : decodeValue(row['value']));
  };
  const put = async (table: string, key: string, record: JsonValue): Promise<PersistenceResult<void>> => {
    const result = await run(sqlPut(table, key, record));
    if (!result.ok) return result;
    return persistenceOk(undefined);
  };
  const delete_ = async (table: string, key: string): Promise<PersistenceResult<boolean>> => {
    const result = await run(sqlDelete(table, key));
    if (!result.ok) return result;
    return persistenceOk((result.value.rowCount ?? 0) > 0);
  };
  const list = async (table: string): Promise<PersistenceResult<readonly RecordEntry[]>> => {
    const result = await run(sqlList(table));
    if (!result.ok) return result;
    return persistenceOk(
      result.value.rows.map((row: Record<string, unknown>) => ({
        key: String(row['key']),
        value: decodeValue(row['value']),
      })),
    );
  };
  return { insert, get, put, delete: delete_, list };
}

/** Decode a stored JSONB value (pg drivers return parsed JSON for jsonb columns; strings are parsed). */
function decodeValue(raw: unknown): JsonValue {
  if (typeof raw === 'string') return JSON.parse(raw) as JsonValue;
  return (raw ?? null) as JsonValue;
}
