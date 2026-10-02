/**
 * @epoch/adapter-upstash-redis — the Upstash REST RequestGuard (W051,
 * ACR-006).
 *
 * The EPHEMERAL-ONLY implementation of the provider-neutral W051
 * RequestGuard port: fixed-window rate-limit counters over the Upstash
 * Redis REST API.
 *
 * Contract alignment with the in-memory reference (the port's semantic
 * invariant): windows are EPOCH-ANCHORED — the key is the gateway's
 * canonical `fixedWindowKey(scope, identity, now, windowMs)` derivation,
 * so both implementations derive the SAME key and the SAME reset
 * instants for the same inputs.
 *
 * Cost discipline (spec/free-tier-infrastructure.md): exactly ONE Redis
 * command per check (a single atomic EVAL: INCR + EXPIRE NX with a TTL
 * that outlives the window — keys self-expire, no unbounded key growth;
 * 500K free commands/month ≈ 500K checks/month).
 *
 * Failure semantics: infrastructure failures (timeout, network, non-2xx,
 * malformed response) resolve per the declared `failurePolicy`
 * (`fail-open` default — allow + degraded flag; `fail-closed` — deny +
 * degraded flag). The adapter NEVER throws for infrastructure reasons.
 *
 * ZERO new dependencies: the platform fetch (injectable for tests) +
 * the Authorization: Bearer header of the Upstash REST API.
 */
import {
  fixedWindowKey,
  type GatewayGuardScope,
  type GuardRequestContext,
  type RateLimitDecision,
  type RequestGuard,
  type RequestGuardFailurePolicy,
} from '@epoch/application-gateway';

/** Options of the Upstash REST guard. */
export interface UpstashRestGuardOptions {
  readonly guardId: string;
  readonly scope: GatewayGuardScope;
  readonly limit: number;
  readonly windowMs: number;
  /** The Upstash REST URL (https://…upstash.io). */
  readonly restUrl: string;
  /** The Upstash REST token (server-side secret). */
  readonly restToken: string;
  /** Guard call timeout in milliseconds (default 800). */
  readonly timeoutMs?: number | undefined;
  readonly failurePolicy?: RequestGuardFailurePolicy | undefined;
  /** Injectable fetch (tests); defaults to the platform fetch. */
  readonly fetchImpl?: typeof fetch | undefined;
}

/** The injectable fetch port (the driver seam — tests substitute doubles). */
export type FetchLike = typeof fetch;

/** The atomic INCR+EXPIRE NX script (one command per check). */
export const RATE_LIMIT_LUA = 'local c = redis.call("INCR", KEYS[1]) redis.call("EXPIRE", KEYS[1], ARGV[1], "NX") return c';

/** TTL seconds that safely outlive the window (bounded key lifetime). */
function ttlSecondsOf(windowMs: number): number {
  return Math.max(1, Math.ceil((windowMs * 2) / 1000));
}

/** One Upstash REST pipeline/error payload shape (loose by design). */
interface UpstashResponse {
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * The Upstash REST RequestGuard. Safe for concurrent use; stateless
 * besides the closure configuration (all state lives in Redis).
 */
export class UpstashRestGuard implements RequestGuard {
  readonly guardId: string;
  public readonly failurePolicy: RequestGuardFailurePolicy;
  private readonly scope: GatewayGuardScope;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly restUrl: string;
  private readonly restToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: UpstashRestGuardOptions) {
    if (options.limit < 1) throw new Error('UpstashRestGuard: limit must be >= 1');
    if (options.windowMs < 1) throw new Error('UpstashRestGuard: windowMs must be >= 1');
    if (!/^https?:\/\//.test(options.restUrl)) throw new Error('UpstashRestGuard: restUrl must be an http(s) URL');
    if (options.restToken === '') throw new Error('UpstashRestGuard: restToken must be non-empty');
    this.guardId = options.guardId;
    this.scope = options.scope;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.restUrl = options.restUrl.replace(/\/+$/, '');
    this.restToken = options.restToken;
    this.timeoutMs = options.timeoutMs ?? 800;
    this.failurePolicy = options.failurePolicy ?? 'fail-open';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async check(context: GuardRequestContext): Promise<RateLimitDecision> {
    const windowIndex = Math.floor(context.nowEpochMs / this.windowMs);
    const identity = this.identityOf(context);
    const key = fixedWindowKey(this.scope, identity, context.nowEpochMs, this.windowMs);
    const windowStartEpochMs = windowIndex * this.windowMs;
    const resetAtEpochMs = windowStartEpochMs + this.windowMs;

    let count: number | null;
    try {
      count = await this.incrWithTtl(key, ttlSecondsOf(this.windowMs));
    } catch {
      return this.failureDecision();
    }
    if (count === null || !Number.isFinite(count)) {
      return this.failureDecision();
    }
    if (count > this.limit) {
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        retryAfterMs: Math.max(1, resetAtEpochMs - context.nowEpochMs),
        degraded: false,
      };
    }
    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - count,
      retryAfterMs: 0,
      degraded: false,
    };
  }

  private identityOf(context: GuardRequestContext): string {
    switch (this.scope) {
      case 'operation':
        return context.operation;
      case 'tenant':
        return context.tenantId ?? 'unknown';
      case 'session':
        return context.sessionId ?? 'anonymous';
      case 'client':
        return context.clientKey ?? 'unknown';
    }
  }

  private failureDecision(): RateLimitDecision {
    if (this.failurePolicy === 'fail-closed') {
      return { allowed: false, limit: this.limit, remaining: 0, retryAfterMs: 60_000, degraded: true };
    }
    return { allowed: true, limit: this.limit, remaining: this.limit, retryAfterMs: 0, degraded: true };
  }

  private async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // BODY-STYLE REST (W053 live verification): the command is a JSON
      // array POSTed to the REST ROOT. Posting to the `/eval` path PREFIX
      // with a body is IGNORED by real Upstash (path-style endpoints take
      // their arguments from the PATH) — a live-only defect the W051
      // doubles could not see; this is the corrected, live-verified form.
      const response = await this.fetchImpl(this.restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['EVAL', RATE_LIMIT_LUA, '1', key, String(ttlSeconds)]),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const body = (await response.json()) as UpstashResponse;
      if (typeof body?.result !== 'number') return null;
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  }
}
