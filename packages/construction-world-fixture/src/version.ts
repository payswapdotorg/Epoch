/**
 * @epoch/construction-world-fixture — version + vocabulary (W071, ACR-012).
 *
 * Constants + closed vocabularies of the construction-solution world
 * fixture. The fixture REUSES the existing authority of
 * @epoch/world-experience (W016 WorldScene admission + timeline/marker
 * semantics), @epoch/pack-construction (DP1.0 entity bindings,
 * measurement methods, BOQ projection), and @epoch/solution-delivery
 * (USL1.0 universal delivery state). It introduces NO new semantic
 * authority — these constants are fixture-local composition values, not
 * contract surfaces.
 *
 * Determinism: every constant is a literal. Same constants -> same
 * digests across every run.
 */

// ---------------------------------------------------------------------------
// The fixture identity.
// ---------------------------------------------------------------------------

/** The frozen public API version of this fixture package. */
export const CONSTRUCTION_WORLD_FIXTURE_VERSION = '1.0.0' as const;

/** The contract version this fixture pins (W016 world-experience). */
export const CONSTRUCTION_WORLD_FIXTURE_PROTOCOL_VERSION = '1.0.0' as const;

/** The fixture's frozen tenant scope (canonical, no second authority). */
export const TENANT = 'tenant-epoch-construction' as const;

/** The fixture's frozen canonical scene id. */
export const SCENE_ID = 'wsc-construction-solution-pioneer-block-a' as const;

/** The fixture's frozen project scope. */
export const PROJECT_ID = 'scope-epoch-pioneer-block-a' as const;

// ---------------------------------------------------------------------------
// The six canonical construction layers (ACR-012 §3 — site, foundation,
// structure, envelope, mep, finishes). These are the layer-navigator
// data; they are NOT a new contract surface — the W016 scene derives
// semantic layers from the canonical entity-type namespaces.
// ---------------------------------------------------------------------------

export const CONSTRUCTION_LAYER_IDS = [
  'lyr-site',
  'lyr-foundation',
  'lyr-structure',
  'lyr-envelope',
  'lyr-mep',
  'lyr-finishes',
] as const;

export type ConstructionLayerId = (typeof CONSTRUCTION_LAYER_IDS)[number];

// ---------------------------------------------------------------------------
// The construction phase sequence (ACR-012 §7 — site -> excavation ->
// foundation -> structure -> walls -> roof -> mep -> finishes). These are
// fixture-local composition values; the timeline markers reuse the
// EXISTING W016 timeline/marker vocabulary (`event` / `phase-end` /
// `branch-point`).
// ---------------------------------------------------------------------------

export const CONSTRUCTION_PHASE_IDS = [
  'phase-site',
  'phase-excavation',
  'phase-foundation',
  'phase-structure',
  'phase-walls',
  'phase-roof',
  'phase-mep',
  'phase-finishes',
] as const;

export type ConstructionPhaseId = (typeof CONSTRUCTION_PHASE_IDS)[number];

// ---------------------------------------------------------------------------
// The three solution variants (ACR-012 §8 — Current / Alternative A /
// Alternative B).
// ---------------------------------------------------------------------------

export const SOLUTION_VARIANT_IDS = [
  'variant-current',
  'variant-alt-a',
  'variant-alt-b',
] as const;

export type SolutionVariantId = (typeof SOLUTION_VARIANT_IDS)[number];

// ---------------------------------------------------------------------------
// The construction primitive shapes the renderer-neutral geometry uses
// (the W016 ontology `representation-3d` records — consumed as-is).
// ---------------------------------------------------------------------------

export const CONSTRUCTION_GEOMETRY_PRIMITIVES = [
  'box',
  'cylinder',
  'plane',
] as const;

export type ConstructionGeometryPrimitive = (typeof CONSTRUCTION_GEOMETRY_PRIMITIVES)[number];

// ---------------------------------------------------------------------------
// The risk levels the solution variants carry (ACR-012 §8). Fixture-local
// composition values; not a new contract surface.
// ---------------------------------------------------------------------------

export const SOLUTION_RISK_LEVELS = ['low', 'medium', 'high'] as const;

export type SolutionRiskLevel = (typeof SOLUTION_RISK_LEVELS)[number];

// ---------------------------------------------------------------------------
// The constraint/finding severities (ACR-012 §8 — OK + WARN). Fixture-local
// composition values.
// ---------------------------------------------------------------------------

export const CONSTRAINT_SEVERITIES = ['ok', 'warn'] as const;

