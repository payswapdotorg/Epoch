/**
 * @epoch/web — the production binding layer (W051, ACR-006).
 *
 * THE environment-driven composition seam between the product runtime
 * (product-runtime.ts) and the provider adapters:
 *
 *  - persistence: Neon PostgreSQL via `connectPostgresPool` +
 *    `bindPgPool` + `createPostgresGatewayPersistence` when
 *    EPOCH_DATABASE_URL is configured (the pool is cached on
 *    globalThis — serverless instances reuse it across invocations);
 *    otherwise the in-memory reference (degraded, surfaced);
 *  - object store: the S3-compatible adapter (R2) when the
 *    EPOCH_OBJECT_STORE_* variables are configured; otherwise the
 *    in-memory reference (degraded, surfaced);
 *  - guards: Upstash REST guards when EPOCH_RATE_LIMIT_* is
 *    configured (operation/tenant/session budgets from the
 *    environment); otherwise the in-memory reference guards. The IP
 *    guard (transport-level, used by the gateway route) follows the
 *    same rule.
 *
 * Fail-safe precedence (spec/production-environment.md): production
 * REFUSES to boot with critical issues (missing durable persistence or
 * object storage) — `assertBootable` throws a typed, safe error before
 * the server accepts traffic. Degraded-but-bootable states (in-memory
 * rate limiting, disabled acquisition) surface through `readiness()`.
 *
 * Authority discipline: this module binds INFRASTRUCTURE only. It never
 * constructs authorities, never mutates fixtures, never widens tenant
 * scope. Secrets stay in this server-side module; readiness exposes the
 * redacted projection only.
 */
import { InMemoryObjectStore, type ObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence, type PersistenceSession } from '@epoch/persistence';
import {
  bindPgPool,
  connectPostgresPool,
  createPostgresGatewayPersistence,
  InMemoryRequestGuard,
  type ConnectedPostgresPool,
  type RequestGuard,
} from '@epoch/application-gateway';
import { createS3ObjectStore } from '@epoch/adapter-s3-object-store';
import { UpstashRestGuard } from '@epoch/adapter-upstash-redis';
import {
  readProductionEnvironment,
  redactedEnvironment,
  type ProductionEnvironment,
  type RedactedEnvironment,
} from './production-env';

/** The bound infrastructure of one deployment (values server-side only). */
export interface ProductionBindings {
  readonly environment: ProductionEnvironment;
  readonly persistence: PersistenceSession;
  readonly objectStore: ObjectStore;
  /** Gateway-level guards (operation/tenant/session budgets). */
  readonly guards: readonly RequestGuard[];
  /** Transport-level guard (IP-keyed; used by the gateway route). */
  readonly ipGuard: RequestGuard;
  /** The secret-free readiness projection. */
  readonly redacted: RedactedEnvironment;
}

/**
 * Fail-closed boot assertion: production-critical issues throw a typed
 * error (the route layer maps it to a 503-ready state; the platform
 * restarts the instance). Development/preview degrade instead.
 */
export function assertBootable(environment: ProductionEnvironment): void {
  if (environment.criticalIssues.length > 0) {
    throw new Error(
      `epoch production binding refuses to boot: ${environment.criticalIssues.join('; ')}`,
    );
  }
}

/** The degraded-capability flags of a binding (readiness payload). */
export function degradedFlags(environment: ProductionEnvironment): readonly string[] {
  const flags: string[] = [];
  if (!environment.database.configured) flags.push('persistence:in-memory');
  if (!environment.objectStore.configured) flags.push('object-store:in-memory');
  if (!environment.rateLimit.configured) flags.push('rate-limit:in-memory');
  if (!environment.apify.configured) flags.push('acquisition-disabled');
  return flags;
}

/** The per-instance bindings cache (serverless-safe: survives invocations). */
declare global {
  var __epoch_web_production_bindings__: ProductionBindings | undefined;
}

