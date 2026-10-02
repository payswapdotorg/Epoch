/**
 * The CONTRACT-ONLY REFERENCE RENDERER ADAPTER (W056) — a deterministic,
 * zero-engine implementation of the {@link RendererAdapter} seam that
 * proves the fabric end-to-end: probe, create, mount, frame, input
 * translation (hit-test + normalization into the EXISTING W016 intent
 * vocabulary), snapshot capture, portable restore, asset binding, and
 * dispose.
 *
 * IMPORTANT (honest scope): this is NOT a real renderer. It draws
 * nothing, imports no engine, and holds no GPU state — its "presentation"
 * is a typed in-memory index of the canonical projection's presented
 * entities. Its purpose is to freeze and exercise the SEAM W058 (an
 * embedded interactive renderer) and W059 (a second one) implement
 * against; the conformance harness (qa/renderer-conformance) drives TWO
 * instances of it through the full fabric lifecycle, including switching.
 *
 * Determinism policy (renderer-independent by construction, so equivalent
 * inputs normalize to equivalent intents across instances):
 * - hit-testing partitions the viewport by the presented entity index:
 *   entityIndex = clamp(floor(x * entityCount)) — the same normalized
 *   pointer resolves the SAME semantic entity on every reference instance;
 * - pointer-down without a hint normalizes to a W016 select intent on the
 *   hit entity;
 * - pointer-down with an intent hint normalizes to the hinted W016 intent
 *   kind (select/inspect/isolate/hide/measure/annotate) targeting the hit
 *   entity (measure pairs the hit entity with the next presented entity);
 * - wheel normalizes to a W016 zoom intent (scroll up zooms in);
 * - pointer-move/pointer-up are non-activating (no-target, no intent);
 * - anything else is a typed `input-unsupported` refusal — never a silent
 *   drop, never a parallel vocabulary.
 */
import {
  captureSessionSnapshotContent,
  sealRendererSessionSnapshot,
  type DeviceSessionSnapshot,
  type FabricResult,
  type PortableViewState,
  type PortableViewStateField,
  type RendererAssetBinding,
  type RendererBinding,
  type RendererCapabilitySet,
  type RendererDescriptor,
  type RendererFrameEnvelope,
  type RendererHealth,
  type RendererInputEnvelope,
  type RendererSessionSnapshot,
  type WorldProjectionRef,
} from '@epoch/renderer-runtime';
import type { WorldInteractionIntent, WorldScene } from '@epoch/world-experience';
import type {
  RendererAdapter,
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
} from '../adapter';

/** The reference adapter's provider-native (typed, in-memory) session state. */
interface ReferenceState {
  readonly fabricSessionId: string;
  readonly binding: RendererBinding;
  readonly worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  mountedWorldDigest: string | null;
  presentedEntityIds: string[];
  frameCount: number;
  lastDegradation: string;
  disposed: boolean;
}

/** The construction options of one reference adapter instance. */
export interface ReferenceRendererAdapterOptions {
  readonly identity: RendererAdapterIdentity;
  readonly descriptor: RendererDescriptor;
  readonly capabilities: RendererCapabilitySet;
  /** Device classes this instance cannot present on (probe rejections). */
  readonly incompatibleDeviceClasses?: readonly string[];
  /** When true, every mount fails with a typed mount-failed failure (failure-path testing). */
  readonly failMounts?: boolean;
}

/** Build the typed `input-unsupported` failure. */
function inputUnsupported(inputKind: string, reason: string): FabricResult<never> {
  return {
    ok: false,
    error: { code: 'input-unsupported', message: reason, inputKind, reason },
  };
}

/**
 * The contract-only reference renderer adapter. Construct two (or more)
 * instances with different descriptors/capability sets to exercise
 * multi-renderer switching — see qa/renderer-conformance.
 */
export class ReferenceRendererAdapter implements RendererAdapter {
  private readonly options: ReferenceRendererAdapterOptions;
  /** Live session states by fabric session id (conformance-evidence lookup). */
  private readonly sessionsByFabricId = new Map<string, ReferenceState>();

