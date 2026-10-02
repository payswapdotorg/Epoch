/**
 * @epoch/renderer-fabric — public API (experience layer, Work Order W056,
 * ACR-007 / X2.0).
 *
 * The RENDERER FABRIC: the provider-neutral orchestration layer that turns
 * the W013 renderer hosting surface into a real multi-renderer fabric
 * while preserving canonical Epoch world semantics:
 *
 * - THE ADAPTER SEAM (`RendererAdapter`): the typed interface W058
 *   (embedded interactive renderer), W059 (a second one), and W060
 *   (external/specialized foundations) implement behind the frozen
 *   contracts/renderers v1.1.0 contract. Engines receive ONLY typed
 *   inputs (the canonical W016 world scene projection, its compiled W011
 *   graphs, W013 admission receipts) and hold ONLY opaque provider-native
 *   state (never semantic state).
 * - CAPABILITY-REGISTRY INTEGRATION: renderer adapters register as
 *   `visualization`-category capability manifests honoring the
 *   `epoch.renderers` contract at the frozen version, through the REAL
 *   @epoch/capability-registry (digest-verified, lifecycle-governed:
 *   retired renderers never resolve for new sessions).
 * - EPHEMERAL SESSIONS: non-authoritative by construction — the in-memory
 *   session map is presentation state only; there is no persistence API
 *   and no second semantic store (lock rules 8/16).
 * - THE REAL W013 BOUNDARY: every binding and invocation (mount-graph,
 *   advance-frame, submit-intent) goes through the REAL
 *   @epoch/renderer-runtime admission; the fabric never bypasses the
 *   hosting surface.
 * - THE SWITCHING INVARIANT: save canonical session snapshot -> resolve
 *   target -> verify digest/tenant compatibility -> mount target from the
 *   canonical projection -> restore portable focus/layers/timeline ->
 *   emit switch receipt -> dispose previous. A failed switch aborts with
 *   the previous session RETAINED; a switch never creates durable
 *   semantic state.
 * - INPUT NORMALIZATION: raw renderer input becomes the EXISTING typed
 *   W016 world-interaction intent vocabulary (hit-test -> semantic entity
 *   id -> typed intent -> W016 admission -> W013 admission); adapters are
 *   never trusted (the Dynamic UI law is re-enforced at the boundary).
 *
 * Runtime dependencies are exactly @epoch/agent-protocol (digest
 * machinery), @epoch/capability-registry (renderer capability
 * registration), @epoch/experience-protocol (shared W011 vocabulary),
 * @epoch/renderer-runtime (the W013 hosting surface + the W056 fabric
 * contract — genuine runtime composition), and @epoch/world-experience
 * (the canonical world projection + the interaction-intent vocabulary).
 *
 * Determinism: zero wall-clock, zero randomness in src; all times are
 * caller-supplied virtual times, all ids caller-scoped.
 */
export {
  RENDERER_FABRIC_CONTRACT_VERSION,
  RENDERER_CAPABILITY_CONTRACT_ID,
  RENDERER_CAPABILITY_CATEGORY,
  DEFAULT_RENDERER_CONSTRAINT,
} from './version';

// The adapter seam.
export type {
  RendererAdapter,
  RendererAdapterIdentity,
  RendererAdapterSession,
  RendererProbeInput,
  RendererProbeReport,
  RendererSessionContext,
  RendererMountInput,
  RendererMountReport,
  RendererFrameReport,
  RendererInputTranslation,
  RendererRestoreReport,
  RendererDisposeReport,
  RendererSnapshotCaptureInput,
} from './adapter';

// Capability-registry integration.
export {
  RendererAdapterRegistry,
  rendererCapabilityManifestOf,
  type RegisterRendererInput,
} from './registry';

// The fabric orchestration.
export {
  RendererFabric,
  type CreateFabricSessionInput,
  type MountSceneInput,
  type ApplyFrameInput,
  type FrameOutcome,
  type SwitchOutcome,
  type SwitchMountInput,
} from './fabric';

// The contract-only reference adapter (the seam template; zero engines).
export {
  ReferenceRendererAdapter,
  type ReferenceRendererAdapterOptions,
} from './reference/reference-adapter';

// The W016 parity pins (compile-time; see src/parity.ts).
export type {
  PortableCameraStateParity,
  PortableFollowAgentCameraParity,
  PortableFollowCursorStateParity,
  PortableFreeCameraParity,
  PortableOrbitCameraParity,
  PortableTimelinePositionParity,
  WorldSceneIdParity,
  WorldEntityIdParity,
} from './parity';
