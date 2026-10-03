'use client';

/**
 * W057 — the desktop WORLD HOST: the interactive spatial world as the
 * PRIMARY problem-solving surface of the desktop product (the journey
 * sections become secondary context around it).
 *
 * The section wires the REAL workspace stack — the contract-only
 * reference presenter behind the REAL RendererFabric seam (the same
 * mount W058/W059's engines occupy) driven by the REAL
 * @epoch/world-runtime WorldWorkspaceRuntime:
 *
 * - the WALL-CLOCK HOST LOOP runs HERE (SystemHostClock +
 *   TimeoutFrameScheduler; the fabric core stays virtual-time-only);
 * - every interaction routes through the runtime's command surface — raw
 *   pointer/wheel input goes through the fabric seam (semantic picking →
 *   EXISTING typed epoch.world.interaction intents), workspace commands
 *   compose the same typed vocabulary;
 * - the spatial viewport is the PRIMARY region (entity glyphs at their
 *   projected positions, focus/isolation/visibility state, overlays,
 *   agent presence, the navigation HUD, the renderer health banner) with
 *   inspect/layers/presence/renderer/timeline/journal as secondary
 *   panels.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SystemHostClock,
  TimeoutFrameScheduler,
  WorldWorkspaceRuntime,
  type WorldTool,
  type WorldWorkspaceInput,
  type WorkspaceViewModel,
} from '@epoch/world-runtime';
import { ThreeJsRendererAdapter, THREE_RENDERER_ID } from '@epoch/adapter-renderer-threejs';
import { BabylonRendererAdapter, BABYLONJS_RENDERER_ID } from '@epoch/adapter-renderer-babylonjs';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  ErrorCard,
  GuidanceCard,
  Mono,
  Panel,
} from '../ui-kit';
import { COLORS, FONTS, RADII, SPACE, TYPE } from '../ui-tokens';
import {
  ENGINE_CANVAS_SIZE,
  webBabylonEngineHost,
  webThreeSurfaceFactory,
} from '../world-host/browser-gl';
import {
  BRANCH_AT_MS,
  DEVICE,
  ONTOLOGY,
  RENDERER_PREFERENCE,
  SCENE,
  buildWorldFabric,
  isEngineRenderer,
} from '../world-host/world-fixture';

type ComposePhase =
  | { readonly phase: 'composing' }
  | { readonly phase: 'ready' }
  | { readonly phase: 'failed'; readonly message: string };

/** The viewport's fixed projection space (viewBox coordinates). */
const VIEWBOX = { width: 1000, height: 620 } as const;

/** Map one NDC coordinate into the viewBox (NDC +y is up). */
function toViewBox(ndc: { readonly x: number; readonly y: number }): { x: number; y: number } {
  return {
    x: Math.round(((ndc.x + 1) / 2) * VIEWBOX.width),
    y: Math.round(((1 - ndc.y) / 2) * VIEWBOX.height),
  };
}

/** Normalize one pixel position into the viewport's [0,1] pointer space. */
function normalizePointer(
  bounds: { readonly width: number; readonly height: number },
  pixel: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0.5, y: 0.5 };
  }
  return {
    x: Math.min(1, Math.max(0, pixel.x / bounds.width)),
    y: Math.min(1, Math.max(0, pixel.y / bounds.height)),
  };
}

