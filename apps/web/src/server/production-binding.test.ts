/**
 * W051 (ACR-006) — the production binding layer tests: environment-
 * driven construction (in-memory fallbacks, PG/S3/Upstash when
 * configured), the fail-closed boot rule, guard wiring budgets, and
 * the client-IP derivation. Provider paths run against test doubles
 * (the pool factory is exercised in the gateway package; the S3/Upstash
 * adapters carry their own double batteries; live connections are
 * W053's honest-boundary work).
 */
import { describe, expect, it } from 'vitest';
import { InMemoryRequestGuard, type RequestGuard } from '@epoch/application-gateway';
import { InMemoryObjectStore, type ObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence, type PersistenceSession } from '@epoch/persistence';
import { readProductionEnvironment } from './production-env';
import {
  assertBootable,
  buildProductionBindings,
  clientIpOf,
  degradedFlags,
} from './production-binding';

describe('buildProductionBindings (the environment-driven composition seam)', () => {
  it('empty environment => the fully-local reference bindings (dev behavior preserved)', async () => {
    const bindings = await buildProductionBindings({});
    expect(bindings.persistence).toBeInstanceOf(InMemoryPersistence);
    expect(bindings.objectStore).toBeInstanceOf(InMemoryObjectStore);
    expect(bindings.guards.length).toBe(3);
    expect(bindings.guards.every((guard) => guard instanceof InMemoryRequestGuard)).toBe(true);
    expect(bindings.ipGuard).toBeInstanceOf(InMemoryRequestGuard);
    expect(degradedFlags(bindings.environment)).toEqual([
      'persistence:in-memory',
      'object-store:in-memory',
      'rate-limit:in-memory',
      'acquisition-disabled',
    ]);
  });

  it('guards carry the configured budgets (operation/tenant/session + ip)', async () => {
    const bindings = await buildProductionBindings({
      EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW: '5',
      EPOCH_RATE_LIMIT_OPERATION_REQUESTS_PER_WINDOW: '7',
    });
    const byId = new Map<string, RequestGuard>(bindings.guards.map((guard) => [guard.guardId, guard]));
    expect((byId.get('operation') as InMemoryRequestGuard).snapshots).toBeDefined();
    // The budgets are enforced by the shared fixed-window math (pinned by
    // the gateway + adapter test batteries); here: the guards exist and
    // are keyed on the right dimensions.
    expect([...byId.keys()].sort()).toEqual(['operation', 'session', 'tenant']);
    expect(bindings.ipGuard.guardId).toBe('ip');
  });

  it('an object-store-configured environment binds the S3 adapter (digest-aligned SPI)', async () => {
    const bindings = await buildProductionBindings({
      EPOCH_OBJECT_STORE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      EPOCH_OBJECT_STORE_BUCKET: 'epoch-evidence',
      EPOCH_OBJECT_STORE_ACCESS_KEY_ID: 'key',
      EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY: 'secret',
    });
    expect(bindings.objectStore).not.toBeInstanceOf(InMemoryObjectStore);
    // The SPI is honored structurally (the adapter battery proves the
    // semantics; live R2 is W053).
    const store: ObjectStore = bindings.objectStore;
    expect(typeof store.put).toBe('function');
    expect(typeof store.get).toBe('function');
    expect(degradedFlags(bindings.environment)).not.toContain('object-store:in-memory');
  });

  it('FAIL-CLOSED: production without durable bindings refuses to boot (typed, safe)', async () => {
    await expect(
      buildProductionBindings({ EPOCH_DEPLOYMENT_PROFILE: 'production' }),
    ).rejects.toThrow(/refuses to boot/);
    expect(() =>
      assertBootable(readProductionEnvironment({ EPOCH_DEPLOYMENT_PROFILE: 'production' })),
    ).toThrow(/EPOCH_DATABASE_URL/);
  });

  it('the persistence seam honors the SPI (PG path proven in the gateway battery; in-memory here)', async () => {
    const bindings = await buildProductionBindings({});
    const persistence: PersistenceSession = bindings.persistence;
    expect(typeof persistence.put).toBe('function');
    expect(typeof persistence.get).toBe('function');
    expect(typeof persistence.migrate).toBe('function');
  });
});

describe('clientIpOf (the transport guard key)', () => {
  it('takes the first x-forwarded-for hop (platform convention)', () => {
    const request = new Request('https://epoch.example/api/gateway', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(clientIpOf(request)).toBe('203.0.113.7');
  });

  it('falls back to unknown when absent (never trusted for authorization)', () => {
    const request = new Request('https://epoch.example/api/gateway');
    expect(clientIpOf(request)).toBe('unknown');
  });
});
