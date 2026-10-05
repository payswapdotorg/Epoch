// W072 — the CONSTRUCTION SOLUTION feature battery (web side): the pure
// projection model over the FROZEN W071 fixture (the same values the desktop
// battery pins — one fixture, two platforms), the typed variant-branch
// contract through the REAL runtime, and the construction chrome at
// component level (navigator / inspector / BOQ / constraints / variants /
// timeline / renderer-switch evidence) — the presentational wiring the
// browser journey (e2e/j13 + j14) drives end-to-end.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AGENTS,
  AGENT_IDS,
  BOQ_LINE_ITEMS,
  CONSTRAINTS,
  CONTROL_IDS,
  ENTITY_IDS,
  FIXTURE,
  PHASES,
  SOLUTION_VARIANT_IDS,
  TRACK,
  VARIANTS,
} from '@epoch/construction-world-fixture';
import {
  BOQ_ROLLUPS,
  EMPTY_CROSS_HIGHLIGHT,
  SECTION_CUT_STEP,
  SECTION_CUT_X,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_PHASES,
  agentsWorkingOn,
  agentPositionAt,
  boqLineOf,
  boqLinesOf,
  boqEstimate,
  clampSectionCut,
  crossHighlightActive,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  crossesSectionCut,
  entityEvidenceOf,
  formatEur,
  highlightEntityIdsOf,
  isolatedLayerIdOf,
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
} from './construction-solution';
import { ConstructionTopBar } from './components/ConstructionTopBar';
import {
  ConstructionNavigator,
  navigatorAgentsOf,
} from './components/ConstructionNavigator';
import { ConstructionViewport } from './components/ConstructionViewport';
import { ConstructionInspector } from './components/ConstructionInspector';
import { createWorkspaceHandlers } from './workspace-handlers';
import type {
  ViewportAgentInput,
  ViewportEntityInput,
  WorkspaceViewModelInput,
  WorldWorkspaceDriver,
} from './workspace-contracts';
import {
  BABYLONJS_RENDERER_ID,
  DEVICE,
  ONTOLOGY,
  REFERENCE_RENDERER_ID,
  RENDERER_PREFERENCE,
  SCENE,
  THREE_RENDERER_ID,
  buildHeadlessWorldFabric,
} from './host/world-fixture';
import {
  ManualFrameScheduler,
  ManualHostClock,
  WorldWorkspaceRuntime,
} from '@epoch/world-runtime';

// ---------------------------------------------------------------------------
// The projection model (the frozen fixture values — the desktop parity).
// ---------------------------------------------------------------------------

