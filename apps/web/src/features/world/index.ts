/**
 * The world feature module barrel (W016): typed view-model contracts,
 * pure deterministic projections, presentational components — and, since
 * W061, the REAL world host composition of the `/world` route (the
 * @epoch/world-runtime workspace runtime over the REAL renderer fabric
 * with the REAL Three.js/Babylon.js adapters + the reference fallback, and
 * the browser GL surface seam).
 *
 * The view-model/handler/component surface remains renderer- and
 * runtime-agnostic by construction (the structural-mirror contracts the
 * qa/world-experience harness pins); the host module is the app-owned
 * composition layer that binds the REAL runtime + engines behind them.
 */
export type {
  AdvanceEnvelopeInput,
  CameraStateInput,
  EnvelopeSummaryViewModel,
  FidelityLevelInput,
  FidelityProfileViewModel,
  FidelityReductionInput,
  InteractionCatalogEntryViewModel,
  InteractionKindInput,
  MountEnvelopeInput,
  MountSummaryViewModel,
  NarrativeBlockInput,
  NarrativeFeedEntryViewModel,
  OverlayApplicationInput,
  OverlayStackEntryViewModel,
  ParticipantInput,
  SceneControlInput,
  SceneEntityInput,
  SceneEntityRowViewModel,
  SceneMarkerInput,
  SceneTimelineInput,
  SubmitIntentInput,
  TimelinePositionInput,
  TimelineStatusViewModel,
  VisualOverlayInput,
  WorldErrorInput,
  WorldErrorNoticeViewModel,
  WorldSceneInput,
  WorldSceneOverviewViewModel,
} from './contracts';
export {
  toAdvanceSummary,
  toCameraStatus,
  toErrorNotice,
  toFidelityProfile,
  toInteractionCatalog,
  toMountSummary,
  toNarrativeFeed,
  toOverlayStack,
  toSceneOverview,
  toSubmitIntentSummary,
  toTimelineStatus,
  toEntityRows,
} from './project';
export { WorldSceneSummaryView } from './components/WorldSceneSummaryView';
export { SceneEntityListView } from './components/SceneEntityListView';
export { OverlayStackView } from './components/OverlayStackView';
export { TimelineStatusView } from './components/TimelineStatusView';
export { CameraStatusView } from './components/CameraStatusView';
export { NarrativeFeedView } from './components/NarrativeFeedView';
export { InteractionCatalogView } from './components/InteractionCatalogView';
export { FidelityProfileView } from './components/FidelityProfileView';
export {
  EnvelopeSummaryView,
  MountEnvelopeSummaryView,
} from './components/EnvelopeSummaryView';
export { WorldErrorNotice } from './components/WorldErrorNotice';

// W057 — the interactive world WORKSPACE (the primary problem-solving surface).
export type {
  ControlInvocationPayloadInput,
  DriverResult,
  EffectEntryInput,
  InspectViewModelInput,
  JournalEntryInput,
  NavigationGestureInput,
  NavigationKeyInput,
  NavigationKindInput,
  NavigationStateInput,
  RendererChoiceInput,
  RendererSurfaceViewModelInput,
  SemanticLayerInput,
  SwitchSummaryInput,
  TimelineViewModelInput,
  ViewportAgentInput,
  ViewportEntityInput,
  ViewportInputOutcomeInput,
  ViewportOverlayInput,
  ViewportViewModelInput,
  WorldToolInput,
  WorldWorkspaceDriver,
  WorkspaceControlInput,
  WorkspaceViewModelInput,
} from './workspace-contracts';
export {
  classifyDrag,
  createWorkspaceHandlers,
  dragToGesture,
  isNavigationKey,
  normalizePointer,
  DRAG_SENSITIVITY,
} from './workspace-handlers';
export type { WorkspaceHandlers } from './workspace-handlers';
export { WorldWorkspace } from './components/WorldWorkspace';
export { WorldViewport } from './components/WorldViewport';
export type { WorldViewportProps } from './components/WorldViewport';
export {
  WorldControlsPanel,
  WorldInspectPanel,
  WorldIntentJournal,
  WorldLayerPanel,
  WorldPresencePanel,
  WorldRendererBar,
  WorldTimelineBar,
  WorldToolRail,
} from './components/WorldWorkspacePanels';

// W061 — the REAL world host: the runtime composition (the REAL engines
// behind the REAL fabric) + the browser GL surface seam of the /world route.
export { WorldWorkspaceHost } from './host/world-host';
export {
  ENGINE_CANVAS_SIZE,
  webBabylonEngineHost,
  webThreeSurfaceFactory,
  type SurfaceProbe,
} from './host/browser-gl';
export {
  AGENT_IDS,
  BRANCH_AT_MS,
  CONTROL_IDS,
  DEVICE,
  ENTITY_IDS,
  ENGINE_RENDERER_IDS,
  LAYERS,
  ONTOLOGY,
  OVERLAY_IDS,
  REFERENCE_RENDERER_ID,
  RENDERER_PREFERENCE,
  SCENE,
  SCENE_ID,
  TENANT,
  TRACK,
  buildHeadlessWorldFabric,
  buildWorldFabric,
  isEngineRenderer,
  type WebWorldFabric,
  type WebWorldFabricOptions,
} from './host/world-fixture';
