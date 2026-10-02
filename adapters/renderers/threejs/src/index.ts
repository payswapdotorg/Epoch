/**
 * @epoch/adapter-renderer-threejs — public API (experience layer, Work
 * Order W058, ACR-007 / X2.0).
 *
 * The FIRST real interactive renderer behind the frozen W056
 * `RendererAdapter` seam (`@epoch/renderer-fabric`, contracts/renderers
 * v1.1.0): Three.js embedded in the Epoch-owned viewport as a replaceable
 * CAPABILITY, never authority (capability-foundation policy CF1.0).
 *
 * - MOUNTS the canonical W016 world-scene projection into a real Three.js
 *   scene graph (every Object3D carries its semantic entity id; the graph
 *   is disposable presentation, rebuilt from admitted typed data).
 * - HIT-TESTS raw pointer input through the real Raycaster into semantic
 *   entity ids and NORMALIZES input into the EXISTING typed Epoch
 *   world-interaction intent vocabulary (select/inspect/isolate/hide/
 *   measure/annotate/zoom/pause/resume/replay/follow-agent — never a
 *   parallel vocabulary, never a durable write).
 * - DRIVES orbit/pan/zoom camera controls as presentation-only state
 *   (the portable camera grammar is the only camera state that crosses
 *   the seam).
 * - PRESENTS state overlays, highlights, focus decorations, layer
 *   visibility, measurement lines, and visible agent representations.
 * - APPLIES declared typed degradations (reduced-fidelity LOD,
 *   static-frame playback freeze, wireframe) — presentation-only,
 *   reversible, typed.
 * - CAPTURES portable snapshots and RESTORES portable view state across
 *   renderer switches (the switching invariant).
 * - TEARS DOWN every GPU resource it created (geometries, materials,
 *   textures, renderer); disposed sessions refuse everything.
 *
 * Headless-first: the GL-dependent path (WebGLRenderer construction,
 * frame image capture) is an INJECTED surface — the default runs and is
 * verified in Node 22 without a GPU (honest browser GL evidence is the
 * W061 E2E surface; nothing here fabricates it).
 *
 * Registration: a `visualization`-category capability manifest honoring
 * `epoch.renderers@1.1.0` through the REAL capability registry (see
 * docs/rendering/threejs.md for the exact wiring).
 */
// The adapter (the seam implementation).
export {
  ThreeJsRendererAdapter,
  type ThreeJsRendererAdapterOptions,
} from './adapter';

// The frozen declarations (identity / W013 descriptor / capability set).
export {
  CAPABILITIES_THREE,
  DESCRIPTOR_THREE,
  IDENTITY_THREE,
} from './declaration';

// The injected GL surface (the browser path) + frame captures.
export type {
  ThreeFrameCapture,
  ThreeGlSurface,
  ThreeGlSurfaceFactory,
  FramePixelSource,
} from './surface';
export { HEADLESS_CAPTURE_REFUSAL } from './surface';

// Semantic mapping (the entity-id invariant + evidence helpers).
export {
  SEMANTIC_ENTITY_KEY,
  SEMANTIC_AGENT_KEY,
  countSemanticEntityNodes,
  markAgentNode,
  markEntityNode,
  presentationBadgeOf,
  presentationLabelOf,
  semanticIdentityOf,
  setPresentationBadge,
  setPresentationLabel,
  type SemanticIdentity,
} from './semantics';

// Camera controls (presentation-only orbit/pan/zoom).
export {
  CameraControls,
  initialCameraOf,
} from './camera';

// Scene-graph mounting + presentation evidence helpers.
export {
  AGENT_MARKER_COLOR,
  FOCUS_RING_COLOR,
  MEASUREMENT_LINE_COLOR,
  PRESENCE_MARKER_COLOR,
  PRESENTATION_DEFAULT_COLOR,
  applyFocusDecorations,
  applyViewStateToPresentation,
  isEntityVisible,
  isWireframe,
  layerOfEntityType,
  materialColorOf,
  mountPresentation,
  worldPositionOf,
  type ThreePresentation,
} from './scene-graph';

// Picking (the real Raycaster path) + projection evidence.
export {
  hitTestPointer,
  projectedPointerOf,
  type PointerHit,
} from './picking';

// Virtual-time animation playback.
export {
  animationTargetIds,
  evaluateAnimations,
  type AnimationPass,
} from './animation';

// Typed degradations.
export { applyDegradation, playbackFrozen } from './degradation';

// GPU resource ledger + disposal evidence.
export { GpuResourceLedger, type DisposalReport } from './resources';

// The runtime state type (opaque at the seam; typed for the batteries).
export type { ThreeAdapterRuntimeState } from './state';

// Policy constants (determinism; the conformance-equivalence basis).
export {
  ANNOTATION_TEXT_OF_LABEL,
  COMPATIBLE_DEVICE_CLASSES,
  FULL_FIDELITY_SEGMENTS,
  KEY_TOKENS,
  ORBIT_STEP_RADIANS,
  PAN_STEP_WORLD_UNITS,
  REDUCED_FIDELITY_DEVICE_CLASSES,
  REDUCED_FIDELITY_SEGMENTS,
  THREE_CAPABILITY_ID,
  THREE_RENDERER_DESCRIPTION,
  THREE_RENDERER_DISPLAY_NAME,
  THREE_RENDERER_ID,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './version';
