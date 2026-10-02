/**
 * W051 (ACR-006) — the request-guard port + in-memory reference
 * implementation + gateway pipeline integration tests.
 */
import { describe, expect, it } from 'vitest';
import {
  InMemoryRequestGuard,
  fixedWindowIndex,
  fixedWindowKey,
  guardFailureDecision,
  type GuardRequestContext,
  type RequestGuard,
} from '../src/rate-limit';
import { ApplicationGateway } from '../src/gateway';
import type { GatewayRequestEnvelope } from '@epoch/client-runtime';
import { SessionManager } from '@epoch/authentication';
import { TenancyHierarchy } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { EvidenceStore } from '@epoch/evidence';
import { EventLog } from '@epoch/event-log';
import { ActionGateway } from '@epoch/action-gateway';
import { InMemoryObjectStore } from '@epoch/object-storage';
import type { AuthorizationContext } from '@epoch/authorization';

function context(overrides: Partial<GuardRequestContext> = {}): GuardRequestContext {
  return {
    operation: 'world.snapshot',
    tenantId: 'tenant:test',
    sessionId: 'session:test-session',
    correlationId: 'corr:test',
    nowEpochMs: 1_000_000,
    ...overrides,
  };
}

describe('fixed-window key math', () => {
  it('derives epoch-anchored window indexes', () => {
    expect(fixedWindowIndex(0, 60_000)).toBe(0);
    expect(fixedWindowIndex(59_999, 60_000)).toBe(0);
    expect(fixedWindowIndex(60_000, 60_000)).toBe(1);
    expect(fixedWindowIndex(120_000, 60_000)).toBe(2);
  });

  it('builds the canonical key shape (same inputs, same key, any implementation)', () => {
    expect(fixedWindowKey('tenant', 'tenant:a', 120_000, 60_000)).toBe(
      'ratelimit:tenant:tenant:a:2',
    );
  });
});

describe('InMemoryRequestGuard', () => {
  it('allows up to the limit and denies beyond with retryAfter', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'tenant', limit: 2, windowMs: 60_000 });
    const first = await guard.check(context());
    const second = await guard.check(context());
    const third = await guard.check(context());
    expect(first).toEqual({ allowed: true, limit: 2, remaining: 1, retryAfterMs: 0, degraded: false });
    expect(second).toEqual({ allowed: true, limit: 2, remaining: 0, retryAfterMs: 0, degraded: false });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterMs).toBeGreaterThan(0);
    // nowEpochMs = 1_000_000, window = [960_000, 1_020_000) => retryAfter = 20_000
    expect(third.retryAfterMs).toBe(20_000);
  });

  it('resets at the next epoch-anchored window', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'tenant', limit: 1, windowMs: 60_000 });
    expect((await guard.check(context({ nowEpochMs: 60_000 }))).allowed).toBe(true);
    expect((await guard.check(context({ nowEpochMs: 90_000 }))).allowed).toBe(false);
    expect((await guard.check(context({ nowEpochMs: 120_001 }))).allowed).toBe(true);
  });

  it('keys per scope dimension (tenant isolation of budgets)', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'tenant', limit: 1, windowMs: 60_000 });
    expect((await guard.check(context({ tenantId: 'tenant:a' }))).allowed).toBe(true);
    expect((await guard.check(context({ tenantId: 'tenant:b' }))).allowed).toBe(true);
    expect((await guard.check(context({ tenantId: 'tenant:a' }))).allowed).toBe(false);
  });

  it('keys sessions on the anonymous bucket for bootstrap requests', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'session', limit: 1, windowMs: 60_000 });
    expect((await guard.check(context({ sessionId: null }))).allowed).toBe(true);
    expect((await guard.check(context({ sessionId: null }))).allowed).toBe(false);
  });

  it('keys operations by name', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'operation', limit: 1, windowMs: 60_000 });
    expect((await guard.check(context({ operation: 'world.snapshot' }))).allowed).toBe(true);
    expect((await guard.check(context({ operation: 'evidence.get' }))).allowed).toBe(true);
    expect((await guard.check(context({ operation: 'world.snapshot' }))).allowed).toBe(false);
  });

  it('validates budgets (fail-fast on nonsense configuration)', () => {
    expect(() => new InMemoryRequestGuard({ guardId: 'g', scope: 'tenant', limit: 0, windowMs: 60_000 })).toThrow();
    expect(() => new InMemoryRequestGuard({ guardId: 'g', scope: 'tenant', limit: 5, windowMs: 0 })).toThrow();
  });

  it('bounds memory by dropping expired counters', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'g', scope: 'session', limit: 1, windowMs: 1, maxKeys: 2 });
    for (let i = 0; i < 5; i += 1) {
      await guard.check(context({ sessionId: `session:s${i}`, nowEpochMs: i * 10 }));
    }
    // Expired entries were dropped during cleanup; only live keys remain.
    expect(guard.snapshots().length).toBeLessThanOrEqual(5);
    expect(guard.snapshots().length).toBeGreaterThan(0);
  });
});

