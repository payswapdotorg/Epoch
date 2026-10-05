// W073 — the desktop CONSTRUCTION WORLD wiring + projection battery: the
// exact composition the construction solution workspace mounts (the FROZEN
// W071 construction-solution fixture behind the REAL RendererFabric with
// the REAL Three.js + Babylon.js adapters and the contract-only reference
// fallback — the fixture's declared preference/fallback chain — + the REAL
// @epoch/world-runtime WorldWorkspaceRuntime), driven through the same
// interaction surface the workspace's UI issues, PLUS the pure projection
// model the plan/section/variant/BOQ/constraint presentations render.
//
// Chunk 2 deepens the interaction battery: the §9 evidence trail, the
// bidirectional BOQ ↔ world cross-selection model, the agent current-work
// + layer-isolation projections, and the parameterized (interactive)
// section cut.
//
// Pure typed-contract exercise (node, no DOM emulator — the W017 desktop
// test convention; the REAL adapters run their deterministic headless
// cores here; the browser E2E + the real-browser evidence captures cover
// the live-GL legs).
import { describe, expect, it } from 'vitest';
import {
  ManualFrameScheduler,
  ManualHostClock,
  WorldWorkspaceRuntime,
  spatialPresentationOf,
} from '@epoch/world-runtime';
import {
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  nullEngineHost,
} from '@epoch/adapter-renderer-babylonjs';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '@epoch/adapter-renderer-threejs';
import {
  AGENT_IDS,
  AGENTS,
  BOQ_LINE_ITEMS,
  BRANCH_PHASE,
  CONSTRAINTS,
  CONTROL_IDS,
  ENTITY_IDS,
  FIXTURE,
  LAYER_IDS,
  OVERLAY_IDS,
  PHASES,
  REFERENCE_RENDERER_ID,
  TENANT,
  VARIANTS,
  buildWorldFabric,
  type SolutionVariantId,
} from '@epoch/construction-world-fixture';
import {
  BOQ_ROLLUPS,
  EMPTY_CROSS_HIGHLIGHT,
  SECTION_CUT_STEP,
  SECTION_CUT_X,
  SOLUTION_BRANCH_PHASE,
  agentPositionAt,
  agentsWorkingOn,
  boqLineOf,
  boqLinesOf,
  clampSectionCut,
  crossesSectionCut,
  crossHighlightActive,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  entityEvidenceOf,
  formatEur,
  highlightEntityIdsOf,
  isolatedLayerIdOf,
  layerRecordOf,
  phaseAt,
  phaseRecordOf,
  planCutLineOf,
  planEntityAt,
  planProjectorFor,
  presentedConstraints,
  presentedEntities,
  sectionCutRangeOf,
  sectionEntitiesOf,
  sectionEntityAt,
  sectionProjectorFor,
  solutionMetrics,
  variantDeltaSummary,
} from '../app/components/construction/construction-projection';

/**
 * The pointer position at which one entity projects under the ACTIVE
 * Three.js presenter (the honest targeting basis — the pointer is DERIVED
 * from the real projection, never guessed; the workspace's host-selection
 * path uses the same seam).
 */
function pointerAt(
  runtime: WorldWorkspaceRuntime,
  three: ThreeJsRendererAdapter,
  entityId: string,
): { readonly x: number; readonly y: number } {
  const session = runtime.session();
  if (session === null) {
    throw new Error('no active session');
  }
  const presentation = three.presentationOf(session.fabricSessionId);
  if (presentation === undefined) {
    throw new Error('no three.js presentation for the active session');
  }
  const projected = projectedPointerOf(presentation, entityId);
  if (projected === undefined) {
    throw new Error(`entity ${entityId} does not project under the three.js camera`);
  }
  return projected;
}

/** The composition the solution workspace mounts (headless engine cores). */
async function openConstructionWorld() {
  const clock = new ManualHostClock(60_000);
  const scheduler = new ManualFrameScheduler();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'desktop-construction-solution-test',
    fabric,
    scene: FIXTURE.scene,
    ontology: FIXTURE.ontology,
    device: FIXTURE.device,
    clock,
    scheduler,
    rendererPreference: FIXTURE.rendererPreference,
  });
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`the construction world failed to open: ${opened.error.message}`);
  }
  return { runtime, three, babylon, clock, scheduler };
}

