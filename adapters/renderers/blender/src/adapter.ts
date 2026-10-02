/**
 * The BLENDER SIDECAR RENDERER ADAPTER (W060) — the EXTERNAL-FOUNDATION
 * implementation of the frozen W056 {@link RendererAdapter} seam: a
 * BATCH/OFFSCREEN renderer class (the third class after the W058/W059
 * embedded engines), honestly declared:
 *
 * - NO interactive surface: `translateInput` is a typed `input-unsupported`
 *   refusal for every input (a batch renderer presents stills, not a live
 *   viewport), and the W013 descriptor declares ZERO interaction modalities;
 * - OFFSCREEN EVIDENCE: `applyFrame` renders the mounted offscene scene
 *   through the typed process boundary (ONE argv-array Blender invocation,
 *   timeouts, output caps, digest-verified artifacts) and records the
 *   render evidence (digest + byte size + entity count) — frame images flow
 *   the existing Verification/Evidence path, never a second authority;
 * - ASSET PREPARATION: `bindAsset` admits ONLY validated `mesh` bindings
 *   (digest-addressed; the glTF bridge produces them), and the
 *   `prepareGltfAsset` method runs the export-gltf sidecar job whose GLB
 *   output must re-enter through the glTF bridge before anything mounts
 *   (provider-native files never become Epoch authority);
 * - SEPARATE PROGRAM: Blender is never linked, embedded, or bundled — the
 *   GPL separate-executable posture recorded in docs/rendering/blender.md.
 *
 * Determinism discipline: the adapter's typed reports carry caller-supplied
 * virtual times; wall-clock measurements exist ONLY inside the process
 * boundary (real I/O evidence, typed as such).
 */
