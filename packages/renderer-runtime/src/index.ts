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
