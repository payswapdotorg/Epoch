/**
 * The CONSTRUCTION SOLUTION presentation model (W073, ACR-012) — the pure,
 * React-free projection of the FROZEN W071 fixture the desktop
 * construction workspace renders.
 *
 * Everything in this module is a PROJECTION of
 * `@epoch/construction-world-fixture` (the frozen public API): the same
 * semantic entities, the same world digest, the same layers, phases,
 * agents, variants, BOQ and constraints. NO second semantic ledger: the
 * engineering inspector, the layer navigator, the BOQ/cost surface, the
 * constraints surface and the variant comparison all read the SAME frozen
 * fixture values; the canonical world authority stays the W016 WorldScene
 * behind the @epoch/world-runtime workspace.
 *
 * The variant application is the HOST PRESENTATION of a solution branch
 * (ACR-012 §8): selecting a variant issues the EXISTING typed branch
 * intent through the workspace runtime (the fixture's branch-point
 * marker) and re-presents the world with the variant's fixture-owned
 * deltas — the canonical scene itself is NEVER mutated (a variant is a
 * proposed branch, not an applied change).
 */
import {
  AGENTS,
  BOQ_GRAND_TOTAL,
  BOQ_LAYER_ROLLUPS,
  BOQ_LINE_ITEMS,
  BRANCH_PHASE,
  CONSTRAINTS,
  CONTROL_IDS,
  ENTITY_GEOMETRY,
  ENTITY_PROJECTIONS,
  FIXTURE,
  LAYERS,
  PHASES,
  SOLUTION_VARIANT_IDS,
  TENANT,
  TRACK,
  VARIANTS,
  type ConstructionAgent,
  type ConstructionBoqLayerRollup,
  type ConstructionBoqLineItem,
  type ConstructionConstraintRecord,
  type ConstructionEntityGeometry,
  type ConstructionEntityProjection,
  type ConstructionLayer,
  type ConstructionPhase,
  type ConstructionSolutionVariant,
  type SolutionVariantDelta,
  type SolutionVariantId,
} from '@epoch/construction-world-fixture';

// ---------------------------------------------------------------------------
// The frozen fixture re-export (the single composition input).
// ---------------------------------------------------------------------------

/** The frozen W071 construction-solution fixture (consume, never modify). */
export const CONSTRUCTION_FIXTURE = FIXTURE;

/** The canonical scene identity presented by the workspace. */
export const SOLUTION_IDENTITY = {
  tenantId: TENANT,
  sceneId: FIXTURE.sceneId,
  projectId: FIXTURE.projectId,
  sceneName: FIXTURE.sceneContent.name,
  fixtureDigest: FIXTURE.fixtureDigest,
} as const;

// ---------------------------------------------------------------------------
// Layers + phases (projections of the fixture vocabulary).
// ---------------------------------------------------------------------------

/** The six construction layers in canonical order (fixture data). */
export const SOLUTION_LAYERS: readonly ConstructionLayer[] = LAYERS;

/** The eight construction phases in programme order (fixture data). */
export const SOLUTION_PHASES: readonly ConstructionPhase[] = PHASES;

/** The branch-point phase where Current/Alt A/Alt B fork (fixture data). */
export const SOLUTION_BRANCH_PHASE: ConstructionPhase = BRANCH_PHASE;

/** The layer record of one layer id (or null when unknown). */
export function layerRecordOf(layerId: string): ConstructionLayer | null {
  return LAYERS.find((layer) => layer.layerId === layerId) ?? null;
}

/** The engineering projection of one entity id (or null when unknown). */
export function projectionOf(entityId: string): ConstructionEntityProjection | null {
  return ENTITY_PROJECTIONS.find((p) => p.entityId === entityId) ?? null;
}

/** The index of one phase id in the programme order (−1 when unknown). */
export function phaseIndexOf(phaseId: string): number {
  return PHASES.findIndex((phase) => phase.phaseId === phaseId);
}

/** The phase record of one phase id (or null when unknown). */
export function phaseRecordOf(phaseId: string): ConstructionPhase | null {
  return PHASES.find((phase) => phase.phaseId === phaseId) ?? null;
}

/**
 * The construction phase active at one virtual time (the LAST phase whose
 * marker time is at or before it, clamped to the replay track).
 */
export function phaseAt(atMs: number): ConstructionPhase {
  const clamped = Math.max(TRACK.startMs, Math.min(TRACK.endMs, atMs));
  let current = PHASES[0] as ConstructionPhase | undefined;
  for (const phase of PHASES) {
    if (clamped >= phase.atMs) current = phase;
  }
  if (current === undefined) {
    throw new Error('construction fixture: the phase table is empty (frozen contract violation)');
  }
  return current;
}

