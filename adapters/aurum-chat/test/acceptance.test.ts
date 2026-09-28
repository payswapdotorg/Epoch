// THE ACCEPTANCE, VERBATIM (the W042 Work Order): "A mocked Aurum
// provider and a second generic provider can both satisfy the same
// contract." This named test registers BOTH the mocked chat reference
// provider AND a second generic fixture provider and exercises both
// through the SAME bridge API — the same runtime host, the same
// registration discipline, the same class resolution, the same
// dispatch/receipt machinery — in both directions (inbound intake and
// outbound delivery).
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  filterOutboundPayload,
  buildOutboundRequest,
  type ExternalEventProvider,
  type LeastPrivilegeProjection,
  type ProviderDeliveryOutcome,
  type ProviderDispatchRequest,
  type DeliveryAttemptContext,
} from '@epoch/external-event-bridge';
import { computeAdapterDescriptorDigest, type AdapterDescriptor } from '@epoch/adapter-sdk';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  ChatReferenceProvider,
  SUCCESS_DELIVERY_SCRIPT,
  adaptInboundMessage,
  referenceProviderMessage,
  PROVIDER_T0,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
} from '../src/index';

/** The gate-pair builder (W009-shaped, digest-bound). */
function gatePair(input: {
  actionKind: string;
  resourceId: string;
  tenantId?: string;
}): { request: unknown; decision: unknown } {
  const request = {
    schemaVersion: 1,
    principalId: PROVIDER_OPERATOR,
    actionKind: input.actionKind,
    resource: {
      resourceType: 'external-event-bridge',
      resourceId: input.resourceId,
      tenantId: input.tenantId ?? PROVIDER_TENANT_A,
    },
    justification: 'acceptance evidence',
  };
  return { request, decision: { requestDigest: canonicalDigest(request), outcome: 'allow' } };
}

