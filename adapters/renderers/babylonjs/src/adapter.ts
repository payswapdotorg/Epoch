/**
 * THE BABYLON.JS RENDERER ADAPTER (W059) — the second interchangeable
 * interactive renderer behind the frozen W056 `RendererAdapter` seam.
 *
 * It implements the SAME canonical scene/interaction contract as the first
 * embedded renderer (W058): scene mounting from canonical envelopes (the
 * compiled W011 graphs + the canonical W016 scene), semantic picking
 * (Babylon picking -> semantic entity ids), camera controls
 * (ArcRotate/pan/zoom, presentation-only interpolation), overlays/materials/
 * animations + layer visibility, measurement/annotation affordances
 * (normalized to canonical W016 intents — NEVER durable writes), visible
 * agent representations, declared fidelity budgets, frame capture where the
 * host provides GL, and safe disposal (scene.dispose() + engine.dispose();
 * disposed sessions refuse everything with typed failures).
 *
 * What Babylon.js NEVER gets here: semantic authority. The adapter holds
 * only provider-native, disposable presentation state; the canonical scene
 * is never mutated; inputs normalize into the EXISTING W016 intent
 * vocabulary (re-admitted by the fabric through the W016 total admission);
 * there is no durable write anywhere. NO Babylon editor/playground UI is
 * attached — the visible surface is Epoch's viewport (the adapter wires no
 * Babylon input controls; every input arrives through the fabric's typed
 * envelopes).
 *
 * Determinism: every method takes caller-supplied virtual times; the
 * adapter core reads no wall clock and no randomness (the injected
 * headless host uses Babylon's deterministic lock-step engine).
 */
