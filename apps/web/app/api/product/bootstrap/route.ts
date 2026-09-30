/**
 * @epoch/web — the product bootstrap endpoint (W047).
 *
 * Returns the deployment configuration of one fixture domain: the verified
 * fixture records (solution / program of work / delivery / evidence /
 * journey scenario scripts), the registry anchor digests, and the
 * deterministic journey payload templates (compiled constraint, discovery
 * input + candidate catalog, action proposal, acquisition bases,
 * kernel-sealed records the frozen vocabulary requires pre-sealed).
 *
 * This is CONFIGURATION, not a second semantic read authority: kernel
 * semantics are still read through Gateway operations (world.snapshot,
 * world.entities, evidence.get, action.status, events.read). A valid
 * session is required (validated through the gateway's own session
 * authority) so configuration is never exposed cross-tenant.
 */
import { NextResponse } from 'next/server';
import { getProductRuntime } from '@/server/product-runtime';
import { productConfiguration } from '@/server/product-config';
import { PRODUCT_DOMAINS, type ProductDomain } from '@/server/fixture-bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { readonly domain?: unknown; readonly sessionId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  const domain = body.domain;
  const sessionId = body.sessionId;
  if (typeof domain !== 'string' || !PRODUCT_DOMAINS.includes(domain as ProductDomain)) {
    return NextResponse.json({ ok: false, error: 'unknown-domain' }, { status: 400 });
  }
  if (typeof sessionId !== 'string' || sessionId === '') {
    return NextResponse.json({ ok: false, error: 'session-required' }, { status: 400 });
  }
  const runtime = await getProductRuntime();
  const environment = runtime.environmentForDomain(domain as ProductDomain);
  if (environment === undefined) {
    return NextResponse.json({ ok: false, error: 'unknown-domain' }, { status: 400 });
  }
  // Session gate: the authoritative validation THROUGH the gateway itself
  // (the session authority decides — this route never evaluates sessions).
  const validation = await environment.gateway.call({
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation: 'session.validate',
    session: { schemaVersion: 1, sessionId },
    correlation: {
      schemaVersion: 1,
      correlationId: 'corr:product-bootstrap',
      origin: 'server',
      issuedAt: new Date().toISOString(),
    },
    tenant: { tenantId: environment.tenantId },
    payload: {},
  });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: 'auth-session-expired' }, { status: 401 });
  }
  const session = validation.value.result as { tenantId: string; state: string };
  if (session.state !== 'active' || session.tenantId !== environment.tenantId) {
    return NextResponse.json({ ok: false, error: 'auth-session-expired' }, { status: 401 });
  }
  const configuration = productConfiguration(environment.bundle, environment.worldDigest);
  return NextResponse.json({ ok: true, configuration });
}
