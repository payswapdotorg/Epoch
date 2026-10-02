/**
 * The WEB WORLD HOST FIXTURE (W061) — the canonical problem the `/world`
 * route presents: the Riverside plant-room riser coordination problem (the
 * same problem shape `qa/world-experience/world-fixture.ts` drives at
 * harness scale), composed through the REAL stack:
 *
 * - a canonical W016 `WorldScene` (admitted + sealed through the real W016
 *   admission) — seven entities across three semantic layers, one hidden
 *   clash-risk entity, a declared measurement overlay, a branch-point
 *   marker, two agents, and the branch/simulate/pause scene controls;
 * - the REAL `RendererFabric` with the REAL interactive renderers
 *   registered (W058 Three.js + W059 Babylon.js — the same adapters the
 *   conformance batteries prove) plus the contract-only reference renderer
 *   as the final declared fallback;
 * - the full-fidelity DESKTOP-class device snapshot (the W013 binding).
 *
 * Marker-time note (the W016 ledger item, W057 advisory 3): every marker
 * time of this fixture compares correctly under the lexicographic
 * `${atMs}\0${markerId}` ordering of the W016 admission (single-digit 0
 * sorts before every four-digit time); see docs/journeys/interactive-world.md
 * (defect ledger) for the recorded mixed-width defect.
 *
 * Deterministic: fixed virtual scripts produce identical evidence.
 */
import { sealCapabilityManifest } from '@epoch/capability-registry';
import {
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  nullEngineHost,
} from '@epoch/adapter-renderer-babylonjs';
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
  registerOntologyRecords,
  sealWorldSceneContent,
  type WorldOntology,
  type WorldOntologyRecord,
  type WorldScene,
  type WorldSceneContent,
} from '@epoch/world-experience';

// ---------------------------------------------------------------------------
// The problem constants.
// ---------------------------------------------------------------------------

export const TENANT = 'tenant-riverside-web';
export const SCENE_ID = 'wsc-web-plant-room';

/** The semantic layers of the problem (entity-type namespaces). */
export const LAYERS = ['lyr-delivery', 'lyr-mep', 'lyr-site'] as const;

export const ENTITY_IDS = {
  slab: 'we-web-slab-b1',
  frame: 'we-web-frame-grid-b',
  panel: 'we-web-panel-mdp-2',
  riser: 'we-web-riser-chilled-water',
  /** The hidden clash risk: the legacy duct run, invisible until revealed. */
  legacyDuct: 'we-web-legacy-duct-l4',
  hoist: 'we-web-hoist-zone-north',
  staging: 'we-web-staging-yard',
} as const;

export const AGENT_IDS = {
  surveyor: 'agent:web-riverside-surveyor',
  coordinator: 'agent:web-riverside-coordinator',
} as const;

export const OVERLAY_IDS = {
  riserRun: 'ovl-web-measure-riser-run',
  clashZone: 'ovl-web-highlight-clash-zone',
  slabState: 'ovl-web-state-slab-pour',
} as const;

export const CONTROL_IDS = {
  branch: 'ctl-web-branch-delivery',
  simulate: 'ctl-web-simulate-sequence',
  pause: 'ctl-web-pause-replay',
} as const;

/** The branch point (virtual time) the delivery sequence can fork at. */
export const BRANCH_AT_MS = 5_000;

/** The delivery replay track: 0..9s, position 1.5s, playing. */
export const TRACK = { startMs: 0, endMs: 9_000, positionAtMs: 1_500 } as const;

// ---------------------------------------------------------------------------
// The ontology (pack-contributed representation records).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: readonly WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-web-rep-slab',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['site:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-web-rep-pipe',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:duct', 'mep:riser'],
    primitive: 'cylinder',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-web-rep-panel',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:panel'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-web-rep-zone',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['delivery:zone'],
    primitive: 'plane',
  },
];