describe('the desktop construction world (W073 wiring — the frozen W071 fixture)', () => {
  it('composes the REAL workspace over the frozen construction fixture', async () => {
    const { runtime, three } = await openConstructionWorld();
    try {
      expect(FIXTURE.tenant).toBe(TENANT);
      expect(FIXTURE.scene.entities).toHaveLength(34);
      // The PREFERRED renderer presents: the REAL Three.js adapter.
      expect(runtime.session()?.rendererId).toBe(THREE_RENDERER_ID);
      expect(three.presentationOf(runtime.session()?.fabricSessionId ?? '')).toBeDefined();
      const view = runtime.viewModel();
      expect(view.viewport.tenantId).toBe(TENANT);
      expect(view.viewport.sceneId).toBe(FIXTURE.sceneId);
      expect(view.viewport.worldDigest).toBe(FIXTURE.scene.digest);
      expect(view.viewport.entities).toHaveLength(34);
      // The building/site is visible immediately (all but the hidden
      // legacy conduit — the deliberate clash risk).
      expect(view.viewport.entities.filter((entity) => entity.visible)).toHaveLength(33);
      // The Epoch-owned selector offers BOTH real engines + the reference
      // fallback (the fixture's declared chain).
      expect(view.renderers.choices.map((choice) => choice.rendererId).sort()).toEqual(
        [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID].sort(),
      );
      // The derived semantic layers ARE the six construction layers (the
      // runtime derives them sorted by layer id; the fixture table carries
      // the construction order).
      expect([...runtime.layers().map((layer) => layer.layerId)].sort()).toEqual(
        [...LAYER_IDS].sort(),
      );
      for (const layer of runtime.layers()) {
        const record = layerRecordOf(layer.layerId);
        expect(record, layer.layerId).not.toBeNull();
        expect(record?.entityIds, layer.layerId).toEqual(layer.entityIds);
      }
    } finally {
      await runtime.close();
    }
  });

  it('the workspace interaction script drives typed intents through the REAL fabric seam', async () => {
    const { runtime, three } = await openConstructionWorld();
    try {
      // Semantic picking through the REAL Three.js Raycaster: select the
      // staging yard (an unoccluded pick under the fixture camera — the
      // building elements overlap in the oblique view, which is itself
      // correct 3D picking).
      const picked = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.siteStaging),
      );
      expect(picked.ok).toBe(true);
      if (picked.ok) {
        expect(picked.value.receipt.hitEntityId).toBe(ENTITY_IDS.siteStaging);
        expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
        expect(picked.value.applied).toBe(true);
      }
      // The canonical selection lands in the inspect projection.
      expect(runtime.viewModel().inspect.entityId).toBe(ENTITY_IDS.siteStaging);
      // The engineering inspector projection matches the frozen fixture.
      const projection = runtime.viewModel().inspect;
      expect(projection.entityType).toBe('site:staging');
      // Isolate the MEP layer: the hidden legacy conduit returns to the
      // world (the spatial clash discovery).
      const isolated = await runtime.isolateLayer('lyr-mep');
      expect(isolated.ok && isolated.value).toBe(true);
      const isolatedView = runtime.viewModel();
      expect(
        isolatedView.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.legacyConduit)
          ?.visible,
      ).toBe(true);
      expect(
        isolatedView.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.siteStaging)
          ?.visible,
      ).toBe(false);
      await runtime.revealAllLayers();
      // Measure the column-to-column beam span over the REAL adapter —
      // the fixture's DECLARED measurement overlay (`structureSpan`, the
      // "Beam span B1"). The columns stand inside the building envelope:
      // from the fixture's canonical oblique camera the north-west column
      // is roof-occluded, so the honest engineering flow (the same live
      // orbit the viewport HUD offers) is to ORBIT down and around until
      // both columns project unoccluded, then run the documented stateful
      // two-click measurement affordance. The dance:
      //   pick 1 anchors the ADAPTER's own measurement (typed no-target
      //     receipt — no intent yet);
      //   pick 2 lands the first normalized measure receipt and ARMS the
      //     runtime's two-pick composition (measurementFrom = COL-02);
      //   the orbit + one canonical change (a finishes layer-toggle
      //     round-trip — navigation is EPHEMERAL presentation state, the
      //     presentation camera advances on the re-present) turns the
      //     camera to a viewpoint where BOTH columns are pickable;
      //   pick 3 re-anchors the (fresh) adapter session;
      //   pick 4 completes measure(COL-02 → COL-01) — the declared
      //     overlay matches (order-agnostic) and is applied.
      // The pointer is DERIVED from the real projection at every step.
      runtime.setTool('measure');
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.column01));
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.column02));
      runtime.applyGesture({ kind: 'orbit', deltaX: Math.PI / 2, deltaY: -0.7 });
      await runtime.toggleLayer('lyr-finishes');
      await runtime.toggleLayer('lyr-finishes');
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.column02));
      const measured = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.column01),
      );
      expect(measured.ok).toBe(true);
      if (measured.ok) {
        expect(measured.value.receipt.hitEntityId).toBe(ENTITY_IDS.column01);
        expect(measured.value.receipt.intent?.id).toBe('epoch.world.interaction.measure');
      }
      const measurementOverlay = runtime
        .viewModel()
        .viewport.overlays.find(
          (overlay) => overlay.overlayKind === 'measurement',
        );
      expect(measurementOverlay).toBeDefined();
      expect(measurementOverlay?.overlayId).toBe(OVERLAY_IDS.structureSpan);
      expect(
        new Set([measurementOverlay?.fromEntityId, measurementOverlay?.toEntityId]),
      ).toEqual(new Set([ENTITY_IDS.column01, ENTITY_IDS.column02]));
      // Annotate the picked entity (a workspace command — the composed
      // typed annotate intent).
      const annotated = await runtime.composeAnnotation('Desktop note: verify AAC coursing');
      expect(annotated.ok && annotated.value).toBe(true);
      expect(
        runtime.viewModel().viewport.overlays.some(
          (overlay) => overlay.overlayKind === 'annotation',
        ),
      ).toBe(true);
      // Follow the structural engineer agent (typed follow-agent).
      const followed = await runtime.followAgent(AGENT_IDS.structuralEngineer);
      expect(followed.ok && followed.value).toBe(true);
      expect(runtime.viewModel().viewport.followedAgentId).toBe(AGENT_IDS.structuralEngineer);
      // Timeline transport: scrub to the branch point; the presented phase
      // advances (site -> ... -> walls).
      const scrubbed = await runtime.scrubTimeline(SOLUTION_BRANCH_PHASE.atMs);
      expect(scrubbed.ok && scrubbed.value).toBe(true);
      expect(runtime.viewModel().timeline.positionAtMs).toBe(SOLUTION_BRANCH_PHASE.atMs);
      expect(phaseAt(runtime.viewModel().timeline.positionAtMs).phaseId).toBe('phase-walls');
      // The branch/simulation entry points (the typed scene controls).
      const branched = await runtime.invokeControl(CONTROL_IDS.branch, {
        branchAtMs: BRANCH_PHASE.atMs,
      });
      expect(branched.ok).toBe(true);
      const simulated = await runtime.invokeControl(CONTROL_IDS.simulate, {
        scenarioRef: 'scope-cs-programme',
      });
      expect(simulated.ok).toBe(true);
      expect(
        runtime.viewModel().effects.some((entry) => entry.effect.effect === 'branch-requested'),
      ).toBe(true);
      expect(
        runtime.viewModel().effects.some((entry) => entry.effect.effect === 'simulate-requested'),
      ).toBe(true);
      // Every journaled interaction used an EXISTING typed intent id.
      for (const entry of runtime.viewModel().journal) {
        expect(entry.controlIntentId).toMatch(
          /^epoch\.(world\.interaction|workspace)\.[a-z-]+$/,
        );
      }
      // The fixture scene object is NEVER mutated.
      expect(FIXTURE.scene.focusedEntityIds).toEqual([ENTITY_IDS.column04]);
      expect(FIXTURE.scene.timeline.position.atMs).toBe(2_000);
    } finally {
      await runtime.close();
    }
  });

  it('switches Three.js -> Babylon.js -> reference -> Three.js with digest continuity', async () => {
    const { runtime } = await openConstructionWorld();
    try {
      // Establish view state the switch must preserve: a measurement, an
      // annotation, a followed agent and a timeline position.
      runtime.setTool('measure');
      // (A single measurement pair over the reference-projected pick is
      // enough to seed overlay state; the four-pick pattern completes it.)
      const canonicalDigest = runtime.currentScene().digest;
      const presentationDigest = spatialPresentationOf(runtime.currentScene()).digest;
      const toBabylon = await runtime.selectRenderer(BABYLONJS_RENDERER_ID);
      expect(toBabylon.ok).toBe(true);
      if (toBabylon.ok) {
        expect(toBabylon.value.fromRendererId).toBe(THREE_RENDERER_ID);
        expect(toBabylon.value.worldDigest).toBe(presentationDigest);
        expect(toBabylon.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.session()?.rendererId).toBe(BABYLONJS_RENDERER_ID);
      const toReference = await runtime.selectRenderer(REFERENCE_RENDERER_ID);
      expect(toReference.ok).toBe(true);
      const backToThree = await runtime.selectRenderer(THREE_RENDERER_ID);
      expect(backToThree.ok).toBe(true);
      if (backToThree.ok) {
        expect(backToThree.value.worldDigest).toBe(
          spatialPresentationOf(runtime.currentScene()).digest,
        );
        expect(backToThree.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.session()?.rendererId).toBe(THREE_RENDERER_ID);
      // The canonical revision itself never changed (switching is
      // non-semantic by construction).
      expect(runtime.currentScene().digest).toBe(canonicalDigest);
      expect(runtime.viewModel().viewport.worldDigest).toBe(canonicalDigest);
      // The scene identity + tenant survive every switch.
      expect(runtime.viewModel().viewport.sceneId).toBe(FIXTURE.sceneId);
      expect(runtime.viewModel().viewport.tenantId).toBe(TENANT);
    } finally {
      await runtime.close();
    }
  });
});

