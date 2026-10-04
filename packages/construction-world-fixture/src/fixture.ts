/**
 * @epoch/construction-world-fixture — the deterministic factory
 * (W071, ACR-012 §9 — `createConstructionSolutionFixture()`).
 *
 * The factory composes the COMPLETE construction-solution world from the
 * frozen constants: the canonical W016 WorldScene (admitted + sealed
 * through the REAL world-experience admission — never a parallel store),
 * the renderer-neutral geometry, the six construction layers, the phase
 * timeline (reusing the EXISTING W016 marker vocabulary), the spatial
 * agents, the three solution variants, the per-layer BOQ rollups, and the
 * constraint/finding records.
 *
 * The renderer registrations follow the W061 pattern (real Three.js +
 * Babylon.js + reference fallback via the real RendererFabric). The
 * headless default constructs the real adapters with their deterministic
 * cores (Three.js without a GL surface; Babylon.js over the NullEngine
 * host) — the same composition the conformance batteries prove.
 *
 * Determinism: fixed seeds, no network, no wall-clock, no randomness.
 * Same inputs -> identical digests every run.
 */
import { sealCapabilityManifest } from '@epoch/capability-registry';
import { BABYLONJS_RENDERER_ID, BabylonRendererAdapter, nullEngineHost } from '@epoch/adapter-renderer-babylonjs';
import { THREE_RENDERER_ID, ThreeJsRendererAdapter } from '@epoch/adapter-renderer-threejs';
import {
  ReferenceRendererAdapter,
  RendererFabric,
  rendererCapabilityManifestOf,
  type RendererAdapter,
} from '@epoch/renderer-fabric';
import type {
  DeviceSessionSnapshot,
  RendererCapabilitySet,
  RendererDescriptor,
} from '@epoch/renderer-runtime';
import {
  admitWorldScene,
  sealWorldSceneContent,
  type WorldScene,
  type WorldSceneContent,
  type WorldOntologyRecordId,
} from '@epoch/world-experience';

import {
  CONSTRUCTION_WORLD_FIXTURE_VERSION,
  CONSTRUCTION_WORLD_FIXTURE_PROTOCOL_VERSION,
  TENANT,
  SCENE_ID,
  PROJECT_ID,
  ENTITY_IDS,
  OVERLAY_IDS,
  CONTROL_IDS,
  MARKER_IDS,
  BRANCH_AT_MS,
  TRACK,
  type ConstructionGeometryPrimitive,
} from './version';
import { digestOf, FIXTURE_DIGEST } from './digest';
import { ONTOLOGY } from './ontology';
import { ENTITY_GEOMETRY, ENTITY_PROJECTIONS } from './entities';
import { LAYERS } from './layers';
import { PHASES, BRANCH_PHASE } from './timeline';
import { AGENTS } from './agents';
import { VARIANTS } from './variants';
import { BOQ_LAYER_ROLLUPS, BOQ_LINE_ITEMS, BOQ_GRAND_TOTAL } from './boq';
import { CONSTRAINTS, MEP_CLASH_FINDING } from './constraints';
import type {
  ConstructionEntityGeometry,
  ConstructionEntityProjection,
  ConstructionLayer,
  ConstructionAgent,
  ConstructionSolutionVariant,
  ConstructionBoqLayerRollup,
  ConstructionBoqLineItem,
  ConstructionConstraintRecord,
} from './types';

// ---------------------------------------------------------------------------
// The renderer-neutral geometry -> ontology record id (per primitive).
// ---------------------------------------------------------------------------

const REPRESENTATION_RECORD_OF: Record<ConstructionGeometryPrimitive, WorldOntologyRecordId> = {
  box: 'ont-cs-rep-box' as unknown as WorldOntologyRecordId,
  cylinder: 'ont-cs-rep-cylinder' as unknown as WorldOntologyRecordId,
  plane: 'ont-cs-rep-plane' as unknown as WorldOntologyRecordId,
};

// ---------------------------------------------------------------------------
// The canonical WorldSceneContent (the W016 admission input).
// ---------------------------------------------------------------------------

