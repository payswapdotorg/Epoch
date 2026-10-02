/**
 * @epoch/application-gateway — the PostgreSQL driver binding (SERVICE
 * LAYER ONLY).
 *
 * W046 pin 5: "no packages/* or apps/* may import pg directly; only
 * services/application-gateway (and its adapters) bind the driver."
 * The catalog pin for `pg` 8.23.0 was declared by the Tech Lead intake
 * (PR #99, scripts/DEPENDENCY-BASELINE.md) but the mechanical
 * pnpm-workspace.yaml catalog entries did NOT land with it; per the
 * baseline's own missing-dependency procedure this package therefore
 * does NOT reference the npm module at all — the binding is STRUCTURAL
 * (duck-typed against the pg 8.23.0 client API). The deployment injects
 * the instantiated driver object (`bindPgPool(new Pool(...))`); the
 * moment the catalog entry materializes (Tech Lead foundation branch),
 * the same call sites bind the real module with ZERO changes here.
 *
 * The pg-boundary test (test/pg-boundary.test.ts) enforces the rule:
 * no file outside services/application-gateway references 'pg' or
 * '@electric-sql/pglite', and the binding seam exists only here.
 */
import type { PostgresWirePort, PostgresWireResult } from '@epoch/persistence';

/**
 * The structural shape of the pg 8.23.0 driver pool (duck-typed): the
 * binding accepts any object satisfying it — the real `pg` Pool, a test
 * double, or a PGlite engine wrapped the same way.
 */
export interface PgPoolLike {
  query(text: string, values?: readonly unknown[]): Promise<PgQueryResultLike>;
  connect(): Promise<PgClientLike>;
}

export interface PgClientLike {
  query(text: string, values?: readonly unknown[]): Promise<PgQueryResultLike>;
  release(): void;
}

export interface PgQueryResultLike {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number | null;
}

/**
 * Bind a pg 8.23.0 pool to the neutral wire port. `query` rides the
 * pool's auto-commit channel; `withSession` checks out a dedicated
 * client for transactions (BEGIN/COMMIT/ROLLBACK) and always releases.
 */
export function bindPgPool(pool: PgPoolLike): PostgresWirePort {
  return {
    async query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> {
      const result = await pool.query(text, values);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async withSession<T>(callback: (session: { query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> }) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        const session = {
          async query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> {
            const result = await client.query(text, values);
            return { rows: result.rows, rowCount: result.rowCount };
          },
        };
        return await callback(session);
      } finally {
        client.release();
      }
    },
  };
}

/**
 * The structural shape of a PGlite engine (TEST-ONLY binding; mirrors
 * @electric-sql/pglite 0.5.8's public `query` API).
 */
export interface PgliteEngineLike {
  query(text: string, params?: readonly unknown[]): Promise<PgQueryResultLike>;
}

/**
 * Bind a PGlite engine to the neutral wire port (TEST-ONLY: embedded
 * real PostgreSQL for the adapter's real-engine suites). PGlite is a
 * single connection: `withSession` runs inline (transactions drive
 * BEGIN/COMMIT/ROLLBACK themselves on that connection).
 */
export function bindPgliteEngine(engine: PgliteEngineLike): PostgresWirePort {
  return {
    async query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> {
      const result = await engine.query(text, values);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async withSession<T>(callback: (session: { query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> }) => Promise<T>): Promise<T> {
      const session = {
        async query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult> {
          const result = await engine.query(text, values);
          return { rows: result.rows, rowCount: result.rowCount };
        },
      };
      return callback(session);
    },
  };
}

/** The module specifier of the real driver (never imported here; documented binding target). */
export const PG_DRIVER_MODULE = 'pg';

/** The module specifier of the TEST-ONLY embedded engine (never imported here). */
export const PGLITE_MODULE = '@electric-sql/pglite';

/**
 * A live pg pool (the structural pool shape + lifecycle close), returned
 * by `connectPostgresPool` (W051 foundation, ACR-006).
 */
export interface ConnectedPostgresPool extends PgPoolLike {
  /** Drain the pool (graceful shutdown / tests). */
  end(): Promise<void>;
}

/** Options of `connectPostgresPool` (pass-through to the pg 8.23.0 Pool). */
export interface ConnectPostgresPoolOptions {
  /**
   * Explicit TLS options. When absent, the connection string governs
   * (Neon URLs carry their own sslmode; pg parses it).
   */
  readonly ssl?: boolean | { readonly rejectUnauthorized?: boolean } | undefined;
  /** Pool sizing (defaults: the pg driver's own). */
  readonly max?: number | undefined;
  /** Idle timeout milliseconds (defaults: the pg driver's own). */
  readonly idleTimeoutMillis?: number | undefined;
  /** Connect timeout milliseconds (defaults: the pg driver's own). */
  readonly connectionTimeoutMillis?: number | undefined;
}

/**
 * Instantiate the REAL pg 8.23.0 pool from a connection string (W051
 * foundation, ACR-006). The catalog pin materialized at exactly its
 * documented consumer (this package — still the ONLY pg binding point);
 * deployments (apps/web production binding) call this factory and pass
 * the result to `bindPgPool`. The pool connects LAZILY (first query),
 * so construction never performs I/O. Serverless-friendly: the caller
 * caches the pool (e.g. on globalThis) across invocations.
 */
export async function connectPostgresPool(
  connectionString: string,
  options: ConnectPostgresPoolOptions = {},
): Promise<ConnectedPostgresPool> {
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('connectPostgresPool: a non-empty connection string is required');
  }
  const mod = (await import(PG_DRIVER_MODULE)) as unknown as {
    default?: { Pool?: new (config: Record<string, unknown>) => ConnectedPostgresPool };
    Pool?: new (config: Record<string, unknown>) => ConnectedPostgresPool;
  };
  const Pool = mod.Pool ?? mod.default?.Pool;
  if (Pool === undefined) {
    throw new Error('connectPostgresPool: the pg driver module did not export Pool');
  }
  const config: Record<string, unknown> = { connectionString };
  if (options.ssl !== undefined) config['ssl'] = options.ssl;
  if (options.max !== undefined) config['max'] = options.max;
  if (options.idleTimeoutMillis !== undefined) config['idleTimeoutMillis'] = options.idleTimeoutMillis;
  if (options.connectionTimeoutMillis !== undefined) config['connectionTimeoutMillis'] = options.connectionTimeoutMillis;
  return new Pool(config);
}