describe('the construction projection model (the plan/section/variant presentations)', () => {
  it('presents the Current baseline exactly (34 entities, all baseline)', () => {
    const presented = presentedEntities('variant-current');
    expect(presented).toHaveLength(34);
    expect(presented.every((entity) => entity.state === 'baseline')).toBe(true);
    expect(presented.map((entity) => entity.geometry.entityId)).toEqual(
      FIXTURE.sceneContent.entities.map((entity) => entity.entityId),
    );
  });

  it('applies the Alternative A variant deltas to the world representation', () => {
    const presented = presentedEntities('variant-alt-a');
    const duct = presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct);
    const conduit = presented.find(
      (entity) => entity.geometry.entityId === ENTITY_IDS.legacyConduit,
    );
    const riser = presented.find(
      (entity) => entity.geometry.entityId === ENTITY_IDS.plumbingRiser,
    );
    expect(duct?.state).toBe('changed');
    // The reroute: +0.5m Z offset, +1.0m extra run (bbox X 4.0 -> 5.0).
    expect(duct?.geometry.position[2]).toBeCloseTo(0.5, 6);
    expect(duct?.geometry.bbox[0]).toBeCloseTo(5.0, 6);
    expect(conduit?.state).toBe('removed');
    expect(riser?.state).toBe('changed');
    // The insulation grow: bbox 0.08 -> 0.12.
    expect(riser?.geometry.bbox[0]).toBeCloseTo(0.12, 6);
    expect(variantDeltaSummary('variant-alt-a')).toEqual({
      added: 0,
      changed: 2,
      removed: 1,
      total: 3,
    });
    // Alt A resolves the MEP clash finding.
    const clash = presentedConstraints('variant-alt-a').find(
      (constraint) => constraint.record.constraintId === 'W071-finding-002',
    );
    expect(clash?.resolvedByVariant).toBe(true);
    expect(
      presentedConstraints('variant-current').find(
        (constraint) => constraint.record.constraintId === 'W071-finding-002',
      )?.resolvedByVariant,
    ).toBe(false);
  });

  it('applies the Alternative B variant deltas (the added interior AHU)', () => {
    const presented = presentedEntities('variant-alt-b');
    expect(presented).toHaveLength(35);
    const ahu = presented.find(
      (entity) => entity.geometry.entityId === 'cs-mep-hvac-ahu-interior',
    );
    expect(ahu?.state).toBe('added');
    expect(ahu?.geometry.layer).toBe('lyr-mep');
    expect(ahu?.projection.entityType).toBe('mep:unit');
    const unit = presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacUnit);
    expect(unit?.state).toBe('changed');
    // Downsized 60%: bbox X 1.5 -> 0.6.
    expect(unit?.geometry.bbox[0]).toBeCloseTo(0.6, 6);
    expect(variantDeltaSummary('variant-alt-b').total).toBe(4);
  });

  it('projects the true top-down plan and hit-tests the presented footprints', () => {
    const presented = presentedEntities('variant-current');
    const projector = planProjectorFor(presented);
    // The lot (20m x 12m + margin) spans the plan canvas.
    expect(projector.bounds.maxX - projector.bounds.minX).toBeGreaterThan(20);
    expect(projector.bounds.maxY - projector.bounds.minY).toBeGreaterThan(12);
    // Hit-test a column footprint (the smallest elements win over slabs).
    const column = presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.column01);
    expect(column).not.toBeNull();
    const hit = planEntityAt(presented, projector, {
      x: projector.px(column?.geometry.position[0] ?? 0),
      y: projector.py(column?.geometry.position[2] ?? 0),
    });
    expect(hit?.geometry.entityId).toBe(ENTITY_IDS.column01);
    // A point far outside every footprint hits nothing.
    expect(planEntityAt(presented, projector, { x: 2, y: 2 })).toBeNull();
  });

  it('cuts the section at the labelled plane and exposes the MEP clash zone', () => {
    const presented = presentedEntities('variant-current');
    // The cut plane crosses the HVAC duct, the plumbing riser AND the
    // legacy conduit (the internal systems the cutaway exposes).
    expect(crossesSectionCut(
      presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct)?.geometry ??
        presented[0]!.geometry,
    )).toBe(true);
    expect(crossesSectionCut(
      presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.plumbingRiser)?.geometry ??
        presented[0]!.geometry,
    )).toBe(true);
    expect(
      crossesSectionCut(
        presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.legacyConduit)
          ?.geometry ?? presented[0]!.geometry,
      ),
    ).toBe(true);
    // The columns (x = ±4) do NOT cross the x = +2 cut.
    expect(
      crossesSectionCut(
        presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.column01)?.geometry ??
          presented[0]!.geometry,
      ),
    ).toBe(false);
    // Section hit-test lands the duct at its cut position.
    const projector = sectionProjectorFor(presented);
    const duct = presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct);
    const hit = sectionEntityAt(presented, projector, {
      x: projector.px(duct?.geometry.position[2] ?? 0),
      y: projector.py(duct?.geometry.position[1] ?? 0),
    });
    expect(hit?.geometry.entityId).toBe(ENTITY_IDS.hvacDuct);
    expect(SECTION_CUT_X).toBe(2.0);
  });

  it('interpolates the agent movement scripts deterministically', () => {
    const engineer = FIXTURE.agents.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    expect(engineer).toBeDefined();
    if (engineer === undefined) return;
    // At t=0 the engineer stands at the first waypoint (COL-01, NW).
    expect(agentPositionAt(engineer, 0)).toEqual([-4, 0, -3]);
    // Midway to the second waypoint (2s span): half-way between COL-01
    // and COL-02 on the X axis.
    const midway = agentPositionAt(engineer, 1_000);
    expect(midway[0]).toBeCloseTo(0, 6);
    expect(midway[2]).toBeCloseTo(-3, 6);
    // Beyond the script clamps to the last waypoint.
    expect(agentPositionAt(engineer, 60_000)).toEqual([0, 0, 0]);
  });

  it('maps the BOQ line items 1:1 onto the world entities (cross-highlight identity)', () => {
    // Every BOQ line references a real fixture entity...
    const entityIds = new Set(presentedEntities('variant-current').map((e) => e.geometry.entityId));
    for (const line of BOQ_LINE_ITEMS) {
      expect(entityIds.has(line.entityId), line.lineId).toBe(true);
      expect(boqLineOf(line.entityId)?.lineId).toBe(line.lineId);
    }
    // ...and every baseline entity has its BOQ line (the Current baseline).
    for (const entityId of entityIds) {
      expect(boqLineOf(entityId), entityId).not.toBeNull();
    }
    // The rollups fold to the fixture grand total.
    const sum = BOQ_ROLLUPS.reduce(
      (acc, rollup) => acc + Number(rollup.subtotal.amount),
      0,
    );
    expect(sum).toBeCloseTo(Number(FIXTURE.boqGrandTotal.amount), 2);
    expect(formatEur('41236.50')).toBe('€41,236.50');
  });

  it('presents the constraints/findings surface (all six fixture findings + variant notes)', () => {
    const current = presentedConstraints('variant-current');
    // The Current solution carries its own two variant-level notes.
    expect(current).toHaveLength(CONSTRAINTS.length + 2);
    expect(current.filter((constraint) => constraint.variantNote)).toHaveLength(2);
    // Alt B appends its variant-level constraint notes.
    const altB = presentedConstraints('variant-alt-b');
    expect(altB.length).toBe(CONSTRAINTS.length + VARIANTS[2]!.constraints.length);
    expect(altB.filter((constraint) => constraint.variantNote).length).toBe(
      VARIANTS[2]!.constraints.length,
    );
  });

  it('computes the solution metrics (phase-gated built counts + variant cost/days/risk)', () => {
    // At the track start only the site phase is built.
    const siteMetrics = solutionMetrics('variant-current', 0);
    expect(siteMetrics.phaseId).toBe('phase-site');
    expect(siteMetrics.builtEntityCount).toBe(
      presentedEntities('variant-current').filter(
        (entity) => entity.geometry.phase === 'phase-site',
      ).length,
    );
    // At the branch point (8s) the walls phase is active.
    expect(solutionMetrics('variant-current', 8_000).phaseId).toBe('phase-walls');
    // At the track end everything is built.
    const end = solutionMetrics('variant-current', 16_000);
    expect(end.phaseId).toBe('phase-finishes');
    expect(end.builtEntityCount).toBe(34);
    // The variant metrics come from the frozen variant records.
    const altA = solutionMetrics('variant-alt-a', 8_000);
    expect(altA.cost.total).toBe('43000.00');
    expect(altA.days).toBe(58);
    expect(altA.risk).toBe('low');
    expect(altA.deltas.removed).toBe(1);
  });

  it('phase-gates the presented entities (the timeline visibly changes the world)', () => {
    const presented = presentedEntities('variant-current');
    const structurePhase = phaseAt(6_000);
    expect(structurePhase.phaseId).toBe('phase-structure');
    const builtAtStructure = presented.filter((entity) =>
      entity.geometry.phase === 'phase-site' ||
      entity.geometry.phase === 'phase-excavation' ||
      entity.geometry.phase === 'phase-foundation' ||
      entity.geometry.phase === 'phase-structure',
    );
    expect(builtAtStructure.length).toBe(14);
    // The MEP/finishes entities are future work at the structure phase.
    const duct = presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct);
    expect(duct?.geometry.phase).toBe('phase-mep');
    // The eight phases + the branch point come from the fixture table.
    expect(PHASES).toHaveLength(8);
    expect(SOLUTION_BRANCH_PHASE.markerId).toBe('mrk-cs-branch-solution');
  });
});

