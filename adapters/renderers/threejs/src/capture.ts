/**
 * Frame/evidence capture (W058) — declared by the capability set
 * (`frameCapture: true`), executed ONLY through an injected GL surface.
 *
 * HONEST SCOPE: in the default headless mode there is no GL context, so
 * image capture is a TYPED REFUSAL — the adapter never fabricates pixel
 * evidence (a unit suite without a real renderer surface does not close a
 * renderer Work Order; the browser GL loop closes with W061). A browser
 * host injects the surface (`src/surface.ts`), and capture produces a
 * digest-addressed record ready for the EXISTING Epoch evidence path: the
 * adapter hands back typed data (media type, byte size, SHA-256 image
 * digest) — it NEVER writes evidence itself (no durable writes, ever; the
 * Verification/Evidence authority receives the record through its own
 * admission).
 */
import { sha256Hex } from '@epoch/agent-protocol';
import type { FabricResult } from '@epoch/renderer-runtime';
import type { ThreeAdapterRuntimeState } from './state';
import { HEADLESS_CAPTURE_REFUSAL, type ThreeFrameCapture } from './surface';

/** Platform-neutral hex of a byte array (no Node/browser globals here). */
function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/** Capture one frame image of the session's presentation (surface-gated). */
export function captureFrameImage(
  state: ThreeAdapterRuntimeState,
  input: { readonly frameIndex: number; readonly atMs: number; readonly width: number; readonly height: number },
): FabricResult<ThreeFrameCapture> {
  if (state.disposed) {
    return {
      ok: false,
      error: {
        code: 'session-disposed',
        message: 'the three.js adapter session is disposed (terminal) — capture refused',
        fabricSessionId: state.fabricSessionId,
      },
    };
  }
  if (state.glSurface === null || state.presentation === null) {
    return {
      ok: false,
      error: {
        code: 'session-failed',
        message: HEADLESS_CAPTURE_REFUSAL,
        fabricSessionId: state.fabricSessionId,
      },
    };
  }
  const { renderer, pixelSource } = state.glSurface;
  const { mediaType, bytes } = pixelSource(renderer);
  // The image digest addresses the byte content (platform-neutral hex
  // fold — the same digest in Node tests and the browser host).
  const capture: ThreeFrameCapture = {
    schema: 'epoch.renderer.frame-capture',
    frameIndex: input.frameIndex,
    atMs: input.atMs,
    worldDigest: state.worldProjection.worldDigest,
    width: input.width,
    height: input.height,
    mediaType,
    byteSize: bytes.byteLength,
    imageDigest: sha256Hex(hexOf(bytes)),
  };
  return { ok: true, value: capture };
}
