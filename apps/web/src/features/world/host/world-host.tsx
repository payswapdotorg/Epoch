'use client';
/**
 * THE WEB WORLD HOST (W061) — the client composition that makes the
 * interactive spatial world the PRIMARY web workspace at `/world`: the REAL
 * `@epoch/world-runtime` `WorldWorkspaceRuntime` over the REAL
 * `RendererFabric` with the REAL interactive renderers registered (W058
 * Three.js first, W059 Babylon.js second, the contract-only reference
 * presenter as the declared final fallback).
 *
 * Composition discipline:
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
 *   SVG chrome); the contract-only reference projection renders when the
 *   reference presenter is active or no GL surface is live;
 * - every interaction routes through the runtime's command surface — raw
 *   viewport input goes through the fabric seam (the ACTIVE adapter
 *   hit-tests: Three.js Raycaster / Babylon scene.pick -> semantic entity
 *   id -> EXISTING typed epoch.world.interaction intents), workspace
 *   commands compose the same typed vocabulary. No durable writes, no
 *   vendor UI, no engine DOM access beyond the handed canvas.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SystemHostClock,
  TimeoutFrameScheduler,
  WorldWorkspaceRuntime,
  type WorkspaceViewModel,
} from '@epoch/world-runtime';
import { ThreeJsRendererAdapter } from '@epoch/adapter-renderer-threejs';
import { BabylonRendererAdapter } from '@epoch/adapter-renderer-babylonjs';
import { WorldWorkspace } from '../components/WorldWorkspace';
import {
  ENGINE_CANVAS_SIZE,
  webBabylonEngineHost,
  webThreeSurfaceFactory,
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
 * renders the engine stage + the world workspace, and disposes cleanly on
 * unmount (sessions are ephemeral by construction).
 */
export function WorldWorkspaceHost(): ReactNode {
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const babylonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<WorldWorkspaceRuntime | null>(null);
  const [phaseState, setPhaseState] = useState<HostPhase>({ phase: 'composing' });
  const [view, setView] = useState<WorkspaceViewModel | null>(null);
  const [glLive, setGlLive] = useState<{ readonly three: boolean; readonly babylon: boolean }>({
    three: false,
    babylon: false,
  });

  // Compose the workspace ONCE per mount (browser only — the effect never
  // runs during SSR/prerender, so no GL construction happens server-side).
  useEffect(() => {
    let cancelled = false;
    const threeSurface = webThreeSurfaceFactory(threeCanvasRef.current);
    const babylonSurface = webBabylonEngineHost(babylonCanvasRef.current);
    const { fabric } = buildWorldFabric({
      three: new ThreeJsRendererAdapter({ surfaceFactory: threeSurface.factory }),
      babylon: new BabylonRendererAdapter({ host: babylonSurface.host }),
    });
    const runtime = new WorldWorkspaceRuntime({
      slug: 'web-world',
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
      if (!cancelled) {
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
      }
    });
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
      setGlLive({ three: threeSurface.probe.glActive, babylon: babylonSurface.probe.glActive });
      setView(runtime.viewModel());
      setPhaseState({ phase: 'ready' });
      runtime.startHostLoop();
    })();
    return () => {
      cancelled = true;
      runtime.stopHostLoop();
      void runtime.close();
      runtimeRef.current = null;
    };
  }, []);

  // The engine stage: the two Epoch-owned canvases (the active presenter's
  // pixels visible), centered and square — both adapters present under
  // aspect 1, so the normalized pointer space and the engine projection
  // space coincide.
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

  const runtime = runtimeRef.current;
  if (phaseState.phase !== 'ready' || view === null || runtime === null) {
    return (
      <div data-world-host="web" data-world-phase="composing" aria-busy="true">
        {engineStage}
        <p style={{ margin: 0, padding: 16, fontSize: 14, color: '#57534e' }}>
          Presenting the canonical fixture problem through the renderer fabric…
        </p>
      </div>
    );
  }

  // The spatial surface: the REAL engine pixels when the active presenter is
  // a real engine with a live GL surface; the contract-only reference
  // projection otherwise (never a blank square presented as a world).
  const engineSpatial =
    isEngineRenderer(activeRendererId) &&
    ((threeActive && glLive.three) || (babylonActive && glLive.babylon));

  return (
    <div
      data-world-host="web"
      data-world-phase="ready"
      data-engine-spatial={engineSpatial ? 'true' : 'false'}
    >
      <WorldWorkspace
        driver={runtime}
        viewModel={view}
        engineStage={engineStage}
        spatialOverlay={engineSpatial ? 'engine' : 'reference'}
        pointerBounds={stageRef}
      />
    </div>
  );
}
