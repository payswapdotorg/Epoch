/**
 * W053 (ACR-006) — LIVE Upstash verification against REAL infrastructure.
 *
 * ACTIVATION CONTRACT: this suite SKIPS cleanly (zero network, zero
 * failing tests) unless BOTH `EPOCH_RATE_LIMIT_REST_URL` and
 * `EPOCH_RATE_LIMIT_REST_TOKEN` are set in the environment — CI stays
 * hermetic; the operator (or a temporary no-signup trial database) runs
 * it with real credentials:
 *
 *   EPOCH_RATE_LIMIT_REST_URL=https://<db>.upstash.io \
 *   EPOCH_RATE_LIMIT_REST_TOKEN=<token> \
 *   pnpm vitest run test/live-upstash-verification.test.ts
 *
 * The temporary free no-signup trial (https://upstash.com/start-redis,
 * 3-day lifetime) suffices: the adapter code path is exercised against
 * REAL Upstash REST infrastructure; production credentials remain
 * operator input (the honest-blocking rule).
 *
 * Verified behaviors (the W053 mission):
 *  - guard.check over the real REST API (INCR visible, TTL set);
 *  - epoch-anchored window behavior (deny beyond the limit with the
 *    correct retryAfter; a fresh window resets the counter);
 *  - fail-safe on an INVALID token (fail-open degraded + fail-closed
 *    deny — never a crash, never a raw provider error).
 *
 * Cost discipline: each guard.check is exactly ONE command (EVAL); the
 * verification keys use a per-run identity and short TTLs (≤ 2× the
 * test window) so the trial database self-cleans.
 */
import { describe, expect, it } from 'vitest';
import { UpstashRestGuard } from '../src/index';
import { fixedWindowKey } from '@epoch/application-gateway';

const restUrl = process.env['EPOCH_RATE_LIMIT_REST_URL'] ?? '';
const restToken = process.env['EPOCH_RATE_LIMIT_REST_TOKEN'] ?? '';
const LIVE = restUrl !== '' && restToken !== '';

/** A per-run identity so repeated verification runs never collide on keys. */
const RUN_ID = `live-verify-${Date.now().toString(36)}`;
const WINDOW_MS = 10_000;
const LIMIT = 3;
/** A deterministic instant INSIDE a window (>= 2s from either edge). */
function anchoredNow(): number {
  const now = Date.now();
  const intoWindow = now % WINDOW_MS;
  return now - intoWindow + 2_000; // 2s into the current window
}

