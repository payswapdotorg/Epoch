// OUTBOUND flows: the scripted fixture delivery outcomes (success /
// retryable / terminal) surface as content-addressed per-attempt
// receipts through the REAL bridge runtime; the fallback machinery
// works through the SAME port when the scripted provider fails.
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  buildOutboundRequest,
  type LeastPrivilegeProjection,
} from '@epoch/external-event-bridge';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  ChatReferenceProvider,
  RETRYABLE_DELIVERY_SCRIPT,
  SUCCESS_DELIVERY_SCRIPT,
  TERMINAL_DELIVERY_SCRIPT,
  providerDeliveryRefOf,
  PROVIDER_T0,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_T3,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
} from '../src/index';

function gatePair(input: { actionKind: string; resourceId: string }) {
  const request = {
    schemaVersion: 1,
    principalId: PROVIDER_OPERATOR,
    actionKind: input.actionKind,
    resource: {
      resourceType: 'external-event-bridge',
      resourceId: input.resourceId,
      tenantId: PROVIDER_TENANT_A,
    },
  };
  return { request, decision: { requestDigest: canonicalDigest(request), outcome: 'allow' as const } };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const PROJECTION: LeastPrivilegeProjection = {
  policyDigest: 'ab'.repeat(32),
  recipientRef: 'role:site-supervisor',
  fieldAllowlist: ['activityTitle', 'statusSummary'],
};

function buildRequest(requestId: string, idempotencyKey: string) {
  return unwrap(
    buildOutboundRequest(
      {
        requestId,
        tenantId: PROVIDER_TENANT_A,
        requestClass: 'information',
        recipientRef: 'role:site-supervisor',
        correlationId: 'corr:outbound-1',
        causationId: null,
        createdAt: PROVIDER_T1,
        createdBy: PROVIDER_OPERATOR,
        idempotencyKey,
        rawPayload: {
          activityTitle: 'Confirm grid B4 depth',
          statusSummary: 'Awaiting field confirmation',
          internalCommercialNote: 'penalty threshold',
        },
      },
      PROJECTION,
    ),
  );
}

function register(runtime: ExternalEventBridgeRuntime, script: readonly unknown[]) {
  unwrap(
    runtime.registerProvider({
      provider: new ChatReferenceProvider({ deliveryScript: script as never }),
      tenantId: PROVIDER_TENANT_A,
      registeredAt: PROVIDER_T0,
      registeredBy: PROVIDER_OPERATOR,
      authorization: gatePair({
        actionKind: 'bridge.provider-registration',
        resourceId: 'registration:external-chat-reference',
      }),
    }),
  );
}

describe('outbound: scripted fixture delivery outcomes', () => {
  it('a success script delivers with a content-addressed provider delivery reference', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    register(runtime, SUCCESS_DELIVERY_SCRIPT);
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: buildRequest('outbound:info-1', 'idem:out-1'),
        projection: PROJECTION,
        retryPolicy: { attemptInstants: [PROVIDER_T1] },
        detectedAt: PROVIDER_T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind === 'delivered') {
      expect(outcome.receipts).toHaveLength(1);
      expect(outcome.receipts[0]!.providerDeliveryRef).toMatch(/^delivery-[0-9a-f]{24}$/);
    }
  });

  it('a retryable script produces per-attempt receipts and then delivers', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    register(runtime, RETRYABLE_DELIVERY_SCRIPT);
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: buildRequest('outbound:info-1', 'idem:out-1'),
        projection: PROJECTION,
        retryPolicy: { attemptInstants: [PROVIDER_T1, PROVIDER_T2, PROVIDER_T3] },
        detectedAt: PROVIDER_T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind === 'delivered') {
      expect(outcome.receipts.map((r) => r.outcome)).toEqual(['retryable', 'success']);
      expect(outcome.receipts[0]!.detail).toBe('provider fixture congestion');
      expect(outcome.receipts[1]!.providerDeliveryRef).toMatch(/^delivery-[0-9a-f]{24}$/);
    }
  });

  it('a terminal script fails explicitly (receipts carried, no fabrication)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    register(runtime, TERMINAL_DELIVERY_SCRIPT);
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: buildRequest('outbound:info-1', 'idem:out-1'),
        projection: PROJECTION,
        retryPolicy: { attemptInstants: [PROVIDER_T1, PROVIDER_T2] },
        detectedAt: PROVIDER_T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivery-failed');
    if (outcome.kind === 'delivery-failed') {
      expect(outcome.receipts.map((r) => r.outcome)).toEqual(['terminal']);
      expect(outcome.receipts[0]!.detail).toBe('the provider fixture refuses this delivery');
    }
  });

  it('a terminal script with a manual-queue fallback becomes a pending manual work item', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    register(runtime, TERMINAL_DELIVERY_SCRIPT);
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: buildRequest('outbound:info-1', 'idem:out-1'),
        projection: PROJECTION,
        retryPolicy: { attemptInstants: [PROVIDER_T1] },
        fallbackPolicy: { mode: 'manual-queue' },
        detectedAt: PROVIDER_T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('manual-queued');
    if (outcome.kind === 'manual-queued') {
      expect(outcome.manual.reason).toBe('delivery-terminal');
      expect(outcome.manual.resolution).toBe('pending');
    }
  });

  it('the provider delivery reference is content-addressed over (request, attempt)', () => {
    const request = {
      requestId: 'outbound:info-1',
      tenantId: PROVIDER_TENANT_A,
      requestClass: 'information' as const,
      recipientRef: 'role:site-supervisor',
      correlationId: 'corr:outbound-1',
      causationId: null,
      payload: { released: [], redacted: [] },
      projectionDigest: 'ab'.repeat(32),
    };
    const a = providerDeliveryRefOf(request, { attemptNo: 1, scheduledAt: PROVIDER_T1 });
    const b = providerDeliveryRefOf(request, { attemptNo: 1, scheduledAt: PROVIDER_T1 });
    const c = providerDeliveryRefOf(request, { attemptNo: 2, scheduledAt: PROVIDER_T2 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^delivery-[0-9a-f]{24}$/);
  });

  it('duplicate dispatch is idempotent (the prior conclusion, no second provider call)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const provider = new ChatReferenceProvider({ deliveryScript: SUCCESS_DELIVERY_SCRIPT });
    unwrap(
      runtime.registerProvider({
        provider,
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T0,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:external-chat-reference',
        }),
      }),
    );
    const input = {
      request: buildRequest('outbound:info-1', 'idem:out-1'),
      projection: PROJECTION,
      retryPolicy: { attemptInstants: [PROVIDER_T1] },
      detectedAt: PROVIDER_T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    };
    const first = unwrap(runtime.dispatchOutboundRequest(input));
    const second = unwrap(runtime.dispatchOutboundRequest(input));
    expect(first.kind).toBe('delivered');
    expect(second.kind).toBe('duplicate-dispatch-returned');
    expect(provider.deliveredRequests).toHaveLength(1);
  });
});