const SCENE_CONTENT: WorldSceneContent = {
  schema: 'epoch.world-scene',
  protocolVersion: CONSTRUCTION_WORLD_FIXTURE_PROTOCOL_VERSION,
  sceneId: SCENE_ID,
  tenantScope: { tenantId: TENANT, projectId: PROJECT_ID },
  name: 'Construction solution — Pioneer Block-A',
  entities: ENTITY_GEOMETRY.map((g) => {
    const projection = ENTITY_PROJECTIONS.find((p) => p.entityId === g.entityId);
    if (!projection) {
      throw new Error(`construction fixture: missing projection for ${g.entityId}`);
    }
    return {
      entityId: g.entityId,
      contentDigest: digestOf(`${g.entityId}@1`),
      entityType: projection.entityType,
      representationRecordId: REPRESENTATION_RECORD_OF[g.primitive],
      label: projection.label,
      position: g.position,
      visible: g.visibleByDefault,
      isolated: false,
    };
    // The map preserves source order; the W016 admission requires the
    // entities sorted by entityId ascending — sort at the array literal
    // level (the W016 deterministic-serialization invariant; the W061
    // fixture pre-sorts authorially — this fixture sorts post-map for
    // maintainability).
  }).sort((a, b) => (a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0)),
  focusedEntityIds: [ENTITY_IDS.column04],
  overlays: [
    {
      overlayId: OVERLAY_IDS.mepClash,
      overlayKind: 'highlight',
      entityId: ENTITY_IDS.legacyConduit,
      color: '#b91c1c',
    },
    {
      overlayId: OVERLAY_IDS.structureSpan,
      overlayKind: 'measurement',
      fromEntityId: ENTITY_IDS.column01,
      toEntityId: ENTITY_IDS.column02,
      label: 'Beam span B1',
    },
    {
      overlayId: OVERLAY_IDS.groundSlabState,
      overlayKind: 'state',
      entityId: ENTITY_IDS.groundSlab,
      stateKey: 'pour-cured',
      tint: '#15803d',
      badgeLabel: 'cured',
    },
  ],
  appliedOverlays: [{ overlayId: OVERLAY_IDS.groundSlabState, orderIndex: 0 }],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: MARKER_IDS.site, atMs: 0, label: 'Site establishment', markerKind: 'event' },
      { markerId: MARKER_IDS.excavation, atMs: 2_000, label: 'Excavation complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.foundation, atMs: 4_000, label: 'Foundation complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.structure, atMs: 6_000, label: 'Structure complete', markerKind: 'phase-end' },
      // Two markers at the same atMs (8000) must be sorted by markerId
      // ascending ('mrk-cs-branch-solution' < 'mrk-cs-phase-walls' — the
      // W016 lexicographic `${atMs}\0${markerId}` ordering; the W061
      // ledger item about mixed-width times is satisfied by the uniform
      // four-digit atMs values).
      { markerId: MARKER_IDS.branch, atMs: BRANCH_AT_MS, label: 'Solution branch point', markerKind: 'branch-point' },
      { markerId: MARKER_IDS.walls, atMs: BRANCH_AT_MS, label: 'Walls complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.roof, atMs: 10_000, label: 'Roof complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.mep, atMs: 12_000, label: 'MEP complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.finishes, atMs: 14_000, label: 'Finishes complete', markerKind: 'phase-end' },
    ],
    trackLabel: 'Construction programme replay',
    trackStartMs: TRACK.startMs,
    trackEndMs: TRACK.endMs,
    position: { atMs: TRACK.positionAtMs, frameIndex: 6, paused: false },
  },
  camera: { mode: 'orbit', position: [18, 12, 18], target: [0, 1.5, 0], fovRadians: Math.PI / 4 },
  participants: [],
  agents: AGENTS.map((a) => ({
    kind: 'agent' as const,
    tenantId: TENANT,
    agentId: a.agentId,
    contentDigest: digestOf(`${a.agentId}@1`),
  })).sort((a, b) => (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0)),
  evidenceReferences: [],
  controls: [
    {
      controlId: CONTROL_IDS.branch,
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.branch', version: '1.0.0' },
      label: 'Branch solution',
    },
    {
      controlId: CONTROL_IDS.pause,
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.pause', version: '1.0.0' },
      label: 'Pause replay',
    },
    {
      controlId: CONTROL_IDS.simulate,
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.simulate', version: '1.0.0' },
      label: 'Simulate programme',
    },
  ],
};

