/**
 * RENDERER INPUT (W056) — the two data halves of the interaction boundary:
 *
 * 1. {@link RendererInputEnvelope} — ONE raw renderer input event
 *    (pointer/keyboard primitive) BEFORE normalization, as the fabric
 *    receives it from a device modality. It is modality-tagged but
 *    semantically neutral: NO Epoch intent vocabulary lives here.
 *
 * 2. {@link RendererIntentReceipt} — the content-addressed receipt of one
 *    input NORMALIZATION: the semantic entity the input hit (when the
 *    adapter hit-tested one), the typed Epoch intent the input normalized
 *    to (the W013 ControlIntent — qualified id + semver core, bridging to
 *    the existing `epoch.world.interaction.*` vocabulary), the content
 *    digest of the full typed world-interaction record (digest addressing,
 *    never a parallel embedded vocabulary), and the typed outcome.
 *
 * The normalization itself (raw input -> hit-test -> semantic entity id ->
 * typed Epoch world interaction intent) is ADAPTER work behind the seam;
 * the fabric compiles the normalized intent into a W013 submit-intent
 * envelope and admits it through the REAL W013 boundary. Renderers never
 * author intents outside the existing Epoch vocabulary (lock rules 3/8).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  ControlIntentSchema,
  InteractionModalitySchema,
} from '@epoch/experience-protocol';
import {
  MAX_FABRIC_DETAIL_LENGTH,
  RENDERER_INTENT_RECEIPT_SCHEMA_NAME,
  RENDERER_INTENT_OUTCOMES,
  RENDERER_INPUT_ENVELOPE_SCHEMA_NAME,
  RendererFabricProtocolVersionSchema,
  RendererIntentOutcomeSchema,
  RendererInputKindSchema,
} from './version';
import {
  FabricSessionIdSchema,
  InputIdSchema,
  InputKeySchema,
  PointerPositionSchema,
  type InputKey,
  type PointerPosition,
  WorldEntityIdMirrorSchema,
} from './fabric-primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';

// ---------------------------------------------------------------------------
// The raw input envelope (pre-normalization).
// ---------------------------------------------------------------------------

/**
 * One raw renderer input envelope. Exactly one payload matches the input
 * kind: pointer kinds carry `pointer`; key kinds carry `key`; `wheel`
 * carries `delta` (scroll axes, bounded). Strict objects reject unknown
 * fields (no vendor/engine payload smuggling).
 */
export const RendererInputEnvelopeSchema = z
  .discriminatedUnion('inputKind', [
    z
      .strictObject({
        schema: z.literal(RENDERER_INPUT_ENVELOPE_SCHEMA_NAME),
        fabricProtocolVersion: RendererFabricProtocolVersionSchema,
        inputId: InputIdSchema,
        fabricSessionId: FabricSessionIdSchema,
        atMs: VirtualTimeMsSchema,
        modality: InteractionModalitySchema,
        inputKind: z.enum(['pointer-down', 'pointer-move', 'pointer-up']),
        pointer: PointerPositionSchema,
        /** The typed Epoch intent the pointer carries a hint for (optional; the adapter hit-tests authoritatively). */
        intentHint: z
          .strictObject({
            intent: ControlIntentSchema,
          })
          .optional(),
      })
      .meta({
        id: 'PointerInputEnvelope',
        title: 'PointerInputEnvelope',
        description: 'One raw pointer input envelope: normalized viewport position plus optional intent hint.',
      }),
    z
      .strictObject({
        schema: z.literal(RENDERER_INPUT_ENVELOPE_SCHEMA_NAME),
        fabricProtocolVersion: RendererFabricProtocolVersionSchema,
        inputId: InputIdSchema,
        fabricSessionId: FabricSessionIdSchema,
        atMs: VirtualTimeMsSchema,
        modality: InteractionModalitySchema,
        inputKind: z.enum(['key-down', 'key-up']),
        key: InputKeySchema,
      })
      .meta({
        id: 'KeyInputEnvelope',
        title: 'KeyInputEnvelope',
        description: 'One raw key input envelope: bounded key token plus sorted modifier set.',
      }),
    z
      .strictObject({
        schema: z.literal(RENDERER_INPUT_ENVELOPE_SCHEMA_NAME),
        fabricProtocolVersion: RendererFabricProtocolVersionSchema,
        inputId: InputIdSchema,
        fabricSessionId: FabricSessionIdSchema,
        atMs: VirtualTimeMsSchema,
        modality: InteractionModalitySchema,
        inputKind: z.literal('wheel'),
        delta: z
          .strictObject({
            x: z.number().finite(),
            y: z.number().finite(),
          })
          .meta({
            id: 'WheelDelta',
            title: 'WheelDelta',
            description: 'One wheel delta: bounded scroll axes.',
          }),
      })
      .meta({
        id: 'WheelInputEnvelope',
        title: 'WheelInputEnvelope',
        description: 'One raw wheel input envelope: scroll axes.',
      }),
  ])
  .meta({
    id: 'RendererInputEnvelope',
    title: 'RendererInputEnvelope',
    description:
      'One raw renderer input envelope (pre-normalization): pointer, key, or wheel primitive from a declared interaction modality.',
  });