/** Whether one entity's construction phase is built at the active phase. */
export function entityBuiltAtPhase(entity: ConstructionEntityGeometry, activePhase: ConstructionPhase): boolean {
  const entityPhaseIndex = phaseIndexOf(entity.phase);
  const activeIndex = phaseIndexOf(activePhase.phaseId);
  return entityPhaseIndex >= 0 && activeIndex >= 0 && entityPhaseIndex <= activeIndex;
}

// ---------------------------------------------------------------------------
// The variant application (host presentation of a solution branch).
// ---------------------------------------------------------------------------

/** The presentation state of one entity under the active variant. */
export type VariantPresentationState = 'baseline' | 'changed' | 'added' | 'removed';

/** One presented construction entity (geometry + projection + variant delta). */
export interface PresentedConstructionEntity {
  readonly geometry: ConstructionEntityGeometry;
  readonly projection: ConstructionEntityProjection;
  readonly delta: SolutionVariantDelta | null;
  readonly state: VariantPresentationState;
}

/** The variant record of one variant id (or null when unknown). */
export function variantOf(variantId: SolutionVariantId): ConstructionSolutionVariant | null {
  return VARIANTS.find((variant) => variant.variantId === variantId) ?? null;
}

/**
 * The deterministic presentation geometry adjustments for 'changed'
 * variant deltas — each entry encodes the geometry effect of the frozen
 * delta note (e.g. Alt A's "+0.5m Z offset, +1.0m extra run" HVAC reroute).
 * Entities whose delta note carries no geometry effect keep the baseline
 * geometry (the note alone is presented).
 */
interface GeometryAdjustment {
  /** World-space Z offset (meters). */
  readonly dz?: number;
  /** Extra X extent (meters) added to the bbox. */
  readonly extendX?: number;
  /** Uniform bbox grow (meters) — e.g. an insulation layer. */
  readonly grow?: number;
  /** Uniform bbox scale factor (all extents). */
  readonly scaleAll?: number;
  /** X-only bbox scale factor (e.g. a shortened run). */
  readonly scaleX?: number;
}

const VARIANT_GEOMETRY_ADJUSTMENTS: Readonly<Record<string, GeometryAdjustment>> = {
  // Alt A — reroute the HVAC duct south of the plumbing riser.
  'variant-alt-a:cs-mep-hvac-duct': { dz: 0.5, extendX: 1.0 },
  // Alt A — insulate the plumbing riser (+1 layer ≈ 40mm).
  'variant-alt-a:cs-mep-plumbing-riser': { grow: 0.04 },
  // Alt B — downsize the roof unit 60% (split-system condenser only).
  'variant-alt-b:cs-mep-hvac-roof-unit': { scaleAll: 0.4 },
  // Alt B — shorten the HVAC duct 40% (interior AHU shortens the run).
  'variant-alt-b:cs-mep-hvac-duct': { scaleX: 0.6 },
};

/** Apply one variant's geometry adjustment to a baseline geometry record. */
function adjustGeometry(
  geometry: ConstructionEntityGeometry,
  variantId: SolutionVariantId,
): ConstructionEntityGeometry {
  const adjustment = VARIANT_GEOMETRY_ADJUSTMENTS[`${variantId}:${geometry.entityId}`];
  if (adjustment === undefined) {
    return geometry;
  }
  const [x, y, z] = geometry.position;
  const [bx, by, bz] = geometry.bbox;
  const scaleAll = adjustment.scaleAll ?? 1;
  const scaleX = adjustment.scaleX ?? 1;
  const grow = adjustment.grow ?? 0;
  return {
    ...geometry,
    position: [x, y, z + (adjustment.dz ?? 0)],
    bbox: [
      bx * scaleX * scaleAll + (adjustment.extendX ?? 0) + grow,
      by * scaleAll + grow,
      bz * scaleAll + grow,
    ],
  };
}

/**
 * The synthetic presentations of variant-ADDED entities (fixture deltas
 * reference entities that exist only in the variant's world state — e.g.
 * Alt B's interior air-handling unit). Deterministic literals keyed by
 * the frozen delta entity id.
 */
const ADDED_ENTITY_PRESENTATIONS: Readonly<
  Record<string, { readonly geometry: ConstructionEntityGeometry; readonly projection: ConstructionEntityProjection }>