/** The desktop world host section (the primary workspace surface). */
export function WorldSection(): ReactNode {
  const [phase, setPhase] = useState<ComposePhase>({ phase: 'composing' });
  const [view, setView] = useState<WorkspaceViewModel | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [glLive, setGlLive] = useState<{ readonly three: boolean; readonly babylon: boolean }>({
    three: false,
    babylon: false,
  });
  const runtimeRef = useRef<WorldWorkspaceRuntime | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const babylonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Compose the workspace ONCE per mount (client-side only — the static
  // export prerenders the composing state), then run the host loop. The
  // REAL renderers (W061: Three.js first, Babylon.js second, the reference
  // pair as the declared fallback chain) register behind the REAL fabric;
  // the engines' GL objects are constructed over the section's canvases
  // ONLY here, in the webview (SSR composes no engine state).
  useEffect(() => {
    let cancelled = false;
    const threeSurface = webThreeSurfaceFactory(threeCanvasRef.current);
    const babylonSurface = webBabylonEngineHost(babylonCanvasRef.current);
    const { fabric } = buildWorldFabric({
      three: new ThreeJsRendererAdapter({ surfaceFactory: threeSurface.factory }),
      babylon: new BabylonRendererAdapter({ host: babylonSurface.host }),
    });
    const runtime = new WorldWorkspaceRuntime({
      slug: 'desktop-world',
      fabric,
      scene: SCENE,
      ontology: ONTOLOGY,
      device: DEVICE,
      clock: new SystemHostClock(),
      scheduler: new TimeoutFrameScheduler(),
      rendererPreference: RENDERER_PREFERENCE,
    } satisfies WorldWorkspaceInput);
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
    };
  }, []);

  /** Run one runtime command, then refresh the view model. */
  const command = useCallback((run: () => Promise<unknown>): void => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    void run()
      .then(() => setView(runtime.viewModel()))
      .catch(() => {
        // Typed failures surface through the runtime's own view model.
        setView(runtime.viewModel());
      });
  }, []);

  /**
   * The in-page foundation path (W067, ACR-010): the imported file's raw
   * bytes go through the runtime's interchange bridge IN THE WEBVIEW (the
   * trust gate: validate → normalize → content-address — the registered
   * glTF bridge, no vendor UI), then the typed `bind` intent applies the
   * binding onto the live session through the fabric operation. Every
   * typed refusal surfaces through the view model (registry, ledger,
   * journal) — nothing throws.
   */
  const onFoundationImport = useCallback((file: { bytes: Uint8Array; fileName: string }): void => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    const imported = runtime.importFoundationAsset(file.bytes, { fileName: file.fileName });
    if (!imported.ok) {
      setView(runtime.viewModel());
      return;
    }
    command(() => runtime.bindFoundationAsset(imported.value.assetDigest));
  }, [command]);

  const fire = (): void => {
    const runtime = runtimeRef.current;
    if (runtime !== null) setView(runtime.viewModel());
  };

  if (phase.phase === 'composing' || view === null) {
    return (
      <Panel title="The world workspace" hint="Mounting the canonical world through the renderer fabric…">
        <BusyIndicator label="Presenting the canonical fixture problem…" />
      </Panel>
    );
  }
  if (phase.phase === 'failed') {
    return (
      <Panel title="The world workspace">
        <ErrorCard
          error={{
            errorClass: 'composition',
            code: 'world-host-failed',
            message: phase.message,
            recoveryAction: 'Reload the section.',
          }}
        />
      </Panel>
    );
  }

  const runtime = runtimeRef.current;
  if (runtime === null) {
    return <GuidanceCard>The world workspace is not mounted.</GuidanceCard>;
  }
  const tool = view.viewport.activeTool;
  const timeline = view.timeline;
  const span = Math.max(1, timeline.trackEndMs - timeline.trackStartMs);
  // The engine stage (W061): when the active presenter is a REAL engine
  // with a live GL surface, its pixels ARE the spatial world (the engine's
  // scene graph carries the entities, overlays and focus decorations) and
  // the SVG keeps only the non-positional chrome; the reference projection
  // renders otherwise (never a blank square presented as a world).
  const activeRendererId = view.renderers.activeRendererId;
  const threeActive = activeRendererId === THREE_RENDERER_ID;
  const babylonActive = activeRendererId === BABYLONJS_RENDERER_ID;
  const engineSpatial =
    isEngineRenderer(activeRendererId) &&
    ((threeActive && glLive.three) || (babylonActive && glLive.babylon));
  const engineStage = (
    <div
      ref={stageRef}
      data-engine-stage=""
      data-testid="desktop-world-engine-stage"
      data-active-renderer={activeRendererId}
      data-gl-three={glLive.three ? 'true' : 'false'}
      data-gl-babylon={glLive.babylon ? 'true' : 'false'}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(100%, ${ENGINE_CANVAS_SIZE}px)`,
        aspectRatio: '1 / 1',
        background: '#0b0f14',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={threeCanvasRef}
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
        ref={babylonCanvasRef}
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

  return (
    <>
      <Panel
        title="The world — the primary workspace"
        hint={`${view.viewport.sceneName} · ${view.viewport.tenantId} · world ${view.viewport.worldDigest.slice(0, 12)}… — picks and commands issue typed epoch.world.interaction intents through the renderer fabric.`}
      >
        <div
          data-testid="desktop-world-viewport"
          data-spatial-overlay={engineSpatial ? 'engine' : 'reference'}
          data-engine-spatial={engineSpatial ? 'true' : 'false'}
          role="application"
          aria-label={`Interactive world viewport — ${view.viewport.sceneName}`}
          tabIndex={0}
          onKeyDown={(event) => {
            const key = event.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '-'].includes(key)) {
              runtime.navigate(key as 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'r' | 'f' | '+' | '-');
              fire();
            }
          }}
          onWheel={(event) => {
            command(() => runtime.dispatchWheel({ x: event.deltaX, y: event.deltaY }));
          }}
          style={{
            position: 'relative',
            background: '#fafaf9',
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADII.lg,
            overflow: 'hidden',
            outline: 'none',
            cursor: 'crosshair',
          }}
        >
          {engineStage}
          <svg
            data-testid="desktop-world-canvas"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', touchAction: 'none', position: 'relative', zIndex: 1 }}
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture?.(event.pointerId);
              // Pointer input normalizes against the ENGINE STAGE when a
              // real engine presents (the square region the engines present
              // under aspect 1), else the SVG canvas itself.
              const bounds = (engineSpatial ? stageRef.current : event.currentTarget)?.getBoundingClientRect()
                ?? event.currentTarget.getBoundingClientRect();
              dragRef.current = { x: event.clientX, y: event.clientY };
              const pointer = normalizePointer(
                { width: bounds.width, height: bounds.height },
                { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
              );
              command(() => runtime.dispatchPointerDown(pointer));
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (drag === null) return;
              const dx = event.clientX - drag.x;
              const dy = event.clientY - drag.y;
              dragRef.current = { x: event.clientX, y: event.clientY };
              // Left-drag orbits; shift/meta/alt-drag pans (presentation-only).
              const kind = event.shiftKey || event.metaKey || event.altKey ? 'pan' : 'orbit';
              runtime.applyGesture({ kind, deltaX: dx * 0.008, deltaY: dy * 0.008 });
              fire();
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            {/* The renderer health + canonical identity banner. */}
            <text x={12} y={24} fontSize={12} fill="#57534e" fontFamily={FONTS.mono}>
              {view.renderers.activeRendererId} · health {view.renderers.health.state} · session{' '}
              {view.renderers.sessionState}
            </text>
            {/* The spatial ground grid (presentation-only). */}
            <g opacity={0.3}>
              {[0, 1, 2, 3].map((row) =>
                [0, 1, 2, 3, 4].map((column) => (
                  <rect
                    key={`${row}-${column}`}
                    x={170 + column * 135}
                    y={150 + row * 85}
                    width={122}
                    height={72}
                    rx={6}
                    fill="none"
                    stroke="#d6d3d1"
                    strokeDasharray="3 6"
                  />
                )),
              )}
            </g>
            {/* Applied overlays: measurement lines + annotation pins. */}
            {view.viewport.overlays.map((overlay) => {
              if (overlay.overlayKind === 'measurement') {
                const from = view.viewport.entities.find((e) => e.entityId === overlay.fromEntityId);
                const to = view.viewport.entities.find((e) => e.entityId === overlay.toEntityId);
                if (from?.ndc == null || to?.ndc == null) return null;
                const a = toViewBox(from.ndc);
                const b = toViewBox(to.ndc);
                return (
                  <g key={overlay.overlayId} data-overlay-kind="measurement">
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b45309" strokeWidth={2} strokeDasharray="8 5" />
                    <circle cx={a.x} cy={a.y} r={4} fill="#b45309" />
                    <circle cx={b.x} cy={b.y} r={4} fill="#b45309" />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} textAnchor="middle" fontSize={12} fill="#7c2d12">
                      {overlay.label ?? 'Measurement'}
                    </text>
                  </g>
                );
              }
              if (overlay.overlayKind === 'annotation') {
                const target = view.viewport.entities.find((e) => e.entityId === overlay.entityId);
                if (target?.ndc == null) return null;
                const point = toViewBox(target.ndc);
                return (
                  <g key={overlay.overlayId} data-overlay-kind="annotation">
                    <line x1={point.x} y1={point.y - 18} x2={point.x} y2={point.y - 44} stroke="#7c2d12" strokeWidth={1.5} />
                    <rect x={point.x - 110} y={point.y - 88} width={220} height={42} rx={6} fill="#fffbeb" stroke="#d97706" />
                    <text x={point.x - 100} y={point.y - 68} fontSize={11} fill="#78350f">
                      {overlay.text?.slice(0, 32)}
                    </text>
                  </g>
                );
              }
              const target = view.viewport.entities.find((e) => e.entityId === overlay.entityId);
              if (target?.ndc == null) return null;
              const point = toViewBox(target.ndc);
              return (
                <circle
                  key={overlay.overlayId}
                  cx={point.x}
                  cy={point.y}
                  r={30}
                  fill="none"
                  stroke={overlay.color ?? '#d97706'}
                  strokeWidth={4}
                  opacity={0.85}
                />
              );
            })}
            {/* The canonical entity glyphs at their projected positions. */}
            {view.viewport.entities.map((entity) => {
              if (entity.ndc === null) {
                return (
                  <text key={entity.entityId} x={12} y={48 + view.viewport.entities.indexOf(entity) * 14} fontSize={11} fill="#a8a29e">
                    ◇ {entity.label} (outside view)
                  </text>
                );
              }
              const point = toViewBox(entity.ndc);
              const state = !entity.visible ? 'hidden' : entity.isolated ? 'isolated' : entity.focused ? 'focused' : 'visible';
              return (
                <g key={entity.entityId} data-entity={entity.entityId} data-entity-state={state} transform={`translate(${point.x} ${point.y})`}>
                  {entity.focused ? <circle r={26} fill="none" stroke="#b45309" strokeWidth={3} /> : null}
                  {entity.isolated ? <rect x={-22} y={-22} width={44} height={44} rx={8} fill="none" stroke="#1d4ed8" strokeWidth={3} /> : null}
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
                </g>
              );
            })}
            {/* Agent presence chips. */}
            {view.viewport.agents.map((agent, index) => (
              <g key={agent.agentId} data-presence-agent={agent.agentId}>
                <rect
                  x={VIEWBOX.width - 250}
                  y={36 + index * 32}
                  width={238}
                  height={26}
                  rx={13}
                  fill={agent.followed ? '#44403c' : '#f5f5f4'}
                  stroke="#a8a29e"
                />
                <text x={VIEWBOX.width - 236} y={53 + index * 32} fontSize={12} fill={agent.followed ? '#fafaf9' : '#1c1917'}>
                  {agent.agentId}
                  {agent.followed ? ' · following' : ''}
                </text>
              </g>
            ))}
            {/* The navigation HUD. */}
            <g>
              <rect x={12} y={VIEWBOX.height - 84} width={340} height={72} rx={8} fill="#ffffff" fillOpacity={0.92} stroke="#e2e0da" />
              <text x={24} y={VIEWBOX.height - 62} fontSize={12} fill="#1c1917">
                camera {view.viewport.cameraMode} · orbit {Math.round((view.viewport.navigation.azimuthRad * 180) / Math.PI)}° · d{' '}
                {view.viewport.navigation.distance.toFixed(1)}u
              </text>
              <text x={24} y={VIEWBOX.height - 44} fontSize={11} fill="#78716c">
                drag orbit · shift-drag pan · wheel zoom · WASD/QE/RF/+- keys
              </text>
              <text x={24} y={VIEWBOX.height - 26} fontSize={11} fill="#a8a29e">
                tool: {tool} — picks issue epoch.world.interaction.{tool}
              </text>
            </g>
          </svg>
          {/* The renderer health/fallback banner (Epoch-owned chrome). */}
          {view.renderers.lastFailure === null ? null : (
            <div
              data-testid="desktop-world-failure"
              role="alert"
              style={{
                position: 'absolute',
                left: SPACE.md,
                bottom: SPACE.md,
                maxWidth: 460,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: RADII.sm,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                fontSize: TYPE.sizeSm,
                color: '#7f1d1d',
              }}
            >
              {view.renderers.fallbackApplied ? 'Fallback applied — ' : ''}
              {view.renderers.lastFailure.message}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <ActionButton variant="secondary" onClick={() => { runtime.resetNavigation(); fire(); }}>
            Reset camera
          </ActionButton>
          <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted }}>
            The camera is presentation-only; semantic zoom issues the typed zoom intent.
          </span>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: SPACE.lg }}>
        <Panel title="Tools" hint="Which typed intent a pick normalizes toward.">
          <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {(['select', 'inspect', 'isolate', 'measure', 'annotate', 'hide'] as const).map((candidate) => (
              <ActionButton
                key={candidate}
                variant={tool === candidate ? 'primary' : 'secondary'}
                onClick={() => { runtime.setTool(candidate as WorldTool); fire(); }}
              >
                {candidate}
              </ActionButton>
            ))}
          </div>
        </Panel>

        <Panel title="Inspect" hint="The CANONICAL record of the picked/focused entity.">
          {view.inspect.entityId === null ? (
            <GuidanceCard>Pick an entity in the world to inspect its canonical record.</GuidanceCard>
          ) : (
            <div style={{ display: 'grid', gap: SPACE.xs, fontSize: TYPE.sizeSm }}>
              <Mono>{view.inspect.entityId}</Mono>
              <span>
                {view.inspect.label ?? '—'} <Badge tone="mono">{view.inspect.entityType ?? '—'}</Badge>
              </span>
              <Mono>{view.inspect.contentDigest?.slice(0, 16) ?? '—'}…</Mono>
              <span style={{ color: COLORS.textMuted }}>
                position ({view.inspect.position?.map((v) => v.toFixed(1)).join(', ') ?? '—'}) ·{' '}
                {view.inspect.visible ? 'visible' : 'hidden'}
                {view.inspect.isolated ? ' · isolated' : ''}
              </span>
            </div>
          )}
        </Panel>

        <Panel title="Layers" hint="Semantic layers derived from the canonical entity types.">
          <div style={{ display: 'grid', gap: SPACE.xs }}>
            {view.layers.map((layer) => (
              <div key={layer.layerId} style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                <span style={{ fontSize: TYPE.sizeSm, flex: 1 }}>
                  {layer.label} <small>({layer.entityIds.length})</small>
                </span>
                <Badge tone={layer.visible ? 'success' : layer.mixed ? 'warning' : 'neutral'}>
                  {layer.visible ? 'visible' : layer.mixed ? 'mixed' : 'hidden'}
                </Badge>
                <ActionButton onClick={() => command(() => runtime.toggleLayer(layer.layerId))}>
                  {layer.visible ? 'Hide' : 'Reveal'}
                </ActionButton>
                <ActionButton onClick={() => command(() => runtime.isolateLayer(layer.layerId))}>
                  Isolate
                </ActionButton>
              </div>
            ))}
            <div>
              <ActionButton onClick={() => command(() => runtime.revealAllLayers())}>Reveal all</ActionButton>
            </div>
          </div>
        </Panel>

        <Panel title="Agents" hint="Visible presence — follow issues the typed follow-agent intent.">
          <div style={{ display: 'grid', gap: SPACE.xs }}>
            {view.viewport.agents.map((agent) => (
              <div key={agent.agentId} style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                <Mono>{agent.agentId}</Mono>
                <ActionButton
                  variant={agent.followed ? 'primary' : 'secondary'}
                  onClick={() => command(() => runtime.followAgent(agent.agentId))}
                >
                  {agent.followed ? 'Following' : 'Follow'}
                </ActionButton>
              </div>
            ))}
            {view.viewport.agents.length === 0 ? <GuidanceCard>No agents present.</GuidanceCard> : null}
          </div>
        </Panel>

        <Panel title="Renderer" hint="Epoch-owned selector + health + the last switch evidence.">
          <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {view.renderers.choices.map((choice) => (
              <ActionButton
                key={choice.rendererId}
                variant={choice.active ? 'primary' : 'secondary'}
                onClick={() => command(() => runtime.selectRenderer(choice.rendererId))}
              >
                {choice.displayName}
              </ActionButton>
            ))}
          </div>
          <span style={{ fontSize: TYPE.sizeSm, color: COLORS.textSecondary }}>
            health <strong>{view.renderers.health.state}</strong> · session {view.renderers.sessionState}
            {view.renderers.fallbackApplied ? ' · FALLBACK APPLIED' : ''}
          </span>
          <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted }}>
            {view.renderers.lastSwitchDigest === null
              ? 'No switch yet — the canonical world digest carries across every switch.'
              : `Last switch ${view.renderers.lastSwitchDigest.slice(0, 12)}… · restored: ${view.renderers.restoredViewFields.join(', ') || '—'}`}
          </span>
        </Panel>

        <Panel title="Timeline" hint={`${timeline.trackLabel} — scrub issues the typed replay intent.`}>
          <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
            <Mono>
              {(timeline.positionAtMs / 1000).toFixed(1)}s / {(timeline.trackEndMs / 1000).toFixed(1)}s
            </Mono>
            <Badge tone={timeline.paused ? 'warning' : 'success'}>
              {timeline.paused ? 'paused' : 'playing'}
            </Badge>
            {timeline.paused ? (
              <ActionButton onClick={() => command(() => runtime.resumeTimeline())}>Resume</ActionButton>
            ) : (
              <ActionButton onClick={() => command(() => runtime.pauseTimeline())}>Pause</ActionButton>
            )}
          </div>
          <div
            data-testid="desktop-world-timeline"
            role="slider"
            aria-label="Replay position"
            aria-valuenow={timeline.positionAtMs}
            aria-valuemin={timeline.trackStartMs}
            aria-valuemax={timeline.trackEndMs}
            tabIndex={0}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
              command(() => runtime.scrubTimeline(timeline.trackStartMs + fraction * span));
            }}
            style={{ position: 'relative', height: 30, background: COLORS.surfaceSunken, border: `1px solid ${COLORS.border}`, borderRadius: RADII.sm, cursor: 'pointer' }}
          >
            {timeline.markers.map((marker) => (
              <span
                key={marker.markerId}
                title={`${marker.label ?? marker.markerId} @ ${(marker.atMs / 1000).toFixed(1)}s`}
                style={{
                  position: 'absolute',
                  left: `${((marker.atMs - timeline.trackStartMs) / span) * 100}%`,
                  top: marker.markerKind === 'branch-point' ? 2 : 18,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: marker.markerKind === 'branch-point' ? COLORS.accent : COLORS.textMuted,
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
                background: COLORS.accent,
              }}
            />
          </div>
        </Panel>

        <Panel title="Branch · simulate · annotate" hint="Entry points that surface typed request effects — never direct mutation.">
          <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {view.controls.map((control) => (
              <ActionButton
                key={control.controlId}
                onClick={() =>
                  command(() =>
                    runtime.invokeControl(control.controlId, { branchAtMs: BRANCH_AT_MS }),
                  )
                }
              >
                {control.label}
              </ActionButton>
            ))}
          </div>
          <div style={{ display: 'flex', gap: SPACE.sm }}>
            <input
              data-testid="desktop-world-annotation"
              type="text"
              value={annotationDraft}
              placeholder="Annotate the focused entity…"
              onChange={(event) => setAnnotationDraft(event.target.value)}
              style={{
                flex: 1,
                fontSize: TYPE.sizeSm,
                padding: `5px ${SPACE.sm}px`,
                borderRadius: RADII.sm,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceSunken,
                color: COLORS.text,
                fontFamily: FONTS.sans,
              }}
            />
            <ActionButton
              variant="primary"
              onClick={() => {
                if (annotationDraft.trim().length > 0) {
                  command(() => runtime.composeAnnotation(annotationDraft));
                }
                setAnnotationDraft('');
              }}
            >
              Annotate
            </ActionButton>
          </div>
        </Panel>

        <Panel title="Foundation assets" hint="Import a glTF/GLB in-page (no vendor UI): validate → content-address → the typed bind intent.">
          <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              data-testid="desktop-world-foundation-input"
              type="file"
              accept=".gltf,.glb,model/gltf-binary,model/gltf+json"
              aria-label="Import a glTF/GLB foundation asset"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file === undefined || file === null) return;
                void file.arrayBuffer().then((buffer) => {
                  onFoundationImport({ bytes: new Uint8Array(buffer), fileName: file.name });
                });
                event.target.value = '';
              }}
              style={{
                fontSize: TYPE.sizeSm,
                maxWidth: 260,
                fontFamily: FONTS.sans,
                color: COLORS.text,
              }}
            />
            <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted }}>
              Only sealed, content-addressed, tenant-scoped bindings are bindable.
            </span>
          </div>
          {view.sessionAssets.imported.length === 0 ? (
            <span style={{ fontSize: TYPE.sizeSm, color: COLORS.textMuted }}>
              No foundation assets imported yet.
            </span>
          ) : (
            <div style={{ display: 'grid', gap: SPACE.xs, marginTop: SPACE.sm }}>
              {view.sessionAssets.imported.map((asset) => (
                <div
                  key={asset.assetDigest}
                  data-testid="desktop-world-imported-asset"
                  data-asset-digest={asset.assetDigest}
                  style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}
                >
                  <Mono>{asset.assetDigest.slice(0, 16)}…</Mono>
                  <span style={{ fontSize: TYPE.sizeSm, flex: 1 }}>
                    {asset.label ?? 'imported asset'} <Badge tone="mono">{asset.assetKind}</Badge>{' '}
                    <small>
                      {asset.byteSize} bytes
                      {asset.vertexCount !== null && asset.triangleCount !== null
                        ? ` · ${asset.vertexCount} vertices · ${asset.triangleCount} triangles`
                        : ''}
                    </small>
                  </span>
                  <ActionButton onClick={() => command(() => runtime.bindFoundationAsset(asset.assetDigest))}>
                    Bind
                  </ActionButton>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gap: SPACE.xs, marginTop: SPACE.md }}>
            <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Bound-asset ledger (digest-addressed)
            </span>
            {view.sessionAssets.ledger.length === 0 ? (
              <span style={{ fontSize: TYPE.sizeSm, color: COLORS.textMuted }}>
                No bindings applied yet — the ledger is experience state, never semantic authority.
              </span>
            ) : (
              view.sessionAssets.ledger.map((entry, index) => (
                <div
                  key={`${entry.receiptDigest}-${index}`}
                  data-testid="desktop-world-bound-asset"
                  data-asset-digest={entry.assetDigest}
                  data-outcome={entry.outcome}
                  data-binding-digest={entry.bindingDigest}
                  data-receipt-digest={entry.receiptDigest}
                  style={{ display: 'grid', gap: 2 }}
                >
                  <span style={{ fontSize: TYPE.sizeSm }}>
                    <strong>{entry.outcome}</strong> · {entry.assetKind} on {entry.rendererId}
                    {entry.reason !== null ? ` (${entry.reason})` : ''}
                  </span>
                  <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>
                    asset {entry.assetDigest.slice(0, 16)}… · binding {entry.bindingDigest.slice(0, 16)}… · receipt{' '}
                    {entry.receiptDigest.slice(0, 16)}…
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Intent journal" hint="Every interaction's typed intent + effects awaiting their authorities.">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: TYPE.sizeXs, lineHeight: 1.8, color: COLORS.textSecondary }}>
            {[...view.journal].reverse().slice(0, 8).map((entry, index) => (
              <li key={`${entry.atMs}-${index}`}>
                <Mono>{entry.controlIntentId}</Mono> {entry.outcome}
                {entry.hitEntityId !== undefined ? ` · ${entry.hitEntityId}` : ''}
              </li>
            ))}
          </ul>
          <span style={{ fontSize: TYPE.sizeXs, color: COLORS.textMuted }}>
            {view.effects.length} effect(s) awaiting authority routing (inspect/measure/branch/simulate…).
          </span>
        </Panel>
      </div>
    </>
  );
}
