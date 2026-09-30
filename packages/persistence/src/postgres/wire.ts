/**
 * @epoch/persistence — the PostgreSQL wire port (the driver-neutral
 * transport contract; the ONLY place the driver's API shape appears).
 *
 * The port structurally matches the pg 8.23.0 driver API:
 *  - `query(text, values)` — the parameterized statement channel
 *    (pg: Pool.query / Client.query);
 *  - `withSession(fn)` — a dedicated connection scope for transactions
 *    (pg: pool.connect() -> client -> release(); pglite: the single
 *    connection, trivially scoped).
 *
 * THIS PACKAGE NEVER IMPORTS THE DRIVER: `pg` binding is service-layer
 * only (services/application-gateway; enforced by the W046 pg-boundary
 * test). The port is duck-typed — `bindPgPool` in the service adapts a
 * pg Pool, `bindPgliteEngine` adapts an embedded PGlite engine.
 */

/** One wire result row (column name -> value). */
export interface PostgresWireRow {
  readonly [column: string]: unknown;
}

/** One wire result (the pg query result shape). */
export interface PostgresWireResult {
  readonly rows: readonly PostgresWireRow[];
  readonly rowCount: number | null;
}

/** One dedicated-connection session (transaction scope). */
export interface PostgresWireSession {
  query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult>;
}

/**
 * The wire port: an auto-commit statement channel + a dedicated-session
 * scope for transactions. Implementations MUST deliver statements in
 * order within a session.
 */
export interface PostgresWirePort {
  /** Execute one statement on the auto-commit channel. */
  query(text: string, values?: readonly unknown[]): Promise<PostgresWireResult>;
  /** Run a callback on a dedicated connection (transactions drive BEGIN/COMMIT/ROLLBACK themselves). */
  withSession<T>(callback: (session: PostgresWireSession) => Promise<T>): Promise<T>;
}

/** A transport-level failure (transient class; carries the driver message). */
export class PostgresWireError extends Error {
  constructor(
    message: string,
    readonly causeText: string,
  ) {
    super(message);
    this.name = 'PostgresWireError';
  }
}