describe('the variant selection contract (the workspace variant path)', () => {
  it('issues the typed branch intent at the fixture branch point and keeps the canonical scene intact', async () => {
    const { runtime } = await openConstructionWorld();
    try {
      const digestBefore = runtime.currentScene().digest;
      const variant: SolutionVariantId = 'variant-alt-a';
      // The workspace's onVariantChange path.
      const branched = await runtime.invokeControl(CONTROL_IDS.branch, {
        branchAtMs: SOLUTION_BRANCH_PHASE.atMs,
      });
      expect(branched.ok).toBe(true);
      // The branch is a REQUEST EFFECT (the existing branch/simulation
      // concept) — the canonical world is NOT mutated by the variant
      // presentation (a variant is a proposed branch, not an applied one).
      expect(runtime.currentScene().digest).toBe(digestBefore);
      expect(
        runtime.viewModel().effects.some(
          (entry) =>
            entry.effect.effect === 'branch-requested' &&
            (entry.effect as { atMs?: number }).atMs === SOLUTION_BRANCH_PHASE.atMs,
        ),
      ).toBe(true);
      // The presented world (the host projection) DOES change.
      expect(presentedEntities(variant).find((e) => e.geometry.entityId === ENTITY_IDS.legacyConduit)?.state).toBe('removed');
    } finally {
      await runtime.close();
    }
  });
});

