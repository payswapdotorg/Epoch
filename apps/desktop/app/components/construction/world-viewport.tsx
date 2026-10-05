'use client';

/**
 * W073 — the CONSTRUCTION WORLD VIEWPORT: the spatially dominant region of
 * the desktop construction solution workspace (ACR-012: 60–75% of the main
 * screen).
 *
 * One viewport, three presentations of the SAME frozen W071 world:
 *
 *  - **3D** — the REAL engine stage (Three.js / Babylon.js over the live
 *    GL canvases) presenting the canonical W016 scene through the REAL
 *    renderer fabric, with the non-positional chrome (measurements,
 *    annotations, variant-delta badges, agent presence) as the SVG
 *    overlay; when no engine presents, the reference projection glyphs
 *    carry the world (never a blank square — the W061 doctrine).
 *  - **PLAN** — a true top-down orthographic plan presentation computed
 *    from the fixture's renderer-neutral geometry (north up, X right).
 *  - **SECTION** — the cutaway at the labelled cut plane (default
 *    x = +2.0m, view toward −X) exposing the internal systems (foundation,
 *    slab, walls, beams, ceiling, HVAC duct, plumbing riser, legacy
 *    conduit) — the cut is INTERACTIVE (drag the plan's A–A line or step
 *    the CUT HUD); the section re-projects from the SAME cut state.
 *
 * Every interaction routes through the EXISTING typed Epoch interaction
 * path: 3D pointer input goes through the renderer-fabric seam
 * (runtime.dispatchPointerDown → adapter hit-test → typed intent); plan /
 * section picks select the canonical entity and issue the SAME typed pick
 * through the active Three.js presentation when one presents (honest
 * degradation under Babylon.js — documented, never faked); layer/isolate/
 * measure/annotate/follow/scrub/branch are the runtime's existing typed
 * commands. No renderer-local semantic authority anywhere.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RefObject } from 'react';
import {
  projectPoint,
  type WorldWorkspaceRuntime,
  type WorkspaceViewModel,
} from '@epoch/world-runtime';
import {
  BABYLONJS_RENDERER_ID,
  THREE_RENDERER_ID,
} from '@epoch/construction-world-fixture';
import {
  PLAN_VIEW,
  SECTION_CUT_STEP,
  SECTION_CUT_X,
  SECTION_VIEW,
  SOLUTION_PHASES,
  agentPositionAt,
  clampSectionCut,
  planCutLineOf,
  planDrawOrder,
  planEntityAt,
  planProjectorFor,
  sectionDrawOrder,
  sectionEntityAt,
  sectionProjectorFor,
  entityBuiltAtPhase,
  type ConstructionAgent,
  type ConstructionPhase,
  type PresentedConstructionEntity,
  type SectionCutRange,
  type SolutionVariantId,
  type SolutionViewMode,
} from './construction-projection';
import { CS, CS_TYPE, layerColorOf } from './construction-tokens';
import { FONTS, RADII, SPACE } from '../ui-tokens';

/** The fixed square pixel size of each engine canvas (deterministic pixels). */
const ENGINE_CANVAS_SIZE = 960;

/** The minimum square stage size (never a degenerate square). */
const MIN_STAGE_SIZE = 240;

/** One presented agent (fixture record + followed state). */
export interface PresentedAgent {
  readonly agent: ConstructionAgent;
  readonly followed: boolean;
}

export interface WorldViewportProps {
  readonly view: WorkspaceViewModel;
  readonly runtime: WorldWorkspaceRuntime;
  /** The variant-applied presented world (frozen fixture + variant deltas). */
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  readonly viewMode: SolutionViewMode;
  readonly onViewModeChange: (mode: SolutionViewMode) => void;
  readonly selectedEntityId: string | null;
  /** A plan/section pick of one canonical entity (the host drives the typed path). */
  readonly onPresentedPick: (entityId: string | null) => void;
  /** The cross-highlight set (BOQ line ↔ world entity / constraint focus / agent work). */
  readonly highlightEntityIds: readonly string[];
  /** The live section cut position (meters — ONE cut state drives the plan's
   * A–A line and the section re-projection together). */
  readonly sectionCutX: number;
  /** The valid cut range of the presented world (the steppers/drag clamp to it). */
  readonly sectionCutRange: SectionCutRange;
  /** Adjust the cut position (the cut-plane interaction). */
  readonly onSectionCutChange: (x: number) => void;
  readonly activePhase: ConstructionPhase;
  readonly agents: readonly PresentedAgent[];
  readonly onFollowAgent: (agentId: string) => void;
  readonly threeCanvasRef: RefObject<HTMLCanvasElement | null>;
  readonly babylonCanvasRef: RefObject<HTMLCanvasElement | null>;
  readonly glLive: { readonly three: boolean; readonly babylon: boolean };
  readonly compact: boolean;
}

/** The canonical entity record of one entity id (from the runtime view). */
function canonicalOf(view: WorkspaceViewModel, entityId: string) {
  return view.viewport.entities.find((entity) => entity.entityId === entityId) ?? null;
}

