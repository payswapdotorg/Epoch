'use client';
/**
 * THE WORLD WORKSPACE (W057 → W072, ACR-012) — the CONSTRUCTION SOLUTION
 * EXPLORER: the spatially dominated engineering workspace of the `/world`
 * route. The construction world viewport is the PRIMARY problem-solving
 * surface (60–75% of the main surface); the construction navigator (LEFT),
 * the engineering inspector + BOQ/cost + constraints + variants (RIGHT),
 * and the compact solution/context bar (TOP) are restrained secondary
 * surfaces; the view controls, live metrics, the programme timeline
 * scrubber and the tool/measure state float as HUDs OVER the world canvas.
 *
 * Composition (the W061 structure, evolved):
 * - PRIMARY: the construction world viewport (the spatial projection of
 *   the canonical scene entities — the active presenter mounted behind it
 *   through the RendererFabric seam; renderer-agnostic by construction);
 *   three presentations of the SAME frozen W071 world: 3D (real engines),
 *   true top-down PLAN, and SECTION cutaway;
 * - SECONDARY: the top bar (solution name, renderer selector, view modes,
 *   session context), the LEFT navigator (tools, construction layers,
 *   agents, intent journal), the RIGHT engineering inspector (canonical
 *   identity + the §9 engineering projection + evidence, BOQ/cost with
 *   bidirectional cross-selection, constraints/findings with spatial
 *   focus, solution variants with world-changing branch presentation, the
 *   annotation composer and the foundation-asset surface).
 *
 * The workspace is a CLIENT component driven by a
 * {@link WorldWorkspaceDriver} (the structural seam the REAL
 * @epoch/world-runtime WorldWorkspaceRuntime satisfies — pinned by
 * qa/world-experience): it renders the driver's view model and routes
 * every interaction through the driver's command surface (raw viewport
 * input → the fabric seam; workspace commands → existing typed Epoch
 * intents). The host owns the driver lifecycle (open/close/host loop) and
 * the honest typed-pick helper for host-surface selections.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import type { WorldWorkspaceDriver, WorkspaceViewModelInput } from '../workspace-contracts';
import { createWorkspaceHandlers } from '../workspace-handlers';
import {
  EMPTY_CROSS_HIGHLIGHT,
  SECTION_CUT_X,
  SOLUTION_AGENTS,
  SOLUTION_BRANCH_PHASE,
  clampSectionCut,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  highlightEntityIdsOf,
  phaseAt,
  presentedEntities,
  sectionCutRangeOf,
  type ConstructionBoqLineItem,
  type CrossHighlight,
  type SolutionVariantId,
  type SolutionViewMode,
} from '../construction-solution';
import { CONTROL_IDS } from '@epoch/construction-world-fixture';
import { ConstructionTopBar } from './ConstructionTopBar';
import {
  ConstructionNavigator,
  navigatorAgentsOf,
  type NavigatorAgent,
} from './ConstructionNavigator';
import { ConstructionViewport, type ViewportAgentEntry } from './ConstructionViewport';
import { ConstructionInspector, type InspectorAgent } from './ConstructionInspector';

/** The warm paper background of the construction solution workspace. */
const CS_PAGE = '#f2efe9' as const;

/** The workspace props: the driver + an optional view-model override. */
export interface WorldWorkspaceProps {
  readonly driver: WorldWorkspaceDriver;
  /** The current view model (defaults to the driver's own projection). */
  readonly viewModel?: WorkspaceViewModelInput | undefined;
  /** The engine stage layer forwarded to the viewport (W061; the host's GL canvases). */
  readonly engineStage?: ReactNode | undefined;
  /** Which surface presents the spatial world (W061; defaults to 'reference'). */
  readonly spatialOverlay?: 'reference' | 'engine' | undefined;
  /** The element pointer input normalizes against (W061; the engine stage). */
  readonly pointerBounds?: RefObject<HTMLElement | null> | undefined;
  /**
   * The host's honest typed-pick helper: issue the SAME typed pointer pick
   * through the ACTIVE presenter (derived from the real projection) for a
   * host-surface selection — navigator rows, BOQ lines, constraint focus,
   * agent work links. Absent → the selection stays canonical without the
   * typed re-pick (documented degradation; 3D viewport input drives the
   * typed path for BOTH engines through the adapters' own hit tests).
   */
  readonly onPickEntityOnPresenter?: ((entityId: string) => void) | undefined;
}

