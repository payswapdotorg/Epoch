/**
 * Typed renderer receipts — the content-addressed execution evidence of
 * the hosting surface (R26 visible/replayable activity).
 *
 * Every admitted invocation produces exactly one receipt (discriminated on
 * `kind`, mirroring the invocation kinds), sealed with the SHA-256 digest
 * of its canonical-JSON content. Replaying an invocation against the same
 * binding revision produces a byte-identical receipt (idempotent,
 * deterministic evidence).
 */
import { z } from 'zod';
import {
  ControlIntentSchema,
  ExperienceGraphKindSchema,
  InteractionModalitySchema,
  TenantScopeSchema,
} from '@epoch/experience-protocol';
import {
  RENDERER_RECEIPT_SCHEMA_NAME,
  RendererProtocolVersionSchema,
  RendererReceiptKindSchema,
} from './version';
import {
  InvocationIdSchema,
  RendererSessionIdSchema,
  Sha256HexSchema,
  VirtualTimeMsSchema,
} from './primitives';

/** The receipt of an admitted `mount-graph` invocation. */
const MountReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_RECEIPT_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('mount-receipt'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    /** The tenant scope the executing binding belongs to (R12). */
    tenantScope: TenantScopeSchema,
    /** The content digest of the mounted graph (the envelope's claim, verified). */
    graphDigest: Sha256HexSchema,
    /** The mounted graph's presentation kind (W011 vocabulary). */
    graphKind: ExperienceGraphKindSchema,
    /** Node/edge counts of the mounted graph (the enforced budget facts). */
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    /** Virtual time the state was mounted at. */
    mountedAtMs: VirtualTimeMsSchema,
    /** The declared resource usage the boundary admitted. */
    declaredTriangles: z.number().int().nonnegative().optional(),
    declaredTextureBytes: z.number().int().nonnegative().optional(),
  })
  .meta({
    id: 'MountReceiptContent',
    title: 'MountReceiptContent',
    description: 'Execution evidence of an admitted mount-graph invocation.',
  });

/** The receipt of an admitted `advance-frame` invocation. */
const FrameReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_RECEIPT_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('frame-receipt'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    /** The tenant scope the executing binding belongs to (R12). */
    tenantScope: TenantScopeSchema,
    /** The executed frame index (monotonic per binding). */
    frameIndex: z.number().int().nonnegative(),
    /** The virtual time the frame executed at. */
    atMs: VirtualTimeMsSchema,
    /** The content digest of the state the frame executed against (absent = no state mounted). */
    stateDigest: Sha256HexSchema.optional(),
  })
  .meta({
    id: 'FrameReceiptContent',
    title: 'FrameReceiptContent',
    description: 'Execution evidence of an admitted advance-frame invocation.',
  });

/** The receipt of an admitted `submit-intent` invocation. */
const IntentReceiptContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_RECEIPT_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('intent-receipt'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    /** The tenant scope the executing binding belongs to (R12). */
    tenantScope: TenantScopeSchema,
    /** The modality the intent was admitted from. */
    modality: InteractionModalitySchema,
    /** The admitted typed control intent (R30). */
    intent: ControlIntentSchema,
  })
  .meta({
    id: 'IntentReceiptContent',
    title: 'IntentReceiptContent',
    description: 'Execution evidence of an admitted submit-intent invocation.',
  });

/** The receipt-content union (discriminated on `kind`). */
export const RendererReceiptContentSchema = z
  .discriminatedUnion('kind', [
    MountReceiptContentSchema,
    FrameReceiptContentSchema,
    IntentReceiptContentSchema,
  ])
  .meta({
    id: 'RendererReceiptContent',
    title: 'RendererReceiptContent',
    description:
      'The content of a renderer receipt: the typed execution evidence of one admitted invocation.',
  });

/** One receipt content. */
export type RendererReceiptContent = z.infer<typeof RendererReceiptContentSchema>;

/**
 * The sealed renderer receipt: content plus its SHA-256 digest over the
 * canonical JSON of the content (the digest field excluded). The digest
 * addresses the exact revision of the execution evidence.
 */
export const RendererReceiptSchema = z
  .discriminatedUnion('kind', [
    MountReceiptContentSchema.extend({ digest: Sha256HexSchema }).meta({
      id: 'MountReceipt',
      title: 'MountReceipt',
      description: 'The sealed mount-graph execution receipt (content plus SHA-256 digest).',
    }),
    FrameReceiptContentSchema.extend({ digest: Sha256HexSchema }).meta({
      id: 'FrameReceipt',
      title: 'FrameReceipt',
      description: 'The sealed advance-frame execution receipt (content plus SHA-256 digest).',
    }),
    IntentReceiptContentSchema.extend({ digest: Sha256HexSchema }).meta({
      id: 'IntentReceipt',
      title: 'IntentReceipt',
      description: 'The sealed submit-intent execution receipt (content plus SHA-256 digest).',
    }),
  ])
  .meta({
    id: 'RendererReceipt',
    title: 'RendererReceipt',
    description:
      'The sealed renderer receipt: typed execution evidence plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed renderer receipt. */
export type RendererReceipt = z.infer<typeof RendererReceiptSchema>;

// Keep the receipt-kind vocabulary import used (surface parity export).
export { RendererReceiptKindSchema };