/** The world viewport (the dominant spatial surface). */
export function WorldViewport(props: WorldViewportProps): ReactNode {
  const { view, runtime, presented, viewMode } = props;
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const cutDragRef = useRef(false);
  const [stageSize, setStageSize] = useState(620);

  // The square engine stage tracks the viewport box (the SMALLER edge,
  // capped at the engine canvas size) so the engines never present a
  // distorted or clipped square.
  useEffect(() => {
    const element = sectionRef.current;
    if (element === null) return;
    const update = (): void => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      setStageSize(Math.max(MIN_STAGE_SIZE, Math.min(width, height, ENGINE_CANVAS_SIZE)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const activeRendererId = view.renderers.activeRendererId;
  const threeActive = activeRendererId === THREE_RENDERER_ID;
  const babylonActive = activeRendererId === BABYLONJS_RENDERER_ID;
  const engineSpatial =
    (threeActive && props.glLive.three) || (babylonActive && props.glLive.babylon);
  const timeline = view.timeline;
  const span = Math.max(1, timeline.trackEndMs - timeline.trackStartMs);

  const planProjector = useMemo(() => planProjectorFor(presented), [presented]);
  const sectionProjector = useMemo(
    () => sectionProjectorFor(presented, props.sectionCutX),
    [presented, props.sectionCutX],
  );
  const highlight = useMemo(
    () => new Set(props.highlightEntityIds),
    [props.highlightEntityIds],
  );

  /** Whether one presented entity is currently visible in the world. */
  const visibleInWorld = (entity: PresentedConstructionEntity): boolean => {
    if (entity.state === 'removed') return false;
    const canonical = canonicalOf(view, entity.geometry.entityId);
    if (canonical === null) return true; // variant-added entities present by the host.
    return canonical.visible;
  };

  /** Whether one presented entity is built at the active phase. */
  const built = (entity: PresentedConstructionEntity): boolean =>
    entityBuiltAtPhase(entity.geometry, props.activePhase);

  // -----------------------------------------------------------------------
  // The 3D stage (real engines + the reference-projection fallback glyphs).
  // -----------------------------------------------------------------------
  const threeStage = (
    <div
      ref={stageRef}
      data-testid="cs-engine-stage"
      data-active-renderer={activeRendererId}
      data-gl-three={props.glLive.three ? 'true' : 'false'}
      data-gl-babylon={props.glLive.babylon ? 'true' : 'false'}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: stageSize,
        height: stageSize,
        background: '#ddd7cb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(38, 34, 28, 0.18)',
        ...(viewMode !== '3d' ? { opacity: 0.14, filter: 'grayscale(0.6)' } : {}),
      }}
    >
      <canvas
        ref={props.threeCanvasRef}
        data-engine-canvas={THREE_RENDERER_ID}
        width={ENGINE_CANVAS_SIZE}
        height={ENGINE_CANVAS_SIZE}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: threeActive ? 'block' : 'none',
        }}
      />
      <canvas
        ref={props.babylonCanvasRef}
        data-engine-canvas={BABYLONJS_RENDERER_ID}
        width={ENGINE_CANVAS_SIZE}
        height={ENGINE_CANVAS_SIZE}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: babylonActive ? 'block' : 'none',
        }}
      />
    </div>
  );

  // The reference-projection glyphs (the honest world when no engine
  // presents in 3D mode; bbox-scaled rects at the NDC-projected positions).
  const referenceGlyphs: ReactNode[] = view.viewport.entities.map((entity) => {
    if (entity.ndc === null) return null;
    const x = ((entity.ndc.x + 1) / 2) * PLAN_VIEW.width;
    const y = ((1 - entity.ndc.y) / 2) * PLAN_VIEW.height;
    const presentedEntity = presented.find((p) => p.geometry.entityId === entity.entityId);
    const color = layerColorOf(presentedEntity?.geometry.layer ?? '');
    const state = !entity.visible ? 'hidden' : entity.isolated ? 'isolated' : entity.focused ? 'focused' : 'visible';
    return (
      <g
        key={entity.entityId}
        data-entity={entity.entityId}
        data-entity-state={state}
        transform={`translate(${x} ${y})`}
        opacity={entity.visible ? 1 : 0.35}
      >
        {entity.focused ? <circle r={22} fill="none" stroke={CS.selection} strokeWidth={3} /> : null}
        <rect
          x={-10}
          y={-10}
          width={20}
          height={20}
          rx={4}
          fill={color.fill}
          stroke={color.stroke}
          strokeWidth={1.4}
        />
        <text y={22} textAnchor="middle" fontSize={10} fill={CS.textSecondary} fontFamily={FONTS.sans}>
          {entity.label}
        </text>
      </g>
    );
  });

  // The applied overlays (measurements + annotations) at NDC positions.
  const overlayChrome: ReactNode[] = view.viewport.overlays.map((overlay) => {
    if (overlay.overlayKind === 'measurement') {
      const from = view.viewport.entities.find((e) => e.entityId === overlay.fromEntityId);
      const to = view.viewport.entities.find((e) => e.entityId === overlay.toEntityId);
      if (from?.ndc == null || to?.ndc == null) return null;
      const ax = ((from.ndc.x + 1) / 2) * PLAN_VIEW.width;
      const ay = ((1 - from.ndc.y) / 2) * PLAN_VIEW.height;
      const bx = ((to.ndc.x + 1) / 2) * PLAN_VIEW.width;
      const by = ((1 - to.ndc.y) / 2) * PLAN_VIEW.height;
      return (
        <g key={overlay.overlayId} data-overlay-kind="measurement">
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke={CS.accent} strokeWidth={2} strokeDasharray="8 5" />
          <circle cx={ax} cy={ay} r={4} fill={CS.accent} />
          <circle cx={bx} cy={by} r={4} fill={CS.accent} />
          <text
            x={(ax + bx) / 2}
            y={(ay + by) / 2 - 8}
            textAnchor="middle"
            fontSize={11}
            fill={CS.accent}
            fontFamily={FONTS.mono}
          >
            {overlay.label ?? 'Measurement'}
          </text>
        </g>
      );
    }
    if (overlay.overlayKind === 'annotation') {
      const target = view.viewport.entities.find((e) => e.entityId === overlay.entityId);
      if (target?.ndc == null) return null;
      const x = ((target.ndc.x + 1) / 2) * PLAN_VIEW.width;
      const y = ((1 - target.ndc.y) / 2) * PLAN_VIEW.height;
      return (
        <g key={overlay.overlayId} data-overlay-kind="annotation">
          <line x1={x} y1={y - 16} x2={x} y2={y - 40} stroke={CS.danger} strokeWidth={1.5} />
          <rect x={x - 96} y={y - 78} width={192} height={38} rx={6} fill={CS.surfaceRaised} stroke={CS.danger} />
          <text x={x - 86} y={y - 60} fontSize={10.5} fill={CS.text} fontFamily={FONTS.sans}>
            {overlay.text?.slice(0, 34)}
          </text>
        </g>
      );
    }
    return null;
  });

  // Variant-delta badges at the affected entities' projected positions.
  const deltaBadges: ReactNode[] = presented
    .filter((entity) => entity.state === 'changed' || entity.state === 'removed')
    .map((entity) => {
      const canonical = canonicalOf(view, entity.geometry.entityId);
      if (canonical?.ndc == null) return null;
      const x = ((canonical.ndc.x + 1) / 2) * PLAN_VIEW.width;
      const y = ((1 - canonical.ndc.y) / 2) * PLAN_VIEW.height;
      const removed = entity.state === 'removed';
      const text = `${removed ? '✕ removed' : '● changed'} · ${entity.projection.label.slice(0, 20)}`;
      return (
        <g
          key={`delta-${entity.geometry.entityId}`}
          data-variant-delta={entity.state}
          data-entity={entity.geometry.entityId}
        >
          <line x1={x} y1={y} x2={x + 26} y2={y - 26} stroke={removed ? CS.danger : CS.boq} strokeWidth={1.5} />
          <rect
            x={x + 22}
            y={y - 52}
            width={12 + text.length * 5.4}
            height={20}
            rx={5}
            fill={CS.surfaceRaised}
            stroke={removed ? CS.danger : CS.boq}
          />
          <text x={x + 30} y={y - 38} fontSize={10} fill={removed ? CS.danger : CS.boq} fontFamily={FONTS.sans}>
            {text}
          </text>
        </g>
      );
    });

  // Agent presence markers at their interpolated positions (3D overlay).
  const agentMarkers3d: ReactNode[] = props.agents.map(({ agent, followed }) => {
    const position = agentPositionAt(agent, timeline.positionAtMs);
    const projected = projectPoint(view.viewport.navigation, position);
    if (!projected.inFrustum || projected.depth <= 0.0001) return null;
    const x = ((projected.x + 1) / 2) * PLAN_VIEW.width;
    const y = ((1 - projected.y) / 2) * PLAN_VIEW.height;
    return (
      <g
        key={agent.agentId}
        data-cs-agent={agent.agentId}
        data-followed={followed ? 'true' : 'false'}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          event.stopPropagation();
          props.onFollowAgent(agent.agentId);
        }}
      >
        {followed ? <circle cx={x} cy={y} r={15} fill="none" stroke={CS.accent} strokeWidth={2.5} /> : null}
        <circle cx={x} cy={y} r={7} fill={followed ? CS.accent : CS.text} stroke={CS.surfaceRaised} strokeWidth={2} />
        <rect x={x + 10} y={y - 24} width={Math.min(210, 26 + agent.label.length * 5.4)} height={20} rx={5} fill={CS.surfaceRaised} stroke={CS.border} />
        <text x={x + 16} y={y - 10} fontSize={10} fill={CS.text} fontFamily={FONTS.sans}>
          {agent.label}
        </text>
      </g>
    );
  });

  // -----------------------------------------------------------------------
  // The plan presentation (true top-down, north up).
  // -----------------------------------------------------------------------
  const planCanvas = (
    <svg
      data-testid="cs-plan-canvas"
      viewBox={`0 0 ${PLAN_VIEW.width} ${PLAN_VIEW.height}`}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        zIndex: 2,
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const px = ((event.clientX - bounds.left) / bounds.width) * PLAN_VIEW.width;
        const py = ((event.clientY - bounds.top) / bounds.height) * PLAN_VIEW.height;
        if (cutDragRef.current) {
          // Dragging the SECTION A–A cut line across the plan (the cut-plane
          // interaction): the world X under the pointer becomes the cut
          // (snapped to the valid range — the workspace re-clamps on render).
          props.onSectionCutChange(
            clampSectionCut(planProjector.worldA(px), props.sectionCutRange),
          );
          return;
        }
        const hit = planEntityAt(presented, planProjector, { x: px, y: py });
        props.onPresentedPick(hit?.geometry.entityId ?? null);
      }}
      onPointerUp={() => {
        cutDragRef.current = false;
      }}
    >
      <rect x={0} y={0} width={PLAN_VIEW.width} height={PLAN_VIEW.height} fill="#f6f3ec" />
      {/* The site boundary + north arrow (orientation chrome). */}
      {(() => {
        const boundary = presented.find((p) => p.geometry.entityId === 'cs-site-boundary');
        if (boundary === undefined) return null;
        const [x, , z] = boundary.geometry.position;
        const [bx, , bz] = boundary.geometry.bbox;
        return (
          <g>
            <rect
              x={planProjector.px(x - bx / 2)}
              y={planProjector.py(z - bz / 2)}
              width={bx * planProjector.scale}
              height={bz * planProjector.scale}
              fill="none"
              stroke={CS.borderStrong}
              strokeWidth={1.2}
              strokeDasharray="10 6"
            />
          </g>
        );
      })()}
      {/* The building footprint grid (1m). */}
      {(() => {
        const grid: ReactNode[] = [];
        for (let gx = -4; gx <= 4; gx += 1) {
          grid.push(
            <line
              key={`gx-${gx}`}
              x1={planProjector.px(gx)}
              y1={planProjector.py(-3.2)}
              x2={planProjector.px(gx)}
              y2={planProjector.py(3.2)}
              stroke={CS.border}
              strokeWidth={0.6}
            />,
          );
        }
        for (let gz = -3; gz <= 3; gz += 1) {
          grid.push(
            <line
              key={`gz-${gz}`}
              x1={planProjector.px(-4.2)}
              y1={planProjector.py(gz)}
              x2={planProjector.px(4.2)}
              y2={planProjector.py(gz)}
              stroke={CS.border}
              strokeWidth={0.6}
            />,
          );
        }
        return <g opacity={0.55}>{grid}</g>;
      })()}
      {/* The entity footprints (phase-gated, variant-applied, layer-colored). */}
      {planDrawOrder(presented).map((entity) => {
        if (!visibleInWorld(entity)) return null;
        const rect = (() => {
          const [x, , z] = entity.geometry.position;
          const [bx, , bz] = entity.geometry.bbox;
          const left = planProjector.px(x - bx / 2);
          const top = planProjector.py(z - bz / 2);
          return { x: left, y: top, width: Math.max(2, bx * planProjector.scale), height: Math.max(2, bz * planProjector.scale) };
        })();
        const color = layerColorOf(entity.geometry.layer);
        const isBuilt = built(entity);
        const selected = props.selectedEntityId === entity.geometry.entityId;
        const isHighlighted = highlight.has(entity.geometry.entityId);
        return (
          <g key={entity.geometry.entityId} data-cs-plan-entity={entity.geometry.entityId}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={Math.min(4, rect.width / 4)}
              fill={isBuilt ? color.fill : 'none'}
              stroke={
                selected ? CS.selection : isHighlighted ? CS.boq : isBuilt ? color.stroke : CS.borderStrong
              }
              strokeWidth={selected ? 3 : isHighlighted ? 2.5 : 1.3}
              strokeDasharray={isBuilt ? undefined : '4 4'}
            />
            {entity.state === 'added' ? (
              <rect
                x={rect.x - 3}
                y={rect.y - 3}
                width={rect.width + 6}
                height={rect.height + 6}
                rx={5}
                fill="none"
                stroke={CS.success}
                strokeWidth={1.6}
                strokeDasharray="5 4"
              />
            ) : null}
            {rect.width > 34 && rect.height > 16 ? (
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + rect.height / 2 + 3}
                textAnchor="middle"
                fontSize={9.5}
                fill={CS.textSecondary}
                fontFamily={FONTS.sans}
                pointerEvents="none"
              >
                {entity.projection.label.slice(0, Math.max(2, Math.floor(rect.width / 6)))}
              </text>
            ) : null}
            {selected || isHighlighted ? (
              <rect
                x={rect.x - 5}
                y={rect.y - 5}
                width={rect.width + 10}
                height={rect.height + 10}
                rx={6}
                fill="none"
                stroke={selected ? CS.selection : CS.boq}
                strokeWidth={2}
                opacity={0.85}
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}
      {/* Agents on the plan (their interpolated positions). */}
      {props.agents.map(({ agent, followed }) => {
        const position = agentPositionAt(agent, timeline.positionAtMs);
        const x = planProjector.px(position[0]);
        const y = planProjector.py(position[2]);
        return (
          <g
            key={agent.agentId}
            data-cs-agent={agent.agentId}
            data-followed={followed ? 'true' : 'false'}
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              props.onFollowAgent(agent.agentId);
            }}
          >
            <circle cx={x} cy={y} r={6.5} fill={followed ? CS.accent : CS.text} stroke={CS.surfaceRaised} strokeWidth={2} />
            {followed ? <circle cx={x} cy={y} r={13} fill="none" stroke={CS.accent} strokeWidth={2} /> : null}
            <text x={x + 10} y={y + 4} fontSize={10} fill={CS.text} fontFamily={FONTS.sans}>
              {agent.label.split(' — ')[0] ?? agent.label}
            </text>
          </g>
        );
      })}
      {/* Measurements + annotations drawn between the plan positions. */}
      {view.viewport.overlays.map((overlay) => {
        if (overlay.overlayKind === 'measurement') {
          const a = presented.find((p) => p.geometry.entityId === overlay.fromEntityId);
          const b = presented.find((p) => p.geometry.entityId === overlay.toEntityId);
          if (a === undefined || b === undefined) return null;
          const ax = planProjector.px(a.geometry.position[0]);
          const ay = planProjector.py(a.geometry.position[2]);
          const bx = planProjector.px(b.geometry.position[0]);
          const by = planProjector.py(b.geometry.position[2]);
          return (
            <g key={overlay.overlayId} data-overlay-kind="measurement">
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={CS.accent} strokeWidth={2} strokeDasharray="8 5" />
              <circle cx={ax} cy={ay} r={4} fill={CS.accent} />
              <circle cx={bx} cy={by} r={4} fill={CS.accent} />
              <text x={(ax + bx) / 2} y={(ay + by) / 2 - 8} textAnchor="middle" fontSize={11} fill={CS.accent} fontFamily={FONTS.mono}>
                {overlay.label ?? 'Measurement'}
              </text>
            </g>
          );
        }
        if (overlay.overlayKind === 'annotation') {
          const target = presented.find((p) => p.geometry.entityId === overlay.entityId);
          if (target === undefined) return null;
          const x = planProjector.px(target.geometry.position[0]);
          const y = planProjector.py(target.geometry.position[2]);
          return (
            <g key={overlay.overlayId} data-overlay-kind="annotation">
              <line x1={x} y1={y - 12} x2={x} y2={y - 34} stroke={CS.danger} strokeWidth={1.5} />
              <rect x={x - 92} y={y - 72} width={184} height={38} rx={6} fill={CS.surfaceRaised} stroke={CS.danger} />
              <text x={x - 82} y={y - 54} fontSize={10.5} fill={CS.text} fontFamily={FONTS.sans}>
                {overlay.text?.slice(0, 32)}
              </text>
            </g>
          );
        }
        return null;
      })}
      {/* The SECTION A–A cut line (the plan carries the section's cut
          position + view direction — ONE cut state drives both views; drag
          the line to move the cut, the section re-projects live). */}
      {(() => {
        const cut = planCutLineOf(planProjector, props.sectionCutX);
        return (
          <g
            data-testid="cs-plan-cut-line"
            data-cut-x={props.sectionCutX}
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(event) => {
              event.stopPropagation();
              cutDragRef.current = true;
            }}
          >
            <line
              x1={cut.xPx}
              y1={cut.y1Px}
              x2={cut.xPx}
              y2={cut.y2Px}
              stroke={CS.danger}
              strokeWidth={2}
              strokeDasharray="12 6"
            />
            {/* The "A" anchors + the view-direction arrow (toward −X). */}
            <circle cx={cut.xPx} cy={cut.y1Px} r={9} fill={CS.surfaceRaised} stroke={CS.danger} strokeWidth={2} />
            <text x={cut.xPx} y={cut.y1Px + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={CS.danger} fontFamily={FONTS.mono}>
              A
            </text>
            <circle cx={cut.xPx} cy={cut.y2Px} r={9} fill={CS.surfaceRaised} stroke={CS.danger} strokeWidth={2} />
            <text x={cut.xPx} y={cut.y2Px + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={CS.danger} fontFamily={FONTS.mono}>
              A
            </text>
            <polygon
              points={`${cut.xPx - 18},${cut.y1Px + 24} ${cut.xPx - 8},${cut.y1Px + 28} ${cut.xPx - 18},${cut.y1Px + 32}`}
              fill={CS.danger}
              opacity={0.8}
            />
          </g>
        );
      })()}
      {/* North arrow. */}
      <g>
        <polygon
          points={`${PLAN_VIEW.width - 46},${PLAN_VIEW.height - 54} ${PLAN_VIEW.width - 38},${PLAN_VIEW.height - 34} ${PLAN_VIEW.width - 46},${PLAN_VIEW.height - 40} ${PLAN_VIEW.width - 54},${PLAN_VIEW.height - 34}`}
          fill={CS.textSecondary}
        />
        <text x={PLAN_VIEW.width - 46} y={PLAN_VIEW.height - 62} textAnchor="middle" fontSize={11} fill={CS.textSecondary} fontFamily={FONTS.mono}>
          N
        </text>
      </g>
    </svg>
  );

  // -----------------------------------------------------------------------
  // The section presentation (cutaway at the LIVE cut plane; the plan's
  // A–A line, the CUT HUD stepper and this projection share ONE cut state).
  // -----------------------------------------------------------------------
  const sectionCanvas = (
    <svg
      data-testid="cs-section-canvas"
      data-cut-x={props.sectionCutX}
      viewBox={`0 0 ${SECTION_VIEW.width} ${SECTION_VIEW.height}`}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        zIndex: 2,
      }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const px = ((event.clientX - bounds.left) / bounds.width) * SECTION_VIEW.width;
        const py = ((event.clientY - bounds.top) / bounds.height) * SECTION_VIEW.height;
        const hit = sectionEntityAt(presented, sectionProjector, { x: px, y: py }, props.sectionCutX);
        props.onPresentedPick(hit?.geometry.entityId ?? null);
      }}
    >
      <rect x={0} y={0} width={SECTION_VIEW.width} height={SECTION_VIEW.height} fill="#f6f3ec" />
      {/* The ground line. */}
      <line
        x1={sectionProjector.px(sectionProjector.bounds.minX)}
        y1={sectionProjector.py(0)}
        x2={sectionProjector.px(sectionProjector.bounds.maxX)}
        y2={sectionProjector.py(0)}
        stroke={CS.borderStrong}
        strokeWidth={1.4}
      />
      {/* The elevation gridlines + level labels (the A–A refinement:
          1m dashed levels with +x.xx m labels along the left edge). */}
      {(() => {
        const levels: ReactNode[] = [];
        const yMin = Math.max(0, Math.floor(sectionProjector.bounds.minY));
        const yMax = Math.ceil(sectionProjector.bounds.maxY);
        for (let level = yMin; level <= yMax; level += 1) {
          const y = sectionProjector.py(level);
          if (y < 30 || y > SECTION_VIEW.height - 8) continue;
          levels.push(
            <g key={`level-${level}`} data-cs-level={level}>
              <line
                x1={64}
                y1={y}
                x2={SECTION_VIEW.width - 26}
                y2={y}
                stroke={level === 0 ? CS.borderStrong : CS.border}
                strokeWidth={level === 0 ? 1.4 : 0.6}
                strokeDasharray={level === 0 ? undefined : '3 4'}
                opacity={level === 0 ? 1 : 0.6}
              />
              <text x={16} y={y + 3.5} fontSize={9.5} fill={CS.textMuted} fontFamily={FONTS.mono}>
                {level === 0 ? '±0.00' : `+${level.toFixed(2)}`}
              </text>
            </g>,
          );
        }
        return <g>{levels}</g>;
      })()}
      {/* The A–A end labels (the section's identity anchors). */}
      <text x={16} y={SECTION_VIEW.height - 12} fontSize={13} fontWeight={700} fill={CS.danger} fontFamily={FONTS.mono}>
        A
      </text>
      <text
        x={SECTION_VIEW.width - 24}
        y={SECTION_VIEW.height - 12}
        fontSize={13}
        fontWeight={700}
        textAnchor="end"
        fill={CS.danger}
        fontFamily={FONTS.mono}
      >
        A
      </text>
      {sectionDrawOrder(presented, props.sectionCutX).map((entity) => {
        if (!visibleInWorld(entity)) return null;
        const [, y, z] = entity.geometry.position;
        const [, by, bz] = entity.geometry.bbox;
        const left = sectionProjector.px(z - bz / 2);
        const top = sectionProjector.py(y + by / 2);
        const rect = {
          x: left,
          y: top,
          width: Math.max(2, bz * sectionProjector.scale),
          height: Math.max(2, by * sectionProjector.scale),
        };
        const color = layerColorOf(entity.geometry.layer);
        const isBuilt = built(entity);
        const selected = props.selectedEntityId === entity.geometry.entityId;
        const isHighlighted = highlight.has(entity.geometry.entityId);
        return (
          <g key={entity.geometry.entityId} data-cs-section-entity={entity.geometry.entityId}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={Math.min(3, rect.width / 4)}
              fill={isBuilt ? color.fill : 'none'}
              stroke={selected ? CS.selection : isHighlighted ? CS.boq : isBuilt ? color.stroke : CS.borderStrong}
              strokeWidth={selected ? 3 : isHighlighted ? 2.5 : 1.3}
              strokeDasharray={isBuilt ? undefined : '4 4'}
            />
            {entity.state === 'added' ? (
              <rect
                x={rect.x - 3}
                y={rect.y - 3}
                width={rect.width + 6}
                height={rect.height + 6}
                rx={5}
                fill="none"
                stroke={CS.success}
                strokeWidth={1.6}
                strokeDasharray="5 4"
              />
            ) : null}
            {rect.width > 30 && rect.height > 14 ? (
              <text
                x={rect.x + rect.width / 2}
                y={rect.y + rect.height / 2 + 3}
                textAnchor="middle"
                fontSize={9.5}
                fill={CS.textSecondary}
                fontFamily={FONTS.sans}
                pointerEvents="none"
              >
                {entity.projection.label.slice(0, Math.max(2, Math.floor(rect.width / 6)))}
              </text>
            ) : null}
            {selected || isHighlighted ? (
              <rect
                x={rect.x - 5}
                y={rect.y - 5}
                width={rect.width + 10}
                height={rect.height + 10}
                rx={6}
                fill="none"
                stroke={selected ? CS.selection : CS.boq}
                strokeWidth={2}
                opacity={0.85}
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}
      {/* The cut-plane dimension line (A–A). */}
      <g>
        <text x={16} y={22} fontSize={11} fill={CS.textMuted} fontFamily={FONTS.mono}>
          SECTION A–A · cut x={props.sectionCutX >= 0 ? '+' : ''}
          {props.sectionCutX.toFixed(2)}m · view toward −X · Z→ · Y↑
        </text>
      </g>
    </svg>
  );

  // -----------------------------------------------------------------------
  // The viewport frame + floating HUDs.
  // -----------------------------------------------------------------------
  return (
    <section
      ref={sectionRef}
      data-testid="cs-world-viewport"
      data-view-mode={viewMode}
      data-spatial-overlay={viewMode === '3d' ? (engineSpatial ? 'engine' : 'reference') : viewMode}
      data-engine-spatial={engineSpatial ? 'true' : 'false'}
      data-variant={props.variantId}
      role="application"
      aria-label="Construction solution world viewport"
      tabIndex={0}
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '-'].includes(key)) {
          runtime.navigate(key as 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'r' | 'f' | '+' | '-');
        }
      }}
      onWheel={(event) => {
        if (viewMode === '3d') {
          void runtime.dispatchWheel({ x: event.deltaX, y: event.deltaY });
        }
      }}
      onPointerDown={(event) => {
        if (viewMode !== '3d') return;
        const bounds = (engineSpatial ? stageRef.current : event.currentTarget)?.getBoundingClientRect()
          ?? event.currentTarget.getBoundingClientRect();
        dragRef.current = { x: event.clientX, y: event.clientY };
        const pointer = {
          x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
          y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
        };
        // The 3D pick goes through the renderer-fabric seam (the ACTIVE
        // adapter's own hit test → the typed intent); the CANONICAL semantic
        // pick (the receipt's hit entity) flows back through the same
        // selection channel the plan/section presentations use.
        void runtime.dispatchPointerDown(pointer).then((outcome) => {
          if (outcome.ok) {
            props.onPresentedPick(outcome.value.receipt.hitEntityId ?? null);
          }
        });
      }}
      onPointerMove={(event) => {
        if (viewMode !== '3d') return;
        const drag = dragRef.current;
        if (drag === null) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        dragRef.current = { x: event.clientX, y: event.clientY };
        const kind = event.shiftKey || event.metaKey || event.altKey ? 'pan' : 'orbit';
        runtime.applyGesture({ kind, deltaX: dx * 0.008, deltaY: dy * 0.008 });
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        background: CS.viewportGround,
        border: `1px solid ${CS.border}`,
        borderRadius: RADII.md,
        overflow: 'hidden',
        outline: 'none',
        cursor: viewMode === '3d' ? 'crosshair' : 'default',
      }}
    >
      {threeStage}

      {/* The 3D overlay chrome (measurements, annotations, deltas, agents,
          reference glyphs when no engine presents). */}
      {viewMode === '3d' ? (
        <svg
          data-testid="cs-world-chrome"
          viewBox={`0 0 ${PLAN_VIEW.width} ${PLAN_VIEW.height}`}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {!engineSpatial ? referenceGlyphs : null}
          {overlayChrome}
          {deltaBadges}
          {agentMarkers3d}
          {/* The renderer banner (Epoch-owned chrome). */}
          <text x={14} y={22} fontSize={11} fill={CS.textSecondary} fontFamily={FONTS.mono}>
            {activeRendererId} · health {view.renderers.health.state} · session {view.renderers.sessionState}
          </text>
        </svg>
      ) : null}

      {viewMode === 'plan' ? planCanvas : null}
      {viewMode === 'section' ? sectionCanvas : null}

      {/* The mode banner (plan / section). */}
      {viewMode !== '3d' ? (
        <div
          data-testid="cs-mode-banner"
          style={{
            position: 'absolute',
            top: SPACE.md,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4,
            background: CS.surfaceRaised,
            border: `1px solid ${CS.borderStrong}`,
            borderRadius: 999,
            padding: `4px ${SPACE.lg}px`,
            fontSize: CS_TYPE.sizeXs,
            fontFamily: FONTS.mono,
            color: CS.textSecondary,
            letterSpacing: '0.04em',
          }}
        >
          {viewMode === 'plan'
            ? 'PLAN — true top-down · north up'
            : `SECTION A–A — cut x=${props.sectionCutX >= 0 ? '+' : ''}${props.sectionCutX.toFixed(2)}m · view toward −X`}
        </div>
      ) : null}

      {/* The cut-plane controls (section mode — the cut interaction HUD). */}
      {viewMode === 'section' ? (
        <div
          data-testid="cs-section-cut"
          data-cut-x={props.sectionCutX}
          role="group"
          aria-label="Section cut position"
          style={{
            position: 'absolute',
            top: SPACE.xl * 3,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACE.xs,
            background: 'rgba(250, 248, 244, 0.94)',
            border: `1px solid ${CS.border}`,
            borderRadius: 999,
            padding: `3px ${SPACE.sm}px`,
            fontFamily: FONTS.mono,
            fontSize: CS_TYPE.sizeXxs,
            color: CS.textSecondary,
          }}
        >
          <span style={{ letterSpacing: '0.05em' }}>CUT</span>
          <button
            type="button"
            data-testid="cs-section-cut-dec"
            aria-label="Move the section cut toward −X"
            onClick={(event) => {
              event.stopPropagation();
              props.onSectionCutChange(props.sectionCutX - SECTION_CUT_STEP);
            }}
            style={{
              padding: '1px 9px',
              borderRadius: 999,
              border: `1px solid ${CS.border}`,
              background: CS.surfaceRaised,
              color: CS.textSecondary,
              fontSize: CS_TYPE.sizeXs,
              fontFamily: FONTS.mono,
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <span data-testid="cs-section-cut-value" style={{ minWidth: 86, textAlign: 'center' }}>
            x = {props.sectionCutX.toFixed(2)} m
          </span>
          <button
            type="button"
            data-testid="cs-section-cut-inc"
            aria-label="Move the section cut toward +X"
            onClick={(event) => {
              event.stopPropagation();
              props.onSectionCutChange(props.sectionCutX + SECTION_CUT_STEP);
            }}
            style={{
              padding: '1px 9px',
              borderRadius: 999,
              border: `1px solid ${CS.border}`,
              background: CS.surfaceRaised,
              color: CS.textSecondary,
              fontSize: CS_TYPE.sizeXs,
              fontFamily: FONTS.mono,
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            type="button"
            data-testid="cs-section-cut-reset"
            onClick={(event) => {
              event.stopPropagation();
              props.onSectionCutChange(SECTION_CUT_X);
            }}
            style={{
              padding: '1px 8px',
              borderRadius: 999,
              border: `1px solid ${CS.border}`,
              background: CS.surfaceRaised,
              color: CS.textMuted,
              fontSize: CS_TYPE.sizeXxs,
              fontFamily: FONTS.sans,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <span style={{ color: CS.textMuted }}>
            [{props.sectionCutRange.minX.toFixed(1)} … {props.sectionCutRange.maxX.toFixed(1)}]m
          </span>
        </div>
      ) : null}

      {/* The view-controls HUD (top-right floating). */}
      <div
        data-testid="cs-view-controls"
        style={{
          position: 'absolute',
          top: SPACE.md,
          right: SPACE.md,
          zIndex: 4,
          display: 'flex',
          gap: SPACE.xs,
          alignItems: 'center',
        }}
      >
        {(['3d', 'plan', 'section'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`cs-mode-${mode}`}
            aria-pressed={viewMode === mode}
            onClick={(event) => {
              event.stopPropagation();
              props.onViewModeChange(mode);
            }}
            style={{
              padding: '5px 12px',
              borderRadius: RADII.sm,
              border: `1px solid ${viewMode === mode ? CS.accentBorder : CS.border}`,
              background: viewMode === mode ? CS.accentDim : CS.surfaceRaised,
              color: viewMode === mode ? CS.accent : CS.textSecondary,
              fontSize: CS_TYPE.sizeXs,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            {mode}
          </button>
        ))}
        <button
          type="button"
          data-testid="cs-reset-camera"
          onClick={(event) => {
            event.stopPropagation();
            runtime.resetNavigation();
          }}
          style={{
            padding: '5px 10px',
            borderRadius: RADII.sm,
            border: `1px solid ${CS.border}`,
            background: CS.surfaceRaised,
            color: CS.textSecondary,
            fontSize: CS_TYPE.sizeXs,
            fontFamily: FONTS.sans,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>

      {/* The live-metrics HUD (bottom-left floating). */}
      <div
        data-testid="cs-metrics"
        style={{
          position: 'absolute',
          left: SPACE.md,
          bottom: SPACE.md,
          zIndex: 4,
          display: 'flex',
          gap: SPACE.sm,
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '70%',
          background: 'rgba(250, 248, 244, 0.94)',
          border: `1px solid ${CS.border}`,
          borderRadius: RADII.md,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          fontFamily: FONTS.mono,
          fontSize: CS_TYPE.sizeXs,
          color: CS.textSecondary,
        }}
      >
        <span>
          <strong style={{ color: CS.text }}>{props.activePhase.label}</strong> · built{' '}
          {presented.filter((entity) => visibleInWorld(entity) && built(entity)).length}/{presented.length}
        </span>
        <span>
          digest {view.viewport.worldDigest.slice(0, 10)}…
        </span>
        <span data-testid="cs-metrics-variant">{props.variantId}</span>
      </div>

      {/* The renderer-health / failure banner. */}
      {view.renderers.lastFailure === null ? null : (
        <div
          data-testid="cs-renderer-failure"
          role="alert"
          style={{
            position: 'absolute',
            left: SPACE.md,
            top: SPACE.md,
            zIndex: 5,
            maxWidth: 380,
            background: '#fef2f2',
            border: `1px solid #fecaca`,
            borderRadius: RADII.sm,
            padding: `${SPACE.sm}px ${SPACE.md}px`,
            fontSize: CS_TYPE.sizeXs,
            color: '#7f1d1d',
          }}
        >
          {view.renderers.fallbackApplied ? 'Fallback applied — ' : ''}
          {view.renderers.lastFailure.message}
        </div>
      )}

      {/* The timeline HUD (bottom, full-width floating). */}
      <div
        data-testid="cs-timeline"
        style={{
          position: 'absolute',
          left: SPACE.md,
          right: SPACE.md,
          bottom: SPACE.md,
          zIndex: 4,
          marginTop: SPACE.xl,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: SPACE.xs,
            alignItems: 'center',
            marginBottom: SPACE.xs,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: CS_TYPE.sizeXs,
              color: CS.text,
              fontWeight: 600,
            }}
          >
            {(timeline.positionAtMs / 1000).toFixed(1)}s / {(timeline.trackEndMs / 1000).toFixed(1)}s
          </span>
          <span
            data-testid="cs-timeline-phase"
            style={{
              fontFamily: FONTS.sans,
              fontSize: CS_TYPE.sizeXs,
              color: CS.accent,
              fontWeight: 600,
            }}
          >
            {props.activePhase.label}
          </span>
          <button
            type="button"
            data-testid="cs-timeline-toggle"
            onClick={(event) => {
              event.stopPropagation();
              void (timeline.paused ? runtime.resumeTimeline() : runtime.pauseTimeline());
            }}
            style={{
              padding: '2px 10px',
              borderRadius: 999,
              border: `1px solid ${CS.border}`,
              background: CS.surfaceRaised,
              color: CS.textSecondary,
              fontSize: CS_TYPE.sizeXs,
              fontFamily: FONTS.sans,
              cursor: 'pointer',
            }}
          >
            {timeline.paused ? 'Resume' : 'Pause'}
          </button>
          {SOLUTION_PHASES.map((phase) => (
            <button
              key={phase.phaseId}
              type="button"
              data-testid={`cs-phase-${phase.phaseId}`}
              aria-pressed={props.activePhase.phaseId === phase.phaseId}
              title={`${phase.label} @ ${(phase.atMs / 1000).toFixed(1)}s`}
              onClick={(event) => {
                event.stopPropagation();
                void runtime.scrubTimeline(phase.atMs);
              }}
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                border: `1px solid ${
                  props.activePhase.phaseId === phase.phaseId ? CS.accentBorder : CS.border
                }`,
                background: props.activePhase.phaseId === phase.phaseId ? CS.accentDim : CS.surfaceRaised,
                color: props.activePhase.phaseId === phase.phaseId ? CS.accent : CS.textMuted,
                fontSize: CS_TYPE.sizeXxs,
                fontFamily: FONTS.sans,
                letterSpacing: '0.03em',
                cursor: 'pointer',
              }}
            >
              {phase.label}
            </button>
          ))}
        </div>
        <div
          role="slider"
          aria-label="Construction programme position"
          aria-valuenow={timeline.positionAtMs}
          aria-valuemin={timeline.trackStartMs}
          aria-valuemax={timeline.trackEndMs}
          tabIndex={0}
          data-testid="cs-timeline-track"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
            void runtime.scrubTimeline(timeline.trackStartMs + fraction * span);
          }}
          style={{
            position: 'relative',
            height: 26,
            background: 'rgba(250, 248, 244, 0.92)',
            border: `1px solid ${CS.border}`,
            borderRadius: RADII.sm,
            cursor: 'pointer',
          }}
        >
          {timeline.markers.map((marker) => (
            <span
              key={marker.markerId}
              title={`${marker.label ?? marker.markerId} @ ${(marker.atMs / 1000).toFixed(1)}s`}
              style={{
                position: 'absolute',
                left: `${((marker.atMs - timeline.trackStartMs) / span) * 100}%`,
                top: marker.markerKind === 'branch-point' ? 2 : 14,
                width: 8,
                height: 8,
                borderRadius: 4,
                background: marker.markerKind === 'branch-point' ? CS.accent : CS.textMuted,
              }}
            />
          ))}
          <span
            style={{
              position: 'absolute',
              left: `${((timeline.positionAtMs - timeline.trackStartMs) / span) * 100}%`,
              top: 0,
              bottom: 0,
              width: 3,
              background: CS.accent,
            }}
          />
        </div>
      </div>
    </section>
  );
}
