# The Persistence SPI (W046)

Provider-neutral durable-state seam between the Application Gateway and PostgreSQL. **PostgreSQL is the durable authority when the adapter is bound** (ACR-005); object bytes stay in `@epoch/object-storage`.

## The SPI (`packages/persistence/src/spi.ts`)

Typed RECORD-STORE primitives — deliberately NOT SQL-shaped (SQL emission is the PostgreSQL adapter's business, pinned by the golden-SQL corpus):

| Primitive | Semantics |
|---|---|
| `insert(table, key, record)` | Fails typed `duplicate-key` when the key exists. |
| `get(table, key)` | Fetch a canonical-JSON record (`null` when absent). |
| `put(table, key, record)` | Upsert (insert-or-replace). |
| `delete(table, key)` | `false` when the key was absent. |
| `list(table)` | All records, **sorted by key ascending** (zero ordering noise). |
| `transaction(callback)` | All-or-nothing: COMMIT only when the callback resolves ok; ROLLBACK on failure or throw (typed `transaction-rolled-back` carrying the cause). |
| `migrate(plan)` | Idempotent versioned table introductions (CREATE IF NOT EXISTS semantics; plan digest-addressed). |

Values are canonical JSON (stable key order — digests over stored values are byte-stable across implementations). Table and key names are grammar-validated BEFORE any storage interaction (the injection guard is provider-neutral; values are parametrized, never interpolated).

## Two implementations of the SAME contract

1. **`InMemoryPersistence`** — the deterministic reference (transactions clone state).
2. **`PostgresPersistence`** — the real PostgreSQL adapter: complete wire-protocol SQL emission (exact statement text, `$n` placeholders, canonical-JSON value encoding, `BEGIN`/`COMMIT`/`ROLLBACK` transaction driving on a dedicated connection, `JSONB` DDL) over an injected **`PostgresWirePort`**.

The **shared conformance suite** (`persistenceConformanceCases`) runs identically against both implementations: record round-trips, duplicate detection, upserts, deletes, sorted listing, table isolation, grammar rejection, unicode round-trips, transaction commit/rollback (thrown AND failed callbacks), and idempotent migrations.

## The golden-SQL corpus (`packages/persistence/testdata/golden-sql/`)

The corpus pins the EXACT SQL the adapter emits for every SPI operation — statement text + parameters, byte-for-byte, deterministic (no timestamps, no ordering noise; `list` is `ORDER BY "key" ASC`). The corpus test regenerates from the pure emission functions (`src/postgres/sql.ts`) and compares; update mode is `EPOCH_UPDATE_GOLDEN_SQL=1`.

```sql
CREATE TABLE IF NOT EXISTS "gateway_sessions" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL)
INSERT INTO "gateway_idempotency" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING
INSERT INTO "gateway_idempotency" ("key", "value") VALUES ($1, $2) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
SELECT "value" FROM "gateway_idempotency" WHERE "key" = $1
DELETE FROM "gateway_objects" WHERE "key" = $1
SELECT "key", "value" FROM "gateway_idempotency" ORDER BY "key" ASC
BEGIN / COMMIT / ROLLBACK
```

## The wire port and the pg binding policy (service-layer ONLY)

`PostgresWirePort` is the driver-neutral transport contract (the ONLY place the driver's API shape appears):

- `query(text, values)` — the parameterized statement channel;
- `withSession(fn)` — a dedicated connection scope for transactions.

**W046 pin 5: no `packages/*` or `apps/*` may import `pg`; only `services/application-gateway` binds the driver.** Enforced by `test/pg-boundary.test.ts` (a source walk over every tree). The bindings:

- `bindPgPool(pool)` (in `services/application-gateway/src/postgres-binding.ts`) — adapts a pg 8.23.0-shaped pool: `query` rides the auto-commit channel; `withSession` checks out a dedicated client and always releases it.
- `bindPgliteEngine(engine)` — TEST-ONLY: adapts an embedded real-PostgreSQL engine (`@electric-sql/pglite`) to the same port.

**Current state (catalog gap, documented honestly):** the pg/pglite catalog pins were declared in the W046 dependency intake (`scripts/DEPENDENCY-BASELINE.md`, PR #99) but the mechanical `pnpm-workspace.yaml` catalog entries did not land with it. Per the baseline's own missing-dependency procedure, no package in this tree references the npm modules — the bindings are STRUCTURAL (duck-typed against the pg API shape), and the deployment injects the instantiated driver object. The pglite real-engine suite loads the engine through a non-literal specifier and reports an explicit, named skip until the catalog entry materializes (Tech Lead foundation branch + lockfile reconcile) — at which point the suite executes against real embedded PostgreSQL with ZERO code changes. Ad-hoc real-engine verification was performed in a throwaway workspace replica (see limitations.md).

## The gateway's durable tables

`services/application-gateway/src/persistence-binding.ts` binds the gateway's own records to the SPI (in-memory default, PostgreSQL when bound):

| Table | Content |
|---|---|
| `gateway_idempotency` | The typed IdempotentReplay records (apply/replay/dedupe). |
| `gateway_sessions` | The durable session record mirror (a fresh process restores sessions from it). |
| `gateway_correlations` | The correlation ledger (gateway -> authority call trace). |

The migration plan is idempotent (`prepare()`); the session restore path (`SessionMirror.restoreInto`) is the PostgreSQL-is-authoritative seam for session records.
