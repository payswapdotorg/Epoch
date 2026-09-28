/**
 * @epoch/renderer-adapters — public API (experience layer, Work Order
 * W019, renderer-side adaptation).
 *
 * The RENDERER half of Renderer/Device Adaptation — the provider-neutral
 * ADAPTER SEAM the W013 renderer-runtime pin reserved for this Work
 * Order ("concrete engines are future adapters behind the descriptor
 * contract"; spec/experience-architecture.md "Rendering": "Renderer
 * abstraction permits other local/remote renderers"):
 *
 * - A neutral renderer-TECHNIQUE vocabulary and catalog
 *   (`RENDERER_TECHNIQUES`, `RENDERER_TECHNIQUE_CATALOG`):
 *   immediate-2d, retained-scene-3d, stereoscopic-compositor,
 *   remote-stream — techniques, NEVER vendors/engines/APIs. Concrete
 *   engines bind to a technique at the client surface; zero engine
 *   imports, zero GPU code, zero UI-framework dependencies (lock rule
 *   13).
 * - DETERMINISTIC ADAPTER SELECTION (`selectRendererAdapter`) over a
 *   sealed W013 RendererBinding plus a sealed W019
 *   DeviceCapabilityAssessment: the chosen technique, the typed reason,
 *   the ordered fallback chain, and the FULL decision trace (every
 *   candidate with its typed eligibility verdict — the frozen
 *   device-adaptation table rendered as logic: remote assist when
 *   recommended, stereoscopic when negotiated, spatial-local otherwise,
 *   reduced-3D pairing on reduced tiers, the flat path, and the optional
 *   remote fallback). Sealed, content-addressed, tenant-scoped.
 * - TYPED MOUNT PLANS (`planMount`, `mountEnvelopeOf`): adaptation data
 *   for mounting one content revision (typically a progressive-scene
 *   rung) through the UNCHANGED W013 mount-graph path — the projected
 *   envelope is validated by the REAL W013 invocation schema.
 * - APPEND-ONLY ADAPTATION EVENTS over the mirrored W010 shapes
 *   (`renderer-adapter:*` open namespace; @epoch/event-log stays a
 *   devDependency — type parity, never a runtime edge): technique
 *   selections and mount plans become FACTS on one deterministic stream
 *   per renderer session; there is no mutation API.
 * - DETERMINISM: zero wall-clock, zero randomness, zero I/O; instants
 *   are producer-supplied payload data.
 * - TENANT ISOLATION (R12): selections and plans adopt the binding's
 *   tenant scope; cross-tenant operations are typed
 *   `cross-tenant-denied` rejections.
 * - INTEGRITY: the assessment must assess EXACTLY the binding's device
 *   descriptor, else a typed `assessment-device-mismatch` rejection —
 *   decision inputs can never silently disagree.
 *
 * Runtime dependencies are exactly @epoch/agent-protocol (canonical
 * digest machinery), @epoch/experience-protocol (the W011 vocabulary),
 * @epoch/renderer-runtime (the W013 binding/invocation contracts —
 * genuine runtime composition), and @epoch/device-capabilities (the W019
 * device-side assessment — sibling composition). Compatibility with
 * @epoch/event-log (the W010 shapes) is pinned via devDependencies +
 * compile-time parity (src/kernel-parity.ts) and runtime parity tests —
 * never runtime deps.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), and the committed JSON
 * Schema projection under schemas/ pinned by test/contract-drift.test.ts
 * (the W007/W009/W015/W016 in-package convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  RENDERER_ADAPTERS_CONTRACT_VERSION,
  RENDERER_ADAPTERS_PROTOCOL_VERSION,
  RENDERER_ADAPTERS_DOCUMENT_KINDS,
  RENDERER_ADAPTER_SELECTION_SCHEMA_NAME,
  RENDERER_MOUNT_PLAN_SCHEMA_NAME,
  RENDERER_TECHNIQUES,
  TECHNIQUE_EXECUTION_CLASSES,
  SELECTION_REASONS,
  ELIGIBILITY_REASONS,
  RENDERER_ADAPTERS_ERROR_CODES,
  ADAPTER_EVENT_NAMESPACE,
  ADAPTER_EVENT_RECORD_VERSION,
  ADAPTER_EVENT_DISCRIMINATORS,
  ADAPTER_STREAM_ID_PATTERN,
  ADAPTER_ACTOR_PATTERN,
  ADAPTER_TENANT_ID_PATTERN,
  ADAPTER_TIMESTAMP_PATTERN,
  MAX_SELECTION_TRACE_ENTRIES,
} from './version';
export type {
  RendererAdaptersProtocolVersion,
  RendererAdaptersDocumentKind,
  RendererTechnique,
  TechniqueExecutionClass,
  SelectionReason,
  EligibilityReason,
  RendererAdaptersErrorCode,
  AdapterEventDiscriminator,
} from './version';
export {
  RendererAdaptersProtocolVersionSchema,
  RendererTechniqueSchema,
  TechniqueExecutionClassSchema,
  SelectionReasonSchema,
  EligibilityReasonSchema,
  RendererAdaptersErrorCodeSchema,
  AdapterEventDiscriminatorSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (renderer-adapters-owned ids + mirrored W010
// grammars + reused shared vocabularies).
// ---------------------------------------------------------------------------
export {
  ADAPTER_ID_PATTERN,
  SELECTION_ID_PATTERN,
  MOUNT_PLAN_ID_PATTERN,
  AdapterIdSchema,
  SelectionIdSchema,
  MountPlanIdSchema,
  AdapterStreamIdSchema,
  AdapterActorSchema,
  AdapterTenantIdSchema,
  AdapterTimestampSchema,
} from './primitives';
export type {
  AdapterId,
  SelectionId,
  MountPlanId,
  AdapterStreamId,
  AdapterActor,
  AdapterTenantId,
  AdapterTimestamp,
} from './primitives';

// ---------------------------------------------------------------------------
// The neutral renderer-technique catalog.
// ---------------------------------------------------------------------------
export {
  RENDERER_TECHNIQUE_CATALOG,
  RendererTechniqueRecordSchema,
  techniqueRecordOf,
  techniqueHostsKinds,
  SPATIAL_GRAPH_KINDS,
  hasSpatialKinds,
} from './technique';
export type { RendererTechniqueRecord, RendererTechniqueRecordValue } from './technique';

// ---------------------------------------------------------------------------
// Deterministic adapter selection.
// ---------------------------------------------------------------------------
export {
  SelectionTraceEntrySchema,
  RendererAdapterSelectionContentSchema,
  RendererAdapterSelectionSchema,
  selectRendererAdapter,
} from './selection';
export type {
  SelectionTraceEntry,
  RendererAdapterSelectionContent,
  RendererAdapterSelection,
  SelectionOptions,
  SelectRendererAdapterInput,
} from './selection';

// ---------------------------------------------------------------------------
// Typed mount plans.
// ---------------------------------------------------------------------------
export {
  MOUNT_PLAN_STEPS,
  MountPlanStepSchema,
  RendererMountPlanContentSchema,
  RendererMountPlanSchema,
  planMount,
  mountEnvelopeOf,
} from './plan';
export type {
  MountPlanStep,
  RendererMountPlanContent,
  RendererMountPlan,
  PlanOptions,
  PlanMountInput,
} from './plan';

// ---------------------------------------------------------------------------
// Append-only adaptation events over the mirrored W010 shapes.
// ---------------------------------------------------------------------------
export {
  AdapterEventSequenceSchema,
  AdapterCausalParentSchema,
  AdapterEventPayloadSchema,
  AdapterEventContentSchema,
  AdapterEventSchema,
  TechniqueSelectedDataSchema,
  MountPlannedDataSchema,
  ADAPTER_EVENT_DATA_SCHEMAS,
  parseAdapterEventData,
  adapterStreamIdOf,
  buildTechniqueSelectedEvent,
  buildMountPlannedEvent,
  sealAdapterEvent,
  computeAdapterEventDigest,
} from './events';
export type {
  AdapterEventSequence,
  AdapterCausalParent,
  AdapterEventPayload,
  AdapterEventContent,
  AdapterEvent,
  TechniqueSelectedData,
  MountPlannedData,
  AdapterEventCoordinates,
} from './events';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 + tamper detection).
// ---------------------------------------------------------------------------
export {
  selectionContentOf,
  computeSelectionDigest,
  verifySelectionDigest,
  mountPlanContentOf,
  computeMountPlanDigest,
  verifyMountPlanDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export { parseRendererAdapterSelection, parseRendererMountPlan } from './parse';
export type { AdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Typed error taxonomy.
// ---------------------------------------------------------------------------
export { RendererAdaptersIssueSchema, RendererAdaptersErrorSchema } from './errors';
export type {
  RendererAdaptersIssue,
  RendererAdaptersError,
  RendererAdaptersResult,
} from './errors';

// ---------------------------------------------------------------------------
// Published schema surface + contract emission.
// ---------------------------------------------------------------------------
export { RENDERER_ADAPTERS_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  RENDERER_ADAPTERS_CONTRACT_DIR,
  renderRendererAdaptersContractFiles,
} from './contract-emission';
export { typeToKebabCase } from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
