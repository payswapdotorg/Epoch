// The PostgreSQL adapter over a RECORDING wire port: proves the adapter's
// wire behavior — the exact statement sequences it drives for composite
// flows (transactions: BEGIN ... COMMIT / ROLLBACK), duplicate detection
// via rowCount, and typed error mapping. The same adapter code runs
// against a REAL engine in the service-layer pglite suite (W046 pin 4).
import { describe, expect, it } from 'vitest';
import {
  PostgresPersistence,
  type PostgresWirePort,
  type PostgresWireResult,
  type PostgresWireSession,
} from '../src';

interface RecordedCall {
  readonly text: string;
  readonly values: readonly unknown[];
}

/** A deterministic recording wire port with scripted results. */
class RecordingWire implements PostgresWirePort {
  public readonly autoCommitCalls: RecordedCall[] = [];
  public readonly sessionCalls: RecordedCall[] = [];
  /** Scripted responses, matched by statement prefix in order. */
  public readonly scripted: Array<{ readonly match: string; readonly result: PostgresWireResult }> = [];

  private scriptNext(result: PostgresWireResult): void {
    this.scripted.push({ match: '', result });
  }

  static with(...results: PostgresWireResult[]): RecordingWire {
    const wire = new RecordingWire();
    for (const result of results) wire.scriptNext(result);
    return wire;
  }

  async query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> {
    this.autoCommitCalls.push({ text, values: values ?? [] });
    return this.nextScripted();
  }

  async withSession<T>(callback: (session: PostgresWireSession) => Promise<T>): Promise<T> {
    const session: PostgresWireSession = {
      query: async (text: string, values?: readonly unknown[]) => {
        this.sessionCalls.push({ text, values: values ?? [] });
        return this.nextScripted();
      },
    };
    return callback(session);
  }

  private nextScripted(): PostgresWireResult {
    const next = this.scripted.shift();
    if (next === undefined) return { rows: [], rowCount: 0 };
    return next.result;
  }
}

const EMPTY: PostgresWireResult = { rows: [], rowCount: 0 };
const AFFECTED: PostgresWireResult = { rows: [], rowCount: 1 };

