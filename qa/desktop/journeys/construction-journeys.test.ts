// W073 — the desktop CONSTRUCTION SOLUTION journey set: the WO's
// deliverable-13 journeys, the acceptance-criteria cousins of the W048
// product-logic journeys (J01-J12) executed against the CONSTRUCTION
// SOLUTION workspace composition — the exact composition the DEFAULT
// desktop surface mounts (the FROZEN W071 construction-solution fixture
// behind the REAL @epoch/world-runtime WorldWorkspaceRuntime, the REAL
// RendererFabric with the REAL Three.js + Babylon.js headless engine
// cores and the contract-only reference fallback), driven through the
// SAME typed interaction surface the workspace's UI issues (picks,
// layers, isolation, measurement, annotation, agent follow, timeline,
// branch, simulate) plus the pure projection model the plan/section/
// variant/BOQ/constraint presentations render.
//
// CI-green = every journey passes its step-level assertions; with
// EPOCH_EMIT_JOURNEY_RECORDS=1 the run also emits the committed evidence
// records (qa/desktop/journeys/records/construction-journey-records.json).
//
// What this harness proves: the construction journey LOGIC + the exact
// product code paths the visible workspace renders (the runtime
// view-models + the projection model the panels read).
// What it does NOT prove (recorded honestly in every record): the native
// Tauri shell + live-GL presentation — cargo/rustc/webkit2gtk-4.1 are
// ABSENT in this environment (qa/desktop/evidence/w073/toolchain-audit.txt;
// the honest-degradation doctrine — no packaged-binary legs are claimed).
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ManualFrameScheduler,
  ManualHostClock,
  WorldWorkspaceRuntime,
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
  CONTROL_IDS,
  ENTITY_IDS,
  FIXTURE,
  LAYER_IDS,
  MEP_CLASH_FINDING,
  OVERLAY_IDS,
  REFERENCE_RENDERER_ID,
  buildWorldFabric,
} from '@epoch/construction-world-fixture';
import type { JourneyRecord, JourneyStepRecord } from './runner';
import {
  EMPTY_CROSS_HIGHLIGHT,
  SECTION_CUT_X,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_SIMULATE_CONTROL,
  agentPositionAt,
  agentsWorkingOn,
  boqLineOf,
  clampSectionCut,
  crossHighlightActive,
  crossHighlightFromAgent,
  crossHighlightFromBoqLine,
  crossHighlightFromConstraint,
  crossHighlightFromEntity,
  entityEvidenceOf,
  highlightEntityIdsOf,
  isolatedLayerIdOf,
  layerRecordOf,
  phaseAt,
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
} from '../../../apps/desktop/app/components/construction/construction-projection';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');

/** The current git head SHA (recorded in every journey record). */
function gitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const SOURCE_COMMIT = gitHead();
/** The fixture identity the records carry (the frozen W071 fixture). */
const CONSTRUCTION_FIXTURE_ID = `epoch-construction-world-fixture-v${FIXTURE.version}`;
/** The honest environment label (the native toolchain gap is recorded, not hidden). */
const ENVIRONMENT =
  'Node/vitest headless product-logic run: the construction solution workspace composition ' +
  '(the frozen W071 fixture behind the REAL @epoch/world-runtime WorldWorkspaceRuntime + the ' +
  'REAL RendererFabric with the REAL Three.js/Babylon.js headless engine cores and the ' +
  'reference fallback — the exact composition the DEFAULT desktop surface mounts), driven ' +
  'through the same typed interaction surface the workspace UI issues; native Tauri shell NOT ' +
  'covered: cargo/rustc/webkit2gtk-4.1 ABSENT (qa/desktop/evidence/w073/toolchain-audit.txt)';

const ALL_RECORDS: JourneyRecord[] = [];

/**
 * The pointer position at which one entity projects under the ACTIVE
 * Three.js presenter — the honest targeting basis (the pointer is DERIVED
 * from the real projection, never guessed; the same seam the workspace's
 * host-selection path uses).
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

/** The composition the DEFAULT desktop surface mounts (headless engine cores). */
async function openConstructionWorld() {
  const clock = new ManualHostClock(60_000);
  const scheduler = new ManualFrameScheduler();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'desktop-construction-solution-journey',
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
  return { runtime, three };
}

/** One recorded step (the spec/journey-validation.md field contract). */
function step(
  stepId: string,
  action: string,
  expected: string,
  observed: string,
  pass: boolean,
): JourneyStepRecord {
  return { stepId, action, expected, observed, result: pass ? 'pass' : 'fail' };
}

/** Assemble one journey record from its executed outcome. */
function record(
  journeyId: string,
  title: string,
  outcome: {
    readonly steps: readonly JourneyStepRecord[];
    readonly pass: boolean;
    readonly expected: string;
    readonly observed: string;
    readonly actions: readonly string[];
  },
): JourneyRecord {
  return {
    journeyId,
    platform: 'linux',
    persona: 'delivery lead (desktop construction solution user)',
    productVersion: '1.0.0',
    sourceCommit: SOURCE_COMMIT,
    environment: ENVIRONMENT,
    fixtureId: CONSTRUCTION_FIXTURE_ID,
    preconditions: [
      'the frozen W071 construction-solution fixture (deterministic, content-addressed)',
      'the REAL WorldWorkspaceRuntime over the REAL RendererFabric (Three.js + Babylon.js headless cores + reference fallback)',
    ],
    actions: outcome.actions,
    expectedOutcome: outcome.expected,
    observedOutcome: outcome.observed,
    evidence: [
      `qa/desktop/journeys/records/construction-journey-records.json#journey-${journeyId.toLowerCase()}`,
      'qa/desktop/evidence/w073/toolchain-audit.txt (native toolchain audit: cargo/rustc/webkit2gtk-4.1 ABSENT — no packaged-binary legs)',
    ],
    defect: null,
    severity: null,
    fixCommit: null,
    regressionTest: `qa/desktop/journeys/construction-journeys.test.ts (${journeyId})`,
    rerunResult: 'n/a (first run in this branch)',
    disposition: outcome.pass
      ? `PASS (${title}) — headless product-logic run over the construction solution composition; native shell + live GL not covered (see environment)`
      : `FAIL (${title}) — see steps`,
    steps: outcome.steps,
    overall: outcome.pass ? 'pass' : 'fail',
  };
}

