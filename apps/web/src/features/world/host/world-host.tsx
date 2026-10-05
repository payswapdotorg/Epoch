'use client';
/**
 * THE WEB WORLD HOST (W061 → W072, ACR-012) — the client composition that
 * makes the construction solution world the PRIMARY web workspace at
 * `/world`: the REAL `@epoch/world-runtime` `WorldWorkspaceRuntime` over
 * the REAL `RendererFabric` with the REAL interactive renderers
 * registered (W058 Three.js first, W059 Babylon.js second, the
 * contract-only reference presenter as the declared final fallback),
 * presenting the FROZEN W071 construction solution fixture (Pioneer
 * Block-A — the same fixture the desktop world presents).
 *
 * Composition discipline (unchanged from W061):
 * - the wall-clock host loop runs HERE (`SystemHostClock` +
 *   `TimeoutFrameScheduler` — the TL-confirmed W056 advisory: the fabric
 *   core stays virtual-time-only; this host is the only wall-clock reader);
 * - the REAL engines' GL objects are constructed ONLY in this browser
 *   effect, over the two Epoch-owned canvases of the engine stage
 *   (`browser-gl.ts`); SSR/prerender composes nothing engine-side, and a
 *   browser without a usable GL context degrades to the engines' documented
 *   headless cores (typed, surfaced — never fabricated pixels);
 * - the engine stage is the SPATIAL surface when the active presenter is a
 *   real engine with a live GL surface (its pixels + the non-positional
 *   chrome); the contract-only reference projection renders when the
 *   reference presenter is active or no GL surface is live;
 * - every interaction routes through the runtime's command surface — raw
 *   viewport input goes through the fabric seam (the ACTIVE adapter
 *   hit-tests: Three.js Raycaster / Babylon scene.pick -> semantic entity
 *   id -> EXISTING typed epoch.world.interaction intents), workspace
 *   commands compose the same typed vocabulary. No durable writes, no
 *   vendor UI, no engine DOM access beyond the handed canvas.
 *
 * The W072 STABLE-TREE discipline (the blank-canvas fix): the engines'
 * GL surfaces bind LAZILY, at the adapter's first session mount, to the
 * canvas that is live AT THAT MOMENT (a `CanvasSource` getter — never an
 * eagerly-captured element). To make that moment coincide with the FINAL
 * DOM, the host renders ONE stable tree from the first client commit that
 * has the runtime: a minimal composing shell (no engine state) → the
 * stable workspace tree (the engine stage mounts; the refs attach) → the
 * OPEN effect (the session mounts and the GL surfaces bind the LIVE
 * canvases) → the ready flip, which only updates props/attributes on the
 * SAME tree (React never re-creates the canvas elements, so the engines'
 * binding stays pointed at the visible canvases — an earlier binding
 * would have rendered into the composing shell's canvases forever).
 *
 * The W072 addition: the HONEST TYPED-PICK helper for host-surface
 * selections (navigator rows, BOQ lines, constraint focus, agent work
 * links): the pointer is DERIVED from the REAL Three.js projection of the
 * entity (`projectedPointerOf`) and issued through the same fabric seam —
 * a host-surface selection produces the SAME typed pick receipt a 3D
 * viewport click produces. Under the Babylon.js presenter the projected-
 * pointer seam does not exist (documented degradation): the selection
 * stays canonical and the typed re-pick is skipped — 3D viewport input
 * drives the typed path for BOTH engines through the adapters' own hit
 * tests.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SystemHostClock,
  TimeoutFrameScheduler,
  WorldWorkspaceRuntime,
  type WorkspaceViewModel,
} from '@epoch/world-runtime';
import { ThreeJsRendererAdapter, projectedPointerOf } from '@epoch/adapter-renderer-threejs';
import { BabylonRendererAdapter } from '@epoch/adapter-renderer-babylonjs';
import { WorldWorkspace } from '../components/WorldWorkspace';
import {
  ENGINE_CANVAS_SIZE,
  webBabylonEngineHost,
  webThreeSurfaceFactory,
  type SurfaceProbe,
} from './browser-gl';
import {
  BABYLONJS_RENDERER_ID,
  DEVICE,
  ONTOLOGY,
  RENDERER_PREFERENCE,
  SCENE,
  THREE_RENDERER_ID,
  buildWorldFabric,
  isEngineRenderer,
} from './world-fixture';

/** The host composition phases (client-side; the static shell renders 'composing'). */
type HostPhase =
  | { readonly phase: 'composing' }
  | { readonly phase: 'ready' }
  | { readonly phase: 'failed'; readonly message: string };

