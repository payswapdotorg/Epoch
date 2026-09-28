// DETERMINISM + ROUND-TRIP SERIALIZATION for the adapter outputs:
// identical fixtures -> identical digests; the sealed adapter-derived
// records are plain JSON objects that round-trip byte-identically.
import { describe, expect, it } from 'vitest';
import { verifySealedExternalEvent } from '@epoch/external-event-bridge';
import {
  adaptInboundMessage,
  referenceProviderMessage,
  providerPayloadDigestOf,
  deriveCapabilityRegistrations,
  ChatReferenceProvider,
  scriptedOutcomeOf,
  providerDeliveryRefOf,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
} from '../src/index';

const CONTEXT = {
  eventId: 'bridge-event:chat-msg-1',
  tenantId: PROVIDER_TENANT_A,
  correlationId: 'corr:det-1',
  causationId: null as string | null,
  occurredAt: PROVIDER_T1,
  idempotencyKey: 'idem:det-1',
  confidence: { method: 'stated', value: 0.8 },
  reportedBy: PROVIDER_OPERATOR,
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('determinism', () => {
  it('identical provider fixtures adapt to identical sealed events', () => {
    const a = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const b = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('the provider payload digest is deterministic across key-order permutations', () => {
    const message = referenceProviderMessage();
    // Canonical JSON sorts keys, so key-order-only permutations digest
    // identically (no insertion-order leaks):
    const keyOrderPermutation = {
      sentAt: message.sentAt,
      attachments: message.attachments,
      text: message.text,
      kind: message.kind,
      channel: message.channel,
      authorUserId: message.authorUserId,
      threadId: message.threadId,
      messageId: message.messageId,
    };
    expect(providerPayloadDigestOf(keyOrderPermutation)).toBe(providerPayloadDigestOf(message));
    // Different CONTENT (a different text) digests differently:
    const different = { ...message, text: 'a different report text' };
    expect(providerPayloadDigestOf(different)).not.toBe(providerPayloadDigestOf(message));
  });

  it('the scripted outcomes are deterministic per (request, attempt)', () => {
    const request = {
      requestId: 'outbound:info-1',
      tenantId: PROVIDER_TENANT_A,
      requestClass: 'information' as const,
      recipientRef: 'role:site-supervisor',
      correlationId: 'corr:det-1',
      causationId: null,
      payload: { released: [], redacted: [] },
      projectionDigest: 'ab'.repeat(32),
    };
    const attempt = { attemptNo: 1, scheduledAt: PROVIDER_T1 };
    expect(scriptedOutcomeOf([], request, attempt)).toEqual(
      scriptedOutcomeOf([], request, attempt),
    );
    expect(providerDeliveryRefOf(request, attempt)).toBe(
      providerDeliveryRefOf(request, { attemptNo: 1, scheduledAt: PROVIDER_T1 }),
    );
  });

  it('the derived capability registrations are deterministic', () => {
    expect(deriveCapabilityRegistrations()).toEqual(deriveCapabilityRegistrations());
  });

  it('two fresh provider instances behave identically (no instance state leaks)', () => {
    const request = {
      requestId: 'outbound:info-1',
      tenantId: PROVIDER_TENANT_A,
      requestClass: 'information' as const,
      recipientRef: 'role:site-supervisor',
      correlationId: 'corr:det-1',
      causationId: null,
      payload: { released: [], redacted: [] },
      projectionDigest: 'ab'.repeat(32),
    };
    const a = new ChatReferenceProvider().deliver(request, { attemptNo: 1, scheduledAt: PROVIDER_T1 });
    const b = new ChatReferenceProvider().deliver(request, { attemptNo: 1, scheduledAt: PROVIDER_T1 });
    expect(a).toEqual(b);
  });
});

describe('round-trip serialization', () => {
  it('the adapted sealed event round-trips through JSON and verifies', () => {
    const sealed = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const back = JSON.parse(JSON.stringify(sealed)) as typeof sealed;
    expect(back).toEqual(sealed);
    const verified = unwrap(verifySealedExternalEvent(back));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });

  it('the provider thread/user fixtures round-trip through JSON', () => {
    const message = referenceProviderMessage();
    const back = JSON.parse(JSON.stringify(message)) as typeof message;
    expect(back).toEqual(message);
    expect(providerPayloadDigestOf(back)).toBe(providerPayloadDigestOf(message));
  });

  it('an adapted event with a different instant is DIFFERENT content (caller-supplied instants matter)', () => {
    const a = unwrap(adaptInboundMessage(referenceProviderMessage(), CONTEXT));
    const b = unwrap(
      adaptInboundMessage(referenceProviderMessage(), {
        ...CONTEXT,
        occurredAt: PROVIDER_T2,
      }),
    );
    expect(a.contentDigest).not.toBe(b.contentDigest);
  });
});
