// POSITIVE inbound flows: provider fixtures -> bridge external events ->
// the REAL bridge runtime intake -> the W036-shaped observation intake
// proposal (the authority path). Idempotent duplicate delivery, W009
// gate, and the bridge:* event recording.
import { describe, expect, it } from 'vitest';
import { ExternalEventBridgeRuntime } from '@epoch/external-event-bridge';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  ChatReferenceProvider,
  adaptInboundMessage,
  referenceProviderMessage,
  conflictingProviderMessage,
  malformedProviderMessage,
  PROVIDER_T0,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
} from '../src/index';

function gatePair(input: { actionKind: string; resourceId: string; tenantId?: string }) {
  const request = {
    schemaVersion: 1,
    principalId: PROVIDER_OPERATOR,
    actionKind: input.actionKind,
    resource: {
      resourceType: 'external-event-bridge',
      resourceId: input.resourceId,
      tenantId: input.tenantId ?? PROVIDER_TENANT_A,
    },
  };
  return { request, decision: { requestDigest: canonicalDigest(request), outcome: 'allow' as const } };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const CONTEXT = {
  eventId: 'bridge-event:chat-msg-1',
  tenantId: PROVIDER_TENANT_A,
  correlationId: 'corr:chat-1',
  causationId: null as string | null,
  occurredAt: PROVIDER_T1,
  idempotencyKey: 'idem:chat-1',
  confidence: { method: 'stated', value: 0.8 },
  reportedBy: PROVIDER_OPERATOR,
};

describe('inbound: provider fixtures normalize into bridge external events', () => {
  it('a reference provider message adapts with W006-shaped provenance', () => {
    const event = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    expect(event.eventClass).toBe('observation-report');
    expect(event.source.kind).toBe('reported');
    expect(event.source.adapterId).toBe('adapter:external-chat-reference');
    expect(event.source.providerEventRef).toBe('msg-site-observation-1');
    expect(event.source.providerPayloadDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(event.payload).toEqual({
      providerText:
        'Grid B4 excavation reached 1250mm; requesting confirmation against the foundation level drawing.',
      providerThreadRef: 'thread-site-b4',
      providerChannel: 'channel-site-ops',
      providerAuthorRef: 'user-field-lead-7',
      providerAttachments: [
        { attachmentId: 'att-depth-photo-1', mediaType: 'image/jpeg', contentDigest: '7c'.repeat(32) },
      ],
    });
    expect(event.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the adapted event flows through the REAL bridge intake as an observation proposal', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const event = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const outcome = unwrap(
      runtime.intakeExternalEvent({
        event,
        observationContext: {
          proposalId: 'intake:chat-msg-1',
          recordId: 'observation:site-b4-depth',
          subject: {
            solutionId: 'solution:site-works',
            subjectKind: 'delivery',
            subjectId: 'delivery:site-b4',
          },
          measure: { kind: 'quantity', value: '1250', unit: 'mm' },
          payload: {
            deliveryId: 'delivery:site-b4',
            observedAt: PROVIDER_T1,
            observedBy: 'principal:field-lead',
            evidence: [{ digest: event.source.providerPayloadDigest }],
          },
          recordedAt: PROVIDER_T1,
          recordedBy: 'principal:field-lead',
          uncertainty: {
            schemaVersion: 1,
            provenance: { kind: 'reported' },
            freshness: { state: 'fresh', assessedAt: PROVIDER_T1 },
            confidence: { method: 'stated', value: 0.8 },
          },
          proposedAt: PROVIDER_T2,
          proposedBy: PROVIDER_OPERATOR,
        },
        receivedAt: PROVIDER_T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-1' }),
      }),
    );
    expect(outcome.kind).toBe('intake-admitted');
    if (outcome.kind === 'intake-admitted' && outcome.proposal !== undefined) {
      expect(outcome.proposal.observation.kind).toBe('observation');
      expect(outcome.proposal.sourceEventDigest).toBe(event.contentDigest);
      expect(outcome.proposal.source.providerEventRef).toBe('msg-site-observation-1');
    }
    expect(runtime.recordedEvents().map((e) => e.payload.discriminator)).toEqual([
      'bridge:event-received',
      'bridge:intake-proposed',
    ]);
  });

  it('duplicate delivery of the same provider message returns the prior receipt (idempotent)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const event = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const first = unwrap(
      runtime.intakeExternalEvent({
        event,
        receivedAt: PROVIDER_T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-1' }),
      }),
    );
    const second = unwrap(
      runtime.intakeExternalEvent({
        event,
        receivedAt: PROVIDER_T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-1' }),
      }),
    );
    expect(first.kind).toBe('intake-admitted');
    expect(second.kind).toBe('duplicate-intake-returned');
    if (first.kind === 'intake-admitted' && second.kind === 'duplicate-intake-returned') {
      expect(second.receipt.contentDigest).toBe(first.receipt.contentDigest);
    }
  });

  it('the same provider message adapts deterministically (identical digests)', () => {
    const a = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const b = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    expect(a.contentDigest).toBe(b.contentDigest);
    expect(a.source.providerPayloadDigest).toBe(b.source.providerPayloadDigest);
  });
});

describe('inbound: negative adaptation', () => {
  it('a malformed provider payload is the typed unknown-provider-payload', () => {
    const result = adaptInboundMessage(malformedProviderMessage(), CONTEXT);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === 'unknown-provider-payload') {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('a conflicting provider message under the same idempotency key is a bridge replay-conflict', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const first = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    unwrap(
      runtime.intakeExternalEvent({
        event: first,
        receivedAt: PROVIDER_T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-1' }),
      }),
    );
    const conflicting = unwrap(
      adaptInboundMessage(conflictingProviderMessage(), {
        ...CONTEXT,
        eventId: 'bridge-event:chat-msg-2',
      }),
    );
    const result = runtime.intakeExternalEvent({
      event: { ...conflicting, idempotencyKey: CONTEXT.idempotencyKey },
      receivedAt: PROVIDER_T2,
      authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-2' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('replay-conflict');
  });

  it('the bridge tenant gate rejects a cross-tenant adapted event', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const crossTenant = unwrap(
      adaptInboundMessage(referenceProviderMessage(), {
        ...CONTEXT,
        tenantId: 'tenant:acme',
      }),
    );
    const result = runtime.intakeExternalEvent({
      event: crossTenant,
      receivedAt: PROVIDER_T2,
      authorization: gatePair({
        actionKind: 'bridge.event-intake',
        resourceId: 'bridge-event:chat-msg-1',
        tenantId: 'tenant:acme',
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('inbound: the provider registers into the bridge runtime', () => {
  it('the chat provider registers as a typed provider record', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const provider = new ChatReferenceProvider();
    const admission = unwrap(
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
    expect(admission.kind).toBe('registration-admitted');
    if (admission.kind === 'registration-admitted') {
      expect(admission.registration.adapterDescriptor.adapterId).toBe(
        'adapter:external-chat-reference',
      );
      expect(admission.registration.supportedOutboundClasses).toContain('information');
    }
    // A duplicate registration returns the prior record:
    const duplicate = unwrap(
      runtime.registerProvider({
        provider: new ChatReferenceProvider(),
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T1,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:external-chat-reference',
        }),
      }),
    );
    expect(duplicate.kind).toBe('duplicate-registration-returned');
  });
});
