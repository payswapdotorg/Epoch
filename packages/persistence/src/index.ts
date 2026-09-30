/**
 * @epoch/persistence — public API (kernel layer, Work Order W046).
 *
 * The provider-neutral persistence SPI + the two reference
 * implementations:
 * - `InMemoryPersistence` — the deterministic in-memory reference;
 * - `PostgresPersistence` — the real PostgreSQL adapter (complete
 *   wire-protocol SQL emission) over the neutral `PostgresWirePort`
 *   (driver binding is service-layer ONLY — this package never imports
 *   pg; enforced by the W046 pg-boundary test).
 *
 * The shared conformance suite (`persistenceConformanceCases`) runs
 * identically against both; the golden-SQL corpus
 * (`testdata/golden-sql`) pins the exact SQL emitted for every SPI
 * operation.
 */

// Versions + grammars + typed errors.
export {
  PERSISTENCE_CONTRACT_VERSION,
  PERSISTENCE_ERROR_CODES,
  PERSISTENCE_RECORD_VERSION,
  RECORD_KEY_PATTERN,
  TABLE_NAME_PATTERN,
} from './version';
export type {
  PersistenceError,
  PersistenceErrorCode,
  PersistenceResult,
} from './version';

// The SPI.
export {
  migrationPlanDigest,
  persistenceFail,
  persistenceOk,
  validateMigrationPlan,
  validateRecordKey,
  validateRecordValue,
  validateTableName,
} from './spi';
export type {
  MigrationOutcome,
  MigrationPlan,
  MigrationStep,
  PersistenceSession,
  RecordEntry,
  RecordStore,
} from './spi';

// The in-memory reference implementation.
export { InMemoryPersistence } from './in-memory';

// The PostgreSQL adapter (wire port + pure SQL emission + the adapter).
export type {
  PostgresWirePort,
  PostgresWireResult,
  PostgresWireRow,
  PostgresWireSession,
} from './postgres/wire';
export { PostgresWireError } from './postgres/wire';
export {
  SQL_BEGIN,
  SQL_COMMIT,
  SQL_ROLLBACK,
  encodeValue,
  quoteIdent,
  sqlCreateTable,
  sqlDelete,
  sqlDropTable,
  sqlGet,
  sqlInsert,
  sqlList,
  sqlPut,
} from './postgres/sql';
export type { SqlStatement } from './postgres/sql';
export { PostgresPersistence, type PostgresPersistenceOptions } from './postgres/adapter';

// The shared conformance suite.
export {
  persistenceConformanceCases,
  type ConformanceCase,
  type SessionFactory,
} from './conformance';