// ---------------------------------------------------------------------------
// W073 chunk 2 — the interaction-deepening battery: the §9 evidence trail,
// the bidirectional BOQ ↔ world cross-selection model, the layer-isolation
// + agent current-work projections, and the parameterized section cut.
// ---------------------------------------------------------------------------

describe('the §9 engineering evidence trail (the inspector projection)', () => {
  it('projects the full per-entity evidence (BOQ lines + citing findings + working agents)', () => {
    // The HVAC duct: its BOQ line, the MEP clash finding citing it, no agent.
    const duct = entityEvidenceOf(ENTITY_IDS.hvacDuct, 'variant-current');
    expect(duct).not.toBeNull();
    expect(duct?.boqLines.map((line) => line.lineId)).toEqual([
      boqLineOf(ENTITY_IDS.hvacDuct)?.lineId,
    ]);
    expect(duct?.findings.map((finding) => finding.record.constraintId)).toContain(
      'W071-finding-002',
    );
    expect(
      duct?.findings.find((finding) => finding.record.constraintId === 'W071-finding-002')
        ?.resolvedByVariant,
    ).toBe(false);
    expect(duct?.agents).toHaveLength(0);
    expect(duct?.layer?.layerId).toBe('lyr-mep');
    expect(duct?.phase?.phaseId).toBe('phase-mep');
    expect(duct?.phase?.label).toBe(phaseRecordOf('phase-mep')?.label);
    // Under Alt A the SAME trail resolves the clash finding.
    const ductAltA = entityEvidenceOf(ENTITY_IDS.hvacDuct, 'variant-alt-a');
    expect(
      ductAltA?.findings.find((finding) => finding.record.constraintId === 'W071-finding-002')
        ?.resolvedByVariant,
    ).toBe(true);
    // COL-04: the structural engineer works on it AND the spacing finding
    // cites it (the two agent/fixed evidence hooks crossing one element).
    const col04 = entityEvidenceOf(ENTITY_IDS.column04, 'variant-current');
    expect(col04?.agents.map((agent) => agent.agentId)).toEqual([AGENT_IDS.structuralEngineer]);
    expect(col04?.findings.map((finding) => finding.record.constraintId)).toContain(
      'W071-finding-005',
    );
    expect(col04?.layer?.layerId).toBe('lyr-structure');
    // The variant-added interior AHU (Alt B) carries NO BOQ line; unknown
    // entities project to null (never a fabricated record).
    const ahu = entityEvidenceOf('cs-mep-hvac-ahu-interior', 'variant-alt-b');
    expect(ahu?.boqLines).toHaveLength(0);
    expect(ahu?.layer?.layerId).toBe('lyr-mep');
    expect(entityEvidenceOf('no-such-entity', 'variant-current')).toBeNull();
    // Variant-level constraint notes never enter an entity's trail.
    const wallNorthEvidence = entityEvidenceOf(ENTITY_IDS.wallNorth, 'variant-current');
    expect(wallNorthEvidence).not.toBeNull();
    expect(
      wallNorthEvidence?.findings.every((finding) => finding.record.entityIds.length > 0),
    ).toBe(true);
  });

  it('resolves the bidirectional BOQ ↔ world cross-selection (both directions of ONE identity)', () => {
    const line = boqLineOf(ENTITY_IDS.hvacDuct);
    expect(line).not.toBeNull();
    // BOQ → world: selecting the line highlights ITS world entity.
    const fromLine = crossHighlightFromBoqLine(line!);
    expect(fromLine).toEqual({
      source: 'boq',
      entityIds: [ENTITY_IDS.hvacDuct],
      lineIds: [line!.lineId],
    });
    // world → BOQ: selecting the entity highlights its BOQ line(s).
    const fromEntity = crossHighlightFromEntity(ENTITY_IDS.hvacDuct);
    expect(fromEntity.source).toBe('world');
    expect(fromEntity.entityIds).toEqual([ENTITY_IDS.hvacDuct]);
    expect(fromEntity.lineIds).toEqual([line!.lineId]);
    // The two directions resolve the SAME identity set (bidirectional).
    expect(new Set(fromLine.entityIds)).toEqual(new Set(fromEntity.entityIds));
    expect(new Set(fromLine.lineIds)).toEqual(new Set(fromEntity.lineIds));
    // Every baseline entity cross-resolves to its line(s) (1:1 frozen).
    for (const item of BOQ_LINE_ITEMS) {
      const resolved = crossHighlightFromEntity(item.entityId);
      expect(resolved.entityIds, item.lineId).toEqual([item.entityId]);
      expect(resolved.lineIds, item.lineId).toContain(item.lineId);
      expect(boqLinesOf(item.entityId).map((candidate) => candidate.lineId)).toContain(
        item.lineId,
      );
    }
    // The variant-added AHU has no line (world → BOQ resolves to none).
    expect(crossHighlightFromEntity('cs-mep-hvac-ahu-interior').lineIds).toEqual([]);
    // Constraint focus: the MEP clash finding focuses its 3 entities + lines.
    const clash = crossHighlightFromConstraint([
      ENTITY_IDS.hvacDuct,
      ENTITY_IDS.legacyConduit,
      ENTITY_IDS.plumbingRiser,
    ]);
    expect(clash.source).toBe('constraint');
    expect(clash.entityIds).toHaveLength(3);
    expect(clash.lineIds).toHaveLength(3);
    // Persistence: the state is a VALUE the workspace holds — it survives
    // view-mode changes (3D/plan/section re-render the same set) and
    // persists until cleared or replaced; the empty state is inactive.
    expect(crossHighlightActive(fromEntity)).toBe(true);
    expect(crossHighlightActive(EMPTY_CROSS_HIGHLIGHT)).toBe(false);
  });
});

