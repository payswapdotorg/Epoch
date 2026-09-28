// THE ACCEPTANCE, FIRST CLAUSE (bridge side): two DIFFERENT generic
// fixture providers — one delivering on first attempt, one failing once
// then succeeding — both satisfy the SAME provider contract and both
// dispatch through the SAME bridge API with byte-identical request
// discipline. (The Aurum-mocked provider + second generic provider run
// of the same acceptance lives in adapters/aurum-chat/test/acceptance.)
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  resolveProvidersByClass,
  sealProviderRegistration,
  deriveProviderRegistrationContent,
  type SealedProviderRegistration,
} from '../src/index';
import {
  GENERIC_DESCRIPTOR_A,
  GENERIC_DESCRIPTOR_B,
  IDEMPOTENCY_1,
  IDEMPOTENCY_2,
  PRINCIPAL,
  TENANT_A,
  T0,
  T1,
  T2,
  T3,
  deliveringProvider,
  flakyProvider,
  informationOnlyProvider,
  referenceProjection,
} from './fixtures';
import { gatePair, informationRequest, unwrap } from './helpers';

describe('the acceptance: two different generic providers satisfy the SAME contract', () => {
  it('both providers dispatch through the SAME bridge API and deliver', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const alpha = deliveringProvider(GENERIC_DESCRIPTOR_A);
    const beta = deliveringProvider(GENERIC_DESCRIPTOR_B);
    unwrap(
      runtime.registerProvider({
        provider: alpha,
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
        provider: beta,
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-beta',
        }),
      }),
    );

    const projection = referenceProjection();
    // The first dispatch resolves canonically (adapter:generic-alpha first);
    // the second names the second provider as preferred — BOTH satisfy the
    // SAME contract through the SAME API.
    const first = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest({ requestId: 'outbound:info-1', idempotencyKey: IDEMPOTENCY_1 }),
        projection,
        retryPolicy: { attemptInstants: [T1, T2, T3] },
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    const second = unwrap(
      runtime.dispatchOutboundRequest({
        request: informationRequest({ requestId: 'outbound:info-2', idempotencyKey: IDEMPOTENCY_2 }),
        projection,
        retryPolicy: { attemptInstants: [T1, T2, T3] },
        preferredAdapterId: 'adapter:generic-beta',
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-2' }),
      }),
    );
    expect(first.kind).toBe('delivered');
    expect(second.kind).toBe('delivered');
    // Both providers received their dispatch through the same port shape.
    expect(alpha.delivered).toHaveLength(1);
    expect(beta.delivered).toHaveLength(1);
    expect(alpha.delivered[0]!.requestClass).toBe('information');
    expect(beta.delivered[0]!.requestClass).toBe('information');
  });

  it('a flaky provider satisfies the same contract through the retry schedule', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const flaky = flakyProvider(GENERIC_DESCRIPTOR_A);
    unwrap(
      runtime.registerProvider({
        provider: flaky,
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
      expect(outcome.receipts).toHaveLength(2);
      expect(outcome.receipts[0]!.outcome).toBe('retryable');
      expect(outcome.receipts[1]!.outcome).toBe('success');
    }
  });

  it('resolution is BY CLASS: an information-only provider resolves information requests', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    unwrap(
      runtime.registerProvider({
        provider: informationOnlyProvider(GENERIC_DESCRIPTOR_B),
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
        detectedAt: T1,
        authorization: gatePair({ actionKind: 'bridge.request-dispatch', resourceId: 'outbound:info-1' }),
      }),
    );
    expect(outcome.kind).toBe('delivered');
  });

  it('the pure resolver is provider-name-free and canonicalized', () => {
    const registrations = [
      deriveProviderRegistrationContent(deliveringProvider(GENERIC_DESCRIPTOR_B), {
        registrationId: 'registration:generic-beta',
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
      }),
      deriveProviderRegistrationContent(deliveringProvider(GENERIC_DESCRIPTOR_A), {
        registrationId: 'registration:generic-alpha',
        tenantId: TENANT_A,
        registeredAt: T0,
        registeredBy: PRINCIPAL,
      }),
    ]
      .map((content) => unwrap(sealProviderRegistration(content)))
      .reverse() as unknown as readonly SealedProviderRegistration[];
    const resolved = resolveProvidersByClass({
      registrations,
      requestClass: 'information',
    });
    expect(resolved.map((r) => r.adapterDescriptor.adapterId)).toEqual([
      'adapter:generic-alpha',
      'adapter:generic-beta',
    ]);
  });
});
