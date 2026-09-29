// The transport contract: envelope validation, the idempotency-key rule
// for mutating operations, the operation registry == frozen vocabulary,
// and the read-only projection cache.
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_GATEWAY_OPERATION_NAMES,
  APPLICATION_GATEWAY_OPERATIONS,
  QUEUEABLE_OPERATIONS,
  parseGatewayRequestEnvelope,
  requireIdempotencyKey,
  ProjectionCache,
  type GatewayRequestEnvelope,
} from '../src';

const ENVELOPE: GatewayRequestEnvelope = {
  schemaVersion: 1,
  contractVersion: '1.0.0',
  operation: 'world.snapshot',
  session: { schemaVersion: 1, sessionId: 'session:transport-test' },
  correlation: {
    schemaVersion: 1,
    correlationId: 'corr:transport-test',
    origin: 'web',
    issuedAt: '2026-01-05T08:00:00.000Z',
  },
  tenant: { tenantId: 'tenant:globex' },
  payload: { worldId: 'world:warehouse-site' },
};

describe('the gateway transport contract', () => {
  it('the operation registry covers EXACTLY the frozen operation-name vocabulary (no drift)', () => {
    expect(APPLICATION_GATEWAY_OPERATIONS.map((operation) => operation.name)).toEqual([
      ...APPLICATION_GATEWAY_OPERATION_NAMES,
    ]);
    expect(new Set(APPLICATION_GATEWAY_OPERATION_NAMES).size).toBe(APPLICATION_GATEWAY_OPERATION_NAMES.length);
  });

  it('every mutating operation requires an idempotency key; reads never do', () => {
    for (const operation of APPLICATION_GATEWAY_OPERATIONS) {
      const withKey: GatewayRequestEnvelope = {
        ...ENVELOPE,
        operation: operation.name,
        idempotencyKey: 'idem:transport-test',
        payload: {},
      };
      expect(requireIdempotencyKey(withKey)).toBeNull();
      if (operation.kind === 'mutate') {
        expect(
          requireIdempotencyKey({ ...ENVELOPE, operation: operation.name, payload: {} })?.code,
          `${operation.name} must require a key`,
        ).toBe('idempotency-key-required');
      } else {
        expect(requireIdempotencyKey({ ...ENVELOPE, operation: operation.name, payload: {} })).toBeNull();
      }
    }
  });

  it('a malformed key on a mutating operation is a typed validation error', () => {
    const error = requireIdempotencyKey({
      ...ENVELOPE,
      operation: 'action.submit',
      idempotencyKey: 'not-a-key',
      payload: {},
    });
    expect(error?.class).toBe('validation');
    expect(error?.code).toBe('idempotency-key-required');
  });

  it('a well-formed envelope parses; malformed envelopes are typed errors (never throw)', () => {
    const parsed = parseGatewayRequestEnvelope(ENVELOPE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.operation).toBe('world.snapshot');
    }
    const bad = parseGatewayRequestEnvelope({ ...ENVELOPE, operation: 'not.an-operation' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error.class).toBe('validation');
      expect(bad.error.code).toBe('request-envelope-malformed');
    }
  });

  it('unknown operations are rejected at the envelope, not at dispatch', () => {
    const bad = parseGatewayRequestEnvelope({ ...ENVELOPE, operation: 'world.rewrite' });
    expect(bad.ok).toBe(false);
  });

  it('the queueable allowlist is exactly the Action-Gateway-replayable set', () => {
    expect([...QUEUEABLE_OPERATIONS]).toEqual([
      'evidence.intake',
      'action.submit',
      'action.approve',
      'action.execute',
      'delivery.observe',
    ]);
  });
});

describe('the read-only projection cache', () => {
  it('admits server projections by digest + revision; immutable once admitted', () => {
    const cache = new ProjectionCache();
    const entry = cache.admitServerProjection({
      digest: 'a'.repeat(64),
      revision: 3,
      fetchedAt: '2026-01-05T08:00:00.000Z',
      content: { entities: 42 },
    });
    // Re-admitting the same digest returns the SAME entry (idempotent, immutable).
    const again = cache.admitServerProjection({
      digest: 'a'.repeat(64),
      revision: 99, // a different revision claim is IGNORED for an existing digest
      fetchedAt: '2026-01-05T09:00:00.000Z',
      content: { entities: 43 },
    });
    expect(again).toEqual(entry);
    expect(cache.size).toBe(1);
  });

  it('latest() returns the highest-revision cached projection', () => {
    const cache = new ProjectionCache();
    cache.admitServerProjection({ digest: 'a'.repeat(64), revision: 1, fetchedAt: '2026-01-05T08:00:00.000Z', content: {} });
    cache.admitServerProjection({ digest: 'b'.repeat(64), revision: 7, fetchedAt: '2026-01-05T08:00:00.000Z', content: {} });
    expect(cache.latest()?.revision).toBe(7);
  });

  it('the snapshot is deterministic (sorted by digest)', () => {
    const cache = new ProjectionCache();
    cache.admitServerProjection({ digest: 'b'.repeat(64), revision: 1, fetchedAt: '2026-01-05T08:00:00.000Z', content: {} });
    cache.admitServerProjection({ digest: 'a'.repeat(64), revision: 1, fetchedAt: '2026-01-05T08:00:00.000Z', content: {} });
    expect(cache.snapshot().map((entry) => entry.digest)).toEqual(['a'.repeat(64), 'b'.repeat(64)]);
  });

  it('there is NO mutation API on the cache (read-only by construction)', () => {
    const cache = new ProjectionCache();
    const mutatingMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(cache)).filter(
      (name) => name !== 'constructor' && name !== 'size' && name !== 'latest' && name !== 'snapshot' && name !== 'get' && name !== 'admitServerProjection',
    );
    expect(mutatingMethods).toEqual([]);
  });
});
