/**
 * The WEB WORLD HOST's BROWSER GL SURFACES (W061) — the injection seam that
 * closes the W058/W059 browser path: the REAL engines' GL objects are
 * constructed over the Epoch-owned viewport canvases HERE, in the browser
 * only (never during SSR/prerender — the host constructs these exclusively
 * inside its client-side mount effect).
 *
 * - the Three.js adapter receives a `ThreeGlSurfaceFactory` that constructs
 *   a real `WebGLRenderer` over the dedicated Three canvas plus a pixel
 *   source for the declared frame-capture path (PNG bytes for the
 *   evidence pipeline). When the browser provides no usable GL context (or
 *   the canvas is absent — tests/SSR), the factory resolves null and the
 *   adapter runs its documented HEADLESS deterministic core (scene graph,
 *   Raycaster picking, normalization, degradation, disposal — no pixels);
 * - the Babylon.js adapter receives a defensive `BabylonEngineHost` around
 *   the W059 `webCanvasEngineHost` (the real Babylon `Engine` over the
 *   dedicated Babylon canvas, with the browser frame-capture path): an
 *   engine-construction failure falls back to the W059 `nullEngineHost`
 *   (the deterministic NullEngine core) instead of throwing through the
 *   fabric — typed degradation, never a crash.
 *
 * Both constructions REPORT their outcome (`ThreeSurfaceProbe` /
 * `BabylonHostProbe`) so the host can present the honest surface mode: the
 * REAL engine pixels when GL is live, the contract-only reference
 * projection otherwise (never a blank square presented as a world).
 *
 * Every canvas is Epoch-owned chrome; the engines never touch the DOM
 * beyond the canvas they are handed. No vendor UI is constructed anywhere.
 */
import { WebGLRenderer } from 'three';
import {
  nullEngineHost,
  webCanvasEngineHost,
  type BabylonCaptureInput,
  type BabylonEngineHost,
  type BabylonFrameCapture,
} from '@epoch/adapter-renderer-babylonjs';
import type { ThreeGlSurfaceFactory } from '@epoch/adapter-renderer-threejs';

/** The fixed square pixel size of each engine canvas (deterministic pixels:
 *  both adapters present under aspect 1, so the normalized pointer space and
 *  the engine projection space coincide). */
export const ENGINE_CANVAS_SIZE = 720;

/** The live GL outcome of one injected surface (host-presented evidence). */
export interface SurfaceProbe {
  /** Whether the real GL surface is live (else the adapter runs headless). */
  glActive: boolean;
}

/** The pixel source of one Three.js surface (the declared capture path). */
function threePixelSource(renderer: WebGLRenderer): { mediaType: string; bytes: Uint8Array } {
  const dataUrl = renderer.domElement.toDataURL('image/png');
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mediaType: 'image/png', bytes };
}

/**
 * The Three.js GL surface factory over one Epoch-owned canvas, with its
 * live outcome probe. The factory resolves null (headless) when the browser
 * provides no usable WebGL context — the adapter's documented headless
 * degradation.
 */
export function webThreeSurfaceFactory(
  canvas: HTMLCanvasElement | null,
): { readonly factory: ThreeGlSurfaceFactory; readonly probe: SurfaceProbe } {
  const probe: SurfaceProbe = { glActive: false };
  const factory: ThreeGlSurfaceFactory = () => {
    if (canvas === null) {
      return null;
    }
    try {
      const renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: false,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(ENGINE_CANVAS_SIZE, ENGINE_CANVAS_SIZE, false);
      probe.glActive = true;
      return { renderer, pixelSource: threePixelSource };
    } catch {
      // No usable GL context (or construction failed): the adapter runs its
      // deterministic headless core — typed, never fabricated pixels.
      probe.glActive = false;
      return null;
    }
  };
  return { factory, probe };
}

/**
 * The defensive Babylon.js engine host over one Epoch-owned canvas, with
 * its live outcome probe: the real browser `Engine` (with the browser
 * frame-capture path) when construction succeeds, else the deterministic
 * NullEngine host — never a throw through the fabric.
 */
export function webBabylonEngineHost(
  canvas: HTMLCanvasElement | null,
): { readonly host: BabylonEngineHost; readonly probe: SurfaceProbe } {
  const probe: SurfaceProbe = { glActive: false };
  if (canvas === null) {
    return { host: nullEngineHost(), probe };
  }
  const browser = webCanvasEngineHost(canvas, { deterministicLockStep: false });
  const headless = nullEngineHost();
  let live = false;
  const host: BabylonEngineHost = {
    name: 'babylonjs-web-canvas-defensive',
    get canRender(): boolean {
      return live;
    },
    async createEngine() {
      try {
        const engine = await browser.createEngine();
        live = true;
        probe.glActive = true;
        return engine;
      } catch {
        live = false;
        probe.glActive = false;
        return headless.createEngine();
      }
    },
    presentFrame(scene) {
      scene.render();
    },
    async captureFrame(input: BabylonCaptureInput): Promise<BabylonFrameCapture> {
      if (!live) {
        throw new Error(
          'the defensive web host has no live GL engine (headless fallback) — frame capture is unavailable',
        );
      }
      const capture = browser.captureFrame;
      if (capture === undefined) {
        throw new Error('the browser host provides no capture path');
      }
      return capture(input);
    },
  };
  return { host, probe };
}
