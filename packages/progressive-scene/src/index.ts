/**
 * @epoch/progressive-scene — public API (experience layer, Work Order
 * W019, content-side adaptation).
 *
 * The CONTENT half of Renderer/Device Adaptation: deterministic
 * progressive refinement of sealed W011 Experience Graphs into ordered
 * LOD ladders that fit the W013 renderer hosting budgets.
 *
 * - A typed canonical stage sequence (animation clips dropped first,
 *   opaque mesh assets substituted by neutral box proxies, expensive
 *   primitives downgraded, supplementary nodes pruned, the 3D→2D
 *   fallback, then the minimal core) derives a sealed
 *   {@link ProgressiveSceneLadder} whose every rung is a RE-SEALED W011
 *   graph — mountable through the unchanged W013 mount-graph path —
 *   carrying an EXPLICIT reduction manifest (same semantics, different
 *   fidelity, never silent — the W016 fidelity discipline).
 * - Rungs chain by digest, so the derivation history is tamper-evident;
 *   `rungGraphAt` re-derives any rung deterministically.
 * - `fitGraphToLimits` walks the ladder against the W013 binding's
 *   effective limits and returns the first fitting rung with the
 *   declared usage the W013 mount envelope must carry; when even the
 *   minimal-core rung cannot fit, the answer is a typed
 *   `unfittable-scene` rejection (honesty over silent clamping).
 * - Deterministic usage accounting mirrors the W012 experience-compiler
 *   discipline (estimate table parity-pinned via devDependencies — never
 *   a runtime edge).
 * - DETERMINISM: zero wall-clock, zero randomness, zero I/O; the ladder
 *   is a pure function of the source graph and the caller-supplied
 *   ladder id.
 * - TENANT ISOLATION (R12): the ladder fixes the graph's tenant scope;
 *   cross-tenant derivation and admission are typed
 *   `cross-tenant-denied` rejections.
 * - Provider-NEUTRAL by construction (lock rule 13): zero engine
 *   vocabulary, zero GPU code, zero UI-framework dependencies; strict
 *   objects reject unknown (vendor) fields.
 *
 * Runtime dependencies are exactly @epoch/agent-protocol (canonical
 * digest machinery), @epoch/experience-protocol (the W011 graph
 * vocabulary — genuine runtime composition), and @epoch/renderer-runtime
 * (the W013 effective-limits authority — the fit target, never
 * redefined). Compatibility with @epoch/experience-compiler and
 * @epoch/experience-runtime is pinned via devDependencies +
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
  PROGRESSIVE_SCENE_CONTRACT_VERSION,
  PROGRESSIVE_SCENE_PROTOCOL_VERSION,
  PROGRESSIVE_SCENE_DOCUMENT_KINDS,
  PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME,
  SCENE_FIT_SCHEMA_NAME,
  REDUCTION_STAGE_KINDS,
  CANONICAL_STAGE_ORDER,
  PROGRESSIVE_SCENE_ERROR_CODES,
  PROXY_PRIMITIVE,
  MAX_LADDER_RUNGS,
} from './version';
export type {
  ProgressiveSceneProtocolVersion,
  ProgressiveSceneDocumentKind,
  ReductionStageKind,
  ProgressiveSceneErrorCode,
} from './version';
export {
  ProgressiveSceneProtocolVersionSchema,
  ReductionStageKindSchema,
  ProgressiveSceneErrorCodeSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (progressive-scene-owned ids + reused vocabularies).
// ---------------------------------------------------------------------------
export {
  LADDER_ID_PATTERN,
  LadderIdSchema,
  RungIndexSchema,
} from './primitives';
export type { LadderId, RungIndex } from './primitives';

// ---------------------------------------------------------------------------
// Deterministic usage accounting (the mirrored W012 discipline).
// ---------------------------------------------------------------------------
export {
  PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES,
  SceneUsageSchema,
  estimateGraphUsage,
  usageFits,
} from './estimates';
export type { SceneUsage } from './estimates';

// ---------------------------------------------------------------------------
// The reduction engine (one pure applicator per stage).
// ---------------------------------------------------------------------------
export {
  PrimitiveSubstitutionSchema,
  RungReductionSchema,
  PRUNE_STAGES,
  pruneStageKinds,
  dropAnimationClips,
  substituteMeshProxies,
  downgradeExpensivePrimitives,
  prunePresenceCursors,
  prunePresenceSeats,
  pruneTimelineMarkers,
  pruneTimelineTracks,
  pruneSpatialNodes,
  pruneShapeNodes,
  pruneControlNodes,
  pruneToMinimalCore,
  CANONICAL_STAGE_TABLE,
  applyStage,
} from './reduce';
export type {
  PrimitiveSubstitution,
  RungReduction,
  StageOutcome,
  StageApplicator,
  PruneStageKind,
} from './reduce';

// ---------------------------------------------------------------------------
// The progressive scene ladder + budget fitting.
// ---------------------------------------------------------------------------
export {
  LadderRungSchema,
  ProgressiveSceneLadderContentSchema,
  ProgressiveSceneLadderSchema,
  SceneFitSchema,
  deriveProgressiveLadder,
  rungGraphAt,
  fitGraphToLimits,
} from './ladder';
export type {
  LadderRung,
  ProgressiveSceneLadderContent,
  ProgressiveSceneLadder,
  SceneFit,
  DeclaredUsage,
  LadderOptions,
  DeriveLadderInput,
} from './ladder';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 + tamper detection).
// ---------------------------------------------------------------------------
export {
  ladderContentOf,
  computeLadderDigest,
  verifyLadderDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export { parseProgressiveSceneLadder } from './parse';
export type { AdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Typed error taxonomy.
// ---------------------------------------------------------------------------
export { ProgressiveSceneIssueSchema, ProgressiveSceneErrorSchema } from './errors';
export type {
  ProgressiveSceneIssue,
  ProgressiveSceneError,
  ProgressiveSceneResult,
} from './errors';

// ---------------------------------------------------------------------------
// Published schema surface + contract emission.
// ---------------------------------------------------------------------------
export { PROGRESSIVE_SCENE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  PROGRESSIVE_SCENE_CONTRACT_DIR,
  renderProgressiveSceneContractFiles,
} from './contract-emission';
export { typeToKebabCase } from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
