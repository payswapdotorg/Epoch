/**
 * The world feature module barrel (W016): typed view-model contracts,
 * pure deterministic projections, and presentational components.
 *
 * This module stands alone inside `apps/web` by design (see README.md):
 * no cross-package imports, no routes, no app-shell or global-provider
 * changes (W014's surface); W014 wires it to the host/API seam.
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