  constructor(options: ReferenceRendererAdapterOptions) {
    this.options = options;
  }

  identity(): RendererAdapterIdentity {
    return this.options.identity;
  }

  descriptor(): RendererDescriptor {
    return this.options.descriptor;
  }

  capabilities(): RendererCapabilitySet {
    return this.options.capabilities;
  }

  async probe(input: RendererProbeInput): Promise<FabricResult<RendererProbeReport>> {
    const device = input.device as DeviceSessionSnapshot;
    if ((this.options.incompatibleDeviceClasses ?? []).includes(device.device.deviceClass)) {
      return {
        ok: true,
        value: {
          compatible: false,
          reason: `the reference renderer does not present on "${device.device.deviceClass}" devices`,
        },
      };
    }
    return { ok: true, value: { compatible: true, degradation: 'none' } };
  }

  async createSession(context: RendererSessionContext): Promise<FabricResult<RendererAdapterSession>> {
    const state: ReferenceState = {
      fabricSessionId: context.fabricSessionId,
      binding: context.binding,
      worldProjection: context.worldProjection,
      viewState: context.viewState,
      mountedWorldDigest: null,
      presentedEntityIds: [],
      frameCount: 0,
      lastDegradation: 'none',
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
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
    }
    if (this.options.failMounts === true) {
      return {
        ok: false,
        error: {
          code: 'mount-failed',
          message: 'the reference adapter was constructed to fail mounts (failure-path testing)',
          worldDigest: input.scene.digest,
        },
      };
    }
    // The reference presentation: the canonical scene's visible entities
    // (opaque semantic references), presented in sorted order.
    const scene: WorldScene = input.scene;
    const presented = scene.entities
      .filter((entity) => entity.visible)
      .map((entity) => entity.entityId)
      .sort();
    state.mountedWorldDigest = input.compilation.sceneDigest;
    state.presentedEntityIds = presented;
    state.frameCount = 0;
    return {
      ok: true,
      value: {
        mountedWorldDigest: input.compilation.sceneDigest,
        presentedEntityIds: presented,
        notes: `reference presentation index of ${presented.length} entities`,
      },
    };
  }