/**
 * The web world host: composes the REAL workspace stack once per mount,
 * renders the engine stage + the construction solution workspace, and
 * disposes cleanly on unmount (sessions are ephemeral by construction).
 */
export function WorldWorkspaceHost(): ReactNode {
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const babylonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<WorldWorkspaceRuntime | null>(null);
  const threeAdapterRef = useRef<ThreeJsRendererAdapter | null>(null);
  const threeSurfaceRef = useRef<{ readonly probe: SurfaceProbe } | null>(null);
  const babylonSurfaceRef = useRef<{ readonly probe: SurfaceProbe } | null>(null);
  const [phaseState, setPhaseState] = useState<HostPhase>({ phase: 'composing' });
  const [view, setView] = useState<WorkspaceViewModel | null>(null);
  // Whether the STABLE tree (the workspace + the engine stage) has been
  // committed at least once — the OPEN effect waits for it so the GL
  // surfaces bind the canvases of the tree that will NEVER be re-created.
  const [stageMounted, setStageMounted] = useState(false);
  const [glLive, setGlLive] = useState<{ readonly three: boolean; readonly babylon: boolean }>({
    three: false,
    babylon: false,
  });

  // Compose the workspace ONCE per mount (browser only — the effect never
  // runs during SSR/prerender, so no GL construction happens server-side).
  // The GL surfaces resolve their canvases LAZILY (CanvasSource getters), so
  // composing here — before any canvas exists — binds nothing; the session
  // (and with it the GL binding) opens in the second effect, AFTER the
  // stable tree's canvases have committed.
  useEffect(() => {
    const threeSurface = webThreeSurfaceFactory(() => threeCanvasRef.current);
    const babylonSurface = webBabylonEngineHost(() => babylonCanvasRef.current);
    const three = new ThreeJsRendererAdapter({ surfaceFactory: threeSurface.factory });
    const babylon = new BabylonRendererAdapter({ host: babylonSurface.host });
    threeAdapterRef.current = three;
    threeSurfaceRef.current = threeSurface;
    babylonSurfaceRef.current = babylonSurface;
    const { fabric } = buildWorldFabric({ three, babylon });
    const runtime = new WorldWorkspaceRuntime({
      slug: 'web-construction-solution',
      fabric,
      scene: SCENE,
      ontology: ONTOLOGY,
      device: DEVICE,
      clock: new SystemHostClock(),
      scheduler: new TimeoutFrameScheduler(),
      rendererPreference: RENDERER_PREFERENCE,
    });
    runtimeRef.current = runtime;
    runtime.setViewModelObserver((viewModel) => {
      setView(viewModel);
      // Refresh the GL liveness on every view-model tick: the engines
      // are constructed LAZILY at their first session (the preferred
      // renderer at open(), the others at their first switch), so the
      // probes captured at mount time are stale until then — the stage
      // must present the live surface mode, not the mount-time one.
      setGlLive({
        three: threeSurface.probe.glActive,
        babylon: babylonSurface.probe.glActive,
      });
    });
    // Render the STABLE tree (the workspace + the engine stage): its
    // canvases commit and the refs attach BEFORE the session opens.
    setStageMounted(true);
    return () => {
      runtime.stopHostLoop();
      void runtime.close();
      runtimeRef.current = null;
      threeAdapterRef.current = null;
      threeSurfaceRef.current = null;
      babylonSurfaceRef.current = null;
    };
  }, []);

  // Open the session AFTER the stable tree committed (the GL-binding fix):
  // the adapters mount their sessions here — the surface factories resolve
  // the LIVE canvases of the stable tree (an earlier open would bind the
  // composing shell, whose canvases the stable re-render replaces).
  useEffect(() => {
    if (!stageMounted) {
      return;
    }
    const runtime = runtimeRef.current;
    if (runtime === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const opened = await runtime.open();
      if (cancelled) {
        return;
      }
      if (!opened.ok) {
        setPhaseState({
          phase: 'failed',
          message: `${opened.error.code}: ${opened.error.message}`,
        });
        return;
      }
      setGlLive({
        three: threeSurfaceRef.current?.probe.glActive ?? false,
        babylon: babylonSurfaceRef.current?.probe.glActive ?? false,
      });
      setView(runtime.viewModel());
      setPhaseState({ phase: 'ready' });
      runtime.startHostLoop();
    })();
    return () => {
      cancelled = true;
    };
  }, [stageMounted]);

  /**
   * The HONEST TYPED-PICK helper for host-surface selections: issue the
   * same typed pointer pick through the ACTIVE Three.js presenter, with
   * the pointer DERIVED from the adapter's own projection of the entity
   * (never guessed). Under Babylon.js / reference presenters the seam does
   * not exist — the selection stays canonical without the typed re-pick
   * (documented degradation).
   */
  const pickEntityOnPresenter = useCallback((entityId: string): void => {
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

  // The engine stage: the two Epoch-owned canvases (the active presenter's
  // pixels visible), centered and square — both adapters present under
  // aspect 1, so the normalized pointer space and the engine projection
  // space coincide. Container-query units keep the square unclipped inside
  // the world viewport region (the workspace sets `container-type: size`).
  const activeRendererId = view?.renderers.activeRendererId ?? '';
  const threeActive = activeRendererId === THREE_RENDERER_ID;
  const babylonActive = activeRendererId === BABYLONJS_RENDERER_ID;
  const engineStage: ReactNode = (
    <div
      ref={stageRef}
      data-engine-stage=""
      data-active-renderer={activeRendererId}
      data-gl-three={glLive.three ? 'true' : 'false'}
      data-gl-babylon={glLive.babylon ? 'true' : 'false'}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `min(100cqw, 100cqh, ${ENGINE_CANVAS_SIZE}px)`,
        aspectRatio: '1 / 1',
        background: '#ddd7cb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(38, 34, 28, 0.18)',
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

  if (phaseState.phase === 'failed') {
    return (
      <div data-world-host="web" data-world-phase="failed" role="alert">
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>The world workspace could not mount</h1>
        <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          {phaseState.message}
        </p>
      </div>
    );
  }

  // The pre-composition shell (the very first client commit + SSR/prerender):
  // NO engine state at all — the stable workspace tree (with the engine
  // stage) mounts on the next commit, once the runtime exists.
  if (!stageMounted || runtimeRef.current === null) {
    return (
      <div
        data-world-host="web"
        data-world-phase="composing"
        aria-busy="true"
        style={{ containerType: 'size', minHeight: 420 }}
      >
        <p style={{ margin: 0, padding: 16, fontSize: 14, color: '#57534e' }}>
          Presenting the construction solution world through the renderer fabric…
        </p>
      </div>
    );
  }

  const runtime = runtimeRef.current;
  const ready = phaseState.phase === 'ready' && view !== null;

  // The spatial surface: the REAL engine pixels when the active presenter is
  // a real engine with a live GL surface; the contract-only reference
  // projection otherwise (never a blank square presented as a world).
  const engineSpatial =
    ready &&
    isEngineRenderer(activeRendererId) &&
    ((threeActive && glLive.three) || (babylonActive && glLive.babylon));

  // THE STABLE TREE (composing and ready differ ONLY in props/attributes —
  // React never re-creates the engine stage's canvases across the flip, so
  // the GL surfaces bound at open() stay pointed at the VISIBLE canvases).
  return (
    <div
      data-world-host="web"
      data-world-phase={ready ? 'ready' : 'composing'}
      data-engine-spatial={engineSpatial ? 'true' : 'false'}
      aria-busy={ready ? undefined : 'true'}
    >
      <WorldWorkspace
        driver={runtime}
        viewModel={view ?? undefined}
        engineStage={engineStage}
        spatialOverlay={engineSpatial ? 'engine' : 'reference'}
        pointerBounds={stageRef}
        onPickEntityOnPresenter={pickEntityOnPresenter}
      />
    </div>
  );
}
