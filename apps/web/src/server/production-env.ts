/**
 * @epoch/web — the typed production environment contract (W051, ACR-006).
 *
 * THE single validated environment model behind spec/production-environment.md:
 * profile detection, variable shape validation, fail-safe defaults and
 * issue collection (never thrown mid-read). Secret VALUES live only in
 * this server-side object and the bindings it feeds; readiness/health
 * surfaces use `redactedEnvironment()` (presence booleans + binding
 * kinds only — a value NEVER crosses into a response, log or issue
 * string).
 *
 * Fail-safe precedence (spec/production-environment.md):
 *  - security gates fail CLOSED (enforced elsewhere — the gateway);
 *  - production REQUIRES durable persistence + object storage
 *    (`criticalIssues` non-empty => the production binding refuses to
 *    boot — never silently ephemeral authoritative state);
 *  - rate limiting falls back to the in-memory reference (surfaced);
 *  - Apify unconfigured disables acquisition gracefully (surfaced).
 */

/** The deployment profile vocabulary. */
export const DEPLOYMENT_PROFILES = ['development', 'preview', 'production'] as const;
export type DeploymentProfile = (typeof DEPLOYMENT_PROFILES)[number];

/** One fixed-window budget (requests per window). */
export interface RateLimitBudget {
  readonly requestsPerWindow: number;
  readonly windowMs: number;
}

/** The validated environment (values server-side only). */
export interface ProductionEnvironment {
  readonly profile: DeploymentProfile;
  readonly database: {
    readonly configured: boolean;
    readonly url: string;
  };
  readonly objectStore: {
    readonly configured: boolean;
    readonly endpoint: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly region: string;
  };
  readonly rateLimit: {
    readonly configured: boolean;
    readonly restUrl: string;
    readonly restToken: string;
    readonly timeoutMs: number;
  };
  readonly apify: {
    readonly configured: boolean;
    readonly token: string;
    readonly actorId: string;
    readonly maxRunsPerDay: number;
  };
  readonly budgets: {
    readonly ip: RateLimitBudget;
    readonly tenant: RateLimitBudget;
    readonly operation: RateLimitBudget;
    readonly session: RateLimitBudget;
  };
  /** Shape-validation issues (never include secret values). */
  readonly issues: readonly string[];
  /** Boot-blocking issues (production profile only). */
  readonly criticalIssues: readonly string[];
}

/** The injectable environment source (tests pass a plain object). */
export type EnvironmentSource = Record<string, string | undefined>;

const DEFAULT_IP_BUDGET: RateLimitBudget = { requestsPerWindow: 120, windowMs: 60_000 };
const DEFAULT_TENANT_BUDGET: RateLimitBudget = { requestsPerWindow: 600, windowMs: 60_000 };
const DEFAULT_OPERATION_BUDGET: RateLimitBudget = { requestsPerWindow: 120, windowMs: 60_000 };
const DEFAULT_SESSION_BUDGET: RateLimitBudget = { requestsPerWindow: 300, windowMs: 60_000 };
const DEFAULT_RATE_LIMIT_TIMEOUT_MS = 800;
const DEFAULT_APIFY_MAX_RUNS_PER_DAY = 1;

function profileOf(source: EnvironmentSource, issues: string[]): DeploymentProfile {
  const raw = source['EPOCH_DEPLOYMENT_PROFILE'];
  if (raw === undefined || raw === '') return 'development';
  if ((DEPLOYMENT_PROFILES as readonly string[]).includes(raw)) return raw as DeploymentProfile;
  issues.push(`EPOCH_DEPLOYMENT_PROFILE "${raw}" is not one of development|preview|production — defaulting to development (fail-safe)`);
  return 'development';
}

function parsePositiveInt(
  source: EnvironmentSource,
  name: string,
  fallback: number,
  issues: string[],
): number {
  const raw = source[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    issues.push(`${name} "${raw}" is not a positive integer — using the default ${fallback}`);
    return fallback;
  }
  return parsed;
}

function parseUrl(
  source: EnvironmentSource,
  name: string,
  issues: string[],
): { readonly value: string; readonly valid: boolean } {
  const raw = source[name] ?? '';
  if (raw === '') return { value: '', valid: false };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      issues.push(`${name} must be an http(s) URL — ignoring the value`);
      return { value: '', valid: false };
    }
    return { value: raw, valid: true };
  } catch {
    issues.push(`${name} is not a valid URL — ignoring the value`);
    return { value: '', valid: false };
  }
}

function parseBudget(
  source: EnvironmentSource,
  prefix: string,
  fallback: RateLimitBudget,
  issues: string[],
): RateLimitBudget {
  const requestsPerWindow = parsePositiveInt(source, `${prefix}_REQUESTS_PER_WINDOW`, fallback.requestsPerWindow, issues);
  const windowMs = parsePositiveInt(source, `${prefix}_WINDOW_MS`, fallback.windowMs, issues);
  return { requestsPerWindow, windowMs };
}