describe('the PostgreSQL adapter over a recording wire port', () => {
  it('put emits exactly the upsert statement with canonical-JSON params', async () => {
    const wire = RecordingWire.with(AFFECTED);
    const adapter = new PostgresPersistence(wire);
    const result = await adapter.put('gateway_idempotency', 'idem:rec-1', { attempts: 1 });
    expect(result.ok).toBe(true);
    expect(wire.autoCommitCalls).toHaveLength(1);
    const call = wire.autoCommitCalls[0]!;
    expect(call.text).toBe(
      'INSERT INTO "gateway_idempotency" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
    );
    expect(call.values).toEqual(['idem:rec-1', '{"attempts":1}']);
  });

  it('insert detects duplicates via rowCount=0 with the typed duplicate-key error', async () => {
    const wire = RecordingWire.with(EMPTY); // conflict -> DO NOTHING -> 0 rows
    const adapter = new PostgresPersistence(wire);
    const result = await adapter.insert('gateway_idempotency', 'idem:rec-2', { n: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('duplicate-key');
      expect(result.error.key).toBe('idem:rec-2');
    }
  });

  it('get maps a selected row (JSONB arrives parsed) and absence to null', async () => {
    const hit: PostgresWireResult = { rows: [{ key: 'session:rec-1', value: { principalId: 'principal:p1' } }], rowCount: 1 };
    const wire = RecordingWire.with(hit, EMPTY);
    const adapter = new PostgresPersistence(wire);
    const found = await adapter.get('gateway_sessions', 'session:rec-1');
    expect(found.ok && found.value).toEqual({ principalId: 'principal:p1' });
    const missing = await adapter.get('gateway_sessions', 'session:none');
    expect(missing.ok && missing.value).toBeNull();
    // jsonb as a TEXT (string) form also decodes.
    const textEncoded: PostgresWireResult = { rows: [{ value: '{"k":true}' }], rowCount: 1 };
    const wire2 = RecordingWire.with(textEncoded);
    const adapter2 = new PostgresPersistence(wire2);
    const parsed = await adapter2.get('gateway_sessions', 'session:rec-2');
    expect(parsed.ok && parsed.value).toEqual({ k: true });
  });

  it('delete maps rowCount>0 to true, 0 to false', async () => {
    const wire = RecordingWire.with(AFFECTED, EMPTY);
    const adapter = new PostgresPersistence(wire);
    const present = await adapter.delete('gateway_objects', 'obj:rec-1');
    expect(present.ok && present.value).toBe(true);
    const absent = await adapter.delete('gateway_objects', 'obj:rec-2');
    expect(absent.ok && absent.value).toBe(false);
  });

  it('a successful transaction drives BEGIN, the statements, then COMMIT — in order', async () => {
    const wire = new RecordingWire();
    // BEGIN -> put -> COMMIT (scripted results in call order).
    wire.scripted.push({ match: '', result: AFFECTED });
    wire.scripted.push({ match: '', result: AFFECTED });
    wire.scripted.push({ match: '', result: AFFECTED });
    const adapter = new PostgresPersistence(wire);
    const tx = await adapter.transaction(async (store) => {
      await store.put('gateway_idempotency', 'idem:tx-1', { step: 1 });
      return { ok: true as const, value: 'done' };
    });
    expect(tx.ok && tx.value).toBe('done');
    const texts = wire.sessionCalls.map((call) => call.text);
    expect(texts).toEqual([
      'BEGIN',
      'INSERT INTO "gateway_idempotency" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
      'COMMIT',
    ]);
    expect(wire.autoCommitCalls).toHaveLength(0); // everything ran on the dedicated session
  });

  it('a failed transaction callback drives BEGIN, statements, ROLLBACK — and surfaces the typed error', async () => {
    const wire = new RecordingWire();
    wire.scripted.push({ match: '', result: AFFECTED }); // BEGIN
    wire.scripted.push({ match: '', result: AFFECTED }); // put
    wire.scripted.push({ match: '', result: AFFECTED }); // ROLLBACK
    const adapter = new PostgresPersistence(wire);
    const tx = await adapter.transaction(async (store) => {
      await store.put('gateway_idempotency', 'idem:tx-2', { step: 1 });
      return { ok: false as const, error: { code: 'validation' as const, message: 'callback rejected' } };
    });
    expect(tx.ok).toBe(false);
    if (!tx.ok) {
      expect(tx.error.code).toBe('transaction-rolled-back');
      expect(tx.error.cause).toBe('callback rejected');
    }
    const texts = wire.sessionCalls.map((call) => call.text);
    expect(texts).toEqual([
      'BEGIN',
      'INSERT INTO "gateway_idempotency" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"',
      'ROLLBACK',
    ]);
  });

  it('a thrown callback drives ROLLBACK and maps to the typed rolled-back error', async () => {
    const wire = new RecordingWire();
    wire.scripted.push({ match: '', result: AFFECTED }); // BEGIN
    wire.scripted.push({ match: '', result: AFFECTED }); // put
    wire.scripted.push({ match: '', result: AFFECTED }); // ROLLBACK (session path)
    wire.scripted.push({ match: '', result: AFFECTED }); // fallback rollback on the autocommit channel
    const adapter = new PostgresPersistence(wire);
    const tx = await adapter.transaction(async () => {
      throw new Error('wire exploded');
    });
    expect(tx.ok).toBe(false);
    if (!tx.ok) {
      expect(tx.error.code).toBe('transaction-rolled-back');
      expect(tx.error.cause).toContain('wire exploded');
    }
    const sessionTexts = wire.sessionCalls.map((call) => call.text);
    expect(sessionTexts[0]).toBe('BEGIN');
    expect(sessionTexts.includes('ROLLBACK') || wire.autoCommitCalls.some((call) => call.text === 'ROLLBACK')).toBe(true);
  });

  it('wire transport failures map to the typed adapter-error (never throw)', async () => {
    const wire = new RecordingWire();
    // Empty script -> RecordingWire returns EMPTY; instead force a throw:
    const exploding: PostgresWirePort = {
      query: async () => {
        throw new Error('ECONNREFUSED');
      },
      withSession: async () => {
        throw new Error('ECONNREFUSED');
      },
    };
    const dead = new PostgresPersistence(exploding);
    const result = await dead.put('gateway_idempotency', 'idem:dead', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('adapter-error');
    expect(wire.autoCommitCalls).toHaveLength(0);
  });

  it('migrate emits one CREATE TABLE IF NOT EXISTS per step, in plan order', async () => {
    const wire = new RecordingWire();
    wire.scripted.push({ match: '', result: AFFECTED });
    wire.scripted.push({ match: '', result: AFFECTED });
    const adapter = new PostgresPersistence(wire);
    const outcome = await adapter.migrate({
      steps: [
        { version: 1, table: 'gateway_sessions', description: 'sessions' },
        { version: 2, table: 'gateway_idempotency', description: 'idempotency' },
      ],
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.applied).toEqual(['gateway_sessions', 'gateway_idempotency']);
      expect(outcome.value.planDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(wire.autoCommitCalls.map((call) => call.text)).toEqual([
      'CREATE TABLE IF NOT EXISTS "gateway_sessions" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL)',
      'CREATE TABLE IF NOT EXISTS "gateway_idempotency" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL)',
    ]);
  });

  it('table/key grammar violations fail typed BEFORE any wire interaction', async () => {
    const wire = new RecordingWire();
    const adapter = new PostgresPersistence(wire);
    const bad = await adapter.put('gateway sessions', 'k', {});
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('validation');
    expect(wire.autoCommitCalls).toHaveLength(0);
    expect(wire.sessionCalls).toHaveLength(0);
  });
});
