/**
 * @epoch/world-experience — public API (experience layer, Work Order
 * W016).
 *
 * The interactive-world DOMAIN MODEL of the Epoch Experience layer
 * (spec/experience-architecture — binding): the UI is a projection of the
 * same world used by humans and agents; it is not a second authority.
 *
 * - TYPED PROJECTION, NEVER AUTHORITY (lock rules 8/16): world
 *   scene/view state, overlays, animation instructions, camera/follow
 *   semantics, and narrative blocks are TYPED RECORDS derived from the
 *   world model + event substrate — world entities are referenced
 *   opaquely (id + content digest, the W002 discipline), never embedded;
 *   producing a projection never mutates engine or world state.
 * - THE WORLD-SUBSET INTERACTION VOCABULARY: typed, versioned,
 *   discriminated unions covering select, inspect, measure, move, rotate,
 *   zoom, isolate, hide, show, compare, annotate, simulate, change,
 *   connect, disconnect, filter, query, branch, replay, pause, resume,
 *   follow-agent — with the Dynamic UI law enforced at admission
 *   (executable UI content is a typed `executable-ui-rejected` rejection;
 *   agents emit typed intents, never arbitrary executable UI code).
 * - THE DOMAIN VISUAL ONTOLOGY: pack-contributable semantic
 *   visualizations (2D symbols, 3D representations, materials/textures,
 *   state overlays, animations, interaction affordances) as typed records
 *   with versioned discriminators.
 * - TYPED FIDELITY PROJECTIONS for device adaptation: desktop / web /
 *   mobile / low / remote as typed variants (same semantics, different
 *   fidelity; every reduction is typed data, never silent).
 * - RENDERER-ENVELOPE COMPILERS as the output boundary: the package
 *   compiles its typed scene/view state to W013
 *   mount-graph/advance-frame/submit-intent invocation envelopes as PURE
 *   DATA PRODUCERS (mirrored W013 shapes, parity-pinned via
 *   devDependencies — never runtime deps); concrete rendering is NOT this
 *   layer's concern, and no engine is ever embedded (lock rule 13).
 * - BUDGET RESPECT: visual states carry and respect the W013 renderer
 *   descriptor budgets; anything over budget is a typed
 *   `budget-exceeded` rejection.
 * - TENANT ISOLATION (R12): scenes are tenant-scoped; cross-tenant scene
 *   access, references, and operations are typed `cross-tenant-denied`
 *   rejections.
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared primitives) and @epoch/experience-protocol
 *   (the consumed W011 vocabulary — genuine runtime composition per the
 *   W016 pin; same shape as W012/W013). Compatibility with
 *   @epoch/renderer-runtime, @epoch/world-model, and
 *   @epoch/experience-compiler is pinned via devDependency compile-time
 *   parity assertions (src/parity.ts) and runtime parity tests, never
 *   runtime deps.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), and the committed JSON
 * Schema projection under packages/world-experience/schemas/ pinned by
 * test/contract-drift.test.ts (the W007/W009 in-package convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  WORLD_EXPERIENCE_CONTRACT_VERSION,
  WORLD_EXPERIENCE_PROTOCOL_VERSION,
  WORLD_SCENE_SCHEMA_NAME,
  WORLD_INTENT_SCHEMA_NAME,
  WORLD_ONTOLOGY_SCHEMA_NAME,
  WORLD_FIDELITY_SCHEMA_NAME,
  WORLD_EXPERIENCE_DOCUMENT_KINDS,
  WORLD_EXPERIENCE_ERROR_CODES,
  WORLD_INTERACTION_KINDS,
  WORLD_INTENT_TYPE_NAMESPACE,
  WORLD_INTENT_TYPE_VERSION,
  WORLD_INTENT_VERSION,
  WORLD_ONTOLOGY_RECORD_KINDS,
  WORLD_ONTOLOGY_VERSION,
  WORLD_FIDELITY_LEVELS,
  WORLD_CAMERA_MODES,
  WORLD_CAMERA_TRANSITION_KINDS,
  WORLD_OVERLAY_KINDS,
  MAX_SCENE_ENTITIES,
  MAX_SCENE_OVERLAYS,
  MAX_APPLIED_OVERLAYS,
  MAX_ANIMATION_INSTRUCTIONS,
  MAX_INSTRUCTION_KEYFRAMES,
  MAX_NARRATIVE_BLOCKS,
  MAX_TIMELINE_MARKERS,
  MAX_SCENE_CONTROLS,
  MAX_SCENE_PARTICIPANTS,
  MAX_SCENE_AGENTS,
  MAX_EVIDENCE_REFERENCES,
  MAX_FOCUSED_ENTITIES,
  MAX_ONTOLOGY_ANIMATION_TRACKS,
  MAX_AFFORDANCE_INTERACTIONS,
  MAX_ONTOLOGY_RECORDS,
  MAX_FILTER_ENTITY_IDS,
} from './version';
export type {
  WorldExperienceProtocolVersion,
  WorldExperienceDocumentKind,
  WorldExperienceErrorCode,
  WorldInteractionKind,
  WorldOntologyRecordKind,
  WorldFidelityLevel,
  WorldCameraMode,
  WorldCameraTransitionKind,
  WorldOverlayKind,
} from './version';
export {
  WorldExperienceProtocolVersionSchema,
  WorldExperienceDocumentKindSchema,
  WorldExperienceErrorCodeSchema,
  WorldInteractionKindSchema,
  WorldOntologyRecordKindSchema,
  WorldFidelityLevelSchema,
  WorldCameraModeSchema,
  WorldCameraTransitionKindSchema,
  WorldOverlayKindSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (reused shared vocabularies + protocol-owned ids).
// ---------------------------------------------------------------------------
export {
  JsonValueSchema,
  Sha256HexSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  ColorHexSchema,
  Vec3Schema,
  QuaternionSchema,
  DeviceDescriptorSchema,
  DeviceClassSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  PoseTrackingKindSchema,
  InteractionModalitySchema,
  ProjectedWorldEntityRefSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  ExperienceGraphIdSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeIdSchema,
  // Protocol-owned id grammars.
  WORLD_SCENE_ID_PATTERN,
  WORLD_OVERLAY_ID_PATTERN,
  WORLD_ONTOLOGY_RECORD_ID_PATTERN,
  WORLD_RENDERER_SESSION_ID_PATTERN,
  WorldSceneIdSchema,
  WorldOverlayIdSchema,
  WorldOntologyRecordIdSchema,
  WorldEntityIdSchema,
  WorldRendererSessionIdSchema,
  WorldInvocationIdSchema,
  WorldVirtualTimeMsSchema,
} from './primitives';
export type {
  JsonValue,
  Sha256Hex,
  OpaqueScopeId,
  TenantScope,
  ColorHex,
  Vec3,
  Quaternion,
  DeviceDescriptor,
  DeviceClass,
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  PoseTrackingKind,
  InteractionModality,
  ProjectedWorldEntityRef,
  ProjectedAgentRef,
  ProjectedEvidenceRef,
  ExperienceGraphId,
  ExperienceGraphKind,
  ExperienceNodeId,
  WorldSceneId,
  WorldOverlayId,
  WorldOntologyRecordId,
  WorldEntityId,
  WorldRendererSessionId,
  WorldInvocationId,
  WorldVirtualTimeMs,
} from './primitives';

// ---------------------------------------------------------------------------
// Typed error taxonomy.
// ---------------------------------------------------------------------------
export { WorldIssueSchema, WorldExperienceErrorSchema } from './errors';
export type {
  WorldIssue,
  WorldExperienceError,
  WorldExperienceResult,
} from './errors';

// ---------------------------------------------------------------------------
// Camera/follow semantics (typed data with explicit transitions).
// ---------------------------------------------------------------------------
export {
  CameraStateSchema,
  CameraTransitionSchema,
  CameraZoomSchema,
  FollowAgentCameraSchema,
  FollowCursorStateSchema,
  FreeCameraSchema,
  OrbitCameraSchema,
  transitionCamera,
  updateFollowCursor,
  zoomCamera,
  WORLD_CAMERA_MODE_LIST,
} from './camera';
export type {
  CameraState,
  CameraTransition,
  CameraZoom,
  CameraTransitionInput,
  FollowAgentCamera,
  FollowCursorState,
  FreeCamera,
  OrbitCamera,
} from './camera';

// ---------------------------------------------------------------------------
// Visual overlays (library + deterministic application order).
// ---------------------------------------------------------------------------
export {
  VisualOverlaySchema,
  OverlayApplicationSchema,
  applyOverlayTo,
  computeOverlayUsage,
  removeOverlayFrom,
  validateOverlayState,
  WORLD_OVERLAY_KIND_LIST,
} from './overlay';
export type {
  VisualOverlay,
  OverlayApplication,
  HighlightOverlay,
  AnnotationOverlay,
  MeasurementOverlay,
  StateOverlay,
  OverlayUsage,
} from './overlay';

// ---------------------------------------------------------------------------
// Animation instructions.
// ---------------------------------------------------------------------------
export {
  AnimationInstructionSchema,
  computeAnimationUsage,
  validateAnimationInstructions,
} from './animation';
export type { AnimationInstruction, AnimationInstructionId, AnimationUsage } from './animation';

// ---------------------------------------------------------------------------
// Narrative/status blocks.
// ---------------------------------------------------------------------------
export {
  NarrativeStatusBlockSchema,
  computeNarrativeUsage,
  validateNarrativeBlocks,
} from './narrative';
export type { NarrativeStatusBlock, NarrativeBlockId, NarrativeUsage } from './narrative';

// ---------------------------------------------------------------------------
// Timeline/replay state (markers + position + seek/pause/resume).
// ---------------------------------------------------------------------------
export {
  SceneTimelineSchema,
  SceneTimelineMarkerSchema,
  SceneTimelinePositionSchema,
  pauseTimeline,
  resumeTimeline,
  seekTimelinePosition,
  timelineEndMs,
  validateTimelinePosition,
  computeTimelineUsage,
} from './timeline';
export type {
  SceneTimeline,
  SceneTimelineMarker,
  SceneTimelineMarkerId,
  SceneTimelinePosition,
  TimelineUsage,
} from './timeline';

// ---------------------------------------------------------------------------
// The world-subset interaction-intent vocabulary (Dynamic UI law enforced).
// ---------------------------------------------------------------------------
export {
  WorldInteractionIntentSchema,
  EXECUTABLE_UI_KEY_SEGMENTS,
  admitWorldIntent,
  controlIntentIdOf,
  controlIntentOf,
  isWorldInteractionKind,
  scanExecutableUiViolations,
} from './intent';
export type {
  WorldInteractionIntent,
  ExecutableUiViolation,
} from './intent';

// ---------------------------------------------------------------------------
// The domain visual ontology (pack-contributable typed records).
// ---------------------------------------------------------------------------
export {
  WorldOntologyRecordSchema,
  admitOntologyRecord,
  computeOntologyUsage,
  emptyOntology,
  ontologyRecordsForEntityType,
  registerOntologyRecords,
  resolveOntologyRecord,
  resolveOntologyRecordOfKind,
} from './ontology';
export type {
  WorldOntology,
  WorldOntologyRecord,
  Symbol2dRecord,
  Representation3dRecord,
  MaterialRecord,
  StateOverlayRecord,
  AnimationRecord,
  AffordanceRecord,
  OntologyUsage,
} from './ontology';

// ---------------------------------------------------------------------------
// Typed fidelity projections (device adaptation).
// ---------------------------------------------------------------------------
export {
  WorldSceneFidelityProjectionSchema,
  FidelityReductionSchema,
  FIDELITY_ASPECTS,
  FIDELITY_REDUCTION_REASONS,
  WORLD_FIDELITY_PROFILES,
  fidelityProfileOf,
  isWorldFidelityLevel,
  projectWorldScene,
} from './fidelity';
export type {
  WorldFidelityProfile,
  WorldSceneFidelityProjection,
  FidelityAspect,
  FidelityReduction,
  FidelityReductionReason,
  NarrativeDetail,
  PresenceDetail,
} from './fidelity';

// ---------------------------------------------------------------------------
// The world scene record + the pure in-memory scene store.
// ---------------------------------------------------------------------------
export {
  SceneControlIdSchema,
  SceneControlSchema,
  SceneEntitySchema,
  WorldSceneContentSchema,
  WorldSceneSchema,
  admitWorldSceneContent,
  applySceneOverlay,
  createWorldScene,
  emptyWorldSceneStore,
  focusSceneEntity,
  getWorldScene,
  listWorldScenes,
  computeSceneUsage,
  removeSceneOverlay,
  replaceWorldScene,
  runSceneSemanticGates,
  sealWorldSceneContent,
} from './scene';
export type {
  SceneControl,
  SceneControlId,
  SceneEntity,
  SceneUsage,
  SceneStoreOptions,
  WorldScene,
  WorldSceneContent,
  WorldSceneStoreState,
} from './scene';

// ---------------------------------------------------------------------------
// The world interaction reducer (intents -> scene transitions + effects).
// ---------------------------------------------------------------------------
export {
  WorldIntentEffectSchema,
  annotationOverlayIdOf,
  applyWorldIntent,
} from './reducer';
export type { WorldIntentEffect, WorldIntentOutcome } from './reducer';

// ---------------------------------------------------------------------------
// Budget respect (the mirrored W013 budgets + usage accounting).
// ---------------------------------------------------------------------------
export {
  WorldRenderBudgetsSchema,
  WORLD_PRIMITIVE_TRIANGLE_ESTIMATES,
  WORLD_MAX_RENDERER_GRAPH_NODES,
  WORLD_MAX_RENDERER_GRAPH_EDGES,
  WORLD_MAX_RENDERER_TRIANGLES,
  WORLD_MAX_RENDERER_TEXTURE_BYTES,
  computeSceneRenderUsage,
  enforceGraphBudgets,
  enforceUsageBudgets,
} from './budget';
export type { SceneRenderUsage, WorldRenderBudgets } from './budget';

// ---------------------------------------------------------------------------
// Renderer-envelope compilers (the W013-shaped output boundary).
// ---------------------------------------------------------------------------
export {
  WORLD_RENDERER_INVOCATION_SCHEMA_NAME,
  WORLD_RENDERER_PROTOCOL_VERSION,
  WORLD_INTERACTION_MODALITIES,
  WorldInvocationEnvelopeSchema,
  WorldMountGraphEnvelopeSchema,
  WorldAdvanceFrameEnvelopeSchema,
  WorldSubmitIntentEnvelopeSchema,
  admitAndCompileIntentSubmission,
  compilationDigestChain,
  compilationFingerprint,
  compileFrameAdvance,
  compileIntentSubmission,
  compileWorldScene,
} from './compile';
export type {
  SceneCompilation,
  SceneCompilationContext,
  SceneInvocationCoordinates,
  WorldInvocationEnvelope,
  WorldMountGraphEnvelope,
  WorldAdvanceFrameEnvelope,
  WorldSubmitIntentEnvelope,
} from './compile';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export {
  admitWorldScene,
  admitSealedWorldScene,
} from './parse';
export type { WorldAdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 content addressing + tamper detection).
// ---------------------------------------------------------------------------
export {
  computeWorldSceneDigest,
  sealWorldScene,
  serializeWorldScene,
  verifyWorldSceneDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Published schema surface + contract emission.
// ---------------------------------------------------------------------------
export {
  WORLD_EXPERIENCE_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  WORLD_EXPERIENCE_CONTRACT_DIR,
  renderWorldExperienceContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
