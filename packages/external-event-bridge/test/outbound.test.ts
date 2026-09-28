// OUTBOUND positive flows: least-privilege filtering (released by
// reference + typed redaction markers), four-class dispatch, per-attempt
// receipts with the retry schedule as typed DATA, and all three
// fallback outcomes (fallback | manual-queue | alternative-provider)
// exercised through the SAME bridge API.
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  filterOutboundPayload,
  walkOutboundLeaves,
  type ProviderDeliveryOutcome,
} from '../src/index';
import {
  GENERIC_DESCRIPTOR_A,
  GENERIC_DESCRIPTOR_B,
  PRINCIPAL,
  RAW_INFORMATION_PAYLOAD,
  TENANT_A,
  T0,
  T1,
  T2,
  T3,
  deliveringProvider,
  referenceProjection,
  terminalProvider,
} from './fixtures';
import { gatePair, informationRequest, unwrap } from './helpers';

function runtimeWith(variant: 'delivering' | 'terminal'): {
  runtime: ExternalEventBridgeRuntime;
  provider: ReturnType<typeof deliveringProvider>;
} {
  const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
  const provider =
    variant === 'delivering' ? deliveringProvider(GENERIC_DESCRIPTOR_A) : terminalProvider(GENERIC_DESCRIPTOR_A);
  unwrap(
    runtime.registerProvider({
      provider,
      tenantId: TENANT_A,
      registeredAt: T0,
      registeredBy: PRINCIPAL,
      authorization: gatePair({
        actionKind: 'bridge.provider-registration',
        resourceId: 'registration:generic-alpha',
      }),
    }),
  );
  return { runtime, provider };
}

describe('outbound: least-privilege filtering', () => {
  it('releases the minimum-necessary fields BY REFERENCE and strikes the rest with typed markers', () => {
    const filtered = filterOutboundPayload(
      RAW_INFORMATION_PAYLOAD as Record<string, never>,
      referenceProjection(),
    );
    expect(filtered.released.map((field) => field.path)).toEqual([
      'activityTitle',
      'questions[0].channel',
      'questions[0].text',
      'statusSummary',
      'workPackageRef',
    ]);
    expect(filtered.released.find((f) => f.path === 'activityTitle')?.value).toBe(
      'Excavate grid B4 to foundation level',
    );
    expect(filtered.redacted.map((marker) => marker.path)).toEqual([
      'internalCommercialNote',
      'supplierIdentity',
    ]);
    for (const marker of filtered.redacted) {
      expect(marker.redactionClass).toBe('policy-scoped');
    }
  });

  it('the payload walk enumerates dotted + indexed leaf paths deterministically', () => {
    const leaves = walkOutboundLeaves(RAW_INFORMATION_PAYLOAD as Record<string, never>);
    expect(leaves.map((leaf) => leaf.path)).toContain('questions[0].text');
    expect(leaves.map((leaf) => leaf.path)).toContain('internalCommercialNote');
  });
});