> = {
  'cs-mep-hvac-ahu-interior': {
    geometry: {
      entityId: 'cs-mep-hvac-ahu-interior',
      primitive: 'box',
      position: [0, 2.6, 1.5],
      bbox: [1.2, 0.6, 0.9],
      rotation: [0, 0, 0, 1],
      layer: 'lyr-mep',
      phase: 'phase-mep',
      visibleByDefault: true,
    },
    projection: {
      entityId: 'cs-mep-hvac-ahu-interior',
      entityType: 'mep:unit',
      label: 'Interior air-handling unit (AHU)',
      material: { name: 'Split-system AHU', grade: 'Ceiling-hung interior unit' },
      dimensions: [1.2, 0.6, 0.9],
      quantity: { value: '1', unit: 'nr' },
      phase: 'phase-mep',
      status: 'pending',
      cost: { lineId: 'line:cs-mep-ahu-interior', currency: 'EUR', amount: '—' },
      constraints: ['Verify ceiling hanger capacity for the interior AHU.'],
    },
  },
};

/**
 * The presented construction world under one solution variant: every
 * baseline entity (with its variant delta applied) plus the variant's
 * added entities — sorted by entity id (deterministic).
 */
export function presentedEntities(variantId: SolutionVariantId): readonly PresentedConstructionEntity[] {
  const variant = variantOf(variantId);
  const deltas = variant?.deltas ?? [];
  const deltaByEntity = new Map<string, SolutionVariantDelta>(deltas.map((d) => [d.entityId, d]));
  const presented: PresentedConstructionEntity[] = [];
  for (const geometry of ENTITY_GEOMETRY) {
    const projection = projectionOf(geometry.entityId);
    if (projection === null) {
      throw new Error(`construction fixture: no projection for ${geometry.entityId} (frozen contract violation)`);
    }
    const delta = deltaByEntity.get(geometry.entityId) ?? null;
    if (delta !== null && delta.kind === 'removed') {
      presented.push({ geometry, projection, delta, state: 'removed' });
      continue;
    }
    if (delta !== null && delta.kind === 'changed') {
      presented.push({
        geometry: adjustGeometry(geometry, variantId),
        projection,
        delta,
        state: 'changed',
      });
      continue;
    }
    presented.push({ geometry, projection, delta: null, state: 'baseline' });
  }
  for (const delta of deltas) {
    if (delta.kind !== 'added') continue;
    const synthetic = ADDED_ENTITY_PRESENTATIONS[delta.entityId];
    if (synthetic === undefined) continue;
    presented.push({ ...synthetic, delta, state: 'added' });
  }
  return presented.sort((a, b) => (a.geometry.entityId < b.geometry.entityId ? -1 : 1));
}

/** The variant delta summary (HUD metrics). */
export function variantDeltaSummary(variantId: SolutionVariantId): {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
  readonly total: number;
} {
  const deltas = variantOf(variantId)?.deltas ?? [];
  const added = deltas.filter((d) => d.kind === 'added').length;
  const changed = deltas.filter((d) => d.kind === 'changed').length;
  const removed = deltas.filter((d) => d.kind === 'removed').length;
  return { added, changed, removed, total: deltas.length };
}

// ---------------------------------------------------------------------------
// The plan presentation (true top-down orthographic projection).
// ---------------------------------------------------------------------------

/** The plan canvas (viewBox units; north up, X right, Z down). */
export const PLAN_VIEW = { width: 860, height: 560, pad: 26 } as const;

/** One axis-aligned world rectangle (min/max in two axes). */
export interface WorldRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** A 2D world→canvas projector (orthographic; either plan or section). */
export interface OrthoProjector {
  readonly width: number;
  readonly height: number;
  /** px per meter (both axes share the scale — no distortion). */
  readonly scale: number;
  /** World X (plan: X / section: Z) → canvas px. */
  px(worldA: number): number;
  /** World Y (plan: Z / section: height Y) → canvas px (section flips Y up). */
  py(worldB: number): number;
  /** Canvas px → world A. */
  worldA(px: number): number;
  /** Canvas px → world B. */
  worldB(py: number): number;
  /** The covered world bounds. */
  readonly bounds: WorldRect;
}

/** Build an orthographic projector over explicit world bounds (shared scale). */
function orthoProjector(
  bounds: WorldRect,
  width: number,
  height: number,
  pad: number,
  flipY = false,
): OrthoProjector {
  const spanA = Math.max(0.001, bounds.maxX - bounds.minX);
  const spanB = Math.max(0.001, bounds.maxY - bounds.minY);
  const scale = Math.min((width - 2 * pad) / spanA, (height - 2 * pad) / spanB);
  const originA = (width - spanA * scale) / 2;
  const originB = (height - spanB * scale) / 2;
  return {
    width,
    height,
    scale,
    bounds,
    px: (a) => originA + (a - bounds.minX) * scale,
    py: (b) =>
      flipY
        ? height - originB - (b - bounds.minY) * scale
        : originB + (b - bounds.minY) * scale,
    worldA: (px) => bounds.minX + (px - originA) / scale,
    worldB: (py) =>
      flipY ? bounds.minY + (height - originB - py) / scale : bounds.minY + (py - originB) / scale,
  };
}

