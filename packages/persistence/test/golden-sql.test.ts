// The golden-SQL corpus: the EXACT SQL (text + parameters) the
// PostgreSQL adapter emits for every SPI operation — deterministic, no
// timestamps, no ordering noise. The corpus is committed under
// testdata/golden-sql/; this test regenerates it from the pure emission
// functions and compares byte-for-byte (update mode:
// EPOCH_UPDATE_GOLDEN_SQL=1).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
} from '../src';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = path.resolve(here, '..', 'testdata', 'golden-sql');
const UPDATE_MODE = process.env.EPOCH_UPDATE_GOLDEN_SQL === '1';

interface CorpusEntry {
  readonly operation: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly statement: { readonly sql: string; readonly params: readonly string[] };
}

function emit(statement: SqlStatement | { code: string }): CorpusEntry['statement'] {
  if ('code' in statement) throw new Error(`emission failed: ${JSON.stringify(statement)}`);
  return { sql: statement.sql, params: statement.params };
}

function buildCorpus(): readonly CorpusEntry[] {
  const record = { sessionId: 'session:golden', attempts: 2, replayed: true, meta: { origin: 'web' } };
  return [
    {
      operation: 'migrate.createTable',
      input: { table: 'gateway_sessions' },
      statement: emit(sqlCreateTable('gateway_sessions')),
    },
    {
      operation: 'insert',
      input: { table: 'gateway_idempotency', key: 'idem:golden-1', value: record },
      statement: emit(sqlInsert('gateway_idempotency', 'idem:golden-1', record)),
    },
    {
      operation: 'insert.unicode',
      input: { table: 'gateway_correlations', key: 'corr:golden-unicode', value: { city: 'Zürich — 東京 🏗️' } },
      statement: emit(sqlInsert('gateway_correlations', 'corr:golden-unicode', { city: 'Zürich — 東京 🏗️' })),
    },
    {
      operation: 'put',
      input: { table: 'gateway_idempotency', key: 'idem:golden-1', value: { attempts: 3 } },
      statement: emit(sqlPut('gateway_idempotency', 'idem:golden-1', { attempts: 3 })),
    },
    {
      operation: 'get',
      input: { table: 'gateway_idempotency', key: 'idem:golden-1' },
      statement: emit(sqlGet('gateway_idempotency', 'idem:golden-1')),
    },
    {
      operation: 'delete',
      input: { table: 'gateway_objects', key: 'obj:golden-9' },
      statement: emit(sqlDelete('gateway_objects', 'obj:golden-9')),
    },
    {
      operation: 'list',
      input: { table: 'gateway_idempotency' },
      statement: emit(sqlList('gateway_idempotency')),
    },
    { operation: 'transaction.begin', input: {}, statement: { sql: SQL_BEGIN.sql, params: [] } },
    { operation: 'transaction.commit', input: {}, statement: { sql: SQL_COMMIT.sql, params: [] } },
    { operation: 'transaction.rollback', input: {}, statement: { sql: SQL_ROLLBACK.sql, params: [] } },
    {
      operation: 'maintenance.dropTable',
      input: { table: 'gateway_objects' },
      statement: emit(sqlDropTable('gateway_objects')),
    },
  ];
}

describe('the golden-SQL corpus (W046 acceptance 4)', () => {
  const corpus = buildCorpus();

  it('the corpus is complete (every SPI operation + transaction control + maintenance)', () => {
    const operations = corpus.map((entry) => entry.operation);
    expect(operations).toContain('migrate.createTable');
    expect(operations).toContain('insert');
    expect(operations).toContain('put');
    expect(operations).toContain('get');
    expect(operations).toContain('delete');
    expect(operations).toContain('list');
    expect(operations).toContain('transaction.begin');
    expect(operations).toContain('transaction.commit');
    expect(operations).toContain('transaction.rollback');
    expect(operations.length).toBeGreaterThanOrEqual(11);
  });

  it('every statement uses $n placeholders (never interpolated values)', () => {
    for (const entry of corpus) {
      if (entry.statement.params.length === 0) continue;
      const placeholders = (entry.statement.sql.match(/\$\d+/g) ?? []).length;
      expect(placeholders, entry.operation).toBe(entry.statement.params.length);
    }
  });

  it('emission is deterministic (two builds are byte-identical)', () => {
    expect(buildCorpus()).toEqual(buildCorpus());
  });

  it('the committed corpus file matches the emission byte-for-byte', () => {
    const target = path.join(CORPUS_DIR, 'corpus.json');
    const rendered = `${JSON.stringify({ corpusVersion: 1, entries: corpus }, null, 2)}\n`;
    if (UPDATE_MODE) {
      mkdirSync(CORPUS_DIR, { recursive: true });
      writeFileSync(target, rendered);
      return;
    }
    expect(existsSync(target), 'missing committed corpus: packages/persistence/testdata/golden-sql/corpus.json').toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered);
  });

  it('malformed identifiers never reach SQL emission (typed validation)', () => {
    const bad = sqlInsert('gateway; DROP TABLE users', 'k', {});
    expect('code' in bad && bad.code).toBe('validation');
    const badKey = sqlGet('gateway_sessions', "x'; --");
    expect('code' in badKey && badKey.code).toBe('validation');
  });
});