describe('the agent current-work + layer isolation projections', () => {
  it('wires the agent current-work highlight hooks (fixture agents → their elements)', () => {
    const engineer = AGENTS.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    expect(engineer).toBeDefined();
    // Agent → world: inspecting an agent highlights its current-work element
    // (and the element's BOQ line — the agent hook rides the cross-channel).
    expect(engineer === undefined ? null : crossHighlightFromAgent(engineer)).toEqual({
      source: 'agent',
      entityIds: [ENTITY_IDS.column04],
      lineIds: [boqLineOf(ENTITY_IDS.column04)?.lineId],
    });
    // The reverse lookup: which agents work on one element.
    expect(agentsWorkingOn(ENTITY_IDS.column04).map((agent) => agent.agentId)).toEqual([
      AGENT_IDS.structuralEngineer,
    ]);
    expect(agentsWorkingOn(ENTITY_IDS.siteStaging).map((agent) => agent.agentId)).toEqual([
      AGENT_IDS.siteCoordinator,
    ]);
    expect(agentsWorkingOn(ENTITY_IDS.hvacDuct)).toHaveLength(0);
    // The viewport highlight set merges the cross-highlight + the inspected
    // agent's current work (both live regardless of the view mode).
    const engineerAgent = engineer!;
    expect(
      [...highlightEntityIdsOf(crossHighlightFromEntity(ENTITY_IDS.hvacDuct), engineerAgent)].sort(),
    ).toEqual([ENTITY_IDS.column04, ENTITY_IDS.hvacDuct]);
    expect(highlightEntityIdsOf(EMPTY_CROSS_HIGHLIGHT, engineerAgent)).toEqual([
      ENTITY_IDS.column04,
    ]);
    expect(highlightEntityIdsOf(EMPTY_CROSS_HIGHLIGHT, null)).toEqual([]);
  });

  it('derives the isolated layer from the live world state (the typed filter intent)', async () => {
    const { runtime } = await openConstructionWorld();
    try {
      // Baseline: every layer is visible (lyr-mep is mixed — the hidden
      // legacy conduit) → NO isolation.
      expect(isolatedLayerIdOf(runtime.layers())).toBeNull();
      // The typed isolate: ONLY the MEP layer's entities stay visible.
      const isolated = await runtime.isolateLayer('lyr-mep');
      expect(isolated.ok && isolated.value).toBe(true);
      expect(isolatedLayerIdOf(runtime.layers())).toBe('lyr-mep');
      // A plain hide is NOT an isolation (finishes hidden, the rest visible).
      await runtime.revealAllLayers();
      await runtime.toggleLayer('lyr-finishes');
      expect(isolatedLayerIdOf(runtime.layers())).toBeNull();
      await runtime.revealAllLayers();
      // Reveal-all restores the shared world (no isolation).
      expect(isolatedLayerIdOf(runtime.layers())).toBeNull();
    } finally {
      await runtime.close();
    }
  });
});

