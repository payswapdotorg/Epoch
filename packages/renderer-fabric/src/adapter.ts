/**
 * The RENDERER ADAPTER SEAM (W056) — the typed interface every concrete
 * renderer implements behind the frozen contracts/renderers contract:
 * W058 (an embedded interactive renderer), W059 (a second embedded
 * interactive renderer), W060 (external/specialized foundations). Engines
 * NEVER import this package's internals; they implement this interface
 * over their own provider-native state (opaque to the fabric) and receive
 * ONLY typed inputs: the canonical W016 world scene projection, its
 * compiled W011 graphs, and the W013 admission receipts.
 *
 * Division of labor (the fabric vs. the adapter):
 * - the FABRIC owns the W013 boundary (binding + invocation admission
 *   through the REAL @epoch/renderer-runtime entry points) and the
 *   canonical-projection mount pipeline (W016 compile -> W013 admit);
 * - the ADAPTER owns provider-native presentation: building its
 *   presentation state from the admitted typed data, executing frames,
 *   hit-testing raw input against ITS presentation, and normalizing that
 *   input into the EXISTING typed Epoch world-interaction intent
 *   vocabulary (@epoch/world-experience — never a parallel vocabulary);
 * - the ADAPTER's session state is OPAQUE to the fabric (an unknown
 *   handle) and EPHEMERAL by construction: nothing an adapter holds is
 *   semantic state, and nothing survives dispose.
 *
 * Determinism discipline: every method takes caller-supplied virtual
 * times; adapters MUST NOT read wall clocks or randomness. All methods
 * are async because concrete engines initialize asynchronously — the
 * contract-only reference adapter resolves immediately.
 */
import type {
  DeviceSessionSnapshot,
  FabricResult,
  PortableViewState,
  PortableViewStateField,
  RendererAssetBinding,
  RendererBinding,
  RendererCapabilitySet,
  RendererDegradationKind,
  RendererDescriptor,
  RendererFrameEnvelope,
  RendererHealth,
  RendererId,
  RendererInputEnvelope,
  RendererReceipt,
  RendererSessionSnapshot,
  WorldProjectionRef,
} from '@epoch/renderer-runtime';
import type {
  SceneCompilation,
  WorldInteractionIntent,
  WorldScene,
} from '@epoch/world-experience';

/** The neutral identity of one registered renderer adapter. */
export interface RendererAdapterIdentity {
  /** The capability-registry identity backing this adapter. */
  readonly capabilityId: string;
  /** The W013 renderer descriptor identity this adapter serves. */
  readonly rendererId: RendererId;
  /** Neutral display name for the Epoch renderer selector. */
  readonly displayName: string;
  /** Optional neutral description. */
  readonly description?: string;
}

/** The input of one compatibility probe. */
export interface RendererProbeInput {
  readonly device: DeviceSessionSnapshot;
  readonly atMs: number;
}

/** The report of one compatibility probe. */
export interface RendererProbeReport {
  /** Whether the adapter can present on the probed device session. */
  readonly compatible: boolean;
  /** Neutral reason when incompatible. */
  readonly reason?: string;
  /** The degradation the adapter would present under (when compatible but reduced). */
  readonly degradation?: RendererDegradationKind;
}

/** The context one adapter session is created under. */
export interface RendererSessionContext {
  readonly fabricSessionId: string;
  readonly binding: RendererBinding;
  readonly worldProjection: WorldProjectionRef;
  readonly viewState: PortableViewState;
  readonly createdAtMs: number;
}

/** One adapter-owned session (the handle is opaque provider-native state). */
export interface RendererAdapterSession {
  readonly handle: unknown;
}

/** The typed mount input: the canonical projection plus its admitted execution evidence. */
export interface RendererMountInput {
  /** The canonical world scene (the W016 projection — semantic identity by reference). */
  readonly scene: WorldScene;
  /** The compiled W011 graphs and W013 envelopes of this revision. */
  readonly compilation: SceneCompilation;
  /** The W013 receipts of every admitted invocation of this mount. */
  readonly admittedReceipts: readonly RendererReceipt[];
}

/** The report of one mount. */
export interface RendererMountReport {
  /** The canonical world digest that was mounted (continuity anchor). */
  readonly mountedWorldDigest: string;
  /** The semantic entity ids the adapter presented (opaque references). */
  readonly presentedEntityIds: readonly string[];
  /** Optional neutral notes (presentation-only). */
  readonly notes?: string;
}

