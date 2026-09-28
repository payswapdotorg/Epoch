// ROUND-TRIP SERIALIZATION + DIGEST VERIFICATION for every public type:
// events, requests, receipts, registrations, fallback records. Every
// sealed record is a plain JSON object; JSON.stringify -> JSON.parse ->
// verify produces the SAME sealed record and the SAME digest.
import { describe, expect, it } from 'vitest';
import {
  buildObservationIntakeProposal,
  sealBridgeEvent,
  sealDeliveryReceipt,
  sealIntakeReceipt,
  sealManualQueueRecord,
  sealOutboundRequest,
  sealProviderRegistration,
  sealProviderUnavailable,
  verifySealedBridgeEvent,
  verifySealedDeliveryReceipt,
  verifySealedExternalEvent,
  verifySealedIntakeReceipt,
  verifySealedManualQueueRecord,
  verifySealedOutboundRequest,
  verifySealedProviderRegistration,
  verifySealedProviderUnavailable,
} from '../src/index';
import {
  CORRELATION_1,
  DESCRIPTOR_DIGEST_A,
  GENERIC_DESCRIPTOR_A,
  PROVIDER_CAPABILITY_BINDING,
  TENANT_A,
  T1,
  T2,
  referenceExternalEvent,
  referenceObservationContext,
} from './fixtures';
import { unwrap } from './helpers';

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('round-trip serialization + digest verification', () => {
  it('sealed external events round-trip and verify', () => {
    const sealed = referenceExternalEvent();
    const back = roundTrip(sealed);
    expect(back).toEqual(sealed);
    const verified = unwrap(verifySealedExternalEvent(back));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('sealed observation intake proposals round-trip and verify', () => {
    const proposal = unwrap(
      buildObservationIntakeProposal(referenceExternalEvent(), referenceObservationContext()),
    );
    const back = roundTrip(proposal);
    expect(back).toEqual(proposal);
  });

  it('sealed outbound requests round-trip and verify', () => {
    const request = unwrap(
      sealOutboundRequest({
        schema: 'epoch.external-event-bridge.outbound-request',
        schemaVersion: 1,
        requestId: 'outbound:info-1',
        tenantId: TENANT_A,
        requestClass: 'alert',
        recipientRef: 'role:program-manager',
        correlationId: CORRELATION_1,
        causationId: null,
        payload: { released: [], redacted: [] },
        projectionDigest: 'ab'.repeat(32),
        createdAt: T1,
        createdBy: 'principal:bridge-ops',
        idempotencyKey: 'idem:dispatch-1',
      }),
    );
    const back = roundTrip(request);
    expect(back).toEqual(request);
    const verified = unwrap(verifySealedOutboundRequest(back));
    expect(verified.contentDigest).toBe(request.contentDigest);
  });

  it('sealed provider registrations round-trip and verify', () => {
    const registration = unwrap(
      sealProviderRegistration({
        schema: 'epoch.external-event-bridge.provider-registration',
        schemaVersion: 1,
        registrationId: 'registration:generic-alpha',
        tenantId: TENANT_A,
        adapterDescriptor: GENERIC_DESCRIPTOR_A,
        adapterDescriptorDigest: DESCRIPTOR_DIGEST_A,
        capabilityBinding: PROVIDER_CAPABILITY_BINDING,
        supportedInboundClasses: ['observation-report', 'status-report'],
        supportedOutboundClasses: ['alert', 'information', 'status'],
        registeredAt: T1,
        registeredBy: 'principal:bridge-ops',
      }),
    );
    expect(registration.adapterDescriptorDigest).toBe(DESCRIPTOR_DIGEST_A);
    const back = roundTrip(registration);
    expect(back).toEqual(registration);
    const verified = unwrap(verifySealedProviderRegistration(back));
    expect(verified.contentDigest).toBe(registration.contentDigest);
  });

  it('sealed delivery receipts round-trip and verify', () => {
    const receipt = unwrap(
      sealDeliveryReceipt({
        schema: 'epoch.external-event-bridge.delivery-receipt',
        schemaVersion: 1,
        receiptId: 'receipt:info-1-attempt-1',
        tenantId: TENANT_A,
        requestId: 'outbound:info-1',
        requestClass: 'information',
        attemptNo: 1,
        scheduledAt: T1,
        outcome: 'success',
        providerAdapterId: 'adapter:generic-alpha',
        providerDeliveryRef: 'provider-delivery-1',
        correlationId: CORRELATION_1,
        causationId: null,
      }),
    );
    const back = roundTrip(receipt);
    expect(back).toEqual(receipt);
    const verified = unwrap(verifySealedDeliveryReceipt(back));
    expect(verified.contentDigest).toBe(receipt.contentDigest);
  });

  it('sealed intake receipts round-trip and verify', () => {
    const receipt = unwrap(
      sealIntakeReceipt({
        schema: 'epoch.external-event-bridge.intake-receipt',
        schemaVersion: 1,
        receiptId: 'intake-receipt:msg-1',
        tenantId: TENANT_A,
        eventId: 'bridge-event:msg-1',
        eventDigest: '3a'.repeat(32),
        idempotencyKey: 'idem:exchange-1',
        disposition: 'admitted',
        proposalDigest: '4b'.repeat(32),
        correlationId: CORRELATION_1,
        causationId: null,
        receivedAt: T2,
      }),
    );
    const back = roundTrip(receipt);
    expect(back).toEqual(receipt);
    const verified = unwrap(verifySealedIntakeReceipt(back));
    expect(verified.contentDigest).toBe(receipt.contentDigest);
  });

  it('sealed provider-unavailability records round-trip and verify', () => {
    const record = unwrap(
      sealProviderUnavailable({
        schema: 'epoch.external-event-bridge.provider-unavailable',
        schemaVersion: 1,
        tenantId: TENANT_A,
        requestId: 'outbound:info-1',
        requestClass: 'information',
        reason: 'no-provider-registered',
        candidateAdapterIds: [],
        detectedAt: T1,
      }),
    );
    const back = roundTrip(record);
    expect(back).toEqual(record);
    const verified = unwrap(verifySealedProviderUnavailable(back));
    expect(verified.contentDigest).toBe(record.contentDigest);
  });

  it('sealed manual-queue records round-trip and verify', () => {
    const record = unwrap(
      sealManualQueueRecord({
        schema: 'epoch.external-event-bridge.manual-queue',
        schemaVersion: 1,
        recordId: 'manual:info-1',
        tenantId: TENANT_A,
        requestId: 'outbound:info-1',
        requestClass: 'information',
        recipientRef: 'role:site-supervisor',
        correlationId: CORRELATION_1,
        causationId: null,
        requestDigest: '5c'.repeat(32),
        reason: 'provider-unavailable',
        resolution: 'pending',
        queuedAt: T1,
        queuedBy: 'principal:bridge-ops',
      }),
    );
    const back = roundTrip(record);
    expect(back).toEqual(record);
    const verified = unwrap(verifySealedManualQueueRecord(back));
    expect(verified.contentDigest).toBe(record.contentDigest);
  });

  it('sealed bridge events round-trip and verify (W010-shaped)', () => {
    const event = unwrap(
      sealBridgeEvent({
        schemaVersion: 1,
        streamId: 'stream:bridge-globex',
        sequence: 1,
        tenantId: TENANT_A,
        actor: 'principal:bridge-ops',
        causalParent: null,
        payload: {
          discriminator: 'bridge:provider-registered',
          data: {
            registrationId: 'registration:generic-alpha',
            adapterId: 'adapter:generic-alpha',
            adapterDescriptorDigest: DESCRIPTOR_DIGEST_A,
            capabilityId: 'external.event-exchange',
            inboundClassCount: 2,
            outboundClassCount: 4,
          },
        },
        occurredAt: T1,
      }),
    );
    const back = roundTrip(event);
    expect(back).toEqual(event);
    const verified = unwrap(verifySealedBridgeEvent(back));
    expect(verified.contentDigest).toBe(event.contentDigest);
  });

  it('a round-tripped record with a mutated field fails verification', () => {
    const sealed = referenceExternalEvent();
    const back = roundTrip(sealed);
    const mutated = { ...back, idempotencyKey: 'idem:mutated' };
    const result = verifySealedExternalEvent(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});
