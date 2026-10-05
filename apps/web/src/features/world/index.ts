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

// W072 — the CONSTRUCTION SOLUTION EXPLORER surface (ACR-012): the
// world-dominant workspace's construction chrome (top bar, left navigator,
// the three-presentation viewport, the right engineering inspector) + the
// pure construction projection model over the frozen W071 fixture.
export { ConstructionTopBar } from './components/ConstructionTopBar';
export {
  ConstructionNavigator,
  navigatorAgentsOf,
  type NavigatorAgent,
} from './components/ConstructionNavigator';
export {
  ConstructionViewport,
  type ViewportAgentEntry,
} from './components/ConstructionViewport';
export {
  ConstructionInspector,
  type InspectorAgent,
} from './components/ConstructionInspector';
export {
  WorldIntentJournal,
  WorldFoundationPanel,
} from './components/WorldWorkspacePanels';
export {
  BOQ_ROLLUPS,
  BOQ_TOTAL,
  CONSTRUCTION_FIXTURE,
  EMPTY_CROSS_HIGHLIGHT,
  SOLUTION_AGENTS,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_IDENTITY,
  SOLUTION_LAYERS,
  SOLUTION_PHASES,
  SOLUTION_SIMULATE_CONTROL,
  SOLUTION_VARIANT_IDS_ORDERED,
  boqEstimate,
  boqLineOf,
  boqLinesOf,
  crossHighlightActive,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  entityEvidenceOf,
  formatEur,
  highlightEntityIdsOf,
  isolatedLayerIdOf,
  phaseAt,
  presentedConstraints,
  presentedEntities,
  sectionCutRangeOf,
  variantOf,
  type CrossHighlight,
  type EntityEvidence,
  type PresentedConstructionEntity,
  type SectionCutRange,
  type SolutionVariantId,
  type SolutionViewMode,
} from './construction-solution';
export { CS, CS_TYPE, FONTS, LAYER_COLORS, STATUS_COLORS, layerColorOf } from './construction-tokens';

// W061 — the REAL world host: the runtime composition (the REAL engines
// behind the REAL fabric) + the browser GL surface seam of the /world route.
export { WorldWorkspaceHost } from './host/world-host';
export {
  ENGINE_CANVAS_SIZE,
  webBabylonEngineHost,
  webThreeSurfaceFactory,
  type CanvasSource,
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
