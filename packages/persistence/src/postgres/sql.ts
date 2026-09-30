/**
 * @epoch/persistence — deterministic PostgreSQL SQL emission.
 *
 * PURE functions: every SPI operation maps to EXACTLY one statement (or
 * an ordered statement sequence for transactions) with $n placeholders
 * and canonical-JSON value encoding. This is the golden-SQL corpus
 * source: the corpus (testdata/golden-sql) pins these emissions
 * byte-for-byte — no timestamps, no ordering noise (list is ORDER BY
 * key ASC), no identifier interpolation (table/key names are validated
 * against their grammars and emitted as double-quoted identifiers).
 */
import { canonicalJsonStringify } from '@epoch/agent-protocol';
import { validateRecordKey, validateTableName } from '../spi';
import type { PersistenceError } from '../version';

/** One emitted statement (the wire form). */
export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly string[];
}

const guarded = (table: string, key?: string): PersistenceError | null => {
  const tableError = validateTableName(table);
  if (tableError !== null) return tableError;
  if (key !== undefined) {
    const keyError = validateRecordKey(key);
    if (keyError !== null) return keyError;
  }
  return null;
};

/** CREATE TABLE IF NOT EXISTS for one record table (idempotent DDL). */
export function sqlCreateTable(table: string): SqlStatement | PersistenceError {
  const guard = guarded(table);
  if (guard !== null) return guard;
  return {
    sql: `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL)`,
    params: [],
  };
}

/** DROP TABLE IF EXISTS (test/cleanup only). */
export function sqlDropTable(table: string): SqlStatement | PersistenceError {
  const guard = guarded(table);
  if (guard !== null) return guard;
  return { sql: `DROP TABLE IF EXISTS ${quoteIdent(table)}`, params: [] };
}

/** INSERT ... ON CONFLICT DO NOTHING (insert semantics; duplicate detection by rowCount). */
export function sqlInsert(table: string, key: string, value: unknown): SqlStatement | PersistenceError {
  const guard = guarded(table, key);
  if (guard !== null) return guard;
  return {
    sql: `INSERT INTO ${quoteIdent(table)} ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING`,
    params: [key, encodeValue(value)],
  };
}

/** INSERT ... ON CONFLICT DO UPDATE (upsert semantics). */
export function sqlPut(table: string, key: string, value: unknown): SqlStatement | PersistenceError {
  const guard = guarded(table, key);
  if (guard !== null) return guard;
  return {
    sql: `INSERT INTO ${quoteIdent(table)} ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"`,
    params: [key, encodeValue(value)],
  };
}

/** SELECT value by exact key. */
export function sqlGet(table: string, key: string): SqlStatement | PersistenceError {
  const guard = guarded(table, key);
  if (guard !== null) return guard;
  return { sql: `SELECT "value" FROM ${quoteIdent(table)} WHERE "key" = $1`, params: [key] };
}

/** DELETE by exact key (absence detected by rowCount). */
export function sqlDelete(table: string, key: string): SqlStatement | PersistenceError {
  const guard = guarded(table, key);
  if (guard !== null) return guard;
  return { sql: `DELETE FROM ${quoteIdent(table)} WHERE "key" = $1`, params: [key] };
}

/** SELECT all records, deterministic order (ORDER BY key ASC). */
export function sqlList(table: string): SqlStatement | PersistenceError {
  const guard = guarded(table);
  if (guard !== null) return guard;
  return { sql: `SELECT "key", "value" FROM ${quoteIdent(table)} ORDER BY "key" ASC`, params: [] };
}

/** BEGIN (transaction open). */
export const SQL_BEGIN: SqlStatement = { sql: 'BEGIN', params: [] };

/** COMMIT (transaction commit). */
export const SQL_COMMIT: SqlStatement = { sql: 'COMMIT', params: [] };

/** ROLLBACK (transaction abort). */
export const SQL_ROLLBACK: SqlStatement = { sql: 'ROLLBACK', params: [] };

/** Double-quoted SQL identifier (validated names only; the quote guard for the injection surface). */
export function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** Canonical-JSON value encoding (byte-stable across implementations). */
export function encodeValue(value: unknown): string {
  return canonicalJsonStringify(value as never);
}
