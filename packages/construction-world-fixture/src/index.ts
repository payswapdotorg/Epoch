/**
 * @epoch/construction-world-fixture — FROZEN public API (W071, ACR-012 §9).
 *
 * The versioned contract surface W072 (web) + W073 (desktop) compile
 * against. This file is the SINGLE frozen public index of the package —
 * every export is a deterministic, content-addressed value.
 *
 * Authority model: REUSES the existing @epoch/world-experience W016
 * WorldScene admission, the existing @epoch/renderer-fabric seam, the
 * existing @epoch/pack-construction / @epoch/solution-delivery
 * structures, and the @epoch/capability-registry manifest sealing. NO
 * new semantic authority, NO second lifecycle, NO second timeline, NO
 * second BOQ authority. Every richer projection datum (renderer-neutral
 * geometry, engineering projection, layer data, phase timeline, agents,
 * variants, BOQ rollups, constraints) lives IN THE FIXTURE as
 * fixture-owned composition data — never as contract changes.
 *
 * Determinism: fixed seeds, no network, no wall-clock, no randomness.
 * Same inputs -> identical fixture. Same fixture -> identical digests
 * every run (the QA battery asserts digest stability across two
 * compositions).
 */
// ---------------------------------------------------------------------------
// Versions + closed vocabularies (frozen fixture constants).
// ---------------------------------------------------------------------------
export {
  CONSTRUCTION_WORLD_FIXTURE_VERSION,
  CONSTRUCTION_WORLD_FIXTURE_PROTOCOL_VERSION,
  TENANT,
  SCENE_ID,
  PROJECT_ID,
  CONSTRUCTION_LAYER_IDS,
  CONSTRUCTION_PHASE_IDS,
  SOLUTION_VARIANT_IDS,
  CONSTRUCTION_GEOMETRY_PRIMITIVES,
  SOLUTION_RISK_LEVELS,
  CONSTRAINT_SEVERITIES,
  CONSTRAINT_CATEGORIES,
  ENTITY_IDS,
  AGENT_IDS,
  OVERLAY_IDS,
  CONTROL_IDS,
  MARKER_IDS,
  BRANCH_AT_MS,
  TRACK,
} from './version';
export type {
  ConstructionLayerId,
  ConstructionPhaseId,
  SolutionVariantId,
  ConstructionGeometryPrimitive,
  SolutionRiskLevel,
  ConstraintSeverity,
  ConstraintCategory,
} from './version';

// ---------------------------------------------------------------------------
// Typed data shapes (the fixture-owned projection records).
// ---------------------------------------------------------------------------
export type {
  ConstructionEntityGeometry,
  ConstructionMaterial,
  ConstructionQuantity,
  ConstructionCostReference,
  ConstructionEntityProjection,
  ConstructionLayer,
  ConstructionPhase,
  ConstructionAgent,
  SolutionVariantDelta,
  ConstructionSolutionVariant,
  ConstructionBoqLineItem,
  ConstructionBoqLayerRollup,
  ConstructionConstraintRecord,
} from './types';

// ---------------------------------------------------------------------------
// The fixture digest (deterministic).
// ---------------------------------------------------------------------------
export { digestOf, FIXTURE_DIGEST } from './digest';

// ---------------------------------------------------------------------------
// The ontology (pack-contributed W016 representation-3d records).
// ---------------------------------------------------------------------------
export { ONTOLOGY, ONTOLOGY_RECORDS_FROZEN } from './ontology';

// ---------------------------------------------------------------------------
// The semantic entity set (geometry + engineering projection).
// ---------------------------------------------------------------------------
export { ENTITY_GEOMETRY, ENTITY_PROJECTIONS, ENTITY_COUNT } from './entities';

// ---------------------------------------------------------------------------
// The six construction layers (layer-navigator data).
// ---------------------------------------------------------------------------
export { LAYERS, LAYER_IDS } from './layers';

// ---------------------------------------------------------------------------
// The construction phase timeline (reuses W016 marker vocabulary).
// ---------------------------------------------------------------------------
export { PHASES, BRANCH_PHASE, PHASE_COUNT } from './timeline';

// ---------------------------------------------------------------------------
// The spatial construction agents (≥2).
// ---------------------------------------------------------------------------
export { AGENTS } from './agents';

// ---------------------------------------------------------------------------
// The three solution variants (Current/Alt A/Alt B).
// ---------------------------------------------------------------------------
export { VARIANTS, VARIANT_CURRENT, VARIANT_ALT_A, VARIANT_ALT_B } from './variants';

// ---------------------------------------------------------------------------
// The per-layer BOQ rollups + line items + grand total.
// ---------------------------------------------------------------------------
export {
  BOQ_LAYER_ROLLUPS,
  BOQ_LINE_ITEMS,
  BOQ_GRAND_TOTAL,
} from './boq';

// ---------------------------------------------------------------------------
// The constraint / finding records (≥5, incl. the MEP clash).
// ---------------------------------------------------------------------------
export { CONSTRAINTS, MEP_CLASH_FINDING } from './constraints';

// ---------------------------------------------------------------------------
// The composed fixture: the deterministic factory + the frozen instance +
// the renderer registrations (the W061 pattern — real Three.js +
// Babylon.js + reference fallback via the real RendererFabric).
// ---------------------------------------------------------------------------
export {
  SCENE,
  SCENE_CONTENT_FROZEN,
  DEVICE,
  REFERENCE_RENDERER_ID,
  RENDERER_PREFERENCE,
  buildWorldFabric,
  buildHeadlessWorldFabric,
  createConstructionSolutionFixture,
  FIXTURE,
} from './fixture';
export type {
  ConstructionWorldFabricOptions,
  ConstructionWorldFabric,
  ConstructionSolutionFixture,
} from './fixture';

// Re-export the real engine renderer ids (the W061 pattern).
export { THREE_RENDERER_ID } from '@epoch/adapter-renderer-threejs';
export { BABYLONJS_RENDERER_ID } from '@epoch/adapter-renderer-babylonjs';
