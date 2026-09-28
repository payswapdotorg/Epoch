/**
 * Deterministic provider fixtures (zero wall-clock, zero randomness):
 * the reference message/thread/user payloads the in-memory adapter
 * runs on. NO network — these stand in for the provider's native
 * documents (the W029 fixture discipline).
 */
import type { ProviderChatMessage, ProviderThread, ProviderUser } from './payload';

/** Caller-supplied instants (ascending). */
export const PROVIDER_T0 = '2026-02-02T08:00:00.000Z';
export const PROVIDER_T1 = '2026-02-02T08:05:00.000Z';
export const PROVIDER_T2 = '2026-02-02T08:12:00.000Z';
export const PROVIDER_T3 = '2026-02-02T08:25:00.000Z';

/** The fixture operator principal. */
export const PROVIDER_OPERATOR = 'principal:chat-relay';

/** The fixture tenants. */
export const PROVIDER_TENANT_A = 'tenant:globex';
export const PROVIDER_TENANT_B = 'tenant:acme';

/** The reference provider message (an observation report). */
export function referenceProviderMessage(
  overrides?: Partial<{
    messageId: string;
    threadId: string;
    kind: ProviderChatMessage['kind'];
    text: string;
    sentAt: string;
    authorUserId: string;
  }>,
): ProviderChatMessage {
  return {
    messageId: overrides?.messageId ?? 'msg-site-observation-1',
    threadId: overrides?.threadId ?? 'thread-site-b4',
    authorUserId: overrides?.authorUserId ?? 'user-field-lead-7',
    channel: 'channel-site-ops',
    kind: overrides?.kind ?? 'observation',
    text:
      overrides?.text ??
      'Grid B4 excavation reached 1250mm; requesting confirmation against the foundation level drawing.',
    sentAt: overrides?.sentAt ?? PROVIDER_T1,
    attachments: [
      {
        attachmentId: 'att-depth-photo-1',
        mediaType: 'image/jpeg',
        contentDigest: '7c'.repeat(32),
      },
    ],
  };
}

/** A conflicting provider message (same id, different content). */
export function conflictingProviderMessage(): ProviderChatMessage {
  return referenceProviderMessage({
    text: 'Grid B4 excavation reached 980mm (conflicting report).',
  });
}

/** A malformed provider message (missing required field). */
export function malformedProviderMessage(): Record<string, unknown> {
  return {
    messageId: 'msg-malformed-1',
    threadId: 'thread-site-b4',
    // authorUserId missing; kind missing; text missing.
    channel: 'channel-site-ops',
    sentAt: PROVIDER_T1,
    attachments: [],
  };
}

/** The reference provider thread. */
export function referenceProviderThread(): ProviderThread {
  return {
    threadId: 'thread-site-b4',
    title: 'Site B4 earthworks supervision',
    memberUserIds: ['user-field-lead-7', 'user-program-manager-2', 'user-supervisor-9'],
    channel: 'channel-site-ops',
  };
}

/** The reference provider users. */
export function referenceProviderUsers(): readonly ProviderUser[] {
  return [
    { userId: 'user-field-lead-7', displayName: 'Field Lead (Site B4)', role: 'member' },
    { userId: 'user-program-manager-2', displayName: 'Program Manager', role: 'supervisor' },
    { userId: 'user-supervisor-9', displayName: 'Site Supervisor', role: 'supervisor' },
  ];
}

/** A scripted provider delivery schedule (success on first attempt). */
export const SUCCESS_DELIVERY_SCRIPT = [{ outcome: 'success' as const }];

/** A scripted provider delivery schedule (one retryable failure, then success). */
export const RETRYABLE_DELIVERY_SCRIPT = [
  { outcome: 'retryable' as const, detail: 'provider fixture congestion' },
  { outcome: 'success' as const },
];

/** A scripted provider delivery schedule (terminal refusal). */
export const TERMINAL_DELIVERY_SCRIPT = [
  { outcome: 'terminal' as const, detail: 'the provider fixture refuses this delivery' },
];
