/**
 * THE THREE.JS RENDERER ADAPTER (W058) — the first real interactive
 * renderer behind the frozen W056 `RendererAdapter` seam.
 *
 * What this adapter IS: a complete, honest implementation of the seam over
 * the real Three.js engine — scene mounting from canonical envelopes, real
 * Raycaster hit-testing into semantic entity ids, normalization into the
 * EXISTING W016 intent vocabulary, presentation-only camera controls,
 * overlays/agents/animations at virtual time, declared typed degradations,
 * portable snapshot capture/restore, full GPU teardown at dispose.
 *
 * What this adapter is NOT: semantic authority. It holds ZERO durable
 * state, performs ZERO durable writes, mutates NOTHING canonical, and
 * exposes NO Three.js editor/application UI — the visible surface is
 * Epoch's viewport (W057), which injects the GL surface when one exists.
 *
 * HEADLESS-FIRST: the default construction creates NO WebGLRenderer (Node
 * 22 / CI have no GPU): everything except real GL rasterization and frame
 * image capture runs and is verified headless. A browser host injects the
 * GL surface factory (`ThreeGlSurfaceFactory`) — the W061 E2E loop closes
 * the browser evidence honestly (nothing here fabricates it).
 */
import type { RendererAdapter } from '@epoch/renderer-fabric';
import type {
  RendererAdapterIdentity,
  RendererAdapterSession,
  RendererDisposeReport,
  RendererFrameReport,
  RendererInputTranslation,
  RendererMountInput,
  RendererMountReport,
  RendererProbeInput,
  RendererProbeReport,
  RendererRestoreReport,
  RendererSessionContext,
  RendererSnapshotCaptureInput,
} from '@epoch/renderer-fabric';
import {
  captureSessionSnapshotContent,
  sealRendererSessionSnapshot,
  type DeviceSessionSnapshot,
  type FabricResult,
  type PortableViewState,
  type PortableViewStateField,
  type RendererAssetBinding,
  type RendererCapabilitySet,
  type RendererDescriptor,
  type RendererFrameEnvelope,
  type RendererHealth,
  type RendererInputEnvelope,
  type RendererSessionSnapshot,
} from '@epoch/renderer-runtime';
import { evaluateAnimations } from './animation';
import { captureFrameImage } from './capture';
import { applyDegradation, playbackFrozen } from './degradation';
import { translateRawInput } from './input';
import { mountPresentation, applyViewStateToPresentation, type ThreePresentation } from './scene-graph';
import { GpuResourceLedger, type DisposalReport } from './resources';
import type { ThreeAdapterRuntimeState } from './state';
import type { ThreeFrameCapture, ThreeGlSurfaceFactory } from './surface';
import {
  CAPABILITIES_THREE,
  DESCRIPTOR_THREE,
  IDENTITY_THREE,
} from './declaration';
import {
  COMPATIBLE_DEVICE_CLASSES,
  REDUCED_FIDELITY_DEVICE_CLASSES,
} from './version';

/** The construction options of one adapter instance. */
export interface ThreeJsRendererAdapterOptions {
  /**
   * The injected GL surface factory (the browser path). Omitted/null-safe
   * default: HEADLESS — no WebGLRenderer is constructed; the deterministic
   * core (scene graph, camera math, Raycaster, normalization, degradation,
   * snapshots, disposal) runs without a GL context.
   */
  readonly surfaceFactory?: ThreeGlSurfaceFactory;
}

/**
 * The Three.js renderer adapter. Construct one per host (or per surface);
 * register it with the fabric through the REAL capability registry (see
 * `docs/rendering/threejs.md`).
 */
export class ThreeJsRendererAdapter implements RendererAdapter {
  private readonly surfaceFactory: ThreeGlSurfaceFactory | undefined;
  /** Live runtime states by fabric session id (conformance-evidence lookup). */
  private readonly statesByFabricId = new Map<string, ThreeAdapterRuntimeState>();

  constructor(options: ThreeJsRendererAdapterOptions = {}) {
    this.surfaceFactory = options.surfaceFactory;
  }

  // -------------------------------------------------------------------------
  // Declaration.
  // -------------------------------------------------------------------------

  identity(): RendererAdapterIdentity {
    return IDENTITY_THREE;
  }

  descriptor(): RendererDescriptor {
    return DESCRIPTOR_THREE;
  }

  capabilities(): RendererCapabilitySet {
    return CAPABILITIES_THREE;
  }

  // -------------------------------------------------------------------------
  // Probe (pure; no session, no GL).
  // -------------------------------------------------------------------------

