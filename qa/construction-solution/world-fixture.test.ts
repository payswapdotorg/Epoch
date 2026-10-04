// W071 — the construction-solution fixture ACCEPTANCE battery (ACR-012).
//
// "The fixture battery is green and proves: every ACR-012 §4 system
// present; six layers; timeline scrubbing changes presented state;
// variants differ in world deltas + cost/days/risk; BOQ rollups match
// entity quantities; findings reference real entity IDs; digest
// stability across two compositions." (W071 acceptance).
//
// "No-go surfaces untouched (the TL's 7-gate review enforces)." — the
// battery ONLY imports the @epoch/construction-world-fixture public API
// (the frozen contract surface) and the experience-layer product roots
// through the REAL kernels (the W057 cold-checkout doctrine). Every
// assertion is over the FROZEN public contract.
import { describe, expect, it } from 'vitest';
import {
  createConstructionSolutionFixture,
  FIXTURE,
  SCENE,
  ENTITY_COUNT,
  LAYER_IDS,
  PHASES,
  BRANCH_PHASE,
  VARIANTS,
  BOQ_LAYER_ROLLUPS,
  BOQ_LINE_ITEMS,
  BOQ_GRAND_TOTAL,
  CONSTRAINTS,
  MEP_CLASH_FINDING,
  ENTITY_IDS,
  ENTITY_GEOMETRY,
  ENTITY_PROJECTIONS,
  AGENTS,
  buildHeadlessWorldFabric,
  RENDERER_PREFERENCE,
  REFERENCE_RENDERER_ID,
  THREE_RENDERER_ID,
  BABYLONJS_RENDERER_ID,
  CONSTRUCTION_WORLD_FIXTURE_VERSION,
  TENANT,
  SCENE_ID,
  FIXTURE_DIGEST,
} from '../../packages/construction-world-fixture/src/index';

