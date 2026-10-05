'use client';
/**
 * W072 — the CONSTRUCTION WORLD VIEWPORT (ACR-012): the spatially dominant
 * region of the web construction solution workspace (the world viewport
 * occupies 60–75% of the main surface).
 *
 * One viewport, three presentations of the SAME frozen W071 world:
 *
 *  - **3D** — the REAL engine stage (Three.js / Babylon.js over the live
 *    GL canvases the host injects) presenting the canonical W016 scene
 *    through the REAL renderer fabric, with the non-positional chrome
 *    (measurements, annotations, variant-delta badges, agent presence) as
 *    the SVG overlay; when no engine presents, the reference projection
 *    glyphs carry the world (never a blank square — the W061 doctrine).
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
 * (dispatchPointerDown → adapter hit-test → typed intent); plan / section
 * picks select the canonical entity and the workspace issues the SAME
 * typed pick through the active Three.js presentation when one presents
 * (honest degradation under Babylon.js — documented, never faked);
 * layer/isolate/measure/annotate/follow/scrub/branch are the driver's
 * existing typed commands. No renderer-local semantic authority anywhere.
 */
import type { ReactNode, RefObject } from 'react';
import { projectPoint } from '@epoch/world-runtime';
import type {
  TimelineViewModelInput,
  ViewportViewModelInput,
} from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';
import {
  PLAN_VIEW,
  SECTION_CUT_STEP,
  SECTION_CUT_X,
  SECTION_VIEW,
  SOLUTION_AGENTS,
  SOLUTION_PHASES,
  agentPositionAt,
  planCutLineOf,
  planDrawOrder,
  planEntityAt,
  planProjectorFor,
  sectionDrawOrder,
  sectionEntityAt,
  sectionProjectorFor,
  entityBuiltAtPhase,
  type ConstructionPhase,
  type PresentedConstructionEntity,
  type SectionCutRange,
  type SolutionVariantId,
  type SolutionViewMode,
} from '../construction-solution';
import { CS, CS_TYPE, FONTS, layerColorOf } from '../construction-tokens';

/** The fixture agent records by id (the marker/plan/section rendering). */
const SOLUTION_AGENT_POSITIONS: ReadonlyMap<string, (typeof SOLUTION_AGENTS)[number]> = new Map(
  SOLUTION_AGENTS.map((agent) => [agent.agentId, agent]),
);

/** The viewBox space of the 3D chrome overlay (scaled to the region). */
const CHROME_VIEW = { width: 1000, height: 640 } as const;

/** Map one NDC coordinate into the chrome viewBox (y is inverted: NDC +y is up). */
function chromePoint(ndc: { readonly x: number; readonly y: number }): { x: number; y: number } {
  return {
    x: ((ndc.x + 1) / 2) * CHROME_VIEW.width,
    y: ((1 - ndc.y) / 2) * CHROME_VIEW.height,
  };
}