/** The sealed canonical construction-solution scene (the W016 admission). */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`construction fixture scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The sealed canonical scene content (re-exported for host evidence). */
export const SCENE_CONTENT_FROZEN: WorldSceneContent = SCENE_CONTENT;

// ---------------------------------------------------------------------------
// The device session the workspace binds (W013 desktop-class snapshot,
// the W061 pattern — frozen fixture value, deterministic).
// ---------------------------------------------------------------------------

export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-construction-solution-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
  },
};

// ---------------------------------------------------------------------------
// The renderers behind the seam: the REAL engines + the reference fallback
// (the W061 pattern — Three.js + Babylon.js + reference fallback via the
// real RendererFabric).
// ---------------------------------------------------------------------------

/** The renderer id of the contract-only reference fallback presenter. */
export const REFERENCE_RENDERER_ID = 'rr-construction-solution-reference';

const REFERENCE_DESCRIPTOR: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: REFERENCE_RENDERER_ID,
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
  budgets: { maxGraphNodes: 4_096, maxGraphEdges: 8_192, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
};

const REFERENCE_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: REFERENCE_RENDERER_ID,
  hitTesting: true,
  measurement: true,
  annotation: true,
  frameCapture: false,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none', 'reduced-fidelity', 'static-frame', 'wireframe'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['mesh'],
};

/** Register one renderer adapter with the fabric's REAL capability registry. */
function registerRenderer(
  fabric: RendererFabric,
  adapter: RendererAdapter,
  version = '1.0.0',
): void {
  const identity = adapter.identity();
  const manifest = rendererCapabilityManifestOf({
    capabilityId: identity.capabilityId,
    version,
    descriptor: adapter.descriptor(),
    capabilities: adapter.capabilities(),
    displayName: identity.displayName,
    description: identity.description,
  });
  const sealed = sealCapabilityManifest(manifest);
  if (!sealed.ok) {
    throw new Error(`construction fixture manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter,
  });
  if (!registered.ok) {
    throw new Error(`construction fixture renderer failed to register: ${registered.error.message}`);
  }
}

/** The construction inputs of the construction-solution fabric. */
export interface ConstructionWorldFabricOptions {
  /** The REAL Three.js adapter (the host injects the browser GL surface). */
  readonly three: ThreeJsRendererAdapter;
  /** The REAL Babylon.js adapter (the host injects the browser engine host). */
  readonly babylon: BabylonRendererAdapter;
}

/** The built fabric + its adapters (evidence helpers for hosts/tests). */
export interface ConstructionWorldFabric {
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
}

/**
 * Build the construction-solution fabric: the REAL Three.js and Babylon.js
 * renderers registered through the REAL capability registry (the same
 * adapters the W058/W059 conformance batteries prove), plus the
 * contract-only reference renderer as the final declared fallback of the
 * switching chain (the W061 pattern).
 */
export function buildWorldFabric(options: ConstructionWorldFabricOptions): ConstructionWorldFabric {
  const fabric = new RendererFabric();
  registerRenderer(fabric, options.three);
  registerRenderer(fabric, options.babylon);
  registerRenderer(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.construction-solution-reference',
        rendererId: REFERENCE_RENDERER_ID,
        displayName: 'Reference presenter (contract-only)',
        description:
          'The W071 contract-only reference presenter — the declared final fallback of the construction-solution host (no engine, no pixels).',
      },
      descriptor: REFERENCE_DESCRIPTOR,
      capabilities: REFERENCE_CAPABILITIES,
    }),
  );
  return { fabric, three: options.three, babylon: options.babylon };
}

/**
 * The HEADLESS construction default (tests, SSR-safe composition): the
 * real adapters with their deterministic cores — the Three.js adapter
 * without a GL surface factory and the Babylon.js adapter over the
 * NullEngine host (the W061 headless pattern).
 */
export function buildHeadlessWorldFabric(): ConstructionWorldFabric {
  return buildWorldFabric({
    three: new ThreeJsRendererAdapter(),
    babylon: new BabylonRendererAdapter({ host: nullEngineHost() }),
  });
}

/** The renderer preference/fallback chain (Three.js → Babylon.js → reference). */
export const RENDERER_PREFERENCE: readonly string[] = [
  THREE_RENDERER_ID,
  BABYLONJS_RENDERER_ID,
  REFERENCE_RENDERER_ID,
];

// ---------------------------------------------------------------------------
// The frozen public API: the deterministic factory + the composed fixture.
// ---------------------------------------------------------------------------

/**
 * The composed construction-solution fixture — the frozen public API
 * W072/W073 compile against. Every member is a frozen, deterministic,
 * content-addressed value the hosts consume as composition inputs.
 */