/** Read + validate the environment (pure; never throws). */
export function readProductionEnvironment(source: EnvironmentSource = process.env): ProductionEnvironment {
  const issues: string[] = [];
  const profile = profileOf(source, issues);

  const databaseUrl = source['EPOCH_DATABASE_URL'] ?? '';
  const database = {
    configured: databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'),
    url: databaseUrl,
  };
  if (databaseUrl !== '' && !database.configured) {
    issues.push('EPOCH_DATABASE_URL must be a postgres:// or postgresql:// connection string — ignoring the value');
  }

  const endpoint = parseUrl(source, 'EPOCH_OBJECT_STORE_ENDPOINT', issues);
  const bucket = source['EPOCH_OBJECT_STORE_BUCKET'] ?? '';
  const accessKeyId = source['EPOCH_OBJECT_STORE_ACCESS_KEY_ID'] ?? '';
  const secretAccessKey = source['EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY'] ?? '';
  const region = source['EPOCH_OBJECT_STORE_REGION'] ?? 'auto';
  const objectStoreParts = [endpoint.valid, bucket !== '', accessKeyId !== '', secretAccessKey !== ''];
  const objectStoreConfiguredParts = objectStoreParts.filter((part) => part).length;
  const objectStore = {
    configured: objectStoreConfiguredParts === 4,
    endpoint: endpoint.value,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
  if (objectStoreConfiguredParts > 0 && objectStoreConfiguredParts < 4) {
    issues.push('EPOCH_OBJECT_STORE_* is partially configured (endpoint+bucket+accessKeyId+secretAccessKey are all required) — the object store falls back to in-memory');
  }

  const restUrl = parseUrl(source, 'EPOCH_RATE_LIMIT_REST_URL', issues);
  const restToken = source['EPOCH_RATE_LIMIT_REST_TOKEN'] ?? '';
  const rateLimit = {
    configured: restUrl.valid && restToken !== '',
    restUrl: restUrl.value,
    restToken,
    timeoutMs: parsePositiveInt(source, 'EPOCH_RATE_LIMIT_TIMEOUT_MS', DEFAULT_RATE_LIMIT_TIMEOUT_MS, issues),
  };
  if ((restUrl.valid || restToken !== '') && !rateLimit.configured) {
    issues.push('EPOCH_RATE_LIMIT_* is partially configured (restUrl+restToken are both required) — rate limiting falls back to the in-memory reference');
  }

  const apifyToken = source['EPOCH_APIFY_TOKEN'] ?? '';
  const apifyActorId = source['EPOCH_APIFY_ACTOR_ID'] ?? '';
  const apify = {
    configured: apifyToken !== '' && apifyActorId !== '',
    token: apifyToken,
    actorId: apifyActorId,
    maxRunsPerDay: parsePositiveInt(source, 'EPOCH_APIFY_MAX_RUNS_PER_DAY', DEFAULT_APIFY_MAX_RUNS_PER_DAY, issues),
  };

  const budgets = {
    ip: parseBudget(source, 'EPOCH_RATE_LIMIT_IP', DEFAULT_IP_BUDGET, issues),
    tenant: parseBudget(source, 'EPOCH_RATE_LIMIT_TENANT', DEFAULT_TENANT_BUDGET, issues),
    operation: parseBudget(source, 'EPOCH_RATE_LIMIT_OPERATION', DEFAULT_OPERATION_BUDGET, issues),
    session: parseBudget(source, 'EPOCH_RATE_LIMIT_SESSION', DEFAULT_SESSION_BUDGET, issues),
  };

  const criticalIssues: string[] = [];
  if (profile === 'production') {
    if (!database.configured) {
      criticalIssues.push('production profile REQUIRES EPOCH_DATABASE_URL (durable persistence) — refusing to boot on ephemeral state');
    }
    if (!objectStore.configured) {
      criticalIssues.push('production profile REQUIRES the EPOCH_OBJECT_STORE_* variables (durable object bytes) — refusing to boot on ephemeral state');
    }
  }

  return {
    profile,
    database,
    objectStore,
    rateLimit,
    apify,
    budgets,
    issues,
    criticalIssues,
  };
}

/** The readiness/health projection: presence + kind ONLY — never a value. */
export interface RedactedEnvironment {
  readonly profile: DeploymentProfile;
  readonly database: { readonly configured: boolean; readonly kind: 'postgres' | 'in-memory' };
  readonly objectStore: { readonly configured: boolean; readonly kind: 's3' | 'in-memory' };
  readonly rateLimit: { readonly configured: boolean; readonly kind: 'upstash' | 'in-memory' };
  readonly acquisition: { readonly configured: boolean; readonly kind: 'apify' | 'disabled' };
  readonly issues: readonly string[];
  readonly criticalIssues: readonly string[];
}

/** Project the environment for readiness payloads (secret-free by construction). */
export function redactedEnvironment(environment: ProductionEnvironment): RedactedEnvironment {
  return {
    profile: environment.profile,
    database: {
      configured: environment.database.configured,
      kind: environment.database.configured ? 'postgres' : 'in-memory',
    },
    objectStore: {
      configured: environment.objectStore.configured,
      kind: environment.objectStore.configured ? 's3' : 'in-memory',
    },
    rateLimit: {
      configured: environment.rateLimit.configured,
      kind: environment.rateLimit.configured ? 'upstash' : 'in-memory',
    },
    acquisition: {
      configured: environment.apify.configured,
      kind: environment.apify.configured ? 'apify' : 'disabled',
    },
    issues: environment.issues,
    criticalIssues: environment.criticalIssues,
  };
}