  async probe(input: RendererProbeInput): Promise<FabricResult<RendererProbeReport>> {
    const device = input.device as DeviceSessionSnapshot;
    if (!(COMPATIBLE_DEVICE_CLASSES as readonly string[]).includes(device.device.deviceClass)) {
      return {
        ok: true,
        value: {
          compatible: false,
          reason: `the three.js adapter presents on ${COMPATIBLE_DEVICE_CLASSES.join(', ')} devices — this adapter version ships no XR surface for "${device.device.deviceClass}"`,
        },
      };
    }
    if ((REDUCED_FIDELITY_DEVICE_CLASSES as readonly string[]).includes(device.device.deviceClass)) {
      return {
        ok: true,
        value: {
          compatible: true,
          degradation: 'reduced-fidelity',
        },
      };
    }
    return { ok: true, value: { compatible: true, degradation: 'none' } };
  }

  // -------------------------------------------------------------------------
  // Session lifecycle.
  // -------------------------------------------------------------------------

  async createSession(context: RendererSessionContext): Promise<FabricResult<RendererAdapterSession>> {
    const glSurface = this.surfaceFactory?.(context) ?? null;
    const state: ThreeAdapterRuntimeState = {
      fabricSessionId: context.fabricSessionId,
      binding: context.binding,
      worldProjection: context.worldProjection,
      capabilities: this.capabilities(),
      viewState: context.viewState,
      presentation: null,
      glSurface,
      frameCount: 0,
      lastFrameIndex: null,
      lastDegradation: 'none',
      pointerAnchor: null,
      measurementAnchor: null,
      boundAssets: new Map(),
      disposalEvidence: null,
      disposed: false,
    };
    this.statesByFabricId.set(context.fabricSessionId, state);
    return { ok: true, value: { handle: state } };
  }