export const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, [...ONTOLOGY_RECORDS]);
  if (!registered.ok) {
    throw new Error(`web world ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

// ---------------------------------------------------------------------------
// The canonical scene content (the REAL fixture problem).
// ---------------------------------------------------------------------------

/** Deterministic fixture digest (64-hex; the REAL sealing re-digests). */
function digestOf(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  for (let round = 0; round < 8; round += 1) {
    hash = Math.imul(hash ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    out += hash.toString(16).padStart(8, '0');
  }
  return out;
}

const SCENE_CONTENT: WorldSceneContent = {
  schema: 'epoch.world-scene',
  protocolVersion: '1.0.0',
  sceneId: SCENE_ID,
  tenantScope: { tenantId: TENANT, projectId: 'scope-web-riverside-block-b' },
  name: 'Riverside plant-room riser coordination',
  entities: [
    {
      entityId: ENTITY_IDS.frame,
      contentDigest: digestOf(`${ENTITY_IDS.frame}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-web-rep-slab',
      label: 'Frame grid B',
      position: [18, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.hoist,
      contentDigest: digestOf(`${ENTITY_IDS.hoist}@1`),
      entityType: 'delivery:zone',
      representationRecordId: 'ont-web-rep-zone',
      label: 'North hoist zone',
      position: [-6, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.legacyDuct,
      contentDigest: digestOf(`${ENTITY_IDS.legacyDuct}@1`),
      entityType: 'mep:duct',
      representationRecordId: 'ont-web-rep-pipe',
      label: 'Legacy duct run L4',
      position: [12, 6, -9],
      visible: false,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.panel,
      contentDigest: digestOf(`${ENTITY_IDS.panel}@1`),
      entityType: 'mep:panel',
      representationRecordId: 'ont-web-rep-panel',
      label: 'Main distribution panel MD-2',
      position: [0, 6, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.riser,
      contentDigest: digestOf(`${ENTITY_IDS.riser}@1`),
      entityType: 'mep:riser',
      representationRecordId: 'ont-web-rep-pipe',
      label: 'Chilled-water riser',
      position: [12, 6, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.slab,
      contentDigest: digestOf(`${ENTITY_IDS.slab}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-web-rep-slab',
      label: 'Basement slab B1',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.staging,
      contentDigest: digestOf(`${ENTITY_IDS.staging}@1`),
      entityType: 'delivery:zone',
      representationRecordId: 'ont-web-rep-zone',
      label: 'Staging yard',
      position: [-18, 0, 0],
      visible: true,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS.riser],
  overlays: [
    {
      overlayId: OVERLAY_IDS.clashZone,
      overlayKind: 'highlight',
      entityId: ENTITY_IDS.legacyDuct,
      color: '#b91c1c',
    },
    {
      overlayId: OVERLAY_IDS.riserRun,
      overlayKind: 'measurement',
      fromEntityId: ENTITY_IDS.panel,
      toEntityId: ENTITY_IDS.riser,
      label: 'Panel-to-riser run',
    },
    {
      overlayId: OVERLAY_IDS.slabState,
      overlayKind: 'state',
      entityId: ENTITY_IDS.slab,
      stateKey: 'pour-cured',
      tint: '#15803d',
      badgeLabel: 'cured',
    },
  ],
  appliedOverlays: [{ overlayId: OVERLAY_IDS.slabState, orderIndex: 0 }],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-web-baseline', atMs: 0, label: 'Baseline survey', markerKind: 'event' },
      { markerId: 'mrk-web-pour', atMs: 3_000, label: 'Slab pour complete', markerKind: 'phase-end' },
      { markerId: 'mrk-web-branch', atMs: BRANCH_AT_MS, label: 'Delivery sequence branch', markerKind: 'branch-point' },
      { markerId: 'mrk-web-close', atMs: 9_000, label: 'Delivery window closes', markerKind: 'event' },
    ],
    trackLabel: 'Riverside delivery replay',
    trackStartMs: TRACK.startMs,
    trackEndMs: TRACK.endMs,
    position: { atMs: TRACK.positionAtMs, frameIndex: 45, paused: false },
  },
  camera: { mode: 'orbit', position: [30, 22, 30], target: [4, 3, 0], fovRadians: Math.PI / 4 },
  participants: [],
  agents: [
    {
      kind: 'agent',
      tenantId: TENANT,
      agentId: AGENT_IDS.coordinator,
      contentDigest: digestOf(`${AGENT_IDS.coordinator}@1`),
    },
    {
      kind: 'agent',
      tenantId: TENANT,
      agentId: AGENT_IDS.surveyor,
      contentDigest: digestOf(`${AGENT_IDS.surveyor}@1`),
    },
  ],
  evidenceReferences: [],
  controls: [
    {
      controlId: CONTROL_IDS.branch,
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.branch', version: '1.0.0' },
      label: 'Branch delivery sequence',
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
      label: 'Simulate hoist sequence',
    },
  ],
};

/** The sealed canonical scene the web world host presents. */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`web world scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The desktop-class device session the workspace binds (W013 snapshot). */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-web-world-1',
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
// The renderers behind the seam: the REAL engines + the reference fallback.
// ---------------------------------------------------------------------------

/** The W013 renderer id of the contract-only reference fallback presenter. */
export const REFERENCE_RENDERER_ID = 'rr-web-reference';

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
  assetKinds: [],
};

/** The W013 renderer ids of the REAL engine adapters (re-exported for hosts). */
export { THREE_RENDERER_ID } from '@epoch/adapter-renderer-threejs';
export { BABYLONJS_RENDERER_ID } from '@epoch/adapter-renderer-babylonjs';

/** The renderer ids behind the seam, in the ordered preference/fallback chain. */
export const RENDERER_PREFERENCE: readonly string[] = [
  THREE_RENDERER_ID,
  BABYLONJS_RENDERER_ID,
  REFERENCE_RENDERER_ID,
];

/** The renderer ids whose presenters draw real engine pixels. */
export const ENGINE_RENDERER_IDS: readonly string[] = [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID];

/** Whether one renderer id presents through a real engine (pixels). */
export function isEngineRenderer(rendererId: string): boolean {
  return (ENGINE_RENDERER_IDS as readonly string[]).includes(rendererId);
}

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
    throw new Error(`web world manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter,
  });
  if (!registered.ok) {
    throw new Error(`web world renderer failed to register: ${registered.error.message}`);
  }
}

/** The construction inputs of the web world fabric. */
export interface WebWorldFabricOptions {
  /** The REAL Three.js adapter (the host injects the browser GL surface). */
  readonly three: ThreeJsRendererAdapter;
  /** The REAL Babylon.js adapter (the host injects the browser engine host). */
  readonly babylon: BabylonRendererAdapter;
}

/** The built fabric + its adapters (evidence helpers for hosts/tests). */
export interface WebWorldFabric {
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
}

/**
 * Build the web world fabric: the REAL Three.js and Babylon.js renderers
 * registered through the REAL capability registry (the same adapters the
 * W058/W059 conformance batteries prove), plus the contract-only reference
 * renderer as the final declared fallback of the switching chain.
 */
export function buildWorldFabric(options: WebWorldFabricOptions): WebWorldFabric {
  const fabric = new RendererFabric();
  registerRenderer(fabric, options.three);
  registerRenderer(fabric, options.babylon);
  registerRenderer(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.web-reference',
        rendererId: REFERENCE_RENDERER_ID,
        displayName: 'Reference presenter (contract-only)',
        description:
          'The W056 contract-only reference presenter — the declared final fallback of the web world host (no engine, no pixels).',
      },
      descriptor: REFERENCE_DESCRIPTOR,
      capabilities: REFERENCE_CAPABILITIES,
    }),
  );
  return { fabric, three: options.three, babylon: options.babylon };
}

/**
 * The HEADLESS construction default (tests, SSR-safe composition): the real
 * adapters with their deterministic cores — the Three.js adapter without a
 * GL surface factory and the Babylon.js adapter over the NullEngine host.
 */
export function buildHeadlessWorldFabric(): WebWorldFabric {
  return buildWorldFabric({
    three: new ThreeJsRendererAdapter(),
    babylon: new BabylonRendererAdapter({ host: nullEngineHost() }),
  });
}