/** The report of one applied frame. */
export interface RendererFrameReport {
  readonly frameIndex: number;
  readonly presented: boolean;
  readonly degradation: RendererDegradationKind;
  readonly notes?: string;
}

/** The result of one input translation (hit-test + normalization). */
export interface RendererInputTranslation {
  /** The semantic entity the adapter hit-tested (absent when nothing was hit). */
  readonly hitEntityId?: string;
  /**
   * The normalized typed Epoch world-interaction intent (the EXISTING
   * W016 vocabulary — select/inspect/measure/... — never a parallel one).
   * Absent when the input hit no target or was refused.
   */
  readonly intent?: WorldInteractionIntent;
  /** Neutral reason when the input could not be normalized (typed refusal). */
  readonly reason?: string;
}

/** The report of one portable view-state restore. */
export interface RendererRestoreReport {
  /** The portable fields the adapter applied (sorted). */
  readonly appliedFields: readonly PortableViewStateField[];
  /**
   * The portable fields the adapter SKIPPED because its capability set
   * does not declare them — typed, never silent (the fabric also filters
   * by capability before calling).
   */
  readonly skippedFields: readonly PortableViewStateField[];
}

/** The report of one dispose. */
export interface RendererDisposeReport {
  readonly disposed: boolean;
  readonly notes?: string;
}

/** The metadata one snapshot capture needs (the fabric supplies the counters). */
export interface RendererSnapshotCaptureInput {
  readonly invocationCount: number;
  readonly switchCount: number;
  readonly atMs: number;
}

/**
 * THE RENDERER ADAPTER SEAM. Implemented by concrete renderer adapters
 * (W058/W059/W060) and by the contract-only reference adapter shipped
 * with the fabric (src/reference — the seam template, zero engines).
 */
export interface RendererAdapter {
  /** The adapter's neutral identity (capability + descriptor ids). */
  identity(): RendererAdapterIdentity;
  /** The W013 renderer descriptor this adapter serves (hosting declaration). */
  descriptor(): RendererDescriptor;
  /** The fabric capability set this adapter declares. */
  capabilities(): RendererCapabilitySet;

  /** Probe compatibility with a device session (pure, no side effects). */
  probe(input: RendererProbeInput): Promise<FabricResult<RendererProbeReport>>;

  /** Create one ephemeral adapter session under a fabric session context. */
  createSession(context: RendererSessionContext): Promise<FabricResult<RendererAdapterSession>>;

  /** Mount (or replace) the presentation from the canonical projection + admitted evidence. */
  mountProjection(
    session: RendererAdapterSession,
    input: RendererMountInput,
  ): Promise<FabricResult<RendererMountReport>>;

  /** Apply one admitted frame envelope to the mounted presentation. */
  applyFrame(
    session: RendererAdapterSession,
    envelope: RendererFrameEnvelope,
  ): Promise<FabricResult<RendererFrameReport>>;

  /**
   * Translate ONE raw input envelope: hit-test against the adapter's
   * presentation and normalize to the EXISTING typed Epoch intent
   * vocabulary. A miss is a translation with no intent (no-target), not
   * a failure.
   */
  translateInput(
    session: RendererAdapterSession,
    input: RendererInputEnvelope,
  ): Promise<FabricResult<RendererInputTranslation>>;

  /** Capture the portable view-state snapshot of this session. */
  captureSnapshot(
    session: RendererAdapterSession,
    input: RendererSnapshotCaptureInput,
  ): Promise<FabricResult<RendererSessionSnapshot>>;

  /**
   * Restore the portable view state after a canonical-projection mount
   * (the switching invariant's restore step). The fabric has already
   * filtered the fields by the adapter's declared capabilities.
   */
  restoreViewState(
    session: RendererAdapterSession,
    viewState: PortableViewState,
  ): Promise<FabricResult<RendererRestoreReport>>;

  /** Bind one content-addressed asset (optional: only adapters with declared asset kinds). */
  bindAsset?(
    session: RendererAdapterSession,
    binding: RendererAssetBinding,
  ): Promise<FabricResult<{ bound: boolean }>>;

  /** Dispose the session (terminal for the adapter's provider-native state). */
  dispose(session: RendererAdapterSession): Promise<FabricResult<RendererDisposeReport>>;

  /** The health projection of one live session at a virtual time. */
  health(session: RendererAdapterSession, atMs: number): Promise<RendererHealth>;
}
