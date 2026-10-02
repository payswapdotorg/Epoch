/**
 * The WORLD VIEWPORT (W057) — the PRIMARY workspace surface: a
 * renderer-agnostic spatial projection of the canonical scene entities.
 *
 * The active presenter is mounted BEHIND this component through the
 * RendererFabric seam. What renders HERE depends on the presenter class
 * (W061):
 *
 * - `spatialOverlay="reference"` (the contract-only reference presenter):
 *   the structured spatial SVG canvas of the presenter's projection —
 *   entity glyphs at their projected viewport positions (NDC),
 *   focus/isolation/visibility state, applied overlays (measurements,
 *   annotations, highlights), agent presence markers, the navigation HUD
 *   (orbit/pan/zoom + desktop keys), and the renderer health/fallback
 *   banner.
 * - `spatialOverlay="engine"` (a REAL engine presenter — W058 Three.js /
 *   W059 Babylon.js): the `engineStage` layer renders the engine's REAL
 *   pixels (the injected GL canvas of the active adapter) behind this
 *   chrome, and the engine itself presents the spatial world (its own
 *   scene graph carries the entity meshes, overlays, focus decorations
 *   and agent representations — see the adapter docs). The SVG then
 *   renders ONLY the non-positional chrome: the world-digest banner, the
 *   navigation HUD, presence chips and the health/failure banners — the
 *   engine's projection is the spatial truth, so the reference projection
 *   (a DIFFERENT camera convention by design — Z-up vs the engine's own)
 *   never draws beside it.
 *
 * Pointer input normalizes against the `pointerBounds` element when one is
 * supplied (the engine stage — the square region the engines present
 * under aspect 1), else the SVG canvas itself. The normalized pointer is
 * dispatched through the fabric seam: the ACTIVE adapter hit-tests it
 * (Raycaster / Babylon scene.pick) into the semantic entity id — the
 * engine never receives DOM events directly.
 *
 * Pure presentational component: a function of its props, no hooks, no
 * client state; the host wires the handlers (workspace-handlers.ts).
 */
import type { ReactNode, RefObject } from 'react';
import type {
  NavigationStateInput,
  ViewportAgentInput,
  ViewportEntityInput,
  ViewportOverlayInput,
  ViewportViewModelInput,
} from '../workspace-contracts';
import { normalizePointer, type WorkspaceHandlers } from '../workspace-handlers';

/** The viewport's fixed projection space (viewBox coordinates). */
const VIEWBOX = { width: 1000, height: 640 } as const;

/** Map one NDC coordinate into the viewBox (y is inverted: NDC +y is up). */
function toViewBox(ndc: { readonly x: number; readonly y: number }): { x: number; y: number } {
  return {
    x: Math.round(((ndc.x + 1) / 2) * VIEWBOX.width),
    y: Math.round(((1 - ndc.y) / 2) * VIEWBOX.height),
  };
}

/** Shorten a digest for display. */
function shortDigest(digest: string | null): string {
  if (digest === null) {
    return '—';
  }
  return digest.length > 12 ? `${digest.slice(0, 12)}…` : digest;
}

function degrees(radians: number): number {
  return Math.round((radians * 180) / Math.PI);
}

/** One entity glyph: the spatial presentation of one canonical entity. */
function EntityGlyph({
  entity,
}: {
  readonly entity: ViewportEntityInput;
}): ReactNode {
  if (entity.ndc === null) {
    // Behind the eye or outside the frustum: an edge marker (no false
    // spatial claim — the label names the canonical entity).
    return (
      <li
        data-viewport-entity={entity.entityId}
        data-entity-state="offscreen"
        style={{ listStyle: 'none' }}
      >
        <span aria-hidden="true">◇</span> {entity.label} <small>(outside view)</small>
      </li>
    );
  }
  const point = toViewBox(entity.ndc);
  const state = !entity.visible
    ? 'hidden'
    : entity.isolated
      ? 'isolated'
      : entity.focused
        ? 'focused'
        : 'visible';
  return (
    <g
      data-viewport-entity={entity.entityId}
      data-entity-state={state}
      data-entity-depth={entity.depth === null ? 'n/a' : String(Math.round(entity.depth))}
      transform={`translate(${point.x} ${point.y})`}
    >
      {entity.focused ? (
        <circle r={26} fill="none" stroke="#b45309" strokeWidth={3} data-focus-ring="" />
      ) : null}
      {entity.isolated ? (
        <rect x={-22} y={-22} width={44} height={44} rx={8} fill="none" stroke="#1d4ed8" strokeWidth={3} data-isolation-frame="" />
      ) : null}
      <rect
        x={-16}
        y={-16}
        width={32}
        height={32}
        rx={6}
        fill={entity.visible ? '#e7e5e4' : '#f5f5f4'}
        stroke={entity.visible ? '#57534e' : '#d6d3d1'}
        strokeWidth={1.5}
        opacity={entity.visible ? 1 : 0.45}
      />
      <text y={34} textAnchor="middle" fontSize={12} fill="#1c1917">
        {entity.label}
      </text>
      <text y={48} textAnchor="middle" fontSize={10} fill="#78716c">
        {entity.entityType}
      </text>
    </g>
  );
}