/** Format a virtual time compactly (e.g. 5400 → "5.4s"). */
export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Shorten a digest for display. */
function shortDigest(digest: string): string {
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

function degrees(radians: number): number {
  return Math.round((radians * 180) / Math.PI);
}

/** One presented agent (fixture record + followed flag) for the viewport. */
export interface ViewportAgentEntry {
  readonly agentId: string;
  readonly label: string;
  readonly followed: boolean;
}

/** The construction world viewport props. */
export interface ConstructionViewportProps {
  readonly viewport: ViewportViewModelInput;
  /** The programme timeline view model (the scrubber + phase HUD). */
  readonly timeline: TimelineViewModelInput;
  readonly health: { readonly state: string; readonly detail?: string | undefined };
  readonly fallbackApplied: boolean;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly handlers: WorkspaceHandlers;
  /** The engine stage layer (the host's REAL GL canvases), rendered behind the chrome. */
  readonly engineStage?: ReactNode | undefined;
  /** Which surface presents the spatial world ('engine' = real pixels). */
  readonly spatialOverlay?: 'reference' | 'engine' | undefined;
  /** The element 3D pointer input normalizes against (the engine stage). */
  readonly pointerBounds?: RefObject<HTMLElement | null> | undefined;
  /** The variant-applied presented world (frozen fixture + variant deltas). */
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  readonly viewMode: SolutionViewMode;
  readonly selectedEntityId: string | null;
  /** A plan/section pick of one canonical entity (the workspace drives the typed path). */
  readonly onPresentedPick: (entityId: string | null) => void;
  /** The cross-highlight set (BOQ ↔ world / constraint focus / agent work). */
  readonly highlightEntityIds: readonly string[];
  /** The live section cut position (meters — ONE cut state drives the plan's A–A line and the section). */
  readonly sectionCutX: number;
  /** The valid cut range of the presented world (the steppers/drag clamp to it). */
  readonly sectionCutRange: SectionCutRange;
  /** Adjust the cut position (the cut-plane interaction). */
  readonly onSectionCutChange: (x: number) => void;
  readonly activePhase: ConstructionPhase;
  /** The measure-state hint (from the newest measure journal entry). */
  readonly measureHint: string | null;
  readonly agents: readonly ViewportAgentEntry[];
}

/** The canonical entity record of one entity id (from the runtime view). */
function canonicalOf(view: ViewportViewModelInput, entityId: string) {
  return view.entities.find((entity) => entity.entityId === entityId) ?? null;
}

/** The world viewport (the dominant spatial surface). */
export function ConstructionViewport(props: ConstructionViewportProps): ReactNode {
  const { viewport, viewMode } = props;
  const referenceOverlay = props.spatialOverlay !== 'engine';
  const timeline = props.timeline;
  const span = Math.max(1, timeline.trackEndMs - timeline.trackStartMs);
  const planProjector = planProjectorFor(props.presented);
  const sectionProjector = sectionProjectorFor(props.presented, props.sectionCutX);
  const highlight = new Set(props.highlightEntityIds);

  /** Whether one presented entity is currently visible in the world. */
  const visibleInWorld = (entity: PresentedConstructionEntity): boolean => {
    if (entity.state === 'removed') return false;
    const canonical = canonicalOf(viewport, entity.geometry.entityId);
    if (canonical === null) return true; // variant-added entities present by the host.
    return canonical.visible;
  };

  /** Whether one presented entity is built at the active phase. */
  const built = (entity: PresentedConstructionEntity): boolean =>
    entityBuiltAtPhase(entity.geometry, props.activePhase);

  // -----------------------------------------------------------------------
  // The 3D chrome overlay (reference glyphs when no engine presents;
  // overlays, variant-delta badges and agent markers always).
  // -----------------------------------------------------------------------
  // The OFFSCREEN edge markers (the W057/W061 doctrine — never a false
  // spatial claim): entities behind the camera or outside the frustum
  // render as a restrained right-edge rail that NAMES the canonical entity
  // without claiming a position (always rendered — engine pixels carry the
  // visible world, this rail carries the honest "outside view" remainder).
  const offscreenEntities = viewport.entities.filter((entity) => entity.ndc === null);
  const offscreenRail: ReactNode =
    offscreenEntities.length === 0 ? null : (
      <g data-viewport-offscreen-rail="">
        {offscreenEntities.map((entity, index) => {
          const y = 40 + index * 30;
          return (
            <g key={entity.entityId} data-viewport-entity={entity.entityId} data-entity-state="offscreen">
              <rect
                x={CHROME_VIEW.width - 252}
                y={y}
                width={240}
                height={24}
                rx={12}
                fill={CS.surfaceRaised}
                fillOpacity={0.94}
                stroke={CS.border}
                strokeDasharray="4 3"
              />
              <text
                x={CHROME_VIEW.width - 240}
                y={y + 16}
                fontSize={10.5}
                fill={CS.textSecondary}
                fontFamily={FONTS.sans}
              >
                ◇ {entity.label} <tspan fill={CS.textMuted}>(outside view)</tspan>
              </text>
            </g>
          );
        })}
      </g>
    );
  const referenceGlyphs: ReactNode[] = viewport.entities.map((entity) => {
    if (entity.ndc === null) return null;
    const point = chromePoint(entity.ndc);
    const presentedEntity = props.presented.find(
      (p) => p.geometry.entityId === entity.entityId,
    );
    const color = layerColorOf(presentedEntity?.geometry.layer ?? '');
    const state = !entity.visible
      ? 'hidden'
      : entity.isolated
        ? 'isolated'
        : entity.focused
          ? 'focused'
          : 'visible';
    return (
      <g
        key={entity.entityId}
        data-viewport-entity={entity.entityId}
        data-entity-state={state}
        transform={`translate(${point.x} ${point.y})`}
        opacity={entity.visible ? 1 : 0.35}
      >
        {entity.focused ? (
          <circle r={22} fill="none" stroke={CS.selection} strokeWidth={3} data-focus-ring="" />
        ) : null}
        {highlight.has(entity.entityId) ? (
          <circle r={28} fill="none" stroke={CS.boq} strokeWidth={2.5} data-cross-highlight="" />
        ) : null}
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
  const overlayChrome: ReactNode[] = viewport.overlays.map((overlay) => {
    if (overlay.overlayKind === 'measurement') {
      const from = viewport.entities.find((e) => e.entityId === overlay.fromEntityId);
      const to = viewport.entities.find((e) => e.entityId === overlay.toEntityId);
      if (from?.ndc == null || to?.ndc == null) return null;
      const a = chromePoint(from.ndc);
      const b = chromePoint(to.ndc);
      const distance = Math.hypot(
        to.position[0] - from.position[0],
        to.position[1] - from.position[1],
        to.position[2] - from.position[2],
      );
      return (
        <g key={overlay.overlayId} data-viewport-overlay={overlay.overlayId} data-overlay-kind="measurement">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={CS.accent} strokeWidth={2} strokeDasharray="8 5" />
          <circle cx={a.x} cy={a.y} r={4} fill={CS.accent} />
          <circle cx={b.x} cy={b.y} r={4} fill={CS.accent} />
          <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" fontSize={11} fill={CS.accent} fontFamily={FONTS.mono}>
            {overlay.label ?? 'Measurement'} · {distance.toFixed(1)}u
          </text>
        </g>
      );
    }
    if (overlay.overlayKind === 'annotation') {
      const target = viewport.entities.find((e) => e.entityId === overlay.entityId);
      if (target?.ndc == null) return null;
      const point = chromePoint(target.ndc);
      return (
        <g key={overlay.overlayId} data-viewport-overlay={overlay.overlayId} data-overlay-kind="annotation">
          <line x1={point.x} y1={point.y - 16} x2={point.x} y2={point.y - 40} stroke={CS.danger} strokeWidth={1.5} />
          <rect x={point.x - 96} y={point.y - 78} width={192} height={38} rx={6} fill={CS.surfaceRaised} stroke={CS.danger} />
          <text x={point.x - 86} y={point.y - 60} fontSize={10.5} fill={CS.text} fontFamily={FONTS.sans}>
            {overlay.text?.slice(0, 34)}
          </text>
        </g>
      );
    }
    if (overlay.overlayKind === 'highlight') {
      const target = viewport.entities.find((e) => e.entityId === overlay.entityId);
      if (target?.ndc == null) return null;
      const point = chromePoint(target.ndc);
      return (
        <g key={overlay.overlayId} data-viewport-overlay={overlay.overlayId} data-overlay-kind="highlight">
          <circle cx={point.x} cy={point.y} r={30} fill="none" stroke={overlay.color ?? CS.danger} strokeWidth={4} opacity={0.85} />
        </g>
      );
    }
    return null;
  });

  // Variant-delta badges at the affected entities' projected positions.
  const deltaBadges: ReactNode[] = props.presented
    .filter((entity) => entity.state === 'changed' || entity.state === 'removed' || entity.state === 'added')
    .map((entity) => {
      const canonical = canonicalOf(viewport, entity.geometry.entityId);
      if (canonical?.ndc == null) return null;
      const point = chromePoint(canonical.ndc);
      const removed = entity.state === 'removed';
      const added = entity.state === 'added';
      const text = `${removed ? '✕ removed' : added ? '＋ added' : '● changed'} · ${entity.projection.label.slice(0, 20)}`;
      return (
        <g key={`delta-${entity.geometry.entityId}`} data-variant-delta={entity.state} data-entity={entity.geometry.entityId}>
          <line x1={point.x} y1={point.y} x2={point.x + 26} y2={point.y - 26} stroke={removed ? CS.danger : added ? CS.success : CS.boq} strokeWidth={1.5} />
          <rect
            x={point.x + 22}
            y={point.y - 52}
            width={12 + text.length * 5.4}
            height={20}
            rx={5}
            fill={CS.surfaceRaised}
            stroke={removed ? CS.danger : added ? CS.success : CS.boq}
          />
          <text x={point.x + 30} y={point.y - 38} fontSize={10} fill={removed ? CS.danger : added ? CS.success : CS.boq} fontFamily={FONTS.sans}>
            {text}
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
      data-viewport-canvas="plan"
      viewBox={`0 0 ${PLAN_VIEW.width} ${PLAN_VIEW.height}`}
      style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        // The SVG content letterboxes (preserveAspectRatio "meet"): map
        // the pointer through the CONTENT box — the same box the user sees
        // — never the raw element box (an aspect-mismatched region would
        // otherwise skew picks toward its edges).
        const scale = Math.min(bounds.width / PLAN_VIEW.width, bounds.height / PLAN_VIEW.height);
        const offsetX = (bounds.width - PLAN_VIEW.width * scale) / 2;
        const offsetY = (bounds.height - PLAN_VIEW.height * scale) / 2;
        const px = (event.clientX - bounds.left - offsetX) / scale;
        const py = (event.clientY - bounds.top - offsetY) / scale;
        const hit = planEntityAt(props.presented, planProjector, { x: px, y: py });
        props.onPresentedPick(hit?.geometry.entityId ?? null);
      }}
    >
      <rect x={0} y={0} width={PLAN_VIEW.width} height={PLAN_VIEW.height} fill={CS.viewportGround} />
      {/* The site boundary (orientation context). */}
      {(() => {
        const boundary = props.presented.find((p) => p.geometry.entityId === 'cs-site-boundary');
        if (boundary === undefined) return null;
        const [x, , z] = boundary.geometry.position;
        const [bx, , bz] = boundary.geometry.bbox;
        return (
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
        );
      })()}
      {/* The building footprint grid (1m). */}
      {(() => {
        const grid: ReactNode[] = [];
        for (let gx = -4; gx <= 4; gx += 1) {
          grid.push(
            <line key={`gx-${gx}`} x1={planProjector.px(gx)} y1={planProjector.py(-3.2)} x2={planProjector.px(gx)} y2={planProjector.py(3.2)} stroke={CS.border} strokeWidth={0.6} />,
          );
        }
        for (let gz = -3; gz <= 3; gz += 1) {
          grid.push(
            <line key={`gz-${gz}`} x1={planProjector.px(-4.2)} y1={planProjector.py(gz)} x2={planProjector.px(4.2)} y2={planProjector.py(gz)} stroke={CS.border} strokeWidth={0.6} />,
          );
        }
        return <g opacity={0.55}>{grid}</g>;
      })()}
      {/* The entity footprints (phase-gated, variant-applied, layer-colored). */}
      {planDrawOrder(props.presented).map((entity) => {
        if (!visibleInWorld(entity)) return null;
        const [x, , z] = entity.geometry.position;
        const [bx, , bz] = entity.geometry.bbox;
        const left = planProjector.px(x - bx / 2);
        const top = planProjector.py(z - bz / 2);
        const rect = {
          x: left,
          y: top,
          width: Math.max(2, bx * planProjector.scale),
          height: Math.max(2, bz * planProjector.scale),
        };
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
              stroke={selected ? CS.selection : isHighlighted ? CS.boq : isBuilt ? color.stroke : CS.borderStrong}
              strokeWidth={selected ? 3 : isHighlighted ? 2.5 : 1.3}
              strokeDasharray={isBuilt ? undefined : '4 4'}
            />
            {entity.state === 'added' ? (
              <rect x={rect.x - 3} y={rect.y - 3} width={rect.width + 6} height={rect.height + 6} rx={5} fill="none" stroke={CS.success} strokeWidth={1.6} strokeDasharray="5 4" />
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
          </g>
        );
      })}
      {/* Agents on the plan (their interpolated positions). */}
      {props.agents.map(({ agentId, label, followed }) => {
        const fixtureAgent = SOLUTION_AGENT_POSITIONS.get(agentId);
        if (fixtureAgent === undefined) return null;
        const position = agentPositionAt(fixtureAgent, timeline.positionAtMs);
        const x = planProjector.px(position[0]);
        const y = planProjector.py(position[2]);
        return (
          <g key={agentId} data-cs-agent={agentId} data-followed={followed ? 'true' : 'false'}>
            <circle cx={x} cy={y} r={6.5} fill={followed ? CS.accent : CS.text} stroke={CS.surfaceRaised} strokeWidth={2} />
            {followed ? <circle cx={x} cy={y} r={13} fill="none" stroke={CS.accent} strokeWidth={2} /> : null}
            <text x={x + 10} y={y + 4} fontSize={10} fill={CS.text} fontFamily={FONTS.sans}>
              {label.split(' — ')[0] ?? label}
            </text>
          </g>
        );
      })}
      {/* Measurements + annotations drawn between the plan positions. */}
      {viewport.overlays.map((overlay) => {
        if (overlay.overlayKind === 'measurement') {
          const a = props.presented.find((p) => p.geometry.entityId === overlay.fromEntityId);
          const b = props.presented.find((p) => p.geometry.entityId === overlay.toEntityId);
          if (a === undefined || b === undefined) return null;
          const ax = planProjector.px(a.geometry.position[0]);
          const ay = planProjector.py(a.geometry.position[2]);
          const bx2 = planProjector.px(b.geometry.position[0]);
          const by2 = planProjector.py(b.geometry.position[2]);
          return (
            <g key={overlay.overlayId} data-overlay-kind="measurement">
              <line x1={ax} y1={ay} x2={bx2} y2={by2} stroke={CS.accent} strokeWidth={2} strokeDasharray="8 5" />
              <circle cx={ax} cy={ay} r={4} fill={CS.accent} />
              <circle cx={bx2} cy={by2} r={4} fill={CS.accent} />
              <text x={(ax + bx2) / 2} y={(ay + by2) / 2 - 8} textAnchor="middle" fontSize={11} fill={CS.accent} fontFamily={FONTS.mono}>
                {overlay.label ?? 'Measurement'}
              </text>
            </g>
          );
        }
        if (overlay.overlayKind === 'annotation') {
          const target = props.presented.find((p) => p.geometry.entityId === overlay.entityId);
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
      {/* The SECTION A–A cut line (drag to move the cut; the section re-projects). */}
      {(() => {
        const cut = planCutLineOf(planProjector, props.sectionCutX);
        return (
          <g data-testid="cs-plan-cut-line" data-cut-x={props.sectionCutX} style={{ cursor: 'ew-resize' }}>
            <line x1={cut.xPx} y1={cut.y1Px} x2={cut.xPx} y2={cut.y2Px} stroke={CS.danger} strokeWidth={2} strokeDasharray="12 6" />
            <circle cx={cut.xPx} cy={cut.y1Px} r={9} fill={CS.surfaceRaised} stroke={CS.danger} strokeWidth={2} />
            <text x={cut.xPx} y={cut.y1Px + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={CS.danger} fontFamily={FONTS.mono}>A</text>
            <circle cx={cut.xPx} cy={cut.y2Px} r={9} fill={CS.surfaceRaised} stroke={CS.danger} strokeWidth={2} />
            <text x={cut.xPx} y={cut.y2Px + 3.5} textAnchor="middle" fontSize={11} fontWeight={700} fill={CS.danger} fontFamily={FONTS.mono}>A</text>
            <polygon points={`${cut.xPx - 18},${cut.y1Px + 24} ${cut.xPx - 8},${cut.y1Px + 28} ${cut.xPx - 18},${cut.y1Px + 32}`} fill={CS.danger} opacity={0.8} />
          </g>
        );
      })()}
      {/* North arrow. */}
      <g>
        <polygon
          points={`${PLAN_VIEW.width - 46},${PLAN_VIEW.height - 54} ${PLAN_VIEW.width - 38},${PLAN_VIEW.height - 34} ${PLAN_VIEW.width - 46},${PLAN_VIEW.height - 40} ${PLAN_VIEW.width - 54},${PLAN_VIEW.height - 34}`}
          fill={CS.textSecondary}
        />
        <text x={PLAN_VIEW.width - 46} y={PLAN_VIEW.height - 62} textAnchor="middle" fontSize={11} fill={CS.textSecondary} fontFamily={FONTS.mono}>N</text>
      </g>
    </svg>
  );

  // -----------------------------------------------------------------------
  // The section presentation (cutaway at the LIVE cut plane).
  // -----------------------------------------------------------------------
  const sectionCanvas = (
    <svg
      data-testid="cs-section-canvas"
      data-viewport-canvas="section"
      data-cut-x={props.sectionCutX}
      viewBox={`0 0 ${SECTION_VIEW.width} ${SECTION_VIEW.height}`}
      style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        // The same letterbox-aware content-box mapping as the plan canvas
        // (preserveAspectRatio "meet" — the section content box, not the
        // raw element box).
        const scale = Math.min(bounds.width / SECTION_VIEW.width, bounds.height / SECTION_VIEW.height);
        const offsetX = (bounds.width - SECTION_VIEW.width * scale) / 2;
        const offsetY = (bounds.height - SECTION_VIEW.height * scale) / 2;
        const px = (event.clientX - bounds.left - offsetX) / scale;
        const py = (event.clientY - bounds.top - offsetY) / scale;
        const hit = sectionEntityAt(props.presented, sectionProjector, { x: px, y: py }, props.sectionCutX);
        props.onPresentedPick(hit?.geometry.entityId ?? null);
      }}
    >
      <rect x={0} y={0} width={SECTION_VIEW.width} height={SECTION_VIEW.height} fill={CS.viewportGround} />
      {/* The ground line. */}
      <line
        x1={sectionProjector.px(sectionProjector.bounds.minX)}
        y1={sectionProjector.py(0)}
        x2={sectionProjector.px(sectionProjector.bounds.maxX)}
        y2={sectionProjector.py(0)}
        stroke={CS.borderStrong}
        strokeWidth={1.4}
      />
      {/* The elevation gridlines + level labels. */}
      {(() => {
        const levels: ReactNode[] = [];
        const yMin = Math.max(0, Math.floor(sectionProjector.bounds.minY));
        const yMax = Math.ceil(sectionProjector.bounds.maxY);
        for (let level = yMin; level <= yMax; level += 1) {
          const y = sectionProjector.py(level);
          if (y < 30 || y > SECTION_VIEW.height - 8) continue;
          levels.push(
            <g key={`level-${level}`} data-cs-level={level}>
              <line x1={64} y1={y} x2={SECTION_VIEW.width - 26} y2={y} stroke={level === 0 ? CS.borderStrong : CS.border} strokeWidth={level === 0 ? 1.4 : 0.6} strokeDasharray={level === 0 ? undefined : '3 4'} opacity={level === 0 ? 1 : 0.6} />
              <text x={16} y={y + 3.5} fontSize={9.5} fill={CS.textMuted} fontFamily={FONTS.mono}>
                {level === 0 ? '±0.00' : `+${level.toFixed(2)}`}
              </text>
            </g>,
          );
        }
        return <g>{levels}</g>;
      })()}
      {/* The cut entities (phase-gated, variant-applied, layer-colored). */}
      {sectionDrawOrder(props.presented, props.sectionCutX).map((entity) => {
        if (!visibleInWorld(entity)) return null;
        const [, y, z] = entity.geometry.position;
        const [, by, bz] = entity.geometry.bbox;
        const left = sectionProjector.px(z - bz / 2);
        const top = sectionProjector.py(y + by / 2);
        const bottom = sectionProjector.py(y - by / 2);
        const rect = {
          x: left,
          y: top,
          width: Math.max(2, bz * sectionProjector.scale),
          height: Math.max(2, Math.abs(bottom - top)),
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
              rx={Math.min(3, rect.height / 4)}
              fill={isBuilt ? color.fill : 'none'}
              stroke={selected ? CS.selection : isHighlighted ? CS.boq : isBuilt ? color.stroke : CS.borderStrong}
              strokeWidth={selected ? 3 : isHighlighted ? 2.5 : 1.3}
              strokeDasharray={isBuilt ? undefined : '4 4'}
            />
            {entity.state === 'added' ? (
              <rect x={rect.x - 3} y={rect.y - 3} width={rect.width + 6} height={rect.height + 6} rx={5} fill="none" stroke={CS.success} strokeWidth={1.6} strokeDasharray="5 4" />
            ) : null}
            {rect.width > 30 && rect.height > 14 ? (
              <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2 + 3} textAnchor="middle" fontSize={9} fill={CS.textSecondary} fontFamily={FONTS.sans} pointerEvents="none">
                {entity.projection.label.slice(0, Math.max(2, Math.floor(rect.width / 5.4)))}
              </text>
            ) : null}
          </g>
        );
      })}
      {/* The cut-plane label. */}
      <text x={SECTION_VIEW.width - 26} y={24} textAnchor="end" fontSize={10} fill={CS.danger} fontFamily={FONTS.mono}>
        SECTION A–A · cut x={props.sectionCutX >= 0 ? '+' : ''}{props.sectionCutX.toFixed(2)}m · view toward −X
      </text>
    </svg>
  );

  const navigation = viewport.navigation;
  const navigationHud = (
    <g data-viewport-hud="">
      <rect x={12} y={CHROME_VIEW.height - 92} width={322} height={80} rx={8} fill={CS.surfaceRaised} fillOpacity={0.92} stroke={CS.border} />
      <text x={24} y={CHROME_VIEW.height - 71} fontSize={11} fill={CS.text} fontFamily={FONTS.mono}>
        Camera {viewport.cameraMode} · orbit {degrees(navigation.azimuthRad)}° / {degrees(navigation.elevationRad)}° · d {navigation.distance.toFixed(1)}u
      </text>
      <text x={24} y={CHROME_VIEW.height - 54} fontSize={10} fill={CS.textMuted} fontFamily={FONTS.mono}>
        anchor ({navigation.target.map((v) => v.toFixed(1)).join(', ')})
      </text>
      <text x={24} y={CHROME_VIEW.height - 37} fontSize={10} fill={CS.textMuted} fontFamily={FONTS.mono}>
        drag orbit · shift-drag pan · wheel zoom · WASD/QE/RF/+- keys
      </text>
    </g>
  );

  return (
    <section
      data-viewport="world"
      data-workspace-primary=""
      data-health={props.health.state}
      data-fallback-applied={props.fallbackApplied ? 'true' : 'false'}
      data-spatial-overlay={props.spatialOverlay ?? 'reference'}
      data-testid="cs-world-viewport"
      role="application"
      aria-label={`Construction world viewport — ${viewport.sceneName}`}
      tabIndex={0}
      onKeyDown={(event) => {
        props.handlers.onNavigationKey(event.key);
      }}
      onWheel={(event) => {
        props.handlers.onViewportWheel({ x: event.deltaX, y: event.deltaY });
      }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        background: CS.viewportGround,
        border: `1px solid ${CS.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        outline: 'none',
        cursor: viewMode === '3d' ? 'crosshair' : 'default',
        containerType: 'size',
      }}
    >
      {/* The REAL ENGINE STAGE (the host's GL canvases), a centered square
          that fits the region (container-query units keep it unclipped).
          The stage subtree stays MOUNTED across view-mode changes (hidden
          by CSS in plan/section): React would otherwise re-create the
          canvases and the engines' GL binding — made to the canvas live at
          the session's first mount — would be left rendering into a
          detached canvas (the blank-3D-after-plan defect). */}
      {props.engineStage === undefined || props.engineStage === null ? null : (
        <div
          data-engine-stage-mount=""
          style={
            viewMode === '3d'
              ? { display: 'contents' }
              : { display: 'none' }
          }
        >
          {props.engineStage}
        </div>
      )}

      {/* The 3D chrome overlay (banner, glyphs when no engine presents,
          overlays, deltas, agents, the navigation HUD). */}
      {viewMode === '3d' ? (
        <svg
          data-testid="cs-world-chrome"
          data-viewport-canvas={props.spatialOverlay ?? 'reference'}
          viewBox={`0 0 ${CHROME_VIEW.width} ${CHROME_VIEW.height}`}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
          onPointerDown={(event) => {
            const boundsElement = props.pointerBounds?.current ?? event.currentTarget;
            const bounds = boundsElement.getBoundingClientRect();
            props.handlers.onViewportPointerDown({
              x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
              y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
            });
          }}
        >
          {/* The renderer/world banner (Epoch-owned chrome). */}
          <text data-viewport-world-digest="" x={14} y={24} fontSize={11} fill={CS.textSecondary} fontFamily={FONTS.mono}>
            {viewport.sceneName} · {viewport.tenantId} · world {shortDigest(viewport.worldDigest)}
          </text>
          {referenceOverlay ? (
            <>
              {referenceGlyphs}
              {overlayChrome}
            </>
          ) : (
            overlayChrome
          )}
          {deltaBadges}
          {offscreenRail}
          {/* Agent presence markers at their interpolated positions. */}
          {props.agents.map(({ agentId, label, followed }) => {
            const fixtureAgent = SOLUTION_AGENT_POSITIONS.get(agentId);
            if (fixtureAgent === undefined) return null;
            const position = agentPositionAt(fixtureAgent, timeline.positionAtMs);
            const projected = projectPoint(
              {
                target: [
                  viewport.navigation.target[0],
                  viewport.navigation.target[1],
                  viewport.navigation.target[2],
                ],
                azimuthRad: viewport.navigation.azimuthRad,
                elevationRad: viewport.navigation.elevationRad,
                distance: viewport.navigation.distance,
                fovRadians: viewport.navigation.fovRadians,
              },
              position,
            );
            if (!projected.inFrustum || projected.depth <= 0.0001) return null;
            const point = chromePoint(projected);
            return (
              <g key={agentId} data-cs-agent={agentId} data-followed={followed ? 'true' : 'false'}>
                {followed ? <circle cx={point.x} cy={point.y} r={15} fill="none" stroke={CS.accent} strokeWidth={2.5} /> : null}
                <circle cx={point.x} cy={point.y} r={7} fill={followed ? CS.accent : CS.text} stroke={CS.surfaceRaised} strokeWidth={2} />
                <rect x={point.x + 10} y={point.y - 24} width={Math.min(200, 24 + label.length * 5.4)} height={20} rx={5} fill={CS.surfaceRaised} stroke={CS.border} />
                <text x={point.x + 16} y={point.y - 10} fontSize={10} fill={CS.text} fontFamily={FONTS.sans}>
                  {label}
                </text>
              </g>
            );
          })}
          {navigationHud}
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
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4,
            background: CS.surfaceRaised,
            border: `1px solid ${CS.borderStrong}`,
            borderRadius: 999,
            padding: '3px 14px',
            fontSize: CS_TYPE.sizeXxs,
            fontFamily: FONTS.mono,
            color: CS.textSecondary,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
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
            top: 44,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(250, 248, 244, 0.94)',
            border: `1px solid ${CS.border}`,
            borderRadius: 999,
            padding: '2px 8px',
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
            style={{ padding: '1px 9px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXs, fontFamily: FONTS.mono, cursor: 'pointer' }}
          >
            −
          </button>
          <span data-testid="cs-section-cut-value" style={{ minWidth: 84, textAlign: 'center' }}>
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
            style={{ padding: '1px 9px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXs, fontFamily: FONTS.mono, cursor: 'pointer' }}
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
            style={{ padding: '1px 8px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textMuted, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}
          >
            Reset
          </button>
          <span style={{ color: CS.textMuted }}>
            [{props.sectionCutRange.minX.toFixed(1)} … {props.sectionCutRange.maxX.toFixed(1)}]m
          </span>
        </div>
      ) : null}

      {/* The view-controls HUD (top-right floating; the reset routes
          through the driver's resetNavigation — the canonical camera). */}
      <div
        data-viewport-controls=""
        data-testid="cs-view-controls"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 4, display: 'flex', gap: 4, alignItems: 'center' }}
      >
        <button
          type="button"
          data-testid="viewport-reset-camera"
          onClick={(event) => {
            event.stopPropagation();
            props.handlers.onResetNavigation();
          }}
          style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontWeight: 600, fontFamily: FONTS.sans, cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      {/* The tool/measure-state chip (top-left, under the banner). */}
      <div
        data-testid="cs-tool-state"
        data-active-tool={viewport.activeTool}
        style={{
          position: 'absolute',
          top: 34,
          left: 10,
          zIndex: 4,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '52%',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: CS_TYPE.sizeXxs,
            padding: '1px 8px',
            borderRadius: 999,
            border: `1px solid ${CS.accentBorder}`,
            background: CS.accentDim,
            color: CS.accent,
          }}
        >
          {viewport.activeTool}
        </span>
        {props.measureHint === null ? null : (
          <span
            data-testid="cs-measure-hint"
            style={{
              fontFamily: FONTS.mono,
              fontSize: CS_TYPE.sizeXxs,
              padding: '1px 8px',
              borderRadius: 999,
              border: `1px solid ${CS.border}`,
              background: 'rgba(250, 248, 244, 0.94)',
              color: CS.textSecondary,
            }}
          >
            {props.measureHint}
          </span>
        )}
      </div>

      {/* The live-metrics HUD (bottom-left floating; sits above the timeline). */}
      <div
        data-testid="cs-metrics"
        style={{
          position: 'absolute',
          left: 10,
          bottom: 74,
          zIndex: 4,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '72%',
          background: 'rgba(250, 248, 244, 0.94)',
          border: `1px solid ${CS.border}`,
          borderRadius: 8,
          padding: '5px 10px',
          fontFamily: FONTS.mono,
          fontSize: CS_TYPE.sizeXxs,
          color: CS.textSecondary,
        }}
      >
        <span>
          <strong style={{ color: CS.text }}>{props.activePhase.label}</strong> · built{' '}
          {props.presented.filter((entity) => visibleInWorld(entity) && built(entity)).length}/{props.presented.length}
        </span>
        <span>digest {shortDigest(viewport.worldDigest)}</span>
        <span data-testid="cs-metrics-variant">{props.variantId}</span>
      </div>

      {/* The renderer-health / failure banner. */}
      {props.failure === null ? null : (
        <div
          data-viewport-failure=""
          data-failure-code={props.failure.code}
          role="alert"
          style={{
            position: 'absolute',
            left: 10,
            top: 60,
            zIndex: 5,
            maxWidth: 380,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: CS_TYPE.sizeXs,
            color: '#7f1d1d',
          }}
        >
          {props.fallbackApplied ? 'Fallback applied — ' : ''}
          {props.failure.message}
        </div>
      )}

      {/* The timeline HUD (bottom, full-width floating scrubber). */}
      <div data-testid="cs-timeline" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 4 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <span data-testid="timeline-position" style={{ fontFamily: FONTS.mono, fontSize: CS_TYPE.sizeXs, color: CS.text, fontWeight: 600 }}>
            {formatMs(timeline.positionAtMs)} / {formatMs(timeline.trackEndMs)}
          </span>
          {timeline.paused ? (
            <span data-testid="timeline-paused" style={{ fontSize: CS_TYPE.sizeXxs, color: CS.warn }}>paused</span>
          ) : (
            <span data-testid="timeline-playing" style={{ fontSize: CS_TYPE.sizeXxs, color: CS.success }}>playing</span>
          )}
          <span data-testid="cs-timeline-phase" style={{ fontFamily: FONTS.sans, fontSize: CS_TYPE.sizeXxs, color: CS.accent, fontWeight: 600 }}>
            {props.activePhase.label}
          </span>
          {timeline.paused ? (
            <button type="button" data-testid="timeline-resume" onClick={(event) => { event.stopPropagation(); props.handlers.onTimelineResume(); }} style={{ padding: '1px 9px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}>
              Resume
            </button>
          ) : (
            <button type="button" data-testid="timeline-pause" onClick={(event) => { event.stopPropagation(); props.handlers.onTimelinePause(); }} style={{ padding: '1px 9px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}>
              Pause
            </button>
          )}
          {SOLUTION_PHASES.map((phase) => (
            <button
              key={phase.phaseId}
              type="button"
              data-testid={`cs-phase-${phase.phaseId}`}
              aria-pressed={props.activePhase.phaseId === phase.phaseId}
              title={`${phase.label} @ ${formatMs(phase.atMs)}`}
              onClick={(event) => {
                event.stopPropagation();
                props.handlers.onTimelineScrub(phase.atMs);
              }}
              style={{
                padding: '1px 7px',
                borderRadius: 999,
                border: `1px solid ${props.activePhase.phaseId === phase.phaseId ? CS.accentBorder : CS.border}`,
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
          data-testid="timeline-track"
          role="slider"
          aria-label="Construction programme position"
          aria-valuenow={timeline.positionAtMs}
          aria-valuemin={timeline.trackStartMs}
          aria-valuemax={timeline.trackEndMs}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              const step = span / 50;
              const direction = event.key === 'ArrowLeft' ? -1 : 1;
              props.handlers.onTimelineScrub(timeline.positionAtMs + direction * step);
            }
          }}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
            props.handlers.onTimelineScrub(timeline.trackStartMs + fraction * span);
          }}
          style={{
            position: 'relative',
            height: 26,
            background: 'rgba(250, 248, 244, 0.92)',
            border: `1px solid ${CS.border}`,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {timeline.markers.map((marker) => {
            const left = ((marker.atMs - timeline.trackStartMs) / span) * 100;
            return (
              <span
                key={marker.markerId}
                data-marker={marker.markerId}
                data-marker-kind={marker.markerKind}
                title={`${marker.label ?? marker.markerId} @ ${formatMs(marker.atMs)}`}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: marker.markerKind === 'branch-point' ? 2 : 14,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: marker.markerKind === 'branch-point' ? CS.accent : CS.textMuted,
                }}
              />
            );
          })}
          <span
            data-testid="timeline-presentation-head"
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, ((timeline.presentationAtMs - timeline.trackStartMs) / span) * 100))}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: CS.borderStrong,
            }}
          />
          <span
            data-testid="timeline-cursor"
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, ((timeline.positionAtMs - timeline.trackStartMs) / span) * 100))}%`,
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

