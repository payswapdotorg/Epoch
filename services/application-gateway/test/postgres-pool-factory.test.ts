/**
 * W051 foundation (ACR-006) — the real pg driver materialization tests:
 * `connectPostgresPool` constructs the REAL pg 8.23.0 pool lazily (no
 * I/O at construction), composes with `bindPgPool`, and validates its
 * inputs. No network: pg pools connect on first query only.
 */
import { describe, expect, it } from 'vitest';
import { bindPgPool, connectPostgresPool } from '../src/postgres-binding';

describe('connectPostgresPool (the real pg driver factory, W051 foundation)', () => {
  it('constructs a real pool from a connection string WITHOUT connecting (lazy)', async () => {
    const pool = await connectPostgresPool('postgres://user:pass@example.invalid:5432/db');
    expect(typeof pool.query).toBe('function');
    expect(typeof pool.connect).toBe('function');
    expect(typeof pool.end).toBe('function');
    await pool.end();
  });

  it('accepts pool/TLS options without I/O', async () => {
    const pool = await connectPostgresPool('postgres://user:pass@example.invalid:5432/db', {
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 2_000,
    });
    expect(typeof pool.query).toBe('function');
    await pool.end();
  });

  it('rejects an empty connection string (fail-closed validation)', async () => {
    await expect(connectPostgresPool('')).rejects.toThrow(/non-empty connection string/);
  });

  it('composes with bindPgPool (the neutral wire port over the real driver)', async () => {
    const pool = await connectPostgresPool('postgres://user:pass@example.invalid:5432/db');
    const wire = bindPgPool(pool);
    expect(typeof wire.query).toBe('function');
    expect(typeof wire.withSession).toBe('function');
    await pool.end();
  });
});
