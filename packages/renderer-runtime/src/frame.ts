/**
 * The RENDERER FRAME ENVELOPE (W056) — the typed per-frame presentation
 * update the fabric feeds a renderer session.
 *
 * One frame envelope names the session, the frame index (monotonic per
 * session), the virtual time, the canonical world digest of the revision
 * being presented (continuity anchor — a frame never presents a revision
 * other than the session's mounted one), the TYPED presentation fidelity
 * for the frame (the degradation knob: a renderer may reduce presentation
 * fidelity, but only as typed data, never silently, and never as a
 * semantic change), and the digest of the W013 frame receipt that admitted
 * the frame (content-addressed execution evidence — every applied frame
 * is an admitted frame).
 */
import { z } from 'zod';
import {
  RENDERER_FRAME_ENVELOPE_SCHEMA_NAME,
  RendererDegradationKindSchema,
  RendererFabricProtocolVersionSchema,
} from './version';
import { FabricSessionIdSchema } from './fabric-primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';

/**
 * One frame envelope. Consistency rule: only a frame carrying an active
 * (non-`none`) degradation presents reduced fidelity — degradation is
 * typed data, never a silent mode.
 */
export const RendererFrameEnvelopeSchema = z
  .strictObject({
    schema: z.literal(RENDERER_FRAME_ENVELOPE_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    fabricSessionId: FabricSessionIdSchema,
    /** The frame index (monotonic per session; the fabric enforces strict growth). */
    frameIndex: z.number().int().nonnegative(),
    /** Virtual time of the frame (caller-supplied; zero wall-clock). */
    atMs: VirtualTimeMsSchema,
    /** The canonical world digest of the presented revision (continuity anchor). */
    worldDigest: Sha256HexSchema,
    /** The typed presentation fidelity of this frame. */
    degradation: RendererDegradationKindSchema,
    /** Digest of the W013 frame receipt that admitted this frame (every applied frame is an admitted frame). */
    admissionDigest: Sha256HexSchema,
  })
  .meta({
    id: 'RendererFrameEnvelope',
    title: 'RendererFrameEnvelope',
    description:
      'One typed frame envelope: session, monotonic frame index, virtual time, canonical world digest (continuity), typed presentation fidelity, and the admitting W013 frame-receipt digest.',
  });

/** One frame envelope. */
export type RendererFrameEnvelope = z.infer<typeof RendererFrameEnvelopeSchema>;
