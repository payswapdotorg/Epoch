'use client';

/**
 * W073 — the CONSTRUCTION SOLUTION WORKSPACE: the desktop product's
 * DEFAULT problem-solving surface (ACR-012). Entering the product presents
 * the construction solution world — spatially dominated (the world viewport
 * is 60–75% of the main screen), with the LEFT construction-layers
 * navigator, the RIGHT engineering inspector + BOQ/cost + constraints +
 * variants, floating HUDs (view controls, live metrics, the 8-phase
 * programme timeline) and the compact solution/context bar on top. The
 * lifecycle/administration journey sections are DEMOTED to secondary
 * navigation (the compact links this workspace's bar carries).
 *
 * The world is the REAL stack over the FROZEN W071 fixture: the W016
 * WorldScene behind the REAL @epoch/world-runtime WorldWorkspaceRuntime,
 * the REAL RendererFabric with the REAL Three.js + Babylon.js adapters
 * (the fixture's declared preference/fallback chain, reference fallback
 * last), and the REAL typed interaction path for every operation — picks,
 * layers, isolation, measurement, annotation, agent follow, timeline,
 * branch. The variant comparison, plan/section presentations, BOQ/cost,
 * constraints and the engineering inspector are PROJECTIONS of the same
 * frozen fixture — never a second semantic ledger.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SystemHostClock,
  TimeoutFrameScheduler,
  WorldWorkspaceRuntime,
  type WorkspaceViewModel,
} from '@epoch/world-runtime';
import { ThreeJsRendererAdapter, projectedPointerOf } from '@epoch/adapter-renderer-threejs';
import { BabylonRendererAdapter } from '@epoch/adapter-renderer-babylonjs';
import {
  CONTROL_IDS,
  FIXTURE,
  THREE_RENDERER_ID,
  buildWorldFabric,
  type SolutionVariantId,
} from '@epoch/construction-world-fixture';
import { webBabylonEngineHost, webThreeSurfaceFactory } from '../world-host/browser-gl';
import {
  EMPTY_CROSS_HIGHLIGHT,
  SECTION_CUT_X,
  SOLUTION_AGENTS,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_IDENTITY,
  clampSectionCut,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  highlightEntityIdsOf,
  phaseAt,
  presentedEntities,
  sectionCutRangeOf,
  variantOf,
  type ConstructionBoqLineItem,
  type CrossHighlight,
  type SolutionViewMode,
} from './construction-projection';
import { CS, CS_TYPE } from './construction-tokens';
import { FONTS, RADII, SPACE } from '../ui-tokens';
import { useViewport } from '../use-viewport';
import { WorldViewport, type PresentedAgent } from './world-viewport';
import { LayersNavigator } from './layers-navigator';
import { EngineeringInspector } from './engineering-inspector';

/** The fixed square pixel size of the engine canvases (deterministic pixels). */
const CONSTRUCTION_ENGINE_CANVAS = 960;

type ComposePhase =
  | { readonly phase: 'composing' }
  | { readonly phase: 'ready' }
  | { readonly phase: 'failed'; readonly message: string };

export interface SolutionWorkspaceProps {
  /** Whether the product session is active (the session-bar state). */
  readonly authenticated: boolean;
  /** The DEMOTED lifecycle/administration sections (secondary navigation). */
  readonly lifecycleSections: readonly { readonly id: string; readonly label: string }[];
  /** Open one lifecycle section (the classic rail layout takes over). */
  readonly onOpenSection: (id: string) => void;
}