/** The union bounds (X × Z) of the presented entities + margin (plan). */
function planBoundsOf(entities: readonly PresentedConstructionEntity[]): WorldRect {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const { geometry } of entities) {
    const [x, , z] = geometry.position;
    const [bx, , bz] = geometry.bbox;
    minX = Math.min(minX, x - bx / 2);
    maxX = Math.max(maxX, x + bx / 2);
    minZ = Math.min(minZ, z - bz / 2);
    maxZ = Math.max(maxZ, z + bz / 2);
  }
  const margin = 1.2;
  return { minX: minX - margin, maxX: maxX + margin, minY: minZ - margin, maxY: maxZ + margin };
}

/** The plan projector over one presented world (north up: Z down). */
export function planProjectorFor(entities: readonly PresentedConstructionEntity[]): OrthoProjector {
  return orthoProjector(planBoundsOf(entities), PLAN_VIEW.width, PLAN_VIEW.height, PLAN_VIEW.pad);
}

/** The plan footprint rect of one entity (canvas-space, from the projector). */
export function planRectOf(
  entity: PresentedConstructionEntity,
  projector: OrthoProjector,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const [x, , z] = entity.geometry.position;
  const [bx, , bz] = entity.geometry.bbox;
  const left = projector.px(x - bx / 2);
  const top = projector.py(z - bz / 2);
  return {
    x: left,
    y: top,
    width: Math.max(2, bx * projector.scale),
    height: Math.max(2, bz * projector.scale),
  };
}

/**
 * Hit-test one plan-canvas point against the presented entities (smallest
 * footprint first — pipes and columns win over slabs; deterministic).
 */
export function planEntityAt(
  entities: readonly PresentedConstructionEntity[],
  projector: OrthoProjector,
  point: { readonly x: number; readonly y: number },
): PresentedConstructionEntity | null {
  const candidates = [...entities].sort((a, b) => footprintOf(a) - footprintOf(b));
  for (const entity of candidates) {
    const rect = planRectOf(entity, projector);
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return entity;
    }
  }
  return null;
}

/** The plan footprint area (m²) of one entity (draw/hit ordering). */
function footprintOf(entity: PresentedConstructionEntity): number {
  const [bx, , bz] = entity.geometry.bbox;
  return bx * bz;
}

/** The plan draw order for the plan presentation (large footprints first). */
export function planDrawOrder(entities: readonly PresentedConstructionEntity[]): readonly PresentedConstructionEntity[] {
  return [...entities].sort((a, b) => footprintOf(b) - footprintOf(a));
}

/**
 * The SECTION A–A cut line drawn on the PLAN presentation: the canvas
 * segment at the cut's world X, spanning the drawn plan height, plus the
 * "A" label anchors at both ends (the classic engineering-drawing
 * convention — the plan carries the section's cut position + view
 * direction, so the two presentations stay tied to ONE cut state).
 */
export interface PlanCutLine {
  /** The world X of the cut (meters). */
  readonly cutX: number;
  /** The canvas X of the cut line (viewBox px). */
  readonly xPx: number;
  /** The canvas Y of the segment's top end (viewBox px). */
  readonly y1Px: number;
  /** The canvas Y of the segment's bottom end (viewBox px). */
  readonly y2Px: number;
}

/** The plan cut line at one cut position (canvas-space). */
export function planCutLineOf(projector: OrthoProjector, cutX: number): PlanCutLine {
  return {
    cutX,
    xPx: projector.px(cutX),
    y1Px: 34,
    y2Px: projector.height - 34,
  };
}

// ---------------------------------------------------------------------------
// The section presentation (cutaway at the labelled cut plane).
// ---------------------------------------------------------------------------

/**
 * The section cut plane (x = +2.0m — through the building's MEP zone, so
 * the cutaway exposes the internal systems: foundation, slab, walls,
 * beams, ceiling AND the HVAC duct / plumbing riser / legacy conduit).
 * This is the DEFAULT cut position; the workspace keeps the live cut as
 * interactive state (W073 chunk 2 — the cut-plane interaction) and
 * re-projects the section at the adjusted position (plan + section both).
 */
export const SECTION_CUT_X = 2.0;

/** The step of the cut-plane adjustment (meters — snap precision). */
export const SECTION_CUT_STEP = 0.25;

/** The valid cut-plane range of one presented world (see sectionCutRangeOf). */
export interface SectionCutRange {
  readonly minX: number;
  readonly maxX: number;
}

/**
 * The valid cut-plane range: the BUILDING's X extent (every presented
 * entity outside the SITE layer — the site boundary / staging yard / fence
 * are context, not sectionable systems) with a small margin, so the cut
 * always crosses some internal system. The default cut (+2.0m) sits inside
 * every fixture variant's range.
 */