import type {
  FabricResult,
  PortableViewState,
  RendererAssetBinding,
  RendererBinding,
  RendererCapabilitySet,
  RendererDescriptor,
  RendererFrameEnvelope,
  RendererHealth,
  RendererInputEnvelope,
  RendererSessionSnapshot,
  WorldProjectionRef,
} from '@epoch/renderer-runtime';
import {
  captureSessionSnapshotContent,
  sealRendererSessionSnapshot,
} from '@epoch/renderer-runtime';
import type {
  RendererAdapter,
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
import { BlenderSidecarClient, digestOfBytes } from './jobs';
import { offsceneSceneOf, type OffsceneScene } from './offscene';
import type { BlenderBoundaryLimits } from './version';
import {
  CAPABILITIES_BLENDER,
  DESCRIPTOR_BLENDER,
  IDENTITY_BLENDER,
  blenderFailure,
  resolveBlenderLimits,
} from './version';

/** One renderer frame's offscreen render evidence (typed, digest-addressed). */
export type OffscreenRenderEvidence = {
  readonly jobId: string;
  readonly frameIndex: number;
  readonly atMs: number;
  readonly entityCount: number;
  readonly imageDigest: string;
  readonly imageBytes: number;
  readonly blenderVersion: string;
  /** Wall-clock duration of the sidecar invocation (boundary evidence). */
  readonly durationMs: number;
};

/** One glTF asset-preparation result (re-enters through the glTF bridge). */
export type GltfPreparationEvidence = {
  readonly jobId: string;
  readonly entityCount: number;
  readonly glbDigest: string;
  readonly glbBytes: number;
  readonly blenderVersion: string;
  readonly boundAssetDigests: readonly string[];
  /** The exported GLB bytes (UNTRUSTED until the glTF bridge validates them). */
  readonly glbBytesData: Uint8Array;
};

/** The per-session provider-native state (typed; opaque at the seam). */
interface BlenderSessionState {
  readonly fabricSessionId: string;
  readonly binding: RendererBinding;
  readonly worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  offscene: OffsceneScene | null;
  presentedEntityIds: string[];
  renderEvidence: OffscreenRenderEvidence[];
  preparationEvidence: GltfPreparationEvidence[];
  readonly boundAssets: Map<string, string>;
  blenderVersion: string | null;
  lastFailureCode: RendererHealth['lastFailureCode'] | null;
  disposed: boolean;
}

/** The construction options of the Blender sidecar adapter. */
export type BlenderSidecarAdapterOptions = {
  /**
   * The Blender binary path (EPOCH_BLENDER_PATH in production). When
   * absent the adapter still probes/mounts/snapshots — every process-backed
   * operation (probe, frame renders, export) is a TYPED refusal
   * (`adapter-unavailable` / probe-incompatible), never a crash and never a
   * fabricated render.
   */
  readonly blenderPath?: string;
  /** Arguments before the Blender flags (the CI double: [doubleScriptPath]). */
  readonly argvPrefix?: readonly string[];
  /** The injected process runner (the REAL spawn boundary by default). */
  readonly runner?: import('./process').BlenderProcessRunner;
  /** The scoped workspace directory (job specs, reports, artifacts). */
  readonly workspaceDir: string;
  /** Boundary limits. */
  readonly limits?: Partial<BlenderBoundaryLimits>;
  /** The render output size (bounded by limits.maxImagePixels). */
  readonly outputWidth?: number;
  readonly outputHeight?: number;
  /** Environment additions for the sidecar child (test-double modes; never secrets). */
  readonly env?: Readonly<Record<string, string>>;
};

/**
 * The Blender sidecar renderer adapter. Construct it with a workspace
 * directory; configure `blenderPath` (or EPOCH_BLENDER_PATH) when a real
 * Blender binary is available — the CI battery runs the same adapter over
 * the committed Node CLI double.
 */
export class BlenderSidecarRendererAdapter implements RendererAdapter {
  private readonly options: BlenderSidecarAdapterOptions;
  private readonly limits: BlenderBoundaryLimits;
  private readonly sessionsByFabricId = new Map<string, BlenderSessionState>();

  constructor(options: BlenderSidecarAdapterOptions) {
    this.options = options;
    this.limits = resolveBlenderLimits(options.limits);
  }

  identity() {
    return IDENTITY_BLENDER;
  }

  descriptor(): RendererDescriptor {
    return DESCRIPTOR_BLENDER;
  }

  capabilities(): RendererCapabilitySet {
    return CAPABILITIES_BLENDER;
  }

  /** The resolved boundary limits (evidence for docs/batteries). */
  boundaryLimits(): BlenderBoundaryLimits {
    return this.limits;
  }

  async probe(input: RendererProbeInput): Promise<FabricResult<RendererProbeReport>> {
    // The offscreen sidecar PRODUCES stills for the requesting device —
    // its probe records the device class it would render for and gates on
    // the only hard requirement: a configured Blender binary.
    const deviceClass = input.device.device.deviceClass;
    if (this.options.blenderPath === undefined) {
      return {
        ok: true,
        value: {
          compatible: false,
          reason:
            'no Blender binary configured (set EPOCH_BLENDER_PATH or the adapter option) — the offscreen sidecar cannot render without it',
        },
      };
    }
    const client = this.client();
    const probed = await client.probe();
    if (!probed.ok) {
      return {
        ok: true,
        value: {
          compatible: false,
          reason: `the Blender version probe failed (${probed.error.code}): ${probed.error.message}`,
        },
      };
    }
    return {
      ok: true,
      value: {
        compatible: true,
        degradation: 'none',
        reason: `Blender ${probed.value.blenderVersion} (separate-process sidecar) producing stills for a "${deviceClass}" device session`,
      },
    };
  }

  async createSession(context: RendererSessionContext): Promise<FabricResult<RendererAdapterSession>> {
    const state: BlenderSessionState = {
      fabricSessionId: context.fabricSessionId,
      binding: context.binding,
      worldProjection: context.worldProjection,
      viewState: context.viewState,
      offscene: null,
      presentedEntityIds: [],
      renderEvidence: [],
      preparationEvidence: [],
      boundAssets: new Map<string, string>(),
      blenderVersion: null,
      lastFailureCode: null,
      disposed: false,
    };
    this.sessionsByFabricId.set(context.fabricSessionId, state);
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
    const offscene = offsceneSceneOf(input, state.viewState, this.limits);
    if (!offscene.ok) {
      return {
        ok: false,
        error: {
          code: 'mount-failed',
          message: `the offscene scene could not be built: ${offscene.error.message}`,
          worldDigest: input.compilation.sceneDigest,
        },
      };
    }
    state.offscene = offscene.value;
    state.presentedEntityIds = offscene.value.entities.map((entity) => entity.entityId).sort();
    state.renderEvidence = [];
    return {
      ok: true,
      value: {
        mountedWorldDigest: input.compilation.sceneDigest,
        presentedEntityIds: [...state.presentedEntityIds],
        notes: `offscene scene of ${state.presentedEntityIds.length} entities staged for the sidecar (no process run yet)`,
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
    if (envelope.degradation !== 'none') {
      return {
        ok: false,
        error: {
          code: 'degraded',
          message: 'the offscreen sidecar declares no fidelity reductions — batch renders are all-or-nothing',
          degradation: envelope.degradation,
          reason: 'batch-renderer',
        },
      };
    }
    const offscreen = await this.renderOffscreen(state, envelope.frameIndex, envelope.atMs);
    if (!offscreen.ok) {
      state.lastFailureCode = 'session-failed';
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: `the offscreen render failed (${offscreen.error.code}): ${offscreen.error.message}`,
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    state.lastFailureCode = null;
    return {
      ok: true,
      value: {
        frameIndex: envelope.frameIndex,
        presented: true,
        degradation: 'none',
        notes: `offscreen render ${offscreen.value.imageDigest.slice(0, 16)}… (${offscreen.value.imageBytes} bytes, ${offscreen.value.entityCount} entities, ${offscreen.value.durationMs}ms)`,
      },
    };
  }

  async translateInput(
    session: RendererAdapterSession,
    input: RendererInputEnvelope,
  ): Promise<FabricResult<RendererInputTranslation>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    // Honest batch class: this adapter declares ZERO interaction modalities,
    // so every input is a typed refusal — never a silent drop, never a
    // parallel vocabulary.
    return {
      ok: false,
      error: {
        code: 'input-unsupported',
        message: 'the offscreen sidecar is a batch renderer — it translates no interactive input',
        inputKind: input.inputKind,
        reason: 'batch-renderer',
      },
    };
  }

  async captureSnapshot(
    session: RendererAdapterSession,
    input: RendererSnapshotCaptureInput,
  ): Promise<FabricResult<RendererSessionSnapshot>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    const captured = captureSessionSnapshotContent({
      fabricSessionId: state.fabricSessionId,
      capturedFromRendererId: IDENTITY_BLENDER.rendererId,
      worldProjection: state.worldProjection,
      viewState: state.viewState,
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
    // The declared portable subset (the SEMANTIC fields) is restored into
    // the session's view state; the presentation-only fields (camera,
    // timeline position) are honestly skipped — a batch renderer frames
    // its own camera deterministically from the mounted scene.
    state.viewState = {
      ...state.viewState,
      focusedEntityIds: viewState.focusedEntityIds,
      layerVisibility: viewState.layerVisibility,
    };
    return {
      ok: true,
      value: {
        appliedFields: ['focused-entities', 'layer-visibility'],
        skippedFields: ['camera', 'timeline-position'],
      },
    };
  }

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
    if (!CAPABILITIES_BLENDER.assetKinds.includes(binding.assetKind)) {
      return {
        ok: false,
        error: {
          code: 'asset-rejected',
          message: `the offscreen sidecar does not bind "${binding.assetKind}" assets`,
          assetDigest: binding.assetDigest,
          reason: 'undeclared asset kind',
        },
      };
    }
    state.boundAssets.set(binding.assetDigest, binding.assetKind);
    return { ok: true, value: { bound: true } };
  }

  async dispose(session: RendererAdapterSession): Promise<FabricResult<RendererDisposeReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: true, value: { disposed: true, notes: 'already disposed' } };
    }
    state.offscene = null;
    state.presentedEntityIds = [];
    state.renderEvidence = [];
    state.preparationEvidence = [];
    state.boundAssets.clear();
    state.disposed = true;
    return {
      ok: true,
      value: { disposed: true, notes: 'offscene scene, render evidence, and bound assets discarded' },
    };
  }

  async health(session: RendererAdapterSession, atMs: number): Promise<RendererHealth> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { state: 'unavailable', degradation: 'none', lastFailureCode: 'session-disposed', detail: 'disposed', atMs };
    }
    if (state.lastFailureCode !== null) {
      return {
        state: 'degraded',
        degradation: 'none',
        lastFailureCode: state.lastFailureCode,
        detail: 'the last offscreen render failed (typed evidence in the frame report)',
        atMs,
      };
    }
    return { state: 'healthy', degradation: 'none', atMs };
  }

  // -------------------------------------------------------------------------
  // The sidecar-specific surface (beyond the seam): render + prepare.
  // -------------------------------------------------------------------------

  /**
   * Run ONE offscreen render of the session's mounted offscene scene and
   * record the evidence. Called by applyFrame; public for batteries.
   */
  async renderOffscreen(
    state: BlenderSessionState,
    frameIndex: number,
    atMs: number,
  ): Promise<FabricResult<OffscreenRenderEvidence>> {
    if (this.options.blenderPath === undefined) {
      return {
        ok: false,
        error: {
          code: 'adapter-unavailable',
          message: 'no Blender binary configured — the offscreen sidecar cannot render',
          rendererId: IDENTITY_BLENDER.rendererId,
          reason: 'blender-not-configured',
        },
      };
    }
    if (state.offscene === null) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the session has no mounted offscene scene',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    const jobId = `${state.fabricSessionId}-f${frameIndex}`;
    const client = this.client();
    const outcome = await client.runJob({
      jobId,
      jobKind: 'render-offscene',
      scene: state.offscene,
      outputWidth: this.options.outputWidth,
      outputHeight: this.options.outputHeight,
    });
    if (!outcome.ok) {
      return { ok: false, error: { code: 'session-failed', message: outcome.error.message, fabricSessionId: state.fabricSessionId } };
    }
    const evidence: OffscreenRenderEvidence = {
      jobId,
      frameIndex,
      atMs,
      entityCount: outcome.value.entityCount,
      imageDigest: outcome.value.image!.digest,
      imageBytes: outcome.value.image!.bytes.length,
      blenderVersion: outcome.value.blenderVersion,
      durationMs: outcome.value.durationMs,
    };
    state.renderEvidence.push(evidence);
    state.blenderVersion = outcome.value.blenderVersion;
    return { ok: true, value: evidence };
  }

  /**
   * Run the glTF asset-preparation job: export the mounted offscene scene
   * to a GLB through the sidecar. The GLB bytes are returned UNTRUSTED —
   * they must re-enter through the glTF bridge (validate + normalize) before
   * any binding mounts anywhere (the qa/foundation-renderers battery proves
   * exactly this path).
   */
  async prepareGltfAsset(
    session: RendererAdapterSession,
    input: { atMs: number },
  ): Promise<FabricResult<GltfPreparationEvidence>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return this.disposedFailure(state);
    }
    if (this.options.blenderPath === undefined) {
      return {
        ok: false,
        error: {
          code: 'adapter-unavailable',
          message: 'no Blender binary configured — the offscreen sidecar cannot export',
          rendererId: IDENTITY_BLENDER.rendererId,
          reason: 'blender-not-configured',
        },
      };
    }
    if (state.offscene === null) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the session has no mounted offscene scene',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    const jobId = `${state.fabricSessionId}-export-${state.preparationEvidence.length}`;
    const client = this.client();
    const outcome = await client.runJob({
      jobId,
      jobKind: 'export-gltf',
      scene: state.offscene,
    });
    if (!outcome.ok) {
      return { ok: false, error: { code: 'session-failed', message: outcome.error.message, fabricSessionId: state.fabricSessionId } };
    }
    const evidence: GltfPreparationEvidence = {
      jobId,
      entityCount: outcome.value.entityCount,
      glbDigest: outcome.value.glb!.digest,
      glbBytes: outcome.value.glb!.bytes.length,
      blenderVersion: outcome.value.blenderVersion,
      boundAssetDigests: [...state.boundAssets.keys()].sort(),
      glbBytesData: outcome.value.glb!.bytes,
    };
    state.preparationEvidence.push(evidence);
    state.blenderVersion = outcome.value.blenderVersion;
    void input.atMs;
    return { ok: true, value: evidence };
  }

  /** The presented entity ids of one live session (battery helper). */
  presentedEntityIdsOf(fabricSessionId: string): readonly string[] {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    return state === undefined ? [] : [...state.presentedEntityIds];
  }

  /** The render evidence of one live session (battery/consumer helper). */
  renderEvidenceOf(fabricSessionId: string): readonly OffscreenRenderEvidence[] {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    return state === undefined ? [] : [...state.renderEvidence];
  }

  /** The asset-preparation evidence of one live session. */
  preparationEvidenceOf(fabricSessionId: string): readonly GltfPreparationEvidence[] {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    return state === undefined ? [] : [...state.preparationEvidence];
  }

  /** The bound asset digests of one live session (digest-addressed evidence). */
  boundAssetDigestsOf(fabricSessionId: string): readonly string[] {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    return state === undefined ? [] : [...state.boundAssets.keys()].sort();
  }

  /**
   * The adapter session one fabric session hosts, by fabric session id
   * (battery helper; unknown ids and disposed sessions yield undefined).
   */
  adapterSessionOf(fabricSessionId: string): RendererAdapterSession | undefined {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    if (state === undefined || state.disposed) {
      return undefined;
    }
    return { handle: state };
  }

  /** Digest helper re-export (batteries verify artifacts independently). */
  static digestOfBytes = digestOfBytes;

  // -------------------------------------------------------------------------
  // Internals.
  // -------------------------------------------------------------------------

  private client(): BlenderSidecarClient {
    if (this.options.blenderPath === undefined) {
      throw new Error('the sidecar client requires a configured Blender path');
    }
    return new BlenderSidecarClient({
      program: this.options.blenderPath,
      argvPrefix: this.options.argvPrefix,
      runner: this.options.runner,
      workspaceDir: this.options.workspaceDir,
      limits: this.limits,
      ...(this.options.env === undefined ? {} : { env: this.options.env }),
    });
  }

  private stateOf(session: RendererAdapterSession): BlenderSessionState {
    const state = session.handle as BlenderSessionState;
    if (
      typeof state !== 'object' ||
      state === null ||
      typeof state.fabricSessionId !== 'string' ||
      typeof state.disposed !== 'boolean'
    ) {
      throw new Error('the Blender sidecar adapter received a foreign session handle');
    }
    return state;
  }

  private disposedFailure(state: BlenderSessionState): FabricResult<never> {
    return {
      ok: false,
      error: {
        code: 'session-disposed',
        message: 'the Blender sidecar session is disposed',
        fabricSessionId: state.fabricSessionId,
      },
    };
  }
}

/** Re-export the boundary failure helper for battery ergonomics. */
export { blenderFailure };
