/**
 * @epoch/adapter-renderer-threejs — identity, declarations, and policy
 * constants (W058, ACR-007/X2.0).
 *
 * Three.js is a CAPABILITY behind the Epoch Renderer Fabric, never an
 * authority (capability-foundation policy CF1.0): the neutral capability/
 * renderer identities below name the ROLE this adapter serves; the engine
 * is an implementation detail of the adapter package (engine imports live
 * ONLY in this package — zero leak into contracts/* or packages/*).
 *
 * Determinism policy: every constant below is a frozen policy input so the
 * same envelope normalizes to the same intent on every run (zero
 * wall-clock, zero randomness — the W056 discipline).
 */

/** The neutral capability-registry identity backing this adapter. */
export const THREE_CAPABILITY_ID = 'epoch.renderer.three' as const;

/** The W013 renderer-descriptor identity this adapter serves. */
export const THREE_RENDERER_ID = 'rr-threejs' as const;

/** Neutral display name for the Epoch renderer selector. */
export const THREE_RENDERER_DISPLAY_NAME = 'Epoch 3D renderer (Three.js, embedded)' as const;

/** Neutral description (never a vendor product claim). */
export const THREE_RENDERER_DESCRIPTION =
  'Embedded interactive WebGL renderer behind the Epoch Renderer Fabric: mounts the canonical world-experience projection into a real 3D scene graph, hit-tests pointer input through a real raycaster into semantic entity ids, and normalizes input into the existing typed Epoch world-interaction intent vocabulary. Three.js is a replaceable capability behind the adapter, never semantic authority.' as const;

// ---------------------------------------------------------------------------
// Camera-control policy (presentation-only; the W016 camera contracts are
// the only camera state that crosses the seam).
// ---------------------------------------------------------------------------

/** Orbit step per discrete camera-control input, in radians (5°). */
export const ORBIT_STEP_RADIANS = Math.PI / 36;

/** Pan step per discrete camera-control input, in world units. */
export const PAN_STEP_WORLD_UNITS = 1;

/** The zoom-in factor of one wheel-up activation (matches the W056 reference policy). */
export const ZOOM_IN_FACTOR = 1.25;

/** The zoom-out factor of one wheel-down activation (matches the W056 reference policy). */
export const ZOOM_OUT_FACTOR = 0.8;

/** The default camera field of view in radians when the canonical camera omits it. */
export const DEFAULT_CAMERA_FOV_RADIANS = (50 * Math.PI) / 180;

/** Near clipping plane of the presentation camera (world units). */
export const CAMERA_NEAR_PLANE = 0.1;

/** Far clipping plane of the presentation camera (world units). */
export const CAMERA_FAR_PLANE = 2_000;

// ---------------------------------------------------------------------------
// Presentation LOD policy (declared degradations; deterministic).
// ---------------------------------------------------------------------------

/** Full-fidelity radial segment count of curved primitives. */
export const FULL_FIDELITY_SEGMENTS = 32;

/** Reduced-fidelity radial segment count of curved primitives (the `reduced-fidelity` degradation). */
export const REDUCED_FIDELITY_SEGMENTS = 8;

// ---------------------------------------------------------------------------
// Interaction normalization policy (deterministic; same inputs -> same
// intents — the conformance-equivalence basis).
// ---------------------------------------------------------------------------

/** The presentation-authored annotation text when the entity carries a label. */
export const ANNOTATION_TEXT_OF_LABEL = (label: string): string => `annotation: ${label}`;

/** Key tokens the adapter recognizes (modality-neutral, bounded by the W056 envelope grammar). */
export const KEY_TOKENS = {
  /** Pause/resume toggle (both the DOM space key and a neutral 'space' token). */
  pauseToggle: [' ', 'space'] as const,
  /** Replay from the track start. */
  replay: ['key-r', 'r'] as const,
  /** Discrete orbit/pan controls. */
  orbitLeft: ['arrow-left'] as const,
  orbitRight: ['arrow-right'] as const,
  orbitUp: ['arrow-up'] as const,
  orbitDown: ['arrow-down'] as const,
  /** The modifier that switches orbit to pan. */
  panModifier: 'shift' as const,
} as const;

// ---------------------------------------------------------------------------
// Device/probe policy.
// ---------------------------------------------------------------------------

/**
 * Device classes this adapter presents on. `headset` is intentionally
 * absent: this adapter version ships no XR surface (a typed probe
 * rejection, never a silent failure).
 */
export const COMPATIBLE_DEVICE_CLASSES = [
  'desktop',
  'laptop',
  'tablet',
  'phone',
  'wall-display',
] as const;

/** Device classes that present under the declared `reduced-fidelity` degradation (small screens). */
export const REDUCED_FIDELITY_DEVICE_CLASSES = ['phone', 'tablet'] as const;