describe('W071 — the construction-solution fixture (ACR-012 acceptance)', () => {
  it('exposes the frozen public API surface (the FROZEN contract W072/W073 compile against)', () => {
    // Frozen version constants.
    expect(CONSTRUCTION_WORLD_FIXTURE_VERSION).toBe('1.0.0');
    expect(TENANT).toBe('tenant-epoch-construction');
    expect(SCENE_ID).toBe('wsc-construction-solution-pioneer-block-a');
    // The frozen fixture instance matches the factory.
    expect(FIXTURE.version).toBe(CONSTRUCTION_WORLD_FIXTURE_VERSION);
    expect(FIXTURE.fixtureDigest).toBe(FIXTURE_DIGEST);
    expect(FIXTURE.tenant).toBe(TENANT);
    expect(FIXTURE.sceneId).toBe(SCENE_ID);
    // The renderer preference chain is the W061 pattern (Three.js -> Babylon.js -> reference).
    expect(RENDERER_PREFERENCE).toEqual([THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID]);
    expect(FIXTURE.rendererPreference).toEqual(RENDERER_PREFERENCE);
    expect(FIXTURE.referenceRendererId).toBe(REFERENCE_RENDERER_ID);
  });

  // ACR-012 §4 — every construction system is present.
  it('exposes every ACR-012 §4 construction system (SITE/FOUNDATION/STRUCTURE/ENVELOPE/MEP/FINISHES)', () => {
    const types = new Set(ENTITY_PROJECTIONS.map((p) => p.entityType));
    // SITE: boundary, access, staging, excavation.
    expect(types.has('site:boundary')).toBe(true);
    expect(types.has('site:access')).toBe(true);
    expect(types.has('site:staging')).toBe(true);
    expect(types.has('site:excavation')).toBe(true);
    // FOUNDATION: strip foundation, foundation bases, ground slab.
    expect(types.has('foundation:strip')).toBe(true);
    expect(types.has('foundation:base')).toBe(true);
    expect(types.has('foundation:slab')).toBe(true);
    // STRUCTURE: columns, beams, roof structure (>=4 cols, >=2 beams).
    expect(types.has('structure:column')).toBe(true);
    expect(types.has('structure:beam')).toBe(true);
    expect(types.has('structure:roof')).toBe(true);
    const columns = ENTITY_PROJECTIONS.filter((p) => p.entityType === 'structure:column');
    expect(columns.length).toBeGreaterThanOrEqual(4);
    const beams = ENTITY_PROJECTIONS.filter((p) => p.entityType === 'structure:beam');
    expect(beams.length).toBeGreaterThanOrEqual(2);
    // ENVELOPE: walls, doors, windows, roof (>=1 door + >=2 windows).
    expect(types.has('envelope:wall')).toBe(true);
    expect(types.has('envelope:door')).toBe(true);
    expect(types.has('envelope:window')).toBe(true);
    expect(types.has('envelope:roof')).toBe(true);
    const doors = ENTITY_PROJECTIONS.filter((p) => p.entityType === 'envelope:door');
    expect(doors.length).toBeGreaterThanOrEqual(1);
    const windows = ENTITY_PROJECTIONS.filter((p) => p.entityType === 'envelope:window');
    expect(windows.length).toBeGreaterThanOrEqual(2);
    // MEP: electrical, lighting, plumbing, HVAC, drainage (>=1 element per subsystem).
    expect(types.has('mep:panel')).toBe(true);
    expect(types.has('mep:riser')).toBe(true);
    expect(types.has('mep:duct')).toBe(true);
    expect(types.has('mep:unit')).toBe(true);
    expect(types.has('mep:pipe')).toBe(true);
    // FINISHES: ceiling, floor, paint, fixtures.
    expect(types.has('finishes:ceiling')).toBe(true);
    expect(types.has('finishes:floor')).toBe(true);
    expect(types.has('finishes:paint')).toBe(true);
    expect(types.has('finishes:fixture')).toBe(true);
  });

  // ACR-012 §4 — every entity carries the §4 fields.
  it('every visible component carries the ACR-012 §4 fields (entityId, entityType, label, material+grade, dimensions, quantity+unit, phase, status, cost reference, constraints)', () => {
    expect(ENTITY_PROJECTIONS.length).toBe(ENTITY_COUNT);
    for (const projection of ENTITY_PROJECTIONS) {
      expect(projection.entityId).toMatch(/^[a-z0-9][a-z0-9-]*$/i);
      expect(projection.entityType).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/);
      expect(projection.label.length).toBeGreaterThan(0);
      expect(projection.material.name.length).toBeGreaterThan(0);
      expect(projection.material.grade.length).toBeGreaterThan(0);
      expect(projection.dimensions).toBeDefined();
      expect(projection.quantity.value.length).toBeGreaterThan(0);
      expect(projection.quantity.unit.length).toBeGreaterThan(0);
      expect(projection.phase).toMatch(/^phase-/);
      expect(['pending', 'in-progress', 'complete', 'blocked']).toContain(projection.status);
      expect(projection.cost.lineId).toMatch(/^line:[a-z0-9][a-z0-9-]*$/);
      expect(projection.cost.currency).toMatch(/^[A-Z]{3}$/);
      expect(projection.constraints.length).toBeGreaterThan(0);
    }
  });

  // ACR-012 §3 — the six canonical construction layers.
  it('exposes the six canonical construction layers (site/foundation/structure/envelope/mep/finishes)', () => {
    expect(LAYER_IDS).toEqual([
      'lyr-site',
      'lyr-foundation',
      'lyr-structure',
      'lyr-envelope',
      'lyr-mep',
      'lyr-finishes',
    ]);
    expect(FIXTURE.layers).toHaveLength(6);
    // Every layer carries at least one entity.
    for (const layer of FIXTURE.layers) {
      expect(layer.entityIds.length).toBeGreaterThan(0);
    }
    // Every entity appears in exactly one layer.
    const allLayerEntityIds = FIXTURE.layers.flatMap((l) => l.entityIds);
    expect(allLayerEntityIds.length).toBe(ENTITY_COUNT);
    expect(new Set(allLayerEntityIds).size).toBe(ENTITY_COUNT);
  });

  // ACR-012 §4 — renderer-neutral geometry/projection data per entity.
  it('carries renderer-neutral geometry/projection data per entity (position/bbox/rotation/primitive/layer/phase)', () => {
    expect(ENTITY_GEOMETRY.length).toBe(ENTITY_COUNT);
    for (const geometry of ENTITY_GEOMETRY) {
      expect(geometry.position).toBeDefined();
      expect(geometry.bbox).toBeDefined();
      expect(geometry.rotation).toBeDefined();
      expect(['box', 'cylinder', 'plane']).toContain(geometry.primitive);
      expect(LAYER_IDS).toContain(geometry.layer);
      expect(geometry.phase).toMatch(/^phase-/);
    }
  });

  // ACR-012 §7 — the construction phase timeline (reuses W016 marker vocabulary).
  it('expresses the construction phase timeline (site->excavation->foundation->structure->walls->roof->mep->finishes) through the EXISTING W016 marker vocabulary', () => {
    expect(PHASES.length).toBe(8);
    const phaseIds = PHASES.map((p) => p.phaseId);
    expect(phaseIds).toEqual([
      'phase-site',
      'phase-excavation',
      'phase-foundation',
      'phase-structure',
      'phase-walls',
      'phase-roof',
      'phase-mep',
      'phase-finishes',
    ]);
    // Every phase has a marker id + an atMs (uniform four-digit values for
    // the W016 lexicographic ordering safety).
    for (const phase of PHASES) {
      expect(phase.markerId).toMatch(/^mrk-cs-/);
      expect(phase.atMs).toBeGreaterThanOrEqual(0);
      expect(phase.atMs).toBeLessThanOrEqual(14_000);
    }
    // The timeline markers in the scene content reuse the existing W016
    // marker kinds (event / phase-end / branch-point).
    const markerKinds = new Set(SCENE.timeline!.markers.map((m) => m.markerKind));
    expect(markerKinds.has('event')).toBe(true);
    expect(markerKinds.has('phase-end')).toBe(true);
    expect(markerKinds.has('branch-point')).toBe(true);
    // The branch-point phase is at the walls phase (where variants fork).
    expect(BRANCH_PHASE.phaseId).toBe('phase-walls');
    expect(BRANCH_PHASE.markerId).toBe('mrk-cs-branch-solution');
  });

  // ACR-012 §6 — ≥2 spatial agents with tasks + current-work entity refs + movement scripts.
  it('carries >=2 spatial agents with positions, tasks, current-work entity refs, and movement scripts', () => {
    expect(AGENTS.length).toBeGreaterThanOrEqual(2);
    for (const agent of AGENTS) {
      expect(agent.agentId).toMatch(/^agent:cs-/);
      expect(agent.label.length).toBeGreaterThan(0);
      expect(agent.role.length).toBeGreaterThan(0);
      expect(agent.position).toBeDefined();
      expect(agent.currentWorkEntityId).toBeDefined();
      expect(ENTITY_PROJECTIONS.some((p) => p.entityId === agent.currentWorkEntityId)).toBe(true);
      expect(agent.task.length).toBeGreaterThan(0);
      expect(agent.movementScript.length).toBeGreaterThanOrEqual(2);
      // The movement script waypoints are deterministic (sorted by atMs).
      const times = agent.movementScript.map((w) => w.atMs);
      const sorted = [...times].sort((a, b) => a - b);
      expect(times).toEqual(sorted);
    }
    // The agents are surfaced in the W016 scene content (agent presence).
    expect(SCENE.agents.length).toBe(AGENTS.length);
  });

  // ACR-012 §8 — three solution variants (Current/Alt A/Alt B) with world deltas + cost/days/risk.
  it('exposes THREE solution variants (Current/Alt A/Alt B) differing in world deltas + cost/days/risk', () => {
    expect(VARIANTS.length).toBe(3);
    const ids = VARIANTS.map((v) => v.variantId);
    expect(ids).toEqual(['variant-current', 'variant-alt-a', 'variant-alt-b']);
    // The Current baseline has no deltas (the baseline).
    const current = VARIANTS.find((v) => v.variantId === 'variant-current')!;
    expect(current.deltas.length).toBe(0);
    // Alt A + Alt B each carry at least one delta.
    const altA = VARIANTS.find((v) => v.variantId === 'variant-alt-a')!;
    const altB = VARIANTS.find((v) => v.variantId === 'variant-alt-b')!;
    expect(altA.deltas.length).toBeGreaterThan(0);
    expect(altB.deltas.length).toBeGreaterThan(0);
    // The variants differ in cost/days/risk.
    expect(altA.cost.total).not.toBe(current.cost.total);
    expect(altB.cost.total).not.toBe(current.cost.total);
    expect(altA.days).not.toBe(current.days);
    expect(altB.days).not.toBe(current.days);
    // Variant deltas reference real entities (Current baseline entities
    // are real; Alt A adds a `removed` delta; Alt B adds an `added`
    // entity id that doesn't exist in the baseline — the QA accepts this
    // as a variant-added entity).
    for (const delta of altA.deltas) {
      if (delta.kind !== 'added') {
        expect(ENTITY_PROJECTIONS.some((p) => p.entityId === delta.entityId)).toBe(true);
      }
    }
    for (const delta of altB.deltas) {
      if (delta.kind !== 'added') {
        expect(ENTITY_PROJECTIONS.some((p) => p.entityId === delta.entityId)).toBe(true);
      }
    }
  });

  // ACR-012 §8 — per-layer BOQ rollups + line items match entity quantities + cost.
  it('exposes per-layer BOQ rollups + line items that match entity quantities + cost 1:1', () => {
    expect(BOQ_LAYER_ROLLUPS.length).toBe(6);
    expect(BOQ_LINE_ITEMS.length).toBe(ENTITY_COUNT);
    // Every BOQ line item references a real entity + canonical plan-line id.
    for (const item of BOQ_LINE_ITEMS) {
      expect(item.lineId).toMatch(/^line:cs-/);
      const projection = ENTITY_PROJECTIONS.find((p) => p.entityId === item.entityId);
      expect(projection).toBeDefined();
      expect(item.quantity).toBe(projection!.quantity.value);
      expect(item.unit).toBe(projection!.quantity.unit);
      expect(item.amount.amount).toBe(projection!.cost.amount);
      expect(item.amount.currency).toBe(projection!.cost.currency);
    }
    // The grand total is the exact fold of the line items.
    const expected = BOQ_LINE_ITEMS.reduce((acc, item) => acc + Number(item.amount.amount), 0);
    expect(Number(BOQ_GRAND_TOTAL.amount)).toBeCloseTo(expected, 2);
    expect(BOQ_GRAND_TOTAL.currency).toBe('EUR');
    // Each layer rollup's subtotal matches its line items fold.
    for (const rollup of BOQ_LAYER_ROLLUPS) {
      const layerExpected = rollup.lineItems.reduce((acc, item) => acc + Number(item.amount.amount), 0);
      expect(Number(rollup.subtotal.amount)).toBeCloseTo(layerExpected, 2);
      expect(rollup.subtotal.currency).toBe('EUR');
    }
  });

  // ACR-012 §8 — ≥5 constraint/finding records (✓ and ⚠ incl. one MEP clash) with entity refs.
  it('exposes >=5 constraint/finding records (OK and WARN incl. one MEP clash) referencing real entity IDs', () => {
    expect(CONSTRAINTS.length).toBeGreaterThanOrEqual(5);
    const severities = new Set(CONSTRAINTS.map((c) => c.severity));
    expect(severities.has('ok')).toBe(true);
    expect(severities.has('warn')).toBe(true);
    // The MEP clash finding exists + is WARN severity.
    expect(MEP_CLASH_FINDING).toBeDefined();
    expect(MEP_CLASH_FINDING.severity).toBe('warn');
    expect(MEP_CLASH_FINDING.category).toBe('clash');
    // Every finding references real entities.
    for (const constraint of CONSTRAINTS) {
      expect(constraint.entityIds.length).toBeGreaterThan(0);
      for (const entityId of constraint.entityIds) {
        expect(ENTITY_PROJECTIONS.some((p) => p.entityId === entityId)).toBe(true);
      }
    }
    // The MEP clash finding references the HVAC duct + the legacy conduit.
    expect(MEP_CLASH_FINDING.entityIds).toContain(ENTITY_IDS.hvacDuct);
    expect(MEP_CLASH_FINDING.entityIds).toContain(ENTITY_IDS.legacyConduit);
  });

  // ACR-012 §1 — the hidden clash risk (the legacy conduit is invisible by default).
  it('hides the legacy conduit clash risk by default (visible=false) — the spatial-world acceptance', () => {
    const legacyConduit = ENTITY_GEOMETRY.find((g) => g.entityId === ENTITY_IDS.legacyConduit);
    expect(legacyConduit).toBeDefined();
    expect(legacyConduit!.visibleByDefault).toBe(false);
    // The scene entity is also invisible by default.
    const sceneEntity = SCENE.entities!.find((e) => e.entityId === ENTITY_IDS.legacyConduit);
    expect(sceneEntity).toBeDefined();
    expect(sceneEntity!.visible).toBe(false);
  });

  // ACR-012 §9 — the deterministic factory + digest stability across two compositions.
  it('is deterministic: same inputs -> same fixture -> identical digests across two compositions', () => {
    const a = createConstructionSolutionFixture();
    const b = createConstructionSolutionFixture();
    expect(a.fixtureDigest).toBe(b.fixtureDigest);
    expect(a.fixtureDigest).toBe(FIXTURE_DIGEST);
    // The scene digest (the REAL sealing digest) is stable across two
    // admissions — the canonical-JSON SHA-256 of the scene content.
    expect(a.scene.digest).toBe(b.scene.digest);
    expect(a.scene.digest).toMatch(/^[0-9a-f]{64}$/);
    // Every entity's content digest is stable.
    for (let i = 0; i < a.entityGeometry.length; i += 1) {
      expect(a.entityGeometry[i]).toEqual(b.entityGeometry[i]);
    }
  });

  // ACR-012 §1 — the composed scene is admitted + sealed through the REAL W016 admission.
  it('admits + seals the construction-solution scene through the REAL W016 admission (never a parallel store)', () => {
    expect(SCENE.schema).toBe('epoch.world-scene');
    expect(SCENE.sceneId).toBe(SCENE_ID);
    expect(SCENE.tenantScope!.tenantId).toBe(TENANT);
    expect(SCENE.digest).toMatch(/^[0-9a-f]{64}$/);
    // Every entity in the scene carries a 64-hex content digest + an
    // ontology representation record id (the W016 representation-3d
    // vocabulary — re-used, never re-invented).
    for (const entity of SCENE.entities!) {
      expect(entity.contentDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(entity.representationRecordId).toMatch(/^ont-cs-rep-/);
    }
    // The scene carries the timeline markers + the agents + the controls.
    expect(SCENE.timeline!.markers.length).toBeGreaterThanOrEqual(8);
    expect(SCENE.agents!.length).toBe(2);
    expect(SCENE.controls!.length).toBe(3);
  });

  // ACR-012 §1 — the renderer registrations follow the W061 pattern
  // (Three.js + Babylon.js + reference fallback via the real RendererFabric).
  it('builds the headless world fabric through the REAL RendererFabric (the W061 pattern — Three.js + Babylon.js + reference fallback)', () => {
    const { fabric, three, babylon } = buildHeadlessWorldFabric();
    // The fabric is the REAL RendererFabric — the same seam the W058/W059
    // conformance batteries prove. The fabric instance is non-null and
    // carries the adapter registry (the W061 pattern).
    expect(fabric).toBeDefined();
    expect(typeof fabric.adapters.register).toBe('function');
    expect(three).toBeDefined();
    expect(babylon).toBeDefined();
    // The renderer preference chain is the W061 pattern.
    expect(FIXTURE.rendererPreference).toEqual([THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID]);
  });

  // ACR-012 §8 — the BOQ grand total is within the budget envelope
  // (the OK finding W071-finding-001 evidence).
  it('keeps the BOQ grand total within the EUR 50,000 approved budget envelope (the OK finding W071-finding-001 evidence)', () => {
    expect(Number(BOQ_GRAND_TOTAL.amount)).toBeLessThan(50_000);
    const budgetFinding = CONSTRAINTS.find((c) => c.constraintId === 'W071-finding-001')!;
    expect(budgetFinding).toBeDefined();
    expect(budgetFinding.severity).toBe('ok');
    expect(budgetFinding.category).toBe('budget');
  });
});
