/**
 * Typed invocation envelopes — how a consumer asks the renderer hosting
 * surface to EXECUTE (never author) presentation work.
 *
 * The renderer runtime consumes render-ready typed structures (W011
 * Experience Graphs — and, transitively, future compiler output, which
 * emits the same W011 contract): a `mount-graph` envelope references its
 * graph by CONTENT DIGEST and the caller supplies the graph document
 * alongside, so admission can verify the claimed digest against the
 * document (tamper detection) before enforcing capabilities and budgets.
 * `advance-frame` executes one frame of the mounted state at a virtual
 * time. `submit-intent` admits one typed control intent (R30 —
 * shape-identical to the action-protocol ActionTypeReference, so the
 * future control-to-proposal wiring through the Action Gateway needs no
 * translation layer) from a declared interaction modality.
 *
 * Envelopes are transient inputs (not sealed records); their execution
 * evidence is the content-addressed receipt family (src/receipt.ts).
 * Strict objects reject unknown fields, so vendor/engine smuggle attempts
 * fail as typed `malformed-invocation` errors with precise paths.
 */
import { z } from 'zod';
import {
  ControlIntentSchema,
  InteractionModalitySchema,
} from '@epoch/experience-protocol';
import {
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
  RENDERER_INVOCATION_SCHEMA_NAME,
  RendererProtocolVersionSchema,
} from './version';
import {
  InvocationIdSchema,
  RendererSessionIdSchema,
  Sha256HexSchema,
  VirtualTimeMsSchema,
} from './primitives';

/**
 * Mount (or replace) the render-ready state: the envelope claims the
 * content digest of the sealed W011 Experience Graph document the caller
 * supplies alongside. `declaredTriangles` / `declaredTextureBytes` are the
 * caller's declared usage of resources the boundary cannot introspect
 * (opaque content-addressed assets); they are REQUIRED when the binding's
 * effective limits bound that resource (enforced at admission).
 */
const MountGraphEnvelopeSchema = z
  .strictObject({
    schema: z.literal(RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('mount-graph'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    graphDigest: Sha256HexSchema,
    atMs: VirtualTimeMsSchema,
    declaredTriangles: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_RENDERER_TRIANGLES)
      .optional(),
    declaredTextureBytes: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_RENDERER_TEXTURE_BYTES)
      .optional(),
  })
  .meta({
    id: 'MountGraphEnvelope',
    title: 'MountGraphEnvelope',
    description:
      'Invocation envelope: mount the render-ready state referenced by content digest, with optional declared resource usage.',
  });

/** Execute one frame of the mounted state at a virtual time. */
const AdvanceFrameEnvelopeSchema = z
  .strictObject({
    schema: z.literal(RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('advance-frame'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    frameIndex: z.number().int().nonnegative(),
    atMs: VirtualTimeMsSchema,
  })
  .meta({
    id: 'AdvanceFrameEnvelope',
    title: 'AdvanceFrameEnvelope',
    description: 'Invocation envelope: execute one frame of the mounted state at a virtual time.',
  });

/** Admit one typed control intent from a declared interaction modality. */
const SubmitIntentEnvelopeSchema = z
  .strictObject({
    schema: z.literal(RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    kind: z.literal('submit-intent'),
    invocationId: InvocationIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    modality: InteractionModalitySchema,
    intent: ControlIntentSchema,
  })
  .meta({
    id: 'SubmitIntentEnvelope',
    title: 'SubmitIntentEnvelope',
    description:
      'Invocation envelope: admit one typed control intent (R30) emitted from a declared interaction modality.',
  });

/** The invocation-envelope union (discriminated on `kind`). */
export const InvocationEnvelopeSchema = z
  .discriminatedUnion('kind', [
    MountGraphEnvelopeSchema,
    AdvanceFrameEnvelopeSchema,
    SubmitIntentEnvelopeSchema,
  ])
  .meta({
    id: 'InvocationEnvelope',
    title: 'InvocationEnvelope',
    description:
      'One typed invocation envelope of the renderer hosting surface: mount-graph, advance-frame, or submit-intent.',
  });

/** One invocation envelope. */
export type InvocationEnvelope = z.infer<typeof InvocationEnvelopeSchema>;

/** One mount-graph envelope. */
export type MountGraphEnvelope = z.infer<typeof MountGraphEnvelopeSchema>;

/** One advance-frame envelope. */
export type AdvanceFrameEnvelope = z.infer<typeof AdvanceFrameEnvelopeSchema>;

/** One submit-intent envelope. */
export type SubmitIntentEnvelope = z.infer<typeof SubmitIntentEnvelopeSchema>;
