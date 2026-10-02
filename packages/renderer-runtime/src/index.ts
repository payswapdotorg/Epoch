/**
 * @epoch/renderer-runtime — public API (experience layer, Work Order
 * W013).
 *
 * The renderer HOSTING surface of the Epoch Experience layer
 * (architecture.md "Experience Runtime" — binding): abstract,
 * provider-neutral renderer descriptors (kind, capabilities, budgets as
 * typed data), renderer-session binding (descriptor x device-session
 * snapshot) with negotiated effective limits, typed invocation envelopes
 * (mount-graph / advance-frame / submit-intent), and capability/budget
 * enforcement at the boundary — anything not declared is denied with
 * typed errors (the W008 permission pattern applied to renderers).
 *
 * - EXECUTES, NEVER AUTHORS: the runtime consumes render-ready typed
 *   structures (W011 Experience Graphs — and, transitively, future
 *   compiler output, which emits the same contract); it never authors
 *   presentation and never becomes semantic authority (lock rule 8).
 * - Provider-NEUTRAL by construction (lock rule 13): ZERO engine imports,
 *   ZERO GPU code, ZERO UI-framework dependencies; strict objects reject
 *   unknown (vendor/engine) fields with precise typed paths. Concrete
 *   engines are future adapters behind the descriptor contract (W019).
 * - Tenant isolation (R12): bindings and receipts are tenant-scoped;
 *   cross-tenant binding, invocation, and document access are typed
 *   `cross-tenant-denied` rejections.
 * - DETERMINISM: zero wall-clock, zero randomness in src; invocation ids
 *   are caller-scoped and replays produce byte-identical receipts
 *   (content-addressed execution evidence, R26).
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared id grammar) and @epoch/experience-protocol
 *   (the consumed W011 descriptor/device/graph vocabulary — genuine
 *   runtime composition per the W013 pin). Compatibility with the host
 *   model's device-session record is pinned via devDependency parity
 *   tests, never runtime deps (the W011 kernel-parity precedent).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), the compile-time parity
 * assertion against the published declarations
 * (contracts/renderers/parity.ts, compiled by tsconfig.contracts.json),
 * and the committed JSON Schema projection under contracts/renderers/
 * pinned by test/contract-drift.test.ts (the W002-W004 convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  RENDERER_CONTRACT_VERSION,
  RENDERER_PROTOCOL_VERSION,
  RENDERER_DOCUMENT_KINDS,
  RENDERER_BINDING_SCHEMA_NAME,
  RENDERER_INVOCATION_SCHEMA_NAME,
  RENDERER_RECEIPT_SCHEMA_NAME,
  RENDERER_DESCRIPTOR_VERSION,
  RENDERER_BINDING_STATES,
  RENDERER_INVOCATION_KINDS,
  RENDERER_RECEIPT_KINDS,
  RENDERER_ERROR_CODES,
  MAX_RENDERER_GRAPH_NODES,
  MAX_RENDERER_GRAPH_EDGES,
  MAX_RENDERER_TRIANGLES,
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_OUTPUT_PIXELS,
  MAX_RENDERER_REFRESH_HZ,
  MAX_RENDERER_COLOR_DEPTH_BITS,
} from './version';
export type {
  RendererProtocolVersion,
  RendererDocumentKind,
  RendererBindingState,
  RendererInvocationKind,
  RendererReceiptKind,
  RendererErrorCode,
} from './version';
export {
  RendererProtocolVersionSchema,
  RendererBindingStateSchema,
  RendererInvocationKindSchema,
  RendererReceiptKindSchema,
  RendererErrorCodeSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (reused shared vocabularies + protocol-owned ids).
// ---------------------------------------------------------------------------
export {
  RENDERER_ID_PATTERN,
  RENDERER_SESSION_ID_PATTERN,
  DEVICE_SESSION_ID_PATTERN,
  RendererIdSchema,
  RendererSessionIdSchema,
  DeviceSessionIdSchema,
  InvocationIdSchema,
  VirtualTimeMsSchema,
  // Reused shared primitives (canonical homes: contracts/agent,
  // contracts/experience).
  JsonValueSchema,
  MessageIdSchema,
  Sha256HexSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  DeviceDescriptorSchema,
  DeviceClassSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  PoseTrackingKindSchema,
  ExperienceGraphKindSchema,
  ExperienceIssueSchema,
  ExperienceProtocolErrorSchema,
  InteractionModalitySchema,
  ControlIntentSchema,
} from './primitives';
// Mirrored shared primitives newly consumed by the W056 fabric contract
// (canonical home: contracts/experience, W011) — re-exported for the
// published contract surface, exactly like the mirrors above.
export {
  ProjectedAgentRefSchema,
  QuaternionSchema,
  ReplayWindowSchema,
  Vec3Schema,
} from '@epoch/experience-protocol';
export type {
  ProjectedAgentRef,
  Quaternion,
  ReplayWindow,
  Vec3,
} from '@epoch/experience-protocol';
export type {
  RendererId,
  RendererSessionId,
  DeviceSessionId,
  InvocationId,
  VirtualTimeMs,
  JsonValue,
  MessageId,
  Sha256Hex,
  OpaqueScopeId,
  TenantScope,
  DeviceDescriptor,
  DeviceClass,
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  PoseTrackingKind,
  ExperienceGraphKind,
  ExperienceIssue,
  ExperienceProtocolError,
  InteractionModality,
  ControlIntent,
} from './primitives';

// ---------------------------------------------------------------------------
// Abstract renderer descriptors (kind, capabilities, budgets).
// ---------------------------------------------------------------------------
export {
  RendererOutputCapabilitiesSchema,
  RendererBudgetsSchema,
  RendererDescriptorSchema,
} from './descriptor';
export type {
  RendererOutputCapabilities,
  RendererBudgets,
  RendererDescriptor,
} from './descriptor';

// ---------------------------------------------------------------------------
// Device-session snapshots (the host-side binding input).
// ---------------------------------------------------------------------------
export { DeviceSessionSnapshotSchema, deviceSessionSnapshotOf } from './snapshot';
export type { DeviceSessionSnapshot } from './snapshot';

// ---------------------------------------------------------------------------
// Renderer session bindings (descriptor x device session, negotiated).
// ---------------------------------------------------------------------------
export {
  EffectiveLimitsSchema,
  computeEffectiveLimits,
  RendererBindingContentSchema,
  RendererBindingSchema,
  bindRendererSession,
  closeRendererSession,
} from './binding';
export type {
  EffectiveLimits,
  RendererBindingContent,
  RendererBinding,
  BindingOptions,
  BindRendererSessionInput,
} from './binding';

// ---------------------------------------------------------------------------
// Typed invocation envelopes.
// ---------------------------------------------------------------------------
export { InvocationEnvelopeSchema } from './invocation';
export type {
  InvocationEnvelope,
  MountGraphEnvelope,
  AdvanceFrameEnvelope,
  SubmitIntentEnvelope,
} from './invocation';

// ---------------------------------------------------------------------------
// Content-addressed execution receipts.
// ---------------------------------------------------------------------------
export { RendererReceiptContentSchema, RendererReceiptSchema } from './receipt';
export type { RendererReceipt, RendererReceiptContent } from './receipt';

// ---------------------------------------------------------------------------
// Typed renderer-error taxonomy.
// ---------------------------------------------------------------------------
export { RendererIssueSchema, RendererRuntimeErrorSchema } from './errors';
export type {
  RendererIssue,
  RendererRuntimeError,
  RendererRuntimeResult,
} from './errors';

// ---------------------------------------------------------------------------
// The enforcement boundary (total invocation admission).
// ---------------------------------------------------------------------------
export { admitInvocation } from './enforcement';
export type { InvocationOutcome, InvocationInput } from './enforcement';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export {
  parseRendererDescriptor,
  parseRendererBinding,
  parseRendererReceipt,
} from './parse';
export type { AdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 content addressing + tamper detection).
// ---------------------------------------------------------------------------
export {
  serializeRendererBinding,
  serializeRendererReceipt,
  computeRendererBindingDigest,
  computeRendererReceiptDigest,
  sealRendererBinding,
  sealRendererReceipt,
  verifyRendererBindingDigest,
  verifyRendererReceiptDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Published schema surface + shared-contract emission.
// ---------------------------------------------------------------------------
export { RENDERER_RUNTIME_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  RENDERER_CONTRACT_DIR,
  renderRendererContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';

// ---------------------------------------------------------------------------
// W056 — the Renderer Fabric contract (additive; W013 surface unchanged).
// ---------------------------------------------------------------------------

// Fabric protocol version + vocabularies.
export {
  RENDERER_FABRIC_PROTOCOL_VERSION,
  RENDERER_CAPABILITY_VERSION,
  RENDERER_SESSION_SCHEMA_NAME,
  RENDERER_SESSION_SNAPSHOT_SCHEMA_NAME,
  RENDERER_SWITCH_REQUEST_SCHEMA_NAME,
  RENDERER_SWITCH_RECEIPT_SCHEMA_NAME,
  RENDERER_FRAME_ENVELOPE_SCHEMA_NAME,
  RENDERER_INPUT_ENVELOPE_SCHEMA_NAME,
  RENDERER_INTENT_RECEIPT_SCHEMA_NAME,
  RENDERER_ASSET_BINDING_SCHEMA_NAME,
  RENDERER_CONFORMANCE_SCHEMA_NAME,
  RENDERER_SESSION_STATES,
  RENDERER_HEALTH_STATES,
  RENDERER_DEGRADATION_KINDS,
  RENDERER_INPUT_KINDS,
  PORTABLE_VIEW_STATE_FIELDS,
  RENDERER_ASSET_KINDS,
  RENDERER_ASSET_TRUST_STATES,
  RENDERER_INTENT_OUTCOMES,
  RENDERER_CONFORMANCE_CHECK_KINDS,
  RENDERER_FAILURE_CODES,
  MAX_PORTABLE_FOCUSED_ENTITIES,
  MAX_PORTABLE_LAYERS,
  MAX_PORTABLE_ENTITY_IDS,
  MAX_FABRIC_DETAIL_LENGTH,
  MAX_CONFORMANCE_CHECKS,
  MAX_CONFORMANCE_RENDERERS,
  MAX_SWITCH_FALLBACKS,
  MAX_INPUT_MODIFIERS,
  MAX_INPUT_KEY_LENGTH,
} from './version';
export type {
  RendererFabricProtocolVersion,
  RendererSessionState,
  RendererHealthState,
  RendererDegradationKind,
  RendererInputKind,
  PortableViewStateField,
  RendererAssetKind,
  RendererAssetTrustState,
  RendererIntentOutcome,
  RendererConformanceCheckKind,
  RendererFailureCode,
} from './version';
export {
  RendererFabricProtocolVersionSchema,
  RendererSessionStateSchema,
  RendererHealthStateSchema,
  RendererDegradationKindSchema,
  RendererInputKindSchema,
  PortableViewStateFieldSchema,
  RendererAssetKindSchema,
  RendererAssetTrustStateSchema,
  RendererIntentOutcomeSchema,
  RendererConformanceCheckKindSchema,
  RendererFailureCodeSchema,
} from './version';

// Fabric-owned + mirrored W016 id grammars and input primitives.
export {
  FABRIC_SESSION_ID_PATTERN,
  SWITCH_ID_PATTERN,
  INPUT_ID_PATTERN,
  ASSET_BINDING_ID_PATTERN,
  SEMANTIC_LAYER_ID_PATTERN,
  WORLD_SCENE_ID_MIRROR_PATTERN,
  FabricSessionIdSchema,
  SwitchIdSchema,
  InputIdSchema,
  AssetBindingIdSchema,
  SemanticLayerIdSchema,
  WorldSceneIdMirrorSchema,
  WorldEntityIdMirrorSchema,
  PointerPositionSchema,
  InputKeySchema,
} from './fabric-primitives';
export type {
  FabricSessionId,
  SwitchId,
  InputId,
  AssetBindingId,
  SemanticLayerId,
  WorldSceneIdMirror,
  WorldEntityIdMirror,
  PointerPosition,
  InputKey,
} from './fabric-primitives';

// The renderer capability set.
export { RendererCapabilitySetSchema } from './capabilities';
export type { RendererCapabilitySet } from './capabilities';

// The portable view state (mirrored W016 camera/timeline grammars).
export {
  PortableCameraStateSchema,
  PortableFollowAgentCameraSchema,
  PortableFollowCursorStateSchema,
  PortableFreeCameraSchema,
  PortableOrbitCameraSchema,
  PortableTimelinePositionSchema,
  PortableViewStateSchema,
  SemanticLayerVisibilitySchema,
  emptyPortableViewState,
} from './portable-state';
export type {
  PortableCameraState,
  PortableFollowAgentCamera,
  PortableFollowCursorState,
  PortableFreeCamera,
  PortableOrbitCamera,
  PortableTimelinePosition,
  PortableViewState,
  SemanticLayerVisibility,
} from './portable-state';

// Renderer health.
export { RendererHealthSchema, healthyAt } from './health';
export type { RendererHealth } from './health';

// The typed fabric failure taxonomy.
export { RendererFailureSchema, RendererFailureTriggerSchema } from './failure';
export type {
  RendererFailure,
  RendererFailureTrigger,
  FabricResult,
} from './failure';

// The canonical world projection reference.
export { WorldProjectionRefSchema } from './world-projection';
export type { WorldProjectionRef } from './world-projection';

// The ephemeral renderer session.
export {
  RENDERER_SESSION_TRANSITIONS,
  RendererSessionContentSchema,
  RendererSessionSchema,
  canTransitionRendererSession,
  createRendererSessionContent,
  sealRendererSession,
} from './session';
export type {
  RendererSession,
  RendererSessionContent,
  CreateRendererSessionInput,
} from './session';

// The portable session snapshot.
export {
  RendererSessionSnapshotContentSchema,
  RendererSessionSnapshotSchema,
  captureSessionSnapshotContent,
  sealRendererSessionSnapshot,
} from './fabric-snapshot';
export type {
  RendererSessionSnapshot,
  RendererSessionSnapshotContent,
  CaptureSessionSnapshotInput,
} from './fabric-snapshot';

// Renderer switching.
export {
  RendererSwitchRequestSchema,
  RendererSwitchReceiptContentSchema,
  RendererSwitchReceiptSchema,
  captureSwitchReceiptContent,
  sealRendererSwitchReceipt,
} from './switch';
export type {
  RendererSwitchRequest,
  RendererSwitchReceipt,
  RendererSwitchReceiptContent,
  CaptureSwitchReceiptInput,
} from './switch';

// The frame envelope.
export { RendererFrameEnvelopeSchema } from './frame';
export type { RendererFrameEnvelope } from './frame';

// The input envelope + intent receipt.
export {
  RendererInputEnvelopeSchema,
  RendererIntentReceiptContentSchema,
  RendererIntentReceiptSchema,
  RENDERER_INTENT_OUTCOME_LIST,
  sealRendererIntentReceipt,
} from './input';
export type {
  RendererInputEnvelope,
  PointerInputEnvelope,
  KeyInputEnvelope,
  RendererIntentReceipt,
  RendererIntentReceiptContent,
} from './input';

// The asset binding.
export {
  RendererAssetBindingContentSchema,
  RendererAssetBindingSchema,
  sealRendererAssetBinding,
} from './asset-binding';
export type {
  RendererAssetBinding,
  RendererAssetBindingContent,
} from './asset-binding';

// The conformance result.
export {
  RendererConformanceCheckSchema,
  RendererConformanceResultContentSchema,
  RendererConformanceResultSchema,
  sealRendererConformanceResult,
} from './conformance';
export type {
  RendererConformanceCheck,
  RendererConformanceResult,
  RendererConformanceResultContent,
} from './conformance';
