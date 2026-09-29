/**
 * @epoch/persistence — the SHARED conformance suite.
 *
 * `persistenceConformanceCases(factory)` returns the complete case set
 * every PersistenceSession implementation must pass. The in-memory test
 * runs it against `InMemoryPersistence`; the PostgreSQL adapter test
 * runs the SAME cases against the adapter over a recording wire port;
 * the real-engine suite (services/application-gateway) runs it against
 * the adapter over an embedded real PostgreSQL engine (PGlite) — the
 * same adapter code passes every suite (W046 pin 4).
 *
 * Deterministic: fixed keys, fixed values, fixed order expectations.
 */
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import type { PersistenceSession } from './spi';

/** Order-insensitive value equality (canonical JSON on both sides). */
const sameJson = (a: unknown, b: unknown): boolean => canonicalJsonStringify(a as never) === canonicalJsonStringify(b as never);

/** One conformance case. */
export interface ConformanceCase {
  readonly name: string;
  readonly group: string;
  run(): Promise<void>;
}

/** The factory of fresh sessions (each case gets its own session). */
export type SessionFactory = () => PersistenceSession | Promise<PersistenceSession>;

/** The conformance table plan (migrated idempotently before every case). */
const CONFORMANCE_TABLE_PLAN = {
  steps: [
    { version: 1, table: 'gateway_sessions', description: 'conformance sessions table' },
    { version: 2, table: 'gateway_idempotency', description: 'conformance idempotency table' },
    { version: 3, table: 'gateway_correlations', description: 'conformance correlations table' },
    { version: 4, table: 'gateway_objects', description: 'conformance objects table' },
  ],
} as const;