/**
 * The world workspace: the construction solution explorer — the primary
 * spatial surface + restrained secondary panels + floating HUDs.
 */
export function WorldWorkspace({
  driver,
  viewModel,
  engineStage,
  spatialOverlay,
  pointerBounds,
  onPickEntityOnPresenter,
}: WorldWorkspaceProps): ReactNode {
  const [view, setView] = useState<WorkspaceViewModelInput>(() => viewModel ?? driver.viewModel());
  const [annotationDraft, setAnnotationDraft] = useState('');
  // The construction solution presentation state (host-owned, all
  // presentation-only; the canonical world authority stays the runtime).
  // The initial selection is the fixture's focused entity (canonical).
  const [viewMode, setViewMode] = useState<SolutionViewMode>('3d');
  const [variantId, setVariantId] = useState<SolutionVariantId>('variant-current');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => {
    const initial = viewModel ?? driver.viewModel();
    return initial.viewport.entities.find((entity) => entity.focused)?.entityId ?? null;
  });
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // The persistent BOQ ↔ world cross-selection state (bidirectional; it
  // SURVIVES view-mode changes and persists until cleared or replaced).
  const [crossHighlight, setCrossHighlight] = useState<CrossHighlight>(EMPTY_CROSS_HIGHLIGHT);
  // The live section cut position (ONE cut state drives the plan's A–A
  // line and the section re-projection together).
  const [sectionCutX, setSectionCutX] = useState<number>(SECTION_CUT_X);

  // The refresh contract: the host re-renders by passing a fresh view
  // model prop; without one, the workspace re-projects on every command
  // completion through this local refresh.
  const refresh = useCallback((): void => {
    setView(driver.viewModel());
  }, [driver]);

  const handlers = useMemo(
    () => createWorkspaceHandlers(driver, refresh),
    [driver, refresh],
  );

  // A 3D viewport pick flows through the fabric seam (the ACTIVE adapter's
  // own hit test → the typed select intent → the runtime's inspect view) —
  // the workspace's selection FOLLOWS the runtime's inspect projection so
  // both stay the SAME canonical identity (host-surface selections set it
  // directly; under the Babylon presenter the typed re-pick seam does not
  // exist and the selection stays canonical without a runtime sync).
  useEffect(() => {
    if (view.inspect.entityId !== null) {
      setSelectedEntityId(view.inspect.entityId);
    }
  }, [view.inspect.entityId]);

  // The initial selection note: the fixture's focused entity is selected
  // from the first projection (see the state initializer above — the
  // focused entity of the canonical view model).

  // ----- The construction presentation projections (pure). ----------------
  const presented = useMemo(() => presentedEntities(variantId), [variantId]);
  const sectionCutRange = useMemo(() => sectionCutRangeOf(presented), [presented]);
  const sectionCut = clampSectionCut(sectionCutX, sectionCutRange);
  const activePhase = useMemo(
    () => phaseAt(view.timeline.positionAtMs),
    [view.timeline.positionAtMs],
  );
  const navigatorAgents: readonly NavigatorAgent[] = useMemo(
    () => navigatorAgentsOf(view.viewport.agents, view.viewport.followedAgentId, activeAgentId),
    [view.viewport.agents, view.viewport.followedAgentId, activeAgentId],
  );
  const viewportAgents: readonly ViewportAgentEntry[] = useMemo(
    () =>
      navigatorAgents.map((agent) => ({
        agentId: agent.agentId,
        label: agent.label,
        followed: agent.followed,
      })),
    [navigatorAgents],
  );
  const activeAgent: InspectorAgent | null = useMemo(() => {
    if (activeAgentId === null) return null;
    const agent = navigatorAgents.find((entry) => entry.agentId === activeAgentId);
    return agent ?? null;
  }, [activeAgentId, navigatorAgents]);
  const highlightIds = useMemo(
    () => highlightEntityIdsOf(crossHighlight, activeAgent),
    [crossHighlight, activeAgent],
  );
  // The measure-state hint (the newest measure journal entry's detail —
  // the runtime's two-pick composition cadence, surfaced in the HUD).
  const measureHint = useMemo(() => {
    const measureEntries = view.journal.filter((entry) => entry.intentKind === 'measure');
    const newest = measureEntries[measureEntries.length - 1];
    return newest?.detail ?? null;
  }, [view.journal]);

  // ----- Selection flows through ONE channel (the canonical identity). ---
  /** Select one canonical entity from a HOST surface + the typed re-pick. */
  const selectEntity = useCallback(
    (entityId: string): void => {
      setSelectedEntityId(entityId);
      onPickEntityOnPresenter?.(entityId);
    },
    [onPickEntityOnPresenter],
  );

  /**
   * A plan/section presentation pick (null clears the selection AND the
   * cross-highlight; an entity pick both selects it and highlights its BOQ
   * line(s) — the world → BOQ direction of the cross-selection).
   */
  const onPresentedPick = useCallback(
    (entityId: string | null): void => {
      if (entityId === null) {
        setSelectedEntityId(null);
        setCrossHighlight(EMPTY_CROSS_HIGHLIGHT);
        return;
      }
      setCrossHighlight(crossHighlightFromEntity(entityId));
      selectEntity(entityId);
    },
    [selectEntity],
  );

  /** One BOQ line item selected: cross-highlight its world entity (BOQ → world). */
  const onBoqHighlight = useCallback(
    (line: ConstructionBoqLineItem): void => {
      setCrossHighlight(crossHighlightFromBoqLine(line));
      selectEntity(line.entityId);
    },
    [selectEntity],
  );

  /** Clear the cross-highlight (the persistence contract's explicit exit). */
  const onClearHighlight = useCallback((): void => {
    setCrossHighlight(EMPTY_CROSS_HIGHLIGHT);
  }, []);

  /**
   * Constraint finding → spatial focus: highlight the finding's entities
   * and — the spatial-discovery doctrine — REVEAL the owning semantic
   * layer through the typed show intent when none of them is currently
   * visible (the hidden legacy conduit becomes findable IN the world).
   */
  const onConstraintFocus = useCallback(
    (entityIds: readonly string[]): void => {
      setCrossHighlight(crossHighlightFromConstraint(entityIds));
      if (entityIds.length > 0) {
        const visibleIds = new Set(
          view.viewport.entities.filter((entity) => entity.visible).map((entity) => entity.entityId),
        );
        const anyVisible = entityIds.some((id) => visibleIds.has(id));
        if (!anyVisible) {
          const layer = view.layers.find((candidate) =>
            entityIds.some((id) => candidate.entityIds.includes(id)),
          );
          if (layer !== undefined) {
            void driver.toggleLayer(layer.layerId).then(() => {
              refresh();
            });
          }
        }
        selectEntity(entityIds[0] as string);
      }
    },
    [view.viewport.entities, view.layers, driver, refresh, selectEntity],
  );

  /**
   * Select a solution variant: issue the EXISTING typed branch intent at
   * the fixture's branch point (the branch/simulation concept — never a
   * second lifecycle) and re-present the world with the variant's
   * fixture-owned deltas (3D badges, plan and section all change).
   */
  const onVariantChange = useCallback(
    (next: SolutionVariantId): void => {
      setVariantId(next);
      void driver
        .invokeControl(CONTROL_IDS.branch, { branchAtMs: SOLUTION_BRANCH_PHASE.atMs })
        .then(() => {
          refresh();
        });
    },
    [driver, refresh],
  );

  /**
   * Inspect one agent's task: swap the inspector to the agent card AND
   * cross-highlight the agent's CURRENT-WORK element in the world (the
   * agent presence hook — persistent like every cross-selection until
   * cleared/changed; closing the agent card keeps the highlight).
   */
  const onInspectAgent = useCallback(
    (agentId: string): void => {
      if (activeAgentId === agentId) {
        setActiveAgentId(null);
        return;
      }
      const fixtureAgent = SOLUTION_AGENTS.find((agent) => agent.agentId === agentId);
      setActiveAgentId(agentId);
      if (fixtureAgent !== undefined) {
        setCrossHighlight(crossHighlightFromAgent(fixtureAgent));
      }
    },
    [activeAgentId],
  );
  const onClearAgent = useCallback((): void => {
    setActiveAgentId(null);
  }, []);

  const current = viewModel ?? view;

  return (
    <div
      data-workspace="world"
      data-workspace-kind="construction-solution"
      data-world-digest={current.viewport.worldDigest}
      data-active-tool={current.viewport.activeTool}
      data-entity-ids={current.viewport.entities.map((entity) => entity.entityId).sort().join(',')}
      data-bound-assets={[...new Set(current.sessionAssets.ledger.map((entry) => entry.assetDigest))]
        .sort()
        .join(',')}
      data-view-mode={viewMode}
      data-variant-id={variantId}
      data-selected-entity={selectedEntityId ?? ''}
      style={{
        // The world workspace fills the shell's main region edge-to-edge
        // (the full-bleed breakout of the framed content column): the
        // world is the PRIMARY product surface, not a framed widget.
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
        marginTop: -24,
        marginBottom: -24,
        // A DEFINITE height (never minHeight): the workspace occupies
        // exactly the window minus the shell's fixed chrome — header + nav
        // + the status footer + the content column's paddings measure
        // EXACTLY 158px (W072 phase-B probe-verified at the battery
        // canvas; the earlier 156 left a 2px page scroll), so the DEFAULT
        // state never scrolls the page — the world card and its floating
        // HUDs (the timeline scrubber at the card foot) stay on-screen and
        // the navigator/inspector rails scroll INTERNALLY (overflowY auto
        // + minHeight 0; the world-dominance doctrine: the rails' content
        // length must never push the world below the fold).
        height: 'calc(100vh - 158px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: CS_PAGE,
        boxSizing: 'border-box',
      }}
    >
      {/* ---- The compact solution/context bar --------------------------- */}
      <ConstructionTopBar
        sceneName={current.viewport.sceneName}
        tenantId={current.viewport.tenantId}
        sceneId={current.viewport.sceneId}
        worldDigest={current.viewport.worldDigest}
        renderers={current.renderers}
        handlers={handlers}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        variantId={variantId}
      />

      {/* ---- The workspace row: navigator | WORLD | inspector ------------- */}
      <div
        data-workspace-row=""
        style={{
          display: 'flex',
          gap: 8,
          padding: 8,
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
        }}
      >
        <ConstructionNavigator
          view={current}
          handlers={handlers}
          presented={presented}
          variantId={variantId}
          selectedEntityId={selectedEntityId}
          onSelectEntity={selectEntity}
          agents={navigatorAgents}
          onInspectAgent={onInspectAgent}
          compactJournal
        />
        <ConstructionViewport
          viewport={current.viewport}
          timeline={current.timeline}
          health={current.renderers.health}
          fallbackApplied={current.renderers.fallbackApplied}
          failure={current.renderers.lastFailure}
          handlers={handlers}
          engineStage={engineStage}
          spatialOverlay={spatialOverlay}
          pointerBounds={pointerBounds}
          presented={presented}
          variantId={variantId}
          viewMode={viewMode}
          selectedEntityId={selectedEntityId}
          onPresentedPick={onPresentedPick}
          highlightEntityIds={highlightIds}
          sectionCutX={sectionCut}
          sectionCutRange={sectionCutRange}
          onSectionCutChange={setSectionCutX}
          activePhase={activePhase}
          measureHint={measureHint}
          agents={viewportAgents}
        />
        <ConstructionInspector
          view={current}
          handlers={handlers}
          annotationDraft={annotationDraft}
          onAnnotationDraftChange={setAnnotationDraft}
          selectedEntityId={selectedEntityId}
          presented={presented}
          variantId={variantId}
          onVariantChange={onVariantChange}
          onBoqHighlight={onBoqHighlight}
          onConstraintFocus={onConstraintFocus}
          crossHighlight={crossHighlight}
          onClearHighlight={onClearHighlight}
          activeAgent={activeAgent}
          onClearAgent={onClearAgent}
          onSelectEntity={selectEntity}
          activePhase={activePhase}
        />
      </div>
    </div>
  );
}
