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
import { clientIpOf, getProductionBindings } from '@/server/production-binding';

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
  // Transport-level request guard (W051, ACR-006): the client-keyed
  // (IP) fixed-window budget — abuse control BEFORE anything else. A
  // denial is the typed `transient`/`gateway-overloaded` envelope with
  // HTTP 429 (retryable with backoff). This never weakens the session /
  // tenant / authorization gates below.
  const bindings = await getProductionBindings();
  const ipDecision = await bindings.ipGuard.check({
    operation: 'gateway',
    tenantId: null,
    sessionId: null,
    clientKey: clientIpOf(request),
    correlationId: 'corr:unattributed',
    nowEpochMs: Date.now(),
  });
  if (!ipDecision.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayError({
          class: 'transient',
          code: 'gateway-overloaded',
          message: 'rate limit exceeded: retry after the indicated delay',
          operation: 'gateway',
          correlationId: 'corr:unattributed',
          details: {
            rateLimit: {
              guardId: bindings.ipGuard.guardId,
              limit: ipDecision.limit,
              remaining: ipDecision.remaining,
              retryAfterMs: ipDecision.retryAfterMs,
              degraded: ipDecision.degraded,
            },
          },
        }),
      },
      { status: 429, headers: { 'retry-after': String(Math.ceil(ipDecision.retryAfterMs / 1000)) } },
    );
  }

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
  // Request-size limit (W051, ACR-006 S10): reject oversized payloads
  // before JSON parsing work (the gateway envelopes are small).
  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(contentLength) && contentLength > 1_048_576) {
    return NextResponse.json(
      {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'request-envelope-malformed',
          message: 'the request body exceeds the 1 MiB gateway limit',
          operation: 'gateway',
          correlationId: 'corr:unattributed',
        }),
      },
      { status: 413 },
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
