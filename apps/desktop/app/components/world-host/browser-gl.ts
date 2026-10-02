/**
 * The DESKTOP WORLD HOST's BROWSER GL SURFACES (W061) — the desktop twin of
 * the web host's injection seam (`apps/web/src/features/world/host/browser-gl.ts`):
 * the REAL engines' GL objects are constructed over the Epoch-owned viewport
 * canvases HERE, in the Tauri webview only (never during SSR/prerender).
 *
 * See the web twin for the full design commentary (the Three.js
 * `WebGLRenderer` factory with a typed headless degradation; the defensive
 * Babylon.js engine host that falls back to the deterministic NullEngine).
 * Every canvas is Epoch-owned chrome; the engines never touch the DOM
 * beyond the canvas they are handed; no vendor UI is constructed anywhere.
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

/** The fixed square pixel size of each engine canvas (deterministic pixels). */
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

/** The Three.js GL surface factory over one Epoch-owned canvas (+ probe). */
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
      probe.glActive = false;
      return null;
    }
  };
  return { factory, probe };
}

/** The defensive Babylon.js engine host over one Epoch-owned canvas (+ probe). */
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