  async mountProjection(
    session: RendererAdapterSession,
    input: RendererMountInput,
  ): Promise<FabricResult<RendererMountReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    // Tear down any previous presentation of THIS session first (a remount
    // replaces presentation state; the ledger of the old mount disposes).
    if (state.presentation !== null) {
      state.presentation.ledger.disposeAll();
    }
    const ledger = new GpuResourceLedger();
    if (state.glSurface !== null) {
      ledger.registerRenderer(state.glSurface.renderer);
    }
    const presentation = mountPresentation(input, ledger);
    state.presentation = presentation;
    state.frameCount = 0;
    state.lastFrameIndex = null;
    state.pointerAnchor = null;
    state.measurementAnchor = null;
    // The portable view state seeds the presentation through the SAME code
    // path as a switch restore (one application policy, two entries).
    applyViewStateToPresentation(presentation, state.viewState, state.capabilities.portableViewState);
    return {
      ok: true,
      value: {
        mountedWorldDigest: input.compilation.sceneDigest,
        presentedEntityIds: [...presentation.presentedEntityIds],
        notes: `three.js scene graph of ${presentation.presentedEntityIds.length} presented entities (${state.glSurface === null ? 'headless: no GL surface attached' : 'GL surface attached'})`,
      },
    };
  }

  async applyFrame(
    session: RendererAdapterSession,
    envelope: RendererFrameEnvelope,
  ): Promise<FabricResult<RendererFrameReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    if (envelope.degradation !== 'none' && !state.capabilities.degradation.includes(envelope.degradation)) {
      return {
        ok: false,
        error: {
          code: 'degraded',
          message: `the three.js adapter does not declare the "${envelope.degradation}" degradation — typed fidelity reductions must be declared`,
          degradation: envelope.degradation,
          reason: 'undeclared degradation',
        },
      };
    }
    const presentation = state.presentation;
    state.frameCount += 1;
    state.lastFrameIndex = envelope.frameIndex;
    state.lastDegradation = envelope.degradation;
    if (presentation === null) {
      return {
        ok: true,
        value: {
          frameIndex: envelope.frameIndex,
          presented: false,
          degradation: envelope.degradation,
          notes: 'no mounted presentation (headless counters only)',
        },
      };
    }
    // Typed degradation application (presentation-only, reversible).
    const degradationNotes = applyDegradation(presentation, envelope.degradation);
    // Virtual-time playback (frozen under static-frame).
    let notes = `${degradationNotes}; ${state.glSurface === null ? 'headless scene-graph presentation (no GL surface attached)' : 'GL frame rendered'}`;
    if (!playbackFrozen(presentation)) {
      const pass = evaluateAnimations(presentation, envelope.atMs);
      presentation.timelineAtMs = Math.min(
        presentation.trackEndMs,
        Math.max(presentation.trackStartMs, envelope.atMs),
      );
      notes += `; ${pass.applied} animation instruction(s) applied at t=${envelope.atMs}ms`;
      if (pass.skippedPaths.length > 0) {
        notes += `; skipped: ${pass.skippedPaths.join(', ')}`;
      }
    } else {
      notes += '; playback frozen (static-frame)';
    }
    if (state.glSurface !== null) {
      try {
        state.glSurface.renderer.render(presentation.root, presentation.controls.camera);
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'session-failed',
            message: `the GL surface failed to render frame ${envelope.frameIndex}: ${error instanceof Error ? error.message : String(error)}`,
            fabricSessionId: state.fabricSessionId,
          },
        };
      }
    }
    return {
      ok: true,
      value: {
        frameIndex: envelope.frameIndex,
        presented: true,
        degradation: envelope.degradation,
        notes,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Input normalization (hit-test -> semantic id -> EXISTING W016 intent).
  // -------------------------------------------------------------------------

  async translateInput(
    session: RendererAdapterSession,
    input: RendererInputEnvelope,
  ): Promise<FabricResult<RendererInputTranslation>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    return translateRawInput(state, input);
  }

  // -------------------------------------------------------------------------
  // Portable snapshots (the switching invariant's save/restore).
  // -------------------------------------------------------------------------

  async captureSnapshot(
    session: RendererAdapterSession,
    input: RendererSnapshotCaptureInput,
  ): Promise<FabricResult<RendererSessionSnapshot>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    if (!state.capabilities.snapshotCapture) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the three.js adapter does not declare snapshot capture',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    // The portable camera is the LIVE presentation viewpoint (what the
    // switch target actually restores).
    const camera =
      state.presentation !== null && state.capabilities.portableViewState.includes('camera')
        ? state.presentation.controls.toPortableCamera()
        : state.viewState.camera;
    const viewState: PortableViewState = {
      ...state.viewState,
      camera,
      timelinePosition: {
        atMs: state.presentation?.timelineAtMs ?? state.viewState.timelinePosition.atMs,
        frameIndex: state.lastFrameIndex ?? state.viewState.timelinePosition.frameIndex,
        paused: state.presentation?.timelinePaused ?? state.viewState.timelinePosition.paused,
      },
    };
    const captured = captureSessionSnapshotContent({
      fabricSessionId: state.fabricSessionId,
      capturedFromRendererId: this.identity().rendererId,
      worldProjection: state.worldProjection,
      viewState,
      invocationCount: input.invocationCount,
      switchCount: input.switchCount,
      capturedAtMs: input.atMs,
    });
    if (!captured.ok) {
      return captured;
    }
    return { ok: true, value: sealRendererSessionSnapshot(captured.value) };
  }

  async restoreViewState(
    session: RendererAdapterSession,
    viewState: PortableViewState,
  ): Promise<FabricResult<RendererRestoreReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    const declared = state.capabilities.portableViewState;
    const applied: PortableViewStateField[] = [];
    const skipped: PortableViewStateField[] = [];
    const fields: readonly PortableViewStateField[] = ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'];
    for (const field of fields) {
      if (declared.includes(field)) {
        applied.push(field);
      } else {
        skipped.push(field);
      }
    }
    // The portable view-state mirror is authoritative for the declared
    // subset; undeclared fields keep the session's own values (typed skips).
    state.viewState = viewState;
    if (state.presentation !== null) {
      applyViewStateToPresentation(state.presentation, viewState, applied);
    }
    return {
      ok: true,
      value: {
        appliedFields: applied.sort(),
        skippedFields: skipped.sort(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Assets (trust-gated, digest-addressed; the GPU upload is the browser path).
  // -------------------------------------------------------------------------

  async bindAsset(
    session: RendererAdapterSession,
    binding: RendererAssetBinding,
  ): Promise<FabricResult<{ bound: boolean }>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    if (binding.trustState !== 'validated') {
      return {
        ok: false,
        error: {
          code: 'asset-rejected',
          message: 'untrusted assets never mount — validate the asset binding first',
          assetDigest: binding.assetDigest,
          reason: 'untrusted',
        },
      };
    }
    if (!state.capabilities.assetKinds.includes(binding.assetKind)) {
      return {
        ok: false,
        error: {
          code: 'asset-rejected',
          message: `the three.js adapter does not bind "${binding.assetKind}" assets`,
          assetDigest: binding.assetDigest,
          reason: 'undeclared asset kind',
        },
      };
    }
    // Accepted and tracked (digest-addressed). The GPU upload itself is the
    // injected-surface path; the binding record is the only state that
    // crosses the seam (no untyped byte streams — the fabric-architecture
    // security rule).
    state.boundAssets.set(binding.assetDigest, binding.assetKind);
    return { ok: true, value: { bound: true } };
  }

  // -------------------------------------------------------------------------
  // Dispose (terminal; full GPU teardown).
  // -------------------------------------------------------------------------

  async dispose(session: RendererAdapterSession): Promise<FabricResult<RendererDisposeReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: true, value: { disposed: true, notes: 'already disposed' } };
    }
    const report = state.presentation?.ledger.disposeAll();
    if (report !== undefined) {
      state.disposalEvidence = report;
    }
    state.presentation = null;
    state.pointerAnchor = null;
    state.measurementAnchor = null;
    state.boundAssets.clear();
    state.disposed = true;
    return {
      ok: true,
      value: {
        disposed: true,
        notes:
          report !== undefined
            ? `full GPU teardown: ${report.geometries} geometries, ${report.materials} materials, ${report.textures} textures, ${report.renderers} renderers disposed`
            : 'no mounted presentation; nothing to tear down',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Health.
  // -------------------------------------------------------------------------

  async health(session: RendererAdapterSession, atMs: number): Promise<RendererHealth> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return {
        state: 'unavailable',
        degradation: 'none',
        lastFailureCode: 'session-disposed',
        detail: 'disposed',
        atMs,
      };
    }
    if (state.lastDegradation !== 'none') {
      return {
        state: 'degraded',
        degradation: state.lastDegradation as 'reduced-fidelity' | 'static-frame' | 'wireframe',
        lastFailureCode: 'degraded',
        detail: `presenting ${state.lastDegradation}`,
        atMs,
      };
    }
    return {
      state: 'healthy',
      degradation: 'none',
      detail:
        state.glSurface === null
          ? 'headless: deterministic core active (no GL surface attached)'
          : 'GL surface active',
      atMs,
    };
  }

  // -------------------------------------------------------------------------
  // Adapter-owned extensions (NOT part of the W056 seam — typed helpers the
  // Epoch viewport host and the batteries use; they perform NO durable
  // writes and respect every seam rule).
  // -------------------------------------------------------------------------

  /** Capture one frame image (declared capability; surface-gated, honest). */
  captureFrameImage(
    session: RendererAdapterSession,
    input: { readonly frameIndex: number; readonly atMs: number; readonly width: number; readonly height: number },
  ): FabricResult<ThreeFrameCapture> {
    return captureFrameImage(this.stateOf(session), input);
  }

  /**
   * The adapter session one fabric session hosts, by fabric session id
   * (conformance-evidence helper; unknown and disposed ids yield undefined
   * — nothing survives dispose).
   */
  adapterSessionOf(fabricSessionId: string): RendererAdapterSession | undefined {
    const state = this.statesByFabricId.get(fabricSessionId);
    if (state === undefined || state.disposed) {
      return undefined;
    }
    return { handle: state };
  }

  /** The live runtime state of one fabric session (battery evidence). */
  runtimeStateOf(fabricSessionId: string): ThreeAdapterRuntimeState | undefined {
    const state = this.statesByFabricId.get(fabricSessionId);
    return state !== undefined && !state.disposed ? state : undefined;
  }

  /** The live presentation of one fabric session (battery evidence). */
  presentationOf(fabricSessionId: string): ThreePresentation | undefined {
    return this.runtimeStateOf(fabricSessionId)?.presentation ?? undefined;
  }

  /** The typed disposal report of one session's GPU ledger (battery evidence;
   *   the post-dispose report survives teardown). */
  disposalReportOf(fabricSessionId: string): DisposalReport | undefined {
    const state = this.statesByFabricId.get(fabricSessionId);
    if (state === undefined) {
      return undefined;
    }
    if (state.disposalEvidence !== null) {
      return state.disposalEvidence;
    }
    return state.presentation?.ledger.reportOf();
  }

  // -------------------------------------------------------------------------

  private stateOf(session: RendererAdapterSession): ThreeAdapterRuntimeState {
    const state = session.handle as ThreeAdapterRuntimeState;
    if (
      typeof state !== 'object' ||
      state === null ||
      typeof state.fabricSessionId !== 'string' ||
      !this.statesByFabricId.has(state.fabricSessionId)
    ) {
      throw new Error('the three.js adapter received a foreign session handle');
    }
    return state;
  }

  private disposedFailure(state: ThreeAdapterRuntimeState): FabricResult<never> {
    return {
      ok: false,
      error: {
        code: 'session-disposed',
        message: 'the three.js adapter session is disposed (terminal) — invocations are rejected',
        fabricSessionId: state.fabricSessionId,
      },
    };
  }
}
