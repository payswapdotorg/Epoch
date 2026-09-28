/**
 * The provider seam — the quarantined provider vocabulary (the W029
 * pattern): fixture-driven message/thread/user payload shapes standing
 * in for the external chat system's native payloads. NO network, NO
 * live provider calls — these schemas parse PROVIDER FIXTURES only.
 *
 * Everything below uses the provider's own field names; nothing here
 * leaks across the neutral seam (the per-adapter blocklist test pins
 * that the neutral modules carry none of these tokens).
 */
import { z } from 'zod';

/** The provider's message id grammar (opaque, 1..128 chars). */
const PROVIDER_MESSAGE_ID = z.string().min(1).max(128);

/** The provider's thread id grammar (opaque, 1..128 chars). */
const PROVIDER_THREAD_ID = z.string().min(1).max(128);

/** The provider's user id grammar (opaque, 1..128 chars). */
const PROVIDER_USER_ID = z.string().min(1).max(128);

/** The provider's channel handle grammar (opaque, 1..64 chars). */
const PROVIDER_CHANNEL = z.string().min(1).max(64);

/** The provider's instant grammar (caller-supplied, canonical UTC). */
const PROVIDER_INSTANT = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  'the provider instant is a canonical UTC timestamp',
);

/** The provider's message kinds (the provider's own discriminator). */
export const PROVIDER_MESSAGE_KIND_VALUES = [
  'observation',
  'acknowledgement',
  'information-response',
  'status',
  'exception',
  'receipt',
  'evidence',
] as const;

/** One provider message kind. */
export type ProviderMessageKindValue = (typeof PROVIDER_MESSAGE_KIND_VALUES)[number];

/** One provider attachment reference (opaque). */
export const ProviderAttachmentSchema = z
  .strictObject({
    attachmentId: z.string().min(1).max(128),
    mediaType: z.string().min(1).max(128),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'ProviderAttachment',
    title: 'ProviderAttachment',
    description: 'One provider attachment reference: opaque id, media type, and content digest.',
  });

/** One provider attachment reference. */
export type ProviderAttachment = z.infer<typeof ProviderAttachmentSchema>;

/**
 * The provider CHAT MESSAGE payload — the fixture shape standing in
 * for the external chat system's native message document.
 */
export const ProviderChatMessageSchema = z
  .strictObject({
    messageId: PROVIDER_MESSAGE_ID,
    threadId: PROVIDER_THREAD_ID,
    authorUserId: PROVIDER_USER_ID,
    channel: PROVIDER_CHANNEL,
    kind: z.enum(PROVIDER_MESSAGE_KIND_VALUES),
    text: z.string().min(1).max(4096),
    sentAt: PROVIDER_INSTANT,
    attachments: z.array(ProviderAttachmentSchema).max(16),
    replyToMessageId: PROVIDER_MESSAGE_ID.optional(),
  })
  .readonly()
  .superRefine((message, ctx) => {
    for (let i = 1; i < message.attachments.length; i += 1) {
      if (message.attachments[i]!.attachmentId <= message.attachments[i - 1]!.attachmentId) {
        ctx.addIssue({
          code: 'custom',
          message: 'attachments must be sorted ascending and duplicate-free by attachmentId',
          path: ['attachments'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ProviderChatMessage',
    title: 'ProviderChatMessage',
    description:
      'The provider chat-message fixture: message/thread/author ids, channel, kind discriminator, text, sent instant, sorted attachments, optional reply reference.',
  });

/** One provider chat message. */
export type ProviderChatMessage = z.infer<typeof ProviderChatMessageSchema>;

/**
 * The provider THREAD payload — the fixture shape standing in for the
 * external chat system's native thread document.
 */
export const ProviderThreadSchema = z
  .strictObject({
    threadId: PROVIDER_THREAD_ID,
    title: z.string().min(1).max(256),
    memberUserIds: z.array(PROVIDER_USER_ID).max(64),
    channel: PROVIDER_CHANNEL,
  })
  .readonly()
  .superRefine((thread, ctx) => {
    for (let i = 1; i < thread.memberUserIds.length; i += 1) {
      if (thread.memberUserIds[i]! <= thread.memberUserIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'memberUserIds must be sorted ascending and duplicate-free',
          path: ['memberUserIds'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ProviderThread',
    title: 'ProviderThread',
    description:
      'The provider thread fixture: thread id, title, sorted member user ids, and channel.',
  });

/** One provider thread. */
export type ProviderThread = z.infer<typeof ProviderThreadSchema>;

/**
 * The provider USER payload — the fixture shape standing in for the
 * external chat system's native user document.
 */
export const ProviderUserSchema = z
  .strictObject({
    userId: PROVIDER_USER_ID,
    displayName: z.string().min(1).max(256),
    role: z.enum(['member', 'supervisor', 'observer']),
  })
  .readonly()
  .meta({
    id: 'ProviderUser',
    title: 'ProviderUser',
    description: 'The provider user fixture: user id, display name, and role.',
  });

/** One provider user. */
export type ProviderUser = z.infer<typeof ProviderUserSchema>;

/** Parse an untrusted provider message payload (total, never throws). */
export function parseProviderChatMessage(payload: unknown) {
  return ProviderChatMessageSchema.safeParse(payload);
}

/** Parse an untrusted provider thread payload (total, never throws). */
export function parseProviderThread(payload: unknown) {
  return ProviderThreadSchema.safeParse(payload);
}

/** Parse an untrusted provider user payload (total, never throws). */
export function parseProviderUser(payload: unknown) {
  return ProviderUserSchema.safeParse(payload);
}