/** Direct REST call for test assertions (reads state the guard produced). */
async function restCommand(args: readonly string[]): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(restUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${restToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { ok: response.ok, status: response.status, body: await response.json() };
}

describe.skipIf(!LIVE)('LIVE Upstash verification (real REST infrastructure; token redacted)', () => {
  it('guard.check over the real REST API: the counter INCRs and is visible via a direct read', async () => {
    const now = anchoredNow();
    const identity = `tenant:${RUN_ID}:incr`;
    const guard = new UpstashRestGuard({
      guardId: 'live-incr',
      scope: 'tenant',
      limit: 100,
      windowMs: WINDOW_MS,
      restUrl,
      restToken,
      timeoutMs: 5_000,
    });
    const first = await guard.check({
      operation: 'live.verification',
      tenantId: identity,
      sessionId: null,
      correlationId: 'corr:live-1',
      nowEpochMs: now,
    });
    const second = await guard.check({
      operation: 'live.verification',
      tenantId: identity,
      sessionId: null,
      correlationId: 'corr:live-2',
      nowEpochMs: now,
    });
    expect(first).toEqual({ allowed: true, limit: 100, remaining: 99, retryAfterMs: 0, degraded: false });
    expect(second.remaining).toBe(98);
    expect(second.degraded).toBe(false);
    // The counter the guard INCRemented is visible to a direct REST read
    // at the exact epoch-anchored key (the canonical derivation).
    const key = fixedWindowKey('tenant', identity, now, WINDOW_MS);
    const read = await restCommand(['GET', key]);
    expect(read.ok).toBe(true);
    expect((read.body as { result: string | null }).result).toBe('2');
    console.warn(
      `[live-upstash] INCR visible at ${restUrl.replace(/^https?:\/\//, '')} — key ${key} reads 2 after two checks; decisions remaining=${second.remaining} degraded=${second.degraded}`,
    );
  });

  it('the TTL is set on the live key (bounded key lifetime, quota-conserving)', async () => {
    const now = anchoredNow();
    const identity = `tenant:${RUN_ID}:ttl`;
    const guard = new UpstashRestGuard({
      guardId: 'live-ttl',
      scope: 'tenant',
      limit: 100,
      windowMs: WINDOW_MS,
      restUrl,
      restToken,
      timeoutMs: 5_000,
    });
    await guard.check({
      operation: 'live.verification',
      tenantId: identity,
      sessionId: null,
      correlationId: 'corr:live-ttl',
      nowEpochMs: now,
    });
    const key = fixedWindowKey('tenant', identity, now, WINDOW_MS);
    const ttl = await restCommand(['TTL', key]);
    expect(ttl.ok).toBe(true);
    const seconds = Number((ttl.body as { result: number }).result);
    // ttlSecondsOf(10s window) = 20; the EXPIRE NX only sets it on first
    // INCR, so a live read is (0, 20].
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(2 * (WINDOW_MS / 1_000));
    console.warn(`[live-upstash] TTL on ${key} = ${seconds}s (<= 2x window; self-expiring key)`);
  });

  it('live window behavior: deny beyond the limit with the epoch-anchored retryAfter; a fresh window resets', async () => {
    const now = anchoredNow();
    const identity = `tenant:${RUN_ID}:window`;
    const guard = new UpstashRestGuard({
      guardId: 'live-window',
      scope: 'tenant',
      limit: LIMIT,
      windowMs: WINDOW_MS,
      restUrl,
      restToken,
      timeoutMs: 5_000,
    });
    const base = {
      operation: 'live.verification',
      tenantId: identity,
      sessionId: null,
      correlationId: 'corr:live-window',
    };
    // The first `limit` checks pass; the next is denied with the correct
    // epoch-anchored retryAfter (window end - now).
    const decisions = [];
    for (let i = 0; i <= LIMIT; i += 1) {
      decisions.push(await guard.check({ ...base, nowEpochMs: now }));
    }
    expect(decisions.slice(0, LIMIT).every((d) => d.allowed)).toBe(true);
    const denied = decisions[LIMIT]!;
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.degraded).toBe(false);
    const expectedRetryAfter = (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS - now;
    expect(denied.retryAfterMs).toBe(expectedRetryAfter);
    // The NEXT epoch-anchored window is a FRESH key: the counter resets.
    const nextWindow = (Math.floor(now / WINDOW_MS) + 1) * WINDOW_MS + 1_000;
    const fresh = await guard.check({ ...base, nowEpochMs: nextWindow });
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(LIMIT - 1);
    console.warn(
      `[live-upstash] window behavior — ${LIMIT} allowed, ${LIMIT + 1}th denied (retryAfterMs=${denied.retryAfterMs}); next epoch-anchored window fresh (remaining=${fresh.remaining})`,
    );
  });

  it('fail-safe on an INVALID token: fail-open degraded (default) and fail-closed deny — never a crash', async () => {
    const contextBase = {
      operation: 'live.verification',
      tenantId: `tenant:${RUN_ID}:invalid-token`,
      sessionId: null,
      correlationId: 'corr:live-invalid',
      nowEpochMs: anchoredNow(),
    };
    const open = new UpstashRestGuard({
      guardId: 'live-invalid-open',
      scope: 'tenant',
      limit: 10,
      windowMs: WINDOW_MS,
      restUrl,
      restToken: 'invalid-token-live-verification',
      timeoutMs: 5_000,
    });
    const openDecision = await open.check(contextBase);
    expect(openDecision).toEqual({ allowed: true, limit: 10, remaining: 10, retryAfterMs: 0, degraded: true });
    const closed = new UpstashRestGuard({
      guardId: 'live-invalid-closed',
      scope: 'tenant',
      limit: 10,
      windowMs: WINDOW_MS,
      restUrl,
      restToken: 'invalid-token-live-verification',
      timeoutMs: 5_000,
      failurePolicy: 'fail-closed',
    });
    const closedDecision = await closed.check(contextBase);
    expect(closedDecision.allowed).toBe(false);
    expect(closedDecision.degraded).toBe(true);
    expect(closedDecision.retryAfterMs).toBeGreaterThan(0);
    console.warn(
      `[live-upstash] invalid token — fail-open: allowed=${openDecision.allowed} degraded=${openDecision.degraded}; fail-closed: allowed=${closedDecision.allowed} degraded=${closedDecision.degraded} (typed, never a raw provider error)`,
    );
  });
});

describe.skipIf(LIVE)('LIVE Upstash verification (inactive)', () => {
  it('skips cleanly without EPOCH_RATE_LIMIT_REST_URL/EPOCH_RATE_LIMIT_REST_TOKEN (CI stays hermetic)', () => {
    // Reaching here means LIVE is false: the suite above reported zero
    // executed tests and zero network calls. Production credentials
    // remain operator input (spec/architecture-change-requests/
    // ACR-006-public-deployment.md, the honest-blocking rule).
    expect(LIVE).toBe(false);
  });
});
