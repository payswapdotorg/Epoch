/**
 * @epoch/application-gateway — public API (service layer, Work Order
 * W046, ACR-005).
 *
 * The client-facing facade that COMPOSES the existing authoritative
 * Epoch kernels/services (it orchestrates; it decides nothing semantic):
 *
 * - `ApplicationGateway` — the typed operation dispatch over the frozen
 *   client-runtime vocabulary, with the session/tenant/W009 gates,
 *   correlation ledger, and typed IdempotentReplay wrapping (durable
 *   records through the persistence SPI);
 * - `AUTHORITY_MAP` — the first-class authority mapping (every
 *   operation -> the existing authority that owns its semantics;
 *   walk-test enforced);
 * - the persistence bindings (session mirror, correlation ledger,
 *   idempotency store, gateway migrations) + the PostgreSQL driver
 *   bindings (`bindPgPool` — the ONLY pg binding point; `bindPgliteEngine`
 *   TEST-ONLY);
 * - the deterministic construction/software product fixtures +
 *   J07/J08/J11 journey scenario scripts (byte-stable).
 */

// Version.
export { APPLICATION_GATEWAY_SERVICE_VERSION } from './version';

// The authority map (first-class artifact).
export {
  AUTHORITY_BY_OPERATION,
  AUTHORITY_MAP,
  isAuthorityMapped,
} from './authority-map';
export type { AuthorityLayer, AuthorityMapping } from './authority-map';

// The gateway facade.
export { ApplicationGateway } from './gateway';
export type {
  ApplicationGatewayOptions,
  AuthorizationFacts,
  GatewayAuthorities,
  GatewayClock,
  OperationContext,
} from './gateway';

// Persistence bindings.
export {
  CorrelationLedger,
  GATEWAY_MIGRATION_PLAN,
  GATEWAY_TABLES,
  PersistedIdempotencyStore,
  SessionMirror,
  createPostgresGatewayPersistence,
  migrateGatewayTables,
} from './persistence-binding';
export type { CorrelationLedgerEntry } from './persistence-binding';

// PostgreSQL driver bindings (SERVICE-LAYER ONLY; the pg 8.23.0 catalog
// pin materialized at its documented consumer by the W051 foundation
// intake — this package remains the ONLY pg binding point).
export {
  PG_DRIVER_MODULE,
  PGLITE_MODULE,
  bindPgPool,
  bindPgliteEngine,
  connectPostgresPool,
} from './postgres-binding';
export { PG_DRIVER_POOL_CTOR } from './pg-driver-anchor';
export type {
  ConnectPostgresPoolOptions,
  ConnectedPostgresPool,
  PgClientLike,
  PgPoolLike,
  PgQueryResultLike,
  PgliteEngineLike,
} from './postgres-binding';

// Request guards (W051, ACR-006): the provider-neutral rate-limit port
// + the in-memory reference implementation (Upstash adapter lives in
// adapters/upstash-redis).
export {
  fixedWindowIndex,
  fixedWindowKey,
  guardFailureDecision,
  InMemoryRequestGuard,
  validateFixedWindowBudget,
} from './rate-limit';
export type {
  GatewayGuardScope,
  GuardCounterSnapshot,
  GuardRequestContext,
  InMemoryRequestGuardOptions,
  RateLimitDecision,
  RequestGuard,
  RequestGuardFailurePolicy,
} from './rate-limit';

// The reset/seed production-refusal guard (W053, ACR-006): the
// script-layer enforcement of the production protection rules.
export { productionHostOf, refusesProductionTarget } from './production-refusal';
export type { ProductionTargetInput, ProductionTargetRefusal } from './production-refusal';

// Deterministic product fixtures (construction + software domains).
export {
  PRODUCT_FIXTURE_VERSION,
  renderProductFixtureFiles,
  scenarioScriptOf,
} from './fixtures';
export type { JourneyScenarioScript, ProductFixtureDomain } from './fixtures';
