/**
 * The INBOUND seam: one provider chat-message fixture becomes a
 * normalized bridge ExternalEvent (the provider contract's inbound
 * half). The adapter identity + the EXACT provider payload digest ride
 * in the W006-shaped provenance block (every normalized event is
 * attributable to the precise adapter revision and the exact provider
 * document it adapted).
 *
 * All instants are CALLER-SUPPLIED (zero wall-clock); the idempotency
 * key is caller-supplied (the bridge deduplicates on it).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { sealExternalEvent, type SealedExternalEvent } from '@epoch/external-event-bridge';
import { CHAT_ADAPTER_IDENTITY } from './descriptor';
import { parseProviderChatMessage, type ProviderChatMessage } from './provider/payload';
import { PROVIDER_KIND_TO_EVENT_CLASS } from './version';
import type { ChatAdapterResult } from './errors';

/** The caller-supplied adaptation context (everything the bridge record needs). */
export interface AdaptInboundContext {
  readonly eventId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
  readonly confidence: Readonly<Record<string, JsonValue>>;
  readonly reportedBy: string;
}

/** The digest of one provider payload (content addressing, W006 grammar). */
export function providerPayloadDigestOf(payload: ProviderChatMessage): Sha256Hex {
  return canonicalDigest(payload as unknown as JsonValue);
}

/**
 * Adapt one provider chat-message payload into a sealed bridge
 * external event. Total: unknown provider shapes are the typed
 * `unknown-provider-payload` (never a partial silent load).
 */
export function adaptInboundMessage(
  payload: unknown,
  context: AdaptInboundContext,
): ChatAdapterResult<SealedExternalEvent> {
  const parsed = parseProviderChatMessage(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'unknown-provider-payload',
        message: 'the payload is not a recognized provider chat message',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map((segment) => String(segment)).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const message = parsed.data;
  const eventClass = PROVIDER_KIND_TO_EVENT_CLASS[message.kind];
  const sealed = sealExternalEvent({
    schema: 'epoch.external-event-bridge.external-event',
    schemaVersion: 1,
    eventId: context.eventId,
    tenantId: context.tenantId,
    eventClass,
    source: {
      kind: 'reported',
      adapterId: CHAT_ADAPTER_IDENTITY.adapterId,
      adapterDescriptorDigest: CHAT_ADAPTER_IDENTITY.adapterDescriptorDigest,
      providerEventRef: message.messageId,
      providerPayloadDigest: providerPayloadDigestOf(message),
      recordedBy: context.reportedBy,
    },
    correlationId: context.correlationId,
    causationId: context.causationId,
    occurredAt: context.occurredAt,
    payload: {
      providerText: message.text,
      providerThreadRef: message.threadId,
      providerChannel: message.channel,
      providerAuthorRef: message.authorUserId,
      providerAttachments: message.attachments.map((attachment) => ({
        attachmentId: attachment.attachmentId,
        mediaType: attachment.mediaType,
        contentDigest: attachment.contentDigest,
      })),
    },
    confidence: context.confidence,
    idempotencyKey: context.idempotencyKey,
  });
  if (!sealed.ok) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: sealed.error.message,
        issues:
          sealed.error.code === 'validation' || sealed.error.code === 'version-unsupported'
            ? sealed.error.issues
            : [],
      },
    };
  }
  return { ok: true, value: sealed.value };
}