export function sectionCutRangeOf(entities: readonly PresentedConstructionEntity[]): SectionCutRange {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const { geometry } of entities) {
    if (geometry.layer === 'lyr-site') continue;
    const [x] = geometry.position;
    const [bx] = geometry.bbox;
    minX = Math.min(minX, x - bx / 2);
    maxX = Math.max(maxX, x + bx / 2);
  }
  const margin = 0.2;
  return { minX: minX - margin, maxX: maxX + margin };
}

/** Snap one candidate cut position into the valid range (0.25m grid). */
export function clampSectionCut(x: number, range: SectionCutRange): number {
  const lower = Math.min(range.minX, range.maxX);
  const upper = Math.max(range.minX, range.maxX);
  const snapped = Math.round(x / SECTION_CUT_STEP) * SECTION_CUT_STEP;
  return Math.min(upper, Math.max(lower, snapped));
}

/** The section canvas (viewBox units; Z right, Y up). */
export const SECTION_VIEW = { width: 860, height: 560, pad: 26 } as const;

/** Whether one entity crosses the section cut plane (at one cut position). */
export function crossesSectionCut(geometry: ConstructionEntityGeometry, cutX: number = SECTION_CUT_X): boolean {
  const [x] = geometry.position;
  const [bx] = geometry.bbox;
  return Math.abs(x - cutX) <= bx / 2 + 0.001;
}

/** The entities crossing the section cut (at one cut position; fixture geometry order). */
export function sectionEntitiesOf(
  entities: readonly PresentedConstructionEntity[],
  cutX: number = SECTION_CUT_X,
): readonly PresentedConstructionEntity[] {
  return entities.filter((entity) => crossesSectionCut(entity.geometry, cutX));
}

/** The union bounds (Z × Y) of the section-cut entities + margin. */
function sectionBoundsOf(entities: readonly PresentedConstructionEntity[]): WorldRect {
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { geometry } of entities) {
    const [, y, z] = geometry.position;
    const [, by, bz] = geometry.bbox;
    minZ = Math.min(minZ, z - bz / 2);
    maxZ = Math.max(maxZ, z + bz / 2);
    minY = Math.min(minY, y - by / 2);
    maxY = Math.max(maxY, y + by / 2);
  }
  const margin = 1.2;
  return { minX: minZ - margin, maxX: maxZ + margin, minY: minY - margin, maxY: maxY + margin };
}

/** The section projector over one presented world (Z right, Y UP). */
export function sectionProjectorFor(
  entities: readonly PresentedConstructionEntity[],
  cutX: number = SECTION_CUT_X,
): OrthoProjector {
  return orthoProjector(
    sectionBoundsOf(sectionEntitiesOf(entities, cutX)),
    SECTION_VIEW.width,
    SECTION_VIEW.height,
    SECTION_VIEW.pad,
    true,
  );
}

/** The section rect of one entity (canvas-space; Z horizontal, Y up). */
export function sectionRectOf(
  entity: PresentedConstructionEntity,
  projector: OrthoProjector,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const [, y, z] = entity.geometry.position;
  const [, by, bz] = entity.geometry.bbox;
  const left = projector.px(z - bz / 2);
  const top = projector.py(y + by / 2);
  const bottom = projector.py(y - by / 2);
  return {
    x: left,
    y: top,
    width: Math.max(2, bz * projector.scale),
    height: Math.max(2, Math.abs(bottom - top)),
  };
}

/** Hit-test one section-canvas point (smallest cut area first). */
export function sectionEntityAt(
  entities: readonly PresentedConstructionEntity[],
  projector: OrthoProjector,
  point: { readonly x: number; readonly y: number },
  cutX: number = SECTION_CUT_X,
): PresentedConstructionEntity | null {
  const cut = [...sectionEntitiesOf(entities, cutX)].sort((a, b) => cutAreaOf(a) - cutAreaOf(b));
  for (const entity of cut) {
    const rect = sectionRectOf(entity, projector);
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return entity;
    }
  }
  return null;
}

/** The section draw order (large cut areas first). */
export function sectionDrawOrder(
  entities: readonly PresentedConstructionEntity[],
  cutX: number = SECTION_CUT_X,
): readonly PresentedConstructionEntity[] {
  return [...sectionEntitiesOf(entities, cutX)].sort((a, b) => cutAreaOf(b) - cutAreaOf(a));
}

/** The cut-plane area (m²) of one entity (draw/hit ordering). */
function cutAreaOf(entity: PresentedConstructionEntity): number {
  const [, by, bz] = entity.geometry.bbox;
  return by * bz;
}