/** One measurement overlay: a ruled line between two projected entities. */
function MeasurementOverlay({
  overlay,
  entities,
}: {
  readonly overlay: ViewportOverlayInput;
  readonly entities: readonly ViewportEntityInput[];
}): ReactNode {
  const from = entities.find((entity) => entity.entityId === overlay.fromEntityId);
  const to = entities.find((entity) => entity.entityId === overlay.toEntityId);
  if (from?.ndc === null || from?.ndc === undefined || to?.ndc === null || to?.ndc === undefined) {
    return null;
  }
  const a = toViewBox(from.ndc);
  const b = toViewBox(to.ndc);
  const midpoint = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2 - 12) };
  const distance =
    from.position !== undefined && to.position !== undefined
      ? Math.hypot(
          to.position[0] - from.position[0],
          to.position[1] - from.position[1],
          to.position[2] - from.position[2],
        )
      : null;
  return (
    <g data-viewport-overlay={overlay.overlayId} data-overlay-kind="measurement">
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#b45309"
        strokeWidth={2}
        strokeDasharray="8 5"
        markerStart=""
      />
      <circle cx={a.x} cy={a.y} r={4} fill="#b45309" />
      <circle cx={b.x} cy={b.y} r={4} fill="#b45309" />
      <text x={midpoint.x} y={midpoint.y} textAnchor="middle" fontSize={12} fill="#7c2d12">
        {overlay.label ?? 'Measurement'}
        {distance === null ? '' : ` · ${distance.toFixed(1)}u`}
      </text>
    </g>
  );
}

/** One annotation overlay: a pinned note on one projected entity. */
function AnnotationOverlay({
  overlay,
  entities,
}: {
  readonly overlay: ViewportOverlayInput;
  readonly entities: readonly ViewportEntityInput[];
}): ReactNode {
  const target = entities.find((entity) => entity.entityId === overlay.entityId);
  if (target?.ndc === null || target?.ndc === undefined) {
    return null;
  }
  const point = toViewBox(target.ndc);
  return (
    <g data-viewport-overlay={overlay.overlayId} data-overlay-kind="annotation">
      <line x1={point.x} y1={point.y - 18} x2={point.x} y2={point.y - 46} stroke="#7c2d12" strokeWidth={1.5} />
      <rect
        x={Math.min(point.x - 120, VIEWBOX.width - 250)}
        y={point.y - 92}
        width={240}
        height={46}
        rx={6}
        fill="#fffbeb"
        stroke="#d97706"
      />
      <text
        x={Math.min(point.x - 120, VIEWBOX.width - 250) + 10}
        y={point.y - 72}
        fontSize={11}
        fill="#78350f"
      >
        {overlay.text?.slice(0, 34)}
      </text>
    </g>
  );
}

/** One highlight overlay: a tinted ring on one projected entity. */
function HighlightOverlay({
  overlay,
  entities,
}: {
  readonly overlay: ViewportOverlayInput;
  readonly entities: readonly ViewportEntityInput[];
}): ReactNode {
  const target = entities.find((entity) => entity.entityId === overlay.entityId);
  if (target?.ndc === null || target?.ndc === undefined) {
    return null;
  }
  const point = toViewBox(target.ndc);
  return (
    <g data-viewport-overlay={overlay.overlayId} data-overlay-kind={overlay.overlayKind}>
      <circle cx={point.x} cy={point.y} r={30} fill="none" stroke={overlay.color ?? '#d97706'} strokeWidth={4} opacity={0.85} />
    </g>
  );
}