describe('outbound: dispatch + per-attempt receipts', () => {
  it('a delivered dispatch carries content-addressed receipts per attempt', () => {
    const { runtime, provider } = runtimeWith('delivering');
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1, T2, T3] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind === 'delivered') {
      expect(outcome.receipts).toHaveLength(1);
      const [receipt] = outcome.receipts;
      expect(receipt!.outcome).toBe('success');
      expect(receipt!.attemptNo).toBe(1);
      expect(receipt!.scheduledAt).toBe(T1);
      expect(receipt!.providerDeliveryRef).toBe('adapter:generic-alpha:delivery-1');
      expect(receipt!.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    // The provider received ONLY the filtered payload + policy digest.
    expect(provider.delivered).toHaveLength(1);
    const dispatched = provider.delivered[0]!;
    expect(dispatched.payload.redacted).toHaveLength(2);
    expect(dispatched.projectionDigest).toBe(referenceProjection().policyDigest);
    expect((dispatched.payload as { released?: unknown }).released).toBeDefined();
  });

  it('a retryable attempt continues the schedule; every attempt is receipted', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const script: Record<number, ProviderDeliveryOutcome> = {
      1: { outcome: 'retryable', detail: 'congestion' },
      2: { outcome: 'retryable', detail: 'still congested' },
    };
    const provider = {
      descriptor: GENERIC_DESCRIPTOR_A,
      capabilityBinding: {
        capabilityId: 'external.event-exchange',
        versionRange: { kind: 'exact' as const, version: '1.0.0' },
      },
      supportedInboundClasses: ['observation-report'] as const,
      supportedOutboundClasses: ['information'] as const,
      deliver: (_request: unknown, attempt: { attemptNo: number }): ProviderDeliveryOutcome =>
        script[attempt.attemptNo] ?? { outcome: 'success', providerDeliveryRef: 'adapter:generic-alpha:delivery-1' },
    };
    unwrap(
      runtime.registerProvider({
        provider,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-alpha',
        }),
      }),
    );
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1, T2, T3] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind === 'delivered') {
      expect(outcome.receipts.map((r) => r.outcome)).toEqual(['retryable', 'retryable', 'success']);
      expect(outcome.receipts.map((r) => r.scheduledAt)).toEqual([T1, T2, T3]);
      expect(outcome.receipts.map((r) => r.attemptNo)).toEqual([1, 2, 3]);
    }
  });

  it('duplicate dispatch (same key, same content) returns the prior conclusion — no second delivery', () => {
    const { runtime, provider } = runtimeWith('delivering');
    const request = informationRequest();
    const input = {
      request,
      projection: referenceProjection(),
      retryPolicy: { attemptInstants: [T1] },
      detectedAt: T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    };
    const first = unwrap(runtime.dispatchOutboundRequest(input));
    const second = unwrap(runtime.dispatchOutboundRequest(input));
    expect(first.kind).toBe('delivered');
    expect(second.kind).toBe('duplicate-dispatch-returned');
    if (second.kind === 'duplicate-dispatch-returned') {
      expect(second.conclusion.kind).toBe('delivered');
    }
    expect(provider.delivered).toHaveLength(1);
    expect(runtime.state().dispatchCount).toBe(1);
  });
});

describe('outbound: the three fallback outcomes', () => {
  it('manual-queue: an unavailable provider becomes a pending manual work item (explicit unresolved)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1] },
        fallbackPolicy: { mode: 'manual-queue' },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('manual-queued');
    if (outcome.kind === 'manual-queued') {
      expect(outcome.manual.recordId).toBe('manual:info-1');
      expect(outcome.manual.resolution).toBe('pending');
      expect(outcome.manual.reason).toBe('provider-unavailable');
      expect(outcome.unavailability?.reason).toBe('no-provider-registered');
    }
    expect(runtime.manualQueueRecords()).toHaveLength(1);
    expect(runtime.state().manualQueueCount).toBe(1);
  });

  it('fallback: a designated second provider satisfies the SAME class contract after terminal failure', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const failing = terminalProvider(GENERIC_DESCRIPTOR_A);
    const backup = deliveringProvider(GENERIC_DESCRIPTOR_B);
    unwrap(
      runtime.registerProvider({
        provider: failing,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-alpha',
        }),
      }),
    );
    unwrap(
      runtime.registerProvider({
        provider: backup,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-beta',
        }),
      }),
    );
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1] },
        fallbackPolicy: { mode: 'fallback', fallbackAdapterId: 'adapter:generic-beta' },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('fallback-dispatched');
    if (outcome.kind === 'fallback-dispatched') {
      expect(outcome.receipts).toHaveLength(1);
      expect(outcome.receipts[0]!.providerAdapterId).toBe('adapter:generic-beta');
      expect(outcome.receipts[0]!.outcome).toBe('success');
    }
    expect(backup.delivered).toHaveLength(1);
    expect(failing.delivered).toHaveLength(1);
  });

  it('alternative-provider: the next provider of the SAME class delivers after terminal failure', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const failing = terminalProvider(GENERIC_DESCRIPTOR_A);
    const alternative = deliveringProvider(GENERIC_DESCRIPTOR_B);
    unwrap(
      runtime.registerProvider({
        provider: failing,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-alpha',
        }),
      }),
    );
    unwrap(
      runtime.registerProvider({
        provider: alternative,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-beta',
        }),
      }),
    );
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1] },
        fallbackPolicy: { mode: 'alternative-provider', excludeAdapterIds: [] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('fallback-dispatched');
    if (outcome.kind === 'fallback-dispatched') {
      expect(outcome.receipts[0]!.providerAdapterId).toBe('adapter:generic-beta');
    }
    expect(alternative.delivered).toHaveLength(1);
  });

  it('terminal failure without a fallback policy stays explicitly failed (receipts, no fabrication)', () => {
    const { runtime } = runtimeWith('terminal');
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1, T2] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivery-failed');
    if (outcome.kind === 'delivery-failed') {
      expect(outcome.receipts.map((r) => r.outcome)).toEqual(['terminal']);
    }
  });
});