describe('the construction projection model (the frozen W071 fixture)', () => {
  it('presents the Current baseline exactly (34 entities, all baseline)', () => {
    const presented = presentedEntities('variant-current');
    expect(presented).toHaveLength(34);
    expect(presented.every((entity) => entity.state === 'baseline')).toBe(true);
    expect([...presented.map((entity) => entity.geometry.entityId)].sort()).toEqual(
      [...FIXTURE.sceneContent.entities.map((entity) => entity.entityId)].sort(),
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
    // Alt A resolves the MEP clash finding (and ONLY Alt A does).
    const clash = presentedConstraints('variant-alt-a').find(
      (constraint) => constraint.record.constraintId === 'W071-finding-002',
    );
    expect(clash?.resolvedByVariant).toBe(true);
    expect(
      presentedConstraints('variant-current').find(
        (constraint) => constraint.record.constraintId === 'W071-finding-002',
      )?.resolvedByVariant,
    ).toBe(false);
    expect(
      presentedConstraints('variant-alt-b').find(
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
    const column = presented.find(
      (entity) => entity.geometry.entityId === ENTITY_IDS.column01,
    );
    expect(column).toBeDefined();
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
    // hidden legacy conduit (the internal systems the cutaway exposes).
    for (const entityId of [ENTITY_IDS.hvacDuct, ENTITY_IDS.plumbingRiser, ENTITY_IDS.legacyConduit]) {
      const geometry = presented.find((entity) => entity.geometry.entityId === entityId)?.geometry;
      expect(geometry, entityId).toBeDefined();
      expect(crossesSectionCut(geometry!)).toBe(true);
    }
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

  it('parameterizes the section cut (ONE cut state; the plan carries the A-A line)', () => {
    const presented = presentedEntities('variant-current');
    const range = sectionCutRangeOf(presented);
    expect(range.minX).toBeLessThan(-4);
    expect(range.maxX).toBeGreaterThan(4);
    expect(SECTION_CUT_STEP).toBe(0.25);
    expect(clampSectionCut(SECTION_CUT_X, range)).toBe(2);
    expect(clampSectionCut(1.13, range)).toBe(1.25);
    expect(clampSectionCut(-99, range)).toBe(range.minX);
    expect(clampSectionCut(99, range)).toBe(range.maxX);
    // Moving the cut to the WEST column line (x = -4) exposes the columns
    // instead of the MEP run — the cutaway follows the cut.
    const westCutIds = sectionEntitiesOf(presented, -4).map((entity) => entity.geometry.entityId);
    expect(westCutIds).toContain(ENTITY_IDS.column01);
    expect(westCutIds).not.toContain(ENTITY_IDS.hvacDuct);
    // The plan cut line renders at the SAME world X (one cut state).
    const planProjector = planProjectorFor(presented);
    expect(planCutLineOf(planProjector, -4).xPx).toBe(planProjector.px(-4));
    expect(planCutLineOf(planProjector, SECTION_CUT_X).xPx).toBe(planProjector.px(2));
  });

  it('interpolates the agent movement scripts deterministically', () => {
    const engineer = AGENTS.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    expect(engineer).toBeDefined();
    if (engineer === undefined) return;
    expect(agentPositionAt(engineer, 0)).toEqual([-4, 0, -3]);
    const midway = agentPositionAt(engineer, 1_000);
    expect(midway[0]).toBeCloseTo(0, 6);
    expect(midway[2]).toBeCloseTo(-3, 6);
    expect(agentPositionAt(engineer, 60_000)).toEqual([0, 0, 0]);
  });

  it('maps the BOQ line items 1:1 onto the world entities (cross-highlight identity)', () => {
    const entityIds = new Set(presentedEntities('variant-current').map((e) => e.geometry.entityId));
    for (const line of BOQ_LINE_ITEMS) {
      expect(entityIds.has(line.entityId), line.lineId).toBe(true);
      expect(boqLineOf(line.entityId)?.lineId).toBe(line.lineId);
    }
    for (const entityId of entityIds) {
      expect(boqLineOf(entityId), entityId).not.toBeNull();
    }
    // The presentation estimate: subtotal (the rollup fold) -> 5%
    // contingency -> total; the fixture grand total is the declared fold.
    const estimate = boqEstimate();
    const sum = BOQ_ROLLUPS.reduce((acc, rollup) => acc + Number(rollup.subtotal.amount), 0);
    expect(Number(estimate.subtotal)).toBeCloseTo(sum, 2);
    expect(Number(estimate.contingency)).toBeCloseTo(sum * 0.05, 2);
    expect(Number(estimate.total)).toBeCloseTo(sum * 1.05, 2);
    expect(estimate.fixtureGrandTotal).toBe(FIXTURE.boqGrandTotal.amount);
    expect(formatEur('41236.50')).toBe('€41,236.50');
  });

  it('presents the constraints/findings surface (all fixture findings + variant notes)', () => {
    const current = presentedConstraints('variant-current');
    expect(current).toHaveLength(CONSTRAINTS.length + 2);
    expect(current.filter((constraint) => constraint.variantNote)).toHaveLength(2);
    const altB = presentedConstraints('variant-alt-b');
    expect(altB.length).toBe(CONSTRAINTS.length + VARIANTS[2]!.constraints.length);
    expect(altB.filter((constraint) => constraint.variantNote).length).toBe(
      VARIANTS[2]!.constraints.length,
    );
  });

  it('computes the solution metrics (phase-gated built counts + variant cost/days/risk)', () => {
    const siteMetrics = solutionMetrics('variant-current', 0);
    expect(siteMetrics.phaseId).toBe('phase-site');
    expect(siteMetrics.builtEntityCount).toBe(
      presentedEntities('variant-current').filter(
        (entity) => entity.geometry.phase === 'phase-site',
      ).length,
    );
    expect(solutionMetrics('variant-current', 8_000).phaseId).toBe('phase-walls');
    const end = solutionMetrics('variant-current', 16_000);
    expect(end.phaseId).toBe('phase-finishes');
    expect(end.builtEntityCount).toBe(34);
    const altA = solutionMetrics('variant-alt-a', 8_000);
    expect(altA.cost.total).toBe('43000.00');
    expect(altA.days).toBe(58);
    expect(altA.risk).toBe('low');
    expect(altA.deltas.removed).toBe(1);
  });

  it('phase-gates the presented entities (the timeline visibly changes the world)', () => {
    const presented = presentedEntities('variant-current');
    expect(phaseAt(6_000).phaseId).toBe('phase-structure');
    const builtAtStructure = presented.filter(
      (entity) =>
        entity.geometry.phase === 'phase-site' ||
        entity.geometry.phase === 'phase-excavation' ||
        entity.geometry.phase === 'phase-foundation' ||
        entity.geometry.phase === 'phase-structure',
    );
    expect(builtAtStructure.length).toBe(14);
    expect(
      presented.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct)?.geometry.phase,
    ).toBe('phase-mep');
    // The eight phases + the branch point come from the fixture table.
    expect(SOLUTION_PHASES).toHaveLength(8);
    expect(SOLUTION_BRANCH_PHASE.markerId).toBe('mrk-cs-branch-solution');
  });

  it('projects the §9 engineering evidence trail per entity (never a second ledger)', () => {
    const duct = entityEvidenceOf(ENTITY_IDS.hvacDuct, 'variant-current');
    expect(duct).not.toBeNull();
    expect(duct?.boqLines.map((line) => line.lineId)).toEqual([
      boqLineOf(ENTITY_IDS.hvacDuct)?.lineId,
    ]);
    expect(duct?.findings.map((finding) => finding.record.constraintId)).toContain(
      'W071-finding-002',
    );
    expect(duct?.agents).toHaveLength(0);
    expect(duct?.layer?.layerId).toBe('lyr-mep');
    expect(duct?.phase?.phaseId).toBe('phase-mep');
    expect(duct?.phase?.label).toBe(phaseRecordOf('phase-mep')?.label);
    // Under Alt A the SAME trail resolves the clash finding.
    expect(
      entityEvidenceOf(ENTITY_IDS.hvacDuct, 'variant-alt-a')?.findings.find(
        (finding) => finding.record.constraintId === 'W071-finding-002',
      )?.resolvedByVariant,
    ).toBe(true);
    // COL-04: the structural engineer works on it AND the spacing finding
    // cites it (the two evidence hooks crossing one element).
    const col04 = entityEvidenceOf(ENTITY_IDS.column04, 'variant-current');
    expect(col04?.agents.map((agent) => agent.agentId)).toEqual([AGENT_IDS.structuralEngineer]);
    expect(col04?.findings.map((finding) => finding.record.constraintId)).toContain(
      'W071-finding-005',
    );
    // The variant-added AHU (Alt B) carries NO BOQ line; unknown entities
    // project to null (never a fabricated record).
    expect(entityEvidenceOf('cs-mep-hvac-ahu-interior', 'variant-alt-b')?.boqLines).toHaveLength(0);
    expect(entityEvidenceOf('no-such-entity', 'variant-current')).toBeNull();
  });

  it('resolves the bidirectional BOQ <-> world cross-selection (both directions of ONE identity)', () => {
    const line = boqLineOf(ENTITY_IDS.hvacDuct);
    expect(line).not.toBeNull();
    const fromLine = crossHighlightFromBoqLine(line!);
    expect(fromLine).toEqual({
      source: 'boq',
      entityIds: [ENTITY_IDS.hvacDuct],
      lineIds: [line!.lineId],
    });
    const fromEntity = crossHighlightFromEntity(ENTITY_IDS.hvacDuct);
    expect(fromEntity.source).toBe('world');
    expect(fromEntity.entityIds).toEqual([ENTITY_IDS.hvacDuct]);
    expect(fromEntity.lineIds).toEqual([line!.lineId]);
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
    // The variant-added AHU has no line (world -> BOQ resolves to none).
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
    // Persistence contract: a held VALUE that survives view-mode changes;
    // the empty state is inactive.
    expect(crossHighlightActive(fromEntity)).toBe(true);
    expect(crossHighlightActive(EMPTY_CROSS_HIGHLIGHT)).toBe(false);
  });

  it('wires the agent current-work highlight hooks (fixture agents -> their elements)', () => {
    const engineer = AGENTS.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    expect(engineer).toBeDefined();
    expect(engineer === undefined ? null : crossHighlightFromAgent(engineer)).toEqual({
      source: 'agent',
      entityIds: [ENTITY_IDS.column04],
      lineIds: [boqLineOf(ENTITY_IDS.column04)?.lineId],
    });
    expect(agentsWorkingOn(ENTITY_IDS.column04).map((agent) => agent.agentId)).toEqual([
      AGENT_IDS.structuralEngineer,
    ]);
    expect(agentsWorkingOn(ENTITY_IDS.siteStaging).map((agent) => agent.agentId)).toEqual([
      AGENT_IDS.siteCoordinator,
    ]);
    expect(agentsWorkingOn(ENTITY_IDS.hvacDuct)).toHaveLength(0);
    const engineerAgent = engineer!;
    expect(
      [...highlightEntityIdsOf(crossHighlightFromEntity(ENTITY_IDS.hvacDuct), engineerAgent)].sort(),
    ).toEqual([ENTITY_IDS.column04, ENTITY_IDS.hvacDuct]);
    expect(highlightEntityIdsOf(EMPTY_CROSS_HIGHLIGHT, engineerAgent)).toEqual([
      ENTITY_IDS.column04,
    ]);
    expect(highlightEntityIdsOf(EMPTY_CROSS_HIGHLIGHT, null)).toEqual([]);
  });

  it('derives the isolated layer from the layer visibility state (the typed filter intent)', () => {
    const all = SOLUTION_PHASES.length; // unused shape guard (keeps tsc honest below)
    expect(all).toBe(8);
    // Baseline: every layer fully visible -> no isolation.
    expect(
      isolatedLayerIdOf([
        { layerId: 'lyr-site', visible: true, mixed: false },
        { layerId: 'lyr-foundation', visible: true, mixed: false },
        { layerId: 'lyr-structure', visible: true, mixed: false },
        { layerId: 'lyr-envelope', visible: true, mixed: false },
        { layerId: 'lyr-mep', visible: true, mixed: false },
        { layerId: 'lyr-finishes', visible: true, mixed: false },
      ]),
    ).toBeNull();
    // The typed isolate state: ONLY MEP visible (the typed filter intent).
    expect(
      isolatedLayerIdOf([
        { layerId: 'lyr-site', visible: false, mixed: false },
        { layerId: 'lyr-foundation', visible: false, mixed: false },
        { layerId: 'lyr-structure', visible: false, mixed: false },
        { layerId: 'lyr-envelope', visible: false, mixed: false },
        { layerId: 'lyr-mep', visible: true, mixed: false },
        { layerId: 'lyr-finishes', visible: false, mixed: false },
      ]),
    ).toBe('lyr-mep');
    // A mixed layer (the hidden legacy conduit) is not an isolation.
    expect(
      isolatedLayerIdOf([
        { layerId: 'lyr-site', visible: true, mixed: false },
        { layerId: 'lyr-foundation', visible: true, mixed: false },
        { layerId: 'lyr-structure', visible: true, mixed: false },
        { layerId: 'lyr-envelope', visible: true, mixed: false },
        { layerId: 'lyr-mep', visible: true, mixed: true },
        { layerId: 'lyr-finishes', visible: true, mixed: false },
      ]),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The variant selection contract (the typed branch path through the REAL
// runtime — the workspace's onVariantChange).
// ---------------------------------------------------------------------------

describe('the variant selection contract (the workspace variant path)', () => {
  it('issues the typed branch intent at the fixture branch point and keeps the canonical scene intact', async () => {
    const runtime = new WorldWorkspaceRuntime({
      slug: 'w072-variant-test',
      fabric: buildHeadlessWorldFabric().fabric,
      scene: SCENE,
      ontology: ONTOLOGY,
      device: DEVICE,
      clock: new ManualHostClock(100_000),
      scheduler: new ManualFrameScheduler(),
      rendererPreference: RENDERER_PREFERENCE,
    });
    const opened = await runtime.open();
    expect(opened.ok).toBe(true);
    try {
      const digestBefore = runtime.currentScene().digest;
      const variant = 'variant-alt-a' as const;
      // The workspace's onVariantChange path (WorldWorkspace).
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
      expect(
        presentedEntities(variant).find((e) => e.geometry.entityId === ENTITY_IDS.legacyConduit)
          ?.state,
      ).toBe('removed');
    } finally {
      await runtime.close();
    }
  });
});

// ---------------------------------------------------------------------------
// The construction chrome at component level (the scripted driver + the
// construction view model — the workspace.test.tsx discipline).
// ---------------------------------------------------------------------------

/** Records every driver command (the wiring evidence). */
class RecordingDriver implements WorldWorkspaceDriver {
  public readonly commands: string[] = [];
  public view: WorkspaceViewModelInput;

  constructor(view: WorkspaceViewModelInput) {
    this.view = view;
  }

  viewModel(): WorkspaceViewModelInput {
    return this.view;
  }

  setTool(tool: string): void {
    this.commands.push(`setTool:${tool}`);
  }

  applyGesture(gesture: { readonly kind: string }): void {
    this.commands.push(`applyGesture:${gesture.kind}`);
  }

  navigate(key: string): void {
    this.commands.push(`navigate:${key}`);
  }

  resetNavigation(): void {
    this.commands.push('resetNavigation');
  }

  async dispatchPointerDown(pointer: { readonly x: number; readonly y: number }): Promise<
    | { ok: true; value: import('./workspace-contracts').ViewportInputOutcomeInput }
    | { ok: false; error: { code: string; message: string } }
  > {
    this.commands.push(`dispatchPointerDown:${pointer.x.toFixed(2)},${pointer.y.toFixed(2)}`);
    return {
      ok: true,
      value: {
        receipt: {
          inputId: 'rin-w072-1',
          inputKind: 'pointer-down',
          hitEntityId: ENTITY_IDS.hvacDuct,
          intent: { id: 'epoch.world.interaction.select', version: '1.0.0' },
          outcome: 'normalized',
          digest: '1'.repeat(64),
        },
        applied: true,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  async dispatchWheel(delta: { readonly x: number; readonly y: number }): Promise<
    | { ok: true; value: import('./workspace-contracts').ViewportInputOutcomeInput }
    | { ok: false; error: { code: string; message: string } }
  > {
    this.commands.push(`dispatchWheel:${delta.y}`);
    return {
      ok: true,
      value: {
        receipt: {
          inputId: 'rin-w072-2',
          inputKind: 'wheel',
          intent: { id: 'epoch.world.interaction.zoom', version: '1.0.0' },
          outcome: 'normalized',
          digest: '2'.repeat(64),
        },
        applied: true,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  private async boolean(kind: string): Promise<{ ok: true; value: boolean } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push(kind);
    return { ok: true, value: true };
  }

  toggleLayer(layerId: string) {
    return this.boolean(`toggleLayer:${layerId}`);
  }

  isolateLayer(layerId: string) {
    return this.boolean(`isolateLayer:${layerId}`);
  }

  revealAllLayers() {
    return this.boolean('revealAllLayers');
  }

  followAgent(agentId: string) {
    return this.boolean(`followAgent:${agentId}`);
  }

  scrubTimeline(toMs: number) {
    return this.boolean(`scrubTimeline:${toMs}`);
  }

  pauseTimeline() {
    return this.boolean('pauseTimeline');
  }

  resumeTimeline() {
    return this.boolean('resumeTimeline');
  }

  composeAnnotation(text: string) {
    return this.boolean(`composeAnnotation:${text}`);
  }

  invokeControl(controlId: string, payload?: { readonly branchAtMs?: number }) {
    return this.boolean(`invokeControl:${controlId}:${payload?.branchAtMs ?? ''}`);
  }

  async selectRenderer(rendererId: string): Promise<
    | {
        ok: true;
        value: import('./workspace-contracts').SwitchSummaryInput;
      }
    | { ok: false; error: { code: string; message: string } }
  > {
    this.commands.push(`selectRenderer:${rendererId}`);
    return {
      ok: true,
      value: {
        fromRendererId: THREE_RENDERER_ID,
        toRendererId: rendererId,
        switchReceiptDigest: '3'.repeat(64),
        restoredViewFields: ['focused-entities', 'layer-visibility', 'camera'],
        skippedViewFields: [],
        fallbackApplied: false,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  importFoundationAsset(): { ok: false; error: { code: string; message: string } } {
    return { ok: false, error: { code: 'unused', message: 'not part of this battery' } };
  }

  async bindFoundationAsset(): Promise<{ ok: false; error: { code: string; message: string } }> {
    return { ok: false, error: { code: 'unused', message: 'not part of this battery' } };
  }
}

/** A construction-flavored workspace view model over the frozen fixture. */
function constructionViewModel(): WorkspaceViewModelInput {
  const presented = presentedEntities('variant-current');
  const asEntity = (entityId: string, ndc: { x: number; y: number } | null): ViewportEntityInput => {
    const record = presented.find((entity) => entity.geometry.entityId === entityId);
    return {
      entityId,
      label: record?.projection.label ?? entityId,
      entityType: record?.projection.entityType ?? 'unknown:kind',
      contentDigest: 'd'.repeat(64),
      position: [...(record?.geometry.position ?? [0, 0, 0])] as [number, number, number],
      ndc,
      depth: ndc === null ? null : 20,
      visible: entityId !== ENTITY_IDS.legacyConduit,
      isolated: false,
      focused: entityId === ENTITY_IDS.column04,
      layerHidden: false,
      representationRecordId: 'ont-rep-box',
    };
  };
  const agents: readonly ViewportAgentInput[] = AGENTS.map((agent) => ({
    agentId: agent.agentId,
    contentDigest: 'a'.repeat(64),
    followed: false,
  }));
  return {
    viewport: {
      sceneId: SCENE.sceneId,
      sceneName: 'Construction solution — Pioneer Block-A',
      worldDigest: SCENE.digest,
      tenantId: 'tenant:nordstrand',
      entities: [
        asEntity(ENTITY_IDS.column04, { x: -0.1, y: -0.2 }),
        asEntity(ENTITY_IDS.hvacDuct, { x: 0.2, y: 0.1 }),
        asEntity(ENTITY_IDS.siteStaging, { x: -0.4, y: 0.3 }),
        asEntity(ENTITY_IDS.legacyConduit, null),
      ],
      agents,
      overlays: [],
      activeTool: 'select',
      navigation: {
        target: [0, 1.5, 0],
        azimuthRad: 0.7853981633974483,
        elevationRad: 0.5,
        distance: 30,
        fovRadians: Math.PI / 4,
      },
      cameraMode: 'orbit',
      followedAgentId: null,
    },
    inspect: {
      entityId: null,
      label: null,
      entityType: null,
      contentDigest: null,
      position: null,
      visible: true,
      isolated: false,
      representationRecordId: null,
      focusedEntities: [ENTITY_IDS.column04],
    },
    layers: [
      { layerId: 'lyr-site', namespace: 'site', label: 'Site', entityIds: [ENTITY_IDS.siteBoundary, ENTITY_IDS.siteStaging, ENTITY_IDS.siteAccess, ENTITY_IDS.siteExcavation], visible: true, mixed: false },
      { layerId: 'lyr-foundation', namespace: 'foundation', label: 'Foundation', entityIds: [ENTITY_IDS.foundationStrip, ENTITY_IDS.foundationBaseA, ENTITY_IDS.foundationBaseB, ENTITY_IDS.groundSlab], visible: true, mixed: false },
      { layerId: 'lyr-structure', namespace: 'structure', label: 'Structure', entityIds: [ENTITY_IDS.column01, ENTITY_IDS.column02, ENTITY_IDS.column03, ENTITY_IDS.column04, ENTITY_IDS.beam01, ENTITY_IDS.beam02, ENTITY_IDS.roofStructure], visible: true, mixed: false },
      { layerId: 'lyr-envelope', namespace: 'envelope', label: 'Envelope', entityIds: [ENTITY_IDS.wallNorth, ENTITY_IDS.wallSouth, ENTITY_IDS.wallEast, ENTITY_IDS.wallWest, ENTITY_IDS.doorFront, ENTITY_IDS.windowSouth01, ENTITY_IDS.windowSouth02, ENTITY_IDS.roofCladding], visible: true, mixed: false },
      { layerId: 'lyr-mep', namespace: 'mep', label: 'MEP', entityIds: [ENTITY_IDS.electricalPanel, ENTITY_IDS.lightingCircuit, ENTITY_IDS.plumbingRiser, ENTITY_IDS.hvacDuct, ENTITY_IDS.hvacUnit, ENTITY_IDS.drainagePipe, ENTITY_IDS.legacyConduit], visible: true, mixed: true },
      { layerId: 'lyr-finishes', namespace: 'finishes', label: 'Finishes', entityIds: [ENTITY_IDS.ceiling, ENTITY_IDS.floor, ENTITY_IDS.paintWall, ENTITY_IDS.fixtures], visible: true, mixed: false },
    ],
    timeline: {
      trackLabel: 'Construction programme',
      trackStartMs: TRACK.startMs,
      trackEndMs: TRACK.endMs,
      markers: [
        ...PHASES.map((phase) => ({
          markerId: phase.markerId,
          atMs: phase.atMs,
          label: phase.label,
          markerKind: 'event',
        })),
        { markerId: SOLUTION_BRANCH_PHASE.markerId, atMs: SOLUTION_BRANCH_PHASE.atMs, label: 'Solution branch point', markerKind: 'branch-point' },
      ],
      positionAtMs: 6_000,
      frameIndex: 15,
      paused: false,
      presentationAtMs: 6_000,
    },
    renderers: {
      choices: [
        { rendererId: THREE_RENDERER_ID, displayName: 'Three.js', capabilityId: 'cap-three', active: true, summary: 'picking · measure · annotate' },
        { rendererId: BABYLONJS_RENDERER_ID, displayName: 'Babylon.js', capabilityId: 'cap-babylon', active: false, summary: 'picking · measure' },
        { rendererId: REFERENCE_RENDERER_ID, displayName: 'Reference (reference)', capabilityId: 'cap-ref', active: false, summary: 'contract-only fallback' },
      ],
      activeRendererId: THREE_RENDERER_ID,
      health: { state: 'healthy', degradation: 'none', atMs: 1_000 },
      sessionState: 'active',
      lastFailure: null,
      lastSwitchDigest: null,
      restoredViewFields: [],
      fallbackApplied: false,
    },
    journal: [],
    effects: [],
    controls: FIXTURE.sceneContent.controls.map((control) => ({
      controlId: control.controlId,
      controlKind: control.controlKind,
      label: control.label ?? control.controlId,
      intentId: control.intent.id,
    })),
    sessionAssets: { imported: [], ledger: [] },
    sceneUsage: {
      entityCount: 34,
      focusedCount: 1,
      agentCount: AGENTS.length,
      markerCount: 9,
      controlCount: 3,
    },
  };
}

describe('the construction chrome (component level)', () => {
  it('the top bar renders the Epoch-owned renderer selector + the switch evidence', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionTopBar, {
        sceneName: 'Construction solution — Pioneer Block-A',
        tenantId: 'tenant:nordstrand',
        sceneId: SCENE.sceneId,
        worldDigest: SCENE.digest,
        renderers: driver.view.renderers,
        handlers,
        viewMode: '3d',
        onViewModeChange: () => undefined,
        variantId: 'variant-current',
      }),
    );
    // The selector offers BOTH real engines + the reference fallback.
    expect(html).toContain(`data-renderer-choice="${THREE_RENDERER_ID}"`);
    expect(html).toContain(`data-renderer-choice="${BABYLONJS_RENDERER_ID}"`);
    expect(html).toContain(`data-renderer-choice="${REFERENCE_RENDERER_ID}"`);
    expect(html).toContain('data-renderer-active="true"');
    // The health + the no-switch-yet evidence (the digest carries across
    // every switch — the preservation contract's idle state).
    expect(html).toContain('healthy');
    expect(html).toContain('No switch yet');
    // The view modes + the active variant chip.
    expect(html).toContain('data-testid="cs-mode-3d"');
    expect(html).toContain('data-testid="cs-mode-plan"');
    expect(html).toContain('data-testid="cs-mode-section"');
    expect(html).toContain('data-variant-id="variant-current"');
  });

  it('the navigator renders the six construction layers + the agents through the typed path', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const agents = navigatorAgentsOf(
      driver.view.viewport.agents,
      driver.view.viewport.followedAgentId,
      AGENT_IDS.structuralEngineer,
    );
    const html = renderToStaticMarkup(
      createElement(ConstructionNavigator, {
        view: driver.view,
        handlers,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        selectedEntityId: ENTITY_IDS.column04,
        onSelectEntity: () => undefined,
        agents,
        onInspectAgent: () => undefined,
        compactJournal: true,
      }),
    );
    // The six fixture layers render with their typed affordances.
    for (const layerId of ['lyr-site', 'lyr-foundation', 'lyr-structure', 'lyr-envelope', 'lyr-mep', 'lyr-finishes']) {
      expect(html).toContain(`data-testid="cs-layer-${layerId}"`);
      expect(html).toContain(`data-testid="layer-toggle-${layerId}"`);
      expect(html).toContain(`data-testid="layer-isolate-${layerId}"`);
    }
    expect(html).toContain('data-testid="layers-reveal-all"');
    // The two fixture agents render with their task + follow/inspect.
    expect(html).toContain(`data-presence-agent="${AGENT_IDS.structuralEngineer}"`);
    expect(html).toContain(`data-presence-agent="${AGENT_IDS.siteCoordinator}"`);
    expect(html).toContain(`data-testid="follow-${AGENT_IDS.structuralEngineer}"`);
    expect(html).toContain(`data-testid="agent-inspect-${AGENT_IDS.siteCoordinator}"`);
    // The agent current-work links point at the canonical entities.
    expect(html).toContain(`data-testid="agent-work-${AGENT_IDS.structuralEngineer}"`);
    // navigatorAgentsOf: the fixture records carry label/role/task + work.
    const engineer = agents.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    expect(engineer?.currentWorkEntityId).toBe(ENTITY_IDS.column04);
    expect(engineer?.inspected).toBe(true);
    expect(engineer?.label).toBe(AGENTS[0]?.label);
  });

  it('the navigator layer affordances issue the typed driver commands (toggle/isolate/reveal)', async () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onLayerToggle('lyr-mep');
    handlers.onLayerIsolate('lyr-structure');
    handlers.onLayersRevealAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.commands).toEqual([
      'toggleLayer:lyr-mep',
      'isolateLayer:lyr-structure',
      'revealAllLayers',
    ]);
  });

  it('the inspector renders the §9 engineering projection + the evidence trail of the selection', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionInspector, {
        view: driver.view,
        handlers,
        annotationDraft: '',
        onAnnotationDraftChange: () => undefined,
        selectedEntityId: ENTITY_IDS.hvacDuct,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        onVariantChange: () => undefined,
        onBoqHighlight: () => undefined,
        onConstraintFocus: () => undefined,
        crossHighlight: EMPTY_CROSS_HIGHLIGHT,
        onClearHighlight: () => undefined,
        activeAgent: null,
        onClearAgent: () => undefined,
        onSelectEntity: () => undefined,
        activePhase: phaseAt(6_000),
      }),
    );
    // The canonical identity + the §9 engineering fields.
    expect(html).toContain(`<span data-inspect="entityId">${ENTITY_IDS.hvacDuct}</span>`);
    expect(html).toContain('data-inspect="entityType"');
    expect(html).toContain('Galvanised ductwork');
    expect(html).toContain('4.00 × 0.25 × 0.25 m');
    expect(html).toContain('phase-mep'.replace('phase-', ''));
    expect(html).toContain('Clash risk with legacy conduit (W071-finding-002)');
    // The evidence trail: the BOQ line button, the clash finding, the layer.
    expect(html).toContain('data-testid="cs-inspect-boq-line"');
    expect(html).toContain('data-testid="cs-inspect-finding"');
    expect(html).toContain('data-severity="warn"');
    // The fixture's DECLARED programme controls (typed entries).
    expect(html).toContain(`data-scene-control="${CONTROL_IDS.branch}"`);
    expect(html).toContain(`data-scene-control="${CONTROL_IDS.simulate}"`);
    // The annotation composer rides the inspector tab.
    expect(html).toContain('data-testid="annotation-input"');
  });

  it('the BOQ tab renders the per-layer rollups -> subtotal -> contingency -> total + the cross-highlight status', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionInspector, {
        view: driver.view,
        handlers,
        annotationDraft: '',
        onAnnotationDraftChange: () => undefined,
        selectedEntityId: null,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        onVariantChange: () => undefined,
        onBoqHighlight: () => undefined,
        onConstraintFocus: () => undefined,
        crossHighlight: EMPTY_CROSS_HIGHLIGHT,
        onClearHighlight: () => undefined,
        activeAgent: null,
        onClearAgent: () => undefined,
        onSelectEntity: () => undefined,
        activePhase: phaseAt(6_000),
        initialTab: 'boq',
      }),
    );
    for (const rollup of BOQ_ROLLUPS) {
      expect(html).toContain(`data-testid="cs-boq-rollup-${rollup.layerId}"`);
    }
    expect(html).toContain('data-testid="cs-boq-toggle"');
    expect(html).toContain('data-testid="cs-boq-total"');
    expect(html).toContain(formatEur(boqEstimate().total));
    expect(html).toContain(formatEur(boqEstimate().fixtureGrandTotal));
    expect(html).toContain('data-testid="cs-cross-highlight"');
    expect(html).toContain('No cross-highlight.');
  });

  it('the findings tab renders the fixture findings with severity + the variant notes', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionInspector, {
        view: driver.view,
        handlers,
        annotationDraft: '',
        onAnnotationDraftChange: () => undefined,
        selectedEntityId: null,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        onVariantChange: () => undefined,
        onBoqHighlight: () => undefined,
        onConstraintFocus: () => undefined,
        crossHighlight: EMPTY_CROSS_HIGHLIGHT,
        onClearHighlight: () => undefined,
        activeAgent: null,
        onClearAgent: () => undefined,
        onSelectEntity: () => undefined,
        activePhase: phaseAt(6_000),
        initialTab: 'findings',
      }),
    );
    expect(html).toContain('data-testid="cs-constraint"');
    // The MEP clash finding is spatially discoverable (its entities listed).
    expect(html).toContain('data-constraint-id="W071-finding-002"');
    expect(html).toContain(`⌖ ${ENTITY_IDS.hvacDuct}, ${ENTITY_IDS.legacyConduit}, ${ENTITY_IDS.plumbingRiser}`);
    // The variant-level notes render with their severity.
    expect(html).toContain('(variant)');
  });

  it('the variants tab compares cost/days/risk and names the typed branch point', () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionInspector, {
        view: driver.view,
        handlers,
        annotationDraft: '',
        onAnnotationDraftChange: () => undefined,
        selectedEntityId: null,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        onVariantChange: () => undefined,
        onBoqHighlight: () => undefined,
        onConstraintFocus: () => undefined,
        crossHighlight: EMPTY_CROSS_HIGHLIGHT,
        onClearHighlight: () => undefined,
        activeAgent: null,
        onClearAgent: () => undefined,
        onSelectEntity: () => undefined,
        activePhase: phaseAt(6_000),
        initialTab: 'variants',
      }),
    );
    for (const variantId of SOLUTION_VARIANT_IDS) {
      expect(html).toContain(`data-variant-id="${variantId}"`);
    }
    expect(html).toContain(formatEur('43000.00'));
    expect(html).toContain('58 days');
    expect(html).toContain('risk low');
    // The world-change contract is named (the branch point of the fixture).
    expect(html).toContain('typed branch intent');
  });

  it('the viewport timeline HUD renders the programme phases + the scrubber, and phase clicks issue the typed scrub', async () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    const html = renderToStaticMarkup(
      createElement(ConstructionViewport, {
        viewport: driver.view.viewport,
        timeline: driver.view.timeline,
        health: driver.view.renderers.health,
        fallbackApplied: false,
        failure: null,
        handlers,
        presented: presentedEntities('variant-current'),
        variantId: 'variant-current',
        viewMode: '3d',
        selectedEntityId: ENTITY_IDS.column04,
        onPresentedPick: () => undefined,
        highlightEntityIds: [],
        sectionCutX: SECTION_CUT_X,
        sectionCutRange: sectionCutRangeOf(presentedEntities('variant-current')),
        onSectionCutChange: () => undefined,
        activePhase: phaseAt(6_000),
        measureHint: null,
        agents: navigatorAgentsOf(driver.view.viewport.agents, null, null).map((agent) => ({
          agentId: agent.agentId,
          label: agent.label,
          followed: agent.followed,
        })),
      }),
    );
    // The scrubber + the position + the phase chips.
    expect(html).toContain('data-testid="timeline-track"');
    expect(html).toContain('data-testid="timeline-position"');
    expect(html).toContain('data-testid="cs-timeline-phase"');
    expect(html).toContain(`data-testid="cs-phase-phase-structure"`);
    expect(html).toContain(`data-marker="${SOLUTION_BRANCH_PHASE.markerId}"`);
    // The offscreen rail names the hidden legacy conduit honestly.
    expect(html).toContain(`data-viewport-entity="${ENTITY_IDS.legacyConduit}"`);
    expect(html).toContain('data-entity-state="offscreen"');
    // The typed scrub wiring: a phase click scrubs to the phase marker time.
    handlers.onTimelineScrub(PHASES[4]!.atMs);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.commands).toContain(`scrubTimeline:${PHASES[4]!.atMs}`);
  });

  it('the renderer-switch preservation contract at component level: every choice routes through the typed switch', async () => {
    const driver = new RecordingDriver(constructionViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onRendererSelect(BABYLONJS_RENDERER_ID);
    handlers.onRendererSelect(REFERENCE_RENDERER_ID);
    handlers.onRendererSelect(THREE_RENDERER_ID);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.commands).toEqual([
      `selectRenderer:${BABYLONJS_RENDERER_ID}`,
      `selectRenderer:${REFERENCE_RENDERER_ID}`,
      `selectRenderer:${THREE_RENDERER_ID}`,
    ]);
  });
});

// The headless engine sanity for this battery's runtime legs (the REAL
// adapters behind the seam — the full engine battery lives in
// host/world-engines.test.ts).
describe('the construction fixture seam (headless)', () => {
  it('registers the REAL engines + the reference fallback in the declared preference order', () => {
    const { fabric } = buildHeadlessWorldFabric();
    const listed = fabric.adapters.listRenderers().map((entry) => entry.descriptor.rendererId);
    expect([...listed].sort()).toEqual(
      [BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID, THREE_RENDERER_ID].sort(),
    );
    expect(RENDERER_PREFERENCE).toEqual([
      THREE_RENDERER_ID,
      BABYLONJS_RENDERER_ID,
      REFERENCE_RENDERER_ID,
    ]);
  });
});