/** The agent presence markers (visible presence — followable). */
function PresenceMarkers({
  agents,
}: {
  readonly agents: readonly ViewportAgentInput[];
}): ReactNode {
  if (agents.length === 0) {
    return null;
  }
  return (
    <g data-viewport-presence="">
      {agents.map((agent, index) => {
        const y = 24 + index * 34;
        return (
          <g key={agent.agentId} data-presence-agent={agent.agentId} data-agent-followed={agent.followed ? 'true' : 'false'}>
            <rect x={VIEWBOX.width - 262} y={y} width={248} height={26} rx={13} fill={agent.followed ? '#44403c' : '#f5f5f4'} stroke="#a8a29e" />
            <circle cx={VIEWBOX.width - 246} cy={y + 13} r={7} fill={agent.followed ? '#fafaf9' : '#78716c'} />
            <text x={VIEWBOX.width - 232} y={y + 17} fontSize={12} fill={agent.followed ? '#fafaf9' : '#1c1917'}>
              {agent.agentId}
              {agent.followed ? ' · following' : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** The navigation HUD: the presentation camera + the desktop key legend. */
function NavigationHud({
  navigation,
  cameraMode,
}: {
  readonly navigation: NavigationStateInput;
  readonly cameraMode: string;
}): ReactNode {
  return (
    <g data-viewport-hud="">
      <rect x={12} y={VIEWBOX.height - 96} width={330} height={84} rx={8} fill="#ffffff" fillOpacity={0.92} stroke="#e2e0da" />
      <text x={24} y={VIEWBOX.height - 74} fontSize={12} fill="#1c1917">
        Camera {cameraMode} · orbit {degrees(navigation.azimuthRad)}° / {degrees(navigation.elevationRad)}° · d{' '}
        {navigation.distance.toFixed(1)}u
      </text>
      <text x={24} y={VIEWBOX.height - 56} fontSize={11} fill="#78716c">
        anchor ({navigation.target.map((v) => v.toFixed(1)).join(', ')})
      </text>
      <text x={24} y={VIEWBOX.height - 38} fontSize={11} fill="#a8a29e">
        drag orbit · shift-drag pan · wheel zoom · WASD/QE/RF/+- keys
      </text>
    </g>
  );
}

/** The renderer health/fallback banner (Epoch-owned chrome). */
function HealthBanner({
  viewport,
}: {
  readonly viewport: ViewportViewModelInput;
}): ReactNode {
  return (
    <text
      data-viewport-world-digest=""
      x={12}
      y={26}
      fontSize={12}
      fill="#57534e"
      fontFamily="ui-monospace, monospace"
    >
      {viewport.sceneName} · {viewport.tenantId} · world {shortDigest(viewport.worldDigest)}
    </text>
  );
}

/** The viewport props. */
export interface WorldViewportProps {
  readonly viewport: ViewportViewModelInput;
  readonly health: { readonly state: string; readonly detail?: string | undefined };
  readonly fallbackApplied: boolean;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly handlers: WorkspaceHandlers;
  /**
   * The engine stage layer rendered BEHIND the spatial overlay (W061): the
   * REAL engine pixels of the active presenter. Absent in reference mode.
   */
  readonly engineStage?: ReactNode | undefined;
  /**
   * Which surface presents the SPATIAL world: the reference projection
   * (this SVG) or the REAL engine (the engineStage layer; the SVG keeps
   * only non-positional chrome). Defaults to 'reference'.
   */
  readonly spatialOverlay?: 'reference' | 'engine' | undefined;
  /**
   * The element pointer input normalizes against (the engine stage in
   * engine mode — the square region both engines present under aspect 1).
   * Defaults to the SVG canvas itself (reference mode).
   */
  readonly pointerBounds?: RefObject<HTMLElement | null> | undefined;
}

/**
 * The world viewport. The input surface reports pointer/wheel/key events
 * through the handlers (normalized into the fabric seam or the
 * presentation-only navigation state); the spatial world is presented by
 * the active presenter (the engine stage's real pixels in engine mode, the
 * structured SVG projection in reference mode).
 */
export function WorldViewport({
  viewport,
  health,
  fallbackApplied,
  failure,
  handlers,
  engineStage,
  spatialOverlay = 'reference',
  pointerBounds,
}: WorldViewportProps): ReactNode {
  const referenceOverlay = spatialOverlay === 'reference';
  return (
    <div
      data-viewport="world"
      data-health={health.state}
      data-fallback-applied={fallbackApplied ? 'true' : 'false'}
      data-spatial-overlay={spatialOverlay}
      role="application"
      aria-label={`Interactive world viewport — ${viewport.sceneName}`}
      tabIndex={0}
      onKeyDown={(event) => {
        handlers.onNavigationKey(event.key);
      }}
      onWheel={(event) => {
        handlers.onViewportWheel({ x: event.deltaX, y: event.deltaY });
      }}
      style={{
        position: 'relative',
        background: '#fafaf9',
        border: '1px solid #e2e0da',
        borderRadius: 10,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* The REAL ENGINE STAGE (W061): the active presenter's GL pixels,
          centered and square (both engines present under aspect 1). */}
      {engineStage}
      <svg
        data-viewport-canvas={spatialOverlay}
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          userSelect: 'none',
          position: engineStage === undefined ? undefined : 'relative',
          zIndex: engineStage === undefined ? undefined : 1,
        }}
        onPointerDown={(event) => {
          const boundsElement = pointerBounds?.current ?? event.currentTarget;
          const bounds = boundsElement.getBoundingClientRect();
          handlers.onViewportPointerDown(
            normalizePointer(
              { width: bounds.width, height: bounds.height },
              { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
            ),
          );
        }}
      >
        <HealthBanner viewport={viewport} />
        {/* The reference presenter's spatial projection (position glyphs,
            overlays, ground grid) — suppressed when a REAL engine presents
            the spatial world (its scene graph carries all of these). */}
        {referenceOverlay ? (
          <>
            {/* The spatial ground grid (presentation-only, no semantic claim). */}
            <g data-viewport-grid="" opacity={0.35}>
              {[0, 1, 2, 3, 4].map((row) =>
                [0, 1, 2, 3, 4].map((column) => (
                  <rect
                    key={`${row}-${column}`}
                    x={150 + column * 130}
                    y={140 + row * 74}
                    width={118}
                    height={62}
                    rx={6}
                    fill="none"
                    stroke="#d6d3d1"
                    strokeDasharray="3 6"
                  />
                )),
              )}
            </g>
            {viewport.overlays.map((overlay) => {
              if (overlay.overlayKind === 'measurement') {
                return <MeasurementOverlay key={overlay.overlayId} overlay={overlay} entities={viewport.entities} />;
              }
              if (overlay.overlayKind === 'annotation') {
                return <AnnotationOverlay key={overlay.overlayId} overlay={overlay} entities={viewport.entities} />;
              }
              return <HighlightOverlay key={overlay.overlayId} overlay={overlay} entities={viewport.entities} />;
            })}
            {viewport.entities.map((entity) => (
              <EntityGlyph key={entity.entityId} entity={entity} />
            ))}
          </>
        ) : null}
        <PresenceMarkers agents={viewport.agents} />
        <NavigationHud navigation={viewport.navigation} cameraMode={viewport.cameraMode} />
      </svg>
      {failure === null ? null : (
        <div
          data-viewport-failure=""
          data-failure-code={failure.code}
          role="alert"
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            maxWidth: 480,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#7f1d1d',
          }}
        >
          {fallbackApplied ? 'Fallback applied — ' : ''}
          {failure.message}
        </div>
      )}
      {/* The navigation affordances (buttons — keyboard focus already routes
          through the viewport's own key handling). */}
      <div
        data-viewport-controls=""
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          display: 'flex',
          gap: 6,
        }}
      >
        <button
          type="button"
          data-testid="viewport-reset-camera"
          onClick={() => handlers.onResetNavigation()}
          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d6d3d1', background: '#ffffff', cursor: 'pointer' }}
        >
          Reset camera
        </button>
      </div>
    </div>
  );
}