async function buildBindings(environment: ProductionEnvironment): Promise<ProductionBindings> {
  assertBootable(environment);

  // Persistence: Neon PostgreSQL when configured; in-memory otherwise.
  let persistence: PersistenceSession;
  if (environment.database.configured) {
    const globalPools = (globalThis as { __epoch_web_pg_pools__?: Map<string, ConnectedPostgresPool> });
    const pools = globalPools.__epoch_web_pg_pools__ ?? new Map<string, ConnectedPostgresPool>();
    globalPools.__epoch_web_pg_pools__ = pools;
    let pool = pools.get(environment.database.url);
    if (pool === undefined) {
      pool = await connectPostgresPool(environment.database.url, { max: 5, idleTimeoutMillis: 10_000 });
      pools.set(environment.database.url, pool);
    }
    persistence = createPostgresGatewayPersistence(bindPgPool(pool));
  } else {
    persistence = new InMemoryPersistence();
  }

  // Object store: S3-compatible (R2) when configured; in-memory otherwise.
  const objectStore: ObjectStore = environment.objectStore.configured
    ? createS3ObjectStore({
        endpoint: environment.objectStore.endpoint,
        bucket: environment.objectStore.bucket,
        accessKeyId: environment.objectStore.accessKeyId,
        secretAccessKey: environment.objectStore.secretAccessKey,
        region: environment.objectStore.region,
      })
    : new InMemoryObjectStore();

  // Guards: Upstash REST when configured; the in-memory reference otherwise.
  // (The same fixed-window key math makes both implementations semantically
  // aligned; the remote one is shared across instances.)
  const guards: RequestGuard[] = environment.rateLimit.configured
    ? [
        new UpstashRestGuard({
          guardId: 'operation',
          scope: 'operation',
          limit: environment.budgets.operation.requestsPerWindow,
          windowMs: environment.budgets.operation.windowMs,
          restUrl: environment.rateLimit.restUrl,
          restToken: environment.rateLimit.restToken,
          timeoutMs: environment.rateLimit.timeoutMs,
        }),
        new UpstashRestGuard({
          guardId: 'tenant',
          scope: 'tenant',
          limit: environment.budgets.tenant.requestsPerWindow,
          windowMs: environment.budgets.tenant.windowMs,
          restUrl: environment.rateLimit.restUrl,
          restToken: environment.rateLimit.restToken,
          timeoutMs: environment.rateLimit.timeoutMs,
        }),
        new UpstashRestGuard({
          guardId: 'session',
          scope: 'session',
          limit: environment.budgets.session.requestsPerWindow,
          windowMs: environment.budgets.session.windowMs,
          restUrl: environment.rateLimit.restUrl,
          restToken: environment.rateLimit.restToken,
          timeoutMs: environment.rateLimit.timeoutMs,
        }),
      ]
    : [
        new InMemoryRequestGuard({
          guardId: 'operation',
          scope: 'operation',
          limit: environment.budgets.operation.requestsPerWindow,
          windowMs: environment.budgets.operation.windowMs,
        }),
        new InMemoryRequestGuard({
          guardId: 'tenant',
          scope: 'tenant',
          limit: environment.budgets.tenant.requestsPerWindow,
          windowMs: environment.budgets.tenant.windowMs,
        }),
        new InMemoryRequestGuard({
          guardId: 'session',
          scope: 'session',
          limit: environment.budgets.session.requestsPerWindow,
          windowMs: environment.budgets.session.windowMs,
        }),
      ];

  // The IP guard is transport-level: the gateway route keys it on the
  // client address (x-forwarded-for on the platform; see guardRequestIp).
  const ipGuard: RequestGuard = environment.rateLimit.configured
    ? new UpstashRestGuard({
        guardId: 'ip',
        scope: 'client',
        limit: environment.budgets.ip.requestsPerWindow,
        windowMs: environment.budgets.ip.windowMs,
        restUrl: environment.rateLimit.restUrl,
        restToken: environment.rateLimit.restToken,
        timeoutMs: environment.rateLimit.timeoutMs,
      })
    : new InMemoryRequestGuard({
        guardId: 'ip',
        scope: 'client',
        limit: environment.budgets.ip.requestsPerWindow,
        windowMs: environment.budgets.ip.windowMs,
      });

  return {
    environment,
    persistence,
    objectStore,
    guards,
    ipGuard,
    redacted: redactedEnvironment(environment),
  };
}

/**
 * The bindings singleton (one per server instance, cached on globalThis
 * so dev-server reloads and serverless invocations reuse the pool and
 * stores). Boot-blocking configuration throws here (fail-closed).
 */
export async function getProductionBindings(): Promise<ProductionBindings> {
  const cached = globalThis.__epoch_web_production_bindings__;
  if (cached !== undefined) return cached;
  const environment = readProductionEnvironment();
  const bindings = await buildBindings(environment);
  globalThis.__epoch_web_production_bindings__ = bindings;
  return bindings;
}

/** Test seam: build bindings from an explicit source (never cached). */
export async function buildProductionBindings(
  source: Record<string, string | undefined>,
): Promise<ProductionBindings> {
  return buildBindings(readProductionEnvironment(source));
}

/**
 * Extract the client IP for the transport guard (platform
 * x-forwarded-for first hop; never trusted for AUTHORIZATION — abuse
 * control only).
 */
export function clientIpOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded !== null && forwarded !== '') {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first !== '') return first;
  }
  return 'unknown';
}