  async applyFrame(
    session: RendererAdapterSession,
    envelope: RendererFrameEnvelope,
  ): Promise<FabricResult<RendererFrameReport>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
    }
    state.frameCount += 1;
    state.lastDegradation = envelope.degradation;
    return {
      ok: true,
      value: {
        frameIndex: envelope.frameIndex,
        presented: true,
        degradation: envelope.degradation,
        notes: `reference frame ${envelope.frameIndex} over ${state.presentedEntityIds.length} entities`,
      },
    };
  }

  async translateInput(
    session: RendererAdapterSession,
    input: RendererInputEnvelope,
  ): Promise<FabricResult<RendererInputTranslation>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
    }
    if (input.inputKind === 'pointer-move' || input.inputKind === 'pointer-up') {
      return { ok: true, value: { reason: 'non-activating pointer input' } };
    }
    if (input.inputKind === 'pointer-down') {
      if (!this.options.capabilities.hitTesting) {
        return inputUnsupported(input.inputKind, 'the reference adapter does not declare hit-testing');
      }
      const hit = this.hitTest(state, input.pointer.x);
      if (hit === null) {
        return { ok: true, value: { reason: 'the pointer hit no presented entity' } };
      }
      return this.intentFor(state, input.inputId, input, hit);
    }
    if (input.inputKind === 'wheel') {
      // Deterministic zoom policy: scroll up zooms in, scroll down out,
      // no vertical delta is a no-target.
      if (input.delta.y === 0) {
        return { ok: true, value: { reason: 'no vertical wheel delta' } };
      }
      const intent: WorldInteractionIntent = {
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'zoom',
        intentId: `wi-${input.inputId}`,
        factor: input.delta.y < 0 ? 1.25 : 0.8,
      };
      return { ok: true, value: { intent } };
    }
    // key-down / key-up: the reference adapters declare pointer-only
    // interaction, so the fabric's modality gate rejects keys before this
    // point; reaching here means an undeclared modality slipped through.
    return inputUnsupported(input.inputKind, 'the reference adapter normalizes pointer and wheel input only');
  }

  async captureSnapshot(
    session: RendererAdapterSession,
    input: RendererSnapshotCaptureInput,
  ): Promise<FabricResult<RendererSessionSnapshot>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
    }
    if (!this.options.capabilities.snapshotCapture) {
      return {
        ok: false,
        error: {
          code: 'session-failed',
          message: 'the reference adapter does not declare snapshot capture',
          fabricSessionId: state.fabricSessionId,
        },
      };
    }
    const captured = captureSessionSnapshotContent({
      fabricSessionId: state.fabricSessionId,
      capturedFromRendererId: this.options.identity.rendererId,
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
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
    }
    const declared = this.options.capabilities.portableViewState;
    const applied: PortableViewStateField[] = [];
    const skipped: PortableViewStateField[] = [];
    // Declared fields are restored from the portable state. UNDECLARED
    // fields are NOT honored: optional ones are cleared, required ones keep
    // the session's own value — and every skip is reported, never silent.
    if (declared.includes('focused-entities')) {
      state.viewState = { ...state.viewState, focusedEntityIds: viewState.focusedEntityIds };
      applied.push('focused-entities');
    } else {
      skipped.push('focused-entities');
    }
    if (declared.includes('layer-visibility')) {
      state.viewState = { ...state.viewState, layerVisibility: viewState.layerVisibility };
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
      state.viewState = {
        ...state.viewState,
        camera: viewState.camera,
      };
      applied.push('camera');
    } else {
      // The camera is the one OPTIONAL portable field: a renderer that
      // does not declare it never carries one after a restore.
      state.viewState = { ...state.viewState, camera: undefined };
      skipped.push('camera');
    }
    return {
      ok: true,
      value: {
        appliedFields: applied.sort(),
        skippedFields: skipped.sort(),
      },
    };
  }

  async bindAsset(
    session: RendererAdapterSession,
    binding: RendererAssetBinding,
  ): Promise<FabricResult<{ bound: boolean }>> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { ok: false, error: { code: 'session-disposed', message: 'the reference session is disposed', fabricSessionId: state.fabricSessionId } };
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
    if (!this.options.capabilities.assetKinds.includes(binding.assetKind)) {
      return {
        ok: false,
        error: {
          code: 'asset-rejected',
          message: `the reference adapter does not bind "${binding.assetKind}" assets`,
          assetDigest: binding.assetDigest,
          reason: 'undeclared asset kind',
        },
      };
    }
    return { ok: true, value: { bound: true } };
  }

  async dispose(session: RendererAdapterSession): Promise<FabricResult<RendererDisposeReport>> {
    const state = this.stateOf(session);
    state.presentedEntityIds = [];
    state.mountedWorldDigest = null;
    state.disposed = true;
    return { ok: true, value: { disposed: true, notes: 'reference presentation state discarded' } };
  }

  async health(session: RendererAdapterSession, atMs: number): Promise<RendererHealth> {
    const state = this.stateOf(session);
    if (state.disposed) {
      return { state: 'unavailable', degradation: 'none', lastFailureCode: 'session-disposed', detail: 'disposed', atMs };
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

  /** The presented entity ids of one live session (conformance evidence helper). */
  presentedEntityIds(session: RendererAdapterSession): readonly string[] {
    return [...this.stateOf(session).presentedEntityIds];
  }

  /** The current view state of one live session (conformance evidence helper). */
  viewStateOf(session: RendererAdapterSession): PortableViewState {
    return this.stateOf(session).viewState;
  }

  /**
   * The adapter session one fabric session hosts, by fabric session id
   * (conformance-evidence helper so harnesses can inspect the reference
   * presentation without touching the fabric's internals). Unknown ids and
   * disposed sessions yield undefined (nothing survives dispose).
   */
  adapterSessionOf(fabricSessionId: string): RendererAdapterSession | undefined {
    const handle = this.sessionsByFabricId.get(fabricSessionId);
    if (handle === undefined || handle.disposed) {
      return undefined;
    }
    return { handle };
  }

  private stateOf(session: RendererAdapterSession): ReferenceState {
    const state = session.handle as ReferenceState;
    if (typeof state !== 'object' || state === null || typeof state.fabricSessionId !== 'string') {
      throw new Error('the reference adapter received a foreign session handle');
    }
    return state;
  }

  /** Deterministic hit-test: partition the viewport by the presented index. */
  private hitTest(state: ReferenceState, x: number): string | null {
    if (state.presentedEntityIds.length === 0) {
      return null;
    }
    const index = Math.min(
      state.presentedEntityIds.length - 1,
      Math.max(0, Math.floor(x * state.presentedEntityIds.length)),
    );
    return state.presentedEntityIds[index] ?? null;
  }

  /** Normalize a hinted pointer-down to the hinted W016 intent kind (deterministic). */
  private intentFor(
    state: ReferenceState,
    inputId: string,
    input: Extract<RendererInputEnvelope, { inputKind: 'pointer-down' | 'pointer-move' | 'pointer-up' }>,
    hit: string,
  ): FabricResult<RendererInputTranslation> {
    const base = {
      schema: 'epoch.world-intent' as const,
      intentVersion: 1 as const,
      intentId: `wi-${inputId}`,
    };
    const hint = input.intentHint?.intent.id;
    const refuse = (reason: string): FabricResult<RendererInputTranslation> => ({
      ok: false,
      error: {
        code: 'input-unsupported',
        message: reason,
        inputKind: 'pointer-down',
        reason,
      },
    });
    switch (hint) {
      case undefined:
      case 'epoch.world.interaction.select':
        return {
          ok: true,
          value: { hitEntityId: hit, intent: { ...base, kind: 'select' as const, entityId: hit } },
        };
      case 'epoch.world.interaction.inspect':
        return {
          ok: true,
          value: { hitEntityId: hit, intent: { ...base, kind: 'inspect' as const, entityId: hit } },
        };
      case 'epoch.world.interaction.isolate':
        return {
          ok: true,
          value: { hitEntityId: hit, intent: { ...base, kind: 'isolate' as const, entityId: hit } },
        };
      case 'epoch.world.interaction.hide':
        return {
          ok: true,
          value: { hitEntityId: hit, intent: { ...base, kind: 'hide' as const, entityIds: [hit] } },
        };
      case 'epoch.world.interaction.measure': {
        if (!this.options.capabilities.measurement) {
          return refuse('the reference adapter does not declare measurement');
        }
        // Deterministic pairing: the hit entity and the next presented entity.
        const next = nextPresentedOf(state.presentedEntityIds, hit);
        if (next === null) {
          return refuse('no second presented entity to measure against');
        }
        return {
          ok: true,
          value: {
            hitEntityId: hit,
            intent: { ...base, kind: 'measure' as const, fromEntityId: hit, toEntityId: next },
          },
        };
      }
      case 'epoch.world.interaction.annotate': {
        if (!this.options.capabilities.annotation) {
          return refuse('the reference adapter does not declare annotation');
        }
        return {
          ok: true,
          value: {
            hitEntityId: hit,
            intent: { ...base, kind: 'annotate' as const, entityId: hit, text: 'reference annotation' },
          },
        };
      }
      default:
        return refuse(`unsupported intent hint "${hint}"`);
    }
  }

}

/**
 * The next presented entity id in sorted order (wrapping; null when the
 * list has fewer than two members or the id is not presented). Module-
 * level pure helper so the policy is visibly renderer-independent.
 */
function nextPresentedOf(presentedIds: readonly string[], entityId: string): string | null {
  if (presentedIds.length < 2) {
    return null;
  }
  const index = presentedIds.indexOf(entityId);
  if (index === -1) {
    return null;
  }
  return presentedIds[(index + 1) % presentedIds.length] ?? null;
}
