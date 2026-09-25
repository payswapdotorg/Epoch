/**
 * @epoch/experience-protocol — public API (experience layer, Work Order
 * W011).
 *
 * The typed projection contract of the Epoch Experience layer
 * (architecture.md "Experience Runtime" — binding): versioned Experience
 * Graph envelopes for 2D, 3D, animation, narrative, timeline/replay,
 * presence and controls; tenant-scoped projection requests; an abstract,
 * provider-neutral device-descriptor slot (filled by W019); deterministic
 * content-addressed serialization; and a typed admission-error taxonomy.
 *
 * - PROJECTION, NEVER AUTHORITY (lock rules 8/16): the Experience Graph is
 *   a read projection of kernel state. It references kernel objects
 *   opaquely (tenant-scoped, exact-revision digests), never embeds them;
 *   presentation attributes that smuggle kernel vocabulary are rejected
 *   with a typed `authority-violation` error; the protocol never mutates
 *   kernel state and never becomes a second semantic store.
 * - Provider-NEUTRAL by construction (lock rule 13): zero concrete
 *   renderers, zero engine/vendor/framework vocabulary, zero UI-framework
 *   dependencies; strict objects reject unknown (vendor) fields. Concrete
 *   engines are future adapters (W013/W019).
 * - Tenant isolation (R12): every projected reference carries the owning
 *   tenant; cross-tenant references and requests are rejected with typed
 *   `cross-tenant-denied` errors.
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared primitives) and @epoch/world-model (the
 *   consumed world-state id grammars) — genuine runtime composition per
 *   the W011 pin. Compatibility with the action/evidence/capability
 *   vocabularies is pinned by devDependency parity tests, never runtime
 *   deps (src/kernel-parity.ts; test/kernel-parity.test.ts).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), the compile-time parity
 * assertion against the published declarations
 * (contracts/experience/parity.ts, compiled by tsconfig.contracts.json),
 * and the committed JSON Schema projection under contracts/experience/
 * pinned by test/contract-drift.test.ts.
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  EXPERIENCE_CONTRACT_VERSION,
  EXPERIENCE_PROTOCOL_VERSION,
  EXPERIENCE_GRAPH_SCHEMA_NAME,
  EXPERIENCE_PROJECTION_REQUEST_SCHEMA_NAME,
  EXPERIENCE_DOCUMENT_KINDS,
  EXPERIENCE_GRAPH_KINDS,
  EXPERIENCE_NODE_KINDS,
  EXPERIENCE_EDGE_KINDS,
  GRAPH_KIND_NODE_KINDS,
  EXPERIENCE_PROTOCOL_ERROR_CODES,
  PROJECTED_REFERENCE_KINDS,
  DEVICE_DESCRIPTOR_VERSION,
  DEVICE_CLASSES,
  INTERACTION_MODALITIES,
  POSE_TRACKING_KINDS,
  SPATIAL_PRIMITIVES,
  CONTROL_KINDS,
  PARTICIPANT_KINDS,
  EASING_KINDS,
  TIMELINE_MARKER_KINDS,
  NARRATIVE_TONES,
  TEXT_WEIGHTS,
} from './version';
export type {
  ExperienceProtocolVersion,
  ExperienceDocumentKind,
  ExperienceGraphKind,
  ExperienceNodeKind,
  ExperienceEdgeKind,
  ExperienceErrorCode,
  ProjectedReferenceKind,
  DeviceClass,
  InteractionModality,
  PoseTrackingKind,
  SpatialPrimitive,
  ControlKind,
  ParticipantKind,
  EasingKind,
  TimelineMarkerKind,
  NarrativeTone,
  TextWeight,
} from './version';
export {
  ExperienceProtocolVersionSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeKindSchema,
  ExperienceEdgeKindSchema,
  ExperienceErrorCodeSchema,
  ProjectedReferenceKindSchema,
  DeviceClassSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
  SpatialPrimitiveSchema,
  ControlKindSchema,
  ParticipantKindSchema,
  EasingKindSchema,
  TimelineMarkerKindSchema,
  NarrativeToneSchema,
  TextWeightSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (JsonValue is the mirrored shared primitive whose
// canonical home is contracts/agent; the rest are protocol-owned).
// ---------------------------------------------------------------------------
export { JsonValueSchema, type JsonValue } from '@epoch/agent-protocol';
export {
  SHA256_HEX_PATTERN,
  EXPERIENCE_NODE_ID_PATTERN,
  EXPERIENCE_GRAPH_ID_PATTERN,
  OPAQUE_SCOPE_ID_PATTERN,
  COLOR_HEX_PATTERN,
  PROPERTY_PATH_PATTERN,
  MAX_ATTRIBUTE_KEYS,
  Sha256HexSchema,
  ExperienceNodeIdSchema,
  ExperienceGraphIdSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  ColorHexSchema,
  Vec3Schema,
  QuaternionSchema,
  PropertyPathSchema,
  PresentationAttributesSchema,
} from './primitives';
export type {
  Sha256Hex,
  ExperienceNodeId,
  ExperienceGraphId,
  OpaqueScopeId,
  TenantScope,
  ColorHex,
  Vec3,
  Quaternion,
  PropertyPath,
  PresentationAttributes,
} from './primitives';

// ---------------------------------------------------------------------------
// Projected kernel references (projection, never authority).
// ---------------------------------------------------------------------------
export {
  WORLD_RELATION_ID_PATTERN,
  ProjectedWorldEntityRefSchema,
  ProjectedWorldRelationRefSchema,
  ProjectedWorldEventRefSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  ProjectedCapabilityRefSchema,
  ProjectedReferenceSchema,
  projectedReferenceKey,
  sameReferenceTarget,
} from './reference';
export type {
  ProjectedWorldEntityRef,
  ProjectedWorldRelationRef,
  ProjectedWorldEventRef,
  ProjectedAgentRef,
  ProjectedEvidenceRef,
  ProjectedCapabilityRef,
  ProjectedReference,
} from './reference';

// ---------------------------------------------------------------------------
// Abstract device-descriptor slot (W019 fills it).
// ---------------------------------------------------------------------------
export {
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  DeviceDescriptorSchema,
} from './device';
export type {
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  DeviceDescriptor,
} from './device';

// ---------------------------------------------------------------------------
// Typed presentation descriptors.
// ---------------------------------------------------------------------------
export {
  Point2dSchema,
  Geometry2dSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  Shape2dDescriptorSchema,
  MeshBindingSchema,
  Spatial3dDescriptorSchema,
  TextStyleSchema,
  LabelDescriptorSchema,
  KeyframeSchema,
  AnimationTrackSchema,
  AnimationClipDescriptorSchema,
  NarrativeBeatDescriptorSchema,
  TimelineTrackDescriptorSchema,
  TimelineMarkerDescriptorSchema,
  ParticipantReferenceSchema,
  PresenceSeatDescriptorSchema,
  PresenceCursorDescriptorSchema,
  ControlIntentSchema,
  ControlDescriptorSchema,
} from './descriptors';
export type {
  Point2d,
  Geometry2d,
  StrokeStyle2d,
  FillStyle2d,
  Shape2dDescriptor,
  MeshBinding,
  Spatial3dDescriptor,
  TextStyle,
  LabelDescriptor,
  Keyframe,
  AnimationTrack,
  AnimationClipDescriptor,
  NarrativeBeatDescriptor,
  TimelineTrackDescriptor,
  TimelineMarkerDescriptor,
  ParticipantReference,
  PresenceSeatDescriptor,
  PresenceCursorDescriptor,
  ControlIntent,
  ControlDescriptor,
} from './descriptors';

// ---------------------------------------------------------------------------
// Experience Graph envelope.
// ---------------------------------------------------------------------------
export {
  MAX_PROJECTED_REFERENCES,
  MAX_GRAPH_NODES,
  MAX_GRAPH_EDGES,
  ExperienceNodeSchema,
  ExperienceEdgeSchema,
  ExperienceGraphContentSchema,
  ExperienceGraphSchema,
} from './graph';
export type {
  ExperienceNode,
  ExperienceEdge,
  ExperienceGraphContent,
  ExperienceGraph,
} from './graph';

// ---------------------------------------------------------------------------
// Projection requests.
// ---------------------------------------------------------------------------
export {
  MAX_REQUEST_REFERENCES,
  ReplayWindowSchema,
  ProjectionRequestSchema,
} from './request';
export type { ReplayWindow, ProjectionRequest } from './request';

// ---------------------------------------------------------------------------
// Typed admission-error taxonomy.
// ---------------------------------------------------------------------------
export { ExperienceIssueSchema, ExperienceProtocolErrorSchema } from './errors';
export type {
  ExperienceIssue,
  ExperienceProtocolError,
  ExperienceResult,
} from './errors';

// ---------------------------------------------------------------------------
// Authority boundary (lock rule 8).
// ---------------------------------------------------------------------------
export {
  KERNEL_RESERVED_ATTRIBUTE_KEYS,
  scanAuthorityViolations,
  authorityViolationError,
} from './authority';
export type {
  KernelReservedAttributeKey,
  AuthorityViolation,
} from './authority';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export {
  parseExperienceGraph,
  parseProjectionRequest,
  validateDeviceDescriptor,
} from './parse';
export type { AdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 content addressing + tamper detection).
// ---------------------------------------------------------------------------
export {
  serializeExperienceGraph,
  serializeProjectionRequest,
  computeExperienceGraphDigest,
  sealExperienceGraph,
  verifyExperienceGraphDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Published schema surface + contract emission.
// ---------------------------------------------------------------------------
export { EXPERIENCE_PROTOCOL_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  EXPERIENCE_CONTRACT_DIR,
  renderExperienceContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
