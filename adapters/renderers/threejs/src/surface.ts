/**
 * The injected GL surface (W058) — the seam between the headless adapter
 * core and the browser-only WebGL path.
 *
 * DESIGN (the work order's technical approach): Three.js's scene graph,
 * camera math, and Raycaster work WITHOUT a GL context — those are the
 * adapter's deterministic core and are fully testable in Node 22 (no GPU).
 * `WebGLRenderer` construction and frame image capture REQUIRE a real GL
 * context (a canvas with `getContext('webgl2')`), so this module defines
 * the INJECTED surface a browser host supplies:
 *
 * - HEADLESS (default, `surfaceFactory` omitted): no renderer is created;
 *   `applyFrame` advances the scene-graph presentation (animations,
 *   timeline, degradation state) and reports `presented: true` with a
 *   headless note; frame IMAGE capture is a typed refusal. Everything else
 *   — mounting, entity mapping, Raycaster hit-testing, input normalization,
 *   capability declaration, degradation, snapshot/restore, disposal — is
 *   the real product path.
 * - BROWSER (host injects a factory): the factory constructs the
 *   `WebGLRenderer` over the Epoch-owned viewport canvas (W057 owns the
 *   mount; W061 closes the E2E loop); frames render for real; frame image
 *   capture produces digest-addressed pixel evidence.
 *
 * The adapter NEVER touches `document`, `window`, or any DOM global: the
 * host hands it constructed objects only. Zero fabricated browser evidence:
 * nothing in the test suites claims a rendered pixel without a surface.
 */
import type { WebGLRenderer } from 'three';
import type { RendererSessionContext } from '@epoch/renderer-fabric';

/** A digest-addressed frame image capture (ready for the evidence path). */
export interface ThreeFrameCapture {
  readonly schema: 'epoch.renderer.frame-capture';
  /** The frame index the image was captured at. */
  readonly frameIndex: number;
  /** Virtual capture time (caller-supplied). */
  readonly atMs: number;
  /** The canonical world digest of the presented revision. */
  readonly worldDigest: string;
  readonly width: number;
  readonly height: number;
  /** The media type of the captured bytes (host-declared, e.g. image/png). */
  readonly mediaType: string;
  /** Byte size of the captured image. */
  readonly byteSize: number;
  /** The SHA-256 content digest of the image bytes (evidence-path addressing). */
  readonly imageDigest: string;
}

/** How the host captures pixels off its renderer (browser path only). */
export type FramePixelSource = (renderer: WebGLRenderer) => {
  mediaType: string;
  bytes: Uint8Array;
};

/**
 * The GL surface a browser host injects: a constructed WebGLRenderer (over
 * the Epoch-owned canvas) plus the pixel source used by frame capture.
 */
export interface ThreeGlSurface {
  readonly renderer: WebGLRenderer;
  readonly pixelSource: FramePixelSource;
}

/** The host-supplied factory of one session's GL surface (null = headless). */
export type ThreeGlSurfaceFactory = (context: RendererSessionContext) => ThreeGlSurface | null;

/** The typed headless frame-capture refusal reason (honest, never fabricated). */
export const HEADLESS_CAPTURE_REFUSAL =
  'no GL surface is attached (headless mode): frame image capture requires an injected WebGL surface — the browser path (W061 E2E) provides it' as const;
