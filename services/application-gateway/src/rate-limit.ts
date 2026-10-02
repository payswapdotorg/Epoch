/**
 * @epoch/application-gateway — the provider-neutral request-guard port
 * (W051, ACR-006).
 *
 * Fixed-window rate limiting AT THE GATEWAY BOUNDARY. The port carries
 * ZERO provider semantics: any implementation (the in-memory reference
 * here, the Upstash REST adapter in adapters/upstash-redis) MUST honor
 * the same contract —
 *
 *  - windows are EPOCH-ANCHORED (windowIndex = floor(nowEpochMs /
 *    windowMs)) so every implementation derives the SAME key shape and
 *    the SAME reset instants for the same inputs (semantic alignment
 *    between reference and remote implementations);
 *  - `check` is check-and-consume (atomic from the caller's view);
 *  - infrastructure failure is resolved by the IMPLEMENTATION per its
 *    declared `failurePolicy` — `fail-open` (allow + `degraded: true`;
 *    the default: rate limiting is abuse control, NEVER authorization)
 *    or `fail-closed` (deny). The gateway additionally converts thrown
 *    guard errors to the same policy so a buggy guard can never take
 *    the boundary down.
 *
 * A denial maps to the frozen client-runtime taxonomy as
 * `transient` / `gateway-overloaded` (retryable with backoff) — the
 * gateway constructs that error; the port never invents error shapes.
 *
 * Deterministic: zero wall-clock (the caller supplies `nowEpochMs`),
 * zero randomness, bounded memory (lazy expired-entry cleanup).
 */

/** The request context the gateway hands to every guard. */
export interface GuardRequestContext {
  /** The (already envelope-validated) operation name. */
  readonly operation: string;
  /** The envelope-claimed tenant (validated LATER by the tenant gate). */
  readonly tenantId: string | null;
  /** The envelope session (null only for the `session.issue` bootstrap). */
  readonly sessionId: string | null;
  /**
   * The transport-level client key (W051): the caller-derived client
   * identity (e.g. the request IP). Used by `client`-scoped guards at
   * the route boundary; abuse control only — NEVER authorization.
   */
  readonly clientKey?: string | null;
  readonly correlationId: string;
  /** Caller-supplied instant (epoch milliseconds). */
  readonly nowEpochMs: number;
}

/** One rate-limit decision (typed, provider-neutral). */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  readonly retryAfterMs: number;
  /** True when the guard's backend was unavailable and the declared policy applied. */
  readonly degraded: boolean;
}

/** How a guard resolves its own infrastructure failure. */
export type RequestGuardFailurePolicy = 'fail-open' | 'fail-closed';

/**
 * The provider-neutral request-guard port. Implementations MUST be
 * safe to call concurrently and MUST NOT throw for infrastructure
 * reasons (resolve per `failurePolicy` instead).
 */
export interface RequestGuard {
  /** Stable guard identifier (recorded in denial details). */
  readonly guardId: string;
  readonly failurePolicy: RequestGuardFailurePolicy;
  /** Check-and-consume one unit for this request context. */
  check(context: GuardRequestContext): Promise<RateLimitDecision>;
}

/** The envelope dimensions a gateway-level guard may key on. */
export type GatewayGuardScope = 'operation' | 'tenant' | 'session' | 'client';

/** Derive the fixed-window index of an instant (the shared key math). */
export function fixedWindowIndex(nowEpochMs: number, windowMs: number): number {
  return Math.floor(nowEpochMs / windowMs);
}

/** The epoch-anchored fixed-window key (the canonical derivation). */
export function fixedWindowKey(scope: string, identity: string, nowEpochMs: number, windowMs: number): string {
  return `ratelimit:${scope}:${identity}:${fixedWindowIndex(nowEpochMs, windowMs)}`;
}