/** The construction solution workspace (the default problem-solving surface). */
export function SolutionWorkspace(props: SolutionWorkspaceProps): ReactNode {
  const [phase, setPhase] = useState<ComposePhase>({ phase: 'composing' });
  const [view, setView] = useState<WorkspaceViewModel | null>(null);
  const [glLive, setGlLive] = useState<{ readonly three: boolean; readonly babylon: boolean }>({
    three: false,
    babylon: false,
  });
  const [viewMode, setViewMode] = useState<SolutionViewMode>('3d');
  const [variantId, setVariantId] = useState<SolutionVariantId>('variant-current');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // The persistent BOQ ↔ world cross-selection state (bidirectional: a BOQ
  // line highlights its entities in the world; a world entity highlights its
  // BOQ line(s)). It SURVIVES view-mode changes (3D/plan/section render the
  // same highlight set) and persists until cleared or replaced by another
  // cross-selection — the W073 chunk 2 interaction contract.
  const [crossHighlight, setCrossHighlight] = useState<CrossHighlight>(EMPTY_CROSS_HIGHLIGHT);
  // The live section cut position (the cut-plane interaction; the plan's
  // A–A line and the section re-project together from ONE cut state).
  const [sectionCutX, setSectionCutX] = useState<number>(SECTION_CUT_X);
  const runtimeRef = useRef<WorldWorkspaceRuntime | null>(null);
  const threeAdapterRef = useRef<ThreeJsRendererAdapter | null>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const babylonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { compact } = useViewport();

  // Compose the workspace ONCE per mount (client-side only — the static
  // export prerenders the composing state): the REAL engines' GL objects
  // are constructed over this workspace's canvases HERE, in the webview,
  // through the W061 browser-GL injection seam.
  useEffect(() => {
    let cancelled = false;
    const threeSurface = webThreeSurfaceFactory(threeCanvasRef.current, CONSTRUCTION_ENGINE_CANVAS);
    const babylonSurface = webBabylonEngineHost(babylonCanvasRef.current);
    const three = new ThreeJsRendererAdapter({ surfaceFactory: threeSurface.factory });
    const babylon = new BabylonRendererAdapter({ host: babylonSurface.host });
    threeAdapterRef.current = three;
    const { fabric } = buildWorldFabric({ three, babylon });
    const runtime = new WorldWorkspaceRuntime({
      slug: 'desktop-construction-solution',
      fabric,
      scene: FIXTURE.scene,
      ontology: FIXTURE.ontology,
      device: FIXTURE.device,
      clock: new SystemHostClock(),
      scheduler: new TimeoutFrameScheduler(),
      rendererPreference: FIXTURE.rendererPreference,
    });
    runtimeRef.current = runtime;
    runtime.setViewModelObserver((viewModel) => {
      if (!cancelled) setView(viewModel);
    });
    void (async () => {
      const opened = await runtime.open();
      if (cancelled) return;
      if (!opened.ok) {
        setPhase({ phase: 'failed', message: `${opened.error.code}: ${opened.error.message}` });
        return;
      }
      setGlLive({ three: threeSurface.probe.glActive, babylon: babylonSurface.probe.glActive });
      setView(runtime.viewModel());
      setPhase({ phase: 'ready' });
      runtime.startHostLoop();
    })();
    return () => {
      cancelled = true;
      runtime.stopHostLoop();
      void runtime.close();
      runtimeRef.current = null;
      threeAdapterRef.current = null;
    };
  }, []);

  // Selection flows through ONE channel (onPresentedPick): 3D viewport
  // picks report the CANONICAL semantic pick from the fabric receipt (the
  // ACTIVE adapter's own hit test through the typed interaction path), and
  // plan/section picks hit-test the host projection of the SAME frozen
  // fixture. The initial selection is the fixture's focused entity.
  useEffect(() => {
    const focused = FIXTURE.scene.focusedEntityIds[0];
    if (focused !== undefined) {
      setSelectedEntityId(focused);
    }
  }, []);

  /**
   * Select one canonical entity from a HOST surface (navigator, plan /
   * section presentation, BOQ line, agent current-work): the selection is
   * the canonical fixture identity, and the SAME typed pick is issued
   * through the active Three.js presentation when one presents (the honest
   * targeting pattern — the pointer is DERIVED from the real projection).
   * Under the Babylon.js presenter the projected-pointer seam does not
   * exist: the selection stays canonical, the typed pick is skipped
   * (documented degradation — 3D viewport input drives the typed path for
   * BOTH engines through the adapter's own hit test).
   */
  const selectEntity = useCallback((entityId: string): void => {
    setSelectedEntityId(entityId);
    const runtime = runtimeRef.current;
    const adapter = threeAdapterRef.current;
    if (runtime === null || adapter === null) return;
    const session = runtime.session();
    if (session === null || session.rendererId !== THREE_RENDERER_ID) return;
    const presentation = adapter.presentationOf(session.fabricSessionId);
    if (presentation === undefined) return;
    const pointer = projectedPointerOf(presentation, entityId);
    if (pointer === undefined) return;
    void runtime.dispatchPointerDown(pointer).then(() => {
      setView(runtime.viewModel());
    });
  }, []);

  /** A plan/section presentation pick (null clears the selection AND the
   * cross-highlight; an entity pick both selects it and highlights its BOQ
   * line(s) — the world → BOQ direction of the cross-selection). */
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

  /** One BOQ line item selected: cross-highlight its world entity (the
   * BOQ → world direction — persistent until cleared/changed). */
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
      const runtime = runtimeRef.current;
      if (runtime !== null && entityIds.length > 0) {
        const visibleIds = new Set(
          runtime.viewModel().viewport.entities.filter((entity) => entity.visible).map((entity) => entity.entityId),
        );
        const anyVisible = entityIds.some((id) => visibleIds.has(id));
        if (!anyVisible) {
          const layer = runtime
            .layers()
            .find((candidate) => entityIds.some((id) => candidate.entityIds.includes(id)));
          if (layer !== undefined) {
            void runtime.toggleLayer(layer.layerId).then(() => {
              setView(runtime.viewModel());
            });
          }
        }
      }
      if (entityIds.length > 0) {
        selectEntity(entityIds[0] as string);
      }
    },
    [selectEntity],
  );

  /**
   * Select a solution variant: issue the EXISTING typed branch intent at
   * the fixture's branch point (the branch/simulation concept — never a
   * second lifecycle) and re-present the world with the variant's
   * fixture-owned deltas (plan, section and 3D all change).
   */
  const onVariantChange = useCallback((next: SolutionVariantId): void => {
    setVariantId(next);
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    void runtime
      .invokeControl(CONTROL_IDS.branch, { branchAtMs: SOLUTION_BRANCH_PHASE.atMs })
      .then(() => {
        setView(runtime.viewModel());
      });
  }, []);

  /**
   * Request a programme simulation of the variant comparison: the
   * fixture's DECLARED typed simulate control (the branch/simulation
   * entry point the variant presentations ride on — the same frozen scene
   * control record the inspector's affordance surfaces). Effect-only: the
   * simulate-requested effect carries the fixture project's own scope
   * reference; the canonical scene is never mutated.
   */
  const onSimulateProgramme = useCallback((): void => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    void runtime
      .invokeControl(CONTROL_IDS.simulate, { scenarioRef: FIXTURE.projectId })
      .then(() => {
        setView(runtime.viewModel());
      });
  }, []);

  /** Follow one agent (the typed follow-agent intent). */
  const onFollowAgent = useCallback((agentId: string): void => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    void runtime.followAgent(agentId).then(() => {
      setView(runtime.viewModel());
    });
  }, []);

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
      const agent = SOLUTION_AGENTS.find((candidate) => candidate.agentId === agentId) ?? null;
      setActiveAgentId(agentId);
      if (agent !== null) {
        setCrossHighlight(crossHighlightFromAgent(agent));
      }
    },
    [activeAgentId],
  );
  const onClearAgent = useCallback((): void => {
    setActiveAgentId(null);
  }, []);

  /** Switch the active renderer (the REAL fabric switching invariant). */
  const onRendererChange = useCallback((rendererId: string): void => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    void runtime.selectRenderer(rendererId).then(() => {
      setView(runtime.viewModel());
    });
  }, []);

  const presented = useMemo(() => presentedEntities(variantId), [variantId]);
  // The live cut stays inside the presented world's valid cut range (the
  // range itself is variant-derived — Alt A's extended duct run widens it).
  const sectionCutRange = useMemo(() => sectionCutRangeOf(presented), [presented]);
  const sectionCut = clampSectionCut(sectionCutX, sectionCutRange);
  const activePhase = useMemo(
    () => phaseAt(view?.timeline.positionAtMs ?? FIXTURE.sceneContent.timeline.position.atMs),
    [view?.timeline.positionAtMs],
  );
  const agents: readonly PresentedAgent[] = useMemo(
    () =>
      SOLUTION_AGENTS.map((agent) => ({
        agent,
        followed: view?.viewport.followedAgentId === agent.agentId,
      })),
    [view?.viewport.followedAgentId],
  );
  const activeAgent = agents.find((entry) => entry.agent.agentId === activeAgentId) ?? null;
  const highlightIds = useMemo(
    () => highlightEntityIdsOf(crossHighlight, activeAgent?.agent ?? null),
    [crossHighlight, activeAgent],
  );

  if (phase.phase === 'composing' || view === null) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="cs-composing"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE.md,
          background: CS.page,
          color: CS.textMuted,
          fontSize: CS_TYPE.sizeMd,
        }}
      >
        <span style={{ fontWeight: 600, color: CS.text }}>
          Presenting the construction solution world…
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: CS_TYPE.sizeXs }}>
          {SOLUTION_IDENTITY.sceneId} · sealing the W016 scene · resolving the renderer chain
        </span>
      </div>
    );
  }
  if (phase.phase === 'failed') {
    return (
      <div
        role="alert"
        data-testid="cs-failed"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE.md,
          background: CS.page,
          color: CS.danger,
          fontSize: CS_TYPE.sizeMd,
          padding: SPACE.xl,
          textAlign: 'center',
        }}
      >
        <span style={{ fontWeight: 700 }}>The construction solution world failed to mount.</span>
        <span style={{ fontFamily: FONTS.mono, fontSize: CS_TYPE.sizeXs }}>{phase.message}</span>
      </div>
    );
  }

  const variant = variantOf(variantId);

  return (
    <div
      data-testid="cs-solution-workspace"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: CS.page,
      }}
    >
      {/* ---- The compact solution/context bar --------------------------- */}
      <div
        data-testid="cs-solution-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.md,
          flexWrap: 'wrap',
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: CS.surface,
          borderBottom: `1px solid ${CS.border}`,
        }}
      >
        <span style={{ fontSize: CS_TYPE.sizeMd, fontWeight: 700, color: CS.text, whiteSpace: 'nowrap' }}>
          Construction solution — Pioneer Block-A
        </span>
        <span style={{ fontFamily: FONTS.mono, fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>
          world {view.viewport.worldDigest.slice(0, 12)}… · {SOLUTION_IDENTITY.tenantId}
        </span>
        <div
          role="group"
          aria-label="Renderer selector"
          data-testid="cs-renderer-selector"
          style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: RADII.sm, border: `1px solid ${CS.border}`, background: CS.surfaceSunken }}
        >
          {view.renderers.choices.map((choice) => (
            <button
              key={choice.rendererId}
              type="button"
              data-testid={`cs-renderer-${choice.rendererId}`}
              aria-pressed={choice.active}
              title={`${choice.displayName} — ${choice.summary}`}
              onClick={() => onRendererChange(choice.rendererId)}
              style={{
                padding: '2px 8px',
                borderRadius: 3,
                border: `1px solid ${choice.active ? CS.accentBorder : 'transparent'}`,
                background: choice.active ? CS.accentDim : 'transparent',
                color: choice.active ? CS.accent : CS.textMuted,
                fontSize: CS_TYPE.sizeXxs,
                fontWeight: 600,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {choice.displayName.replace(' (reference)', '')}
            </button>
          ))}
        </div>
        <span
          data-testid="cs-variant-chip"
          style={{
            fontFamily: FONTS.mono,
            fontSize: CS_TYPE.sizeXxs,
            padding: '2px 8px',
            borderRadius: 999,
            border: `1px solid ${CS.accentBorder}`,
            background: CS.accentDim,
            color: CS.accent,
            whiteSpace: 'nowrap',
          }}
        >
          {variant?.label ?? variantId}
        </span>
        {!props.authenticated ? (
          <span
            data-testid="cs-auth-hint"
            style={{ fontSize: CS_TYPE.sizeXxs, color: CS.warn }}
          >
            Authenticate to begin — the session bar&apos;s Authenticate button issues a session from
            the fixture identity.
          </span>
        ) : null}
        {/* The DEMOTED lifecycle/administration navigation (secondary). */}
        <div
          role="navigation"
          aria-label="Lifecycle administration (secondary)"
          data-testid="cs-secondary-nav"
          style={{ marginLeft: 'auto', display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}
        >
          {props.lifecycleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-testid={`cs-secondary-${section.id}`}
              onClick={() => props.onOpenSection(section.id)}
              style={{
                padding: '2px 7px',
                borderRadius: 3,
                border: '1px solid transparent',
                background: 'transparent',
                color: CS.textMuted,
                fontSize: CS_TYPE.sizeXxs,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- The workspace row: navigator | world | inspector ------------ */}
      <div
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          flex: 1,
          minHeight: 0,
          gap: SPACE.md,
          padding: SPACE.md,
          overflowY: compact ? 'auto' : 'hidden',
        }}
      >
        {compact ? (
          <>
            <div style={{ display: 'flex', minHeight: 420 }}>
              <WorldViewport
                view={view}
                runtime={runtimeRef.current as WorldWorkspaceRuntime}
                presented={presented}
                variantId={variantId}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedEntityId={selectedEntityId}
                onPresentedPick={onPresentedPick}
                highlightEntityIds={highlightIds}
                activePhase={activePhase}
                agents={agents}
                onFollowAgent={onFollowAgent}
                threeCanvasRef={threeCanvasRef}
                babylonCanvasRef={babylonCanvasRef}
                glLive={glLive}
                compact={compact}
                sectionCutX={sectionCut}
                sectionCutRange={sectionCutRange}
                onSectionCutChange={setSectionCutX}
              />
            </div>
            <LayersNavigator
              view={view}
              runtime={runtimeRef.current as WorldWorkspaceRuntime}
              presented={presented}
              variantId={variantId}
              selectedEntityId={selectedEntityId}
              onSelectEntity={selectEntity}
              agents={agents}
              activeAgentId={activeAgentId}
              onFollowAgent={onFollowAgent}
              onInspectAgent={onInspectAgent}
              compact={compact}
            />
            <EngineeringInspector
              view={view}
              runtime={runtimeRef.current as WorldWorkspaceRuntime}
              selectedEntityId={selectedEntityId}
              presented={presented}
              variantId={variantId}
              onVariantChange={onVariantChange}
              onSimulateProgramme={onSimulateProgramme}
              onBoqHighlight={onBoqHighlight}
              onConstraintFocus={onConstraintFocus}
              crossHighlight={crossHighlight}
              onClearHighlight={onClearHighlight}
              onInspectAgent={onInspectAgent}
              onSelectEntity={selectEntity}
              activeAgent={activeAgent}
              onClearAgent={onClearAgent}
              activePhase={activePhase}
              compact={compact}
            />
          </>
        ) : (
          <>
            <LayersNavigator
              view={view}
              runtime={runtimeRef.current as WorldWorkspaceRuntime}
              presented={presented}
              variantId={variantId}
              selectedEntityId={selectedEntityId}
              onSelectEntity={selectEntity}
              agents={agents}
              activeAgentId={activeAgentId}
              onFollowAgent={onFollowAgent}
              onInspectAgent={onInspectAgent}
              compact={compact}
            />
            <WorldViewport
              view={view}
              runtime={runtimeRef.current as WorldWorkspaceRuntime}
              presented={presented}
              variantId={variantId}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedEntityId={selectedEntityId}
              onPresentedPick={onPresentedPick}
              highlightEntityIds={highlightIds}
              activePhase={activePhase}
              agents={agents}
              onFollowAgent={onFollowAgent}
              threeCanvasRef={threeCanvasRef}
              babylonCanvasRef={babylonCanvasRef}
              glLive={glLive}
              compact={compact}
              sectionCutX={sectionCut}
              sectionCutRange={sectionCutRange}
              onSectionCutChange={setSectionCutX}
            />
            <EngineeringInspector
              view={view}
              runtime={runtimeRef.current as WorldWorkspaceRuntime}
              selectedEntityId={selectedEntityId}
              presented={presented}
              variantId={variantId}
              onVariantChange={onVariantChange}
              onSimulateProgramme={onSimulateProgramme}
              onBoqHighlight={onBoqHighlight}
              onConstraintFocus={onConstraintFocus}
              crossHighlight={crossHighlight}
              onClearHighlight={onClearHighlight}
              onInspectAgent={onInspectAgent}
              onSelectEntity={selectEntity}
              activeAgent={activeAgent}
              onClearAgent={onClearAgent}
              activePhase={activePhase}
              compact={compact}
            />
          </>
        )}
      </div>
    </div>
  );
}