// ---------------------------------------------------------------------------
// The agent presence presentation (fixture movement scripts).
// ---------------------------------------------------------------------------

/** The interpolated position of one agent at a virtual time (linear
 * between waypoints, clamped at both ends — the fixture's deterministic
 * movement script). */
export function agentPositionAt(agent: ConstructionAgent, atMs: number): [number, number, number] {
  const script = agent.movementScript;
  if (script.length === 0) {
    return [...agent.position] as [number, number, number];
  }
  if (atMs <= script[0].atMs) {
    return [...script[0].position] as [number, number, number];
  }
  for (let index = 1; index < script.length; index += 1) {
    const from = script[index - 1];
    const to = script[index];
    if (atMs <= to.atMs) {
      const span = to.atMs - from.atMs;
      const t = span <= 0 ? 0 : (atMs - from.atMs) / span;
      return [
        from.position[0] + (to.position[0] - from.position[0]) * t,
        from.position[1] + (to.position[1] - from.position[1]) * t,
        from.position[2] + (to.position[2] - from.position[2]) * t,
      ];
    }
  }
  const last = script[script.length - 1];
  return [...last.position] as [number, number, number];
}

/** The construction agents (fixture data; ≥2 with spatial positions). */
export const SOLUTION_AGENTS: readonly ConstructionAgent[] = AGENTS;

/** The fixture agents currently working on one entity (the inspector trail). */
export function agentsWorkingOn(entityId: string): readonly ConstructionAgent[] {
  return AGENTS.filter((agent) => agent.currentWorkEntityId === entityId);
}

// ---------------------------------------------------------------------------
// The BOQ / cost surface (fixture rollups + cross-highlight identity).
// ---------------------------------------------------------------------------

/** The per-layer BOQ rollups (fixture data — the frozen Current baseline). */
export const BOQ_ROLLUPS: readonly ConstructionBoqLayerRollup[] = BOQ_LAYER_ROLLUPS;

/** The BOQ grand total (fixture data). */
export const BOQ_TOTAL = BOQ_GRAND_TOTAL;

/** The BOQ line item identity-mapped to one entity (or null). */
export function boqLineOf(entityId: string): ConstructionBoqLineItem | null {
  return BOQ_LINE_ITEMS.find((item) => item.entityId === entityId) ?? null;
}

/**
 * The BOQ line item(s) identity-mapped to one entity (plural — the
 * cross-selection surface highlights the line(s) of a selected world
 * entity; currently 1:1 per the frozen fixture, variant-ADDED entities
 * carry none).
 */
export function boqLinesOf(entityId: string): readonly ConstructionBoqLineItem[] {
  return BOQ_LINE_ITEMS.filter((item) => item.entityId === entityId);
}