export interface ConstructionSolutionFixture {
  readonly version: typeof CONSTRUCTION_WORLD_FIXTURE_VERSION;
  readonly fixtureDigest: string;
  readonly tenant: typeof TENANT;
  readonly sceneId: typeof SCENE_ID;
  readonly projectId: typeof PROJECT_ID;
  /** The sealed canonical W016 WorldScene (admitted + sealed through the
   * REAL world-experience admission). */
  readonly scene: WorldScene;
  /** The sealed canonical scene content (re-exported for host evidence). */
  readonly sceneContent: WorldSceneContent;
  /** The desktop-class device session the workspace binds (W013 snapshot). */
  readonly device: DeviceSessionSnapshot;
  /** The pack-contributed W016 ontology (the representation-3d records). */
  readonly ontology: typeof ONTOLOGY;
  /** The renderer-neutral geometry (per entity). */
  readonly entityGeometry: readonly ConstructionEntityGeometry[];
  /** The engineering projection (per entity — ACR-012 §4 fields). */
  readonly entityProjections: readonly ConstructionEntityProjection[];
  /** The six canonical construction layers (layer-navigator data). */
  readonly layers: readonly ConstructionLayer[];
  /** The eight construction phases + the branch-point phase (timeline). */
  readonly phases: readonly (typeof PHASES)[number][];
  /** The branch-point phase (where Current/Alt A/Alt B fork). */
  readonly branchPhase: typeof BRANCH_PHASE;
  /** The spatial construction agents (≥2). */
  readonly agents: readonly ConstructionAgent[];
  /** The three solution variants (Current/Alt A/Alt B). */
  readonly variants: readonly ConstructionSolutionVariant[];
  /** The per-layer BOQ rollups + line items + grand total. */
  readonly boqLayerRollups: readonly ConstructionBoqLayerRollup[];
  readonly boqLineItems: readonly ConstructionBoqLineItem[];
  readonly boqGrandTotal: { amount: string; currency: string };
  /** The constraint / finding records (≥5, incl. the MEP clash). */
  readonly constraints: readonly ConstructionConstraintRecord[];
  /** The hidden MEP clash finding (spatial-world acceptance evidence). */
  readonly mepClashFinding: ConstructionConstraintRecord;
  /** The renderer ids behind the seam, in the ordered preference/fallback chain. */
  readonly rendererPreference: readonly string[];
  /** The renderer id of the contract-only reference fallback presenter. */
  readonly referenceRendererId: string;
}

/**
 * The deterministic factory of the construction-solution fixture. Same
 * inputs -> identical fixture. Same fixture -> identical digests every
 * run. The factory is PURE — it composes the REAL @epoch/world-experience
 * WorldScene admission, the REAL @epoch/renderer-fabric seam, the frozen
 * @epoch/pack-construction + @epoch/solution-delivery shapes, and the
 * @epoch/capability-registry manifest sealing. NO new authority, NO
 * contract bumps.
 *
 * NOTE: the factory returns the FROZEN fixture object; the
 * `buildWorldFabric(options)` / `buildHeadlessWorldFabric()` functions
 * construct the REAL fabric separately (the W061 pattern — the fabric is
 * built by the host, not by the fixture; the fixture only declares the
 * renderer preference/fallback chain).
 */
export function createConstructionSolutionFixture(): ConstructionSolutionFixture {
  return {
    version: CONSTRUCTION_WORLD_FIXTURE_VERSION,
    fixtureDigest: FIXTURE_DIGEST,
    tenant: TENANT,
    sceneId: SCENE_ID,
    projectId: PROJECT_ID,
    scene: SCENE,
    sceneContent: SCENE_CONTENT,
    device: DEVICE,
    ontology: ONTOLOGY,
    entityGeometry: ENTITY_GEOMETRY,
    entityProjections: ENTITY_PROJECTIONS,
    layers: LAYERS,
    phases: PHASES,
    branchPhase: BRANCH_PHASE,
    agents: AGENTS,
    variants: VARIANTS,
    boqLayerRollups: BOQ_LAYER_ROLLUPS,
    boqLineItems: BOQ_LINE_ITEMS,
    boqGrandTotal: BOQ_GRAND_TOTAL,
    constraints: CONSTRAINTS,
    mepClashFinding: MEP_CLASH_FINDING,
    rendererPreference: RENDERER_PREFERENCE,
    referenceRendererId: REFERENCE_RENDERER_ID,
  };
}

/** The single frozen fixture instance (the canonical composition). */
export const FIXTURE: ConstructionSolutionFixture = createConstructionSolutionFixture();