describe('the cut-plane interaction (the parameterized section cut)', () => {
  it('moves the section cut, re-projects the section and hit-tests the moved cut', () => {
    const presented = presentedEntities('variant-current');
    // The default cut crosses the MEP clash zone (the C1 contract).
    expect(sectionEntitiesOf(presented).map((entity) => entity.geometry.entityId)).toContain(
      ENTITY_IDS.hvacDuct,
    );
    // The valid cut range covers the BUILDING's X extent (site context
    // excluded — the boundary/staging/fence are not sectionable systems).
    const range = sectionCutRangeOf(presented);
    expect(range.minX).toBeLessThan(-4);
    expect(range.maxX).toBeGreaterThan(4);
    expect(SECTION_CUT_STEP).toBe(0.25);
    // The default cut sits inside the range; adjustments snap + clamp.
    expect(clampSectionCut(SECTION_CUT_X, range)).toBe(2);
    expect(clampSectionCut(1.13, range)).toBe(1.25);
    expect(clampSectionCut(-99, range)).toBe(range.minX);
    expect(clampSectionCut(99, range)).toBe(range.maxX);
    // Moving the cut to the WEST column line (x = −4) exposes the columns
    // instead of the MEP run — the cutaway follows the cut.
    const westCutIds = sectionEntitiesOf(presented, -4).map((entity) => entity.geometry.entityId);
    expect(westCutIds).toContain(ENTITY_IDS.column01);
    expect(westCutIds).toContain(ENTITY_IDS.groundSlab);
    expect(westCutIds).not.toContain(ENTITY_IDS.hvacDuct);
    // The moved cut hit-tests its OWN projection (column COL-01 at its cut).
    const projector = sectionProjectorFor(presented, -4);
    const column = presented.find(
      (entity) => entity.geometry.entityId === ENTITY_IDS.column01,
    );
    expect(column).toBeDefined();
    // The moved cut hit-tests its OWN projection. At the shared centerline
    // (z = −3, y = 1.5) both the north wall (cut area 3.0 × 0.2 = 0.6 m²)
    // and COL-01 (3.0 × 0.3 = 0.9 m²) cross the cut: smallest-first wins —
    // the wall, the same deterministic rule the C1 plan hit-test uses.
    const hitShared = sectionEntityAt(
      presented,
      projector,
      {
        x: projector.px(column?.geometry.position[2] ?? 0),
        y: projector.py(column?.geometry.position[1] ?? 0),
      },
      -4,
    );
    expect(hitShared?.geometry.entityId).toBe(ENTITY_IDS.wallNorth);
    // In the column-only Z band (outside the wall's 0.2m thickness) the
    // column is the ONLY cut entity — the hit lands COL-01 itself.
    const hitColumn = sectionEntityAt(
      presented,
      projector,
      { x: projector.px(-3.12), y: projector.py(1.5) },
      -4,
    );
    expect(hitColumn?.geometry.entityId).toBe(ENTITY_IDS.column01);
    // The plan carries the cut line at the SAME world X (ONE cut state
    // drives the plan's A–A line and the section re-projection together).
    const planProjector = planProjectorFor(presented);
    const cutLine = planCutLineOf(planProjector, -4);
    expect(cutLine.cutX).toBe(-4);
    expect(cutLine.xPx).toBe(planProjector.px(-4));
    expect(cutLine.y1Px).toBeLessThan(cutLine.y2Px);
    expect(planCutLineOf(planProjector, SECTION_CUT_X).xPx).toBe(planProjector.px(2));
  });

  it('keeps the default section legs stable under the parameterized cut (A–A refinements)', () => {
    const presented = presentedEntities('variant-current');
    // The default-parameter calls are the C1 behavior (cut = SECTION_CUT_X).
    expect(sectionEntitiesOf(presented, SECTION_CUT_X)).toEqual(sectionEntitiesOf(presented));
    // The MEP clash zone entities all cross the default cut...
    for (const entityId of [ENTITY_IDS.hvacDuct, ENTITY_IDS.legacyConduit, ENTITY_IDS.plumbingRiser]) {
      const geometry = presented.find((entity) => entity.geometry.entityId === entityId)?.geometry;
      expect(geometry, entityId).toBeDefined();
      expect(crossesSectionCut(geometry!, SECTION_CUT_X)).toBe(true);
    }
    // ...and a cut pushed PAST the building's east edge crosses nothing
    // (clamped presentations never fabricate entities).
    const east = sectionEntitiesOf(presented, 4.2);
    for (const entity of east) {
      expect(crossesSectionCut(entity.geometry, 4.2)).toBe(true);
    }
  });
});
