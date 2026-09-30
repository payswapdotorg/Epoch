/**
 * @epoch/web — the fixture-deployment identity-provider boundary (W047).
 *
 * Sign-in: verifies a registered fixture principal and returns the
 * identity authority's VERIFIED authentication result (the committed
 * fixture result for the domain lead; a kernel-sealed runtime result for
 * the other registered principals). The client then issues its session
 * through the Gateway (`session.issue`) — this endpoint mints no session
 * and no semantic state.
 */
import { NextResponse } from 'next/server';
import { getProductRuntime, authenticatePrincipal } from '@/server/product-runtime';
import { PRODUCT_DOMAINS, type ProductDomain } from '@/server/fixture-bundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { readonly domain?: unknown; readonly principalId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }
  const domain = body.domain;
  const principalId = body.principalId;
  if (typeof domain !== 'string' || !PRODUCT_DOMAINS.includes(domain as ProductDomain)) {
    return NextResponse.json({ ok: false, error: 'unknown-domain' }, { status: 400 });
  }
  if (typeof principalId !== 'string' || principalId === '') {
    return NextResponse.json({ ok: false, error: 'principal-required' }, { status: 400 });
  }
  const runtime = await getProductRuntime();
  const environment = runtime.environmentForDomain(domain as ProductDomain);
  if (environment === undefined) {
    return NextResponse.json({ ok: false, error: 'unknown-domain' }, { status: 400 });
  }
  try {
    const authentication = authenticatePrincipal(environment, principalId);
    return NextResponse.json({
      ok: true,
      domain,
      tenantId: environment.tenantId,
      authentication,
    });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: String(cause) }, { status: 400 });
  }
}
