/**
 * @epoch/experience-compiler — public API (experience layer, Work Order
 * W012).
 *
 * The pure projection stage between the W011 Experience Protocol and the
 * W013 renderer surfaces (architecture.md "Experience Runtime" —
 * binding): it VALIDATES Experience Graph envelopes with the W011
 * admission discipline (genuine runtime consumption — the compiler's
 * inputs ARE W011 envelopes) and COMPILES them into deterministic,
 * renderer-ready Render Plans — staged, canonically sorted,
 * content-addressed, device-shaped, and tenant-scoped.
 *
 * - PROJECTION, NEVER AUTHORITY (lock rules 8/16): the compiler never
 *   mutates kernel state, never becomes a second semantic store, and
 *   never embeds new world/agent semantics. Plans preserve the envelope's
 *   opaque, tenant-scoped, exact-revision projected references verbatim.
 * - DETERMINISTIC COMPILATION: identical (envelope, device) inputs
 *   compile to byte-identical plans (canonical JSON, sorted iteration,
 *   stable ids); zero wall-clock, zero randomness in src.
 * - DEVICE-AWARE PLAN SHAPING: the W011 device-descriptor slot drives
 *   typed plan constraints (budgets/limits as data); unsupported
 *   requirements are typed rejections, never silent degradation (R29).
 * - TENANT ISOLATION (R12): plans carry the envelope's tenant scope;
 *   cross-tenant compile requests are typed `cross-tenant-denied`
 *   rejections.
 * - Provider-NEUTRAL by construction (lock rule 13): vendor/engine
 *   fields are REJECTED at the authority boundary (blocklist); concrete
 *   engines stay behind the W013/W019 adapter boundary.
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared primitives) and @epoch/experience-protocol
 *   (the consumed W011 envelope/device vocabulary — genuine runtime
 *   composition per the W012 pin; same shape as W013's renderer-runtime).
 *   Compatibility with @epoch/world-model (projected references) and
 *   @epoch/renderer-runtime (the downstream plan consumer) is pinned via
 *   devDependency compile-time parity tests, never runtime deps
 *   (src/host-parity.ts; test/world-parity.test.ts,
 *   test/renderer-parity.test.ts).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), the compile-time parity
 * assertion against the published declarations
 * (contracts/experience-compiler/parity.ts, compiled by
 * tsconfig.contracts.json), and the committed JSON Schema projection
 * under contracts/experience-compiler/ pinned by test/contract-drift.test.ts
 * (the W002-W004 convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  EXPERIENCE_COMPILER_CONTRACT_VERSION,
  RENDER_PLAN_PROTOCOL_VERSION,
  RENDER_PLAN_SCHEMA_NAME,
  EXPERIENCE_COMPILER_DOCUMENT_KINDS,
  PLAN_STAGE_KINDS,
  PLAN_KIND_STAGE_KINDS,
  EXPERIENCE_COMPILER_ERROR_CODES,
  PRIMITIVE_TRIANGLE_ESTIMATES,
  MAX_PLAN_STAGES,
  MAX_PLAN_STAGE_OPS,
  MAX_PLAN_RELATIONS,
  MAX_PLAN_ANIMATION_BINDINGS,
  MAX_PLAN_SOURCE_REFS,
  MAX_PLAN_ANCHORS_PER_OP,
} from './version';
export type {
  RenderPlanProtocolVersion,
  ExperienceCompilerDocumentKind,
  ExperienceCompilerErrorCode,
  PlanStageKind,
} from './version';
export {
  RenderPlanProtocolVersionSchema,
  ExperienceCompilerDocumentKindSchema,
  ExperienceCompilerErrorCodeSchema,
  PlanStageKindSchema,
} from './version';

// ---------------------------------------------------------------------------
// Reused W011/agent vocabularies (the plan surface's shared primitives).
// ---------------------------------------------------------------------------
export {
  JsonValueSchema,
  type JsonValue,
} from '@epoch/agent-protocol';
export {
  Sha256HexSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  ColorHexSchema,
  Vec3Schema,
  QuaternionSchema,
  Point2dSchema,
  Geometry2dSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  MeshBindingSchema,
  TextStyleSchema,
  KeyframeSchema,
  EasingKindSchema,
  TimelineMarkerKindSchema,
  ParticipantReferenceSchema,
  ParticipantKindSchema,
  ControlKindSchema,
  ControlIntentSchema,
  PresentationAttributesSchema,
  ProjectedReferenceSchema,
  ProjectedWorldEntityRefSchema,
  ProjectedWorldRelationRefSchema,
  ProjectedWorldEventRefSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  ProjectedCapabilityRefSchema,
  ProjectedReferenceKindSchema,
  DeviceDescriptorSchema,
  DeviceClassSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
  SpatialPrimitiveSchema,
  ExperienceGraphIdSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeIdSchema,
  ExperienceEdgeKindSchema,
} from './primitives';
export type {
  Sha256Hex,
  OpaqueScopeId,
  TenantScope,
  ColorHex,
  Vec3,
  Quaternion,
  Point2d,
  Geometry2d,
  StrokeStyle2d,
  FillStyle2d,
  MeshBinding,
  TextStyle,
  Keyframe,
  EasingKind,
  TimelineMarkerKind,
  ParticipantReference,
  ParticipantKind,
  ControlKind,
  ControlIntent,
  PresentationAttributes,
  ProjectedReference,
  ProjectedWorldEntityRef,
  ProjectedWorldRelationRef,
  ProjectedWorldEventRef,
  ProjectedAgentRef,
  ProjectedEvidenceRef,
  ProjectedCapabilityRef,
  ProjectedReferenceKind,
  DeviceDescriptor,
  DeviceClass,
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  InteractionModality,
  PoseTrackingKind,
  SpatialPrimitive,
  ExperienceGraphId,
  ExperienceGraphKind,
  ExperienceNodeId,
  ExperienceEdgeKind,
} from './primitives';

// ---------------------------------------------------------------------------
// Typed compiler-error taxonomy.
// ---------------------------------------------------------------------------
export {
  CompilerIssueSchema,
  CompilerErrorSchema,
  AUTHORITY_VIOLATION_ORIGINS,
} from './errors';
export type {
  CompilerIssue,
  CompilerError,
  CompilerResult,
  AuthorityViolationOrigin,
} from './errors';

// ---------------------------------------------------------------------------
// The vendor-field authority boundary (lock rule 13).
// ---------------------------------------------------------------------------
export {
  VENDOR_KEY_SEGMENTS,
  isVendorKey,
  scanVendorFieldViolations,
  vendorFieldViolationError,
} from './authority';
export type { VendorKeySegment, VendorFieldViolation } from './authority';

// ---------------------------------------------------------------------------
// The Render Plan (staged, sorted, device-shaped, content-addressed).
// ---------------------------------------------------------------------------
export {
  PlanDrawShapeOpSchema,
  PlanDrawLabelOpSchema,
  PlanPlaceSpatialOpSchema,
  PlanPlaceLabelOpSchema,
  PlanAnimationBindingSchema,
  PlanNarrativeBeatSchema,
  PlanTimelineTrackSchema,
  PlanTimelineMarkerSchema,
  PlanPresenceSeatSchema,
  PlanPresenceCursorSchema,
  PlanControlOpSchema,
  PlanRelationSchema,
  PlanStageSchema,
  PlanConstraintsSchema,
  RenderPlanUsageSchema,
  RenderPlanContentSchema,
  RenderPlanSchema,
} from './plan';
export type {
  PlanDrawShapeOp,
  PlanDrawLabelOp,
  PlanPlaceSpatialOp,
  PlanPlaceLabelOp,
  PlanAnimationBinding,
  PlanNarrativeBeat,
  PlanTimelineTrack,
  PlanTimelineMarker,
  PlanPresenceSeat,
  PlanPresenceCursor,
  PlanControlOp,
  PlanRelation,
  PlanStage,
  PlanConstraints,
  RenderPlanUsage,
  RenderPlanContent,
  RenderPlan,
} from './plan';

// ---------------------------------------------------------------------------
// Device-aware plan shaping (usage accounting + budget enforcement).
// ---------------------------------------------------------------------------
export { computePlanUsage, enforceDeviceBudgets, constraintsOf } from './usage';

// ---------------------------------------------------------------------------
// The total compile entry point.
// ---------------------------------------------------------------------------
export { compileExperienceGraph } from './compile';
export type { CompileRequest } from './compile';

// ---------------------------------------------------------------------------
// Total plan admission surface.
// ---------------------------------------------------------------------------
export { parseRenderPlan } from './parse';
export type { PlanAdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 content addressing + tamper
// detection + the envelope->plan digest chain).
// ---------------------------------------------------------------------------
export {
  serializeRenderPlan,
  computeRenderPlanDigest,
  sealRenderPlan,
  verifyRenderPlanDigest,
  planDigestChain,
} from './serialize';

// ---------------------------------------------------------------------------
// Published schema surface + shared-contract emission.
// ---------------------------------------------------------------------------
export {
  EXPERIENCE_COMPILER_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  EXPERIENCE_COMPILER_CONTRACT_DIR,
  renderExperienceCompilerContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
