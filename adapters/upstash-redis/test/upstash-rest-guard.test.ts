/**
 * W051 (ACR-006) — the Upstash REST guard adapter tests (test doubles;
 * live-provider verification is W053's honest-boundary work).
 */
import { describe, expect, it } from 'vitest';
import { UpstashRestGuard, RATE_LIMIT_LUA } from '../src/index';
import type { GuardRequestContext } from '@epoch/application-gateway';

function context(overrides: Partial<GuardRequestContext> = {}): GuardRequestContext {
  return {
    operation: 'world.snapshot',
    tenantId: 'tenant:nordstrand',
    sessionId: 'session:abc',
    correlationId: 'corr:test',
    nowEpochMs: 1_000_000,
    ...overrides,
  };
}

/** A scripted fetch double: queues responses per call. */
function scriptedFetch(
  responses: Array<{ readonly ok: boolean; readonly status: number; readonly body: unknown }>,
  seen: Array<{ readonly url: string; readonly init: RequestInit }> = [],
): typeof fetch {
  let call = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? ({} as RequestInit) });
    const response = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return new Response(response.ok ? JSON.stringify(response.body) : 'error', {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

const OPTIONS = {
  guardId: 'upstash-test',
  scope: 'tenant' as const,
  limit: 2,
  windowMs: 60_000,
  restUrl: 'https://example.upstash.io',
  restToken: 'secret-token',
};

describe('UpstashRestGuard (the REST port + epoch-anchored windows)', () => {
  it('issues exactly ONE REST call per check with bearer auth + the atomic Lua script (body-style, live-verified form)', async () => {
    const seen: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ ok: true, status: 200, body: { result: 1 } }], seen),
    });
    const decision = await guard.check(context());
    expect(decision).toEqual({ allowed: true, limit: 2, remaining: 1, retryAfterMs: 0, degraded: false });
    expect(seen.length).toBe(1);
    // BODY-STYLE REST: the command array is POSTed to the REST ROOT (a
    // path-style `/eval` + body form is IGNORED by real Upstash — the
    // W053 live-verification finding).
    expect(seen[0]!.url).toBe('https://example.upstash.io');
    const init = seen[0]!.init;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret-token');
    const body = JSON.parse(String(init.body)) as unknown[];
    expect(body[0]).toBe('EVAL');
    expect(body[1]).toBe(RATE_LIMIT_LUA);
    expect(body[2]).toBe('1');
    // Epoch-anchored key: the canonical fixedWindowKey derivation.
    expect(body[3]).toBe('ratelimit:tenant:tenant:nordstrand:16');
    // TTL outlives the window (2x), bounded key lifetime.
    expect(body[4]).toBe('120');
  });

  it('denies beyond the limit with the epoch-anchored retryAfter', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ ok: true, status: 200, body: { result: 3 } }]),
    });
    const decision = await guard.check(context());
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    // nowEpochMs = 1_000_000; window [960_000, 1_020_000) => retryAfter 20_000
    expect(decision.retryAfterMs).toBe(20_000);
    expect(decision.degraded).toBe(false);
  });

  it('fail-open (default): an unavailable backend allows with the degraded flag', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ ok: false, status: 500, body: { error: 'boom' } }]),
    });
    const decision = await guard.check(context());
    expect(decision).toEqual({ allowed: true, limit: 2, remaining: 2, retryAfterMs: 0, degraded: true });
  });

  it('fail-closed: an unavailable backend denies with the degraded flag', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      failurePolicy: 'fail-closed',
      fetchImpl: scriptedFetch([{ ok: false, status: 503, body: {} }]),
    });
    const decision = await guard.check(context());
    expect(decision.allowed).toBe(false);
    expect(decision.degraded).toBe(true);
    expect(decision.retryAfterMs).toBeGreaterThan(0);
  });

  it('a thrown fetch (network) resolves per the policy, never propagates', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: (async () => {
        throw new Error('network down');
      }) as typeof fetch,
    });
    const decision = await guard.check(context());
    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });

  it('a malformed response body is a typed failure (fail-open default)', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ ok: true, status: 200, body: { unexpected: true } }]),
    });
    const decision = await guard.check(context());
    expect(decision.degraded).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it('NEGATIVE: a NON-JSON response body (HTML error page) resolves per the policy, never throws', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: (async () =>
        new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })) as typeof fetch,
    });
    const decision = await guard.check(context());
    // fail-open default: allow + degraded (the JSON parse failure resolved
    // by the declared policy — the adapter never propagates the throw).
    expect(decision).toEqual({ allowed: true, limit: 2, remaining: 2, retryAfterMs: 0, degraded: true });
  });

  it('NEGATIVE: an INVALID TOKEN (401 Unauthorized) resolves per the policy (fail-open degraded / fail-closed deny)', async () => {
    const unauthorized = (async () =>
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const open = new UpstashRestGuard({ ...OPTIONS, fetchImpl: unauthorized });
    const openDecision = await open.check(context());
    expect(openDecision.allowed).toBe(true);
    expect(openDecision.degraded).toBe(true);
    const closed = new UpstashRestGuard({ ...OPTIONS, failurePolicy: 'fail-closed', fetchImpl: unauthorized });
    const closedDecision = await closed.check(context());
    expect(closedDecision.allowed).toBe(false);
    expect(closedDecision.degraded).toBe(true);
    expect(closedDecision.retryAfterMs).toBeGreaterThan(0);
  });

  it('NEGATIVE: a result that is not a number (malformed eval payload) is a typed failure', async () => {
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ ok: true, status: 200, body: { result: 'not-a-number' } }]),
    });
    const decision = await guard.check(context());
    expect(decision.degraded).toBe(true);
    expect(decision.allowed).toBe(true);
  });

  it('validates its configuration (fail-fast, no network)', () => {
    expect(() => new UpstashRestGuard({ ...OPTIONS, limit: 0 })).toThrow();
    expect(() => new UpstashRestGuard({ ...OPTIONS, restUrl: 'ftp://x' })).toThrow();
    expect(() => new UpstashRestGuard({ ...OPTIONS, restToken: '' })).toThrow();
  });

  it('keys bootstrap session.issue requests on the anonymous bucket (reference alignment)', async () => {
    const seen: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const guard = new UpstashRestGuard({
      ...OPTIONS,
      scope: 'session',
      fetchImpl: scriptedFetch([{ ok: true, status: 200, body: { result: 1 } }], seen),
    });
    await guard.check(context({ sessionId: null }));
    const body = JSON.parse(String(seen[0]!.init.body)) as unknown[];
    expect(body[3]).toBe('ratelimit:session:anonymous:16');
  });
});
