// THE NEGATIVE BATTERY: every typed rejection is a named test.
// observation-bypass-rejected, least-privilege-violation-rejected,
// provider-unavailable (bare), tenant-isolation-rejected,
// authorization-bypass-rejected, malformed event (validation),
// tampered digest (digest-mismatch), replay-conflict, and the generic
// authority-violation for embedded kernel-discriminator claims.
// (provider-vocabulary-rejected + pack-branching-rejected live in
// neutrality.test.ts; kernel-import-rejected lives in the adapter.)
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  ExternalEventBridgeRuntime,
  verifySealedExternalEvent,
  verifySealedOutboundRequest,
} from '../src/index';
import {
  GENERIC_DESCRIPTOR_A,
  IDEMPOTENCY_1,
  PRINCIPAL,
  TENANT_A,
  TENANT_B,
  T0,
  T1,
  T2,
  deliveringProvider,
  referenceExternalEvent,
  referenceObservationContext,
  referenceProjection,
} from './fixtures';
import { gatePair, informationRequest, unwrap } from './helpers';

describe('negative: observation-bypass-rejected (the bridge NEVER writes observations)', () => {
  /**
   * A HAND-CRAFTED sealed record (the seal API itself rejects the bypass,
   * so the negative fixture is constructed directly): schema-valid
   * content + the correct digest — only the authority gate can catch it.
   */
  function handSealed(payload: Record<string, unknown>): unknown {
    const jsonPayload = payload as Record<string, import('@epoch/agent-protocol').JsonValue>;
    const content = {
      schema: 'epoch.external-event-bridge.external-event',
      schemaVersion: 1,
      eventId: 'bridge-event:msg-1',
      tenantId: TENANT_A,
      eventClass: 'observation-report',
      source: {
        kind: 'reported',
        adapterId: 'adapter:generic-alpha',
        adapterDescriptorDigest: '1f'.repeat(32),
        providerEventRef: 'provider-msg-1',
        providerPayloadDigest: '3a'.repeat(32),
      },
      correlationId: 'corr:exchange-1',
      causationId: null,
      occurredAt: T1,
      payload: jsonPayload,
      confidence: { method: 'stated', value: 1 },
      idempotencyKey: IDEMPOTENCY_1,
    };
    return { ...content, contentDigest: canonicalDigest(content) };
  }

  it('an external event presenting itself as a sealed W036 observation is rejected', () => {
    const sealed = handSealed({
      schema: 'epoch.solution-delivery.distinction-record',
      kind: 'observation',
      recordId: 'observation:forged',
      contentDigest: 'ff'.repeat(32),
    });
    const result = verifySealedExternalEvent(sealed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('observation-bypass-rejected');
      if (result.error.code === 'observation-bypass-rejected') {
        expect(result.error.reason).toBe('sealed-observation-payload');
      }
    }
  });

  it('the runtime intake path rejects the same bypass attempt', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: handSealed({
        schema: 'epoch.solution-delivery.distinction-record',
        kind: 'observation',
        recordId: 'observation:forged',
      }),
      receivedAt: T2,
      authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('observation-bypass-rejected');
  });

  it('a payload embedding any other kernel schema discriminator is the typed authority-violation', () => {
    const result = verifySealedExternalEvent(
      handSealed({ schema: 'epoch.solution-delivery.delivery-record', note: 'claim' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('authority-violation');
  });
});

describe('negative: least-privilege-violation-rejected (unfiltered sends)', () => {
  it('a dispatch WITHOUT a projection reference is rejected (projection-missing)', () => {
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
    const result = runtime.dispatchOutboundRequest({
      request: informationRequest(),
      projection: undefined,
      retryPolicy: { attemptInstants: [T1] },
      detectedAt: T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('least-privilege-violation-rejected');
      if (result.error.code === 'least-privilege-violation-rejected') {
        expect(result.error.reason).toBe('projection-missing');
      }
    }
  });

  it('a request whose payload releases a field OUTSIDE the allowlist is rejected (defense in depth)', () => {
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
    // A NARROWER projection than the request was filtered under: the
    // released supplierIdentity field is outside this allowlist.
    const narrower = referenceProjection({
      fieldAllowlist: ['activityTitle', 'statusSummary'],
    });
    const result = runtime.dispatchOutboundRequest({
      request: informationRequest(),
      projection: narrower,
      retryPolicy: { attemptInstants: [T1] },
      detectedAt: T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('least-privilege-violation-rejected');
      if (result.error.code === 'least-privilege-violation-rejected') {
        expect(result.error.reason).toBe('field-outside-allowlist');
        expect(result.error.violatingPaths).toContain('workPackageRef');
      }
    }
  });

  it('a projection whose policy digest differs from the request citation is rejected', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.dispatchOutboundRequest({
      request: informationRequest(),
      projection: referenceProjection({ policyDigest: 'cd'.repeat(32) }),
      retryPolicy: { attemptInstants: [T1] },
      detectedAt: T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('least-privilege-violation-rejected');
      if (result.error.code === 'least-privilege-violation-rejected') {
        expect(result.error.reason).toBe('policy-digest-mismatch');
      }
    }
  });
});

describe('negative: provider-unavailable (bare — no fallback directive)', () => {
  it('a missing provider yields the typed provider-unavailable record and stays explicit', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const outcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('provider-unavailable');
    if (outcome.kind === 'provider-unavailable') {
      expect(outcome.unavailability.reason).toBe('no-provider-registered');
      expect(outcome.unavailability.candidateAdapterIds).toEqual([]);
      expect(outcome.unavailability.requestClass).toBe('information');
    }
    expect(runtime.unavailabilityRecords()).toHaveLength(1);
  });

  it('an unregistered preferred provider yields the typed preferred-provider-unavailable record', () => {
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
        retryPolicy: { attemptInstants: [T1] },
        preferredAdapterId: 'adapter:never-registered',
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    // generic-alpha still resolves by class; the preferred id is simply not a candidate.
    expect(outcome.kind).toBe('delivered');
  });
});

describe('negative: tenant-isolation-rejected (R12)', () => {
  it('a pinned runtime rejects a cross-tenant external event', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent({ tenantId: TENANT_B }),
      receivedAt: T2,
      authorization: gatePair({
        actionKind: 'bridge.event-intake',
        resourceId: 'bridge-event:msg-1',
        tenantId: TENANT_B,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('tenant-isolation-rejected');
      if (result.error.code === 'tenant-isolation-rejected') {
        expect(result.error.expectedTenantId).toBe(TENANT_A);
        expect(result.error.encounteredTenantId).toBe(TENANT_B);
      }
    }
  });

  it('the W009 gate rejects a decision covering a DIFFERENT tenant than the record', () => {
    const runtime = new ExternalEventBridgeRuntime();
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent({ tenantId: TENANT_A }),
      receivedAt: T2,
      authorization: gatePair({
        actionKind: 'bridge.event-intake',
        resourceId: 'bridge-event:msg-1',
        tenantId: TENANT_B,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('tenant-isolation-rejected');
    }
  });

  it('a pinned runtime rejects a cross-tenant provider registration', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.registerProvider({
      provider: deliveringProvider(GENERIC_DESCRIPTOR_A),
      tenantId: TENANT_B,
      registeredAt: T0,
      registeredBy: PRINCIPAL,
      authorization: gatePair({
        actionKind: 'bridge.provider-registration',
        resourceId: 'registration:generic-alpha',
        tenantId: TENANT_B,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('negative: authorization-bypass-rejected (the W009 gate always precedes)', () => {
  it('a missing decision is rejected (decision-missing)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent(),
      receivedAt: T2,
      authorization: { request: { schemaVersion: 1 }, decision: undefined },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('authorization-bypass-rejected');
      if (result.error.code === 'authorization-bypass-rejected') {
        expect(result.error.reason).toBe('decision-missing');
      }
    }
  });

  it('a decision with a mismatched request digest is rejected (request-digest-mismatch)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent(),
      receivedAt: T2,
      authorization: gatePair({
        actionKind: 'bridge.event-intake',
        resourceId: 'bridge-event:msg-1',
        digestOverride: 'ee'.repeat(32),
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('authorization-bypass-rejected');
      if (result.error.code === 'authorization-bypass-rejected') {
        expect(result.error.reason).toBe('request-digest-mismatch');
      }
    }
  });

  it('a deny decision is rejected (decision-not-allow)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent(),
      receivedAt: T2,
      authorization: gatePair({
        actionKind: 'bridge.event-intake',
        resourceId: 'bridge-event:msg-1',
        outcome: 'deny',
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('authorization-bypass-rejected');
      if (result.error.code === 'authorization-bypass-rejected') {
        expect(result.error.reason).toBe('decision-not-allow');
      }
    }
  });

  it('a platform-scoped (untenanted) resource is rejected (resource-untenanted)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const request = {
      schemaVersion: 1,
      principalId: PRINCIPAL,
      actionKind: 'bridge.event-intake',
      resource: { resourceType: 'external-event-bridge', resourceId: 'bridge-event:msg-1' },
    };
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent(),
      receivedAt: T2,
      authorization: {
        request,
        decision: {
          requestDigest: canonicalDigest(request),
          outcome: 'allow',
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('authorization-bypass-rejected');
      if (result.error.code === 'authorization-bypass-rejected') {
        expect(result.error.reason).toBe('resource-untenanted');
      }
    }
  });
});

describe('negative: malformed, tampered, replayed', () => {
  it('a malformed external event (unknown vendor field) is a typed validation error', () => {
    const result = verifySealedExternalEvent({
      schema: 'epoch.external-event-bridge.external-event',
      schemaVersion: 1,
      eventId: 'bridge-event:msg-1',
      tenantId: TENANT_A,
      eventClass: 'observation-report',
      source: {
        kind: 'reported',
        adapterId: 'adapter:generic-alpha',
        adapterDescriptorDigest: '1f'.repeat(32),
        providerEventRef: 'provider-msg-1',
        providerPayloadDigest: '3a'.repeat(32),
        vendorField: 'not allowed',
      },
      correlationId: 'corr:exchange-1',
      causationId: null,
      occurredAt: T1,
      payload: { note: 'x' },
      confidence: { method: 'stated', value: 1 },
      idempotencyKey: IDEMPOTENCY_1,
      contentDigest: '00'.repeat(32),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('a version-skewed record is version-unsupported', () => {
    const result = verifySealedExternalEvent({
      schema: 'epoch.external-event-bridge.external-event',
      schemaVersion: 2,
      eventId: 'bridge-event:msg-1',
      tenantId: TENANT_A,
      eventClass: 'observation-report',
      source: {
        kind: 'reported',
        adapterId: 'adapter:generic-alpha',
        adapterDescriptorDigest: '1f'.repeat(32),
        providerEventRef: 'provider-msg-1',
        providerPayloadDigest: '3a'.repeat(32),
      },
      correlationId: 'corr:exchange-1',
      causationId: null,
      occurredAt: T1,
      payload: { note: 'x' },
      confidence: { method: 'stated', value: 1 },
      idempotencyKey: IDEMPOTENCY_1,
      contentDigest: '00'.repeat(32),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('version-unsupported');
  });

  it('a tampered digest is digest-mismatch (tamper detection)', () => {
    const sealed = { ...referenceExternalEvent() };
    const tampered = { ...sealed, contentDigest: 'ff'.repeat(32) };
    const result = verifySealedExternalEvent(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'digest-mismatch') {
      expect(result.error.encountered).toBe('ff'.repeat(32));
    }
  });

  it('a tampered outbound request digest is digest-mismatch', () => {
    const request = informationRequest();
    const result = verifySealedOutboundRequest({ ...request, contentDigest: 'ee'.repeat(32) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });

  it('the same idempotency key with DIFFERENT content is replay-conflict (intake)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    unwrap(
      runtime.intakeExternalEvent({
        event: referenceExternalEvent(),
        observationContext: referenceObservationContext(),
        receivedAt: T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
      }),
    );
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent({ payload: { note: 'different content' } }),
      observationContext: referenceObservationContext(),
      receivedAt: T2,
      authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'replay-conflict') {
      expect(result.error.idempotencyKey).toBe(IDEMPOTENCY_1);
    }
  });

  it('the same idempotency key with DIFFERENT content is replay-conflict (dispatch)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest(),
        projection: referenceProjection(),
        retryPolicy: { attemptInstants: [T1] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    const result = runtime.dispatchOutboundRequest({
      request: informationRequest({
        rawPayload: { activityTitle: 'A different title entirely', statusSummary: 'x', questions: [], workPackageRef: 'work-package:earthworks', internalCommercialNote: 'y', supplierIdentity: 's' },
      }),
      projection: referenceProjection(),
      retryPolicy: { attemptInstants: [T1] },
      detectedAt: T1,
      authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('replay-conflict');
  });

  it('re-registering a provider with DIFFERENT content is replay-conflict', () => {
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
    // Same adapter id, different class surface:
    const result = runtime.registerProvider({
      provider: deliveringProvider({ ...GENERIC_DESCRIPTOR_A, displayName: 'Changed surface' }),
      tenantId: TENANT_A,
      registeredAt: T1,
      registeredBy: PRINCIPAL,
      authorization: gatePair({
        actionKind: 'bridge.provider-registration',
        resourceId: 'registration:generic-alpha',
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('replay-conflict');
  });
});
