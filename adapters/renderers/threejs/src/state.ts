/**
 * The adapter's per-session runtime state (W058) — the OPAQUE handle the
 * fabric holds (`RendererAdapterSession.handle`).
 *
 * Everything here is EPHEMERAL, provider-native presentation state:
 * the mounted presentation (a disposable Three.js scene graph), the
 * portable view-state mirror (the only presentation subset that survives a
 * switch), the injected GL surface (null = headless), the disposable
 * interaction anchors (camera drag + measurement), and the session's
 * capability mirror (the declaration the state was created under).
 *
 * Nothing in this state is semantic: dispose clears it entirely and the
 * state refuses every operation afterwards.
 */
import type { RendererBinding, PortableViewState, RendererCapabilitySet, WorldProjectionRef } from '@epoch/renderer-runtime';
import type { ThreePresentation } from './scene-graph';
import type { ThreeGlSurface } from './surface';

/** The adapter's per-session runtime state (the opaque seam handle). */
export interface ThreeAdapterRuntimeState {
  readonly fabricSessionId: string;
  readonly binding: RendererBinding;
  readonly worldProjection: WorldProjectionRef;
  /** The capability declaration this session was created under (typed mirror). */
  readonly capabilities: RendererCapabilitySet;
  /** The portable view-state mirror (focus/layers/timeline/camera/hidden). */
  viewState: PortableViewState;
  /** The mounted presentation (null before the first mount / after dispose). */
  presentation: ThreePresentation | null;
  /** The injected GL surface (null = headless: no WebGLRenderer). */
  glSurface: ThreeGlSurface | null;
  /** Frames applied since mount (disposable counter). */
  frameCount: number;
  /** The last applied frame index (disposable counter). */
  lastFrameIndex: number | null;
  /** The last applied degradation (typed fidelity state). */
  lastDegradation: string;
  /** The camera drag anchor set by pointer-down (presentation-only). */
  pointerAnchor: { x: number; y: number } | null;
  /** The measurement anchor entity id (presentation-only affordance state). */
  measurementAnchor: string | null;
  /** The accepted asset bindings (digest-addressed, trust-gated). */
  readonly boundAssets: Map<string, string>;
  /** The final disposal report (stashed at dispose; evidence survives teardown). */
  disposalEvidence: import('./resources').DisposalReport | null;
  /** Terminal flag: a disposed state refuses every operation. */
  disposed: boolean;
}