/** Run the complete construction journey set (CJ01-CJ11). */
async function runConstructionJourneySet(): Promise<readonly JourneyRecord[]> {
  const records: JourneyRecord[] = [];

  // -------------------------------------------------------------------------
  // CJ01 — default-surface arrival: the world presents first.
  // -------------------------------------------------------------------------
  {
    const { runtime, three } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const session = runtime.session();
      const presentedFirst = three.presentationOf(session?.fabricSessionId ?? '') !== undefined;
      steps.push(
        step(
          'cj01-1-open',
          'runtime.open (the composition the DEFAULT surface mounts)',
          'the construction world opens with the fixture-preferred renderer presenting',
          `renderer=${session?.rendererId ?? 'none'}`,
          session?.rendererId === THREE_RENDERER_ID && presentedFirst,
        ),
      );
      const view = runtime.viewModel();
      const worldFirst =
        view.viewport.sceneId === FIXTURE.sceneId &&
        view.viewport.tenantId === FIXTURE.tenant &&
        view.viewport.worldDigest === FIXTURE.scene.digest;
      steps.push(
        step(
          'cj01-2-world-first',
          'the default surface presents the WORLD (no lifecycle/administration front)',
          'the viewport view model carries the canonical scene identity + digest (spatial world first)',
          `scene=${view.viewport.sceneId} digest=${view.viewport.worldDigest.slice(0, 12)}… entities=${view.viewport.entities.length}`,
          worldFirst && view.viewport.entities.length === 34,
        ),
      );
      const visibleCount = view.viewport.entities.filter((entity) => entity.visible).length;
      steps.push(
        step(
          'cj01-3-building-visible',
          'immediate visibility',
          'the building/site is visible immediately (all but the hidden legacy conduit — the deliberate clash risk)',
          `visible=${visibleCount}/34 (hidden: ${ENTITY_IDS.legacyConduit})`,
          visibleCount === 33,
        ),
      );
      const choices = view.renderers.choices.map((choice) => choice.rendererId).sort();
      steps.push(
        step(
          'cj01-4-renderer-chain',
          'the Epoch-owned renderer selector',
          'both real engines + the reference fallback are offered (the fixture chain)',
          `choices=${choices.join(',')}`,
          choices.join(',') ===
            [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID].sort().join(','),
        ),
      );
      const layersOk =
        [...runtime.layers().map((layer) => layer.layerId)].sort().join(',') ===
        [...LAYER_IDS].sort().join(',') &&
        runtime.layers().every(
          (layer) =>
            layer.entityIds.join(',') === (layerRecordOf(layer.layerId)?.entityIds ?? []).join(','),
        );
      steps.push(
        step(
          'cj01-5-layers',
          'the construction layers navigator data',
          'the six construction layers present with the fixture entity records',
          `layers=${runtime.layers().map((layer) => layer.layerId).join(',')}`,
          layersOk,
        ),
      );
      const focused = FIXTURE.scene.focusedEntityIds[0];
      const arrivalEvidence = entityEvidenceOf(focused ?? '', 'variant-current');
      steps.push(
        step(
          'cj01-6-arrival-selection',
          'the arrival selection (the fixture focused entity)',
          'the inspector carries the focused entity\'s §9 evidence from arrival (working agents included)',
          `focused=${focused} agents=${arrivalEvidence?.agents.map((a) => a.agentId).join(',') ?? 'n/a'}`,
          focused === ENTITY_IDS.column04 &&
            arrivalEvidence !== null &&
            arrivalEvidence.agents.map((agent) => agent.agentId).join(',') === AGENT_IDS.structuralEngineer,
        ),
      );
      records.push(
        record('CJ01', 'Default-surface arrival — the world presents first', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'the product opens into the construction solution world: canonical scene + digest, 33/34 entities visible, both engines + fallback offered, six layers, focused-entity evidence at arrival',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'open the default surface (runtime.open over the frozen fixture)',
            'read the viewport view model (scene identity + digest)',
            'count the immediately-visible entities',
            'read the renderer selector choices',
            'read the six construction layers',
            'read the focused entity evidence',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ02 — layer navigation + isolation (the typed filter path).
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      await runtime.toggleLayer('lyr-finishes');
      const afterToggle = runtime.viewModel();
      const finishesHidden = !afterToggle.viewport.entities.find(
        (entity) => entity.entityId === ENTITY_IDS.floor,
      )?.visible;
      const structureVisible = afterToggle.viewport.entities.find(
        (entity) => entity.entityId === ENTITY_IDS.column01,
      )?.visible;
      steps.push(
        step(
          'cj02-1-toggle-layer',
          'toggleLayer (the typed filter intent)',
          'toggling one layer hides only its entities',
          `finishesVisible=${!finishesHidden} structureVisible=${structureVisible === true}`,
          finishesHidden && structureVisible === true,
        ),
      );
      steps.push(
        step(
          'cj02-2-hide-is-not-isolation',
          'isolatedLayerIdOf (the derived isolation)',
          'a plain hide is NOT an isolation',
          `isolated=${isolatedLayerIdOf(runtime.layers())}`,
          isolatedLayerIdOf(runtime.layers()) === null,
        ),
      );
      await runtime.revealAllLayers();
      const isolated = await runtime.isolateLayer('lyr-mep');
      const isolatedView = runtime.viewModel();
      const conduitVisible =
        isolatedView.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.legacyConduit)
          ?.visible === true;
      const stagingHidden =
        isolatedView.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.siteStaging)
          ?.visible === false;
      steps.push(
        step(
          'cj02-3-isolate-mep',
          'isolateLayer (the typed isolate intent)',
          'isolating the MEP layer returns the hidden legacy conduit to the world and hides every other layer (the spatial clash discovery)',
          `ok=${isolated.ok && isolated.value} conduitVisible=${conduitVisible} stagingVisible=${!stagingHidden}`,
          isolated.ok === true && isolated.value === true && conduitVisible && stagingHidden,
        ),
      );
      steps.push(
        step(
          'cj02-4-derived-isolation',
          'isolatedLayerIdOf over the live runtime',
          'the derived isolation is the isolated layer id',
          `isolated=${isolatedLayerIdOf(runtime.layers())}`,
          isolatedLayerIdOf(runtime.layers()) === 'lyr-mep',
        ),
      );
      await runtime.revealAllLayers();
      const revealed = runtime.viewModel().viewport.entities.filter((entity) => entity.visible).length;
      steps.push(
        step(
          'cj02-5-reveal-all',
          'revealAllLayers',
          'reveal-all issues the typed show intent for EVERY entity — the once-hidden clash conduit, already returned to the world by the isolation, stays discovered (34 visible, no isolation)',
          `visible=${revealed} isolated=${isolatedLayerIdOf(runtime.layers())}`,
          revealed === 34 && isolatedLayerIdOf(runtime.layers()) === null,
        ),
      );
      records.push(
        record('CJ02', 'Layer navigation + isolation (the typed filter path)', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'layer toggles hide only their own entities; isolation keeps ONE layer (returning the hidden clash conduit) and is derivable; reveal-all restores the shared world',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'toggle the finishes layer',
            'derive the isolation (none)',
            'isolate the MEP layer',
            'derive the isolation (lyr-mep)',
            'reveal all layers',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ03 — selection → inspector evidence trail (the canonical identity).
  // -------------------------------------------------------------------------
  {
    const { runtime, three } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const picked = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.siteStaging),
      );
      const receiptOk =
        picked.ok && picked.value.receipt.hitEntityId === ENTITY_IDS.siteStaging;
      steps.push(
        step(
          'cj03-1-pick',
          'dispatchPointerDown (the REAL Three.js raycaster pick)',
          'the pick returns the canonical semantic entity receipt (typed select intent, applied)',
          `hit=${picked.ok ? picked.value.receipt.hitEntityId : 'failed'} intent=${picked.ok ? (picked.value.receipt.intent?.id ?? 'none') : 'n/a'}`,
          receiptOk &&
            picked.ok &&
            picked.value.receipt.intent?.id === 'epoch.world.interaction.select' &&
            picked.value.applied === true,
        ),
      );
      const inspect = runtime.viewModel().inspect;
      steps.push(
        step(
          'cj03-2-canonical-id',
          'the inspect projection',
          'the canonical semantic entityId lands the inspector (never a renderer-local id)',
          `entityId=${inspect.entityId} entityType=${inspect.entityType}`,
          inspect.entityId === ENTITY_IDS.siteStaging && inspect.entityType === 'site:staging',
        ),
      );
      const stagingEvidence = entityEvidenceOf(ENTITY_IDS.siteStaging, 'variant-current');
      steps.push(
        step(
          'cj03-3-evidence-trail',
          'entityEvidenceOf (the §9 engineering evidence)',
          'the selected entity carries its BOQ line + layer + phase + working agents',
          `lines=${stagingEvidence?.boqLines.length ?? 0} layer=${stagingEvidence?.layer?.layerId} phase=${stagingEvidence?.phase?.phaseId} agents=${stagingEvidence?.agents.map((a) => a.agentId).join(',')}`,
          stagingEvidence !== null &&
            stagingEvidence.boqLines.length === 1 &&
            stagingEvidence.layer?.layerId === 'lyr-site' &&
            stagingEvidence.phase?.phaseId === 'phase-site' &&
            stagingEvidence.agents.map((agent) => agent.agentId).join(',') === AGENT_IDS.siteCoordinator,
        ),
      );
      const ductEvidence = entityEvidenceOf(ENTITY_IDS.hvacDuct, 'variant-current');
      const citesClash =
        ductEvidence?.findings.some((finding) => finding.record.constraintId === 'W071-finding-002') ===
        true;
      steps.push(
        step(
          'cj03-4-finding-citations',
          'entityEvidenceOf (finding citations)',
          'the evidence trail cites the findings naming the entity (the MEP clash for the duct)',
          `findings=${ductEvidence?.findings.map((f) => f.record.constraintId).join(',') ?? 'n/a'}`,
          citesClash &&
            ductEvidence?.layer?.layerId === 'lyr-mep' &&
            ductEvidence?.agents.length === 0,
        ),
      );
      steps.push(
        step(
          'cj03-5-unknown-honesty',
          'entityEvidenceOf (unknown entity)',
          'an unknown entity projects to null (never a fabricated record)',
          `evidence=${entityEvidenceOf('no-such-entity', 'variant-current')}`,
          entityEvidenceOf('no-such-entity', 'variant-current') === null,
        ),
      );
      records.push(
        record('CJ03', 'Selection → inspector evidence trail (the canonical identity)', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'a world pick returns the canonical semantic identity through the typed select intent; the inspector renders the §9 evidence trail (BOQ line, layer, phase, agents, finding citations); unknown ids are honestly null',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'pick the staging yard through the real raycaster',
            'read the canonical inspect identity',
            'read the §9 evidence trail of the selection',
            'read the duct finding citations',
            'probe an unknown entity',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ04 — BOQ ↔ world bidirectional cross-selection (persistent).
  // -------------------------------------------------------------------------
  {
    const steps: JourneyStepRecord[] = [];
    const line = boqLineOf(ENTITY_IDS.hvacDuct);
    const fromLine = line === null ? null : crossHighlightFromBoqLine(line);
    steps.push(
      step(
        'cj04-1-boq-to-world',
        'crossHighlightFromBoqLine (BOQ → world)',
        'selecting a BOQ line highlights ITS world entity',
        `source=${fromLine?.source} entities=${fromLine?.entityIds.join(',')}`,
        fromLine !== null &&
          fromLine.source === 'boq' &&
          fromLine.entityIds.join(',') === ENTITY_IDS.hvacDuct,
      ),
    );
    const fromEntity = crossHighlightFromEntity(ENTITY_IDS.hvacDuct);
    steps.push(
      step(
        'cj04-2-world-to-boq',
        'crossHighlightFromEntity (world → BOQ)',
        'selecting a world entity highlights its BOQ line(s)',
        `source=${fromEntity.source} lines=${fromEntity.lineIds.join(',')}`,
        fromEntity.source === 'world' &&
          fromEntity.lineIds.join(',') === (line?.lineId ?? ''),
      ),
    );
    const baseline = presentedEntities('variant-current');
    const baselineIds = new Set(baseline.map((entity) => entity.geometry.entityId));
    const oneToOne =
      line !== null &&
      new Set(fromLine?.entityIds).size === 1 &&
      baselineIds.has(line.entityId) &&
      baseline.every((entity) => boqLineOf(entity.geometry.entityId) !== null);
    steps.push(
      step(
        'cj04-3-one-identity',
        'the 1:1 identity map (every line ↔ every entity)',
        'both directions resolve ONE identity set; every baseline entity carries its BOQ line',
        `baselineEntities=${baseline.length} everyEntityHasLine=${baseline.every((entity) => boqLineOf(entity.geometry.entityId) !== null)}`,
        oneToOne === true,
      ),
    );
    const persistent =
      crossHighlightActive(fromEntity) && !crossHighlightActive(EMPTY_CROSS_HIGHLIGHT);
    steps.push(
      step(
        'cj04-4-persistence',
        'the cross-highlight value state',
        'the cross-selection is a VALUE the workspace holds across view-mode changes (persistent until cleared/replaced; the empty state is inactive)',
        `active=${crossHighlightActive(fromEntity)} emptyActive=${crossHighlightActive(EMPTY_CROSS_HIGHLIGHT)} viewportSet=${highlightEntityIdsOf(fromEntity, null).join(',')}`,
        persistent && highlightEntityIdsOf(fromEntity, null).join(',') === ENTITY_IDS.hvacDuct,
      ),
    );
    const engineer = AGENTS.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
    const fromAgent = engineer === undefined ? null : crossHighlightFromAgent(engineer);
    steps.push(
      step(
        'cj04-5-agent-rides-channel',
        'crossHighlightFromAgent (agent current-work)',
        'inspecting an agent cross-highlights its current-work element + the element BOQ line (the same channel)',
        `source=${fromAgent?.source} entities=${fromAgent?.entityIds.join(',')} lines=${fromAgent?.lineIds.join(',')}`,
        fromAgent !== null &&
          fromAgent.source === 'agent' &&
          fromAgent.entityIds.join(',') === ENTITY_IDS.column04 &&
          fromAgent.lineIds.join(',') === (boqLineOf(ENTITY_IDS.column04)?.lineId ?? ''),
      ),
    );
    records.push(
      record('CJ04', 'BOQ ↔ world bidirectional cross-selection (persistent one identity)', {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected:
          'BOQ line → world entity and world entity → BOQ line resolve the SAME identity (1:1 over the baseline); the cross-highlight persists across view modes; agent current-work rides the same channel',
        observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
        actions: [
          'select the duct BOQ line (BOQ → world)',
          'select the duct world entity (world → BOQ)',
          'verify the 1:1 identity map over every baseline entity',
          'verify the persistent value semantics',
          'inspect the structural engineer (agent → current work)',
        ],
      }),
    );
  }

  // -------------------------------------------------------------------------
  // CJ05 — timeline scrubbing alters the presented world.
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const scrubbed = await runtime.scrubTimeline(6_000);
      const atStructure = runtime.viewModel().timeline.positionAtMs;
      steps.push(
        step(
          'cj05-1-scrub-structure',
          'scrubTimeline (the typed timeline transport)',
          'scrubbing to the structure phase advances the presented position + active phase',
          `ok=${scrubbed.ok && scrubbed.value} position=${atStructure} phase=${phaseAt(atStructure).phaseId}`,
          scrubbed.ok === true &&
            scrubbed.value === true &&
            atStructure === 6_000 &&
            phaseAt(atStructure).phaseId === 'phase-structure',
        ),
      );
      const structureMetrics = solutionMetrics('variant-current', atStructure);
      const expectedBuilt = presentedEntities('variant-current').filter(
        (entity) =>
          entity.geometry.phase === 'phase-site' ||
          entity.geometry.phase === 'phase-excavation' ||
          entity.geometry.phase === 'phase-foundation' ||
          entity.geometry.phase === 'phase-structure',
      ).length;
      steps.push(
        step(
          'cj05-2-built-grows',
          'solutionMetrics (the phase-gated built count)',
          'the world visibly changes: the built count covers the phases completed so far (future work unbuilt)',
          `built=${structureMetrics.builtEntityCount}/${expectedBuilt} mepBuilt=${structureMetrics.builtEntityCount >= 34}`,
          structureMetrics.builtEntityCount === expectedBuilt && expectedBuilt === 14,
        ),
      );
      await runtime.scrubTimeline(16_000);
      const endMetrics = solutionMetrics('variant-current', 16_000);
      steps.push(
        step(
          'cj05-3-scrub-end',
          'scrubTimeline to the track end',
          'at the track end every entity is built (the finishes phase)',
          `phase=${endMetrics.phaseId} built=${endMetrics.builtEntityCount}`,
          endMetrics.phaseId === 'phase-finishes' && endMetrics.builtEntityCount === 34,
        ),
      );
      steps.push(
        step(
          'cj05-4-fixture-frozen',
          'the frozen scene object',
          'the FROZEN fixture timeline is never mutated by the scrub',
          `fixturePosition=${FIXTURE.scene.timeline.position.atMs}`,
          FIXTURE.scene.timeline.position.atMs === 2_000,
        ),
      );
      records.push(
        record('CJ05', 'Timeline scrubbing alters the presented world', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'the programme timeline scrubs through the typed transport: the active phase advances, the phase-gated built count grows (14 at structure → 34 at the end), and the frozen fixture is never mutated',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'scrub to the structure phase',
            'read the phase-gated metrics',
            'scrub to the track end',
            'verify the frozen fixture timeline',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ06 — variant switching changes the world representation.
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const digestBefore = runtime.currentScene().digest;
      const branched = await runtime.invokeControl(CONTROL_IDS.branch, {
        branchAtMs: SOLUTION_BRANCH_PHASE.atMs,
      });
      const branchEffect = runtime.viewModel().effects.find(
        (entry) => entry.effect.effect === 'branch-requested',
      );
      steps.push(
        step(
          'cj06-1-typed-branch',
          'invokeControl (the typed branch intent at the fixture branch point)',
          'selecting a variant issues the branch request effect at the branch point',
          `ok=${branched.ok} effect=${branchEffect?.effect.effect ?? 'none'} atMs=${branchEffect === undefined ? 'n/a' : String((branchEffect.effect as { atMs?: number }).atMs)}`,
          branched.ok === true && branchEffect !== undefined,
        ),
      );
      steps.push(
        step(
          'cj06-2-canonical-intact',
          'currentScene().digest',
          'the canonical world is NOT mutated (a variant is a proposed branch, not an applied one)',
          `digest=${runtime.currentScene().digest.slice(0, 12)}… unchanged=${runtime.currentScene().digest === digestBefore}`,
          runtime.currentScene().digest === digestBefore,
        ),
      );
      const altA = presentedEntities('variant-alt-a');
      const conduit = altA.find((entity) => entity.geometry.entityId === ENTITY_IDS.legacyConduit);
      const duct = altA.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacDuct);
      const altASummary = variantDeltaSummary('variant-alt-a');
      steps.push(
        step(
          'cj06-3-alt-a-world',
          'presentedEntities (Alt A)',
          'Alt A CHANGES THE WORLD: the legacy conduit is removed, the duct rerouted (+0.5m Z, +1.0m run)',
          `conduit=${conduit?.state} duct=${duct?.state} bboxX=${duct?.geometry.bbox[0]} dz=${duct?.geometry.position[2]} deltas=${altASummary.changed}c/${altASummary.removed}r/${altASummary.added}a`,
          conduit?.state === 'removed' &&
            duct?.state === 'changed' &&
            duct?.geometry.bbox[0] === 5 &&
            duct?.geometry.position[2] === 0.5 &&
            altASummary.changed === 2 &&
            altASummary.removed === 1 &&
            altASummary.added === 0,
        ),
      );
      const altB = presentedEntities('variant-alt-b');
      const ahu = altB.find((entity) => entity.geometry.entityId === 'cs-mep-hvac-ahu-interior');
      const unit = altB.find((entity) => entity.geometry.entityId === ENTITY_IDS.hvacUnit);
      steps.push(
        step(
          'cj06-4-alt-b-world',
          'presentedEntities (Alt B)',
          'Alt B adds the interior AHU (35 entities) and downsizes the roof unit',
          `count=${altB.length} ahu=${ahu?.state}@${ahu?.geometry.layer} unit=${unit?.state} bboxX=${unit?.geometry.bbox[0]}`,
          altB.length === 35 &&
            ahu?.state === 'added' &&
            ahu?.geometry.layer === 'lyr-mep' &&
            unit?.state === 'changed' &&
            unit !== null &&
            Math.abs(unit.geometry.bbox[0] - 0.6) < 1e-9,
        ),
      );
      const altAMetrics = solutionMetrics('variant-alt-a', SOLUTION_BRANCH_PHASE.atMs);
      const currentMetrics = solutionMetrics('variant-current', SOLUTION_BRANCH_PHASE.atMs);
      steps.push(
        step(
          'cj06-5-cost-days-risk',
          'solutionMetrics (the variant comparison)',
          'each variant presents its frozen cost/days/risk (Current 41000/60/medium, Alt A 43000/58/low)',
          `current=${currentMetrics.cost.total}/${currentMetrics.days}/${currentMetrics.risk} altA=${altAMetrics.cost.total}/${altAMetrics.days}/${altAMetrics.risk}`,
          currentMetrics.cost.total === '41000.00' &&
            currentMetrics.days === 60 &&
            currentMetrics.risk === 'medium' &&
            altAMetrics.cost.total === '43000.00' &&
            altAMetrics.days === 58 &&
            altAMetrics.risk === 'low',
        ),
      );
      records.push(
        record('CJ06', 'Variant switching changes the world representation', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'Current/Alt A/Alt B each re-present the world through their fixture deltas (removals, reroutes, additions) while the canonical digest stays intact; cost/days/risk present per variant',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'issue the typed branch intent at the programme branch point',
            'verify the canonical digest is unchanged',
            'present Alt A (the reroute + removal)',
            'present Alt B (the added interior AHU)',
            'read the variant cost/days/risk metrics',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ07 — agents visible + current-work highlight.
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const agents = runtime.viewModel().viewport.agents;
      steps.push(
        step(
          'cj07-1-two-agents-visible',
          'the viewport agents',
          '≥2 agents are visible in the world (the fixture agent set)',
          `agents=${agents.map((agent) => agent.agentId).join(',')}`,
          agents.length === 2 &&
            agents.map((agent) => agent.agentId).sort().join(',') ===
              [AGENT_IDS.structuralEngineer, AGENT_IDS.siteCoordinator].sort().join(','),
        ),
      );
      const followed = await runtime.followAgent(AGENT_IDS.structuralEngineer);
      steps.push(
        step(
          'cj07-2-follow',
          'followAgent (the typed follow intent)',
          'following the structural engineer sets the canonical followed agent',
          `ok=${followed.ok && followed.value} followed=${runtime.viewModel().viewport.followedAgentId}`,
          followed.ok === true &&
            followed.value === true &&
            runtime.viewModel().viewport.followedAgentId === AGENT_IDS.structuralEngineer,
        ),
      );
      const engineer = AGENTS.find((agent) => agent.agentId === AGENT_IDS.structuralEngineer);
      const reverse = agentsWorkingOn(ENTITY_IDS.column04).map((agent) => agent.agentId);
      steps.push(
        step(
          'cj07-3-current-work',
          'crossHighlightFromAgent + agentsWorkingOn',
          'the agent current-work highlight lands the engineer\'s element (COL-04); the reverse lookup finds the engineer on it',
          `work=${engineer?.currentWorkEntityId} reverse=${reverse.join(',')}`,
          engineer?.currentWorkEntityId === ENTITY_IDS.column04 &&
            reverse.join(',') === AGENT_IDS.structuralEngineer,
        ),
      );
      const merged = highlightEntityIdsOf(
        crossHighlightFromEntity(ENTITY_IDS.hvacDuct),
        engineer ?? null,
      );
      steps.push(
        step(
          'cj07-4-highlight-merge',
          'highlightEntityIdsOf (the viewport highlight set)',
          'the cross-highlight + the inspected agent current-work merge into ONE viewport highlight set (regardless of the view mode)',
          `set=${[...merged].sort().join(',')}`,
          [...merged].sort().join(',') ===
            [ENTITY_IDS.column04, ENTITY_IDS.hvacDuct].sort().join(','),
        ),
      );
      const atStart = engineer === undefined ? null : agentPositionAt(engineer, 0);
      const midway = engineer === undefined ? null : agentPositionAt(engineer, 1_000);
      steps.push(
        step(
          'cj07-5-movement-script',
          'agentPositionAt (the deterministic movement script)',
          'the agents move along their deterministic fixture scripts (waypoint at t=0, midway at t=1s)',
          `t0=${atStart?.join(',')} t1s=${midway?.join(',')}`,
          atStart !== null &&
            midway !== null &&
            atStart.join(',') === '-4,0,-3' &&
            Math.abs(midway[0]) < 1e-6 &&
            midway[2] === -3,
        ),
      );
      records.push(
        record('CJ07', 'Agents visible + current-work highlight', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'two agents present in the world with deterministic movement scripts; follow is typed; the current-work element highlights through the cross-channel and merges with any BOQ/world cross-selection',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'read the visible agents',
            'follow the structural engineer',
            'inspect the current-work highlight + reverse lookup',
            'merge the highlight sets',
            'interpolate the movement script',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ08 — plan + section cut interaction.
  // -------------------------------------------------------------------------
  {
    const steps: JourneyStepRecord[] = [];
    const presented = presentedEntities('variant-current');
    const projector = planProjectorFor(presented);
    const column = presented.find(
      (entity) => entity.geometry.entityId === ENTITY_IDS.column01,
    );
    const planHit =
      column === undefined
        ? null
        : planEntityAt(presented, projector, {
            x: projector.px(column.geometry.position[0] ?? 0),
            y: projector.py(column.geometry.position[2] ?? 0),
          });
    steps.push(
      step(
        'cj08-1-plan-topdown',
        'planProjectorFor + planEntityAt (the true top-down plan)',
        'the plan spans the lot and hit-tests the presented footprints (smallest-first)',
        `span=${(projector.bounds.maxX - projector.bounds.minX).toFixed(1)}x${(projector.bounds.maxY - projector.bounds.minY).toFixed(1)}m hit=${planHit?.geometry.entityId ?? 'none'}`,
        projector.bounds.maxX - projector.bounds.minX > 20 &&
          projector.bounds.maxY - projector.bounds.minY > 12 &&
          planHit?.geometry.entityId === ENTITY_IDS.column01 &&
          planEntityAt(presented, projector, { x: 2, y: 2 }) === null,
      ),
    );
    const sectionIds = sectionEntitiesOf(presented).map((entity) => entity.geometry.entityId);
    steps.push(
      step(
        'cj08-2-section-default',
        'sectionEntitiesOf (the default cutaway)',
        'the default section cut exposes the internal MEP systems (not the columns)',
        `cut=${SECTION_CUT_X} duct=${sectionIds.includes(ENTITY_IDS.hvacDuct)} conduit=${sectionIds.includes(ENTITY_IDS.legacyConduit)} column01=${sectionIds.includes(ENTITY_IDS.column01)}`,
        sectionIds.includes(ENTITY_IDS.hvacDuct) &&
          sectionIds.includes(ENTITY_IDS.legacyConduit) &&
          sectionIds.includes(ENTITY_IDS.plumbingRiser) &&
          !sectionIds.includes(ENTITY_IDS.column01),
      ),
    );
    const westIds = sectionEntitiesOf(presented, -4).map((entity) => entity.geometry.entityId);
    const westProjector = sectionProjectorFor(presented, -4);
    const westHit = sectionEntityAt(
      presented,
      westProjector,
      { x: westProjector.px(-3.12), y: westProjector.py(1.5) },
      -4,
    );
    steps.push(
      step(
        'cj08-3-section-moved',
        'sectionEntitiesOf at the moved cut (the cut-plane interaction)',
        'moving the cut to the west column line exposes the columns instead of the MEP run',
        `column01=${westIds.includes(ENTITY_IDS.column01)} slab=${westIds.includes(ENTITY_IDS.groundSlab)} duct=${westIds.includes(ENTITY_IDS.hvacDuct)} hit=${westHit?.geometry.entityId ?? 'none'}`,
        westIds.includes(ENTITY_IDS.column01) &&
          westIds.includes(ENTITY_IDS.groundSlab) &&
          !westIds.includes(ENTITY_IDS.hvacDuct) &&
          westHit?.geometry.entityId === ENTITY_IDS.column01,
      ),
    );
    const range = sectionCutRangeOf(presented);
    const cutLine = planCutLineOf(projector, -4);
    steps.push(
      step(
        'cj08-4-cut-state',
        'clampSectionCut + planCutLineOf (ONE cut state)',
        'cut adjustments snap (0.25m) + clamp to the building range; the plan A–A line and the section re-project from the SAME cut',
        `snap=${clampSectionCut(1.13, range)} clampMin=${clampSectionCut(-99, range) === range.minX} clampMax=${clampSectionCut(99, range) === range.maxX} cutLineX=${cutLine.cutX} xPx=${cutLine.xPx === projector.px(-4)}`,
        clampSectionCut(1.13, range) === 1.25 &&
          clampSectionCut(-99, range) === range.minX &&
          clampSectionCut(99, range) === range.maxX &&
          cutLine.cutX === -4 &&
          cutLine.xPx === projector.px(-4),
      ),
    );
    records.push(
      record('CJ08', 'Plan + section cut interaction', {
        steps,
        pass: steps.every((entry) => entry.result === 'pass'),
        expected:
          'the true top-down plan hit-tests its footprints; the default section cut exposes the internal MEP systems; moving the cut re-projects the section (columns at the west line); ONE cut state drives the plan A–A line and the section together',
        observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
        actions: [
          'project the top-down plan + hit-test a column footprint',
          'read the default section cut (the MEP clash zone)',
          'move the cut to the west column line + hit-test',
          'verify the snap/clamp + the shared cut state',
        ],
      }),
    );
  }

  // -------------------------------------------------------------------------
  // CJ09 — measure + annotate (the typed overlay flows).
  // -------------------------------------------------------------------------
  {
    const { runtime, three } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      // The documented stateful two-click measurement affordance over the
      // REAL adapter (the same dance the desktop battery proves): anchor,
      // arm, ORBIT to a viewpoint where both columns project unoccluded
      // (navigation is EPHEMERAL — one canonical re-present advances the
      // presentation camera), re-anchor, complete.
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
      const overlay = runtime
        .viewModel()
        .viewport.overlays.find((overlayEntry) => overlayEntry.overlayKind === 'measurement');
      steps.push(
        step(
          'cj09-1-measure',
          'the two-click measurement (the typed measure intent)',
          'measuring the column-to-column span applies the fixture-declared overlay',
          `ok=${measured.ok} intent=${measured.ok ? (measured.value.receipt.intent?.id ?? 'none') : 'n/a'} overlay=${overlay?.overlayId}`,
          measured.ok === true &&
            measured.value.receipt.intent?.id === 'epoch.world.interaction.measure' &&
            overlay?.overlayId === OVERLAY_IDS.structureSpan &&
            new Set([overlay?.fromEntityId, overlay?.toEntityId]).size === 2 &&
            new Set([overlay?.fromEntityId, overlay?.toEntityId]).has(ENTITY_IDS.column01) &&
            new Set([overlay?.fromEntityId, overlay?.toEntityId]).has(ENTITY_IDS.column02),
        ),
      );
      const annotated = await runtime.composeAnnotation(
        'Journey note: verify AAC coursing before the MEP first-fix',
      );
      const annotationOverlay = runtime
        .viewModel()
        .viewport.overlays.some((overlayEntry) => overlayEntry.overlayKind === 'annotation');
      steps.push(
        step(
          'cj09-2-annotate',
          'composeAnnotation (the typed annotate intent)',
          'annotating composes the annotation overlay on the selected entity',
          `ok=${annotated.ok && annotated.value} annotation=${annotationOverlay}`,
          annotated.ok === true && annotated.value === true && annotationOverlay,
        ),
      );
      steps.push(
        step(
          'cj09-3-fixture-frozen',
          'the frozen scene object',
          'the FROZEN fixture focus + timeline are never mutated by the overlays',
          `focus=${FIXTURE.scene.focusedEntityIds.join(',')} timeline=${FIXTURE.scene.timeline.position.atMs}`,
          FIXTURE.scene.focusedEntityIds.join(',') === ENTITY_IDS.column04 &&
            FIXTURE.scene.timeline.position.atMs === 2_000,
        ),
      );
      records.push(
        record('CJ09', 'Measure + annotate (the typed overlay flows)', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'the stateful two-click measurement applies the fixture-declared span overlay (COL-01 ↔ COL-02) through the typed measure intent; annotation composes through the typed annotate intent; the frozen fixture is never mutated',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'arm the measure tool + anchor the adapter measurement',
            'orbit to an unoccluded viewpoint + re-present',
            'complete the measurement (the declared overlay applies)',
            'compose an annotation',
            'verify the frozen fixture',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ10 — constraints incl. the MEP clash discovery.
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const current = presentedConstraints('variant-current');
      const altB = presentedConstraints('variant-alt-b');
      steps.push(
        step(
          'cj10-1-findings-presented',
          'presentedConstraints (the findings surface)',
          'the fixture findings present (6) plus the variant-level notes (Current 2, Alt B 3)',
          `current=${current.length} variantNotes=${current.filter((c) => c.variantNote).length} altB=${altB.length}`,
          current.length === 8 &&
            current.filter((c) => c.variantNote).length === 2 &&
            altB.length === 9,
        ),
      );
      const clashEntities = MEP_CLASH_FINDING.entityIds;
      const clashFocus = crossHighlightFromConstraint(clashEntities);
      steps.push(
        step(
          'cj10-2-clash-focus',
          'crossHighlightFromConstraint (finding → spatial focus)',
          'selecting the MEP clash finding focuses its three elements + their BOQ lines in the world',
          `entities=${clashFocus.entityIds.length} lines=${clashFocus.lineIds.length} source=${clashFocus.source}`,
          clashFocus.source === 'constraint' &&
            clashFocus.entityIds.length === 3 &&
            clashFocus.lineIds.length === 3 &&
            clashEntities.length === 3,
        ),
      );
      // The hidden-owning-layer reveal: under structure isolation NONE of
      // the clash entities is visible — the workspace's constraint-focus
      // flow reveals the owning MEP layer through the typed show intent.
      await runtime.isolateLayer('lyr-structure');
      const isolatedView = runtime.viewModel();
      const visibleIds = new Set(
        isolatedView.viewport.entities.filter((entity) => entity.visible).map((entity) => entity.entityId),
      );
      const noneVisible = clashEntities.every((entityId) => !visibleIds.has(entityId));
      const owningLayer = runtime
        .layers()
        .find((layer) => clashEntities.some((entityId) => layer.entityIds.includes(entityId)));
      if (owningLayer !== undefined) {
        await runtime.toggleLayer(owningLayer.layerId);
      }
      const revealedView = runtime.viewModel();
      const revealedVisible = clashEntities.every((entityId) =>
        revealedView.viewport.entities.find((entity) => entity.entityId === entityId)?.visible,
      );
      steps.push(
        step(
          'cj10-3-hidden-reveal',
          'the constraint-focus reveal (the typed show intent)',
          'when none of the finding\'s elements is visible, revealing the owning layer makes them findable IN the world (the hidden legacy conduit included)',
          `noneVisible=${noneVisible} owning=${owningLayer?.layerId ?? 'n/a'} revealed=${revealedVisible}`,
          noneVisible && owningLayer?.layerId === 'lyr-mep' && revealedVisible,
        ),
      );
      const clashCurrent = presentedConstraints('variant-current').find(
        (constraint) => constraint.record.constraintId === MEP_CLASH_FINDING.constraintId,
      );
      const clashAltA = presentedConstraints('variant-alt-a').find(
        (constraint) => constraint.record.constraintId === MEP_CLASH_FINDING.constraintId,
      );
      steps.push(
        step(
          'cj10-4-variant-resolution',
          'the clash resolution under the variants',
          'the MEP clash is unresolved in Current and RESOLVED by Alt A (the variant comparison solves the finding through the world)',
          `current=${clashCurrent?.resolvedByVariant} altA=${clashAltA?.resolvedByVariant}`,
          clashCurrent?.resolvedByVariant === false && clashAltA?.resolvedByVariant === true,
        ),
      );
      records.push(
        record('CJ10', 'Constraints incl. the MEP clash discovery', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'the findings surface presents every fixture finding + variant notes; selecting the MEP clash focuses its three elements; the hidden-owning-layer reveal makes the clash discoverable IN the world; Alt A resolves it',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'read the findings surface (Current + Alt B)',
            'select the MEP clash finding (spatial focus)',
            'reveal the hidden owning layer through the typed show intent',
            'compare the clash resolution across the variants',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  // -------------------------------------------------------------------------
  // CJ11 — the programme-simulation affordance (the typed simulate control).
  // -------------------------------------------------------------------------
  {
    const { runtime } = await openConstructionWorld();
    const steps: JourneyStepRecord[] = [];
    try {
      const declared = FIXTURE.sceneContent.controls.find(
        (control) => control.controlId === CONTROL_IDS.simulate,
      );
      steps.push(
        step(
          'cj11-1-affordance-projection',
          'SOLUTION_SIMULATE_CONTROL (the surfaced affordance)',
          'the variants-area affordance is EXACTLY the fixture-declared control (id + label + intent — a projection, no new semantics)',
          `controlId=${SOLUTION_SIMULATE_CONTROL.controlId} label="${SOLUTION_SIMULATE_CONTROL.label}" intent=${SOLUTION_SIMULATE_CONTROL.intentId}`,
          SOLUTION_SIMULATE_CONTROL.controlId === CONTROL_IDS.simulate &&
            SOLUTION_SIMULATE_CONTROL.label === declared?.label &&
            SOLUTION_SIMULATE_CONTROL.intentId === 'epoch.world.interaction.simulate',
        ),
      );
      const digestBefore = runtime.currentScene().digest;
      const simulated = await runtime.invokeControl(CONTROL_IDS.simulate, {
        scenarioRef: FIXTURE.projectId,
      });
      steps.push(
        step(
          'cj11-2-typed-invoke',
          'invokeControl (the workspace button channel)',
          'the simulate control invokes through the typed control path (the same channel the inspector button issues)',
          `ok=${simulated.ok} applied=${simulated.ok ? simulated.value : 'n/a'}`,
          simulated.ok === true,
        ),
      );
      const simulateEffect = runtime.viewModel().effects.find(
        (entry) => entry.effect.effect === 'simulate-requested',
      );
      const scenarioRef =
        simulateEffect === undefined
          ? null
          : (simulateEffect.effect as { scenarioRef?: string | undefined }).scenarioRef ?? null;
      steps.push(
        step(
          'cj11-3-effect-receipt',
          'the simulate-requested effect',
          'the typed effect records the programme scenario reference (the receipt the affordance renders)',
          `effect=${simulateEffect === undefined ? 'none' : simulateEffect.effect.effect} scenario=${scenarioRef}`,
          simulateEffect !== undefined && scenarioRef === FIXTURE.projectId,
        ),
      );
      const journaled = runtime
        .viewModel()
        .journal.some((entry) => entry.controlIntentId === 'epoch.world.interaction.simulate');
      steps.push(
        step(
          'cj11-4-effect-only',
          'the canonical world + journal',
          'simulate is EFFECT-ONLY: the canonical digest is unchanged and the journal carries the typed control intent',
          `digestUnchanged=${runtime.currentScene().digest === digestBefore} journaled=${journaled}`,
          runtime.currentScene().digest === digestBefore && journaled,
        ),
      );
      records.push(
        record('CJ11', 'The programme-simulation affordance (the typed simulate control)', {
          steps,
          pass: steps.every((entry) => entry.result === 'pass'),
          expected:
            'the variants/compare area surfaces the fixture-declared simulate control; invoking it through the typed channel records the simulate-requested effect with the programme scenario reference while the canonical world stays intact',
          observed: steps.map((entry) => `${entry.stepId}=${entry.result}`).join(', '),
          actions: [
            'read the surfaced affordance (the fixture-declared control)',
            'invoke the typed simulate control (the workspace button channel)',
            'read the simulate-requested effect receipt',
            'verify the canonical digest + journal',
          ],
        }),
      );
    } finally {
      await runtime.close();
    }
  }

  return records;
}

describe('the desktop construction solution journey set (W073 deliverable 13)', () => {
  it('executes CJ01-CJ11 with every step passing', async () => {
    const records = await runConstructionJourneySet();
    ALL_RECORDS.push(...records);

    // The complete construction journey set is present.
    const journeyIds = records.map((entry) => entry.journeyId);
    expect(journeyIds.sort()).toEqual([
      'CJ01',
      'CJ02',
      'CJ03',
      'CJ04',
      'CJ05',
      'CJ06',
      'CJ07',
      'CJ08',
      'CJ09',
      'CJ10',
      'CJ11',
    ]);

    // Every journey passed overall.
    for (const entry of records) {
      expect(`${entry.journeyId}: ${entry.overall}`).toBe(`${entry.journeyId}: pass`);
      expect(entry.disposition.startsWith('PASS (')).toBe(true);
      // And every step within it.
      const failedSteps = entry.steps.filter((stepEntry) => stepEntry.result !== 'pass');
      expect(failedSteps.map((stepEntry) => `${stepEntry.stepId}: ${stepEntry.observed}`)).toEqual(
        [],
      );
    }

    // The journey-record field contract (spec/journey-validation.md).
    for (const entry of records) {
      expect(entry.platform).toBe('linux');
      expect(entry.persona).toMatch(/delivery lead/);
      expect(entry.productVersion).toBe('1.0.0');
      expect(entry.fixtureId).toBe(`epoch-construction-world-fixture-v${FIXTURE.version}`);
      expect(entry.actions.length).toBeGreaterThan(0);
      expect(entry.expectedOutcome.length).toBeGreaterThan(0);
      expect(entry.evidence.length).toBeGreaterThan(0);
      expect(entry.regressionTest).toContain('construction-journeys.test.ts');
      // The honest environment record: the native toolchain gap is carried
      // in every record (never a packaged-binary claim).
      expect(entry.environment).toContain('cargo/rustc/webkit2gtk-4.1 ABSENT');
    }
  });
});

describe('the construction journey record emission (W073 evidence)', () => {
  it('emits the committed records when EPOCH_EMIT_JOURNEY_RECORDS is set', () => {
    if (process.env['EPOCH_EMIT_JOURNEY_RECORDS'] === undefined) {
      return; // CI mode: assertions only, no file writes.
    }
    expect(ALL_RECORDS.length).toBe(11);
    const outDir = path.join(here, 'records');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, 'construction-journey-records.json'),
      `${JSON.stringify(
        {
          description:
            'W073 desktop construction solution journey records (headless product-logic runs over the construction solution composition — the frozen W071 fixture behind the REAL runtime + engines)',
          records: ALL_RECORDS,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  });
});