/** Validate a fixed-window budget (throws on non-positive values). */
export function validateFixedWindowBudget(limit: number, windowMs: number): void {
  if (!Number.isFinite(limit) || limit < 1) throw new Error('rate-limit limit must be >= 1');
  if (!Number.isFinite(windowMs) || windowMs < 1) throw new Error('rate-limit windowMs must be >= 1');
}

/** Options of the in-memory reference guard. */
export interface InMemoryRequestGuardOptions {
  readonly guardId: string;
  readonly scope: GatewayGuardScope;
  readonly limit: number;
  readonly windowMs: number;
  readonly failurePolicy?: RequestGuardFailurePolicy;
  /** Memory bound: expired entries are dropped when the map exceeds this (default 10_000). */
  readonly maxKeys?: number;
}

interface WindowCounter {
  readonly windowIndex: number;
  count: number;
}

/** One stored counter row (readonly projection for tests/inspection). */
export interface GuardCounterSnapshot {
  readonly key: string;
  readonly windowIndex: number;
  readonly count: number;
}

/**
 * The in-memory reference guard (per-instance). Windows are
 * epoch-anchored; `session.issue` requests key on the anonymous bucket
 * (`session:anonymous`); tenants/operations fall back to `unknown` /
 * the operation name. Bounded memory with lazy cleanup — never grows
 * beyond maxKeys live entries.
 */
export class InMemoryRequestGuard implements RequestGuard {
  public readonly guardId: string;
  public readonly failurePolicy: RequestGuardFailurePolicy;
  private readonly scope: GatewayGuardScope;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly counters = new Map<string, WindowCounter>();

  constructor(options: InMemoryRequestGuardOptions) {
    validateFixedWindowBudget(options.limit, options.windowMs);
    this.guardId = options.guardId;
    this.scope = options.scope;
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.failurePolicy = options.failurePolicy ?? 'fail-open';
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  identityOf(context: GuardRequestContext): string {
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

  async check(context: GuardRequestContext): Promise<RateLimitDecision> {
    const windowIndex = fixedWindowIndex(context.nowEpochMs, this.windowMs);
    const identity = this.identityOf(context);
    const key = fixedWindowKey(this.scope, identity, context.nowEpochMs, this.windowMs);
    const existing = this.counters.get(key);
    let counter: WindowCounter;
    if (existing === undefined || existing.windowIndex !== windowIndex) {
      counter = { windowIndex, count: 0 };
      this.counters.set(key, counter);
      this.cleanupExpired(windowIndex);
    } else {
      counter = existing;
    }
    const consumed = counter.count + 1;
    if (consumed > this.limit) {
      const windowStartEpochMs = windowIndex * this.windowMs;
      const resetAtEpochMs = windowStartEpochMs + this.windowMs;
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        retryAfterMs: Math.max(1, resetAtEpochMs - context.nowEpochMs),
        degraded: false,
      };
    }
    counter.count = consumed;
    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - consumed,
      retryAfterMs: 0,
      degraded: false,
    };
  }

  /** Live counter rows (digest-sorted for determinism; test/inspection use). */
  snapshots(): readonly GuardCounterSnapshot[] {
    return [...this.counters.entries()]
      .map(([key, counter]) => ({ key, windowIndex: counter.windowIndex, count: counter.count }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  private cleanupExpired(currentWindowIndex: number): void {
    if (this.counters.size <= this.maxKeys) return;
    for (const [key, counter] of this.counters) {
      if (counter.windowIndex < currentWindowIndex) this.counters.delete(key);
    }
  }
}

/**
 * Resolve a THROWN guard failure per the declared policy (the gateway's
 * defensive wrapper: a buggy guard can never take the boundary down).
 */
export function guardFailureDecision(
  guard: Pick<RequestGuard, 'failurePolicy'>,
  limitHint: number,
): RateLimitDecision {
  if (guard.failurePolicy === 'fail-closed') {
    return { allowed: false, limit: limitHint, remaining: 0, retryAfterMs: 60_000, degraded: true };
  }
  return { allowed: true, limit: limitHint, remaining: limitHint, retryAfterMs: 0, degraded: true };
}
