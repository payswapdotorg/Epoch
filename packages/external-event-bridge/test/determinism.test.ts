// DETERMINISM: identical inputs produce identical digests; provider
// resolution by class is order-independent (canonicalized); the state
// projection is insertion-order-free.
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  buildObservationIntakeProposal,
  filterOutboundPayload,
  buildOutboundRequest,
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
  referenceExternalEvent,
  referenceObservationContext,
  referenceProjection,
} from './fixtures';
import { gatePair, informationRequest, unwrap } from './helpers';

describe('determinism: identical inputs -> identical digests', () => {
  it('external events seal deterministically', () => {
    const a = referenceExternalEvent();
    const b = referenceExternalEvent();
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('intake proposals build deterministically', () => {
    const event = referenceExternalEvent();
    const a = unwrap(buildObservationIntakeProposal(event, referenceObservationContext()));
    const b = unwrap(buildObservationIntakeProposal(event, referenceObservationContext()));
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('outbound requests seal deterministically (field order in the raw payload is irrelevant)', () => {
    const a = informationRequest();
    const b = informationRequest({
      rawPayload: {
        supplierIdentity: 'supplier:acme-excavation',
        internalCommercialNote: 'contract penalty threshold is 14 days',
        questions: [{ channel: 'field-report', text: 'Confirm the measured depth at grid B4' }],
        statusSummary: 'Awaiting confirmation of achieved depth',
        workPackageRef: 'work-package:earthworks',
        activityTitle: 'Excavate grid B4 to foundation level',
      },
    });
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('payload filtering is deterministic regardless of raw key order', () => {
    const a = filterOutboundPayload(RAW_INFORMATION_PAYLOAD as Record<string, never>, referenceProjection());
    const b = filterOutboundPayload(
      {
        supplierIdentity: 'supplier:acme-excavation',
        internalCommercialNote: 'contract penalty threshold is 14 days',
        questions: [{ channel: 'field-report', text: 'Confirm the measured depth at grid B4' }],
        statusSummary: 'Awaiting confirmation of achieved depth',
        workPackageRef: 'work-package:earthworks',
        activityTitle: 'Excavate grid B4 to foundation level',
      },
      referenceProjection(),
    );
    expect(a).toEqual(b);
  });
});

describe('determinism: provider resolution by class is order-independent', () => {
  it('registration order never leaks into the candidate list', () => {
    const alpha = deliveringProvider(GENERIC_DESCRIPTOR_A);
    const beta = deliveringProvider(GENERIC_DESCRIPTOR_B);
    const forward = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    for (const provider of [alpha, beta]) {
      unwrap(
        forward.registerProvider({
          provider,
          tenantId: TENANT_A,
          registeredAt: T0,
          registeredBy: PRINCIPAL,
          authorization: gatePair({
            actionKind: 'bridge.provider-registration',
            resourceId: `registration:${provider.descriptor.adapterId.slice('adapter:'.length)}`,
          }),
        }),
      );
    }
    const backward = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    for (const provider of [beta, alpha]) {
      unwrap(
        backward.registerProvider({
          provider,
          tenantId: TENANT_A,
          registeredAt: T0,
          registeredBy: PRINCIPAL,
          authorization: gatePair({
            actionKind: 'bridge.provider-registration',
            resourceId: `registration:${provider.descriptor.adapterId.slice('adapter:'.length)}`,
          }),
        }),
      );
    }
    expect(forward.state().providers).toEqual(backward.state().providers);
    // The dispatch order-independence: dispatching through either
    // registration order resolves the SAME first candidate.
    const dispatchThrough = (runtime: ExternalEventBridgeRuntime) =>
      unwrap(
        runtime.dispatchOutboundRequest({
          request: informationRequest(),
          projection: referenceProjection(),
          retryPolicy: { attemptInstants: [T1] },
          detectedAt: T1,
          authorization: gatePair({
            actionKind: 'bridge.request-dispatch',
            resourceId: 'outbound:info-1',
          }),
        }),
      );
    const firstOutcome = dispatchThrough(forward);
    const secondOutcome = dispatchThrough(backward);
    if (firstOutcome.kind !== 'delivered' || secondOutcome.kind !== 'delivered') {
      throw new Error('both orders must deliver');
    }
    expect(firstOutcome.receipts[0]!.providerAdapterId).toBe(
      secondOutcome.receipts[0]!.providerAdapterId,
    );
  });

  it('the state projection sorts providers by adapter id (no insertion-order leaks)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    for (const provider of [deliveringProvider(GENERIC_DESCRIPTOR_B), deliveringProvider(GENERIC_DESCRIPTOR_A)]) {
      unwrap(
        runtime.registerProvider({
          provider,
          tenantId: TENANT_A,
          registeredAt: T0,
          registeredBy: PRINCIPAL,
          authorization: gatePair({
            actionKind: 'bridge.provider-registration',
            resourceId: `registration:${provider.descriptor.adapterId.slice('adapter:'.length)}`,
          }),
        }),
      );
    }
    expect(runtime.state().providers.map((p) => p.adapterId)).toEqual([
      'adapter:generic-alpha',
      'adapter:generic-beta',
    ]);
  });

  it('identical dispatch scenarios produce identical receipts and events', () => {
    const run = (): { receipts: string[]; events: string[] } => {
      const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
      unwrap(
        runtime.registerProvider({
          provider: deliveringProvider(GENERIC_DESCRIPTOR_A),
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
          authorization: gatePair({
            actionKind: 'bridge.request-dispatch',
            resourceId: 'outbound:info-1',
          }),
        }),
      );
      if (outcome.kind !== 'delivered') throw new Error(outcome.kind);
      return {
        receipts: outcome.receipts.map((r) => r.contentDigest),
        events: runtime.recordedEvents().map((e) => e.contentDigest),
      };
    };
    const first = run();
    const second = run();
    expect(first.receipts).toEqual(second.receipts);
    expect(first.events).toEqual(second.events);
  });
});

describe('determinism: outbound builder + seal round-trips', () => {
  it('buildOutboundRequest produces a request that verifies under the SAME projection', () => {
    const projection = referenceProjection();
    const request = unwrap(
      buildOutboundRequest(
        {
          requestId: 'outbound:info-1',
          tenantId: TENANT_A,
          requestClass: 'information',
          recipientRef: 'role:site-supervisor',
          correlationId: 'corr:exchange-1',
          causationId: null,
          createdAt: T1,
          createdBy: PRINCIPAL,
          idempotencyKey: 'idem:dispatch-1',
          rawPayload: RAW_INFORMATION_PAYLOAD as Record<string, never>,
        },
        projection,
      ),
    );
    expect(request.projectionDigest).toBe(projection.policyDigest);
    expect(request.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sealExternalEvent and sealOutboundRequest agree on canonical digests across runs', () => {
    const eventA = referenceExternalEvent();
    const eventB = referenceExternalEvent();
    expect(eventA.contentDigest).toBe(eventB.contentDigest);
    const requestA = informationRequest({ idempotencyKey: 'idem:x' });
    const requestB = informationRequest({ idempotencyKey: 'idem:x' });
    expect(requestA.contentDigest).toBe(requestB.contentDigest);
  });
});
