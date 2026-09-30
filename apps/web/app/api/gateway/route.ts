/**
 * @epoch/web — the Gateway transport endpoint (W047).
 *
 * THE ONLY server-facing mutation/read path of the web product: every
 * request is a `GatewayRequestEnvelope` over the frozen
 * @epoch/client-runtime vocabulary, dispatched through the W046
 * `ApplicationGateway` (which composes the real authorities — session
 * gate, tenant gate, idempotency, W009 authorization, correlation ledger).
 *
 * The UI cannot bypass the Action Gateway through this endpoint: the
 * envelope schema accepts ONLY registered operations (`action.submit` /
 * `action.approve` / `action.execute` delegate to the EXECUTION authority);
 * unknown operations are rejected before dispatch; raw kernel payloads are
 * never accepted.
 *
 * Routing: one gateway per fixture tenant (tenant:nordstrand construction /
 * tenant:lightspeed software). `session.issue` routes by its payload
 * tenant; every other operation routes by the envelope tenant scope — a
 * session from another tenant is unknown there and fails closed
 * (auth-session-expired; R12 tenant isolation).
 */
import { NextResponse } from 'next/server';
import { gatewayError } from '@epoch/client-runtime';
import type { GatewayRequestEnvelope } from '@epoch/client-runtime';
import { getProductRuntime } from '@/server/product-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Extract the tenant the request belongs to (fail-closed on unknown tenants). */
function tenantOf(body: unknown): { readonly ok: true; readonly tenantId: string } | { readonly ok: false } {
  const record = asRecord(body);
  const envelope = asRecord(record['tenant']);
  let tenantId = typeof envelope['tenantId'] === 'string' ? envelope['tenantId'] : undefined;
  if (tenantId === undefined && record['operation'] === 'session.issue') {
    const payload = asRecord(record['payload']);
    if (typeof payload['tenantId'] === 'string') tenantId = payload['tenantId'];
  }
  return tenantId === undefined ? { ok: false } : { ok: true, tenantId };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'request-envelope-malformed',
          message: 'the request body is not valid JSON',
          operation: 'gateway',
          correlationId: 'corr:unattributed',
        }),
      },
      { status: 400 },
    );
  }
  const runtime = await getProductRuntime();
  const tenant = tenantOf(body);
  if (!tenant.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'request-validation',
          message: 'the request does not declare a tenant served by this deployment',
          operation: 'gateway',
          correlationId: 'corr:unattributed',
        }),
      },
      { status: 400 },
    );
  }
  const environment = runtime.gatewayForTenant(tenant.tenantId);
  if (environment === undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'request-validation',
          message: `no environment is bound for tenant "${tenant.tenantId}"`,
          operation: 'gateway',
          correlationId: 'corr:unattributed',
        }),
      },
      { status: 400 },
    );
  }
  const result = await environment.gateway.call(body as GatewayRequestEnvelope);
  return NextResponse.json(result);
}
