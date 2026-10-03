/**
 * @epoch/world-runtime — public API (experience layer, Work Order W057,
 * ACR-007 / X2.0).
 *
 * The INTERACTIVE WORLD RUNTIME: the host-side runtime that drives the
 * W056 Renderer Fabric so the spatial world is the PRIMARY Epoch
 * problem-solving workspace (web + desktop), while every semantic rule of
 * the architecture lock stays intact:
 *
 * - the WORLD MODEL stays semantic authority: the runtime holds ONE
 *   canonical W016 world scene (the fixture/problem projection supplied by
 *   the host) and mutates it ONLY through the W016 pure store + reducer
 *   (typed intents) — there is no second semantic store (lock rules
 *   8/16);
 * - RENDERER SESSIONS ARE EPHEMERAL: every canonical revision is
 *   presented by a FRESH fabric session (the W056 digest-continuity
 *   invariant), and renderer switching uses the REAL fabric switching
 *   invariant with an ordered fallback chain — the runtime never persists
 *   anything and never holds provider-native state;
 * - INTERACTIONS PRODUCE EXISTING TYPED EPOCH INTENTS: viewport input
 *   goes through the REAL fabric seam (adapter hit-test → normalization →
 *   W016 admission → W013 submit-intent admission → sealed receipt), and
 *   workspace commands compose the EXISTING @epoch/world-experience
 *   vocabulary (select/inspect/measure/annotate/isolate/hide/show/filter/
 *   zoom/follow-agent/replay/pause/resume/branch/simulate) — never a
 *   parallel vocabulary;
 * - NO DIRECT DURABLE MUTATION FROM THE UI: semantic intents surface as
 *   typed request effects (inspect/measure/compare/simulate/query/change/
 *   connect/disconnect/branch) for the HOST to route through the proper
 *   authority surfaces — the runtime never executes them;
 * - THE WALL CLOCK LIVES HERE (the TL-confirmed advisory): the fabric
 *   core stays virtual-time-only; this runtime is the only wall-clock
 *   reader (the injected HostClock) and derives every virtual time it
 *   hands the fabric from it.
 *
 * Engine-agnostic by construction: the runtime resolves renderers through
 * the fabric registry — the contract-only ReferenceRendererAdapter is a
 * valid default presenter (W058/W059's real Three.js/Babylon.js adapters
 * occupy the same mount with zero runtime changes).
 *
 * Runtime dependencies are exactly @epoch/agent-protocol (shared id
 * grammar), @epoch/experience-protocol (the consumed W011 vocabulary),
 * @epoch/renderer-runtime (the W013 hosting surface + W056 fabric
 * contract), @epoch/renderer-fabric (the fabric orchestration),
 * @epoch/world-experience (the canonical projection + the interaction
 * vocabulary), and @epoch/capability-registry (renderer capability
 * manifests). Zero engines, zero GPU code, zero UI-framework deps.
 */
export {
  WORLD_RUNTIME_VERSION,
  WORLD_TOOLS,
  WORLD_TOOL_LIST,
  NAVIGATION_KINDS,
  NAVIGATION_KEYS,
  MAX_JOURNAL_ENTRIES,
  MAX_EFFECT_ENTRIES,
  MAX_IMPORTED_ASSETS,
  MAX_BOUND_ASSETS,
} from './version';
export type { WorldTool, NavigationKind, NavigationKey } from './version';

// The wall-clock host surface (the runtime owns it; the fabric stays virtual).
export {
  SystemHostClock,
  ManualHostClock,
  TimeoutFrameScheduler,
  ManualFrameScheduler,
  HostLoop,
} from './clock';
export type { HostClock, FrameScheduler, HostTick, HostLoopTick } from './clock';

// Deterministic ids.
export { IdSequence } from './ids';

// Navigation (orbit/pan/zoom + desktop keys) + the reference projection math.
export {
  NAVIGATION_LIMITS,
  applyNavigationGesture,
  applyZoomFactor,
  eyeOf,
  lookAtBasis,
  navigationFromCamera,
  navigationToCamera,
  projectPoint,
} from './navigation';
export type { NavigationState, NavigationGesture, ProjectedPoint } from './navigation';

// Semantic layers (derived projection + the layer intent operations).
export {
  deriveLayers,
  layerIdOfEntityType,
  layerVisibilityOf,
  namespaceOfEntityType,
} from './layers';
export type { SemanticLayer } from './layers';

// Host-originated typed intents (the EXISTING vocabulary, admitted).
export {
  intentHintOfTool,
  intentForControl,
  buildAnnotateIntent,
  buildBindIntent,
  buildBranchIntent,
  buildFilterIntent,
  buildFollowAgentIntent,
  buildHideIntent,
  buildMeasureIntent,
  buildPauseIntent,
  buildReplayIntent,
  buildResumeIntent,
  buildShowIntent,
  buildSimulateIntent,
} from './intents';
export type { RuntimeResult, IntentBuilderInput } from './intents';

// The in-page foundation path (W067, ACR-010): the neutral interchange
// seam + the default registered glTF bridge + the view-model records.
export {
  DEFAULT_FOUNDATION_BRIDGE_ID,
  defaultFoundationBridge,
} from './foundation-bridge';
export type {
  FoundationAssetAdmission,
  FoundationAssetBridge,
  FoundationBindingSealInput,
  SessionAssetEntry,
  BoundAssetEntry,
  SessionAssetsViewModel,
} from './session-assets';

// The workspace view models (pure, presenter-agnostic).
export {
  projectViewport,
  projectInspect,
  projectTimeline,
  projectRenderers,
  projectControls,
  portableViewStateOf,
  sceneUsageOf,
  timelineEndOf,
} from './view-models';
export type {
  WorkspaceViewModel,
  ViewportViewModel,
  ViewportEntity,
  ViewportAgent,
  ViewportOverlay,
  InspectViewModel,
  TimelineViewModel,
  RendererChoice,
  RendererSurfaceViewModel,
  JournalEntry,
  EffectEntry,
  ProjectedImage,
  WorkspaceControl,
} from './view-models';

// The workspace runtime.
export { WorldWorkspaceRuntime, spatialPresentationOf } from './workspace';
export type {
  WorldWorkspaceInput,
  ViewportInputOutcome,
  SwitchSummary,
} from './workspace';