/** One raw input envelope. */
export type RendererInputEnvelope = z.infer<typeof RendererInputEnvelopeSchema>;

/** One pointer input envelope. */
export type PointerInputEnvelope = Extract<RendererInputEnvelope, { readonly pointer: PointerPosition }>;

/** One key input envelope. */
export type KeyInputEnvelope = Extract<RendererInputEnvelope, { readonly key: InputKey }>;

// ---------------------------------------------------------------------------
// The intent receipt (post-normalization execution evidence).
// ---------------------------------------------------------------------------

/**
 * The content of a renderer intent receipt (everything except the digest):
 * the input it normalizes, the semantic entity the adapter hit-tested
 * (when one), the typed Epoch ControlIntent the input normalized to, the
 * content digest of the full typed world-interaction record (digest
 * addressing — the renderer contract never embeds a parallel intent
 * vocabulary), the typed outcome, and the W013 admission link.
 *
 * Consistency rules: a `no-target` outcome carries NO intent (nothing was
 * hit); a `normalized` outcome carries intent, payload digest, and the
 * W013 admission digest; a `rejected` outcome carries the typed rejection
 * detail instead.
 */
export const RendererIntentReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_INTENT_RECEIPT_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    inputId: InputIdSchema,
    fabricSessionId: FabricSessionIdSchema,
    /** The modality the input arrived on. */
    modality: InteractionModalitySchema,
    /** The raw input kind that was normalized. */
    inputKind: RendererInputKindSchema,
    /** The semantic entity the adapter hit-tested (absent when nothing was hit). */
    hitEntityId: WorldEntityIdMirrorSchema.optional(),
    /** The typed Epoch intent the input normalized to (normalized outcome only). */
    intent: ControlIntentSchema.optional(),
    /** Content digest of the full typed world-interaction record (digest addressing). */
    intentPayloadDigest: Sha256HexSchema.optional(),
    /** The typed outcome of the normalization. */
    outcome: RendererIntentOutcomeSchema,
    /** Digest of the W013 intent receipt that admitted the normalized intent. */
    admissionDigest: Sha256HexSchema.optional(),
    /** Typed neutral rejection detail (rejected outcome only). */
    rejectionDetail: z.string().max(MAX_FABRIC_DETAIL_LENGTH).optional(),
    /** Virtual time of the normalization (caller-supplied). */
    atMs: VirtualTimeMsSchema,
  })
  .superRefine((receipt, ctx) => {
    if (receipt.outcome === 'no-target') {
      if (receipt.intent !== undefined || receipt.hitEntityId !== undefined || receipt.admissionDigest !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a no-target outcome carries no intent, hit, or admission (nothing was hit)',
          path: ['outcome'],
        });
      }
      return;
    }
    if (receipt.outcome === 'normalized') {
      if (receipt.intent === undefined || receipt.intentPayloadDigest === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a normalized outcome carries its typed intent and payload digest',
          path: ['intent'],
        });
      }
      if (receipt.admissionDigest === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a normalized outcome links the W013 admission digest (every emitted intent is an admitted intent)',
          path: ['admissionDigest'],
        });
      }
      return;
    }
    // outcome === 'rejected'
    if (receipt.rejectionDetail === undefined || receipt.intent !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a rejected outcome carries its typed rejection detail and no intent',
        path: ['rejectionDetail'],
      });
    }
  })
  .meta({
    id: 'RendererIntentReceiptContent',
    title: 'RendererIntentReceiptContent',
    description:
      'The content of a renderer intent receipt: input identity, hit-tested semantic entity, normalized typed intent (digest-addressed payload), typed outcome, and W013 admission link.',
  });

/** One intent-receipt content. */
export type RendererIntentReceiptContent = z.infer<typeof RendererIntentReceiptContentSchema>;

/**
 * The sealed renderer intent receipt: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded).
 */
export const RendererIntentReceiptSchema = RendererIntentReceiptContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererIntentReceipt',
  title: 'RendererIntentReceipt',
  description:
    'The sealed renderer intent receipt: content-addressed evidence of one normalized renderer input.',
});

/** One sealed intent receipt. */
export type RendererIntentReceipt = z.infer<typeof RendererIntentReceiptSchema>;

/** The empty-outcome vocabulary re-export (mirrors the contract manifest). */
export const RENDERER_INTENT_OUTCOME_LIST = RENDERER_INTENT_OUTCOMES;

/** Seal valid intent-receipt content (content + its SHA-256 digest). */
export function sealRendererIntentReceipt(
  content: RendererIntentReceiptContent,
): RendererIntentReceipt {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