/** Format one EUR amount string compactly (e.g. "41,236.50" → "€41,236.50"). */
export function formatEur(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return amount;
  }
  return `€${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// The constraints / findings surface (fixture records + variant outcome).
// ---------------------------------------------------------------------------

/** One presented constraint/finding record. */
export interface PresentedConstraint {
  readonly record: ConstructionConstraintRecord;
  /** Whether the active variant resolves this finding (e.g. Alt A ↔ the MEP clash). */
  readonly resolvedByVariant: boolean;
  /** Whether the finding was introduced by the active variant (variant-level note). */
  readonly variantNote: boolean;
}

/**
 * The constraints/findings surface under one variant: the fixture's
 * finding records (with the variant's resolution outcome — Alternative A
 * reroutes the duct and removes the legacy conduit, eliminating the MEP
 * clash) plus the variant-level constraint notes.
 */
export function presentedConstraints(variantId: SolutionVariantId): readonly PresentedConstraint[] {
  const variant = variantOf(variantId);
  const out: PresentedConstraint[] = CONSTRAINTS.map((record) => ({
    record,
    resolvedByVariant:
      variant?.variantId === 'variant-alt-a' &&
      record.entityIds.includes('cs-mep-legacy-conduit-l2'),
    variantNote: false,
  }));
  if (variant !== null) {
    variant.constraints.forEach((note, index) => {
      out.push({
        record: {
          constraintId: `${variant.variantId}-note-${index + 1}`,
          severity: note.severity,
          category: 'compliance',
          title: `${variant.label} — variant constraint`,
          description: note.note,
          entityIds: [],
        },
        resolvedByVariant: false,
        variantNote: true,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The solution metrics (the live HUD values).
// ---------------------------------------------------------------------------

/** The solution metrics presented by the HUD under one variant + phase. */
export interface SolutionMetrics {
  readonly variantId: SolutionVariantId;
  readonly variantLabel: string;
  readonly cost: { readonly currency: string; readonly total: string };
  readonly days: number;
  readonly risk: string;
  readonly phaseLabel: string;
  readonly phaseId: string;
  readonly builtEntityCount: number;
  readonly futureEntityCount: number;
  readonly deltas: { readonly added: number; readonly changed: number; readonly removed: number };
}

/** Compute the HUD metrics of the presented world at one virtual time. */
export function solutionMetrics(
  variantId: SolutionVariantId,
  atMs: number,
): SolutionMetrics {
  const variant = variantOf(variantId);
  const phase = phaseAt(atMs);
  const entities = presentedEntities(variantId);
  let built = 0;
  for (const entity of entities) {
    if (entity.state !== 'removed' && entityBuiltAtPhase(entity.geometry, phase)) {
      built += 1;
    }
  }
  return {
    variantId,
    variantLabel: variant?.label ?? 'Current solution',
    cost: variant?.cost ?? { currency: 'EUR', total: '0.00' },
    days: variant?.days ?? 0,
    risk: variant?.risk ?? 'medium',
    phaseLabel: phase.label,
    phaseId: phase.phaseId,
    builtEntityCount: built,
    futureEntityCount: entities.length - built,
    deltas: variantDeltaSummary(variantId),
  };
}

// ---------------------------------------------------------------------------
// The layer isolation projection (which layer is isolated in the world).
// ---------------------------------------------------------------------------

/** The minimal layer visibility shape the isolation projection reads. */
export interface LayerVisibilityLike {
  readonly layerId: string;
  readonly visible: boolean;
  readonly mixed: boolean;
}

/**
 * The layer currently ISOLATED in the world (its entities all visible AND
 * every other layer fully hidden — exactly the state the runtime's typed
 * filter intent produces), or null when no isolation is active (including
 * the reveal-all state, where every layer is visible).
 */
export function isolatedLayerIdOf(layers: readonly LayerVisibilityLike[]): string | null {
  const isolated = layers.filter((layer) => layer.visible && !layer.mixed);
  if (isolated.length !== 1) return null;
  const candidate = isolated[0];
  if (candidate === undefined) return null;
  const others = layers.filter((layer) => layer.layerId !== candidate.layerId);
  if (others.length === 0) return null;
  return others.every((layer) => !layer.visible && !layer.mixed) ? candidate.layerId : null;
}

// ---------------------------------------------------------------------------
// The §9 engineering evidence trail (one selected entity, fully projected).
// ---------------------------------------------------------------------------

/** One finding of the evidence trail (the fixture record + variant outcome). */
export interface EvidenceFinding {
  readonly record: ConstructionConstraintRecord;
  readonly resolvedByVariant: boolean;
}

/** The full §9 evidence trail of one presented entity (a pure projection). */
export interface EntityEvidence {
  readonly entityId: string;
  /** The BOQ line(s) identity-mapped to the entity (empty for variant-added). */
  readonly boqLines: readonly ConstructionBoqLineItem[];
  /** The fixture finding records referencing the entity (with variant outcome). */
  readonly findings: readonly EvidenceFinding[];
  /** The fixture agents currently working on the entity. */
  readonly agents: readonly ConstructionAgent[];
  /** The owning layer record. */
  readonly layer: ConstructionLayer | null;
  /** The owning phase record. */
  readonly phase: ConstructionPhase | null;
}

/**
 * The evidence trail of one entity under one variant: every BOQ line, every
 * constraint/finding record and every agent referencing it, plus its layer
 * and phase records — the inspector's "evidence" column (ACR-012 §9),
 * projected from the SAME frozen fixture (never a second ledger). Returns
 * null when the entity is not presented under the variant.
 */
export function entityEvidenceOf(
  entityId: string,
  variantId: SolutionVariantId,
): EntityEvidence | null {
  const presented = presentedEntities(variantId).find(
    (entity) => entity.geometry.entityId === entityId,
  );
  if (presented === undefined) {
    return null;
  }
  const findings: EvidenceFinding[] = [];
  for (const record of presentedConstraints(variantId)) {
    if (record.variantNote) continue;
    if (record.record.entityIds.includes(entityId)) {
      findings.push({
        record: record.record,
        resolvedByVariant: record.resolvedByVariant,
      });
    }
  }
  return {
    entityId,
    boqLines: boqLinesOf(entityId),
    findings,
    agents: agentsWorkingOn(entityId),
    layer: layerRecordOf(presented.geometry.layer),
    phase: phaseRecordOf(presented.geometry.phase),
  };
}

// ---------------------------------------------------------------------------
// The BOQ ↔ world CROSS-SELECTION model (bidirectional, persistent).
// ---------------------------------------------------------------------------

/** The source surface of one cross-highlight. */
export type CrossHighlightSource = 'world' | 'boq' | 'constraint' | 'agent';

/**
 * One persistent cross-highlight state: selecting a BOQ line highlights
 * its entities in the world; selecting a world entity highlights its BOQ
 * line(s); a finding focuses its entities; an inspected agent highlights
 * its current-work element. The state is held by the workspace (it
 * SURVIVES view-mode changes — 3D/plan/section render the same set) and
 * persists until explicitly cleared or replaced by another cross-selection.
 */
export interface CrossHighlight {
  readonly source: CrossHighlightSource | null;
  readonly entityIds: readonly string[];
  readonly lineIds: readonly string[];
}

/** The empty cross-highlight (no cross-selection active). */
export const EMPTY_CROSS_HIGHLIGHT: CrossHighlight = { source: null, entityIds: [], lineIds: [] };

/** Whether a cross-highlight carries any live ids. */
export function crossHighlightActive(highlight: CrossHighlight): boolean {
  return highlight.entityIds.length > 0 || highlight.lineIds.length > 0;
}

/** Selecting one BOQ line item highlights ITS world entity (boq → world). */
export function crossHighlightFromBoqLine(line: ConstructionBoqLineItem): CrossHighlight {
  return { source: 'boq', entityIds: [line.entityId], lineIds: [line.lineId] };
}

/** Selecting one world entity highlights its BOQ line(s) (world → boq). */
export function crossHighlightFromEntity(entityId: string): CrossHighlight {
  return {
    source: 'world',
    entityIds: [entityId],
    lineIds: boqLinesOf(entityId).map((line) => line.lineId),
  };
}

/** Selecting one constraint finding focuses its element(s) in the world. */
export function crossHighlightFromConstraint(entityIds: readonly string[]): CrossHighlight {
  const unique = [...new Set(entityIds)];
  const lineIds = unique.flatMap((entityId) => boqLinesOf(entityId).map((line) => line.lineId));
  return { source: 'constraint', entityIds: unique, lineIds };
}

/** Inspecting one agent highlights its current-work element (agent → world).
 * The entity-derived BOQ line ids are kept — the current-work element is
 * what the world highlights — but the source is labelled 'agent' so the
 * HUD presents the cause. */
export function crossHighlightFromAgent(agent: ConstructionAgent): CrossHighlight {
  return { ...crossHighlightFromEntity(agent.currentWorkEntityId), source: 'agent' };
}

/**
 * The world-viewport highlight set: the cross-highlight entities plus the
 * inspected agent's current-work element (the agent presence hook).
 */
export function highlightEntityIdsOf(
  highlight: CrossHighlight,
  activeAgent: ConstructionAgent | null,
): readonly string[] {
  const ids = new Set(highlight.entityIds);
  if (activeAgent !== null) {
    ids.add(activeAgent.currentWorkEntityId);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// The view-mode vocabulary (3D / plan / section — presentation only).
// ---------------------------------------------------------------------------

/** The world view modes (ACR-012 §5: 3D orbit, true top-down plan, section cutaway). */
export type SolutionViewMode = '3d' | 'plan' | 'section';

/** The canonical variant ids in selector order. */
export const SOLUTION_VARIANT_IDS_ORDERED: readonly SolutionVariantId[] = SOLUTION_VARIANT_IDS;

/**
 * The fixture's DECLARED programme-simulation control — the typed simulate
 * entry point of the branch/simulation concept the variant comparison
 * rides on (ACR-012 §8: selecting a variant is a proposed branch; the
 * programme simulation is the same fixture-declared control surface). A
 * pure projection of the frozen scene control record: no new semantics,
 * no second control authority — the workspace surfaces exactly the
 * control the fixture declares.
 */
export const SOLUTION_SIMULATE_CONTROL: {
  readonly controlId: string;
  readonly label: string;
  readonly intentId: string;
} = (() => {
  const control = FIXTURE.sceneContent.controls.find(
    (candidate) => candidate.controlId === CONTROL_IDS.simulate,
  );
  if (control === undefined) {
    throw new Error(
      'construction fixture: the declared simulate control is missing (frozen contract violation)',
    );
  }
  return {
    controlId: control.controlId,
    label: control.label ?? control.controlId,
    intentId: control.intent.id,
  };
})();

// The fixture's own types the host surfaces render (re-exported so the
// components import the projection vocabulary from one module).
export type {
  ConstructionAgent,
  ConstructionBoqLayerRollup,
  ConstructionBoqLineItem,
  ConstructionConstraintRecord,
  ConstructionEntityGeometry,
  ConstructionEntityProjection,
  ConstructionLayer,
  ConstructionPhase,
  ConstructionSolutionVariant,
  SolutionVariantDelta,
  SolutionVariantId,
} from '@epoch/construction-world-fixture';