import type { Scene } from '@babylonjs/core/scene.js';
import { Scene as BabylonScene } from '@babylonjs/core/scene.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import {
  captureSessionSnapshotContent,
  sealRendererSessionSnapshot,
  type FabricResult,
  type PortableViewState,
  type PortableViewStateField,
  type RendererAssetBinding,
  type RendererBinding,
  type RendererCapabilitySet,
  type RendererDescriptor,
  type RendererFailure,
  type RendererFrameEnvelope,
  type RendererHealth,
  type RendererInputEnvelope,
  type RendererSessionSnapshot,
  type WorldProjectionRef,
} from '@epoch/renderer-runtime';
import type { RendererAdapter, RendererAdapterIdentity, RendererAdapterSession, RendererDisposeReport, RendererFrameReport, RendererInputTranslation, RendererMountInput, RendererMountReport, RendererProbeInput, RendererProbeReport, RendererRestoreReport, RendererSessionContext, RendererSnapshotCaptureInput } from '@epoch/renderer-fabric';
import {
  BABYLONJS_CAPABILITIES,
  BABYLONJS_CAPABILITY_ID,
  BABYLONJS_DESCRIPTION,
  BABYLONJS_DESCRIPTOR,
  BABYLONJS_DISPLAY_NAME,
  BABYLONJS_RENDERER_ID,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './version';
import type { BabylonEngineHost, BabylonFrameCapture } from './host';
import { nullEngineHost } from './host';
import {
  buildPresentation,
  type BabylonEntityMetadata,
  type BabylonLabelRecord,
  type BabylonPresentation,
} from './mapping';
import { pickEntityAt, projectedPositionOf } from './picking';
import {
  normalizeKey,
  normalizePointerDown,
  zoomIntentOf,
} from './normalize';
import {
  applyDegradation,
  degradationStateOf,
  probeDegradationOf,
  type DegradationState,
} from './degrade';
import {
  babylonCameraOf,
  orbitBabylonCamera,
  panBabylonCamera,
  portableCameraOf,
  zoomBabylonCamera,
  type BabylonCamera,
} from './camera';

/** The provider-native (disposable) state of one adapter session. */
interface BabylonSessionState {
  readonly fabricSessionId: string;
  readonly binding: RendererBinding;
  readonly worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  engine: AbstractEngine | null;
  scene: Scene | null;
  camera: BabylonCamera | null;
  presentation: BabylonPresentation | null;
  mountedWorldDigest: string | null;
  frameCount: number;
  lastFrameIndex: number | null;
  lastDegradation: string;
  degradation: DegradationState;
  lastPointer: { x: number; y: number } | null;
  pointerDragActive: boolean;
  disposed: boolean;
  engineDisposed: boolean;
  assetBindings: RendererAssetBinding[];
}

/** The construction options of one Babylon renderer adapter instance. */
export interface BabylonRendererAdapterOptions {
  /** The injected GL path: headless (NullEngine) or browser (WebGL canvas). */
  readonly host: BabylonEngineHost;
  /** Overrides the neutral identity (defaults to the Babylon constants). */
  readonly identity?: Partial<RendererAdapterIdentity>;
  /** Overrides the W013 descriptor (defaults to the Babylon descriptor). */
  readonly descriptor?: RendererDescriptor;
  /** Overrides the W056 capability set (defaults to the full set). */
  readonly capabilities?: RendererCapabilitySet;
  /** Device classes this instance cannot present on (probe rejections). */
  readonly incompatibleDeviceClasses?: readonly string[];
  /** When true, every mount fails with a typed mount-failed failure. */
  readonly failMounts?: boolean;
  /**
   * The deterministic placeholder text of annotation intents (the seam
   * template's policy: the typed hint carries no free-text payload, so the
   * renderer synthesizes the placeholder the Epoch chrome replaces through
   * canonical records).
   */
  readonly annotationText?: string;
  /**
   * Optional pure classifier mapping semantic entity ids to semantic layer
   * ids (presentation-only: restores layer visibility onto meshes). When
   * absent, layer visibility is tracked as portable state only.
   */
  readonly layerOfEntity?: (entityId: string) => string | undefined;
}

/** The typed session-disposed failure. */
function sessionDisposed(state: BabylonSessionState): { ok: false; error: RendererFailure } {
  return {
    ok: false,
    error: {
      code: 'session-disposed',
      message: 'the Babylon.js session is disposed (terminal) — invocations are rejected',
      fabricSessionId: state.fabricSessionId,
    },
  };
}

/** The typed input-unsupported failure. */
function inputUnsupported(inputKind: string, reason: string): { ok: false; error: RendererFailure } {
  return {
    ok: false,
    error: { code: 'input-unsupported', message: reason, inputKind, reason },
  };
}

/**
 * The Babylon.js renderer adapter. Construct with the headless host for CI
 * (`nullEngineHost()`) or the browser host (`webCanvasEngineHost(canvas)`)
 * — the deterministic core is identical; only the engine differs.
 */
export class BabylonRendererAdapter implements RendererAdapter {
  private readonly options: BabylonRendererAdapterOptions;
  private readonly sessionsByFabricId = new Map<string, BabylonSessionState>();

  constructor(options: BabylonRendererAdapterOptions) {
    this.options = options;
  }

  // -------------------------------------------------------------------------
  // declaration
  // -------------------------------------------------------------------------

  identity(): RendererAdapterIdentity {
    return {
      capabilityId: this.options.identity?.capabilityId ?? BABYLONJS_CAPABILITY_ID,
      rendererId: this.options.identity?.rendererId ?? BABYLONJS_RENDERER_ID,
      displayName: this.options.identity?.displayName ?? BABYLONJS_DISPLAY_NAME,
      description: this.options.identity?.description ?? BABYLONJS_DESCRIPTION,
    };
  }

  descriptor(): RendererDescriptor {
    return this.options.descriptor ?? BABYLONJS_DESCRIPTOR;
  }

  capabilities(): RendererCapabilitySet {
    return this.options.capabilities ?? BABYLONJS_CAPABILITIES;
  }

  // -------------------------------------------------------------------------
  // lifecycle: probe -> create -> mount -> frame -> input -> switch -> dispose
  // -------------------------------------------------------------------------

  async probe(input: RendererProbeInput): Promise<FabricResult<RendererProbeReport>> {
    const deviceClass = input.device.device.deviceClass;
    if ((this.options.incompatibleDeviceClasses ?? ['headset']).includes(deviceClass)) {
      return {
        ok: true,
        value: {
          compatible: false,
          reason: `the Babylon.js adapter does not present on "${deviceClass}" devices (no WebXR session management is wired)`,
        },
      };
    }
    const degradation = probeDegradationOf(input.device.device.display.maxPixels);
    return { ok: true, value: { compatible: true, degradation } };
  }

  async createSession(context: RendererSessionContext): Promise<FabricResult<RendererAdapterSession>> {
    const engine = await this.options.host.createEngine();
    const scene = new BabylonScene(engine);
    // One deterministic ambient light (presentation shading; picking is
    // geometry-based and light-independent).
    new HemisphericLight('epoch-ambient', new Vector3(0, 1, 0), scene);
    const state: BabylonSessionState = {
      fabricSessionId: context.fabricSessionId,
      binding: context.binding,
      worldProjection: context.worldProjection,
      viewState: context.viewState,
      engine,
      scene,
      camera: null,
      presentation: null,
      mountedWorldDigest: null,
      frameCount: 0,
      lastFrameIndex: null,
      lastDegradation: 'none',
      degradation: degradationStateOf('none'),
      lastPointer: null,
      pointerDragActive: false,
      disposed: false,
      engineDisposed: false,
      assetBindings: [],
    };
    // The session camera starts from the portable view state's camera (the
    // switch continuity surface) — a mount without one falls back to the
    // canonical scene camera.
    this.setCamera(state, context.viewState.camera ?? undefined);
    this.sessionsByFabricId.set(context.fabricSessionId, state);
    return { ok: true, value: { handle: state } };
  }

  async mountProjection(
    session: RendererAdapterSession,
    input: RendererMountInput,
  ): Promise<FabricResult<RendererMountReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
    }
    if (this.options.failMounts === true) {
      return {
        ok: false,
        error: {
          code: 'mount-failed',
          message: 'the Babylon.js adapter was constructed to fail mounts (failure-path testing)',
          worldDigest: input.scene.digest,
        },
      };
    }
    const scene = state.scene!;
    // Provider-native state is disposable: the presentation is REBUILT from
    // the admitted canonical data (never patched).
    const presentation = buildPresentation(scene, input.compilation, input.scene);
    state.presentation = presentation;
    state.mountedWorldDigest = input.compilation.sceneDigest;
    state.frameCount = 0;
    state.lastFrameIndex = null;
    // The camera follows the SESSION's portable view state when it carries
    // one (switch continuity), else the canonical scene camera.
    this.setCamera(state, state.viewState.camera ?? input.scene.camera);
    // Apply the current layer visibility to the fresh meshes.
    this.applyLayerVisibility(state);
    // Keep the ambient light deterministic across remounts.
    const presented = presentation.presentedEntityIds;
    const notes = [
      `babylonjs scene graph: ${presented.length} entity meshes, ${presentation.agentMeshes.size} agent representations, ${presentation.labels.length} labels, ${presentation.clips.length} clips`,
      ...presentation.notes,
    ].join('; ');
    return {
      ok: true,
      value: {
        mountedWorldDigest: input.compilation.sceneDigest,
        presentedEntityIds: presented,
        notes,
      },
    };
  }

  async applyFrame(
    session: RendererAdapterSession,
    envelope: RendererFrameEnvelope,
  ): Promise<FabricResult<RendererFrameReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
    }
    // Degradation is DECLARED-only (the fabric already refused undeclared
    // kinds); the adapter applies the typed flags deterministically.
    if (envelope.degradation !== state.lastDegradation) {
      state.degradation = degradationStateOf(envelope.degradation);
      state.lastDegradation = envelope.degradation;
      if (state.scene !== null && state.engine !== null && state.presentation !== null) {
        applyDegradation(
          state.scene,
          state.engine,
          state.presentation.entityMeshes.values(),
          state.degradation,
        );
      }
    }
    state.frameCount += 1;
    state.lastFrameIndex = envelope.frameIndex;
    // static-frame: presentation stops advancing (the last presented frame
    // stays); otherwise the host presents one frame of the scene.
    if (!state.degradation.staticFrame && state.scene !== null) {
      const present = this.options.host.presentFrame ?? ((s: Scene) => s.render());
      present(state.scene);
    }
    return {
      ok: true,
      value: {
        frameIndex: envelope.frameIndex,
        presented: !state.degradation.staticFrame,
        degradation: envelope.degradation,
        notes: `babylonjs frame ${envelope.frameIndex} (${state.frameCount} presented)`,
      },
    };
  }

  async translateInput(
    session: RendererAdapterSession,
    input: RendererInputEnvelope,
  ): Promise<FabricResult<RendererInputTranslation>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
    }
    switch (input.inputKind) {
      case 'pointer-down':
      case 'pointer-move':
      case 'pointer-up':
        return this.translatePointer(state, input);
      case 'wheel':
        return this.translateWheel(state, input);
      case 'key-down':
      case 'key-up':
        return this.translateKey(state, input);
    }
  }

  async captureSnapshot(
    session: RendererAdapterSession,
    input: RendererSnapshotCaptureInput,
  ): Promise<FabricResult<RendererSessionSnapshot>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
    }
    if (!this.capabilities().snapshotCapture) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the Babylon.js adapter does not declare snapshot capture',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    const captured = captureSessionSnapshotContent({
      fabricSessionId: state.fabricSessionId,
      capturedFromRendererId: this.identity().rendererId,
      worldProjection: state.worldProjection,
      viewState: this.liveViewStateOf(state),
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
      return sessionDisposed(state);
    }
    const declared = this.capabilities().portableViewState;
    const applied: PortableViewStateField[] = [];
    const skipped: PortableViewStateField[] = [];
    if (declared.includes('focused-entities')) {
      state.viewState = { ...state.viewState, focusedEntityIds: viewState.focusedEntityIds };
      applied.push('focused-entities');
    } else {
      skipped.push('focused-entities');
    }
    if (declared.includes('layer-visibility')) {
      state.viewState = { ...state.viewState, layerVisibility: viewState.layerVisibility };
      this.applyLayerVisibility(state);
      applied.push('layer-visibility');
    } else {
      skipped.push('layer-visibility');
    }
    if (declared.includes('timeline-position')) {
      state.viewState = { ...state.viewState, timelinePosition: viewState.timelinePosition };
      applied.push('timeline-position');
    } else {
      skipped.push('timeline-position');
    }
    if (declared.includes('camera')) {
      state.viewState = { ...state.viewState, camera: viewState.camera };
      if (viewState.camera !== undefined) {
        this.setCamera(state, viewState.camera);
      }
      applied.push('camera');
    } else {
      // The camera is the one OPTIONAL portable field: an adapter that does
      // not declare it never carries one after a restore.
      state.viewState = { ...state.viewState, camera: undefined };
      skipped.push('camera');
    }
    return { ok: true, value: { appliedFields: applied.sort(), skippedFields: skipped.sort() } };
  }

  async bindAsset(
    session: RendererAdapterSession,
    binding: RendererAssetBinding,
  ): Promise<FabricResult<{ bound: boolean }>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
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
    if (!this.capabilities().assetKinds.includes(binding.assetKind)) {
      return {
        ok: false,
        error: {
          code: 'asset-rejected',
          message: `the Babylon.js adapter does not bind "${binding.assetKind}" assets`,
          assetDigest: binding.assetDigest,
          reason: 'undeclared asset kind',
        },
      };
    }
    state.assetBindings.push(binding);
    return { ok: true, value: { bound: true } };
  }

  async dispose(session: RendererAdapterSession): Promise<FabricResult<RendererDisposeReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: true, value: { disposed: true, notes: 'already disposed' } };
    }
    // SAFE DISPOSAL: the provider-native scene graph first, then the
    // engine. Nothing survives dispose.
    state.scene?.dispose();
    state.engine?.dispose();
    state.engineDisposed = true;
    state.scene = null;
    state.engine = null;
    state.camera = null;
    state.presentation = null;
    state.mountedWorldDigest = null;
    state.lastPointer = null;
    state.pointerDragActive = false;
    state.assetBindings = [];
    state.disposed = true;
    return {
      ok: true,
      value: {
        disposed: true,
        notes: 'babylonjs scene disposed, babylonjs engine disposed, presentation state discarded',
      },
    };
  }

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
    return { state: 'healthy', degradation: 'none', atMs };
  }

  // -------------------------------------------------------------------------
  // adapter-owned extensions (outside the frozen seam — evidence/capture)
  // -------------------------------------------------------------------------

  /**
   * Frame/evidence capture (DECLARED in the capability set). Requires the
   * injected host's GL capture path: the browser host captures real PNG
   * bytes through Babylon's screenshot tooling; headless hosts refuse with
   * a TYPED failure — no fabricated evidence (see docs/rendering/
   * babylonjs.md for the honest headless/browser split).
   */
  async captureFrame(
    session: RendererAdapterSession,
    atMs: number,
  ): Promise<FabricResult<BabylonFrameCapture>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return sessionDisposed(state);
    }
    if (!this.capabilities().frameCapture) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the Babylon.js adapter does not declare frame capture',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    const capture = this.options.host.captureFrame;
    if (capture === undefined || state.engine === null || state.scene === null) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message:
            'frame capture requires a GL capture host (the headless NullEngine host cannot rasterize) — run the browser host for real frame evidence',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    try {
      const frame = await capture({ engine: state.engine, scene: state.scene, atMs });
      return { ok: true, value: frame };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: `the GL capture path failed: ${err instanceof Error ? err.message : String(err)}`,
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
  }

  /** The presented semantic entity ids of one live session (evidence helper). */
  presentedEntityIds(session: RendererAdapterSession): readonly string[] {
    return [...(this.stateOf(session).presentation?.presentedEntityIds ?? [])];
  }

  /** The current tracked portable view state (evidence helper). */
  viewStateOf(session: RendererAdapterSession): PortableViewState {
    return this.stateOf(session).viewState;
  }

  /** The live portable view state, camera captured from the Babylon camera. */
  liveViewStateOf(state: BabylonSessionState): PortableViewState {
    const camera =
      state.camera !== null ? portableCameraOf(state.camera) : state.viewState.camera;
    return { ...state.viewState, camera };
  }

  /** The semantic entity metadata of one presented entity (evidence helper). */
  entityMetadataOf(
    session: RendererAdapterSession,
    entityId: string,
  ): BabylonEntityMetadata | undefined {
    return this.stateOf(session).presentation?.entityMeshes.get(entityId)?.metadata as
      | BabylonEntityMetadata
      | undefined;
  }

  /** The Babylon mesh of one presented entity (introspection/testing). */
  entityMeshOf(session: RendererAdapterSession, entityId: string): Mesh | undefined {
    return this.stateOf(session).presentation?.entityMeshes.get(entityId);
  }

  /** The presented agent ids of one live session (evidence helper). */
  presentedAgentIds(session: RendererAdapterSession): readonly string[] {
    return [...(this.stateOf(session).presentation?.agentMeshes.keys() ?? [])].sort();
  }

  /** The anchored labels of the mounted presentation (evidence helper). */
  labelsOf(session: RendererAdapterSession): readonly BabylonLabelRecord[] {
    return this.stateOf(session).presentation?.labels ?? [];
  }

  /** The build notes of the mounted presentation (diagnostics). */
  presentationNotesOf(session: RendererAdapterSession): readonly string[] {
    return this.stateOf(session).presentation?.notes ?? [];
  }

  /** Whether the engine of one session was disposed (safe-disposal evidence). */
  engineDisposedOf(session: RendererAdapterSession): boolean {
    return this.stateOf(session).engineDisposed;
  }

  /** The bound asset records of one session (evidence helper). */
  boundAssetsOf(session: RendererAdapterSession): readonly RendererAssetBinding[] {
    return [...(this.stateOf(session).assetBindings ?? [])];
  }

  /**
   * The deterministic normalized-viewport position of one presented entity
   * (the inverse of picking — tests, agents and follow surfaces use it).
   */
  projectedPositionOf(
    session: RendererAdapterSession,
    entityId: string,
  ): { readonly x: number; readonly y: number } | null {
    const state = this.stateOf(session);
    if (state.presentation === null || state.scene === null || state.camera === null || state.engine === null) {
      return null;
    }
    const mesh = state.presentation.entityMeshes.get(entityId);
    if (mesh === undefined) {
      return null;
    }
    return projectedPositionOf(
      state.scene,
      state.camera as TargetCamera,
      state.engine,
      state.presentation.entityMeshes.values(),
      mesh,
    );
  }

  /** The deterministic hit-test of one normalized pointer (evidence helper). */
  pickAt(session: RendererAdapterSession, x: number, y: number): string | null {
    const state = this.stateOf(session);
    if (state.presentation === null || state.scene === null || state.camera === null || state.engine === null) {
      return null;
    }
    return pickEntityAt(
      state.scene,
      state.camera as TargetCamera,
      state.engine,
      state.presentation.entityMeshes.values(),
      x,
      y,
    );
  }

  /** The camera kind the live session presents with ('orbit' | 'free'). */
  cameraModeOf(session: RendererAdapterSession): 'orbit' | 'free' {
    const camera = this.stateOf(session).camera;
    return camera !== null && camera.getClassName() === 'FreeCamera' ? 'free' : 'orbit';
  }

  /**
   * The adapter session one fabric session hosts, by fabric session id
   * (conformance-evidence helper; unknown ids and disposed sessions yield
   * undefined — nothing survives dispose).
   */
  adapterSessionOf(fabricSessionId: string): RendererAdapterSession | undefined {
    const state = this.sessionsByFabricId.get(fabricSessionId);
    if (state === undefined || state.disposed) {
      return undefined;
    }
    return { handle: state };
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  private translatePointer(
    state: BabylonSessionState,
    input: Extract<RendererInputEnvelope, { inputKind: 'pointer-down' | 'pointer-move' | 'pointer-up' }>,
  ): FabricResult<RendererInputTranslation> {
    const { x, y } = input.pointer;
    if (input.inputKind === 'pointer-move') {
      // Presentation-only camera reaction while a drag is active (never an
      // intent): orbit the live camera by the drag delta.
      if (state.pointerDragActive && state.lastPointer !== null && state.camera !== null) {
        orbitBabylonCamera(state.camera, x - state.lastPointer.x, y - state.lastPointer.y);
      }
      state.lastPointer = { x, y };
      return { ok: true, value: { reason: 'non-activating pointer input' } };
    }
    if (input.inputKind === 'pointer-up') {
      state.pointerDragActive = false;
      state.lastPointer = { x, y };
      return { ok: true, value: { reason: 'non-activating pointer input' } };
    }
    // pointer-down: the semantic path — Babylon hit-test -> entity id.
    state.pointerDragActive = true;
    state.lastPointer = { x, y };
    if (!this.capabilities().hitTesting) {
      return inputUnsupported(input.inputKind, 'the Babylon.js adapter does not declare hit-testing');
    }
    if (state.presentation === null || state.scene === null || state.camera === null || state.engine === null) {
      return { ok: true, value: { reason: 'no mounted presentation' } };
    }
    const hit = pickEntityAt(
      state.scene,
      state.camera as TargetCamera,
      state.engine,
      state.presentation.entityMeshes.values(),
      x,
      y,
    );
    const hint = input.intentHint?.intent;
    if (hint !== undefined && hint.version !== '1.0.0') {
      return inputUnsupported(input.inputKind, `unsupported intent hint version "${hint.version}"`);
    }
    const outcome = normalizePointerDown(
      input.inputId,
      hit,
      hint,
      state.presentation.presentedEntityIds,
      { measurement: this.capabilities().measurement, annotation: this.capabilities().annotation },
      this.options.annotationText ?? 'babylonjs annotation',
    );
    if (outcome.outcome === 'refused') {
      return inputUnsupported(input.inputKind, outcome.reason);
    }
    if (outcome.outcome === 'no-target') {
      return { ok: true, value: { reason: outcome.reason } };
    }
    return {
      ok: true,
      value: {
        hitEntityId: hit ?? undefined,
        intent: outcome.intent,
      },
    };
  }

  private translateWheel(
    state: BabylonSessionState,
    input: Extract<RendererInputEnvelope, { inputKind: 'wheel' }>,
  ): FabricResult<RendererInputTranslation> {
    if (input.delta.y === 0) {
      return { ok: true, value: { reason: 'no vertical wheel delta' } };
    }
    const intent = zoomIntentOf(input.inputId, input.delta.y);
    // Presentation-only camera reaction (the semantic zoom intent flows
    // through the fabric; the camera zoom is the adapter's reaction).
    if (state.camera !== null) {
      zoomBabylonCamera(state.camera, input.delta.y < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR);
    }
    return { ok: true, value: { intent } };
  }

  private translateKey(
    state: BabylonSessionState,
    input: Extract<RendererInputEnvelope, { inputKind: 'key-down' | 'key-up' }>,
  ): FabricResult<RendererInputTranslation> {
    // Presentation-only camera reaction for the camera keys (deterministic
    // fixed steps; never an intent).
    if (
      input.inputKind === 'key-down' &&
      state.camera !== null &&
      input.key.modifiers.length === 0
    ) {
      switch (input.key.key) {
        case 'ArrowLeft':
          orbitBabylonCamera(state.camera, -0.1, 0);
          break;
        case 'ArrowRight':
          orbitBabylonCamera(state.camera, 0.1, 0);
          break;
        case 'ArrowUp':
          orbitBabylonCamera(state.camera, 0, -0.1);
          break;
        case 'ArrowDown':
          orbitBabylonCamera(state.camera, 0, 0.1);
          break;
        case 'w':
          panBabylonCamera(state.camera, 0, 0.1);
          break;
        case 's':
          panBabylonCamera(state.camera, 0, -0.1);
          break;
        case 'a':
          panBabylonCamera(state.camera, -0.1, 0);
          break;
        case 'd':
          panBabylonCamera(state.camera, 0.1, 0);
          break;
        default:
          break;
      }
    }
    const outcome = normalizeKey(input.inputId, input.key, input.inputKind);
    if (outcome.outcome === 'refused') {
      return inputUnsupported(input.inputKind, outcome.reason);
    }
    if (outcome.outcome === 'no-target') {
      return { ok: true, value: { reason: outcome.reason } };
    }
    return { ok: true, value: { intent: outcome.intent } };
  }

  /** (Re)build the session camera from one portable camera state. */
  private setCamera(state: BabylonSessionState, camera: PortableViewState['camera']): void {
    if (state.scene === null) {
      return;
    }
    const anchors = {
      agentPositionOf: (agentId: string) => {
        const mesh = state.presentation?.agentMeshes.get(agentId);
        return mesh?.getAbsolutePosition();
      },
    };
    const next =
      camera !== undefined
        ? babylonCameraOf(state.scene, camera, anchors)
        : babylonCameraOf(
            state.scene,
            {
              mode: 'orbit',
              position: [30, 30, 30],
              target: [0, 0, 0],
            },
            anchors,
          );
    const previous = state.camera;
    state.camera = next;
    state.scene.activeCamera = next;
    previous?.dispose();
  }

  /** Apply the tracked layer visibility onto the meshes (presentation-only). */
  private applyLayerVisibility(state: BabylonSessionState): void {
    if (state.presentation === null || this.options.layerOfEntity === undefined) {
      return;
    }
    const layerVisible = new Map(
      state.viewState.layerVisibility.map((entry) => [entry.layerId, entry.visible]),
    );
    for (const [entityId, mesh] of state.presentation.entityMeshes) {
      const layerId = this.options.layerOfEntity(entityId);
      if (layerId === undefined) {
        continue;
      }
      const visible = layerVisible.get(layerId);
      if (visible !== undefined) {
        mesh.setEnabled(visible);
      }
    }
  }

  private stateOf(session: RendererAdapterSession): BabylonSessionState {
    const state = session.handle as BabylonSessionState;
    if (
      typeof state !== 'object' ||
      state === null ||
      typeof state.fabricSessionId !== 'string' ||
      typeof state.disposed !== 'boolean'
    ) {
      throw new Error('the Babylon.js adapter received a foreign session handle');
    }
    return state;
  }
}

/** Build a Babylon renderer adapter over the headless (NullEngine) host by default. */
export function babylonjsRendererAdapter(
  options: Omit<BabylonRendererAdapterOptions, 'host'> & { readonly host?: BabylonEngineHost } = {},
): BabylonRendererAdapter {
  return new BabylonRendererAdapter({ host: options.host ?? nullEngineHost(), ...options });
}
