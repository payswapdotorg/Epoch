/**
 * The product runtime composition tests (W047): the server-side binding of
 * the W046 ApplicationGateway over the committed fixture bytes — boot
 * verification (digests), session issuance, read projections, and the
 * gateway-bypass negative (only envelope operations reach authorities).
 */
import { describe, expect, it } from 'vitest';
import { GatewayOutcomeSchema, isGatewayOperationName } from '@epoch/client-runtime';
import type { GatewayRequestEnvelope } from '@epoch/client-runtime';
import { getProductRuntime, authenticatePrincipal } from './product-runtime';
import { loadFixtureBundles, registryAnchors, PRODUCT_DOMAINS } from './fixture-bundle';

const CORR = 'corr:runtime-test';

function envelope(
  operation: GatewayRequestEnvelope['operation'],
  sessionId: string,
  tenantId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): GatewayRequestEnvelope {
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId },
    correlation: { schemaVersion: 1, correlationId: CORR, origin: 'web', issuedAt: '2026-03-02T18:00:00.000Z' },
    tenant: { tenantId },
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    payload: payload as never,
  };
}

async function issueSession(
  gateway: import('@epoch/application-gateway').ApplicationGateway,
  tenantId: string,
  principalId: string,
  ttlMs = 3_600_000,
): Promise<string> {
  const runtime = await getProductRuntime();
  const environment = runtime.gatewayForTenant(tenantId);
  if (environment === undefined) throw new Error('missing environment');
  const authentication = authenticatePrincipal(environment, principalId);
  const result = await gateway.call(
    envelope('session.issue', 'session:bootstrap', tenantId, {
      authentication,
      principalId,
      tenantId,
      ttlMs,
      nonce: `nonce:${principalId}-${Date.now()}`,
    }, `idem:session-${principalId.replace(/[^a-z0-9-]+/g, '')}-${ttlMs}-${Date.now()}`),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return (result.value.result as { sessionId: string }).sessionId;
}

describe('the product runtime over the committed fixtures (W047)', () => {
  it('boot-verifies every fixture file against the committed registry digests', () => {
    const bundles = loadFixtureBundles();
    const anchors = registryAnchors(bundles);
    expect(bundles.size).toBe(PRODUCT_DOMAINS.length);
    for (const domain of PRODUCT_DOMAINS) {
      const bundle = bundles.get(domain)!;
      const anchor = anchors.get(domain)!;
      expect(bundle.tenantId).toMatch(/^tenant:/);
      expect(bundle.fixtureId).toBe(`epoch-fixture-${domain}-v1.0.0`);
      expect(anchor.worldDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(bundle.files)).toHaveLength(10);
    }
  });

  it('restores the fixture worlds byte-exactly (digest equality, boot verification)', async () => {
    const runtime = await getProductRuntime();
    const anchors = registryAnchors(loadFixtureBundles());
    for (const domain of PRODUCT_DOMAINS) {
      const environment = runtime.environmentForDomain(domain)!;
      expect(environment.worldDigest).toBe(anchors.get(domain)!.worldDigest);
    }
  });

  it('issues sessions from fixture-authenticated principals and projects the world through the gateway', async () => {
    const runtime = await getProductRuntime();
    const environment = runtime.environmentForDomain('construction')!;
    const sessionId = await issueSession(environment.gateway, environment.tenantId, 'principal:delivery-lead');
    expect(sessionId).toMatch(/^session:/);

    const snapshot = await environment.gateway.call(
      envelope('world.snapshot', sessionId, environment.tenantId, {}),
    );
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      expect(() => GatewayOutcomeSchema.parse(snapshot.value)).not.toThrow();
      const result = snapshot.value.result as { digest: string; snapshot: unknown };
      expect(result.digest).toBe(environment.worldDigest);
      expect((result.snapshot as { assertions: unknown[] }).assertions.length).toBeGreaterThan(0);
    }

    const entities = await environment.gateway.call(
      envelope('world.entities', sessionId, environment.tenantId, {}),
    );
    expect(entities.ok).toBe(true);
    if (entities.ok) {
      // The gateway returns the full entity projection; the UI filters by
      // entity type as a presentation projection (W046 note: the service
      // passes the filter under a key the kernel ignores — recorded as an
      // advisory question, compensated client-side).
      const all = entities.value.result as { id: string; type: string }[];
      expect(all.length).toBe(8);
      expect(all.filter((entity) => entity.type === 'construct:boq-item')).toHaveLength(3);
    }
  });

  it('rejects cross-tenant sessions fail-closed (a nordstrand session is unknown in lightspeed)', async () => {
    const runtime = await getProductRuntime();
    const construction = runtime.environmentForDomain('construction')!;
    const software = runtime.environmentForDomain('software')!;
    const sessionId = await issueSession(construction.gateway, construction.tenantId, 'principal:delivery-lead');
    const result = await software.gateway.call(
      envelope('world.entities', sessionId, software.tenantId, {}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('auth-session-expired');
    }
  });

  it('rejects unregistered operations before dispatch (the UI cannot invent operations)', async () => {
    const runtime = await getProductRuntime();
    const environment = runtime.environmentForDomain('construction')!;
    const sessionId = await issueSession(environment.gateway, environment.tenantId, 'principal:delivery-lead');
    const bogus = {
      ...envelope('world.entities', sessionId, environment.tenantId, {}),
      operation: 'kernel.world.mutate-directly',
    };
    expect(isGatewayOperationName(bogus.operation)).toBe(false);
    const result = await environment.gateway.call(bogus as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Envelope validation rejects the unknown operation.
      expect(['validation', 'unrecoverable']).toContain(result.error.class);
    }
  });

  it('expires short-lived sessions (J11 precondition) and re-authentication succeeds', async () => {
    const runtime = await getProductRuntime();
    const environment = runtime.environmentForDomain('construction')!;
    const sessionId = await issueSession(
      environment.gateway,
      environment.tenantId,
      'principal:delivery-lead',
      1, // 1ms — expires immediately.
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const result = await environment.gateway.call(
      envelope('world.entities', sessionId, environment.tenantId, {}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('auth-session-expired');
      expect((result.error.details as { reauthRequired?: boolean } | null)?.reauthRequired).toBe(true);
    }
    // Re-authentication issues a fresh usable session.
    const fresh = await issueSession(environment.gateway, environment.tenantId, 'principal:delivery-lead');
    const ok = await environment.gateway.call(
      envelope('world.entities', fresh, environment.tenantId, {}),
    );
    expect(ok.ok).toBe(true);
  });
});

describe('the tenant-scoped session authority (W055, F-1 closure)', () => {
  it('REGRESSION (F-1): a foreign-domain authentication result CANNOT issue a session in another tenant', async () => {
    const runtime = await getProductRuntime();
    const construction = runtime.environmentForDomain('construction')!;
    const software = runtime.environmentForDomain('software')!;
    // The construction identity boundary mints a verified result for its
    // own registered principal...
    const foreignAuthentication = authenticatePrincipal(construction, 'principal:delivery-lead');
    expect(foreignAuthentication.outcome).toBe('verified');
    // ...which the SOFTWARE tenant's session authority must now REJECT
    // (the W052 P18 finding: the frozen manager validated principal↔result
    // and tenant↔manager scope but not result↔tenant identity registry).
    const issuance = await software.gateway.call(
      envelope('session.issue', 'session:bootstrap', software.tenantId, {
        authentication: foreignAuthentication,
        principalId: 'principal:delivery-lead',
        tenantId: software.tenantId,
        ttlMs: 3_600_000,
        nonce: `nonce:f1-regression-${Date.now()}`,
      }, `idem:f1-regression-${Date.now()}`),
    );
    expect(issuance.ok).toBe(false);
    if (!issuance.ok) {
      expect(issuance.error.class).toBe('authority-rejected');
      const details = issuance.error.details as { authorityCode?: string } | null;
      expect(details?.authorityCode).toBe('authentication-tenant-mismatch');
    }
  });

  it('the SAME-domain authentication result still issues normally (no regression of the legitimate flow)', async () => {
    const runtime = await getProductRuntime();
    const construction = runtime.environmentForDomain('construction')!;
    const authentication = authenticatePrincipal(construction, 'principal:delivery-lead');
    const issuance = await construction.gateway.call(
      envelope('session.issue', 'session:bootstrap', construction.tenantId, {
        authentication,
        principalId: 'principal:delivery-lead',
        tenantId: construction.tenantId,
        ttlMs: 3_600_000,
        nonce: `nonce:f1-legit-${Date.now()}`,
      }, `idem:f1-legit-${Date.now()}`),
    );
    expect(issuance.ok).toBe(true);
  });

  it('an unregistered principal cannot issue a session even with a well-formed result shape (fail-closed)', async () => {
    const runtime = await getProductRuntime();
    const construction = runtime.environmentForDomain('construction')!;
    const authentication = authenticatePrincipal(construction, 'principal:delivery-lead');
    const issuance = await construction.gateway.call(
      envelope('session.issue', 'session:bootstrap', construction.tenantId, {
        authentication: { ...authentication, principalId: 'principal:not-registered' },
        principalId: 'principal:not-registered',
        tenantId: construction.tenantId,
        ttlMs: 3_600_000,
        nonce: `nonce:f1-unregistered-${Date.now()}`,
      }, `idem:f1-unregistered-${Date.now()}`),
    );
    expect(issuance.ok).toBe(false);
  });
});
