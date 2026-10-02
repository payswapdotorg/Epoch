/**
 * Version/identity constants of the Epoch Babylon.js renderer adapter (W059).
 *
 * Neutral Epoch identities only (architecture lock rule 13): the W013
 * renderer descriptor id is an ABSTRACT slug, never a vendor product name —
 * "babylonjs" appears in the slug as the neutral technology key of the
 * embedded renderer (the renderer-matrix vocabulary), and the capability id
 * follows the `epoch.renderer.*` grammar the fabric's registry expects.
 */
import type { RendererCapabilitySet, RendererDescriptor } from '@epoch/renderer-runtime';

/** The W013 renderer-descriptor id this adapter serves. */
export const BABYLONJS_RENDERER_ID = 'rr-babylonjs-embedded' as const;

/** The capability-registry identity backing this adapter. */
export const BABYLONJS_CAPABILITY_ID = 'epoch.renderer.babylonjs' as const;

/** Neutral display name for the Epoch renderer selector. */
export const BABYLONJS_DISPLAY_NAME = 'Epoch 3D renderer (embedded Babylon.js)' as const;

/** Neutral description for the capability manifest. */
export const BABYLONJS_DESCRIPTION =
  'Second embedded interactive renderer: the frozen W056 RendererAdapter seam over Babylon.js 9.x (WebGL). Same canonical scene/interaction contract as the first embedded renderer — semantic picking, camera controls, overlays/materials/animations, measurement/annotation affordances, visible agent representations, declared fidelity budgets, frame capture (browser GL), and safe disposal.' as const;

/** The Babylon.js engine version this adapter pins (catalog: 9.29.0). */
export const BABYLONJS_ENGINE_VERSION = '9.29.0' as const;

/** The Babylon.js license at the pinned revision (see docs/rendering/babylonjs.md). */
export const BABYLONJS_ENGINE_LICENSE = 'Apache-2.0' as const;

/** The default W013 descriptor of this adapter (see src/adapter.ts for overrides). */
export const BABYLONJS_DESCRIPTOR: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: BABYLONJS_RENDERER_ID,
  // Every compiled W011 graph kind this adapter hosts: spatial meshes ('3d'),
  // animation clips ('animation'), the replay/timeline track
  // ('timeline-replay'), presence seats/agents ('presence'), the narrative
  // feed ('narrative'), candidate/action controls ('controls' — surfaced to
  // the Epoch chrome, which owns control rendering), and 2D symbol content
  // ('2d' — presented on camera-facing planes; the Epoch chrome owns 2D
  // overlays). Undeclared kinds are refused by the W013 capability gate, so
  // an embedded renderer that can present a kind must declare it.
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  // The device modalities this adapter services (touch normalizes through
  // the pointer policy; keyboard through the keyboard policy).
  interaction: ['keyboard', 'pointer', 'touch'],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 1_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/** The default W056 fabric capability set of this adapter. */
export const BABYLONJS_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: BABYLONJS_RENDERER_ID,
  // Babylon scene.pick over the entity meshes (headless-proven via NullEngine).
  hitTesting: true,
  // Measurement affordance: pointer input with a measure hint normalizes to
  // the W016 measure intent (the canonical record flows through existing
  // authority — the adapter never writes).
  measurement: true,
  // Annotation affordance: pointer input with an annotate hint normalizes
  // to the W016 annotate intent.
  annotation: true,
  // Frame capture is DECLARED but requires a real GL engine: the browser
  // host captures through the injected host surface; headless hosts refuse
  // typed (no fabricated evidence) — see docs/rendering/babylonjs.md.
  frameCapture: true,
  sessionSwitching: true,
  snapshotCapture: true,
  // Every typed W056 degradation this adapter can present under.
  degradation: ['none', 'reduced-fidelity', 'static-frame', 'wireframe'],
  // Every portable view-state field the Babylon camera/scene can restore.
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  // Every content-addressed asset kind the adapter binds (validated only).
  assetKinds: ['animation', 'material', 'mesh', 'texture'],
};

/** The W016 qualified ControlIntent ids accepted as pointer intent hints. */
export const HINT_INTENT_IDS = {
  select: 'epoch.world.interaction.select',
  inspect: 'epoch.world.interaction.inspect',
  isolate: 'epoch.world.interaction.isolate',
  hide: 'epoch.world.interaction.hide',
  measure: 'epoch.world.interaction.measure',
  annotate: 'epoch.world.interaction.annotate',
} as const;

/** The intent-type version of every W016 world-interaction intent. */
export const WORLD_INTENT_TYPE_VERSION = '1.0.0' as const;

/**
 * Deterministic zoom policy (renderer-independent — identical to the W056
 * seam template so equivalent wheel input normalizes to equivalent intents
 * on every renderer): scroll up zooms IN, scroll down zooms OUT.
 */
export const ZOOM_IN_FACTOR = 1.25 as const;
export const ZOOM_OUT_FACTOR = 0.8 as const;

/** The deterministic presentation viewport of the headless (NullEngine) host. */
export const HEADLESS_VIEWPORT = { width: 1024, height: 768 } as const;

/** Presentation-only camera constants (deterministic defaults). */
export const CAMERA_DEFAULTS = {
  /** Default orbit alpha when a portable camera carries no orientation. */
  alpha: Math.PI / 4,
  /** Default orbit beta (elevation) when a portable camera carries no orientation. */
  beta: Math.PI / 3,
  /** Default follow-agent distance when the portable camera carries none. */
  followDistance: 20,
  /** Pointer-drag orbit sensitivity (radians per normalized viewport unit). */
  orbitSensitivity: Math.PI,
  /** Pointer-drag pan sensitivity (world units per normalized unit). */
  panSensitivity: 10,
  /** Field of view when the portable camera carries none (Babylon's default). */
  fovRadians: 0.8,
} as const;