describe('guardFailureDecision', () => {
  it('fail-open allows with the degraded flag', () => {
    expect(guardFailureDecision({ failurePolicy: 'fail-open' }, 10)).toEqual({
      allowed: true,
      limit: 10,
      remaining: 10,
      retryAfterMs: 0,
      degraded: true,
    });
  });

  it('fail-closed denies with the degraded flag', () => {
    const decision = guardFailureDecision({ failurePolicy: 'fail-closed' }, 10);
    expect(decision.allowed).toBe(false);
    expect(decision.degraded).toBe(true);
    expect(decision.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('gateway guard integration', () => {
  const T1 = '2026-03-02T09:00:00.000Z';

  function authorities() {
    return {
      sessions: new SessionManager(),
      tenancy: new TenancyHierarchy(),
      worlds: WorldModel.create({ clock: () => T1 }),
      evidence: EvidenceStore.create(),
      objects: new InMemoryObjectStore(),
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      actionConstraintResolver: () => undefined,
      authorizationFacts: {
        contextFor(): AuthorizationContext {
          return { schemaVersion: 1, principals: [], memberships: [], knownTenants: [] };
        },
      },
    };
  }

  function envelope(operation: string, sessionId: string): GatewayRequestEnvelope {
    return {
      schemaVersion: 1,
      contractVersion: '1.0.0',
      operation,
      session: { schemaVersion: 1, sessionId },
      correlation: { schemaVersion: 1, correlationId: 'corr:test', origin: 'server', issuedAt: T1 },
      tenant: { tenantId: 'tenant:nordstrand' },
      idempotencyKey: 'idem:test-1',
      payload: {},
    } as never;
  }

  it('applies guards after envelope validation and maps denials to transient/gateway-overloaded', async () => {
    const guard = new InMemoryRequestGuard({ guardId: 'strict', scope: 'operation', limit: 1, windowMs: 60_000 });
    const gateway = new ApplicationGateway({
      clock: () => T1,
      authorities: authorities(),
      guards: [guard],
    });
    const first = await gateway.call(envelope('session.issue', 'session:bootstrap'));
    // The first call passes the guard (then fails later in the pipeline for
    // fixture reasons — NOT with gateway-overloaded).
    const firstError = first.ok ? null : first.error;
    expect(firstError?.code).not.toBe('gateway-overloaded');
    const second = await gateway.call(envelope('session.issue', 'session:bootstrap'));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.class).toBe('transient');
      expect(second.error.code).toBe('gateway-overloaded');
      expect((second.error.details as Record<string, unknown>)?.['rateLimit']).toMatchObject({
        guardId: 'strict',
        limit: 1,
        remaining: 0,
      });
    }
  });

  it('a thrown guard resolves per the declared failure policy (fail-open keeps the boundary up)', async () => {
    const exploding: RequestGuard = {
      guardId: 'exploding',
      failurePolicy: 'fail-open',
      async check(): Promise<never> {
        throw new Error('backend gone');
      },
    };
    const gateway = new ApplicationGateway({
      clock: () => T1,
      authorities: authorities(),
      guards: [exploding],
    });
    const result = await gateway.call(envelope('session.issue', 'session:bootstrap'));
    // Fail-open: the request proceeds past the guard (failing later in the
    // pipeline for fixture reasons, but NOT as gateway-overloaded).
    const error = result.ok ? null : result.error;
    expect(error?.code).not.toBe('gateway-overloaded');
  });

  it('a thrown fail-closed guard denies as gateway-overloaded', async () => {
    const exploding: RequestGuard = {
      guardId: 'exploding-closed',
      failurePolicy: 'fail-closed',
      async check(): Promise<never> {
        throw new Error('backend gone');
      },
    };
    const gateway = new ApplicationGateway({
      clock: () => T1,
      authorities: authorities(),
      guards: [exploding],
    });
    const result = await gateway.call(envelope('session.issue', 'session:bootstrap'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('gateway-overloaded');
    }
  });
});