/** Build the full conformance case set for a session factory. */
export function persistenceConformanceCases(factory: SessionFactory): readonly ConformanceCase[] {
  // Real engines do NOT auto-create tables: every case's session is
  // migrated (idempotently) before use — the same setup for every
  // implementation.
  const session = async (): Promise<PersistenceSession> => {
    const created = await Promise.resolve(factory()).then((value) => value);
    const migrated = await created.migrate(CONFORMANCE_TABLE_PLAN);
    if (!migrated.ok) {
      throw new Error(`conformance migration failed: ${migrated.error.message}`);
    }
    return created;
  };

  const cases: ConformanceCase[] = [
    // -- Basic record round-trips.
    {
      name: 'put + get round-trips a canonical JSON record',
      group: 'records',
      async run() {
        const s = await session();
        const record: JsonValue = { name: 'globex', count: 42, active: true, nested: { ids: ['a', 'b'] } };
        const put = await s.put('gateway_sessions', 'session:conf-1', record);
        if (!put.ok) throw new Error(`put failed: ${put.error.message}`);
        const got = await s.get('gateway_sessions', 'session:conf-1');
        if (!got.ok) throw new Error(`get failed: ${got.error.message}`);
        if (!sameJson(got.value, record)) {
          throw new Error(`round-trip mismatch: ${JSON.stringify(got.value)}`);
        }
      },
    },
    {
      name: 'get of a missing key is null (never an error)',
      group: 'records',
      async run() {
        const s = await session();
        const got = await s.get('gateway_sessions', 'session:never-there');
        if (!got.ok) throw new Error(`get failed: ${got.error.message}`);
        if (got.value !== null) throw new Error('missing key must read as null');
      },
    },
    {
      name: 'insert then insert again fails typed duplicate-key',
      group: 'records',
      async run() {
        const s = await session();
        const first = await s.insert('gateway_idempotency', 'idem:conf-1', { n: 1 });
        if (!first.ok) throw new Error(`insert failed: ${first.error.message}`);
        const second = await s.insert('gateway_idempotency', 'idem:conf-1', { n: 2 });
        if (second.ok) throw new Error('duplicate insert must fail');
        if (second.error.code !== 'duplicate-key') throw new Error(`wrong code: ${second.error.code}`);
        // And the original value is untouched.
        const got = await s.get('gateway_idempotency', 'idem:conf-1');
        if (!got.ok || !sameJson(got.value, { n: 1 })) {
          throw new Error('duplicate insert must not overwrite');
        }
      },
    },
    {
      name: 'put upserts (replaces) an existing record',
      group: 'records',
      async run() {
        const s = await session();
        await s.put('gateway_correlations', 'corr:conf-1', { attempts: 1 });
        const replaced = await s.put('gateway_correlations', 'corr:conf-1', { attempts: 2 });
        if (!replaced.ok) throw new Error(`put failed: ${replaced.error.message}`);
        const got = await s.get('gateway_correlations', 'corr:conf-1');
        if (!got.ok || !sameJson(got.value, { attempts: 2 })) {
          throw new Error('put must replace');
        }
      },
    },
    {
      name: 'delete reports absence and removes presence',
      group: 'records',
      async run() {
        const s = await session();
        const absent = await s.delete('gateway_objects', 'obj:conf-none');
        if (!absent.ok || absent.value !== false) throw new Error('absent delete must be false');
        await s.put('gateway_objects', 'obj:conf-1', { digest: 'a'.repeat(64) });
        const present = await s.delete('gateway_objects', 'obj:conf-1');
        if (!present.ok || present.value !== true) throw new Error('present delete must be true');
        const gone = await s.get('gateway_objects', 'obj:conf-1');
        if (!gone.ok || gone.value !== null) throw new Error('deleted record must read as null');
      },
    },
    {
      name: 'list returns every record sorted by key ascending',
      group: 'records',
      async run() {
        const s = await session();
        for (const key of ['idem:zzz', 'idem:aaa', 'idem:mmm']) {
          await s.put('gateway_idempotency', key, { key });
        }
        const listed = await s.list('gateway_idempotency');
        if (!listed.ok) throw new Error(`list failed: ${listed.error.message}`);
        const keys = listed.value.map((entry) => entry.key);
        if (JSON.stringify(keys) !== JSON.stringify(['idem:aaa', 'idem:mmm', 'idem:zzz'])) {
          throw new Error(`list must be sorted: ${JSON.stringify(keys)}`);
        }
      },
    },
    {
      name: 'tables are isolated (same key, different tables)',
      group: 'records',
      async run() {
        const s = await session();
        await s.put('gateway_sessions', 'shared-key', { table: 'sessions' });
        await s.put('gateway_idempotency', 'shared-key', { table: 'idempotency' });
        const a = await s.get('gateway_sessions', 'shared-key');
        const b = await s.get('gateway_idempotency', 'shared-key');
        if (!a.ok || !sameJson(a.value, { table: 'sessions' })) throw new Error('table isolation broken (a)');
        if (!b.ok || !sameJson(b.value, { table: 'idempotency' })) throw new Error('table isolation broken (b)');
      },
    },
    {
      name: 'malformed table names fail typed validation (injection guard)',
      group: 'validation',
      async run() {
        const s = await session();
        const bad = await s.put('gateway; DROP TABLE users', 'key', {});
        if (bad.ok) throw new Error('malformed table must fail');
        if (bad.error.code !== 'validation') throw new Error(`wrong code: ${bad.error.code}`);
        const badKey = await s.put('gateway_sessions', "'; DELETE FROM x WHERE '1'='1", {});
        if (badKey.ok) throw new Error('malformed key must fail');
        if (badKey.error.code !== 'validation') throw new Error(`wrong key code: ${badKey.error.code}`);
      },
    },
    {
      name: 'unicode + numeric values round-trip byte-stably',
      group: 'records',
      async run() {
        const s = await session();
        const record: JsonValue = { unicode: 'Zürich — 東京 🏗️', numbers: [0, 1, -1, 0.5, 1e12], nullish: null };
        await s.put('gateway_sessions', 'session:conf-unicode', record);
        const got = await s.get('gateway_sessions', 'session:conf-unicode');
        if (!got.ok) throw new Error(`get failed: ${got.error.message}`);
        if (!sameJson(got.value, record)) throw new Error('unicode round-trip mismatch');
      },
    },
    // -- Transactions.
    {
      name: 'a successful transaction commits all effects',
      group: 'transactions',
      async run() {
        const s = await session();
        const tx = await s.transaction(async (store) => {
          await store.put('gateway_idempotency', 'idem:tx-1', { step: 1 });
          await store.put('gateway_idempotency', 'idem:tx-2', { step: 2 });
          return { ok: true as const, value: 'committed' };
        });
        if (!tx.ok) throw new Error(`transaction failed: ${tx.error.message}`);
        const one = await s.get('gateway_idempotency', 'idem:tx-1');
        const two = await s.get('gateway_idempotency', 'idem:tx-2');
        if (!one.ok || !sameJson(one.value, { step: 1 })) throw new Error('tx effect 1 missing');
        if (!two.ok || !sameJson(two.value, { step: 2 })) throw new Error('tx effect 2 missing');
      },
    },
    {
      name: 'a thrown transaction callback rolls ALL effects back (typed error)',
      group: 'transactions',
      async run() {
        const s = await session();
        await s.put('gateway_idempotency', 'idem:tx-pre', { before: true });
        const tx = await s.transaction(async (store) => {
          await store.put('gateway_idempotency', 'idem:tx-throw', { applied: true });
          throw new Error('boom');
        });
        if (tx.ok) throw new Error('throwing transaction must fail');
        if (tx.error.code !== 'transaction-rolled-back') throw new Error(`wrong code: ${tx.error.code}`);
        const applied = await s.get('gateway_idempotency', 'idem:tx-throw');
        if (!applied.ok || applied.value !== null) throw new Error('rolled-back effect must not be visible');
        const before = await s.get('gateway_idempotency', 'idem:tx-pre');
        if (!before.ok || !sameJson(before.value, { before: true })) {
          throw new Error('rollback must not affect prior state');
        }
      },
    },
    {
      name: 'a FAILED transaction callback rolls ALL effects back (all-or-nothing)',
      group: 'transactions',
      async run() {
        const s = await session();
        const tx = await s.transaction(async (store) => {
          await store.put('gateway_idempotency', 'idem:tx-fail', { applied: true });
          return { ok: false as const, error: { code: 'validation' as const, message: 'rejected by the callback' } };
        });
        if (tx.ok) throw new Error('failed transaction must fail');
        if (tx.error.code !== 'transaction-rolled-back') throw new Error(`wrong code: ${tx.error.code}`);
        const applied = await s.get('gateway_idempotency', 'idem:tx-fail');
        if (!applied.ok || applied.value !== null) throw new Error('failed-callback effect must be rolled back');
      },
    },
    // -- Migrations.
    {
      name: 'a migration plan introduces its tables (idempotent)',
      group: 'migrations',
      async run() {
        const s = await session();
        const plan = {
          steps: [
            { version: 1, table: 'gateway_sessions', description: 'sessions table' },
            { version: 2, table: 'gateway_idempotency', description: 'idempotency table' },
          ],
        };
        const first = await s.migrate(plan);
        if (!first.ok) throw new Error(`migrate failed: ${first.error.message}`);
        // Idempotent: applying again succeeds with the same digest.
        const again = await s.migrate(plan);
        if (!again.ok) throw new Error(`re-migrate failed: ${again.error.message}`);
        if (again.value.planDigest !== first.value.planDigest) throw new Error('plan digest must be stable');
        // The tables are usable.
        await s.put('gateway_sessions', 'session:conf-migrated', { ok: true });
        const got = await s.get('gateway_sessions', 'session:conf-migrated');
        if (!got.ok || !sameJson(got.value, { ok: true })) {
          throw new Error('migrated table must be usable');
        }
      },
    },
    {
      name: 'a malformed migration plan fails typed validation',
      group: 'migrations',
      async run() {
        const s = await session();
        const bad = await s.migrate({
          steps: [
            { version: 2, table: 'gateway_sessions', description: 'out of order' },
            { version: 1, table: 'gateway_idempotency', description: 'not increasing' },
          ],
        });
        if (bad.ok) throw new Error('malformed plan must fail');
        if (bad.error.code !== 'validation') throw new Error(`wrong code: ${bad.error.code}`);
      },
    },
  ];
  return cases;
}
