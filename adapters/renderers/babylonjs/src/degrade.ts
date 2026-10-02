/**
 * Fidelity/device budgets and typed degradation (W059).
 *
 * The W056 rule (contracts/renderers v1.1.0): degradation is a TYPED
 * presentation-fidelity reduction — `reduced-fidelity` | `static-frame` |
 * `wireframe` — that the adapter must DECLARE in its capability set;
 * undeclared degradations are refused by the fabric (never silently
 * applied), and a degradation NEVER alters semantics.
 *
 * All three degradations are applied as deterministic flags on the Babylon
 * scene graph (headless-verifiable; the rasterization itself is the
 * browser surface):
 *
 * - `wireframe` — every entity material flips to `wireframe = true`;
 * - `reduced-fidelity` — heavyweight presentation features are disabled:
 *   fog, image-processing, glow layers, shadows, and hardware-scaled
 *   rendering (the engine's adaptive-resolution path);
 * - `static-frame` — presentation stops advancing: `applyFrame` records the
 *   frame but does NOT call the host's present step (the last presented
 *   frame stays on screen).
 */
import type { RendererDegradationKind } from '@epoch/renderer-runtime';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';

/** The typed degradation flags one session tracks (deterministic booleans). */
export interface DegradationState {
  readonly wireframe: boolean;
  readonly reducedFidelity: boolean;
  readonly staticFrame: boolean;
}

/** No degradation applied. */
export const NO_DEGRADATION: DegradationState = {
  wireframe: false,
  reducedFidelity: false,
  staticFrame: false,
};

/** Whether one degradation kind is a typed reduction (anything but none). */
export function isDegradation(kind: RendererDegradationKind): kind is 'reduced-fidelity' | 'static-frame' | 'wireframe' {
  return kind !== 'none';
}

/** The degradation state of one kind (pure). */
export function degradationStateOf(kind: RendererDegradationKind): DegradationState {
  return {
    wireframe: kind === 'wireframe',
    reducedFidelity: kind === 'reduced-fidelity',
    staticFrame: kind === 'static-frame',
  };
}

/** Apply one degradation state to the live scene graph (deterministic flags). */
export function applyDegradation(
  scene: Scene,
  engine: AbstractEngine,
  entityMeshes: Iterable<Mesh>,
  state: DegradationState,
): void {
  // Wireframe: every entity material flips to wireframe rendering.
  for (const mesh of entityMeshes) {
    if (mesh.material !== null) {
      mesh.material.wireframe = state.wireframe;
    }
  }
  // Reduced fidelity: disable heavyweight presentation features.
  if (state.reducedFidelity) {
    scene.fogMode = 0; // FOG_NONE (Babylon's numeric fog-mode constant)
    scene.imageProcessingConfiguration.isEnabled = false;
    for (const gl of scene.layers) {
      gl.isEnabled = false;
    }
    for (const light of scene.lights) {
      if (light.getShadowGenerator() !== null) {
        light.getShadowGenerator()?.getShadowMap()?.dispose();
      }
    }
    // Adaptive resolution: render at half linear resolution (2x hardware
    // scaling) — presentation only, pickability is unaffected because the
    // adapter maps normalized pointers through the ENGINE's reported
    // render size, which scales with it.
    engine.setHardwareScalingLevel(2);
  } else {
    engine.setHardwareScalingLevel(1);
  }
  // static-frame: no scene-graph flag — presentation is paused by the
  // adapter (applyFrame skips the host present step).
}

/**
 * The probe-time degradation suggestion: a device whose declared display
 * budget falls below the adapter's comfortable band presents under
 * `reduced-fidelity` rather than being refused (deterministic policy).
 */
export function probeDegradationOf(maxPixels: number | undefined): 'reduced-fidelity' | 'none' {
  return maxPixels !== undefined && maxPixels < 921_600 ? 'reduced-fidelity' : 'none';
}