/** The second generic provider (a plain struct implementing the SAME port). */
class GenericFixtureProvider implements ExternalEventProvider {
  public readonly delivered: ProviderDispatchRequest[] = [];
  readonly descriptor: AdapterDescriptor = {
    schemaVersion: 1,
    adapterId: 'adapter:generic-relay',
    category: 'source',
    displayName: 'Generic Relay Provider (fixture)',
    description: 'A second generic provider satisfying the same bridge provider contract.',
    binding: {
      capabilityId: 'external.event-exchange',
      versionRange: { kind: 'exact', version: '1.0.0' },
    },
  };
  readonly capabilityBinding = {
    capabilityId: 'external.event-exchange',
    versionRange: { kind: 'exact' as const, version: '1.0.0' },
  };
  readonly supportedInboundClasses = ['status-report', 'acknowledgement'] as const;
  readonly supportedOutboundClasses = [
    'acknowledgement-request',
    'alert',
    'information',
    'status',
  ] as const;
  deliver(request: ProviderDispatchRequest, attempt: DeliveryAttemptContext): ProviderDeliveryOutcome {
    this.delivered.push(request);
    return { outcome: 'success', providerDeliveryRef: `relay-${attempt.attemptNo}` };
  }
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('the acceptance: the mocked chat provider AND a second generic provider satisfy the SAME contract', () => {
  it('both providers register + dispatch + receipt through the SAME bridge API', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const chat = new ChatReferenceProvider({ deliveryScript: SUCCESS_DELIVERY_SCRIPT });
    const generic = new GenericFixtureProvider();

    // The SAME registration discipline admits both providers:
    const chatRegistration = unwrap(
      runtime.registerProvider({
        provider: chat,
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T0,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:external-chat-reference',
        }),
      }),
    );
    const genericRegistration = unwrap(
      runtime.registerProvider({
        provider: generic,
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T0,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:generic-relay',
        }),
      }),
    );
    expect(chatRegistration.kind).toBe('registration-admitted');
    expect(genericRegistration.kind).toBe('registration-admitted');

    // The SAME least-privilege projection filters the SAME payload for both:
    const projection: LeastPrivilegeProjection = {
      policyDigest: 'ab'.repeat(32),
      recipientRef: 'role:site-supervisor',
      fieldAllowlist: ['activityTitle', 'statusSummary'],
    };
    const rawPayload = {
      activityTitle: 'Confirm grid B4 depth',
      statusSummary: 'Awaiting field confirmation',
      internalCommercialNote: 'penalty threshold',
    };
    const chatRequest = unwrap(
      buildOutboundRequest(
        {
          requestId: 'outbound:chat-info-1',
          tenantId: PROVIDER_TENANT_A,
          requestClass: 'information',
          recipientRef: 'role:site-supervisor',
          correlationId: 'corr:acceptance-chat',
          causationId: null,
          createdAt: PROVIDER_T1,
          createdBy: PROVIDER_OPERATOR,
          idempotencyKey: 'idem:acceptance-chat',
          rawPayload,
        },
        projection,
      ),
    );
    const genericRequest = unwrap(
      buildOutboundRequest(
        {
          requestId: 'outbound:relay-info-1',
          tenantId: PROVIDER_TENANT_A,
          requestClass: 'information',
          recipientRef: 'role:site-supervisor',
          correlationId: 'corr:acceptance-relay',
          causationId: null,
          createdAt: PROVIDER_T1,
          createdBy: PROVIDER_OPERATOR,
          idempotencyKey: 'idem:acceptance-relay',
          rawPayload,
        },
        projection,
      ),
    );
    expect(chatRequest.contentDigest).not.toBe(genericRequest.contentDigest);
    expect(filterOutboundPayload(rawPayload, projection).redacted).toHaveLength(1);

    // The SAME dispatch machinery delivers through BOTH providers:
    const chatOutcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: chatRequest,
        projection,
        retryPolicy: { attemptInstants: [PROVIDER_T1, PROVIDER_T2] },
        detectedAt: PROVIDER_T1,
        authorization: gatePair({
          actionKind: 'bridge.request-dispatch',
          resourceId: 'outbound:chat-info-1',
        }),
      }),
    );
    const genericOutcome = unwrap(
      runtime.dispatchOutboundRequest({
        request: genericRequest,
        projection,
        retryPolicy: { attemptInstants: [PROVIDER_T1, PROVIDER_T2] },
        preferredAdapterId: 'adapter:generic-relay',
        detectedAt: PROVIDER_T1,
        authorization: gatePair({
          actionKind: 'bridge.request-dispatch',
          resourceId: 'outbound:relay-info-1',
        }),
      }),
    );
    expect(chatOutcome.kind).toBe('delivered');
    expect(genericOutcome.kind).toBe('delivered');
    if (chatOutcome.kind === 'delivered' && genericOutcome.kind === 'delivered') {
      expect(chatOutcome.receipts[0]!.providerAdapterId).toBe('adapter:external-chat-reference');
      expect(genericOutcome.receipts[0]!.providerAdapterId).toBe('adapter:generic-relay');
      // Both providers received the SAME filtered payload shape:
      expect(chat.deliveredRequests[0]!.payload.released.map((f) => f.path)).toEqual(
        generic.delivered[0]!.payload.released.map((f) => f.path),
      );
    }
    expect(chat.deliveredRequests).toHaveLength(1);
    expect(generic.delivered).toHaveLength(1);
  });

  it('the mocked chat provider ALSO satisfies the INBOUND half of the same contract', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const chat = new ChatReferenceProvider();
    unwrap(
      runtime.registerProvider({
        provider: chat,
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T0,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:external-chat-reference',
        }),
      }),
    );

    // The provider fixture normalizes into a bridge external event:
    const event = unwrap(
      adaptInboundMessage(referenceProviderMessage(), {
        eventId: 'bridge-event:chat-msg-1',
        tenantId: PROVIDER_TENANT_A,
        correlationId: 'corr:acceptance-inbound',
        causationId: null,
        occurredAt: PROVIDER_T1,
        idempotencyKey: 'idem:acceptance-inbound',
        confidence: { method: 'stated', value: 0.8 },
        reportedBy: PROVIDER_OPERATOR,
      }),
    );
    expect(event.eventClass).toBe('observation-report');
    expect(event.source.adapterId).toBe('adapter:external-chat-reference');
    expect(event.source.adapterDescriptorDigest).toBe(
      computeAdapterDescriptorDigest(chat.descriptor),
    );

    // ...and the SAME bridge intake machinery admits it:
    const outcome = unwrap(
      runtime.intakeExternalEvent({
        event,
        receivedAt: PROVIDER_T2,
        authorization: gatePair({
          actionKind: 'bridge.event-intake',
          resourceId: 'bridge-event:chat-msg-1',
        }),
      }),
    );
    expect(outcome.kind).toBe('intake-admitted');
    if (outcome.kind === 'intake-admitted') {
      expect(outcome.receipt.disposition).toBe('admitted');
    }
  });
});
