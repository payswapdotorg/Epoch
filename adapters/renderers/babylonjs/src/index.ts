/**
 * @epoch/adapter-renderer-babylonjs — public API (service layer, Work Order
 * W059, ACR-007 / X2.0).
 *
 * The SECOND interchangeable interactive renderer: Babylon.js behind the
 * frozen W056 RendererAdapter seam. Public surface:
 *
 * - `BabylonRendererAdapter` (+ `babylonjsRendererAdapter` factory over the
 *   headless host) — the RendererAdapter implementation;
 * - `nullEngineHost` / `webCanvasEngineHost` — the injected GL path
 *   (headless NullEngine for CI; WebGL-over-canvas for the web/Tauri
 *   surface, exercised by the W061 browser batteries);
 * - the neutral identity/descriptor/capability constants
 *   (`BABYLONJS_*`) — the registration inputs for the capability registry;
 * - the mapping/picking/normalization/degradation/camera modules (pure,
 *   deterministic, individually testable).
 *
 * Babylon.js is a CAPABILITY behind this adapter, never authority
 * (spec/capability-foundation-policy.md): no durable writes, no engine
 * imports outside this package, no Babylon editor/playground UI.
 */
export {
  BABYLONJS_CAPABILITIES,
  BABYLONJS_CAPABILITY_ID,
  BABYLONJS_DESCRIPTION,
  BABYLONJS_DESCRIPTOR,
  BABYLONJS_DISPLAY_NAME,
  BABYLONJS_ENGINE_LICENSE,
  BABYLONJS_ENGINE_VERSION,
  BABYLONJS_RENDERER_ID,
  HEADLESS_VIEWPORT,
  HINT_INTENT_IDS,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './version';

export {
  BabylonRendererAdapter,
  babylonjsRendererAdapter,
  type BabylonRendererAdapterOptions,
} from './adapter';

export {
  nullEngineHost,
  webCanvasEngineHost,
  type BabylonEngineHost,
  type BabylonFrameCapture,
  type BabylonCaptureInput,
  type NullEngineHostOptions,
  type WebCanvasEngineHostOptions,
} from './host';

export {
  applyDegradation,
  degradationStateOf,
  isDegradation,
  probeDegradationOf,
  type DegradationState,
} from './degrade';

export {
  nextPresentedEntityOf,
  normalizeKey,
  normalizePointerDown,
  zoomIntentOf,
  type NormalizationCapabilities,
  type NormalizationOutcome,
} from './normalize';

export {
  ensurePickable,
  isEntityMesh,
  pickEntityAt,
  pixelPositionOf,
  projectedPositionOf,
} from './picking';

export {
  babylonCameraOf,
  orbitBabylonCamera,
  orbitCameraOf,
  panBabylonCamera,
  portableCameraOf,
  vec3Of,
  zoomBabylonCamera,
  type BabylonCamera,
  type CameraAnchorLookup,
} from './camera';

export {
  buildPresentation,
  UNIT_EXTENT,
  type BabylonAgentMetadata,
  type BabylonClipRecord,
  type BabylonEntityMetadata,
  type BabylonLabelRecord,
  type BabylonPresentation,
} from './mapping';
