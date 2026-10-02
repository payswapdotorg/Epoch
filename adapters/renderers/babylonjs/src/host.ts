/**
 * THE INJECTED GL PATH (W059) — where Babylon.js's engine enters the adapter.
 *
 * `BabylonRendererAdapter` never constructs a WebGL engine itself: every
 * engine is created by an injected {@link BabylonEngineHost}. This is the
 * seam that makes the adapter's deterministic core fully testable headless
 * in CI (Node 22, zero GPU, zero browser):
 *
 * - {@link nullEngineHost} — the HEADLESS host: @babylonjs/core's
 *   `NullEngine` (a pure software stub: same Scene/Math/picking/animation
 *   machinery, rasterization stubbed). Fixed 1024x768 viewport and a
 *   deterministic lock-step clock, so scene-graph construction, semantic
 *   picking, input normalization, degradation flags, snapshot/restore, and
 *   disposal are byte-reproducible in CI. This is the host every unit test
 *   and the qa/renderer-conformance/babylonjs battery runs through.
 *
 * - {@link webCanvasEngineHost} — the BROWSER host (web + Tauri webview):
 *   the real `Engine` over an HTMLCanvasElement, plus the frame-capture
 *   path (Babylon screenshot tooling). This code is exported and reviewed
 *   but requires a real WebGL context — it is exercised by the browser E2E
 *   batteries of W061, NOT by CI (nothing here fabricates browser evidence).
 *
 * Determinism discipline: hosts must not read wall clocks or randomness in
 * their construction path; the headless engine uses Babylon's deterministic
 * lock-step mode (fixed 1/60s time step).
 */
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { HEADLESS_VIEWPORT } from './version';

/** One captured frame (typed bytes + media type; produced by GL hosts only). */
export interface BabylonFrameCapture {
  readonly bytes: Uint8Array;
  readonly mediaType: 'image/png';
  readonly width: number;
  readonly height: number;
}

/** The input of one host frame capture. */
export interface BabylonCaptureInput {
  readonly engine: AbstractEngine;
  readonly scene: Scene;
  readonly atMs: number;
}

/**
 * The host surface: creates the engine for one adapter session and provides
 * the optional GL-dependent presentation paths. Everything else in the
 * adapter is engine-agnostic and headless-testable.
 */
export interface BabylonEngineHost {
  /** A neutral host name (evidence/debugging only). */
  readonly name: string;
  /** Whether this host can rasterize (browser GL hosts: true; headless: false). */
  readonly canRender: boolean;
  /** Create the Babylon engine for ONE session (the adapter disposes it). */
  createEngine(): AbstractEngine | Promise<AbstractEngine>;
  /**
   * Present one frame of the scene (called by applyFrame unless the session
   * is degraded to `static-frame`). Default: `scene.render()`. The headless
   * engine's deterministic lock-step keeps this byte-stable in CI.
   */
  presentFrame?(scene: Scene): void;
  /**
   * Capture one frame as typed bytes (DECLARED capability; GL hosts only).
   * Absent on headless hosts — the adapter then refuses capture with a
   * typed failure (never fabricated evidence).
   */
  captureFrame?(input: BabylonCaptureInput): Promise<BabylonFrameCapture>;
}

/** Options of the headless host (all deterministic). */
export interface NullEngineHostOptions {
  /** Fixed render width (default 1024; picks are mapped through it). */
  readonly width?: number;
  /** Fixed render height (default 768). */
  readonly height?: number;
}

/**
 * The HEADLESS host: @babylonjs/core's NullEngine at a fixed viewport with
 * deterministic lock-step animation stepping. Zero WebGL, zero browser —
 * the CI battery runs entirely through this host.
 */
export function nullEngineHost(options: NullEngineHostOptions = {}): BabylonEngineHost {
  const width = options.width ?? HEADLESS_VIEWPORT.width;
  const height = options.height ?? HEADLESS_VIEWPORT.height;
  return {
    name: 'babylonjs-null-engine',
    canRender: false,
    createEngine() {
      return new NullEngine({
        renderWidth: width,
        renderHeight: height,
        textureSize: 512,
        deterministicLockstep: true,
        timeStep: 1 / 60,
        lockstepMaxSteps: 4,
      });
    },
    presentFrame(scene: Scene): void {
      // NullEngine stubs rasterization; the deterministic lock-step keeps
      // the animation clock fixed-step so repeated runs are reproducible.
      scene.render();
    },
  };
}

/** Options of the browser host. */
export interface WebCanvasEngineHostOptions {
  /** Force WebGL even where WebGPU is available (deterministic surface). */
  readonly forceWebGL?: boolean;
  /** The deterministic-lockstep flag forwarded to the engine. */
  readonly deterministicLockStep?: boolean;
}

/**
 * The BROWSER host (web + Tauri webview): the real Babylon `Engine` over an
 * `HTMLCanvasElement`, with the frame-capture path (Babylon's screenshot
 * tooling over the injected engine). Requires a real WebGL context — this
 * surface is exercised by the W061 browser E2E batteries, not by CI.
 */
export function webCanvasEngineHost(
  canvas: HTMLCanvasElement,
  options: WebCanvasEngineHostOptions = {},
): BabylonEngineHost {
  return {
    name: 'babylonjs-web-canvas',
    canRender: true,
    createEngine() {
      return new Engine(canvas, true, {
        deterministicLockstep: options.deterministicLockStep ?? false,
        preserveDrawingBuffer: true,
        stencil: true,
      });
    },
    presentFrame(scene: Scene): void {
      scene.render();
    },
    async captureFrame(input: BabylonCaptureInput): Promise<BabylonFrameCapture> {
      // Dynamic import keeps the screenshot tooling (and its DOM/GL
      // dependencies) out of the headless module graph. The capture is
      // driven by the session's ACTIVE camera (the rendered view).
      const { CreateScreenshotAsync } = await import(
        '@babylonjs/core/Misc/screenshotTools.js'
      );
      const camera = input.scene.activeCamera;
      if (camera === null) {
        throw new Error('the browser host cannot capture a frame without an active camera');
      }
      const width = input.engine.getRenderWidth();
      const height = input.engine.getRenderHeight();
      const data = await CreateScreenshotAsync(input.engine, camera, { width, height }, 'image/png');
      const base64 = String(data).split(',')[1] ?? '';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return { bytes, mediaType: 'image/png', width, height };
    },
  };
}