export type ConstraintSeverity = (typeof CONSTRAINT_SEVERITIES)[number];

// ---------------------------------------------------------------------------
// The constraint/finding categories (ACR-012 §8 — budget / programme /
// clearance / spacing / availability / clash).
// ---------------------------------------------------------------------------

export const CONSTRAINT_CATEGORIES = [
  'budget',
  'programme',
  'clearance',
  'spacing',
  'availability',
  'clash',
  'compliance',
] as const;

export type ConstraintCategory = (typeof CONSTRAINT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// The entity ID literals of the construction solution (deterministic).
// Every visible construction system carries at least one entity.
// ---------------------------------------------------------------------------

export const ENTITY_IDS = {
  // SITE
  siteBoundary: 'cs-site-boundary',
  siteAccess: 'cs-site-access-north',
  siteStaging: 'cs-site-staging-yard',
  siteExcavation: 'cs-site-excavation-pit',

  // FOUNDATION
  foundationStrip: 'cs-foundation-strip-perimeter',
  foundationBaseA: 'cs-foundation-base-a',
  foundationBaseB: 'cs-foundation-base-b',
  groundSlab: 'cs-foundation-ground-slab',

  // STRUCTURE
  column01: 'COL-01',
  column02: 'COL-02',
  column03: 'COL-03',
  column04: 'COL-04',
  beam01: 'cs-structure-beam-grid-1',
  beam02: 'cs-structure-beam-grid-2',
  roofStructure: 'cs-structure-roof-frame',

  // ENVELOPE
  wallNorth: 'cs-envelope-wall-north',
  wallSouth: 'cs-envelope-wall-south',
  wallEast: 'cs-envelope-wall-east',
  wallWest: 'cs-envelope-wall-west',
  doorFront: 'cs-envelope-door-front',
  windowSouth01: 'cs-envelope-window-south-01',
  windowSouth02: 'cs-envelope-window-south-02',
  roofCladding: 'cs-envelope-roof-cladding',

  // MEP
  electricalPanel: 'cs-mep-electrical-panel',
  lightingCircuit: 'cs-mep-lighting-circuit',
  plumbingRiser: 'cs-mep-plumbing-riser',
  hvacDuct: 'cs-mep-hvac-duct',
  hvacUnit: 'cs-mep-hvac-roof-unit',
  drainagePipe: 'cs-mep-drainage-pipe',
  /** The hidden MEP clash risk: the HVAC duct route crosses the
   * plumbing riser — findable only by isolating/revealing the MEP
   * layer (the spatial-world acceptance: the problem is solved IN the
   * world, not through a table). */
  legacyConduit: 'cs-mep-legacy-conduit-l2',

  // FINISHES
  ceiling: 'cs-finishes-ceiling',
  floor: 'cs-finishes-floor-screed',
  paintWall: 'cs-finishes-paint-walls',
  fixtures: 'cs-finishes-fixtures',
} as const;

// ---------------------------------------------------------------------------
// The agent ID literals (deterministic).
// ---------------------------------------------------------------------------

export const AGENT_IDS = {
  structuralEngineer: 'agent:cs-structural-engineer',
  siteCoordinator: 'agent:cs-site-coordinator',
} as const;

// ---------------------------------------------------------------------------
// The overlay + control + marker ID literals (deterministic).
// ---------------------------------------------------------------------------

export const OVERLAY_IDS = {
  mepClash: 'ovl-cs-highlight-mep-clash',
  structureSpan: 'ovl-cs-measure-structure-span',
  groundSlabState: 'ovl-cs-state-ground-slab',
} as const;

export const CONTROL_IDS = {
  branch: 'ctl-cs-branch-solution',
  simulate: 'ctl-cs-simulate-programme',
  pause: 'ctl-cs-pause-replay',
} as const;

export const MARKER_IDS = {
  site: 'mrk-cs-phase-site',
  excavation: 'mrk-cs-phase-excavation',
  foundation: 'mrk-cs-phase-foundation',
  structure: 'mrk-cs-phase-structure',
  walls: 'mrk-cs-phase-walls',
  roof: 'mrk-cs-phase-roof',
  mep: 'mrk-cs-phase-mep',
  finishes: 'mrk-cs-phase-finishes',
  branch: 'mrk-cs-branch-solution',
} as const;

/** The branch point (virtual time) the construction programme can fork at. */
export const BRANCH_AT_MS = 8_000;

/** The construction programme replay track: 0..16s, position 2s, playing. */
export const TRACK = { startMs: 0, endMs: 16_000, positionAtMs: 2_000 } as const;
