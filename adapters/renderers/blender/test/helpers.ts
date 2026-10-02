/**
 * The W060 Blender sidecar unit-test fixture builders — REAL product
 * machinery, no test doubles: a canonical W016 scene admitted through the
 * REAL W016 total admission, a REAL ontology, a REAL desktop device
 * session, and the fabric wiring through the REAL capability registry.
 * Everything is deterministic (fixed virtual times, fixed ids, stable
 * digests).
 *
 * SELF-CONTAINED BY DISCIPLINE (the W058/W059 adapter-package precedent):
 * this package's tests import ONLY their own modules and workspace
 * PACKAGE NAMES — never cross-package relative imports (the
 * `pnpm check:boundary` rule). The SHARED canonical fixture
 * (qa/renderer-conformance/fixture.ts) is the QA batteries' surface; this
 * local fixture is the same SHAPE with blender-unit identity.
 */
import {
  ReferenceRendererAdapter,
  RendererFabric,
  rendererCapabilityManifestOf,
  type RendererAdapter,
} from '@epoch/renderer-fabric';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import type {
  DeviceSessionSnapshot,
  PortableViewState,
  RendererCapabilitySet,
  RendererDescriptor,
  WorldProjectionRef,
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
// Fixture identity (all deterministic).
// ---------------------------------------------------------------------------

/** The unit-fixture tenant. */
export const TENANT = 'tenant-blender-unit';

/** The four semantic entities of the unit-fixture world (gamma is hidden). */
export const ENTITY_IDS = [
  'we-blender-alpha',
  'we-blender-beta',
  'we-blender-delta',
  'we-blender-gamma',
] as const;

// ---------------------------------------------------------------------------
// The unit ontology (pack-contributable presentation recipes).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-blender-box',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-blender-unit' },
    appliesTo: ['blender:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-blender-sphere',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-blender-unit' },
    appliesTo: ['blender:node'],
    primitive: 'sphere',
    materialRecordId: 'ont-mat-blender-steel',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-mat-blender-steel',
    recordKind: 'material',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-blender-unit' },
    color: '#8899aa',
    roughness: 0.4,
    metalness: 0.8,
  },
];

/** The unit-fixture ontology (records admitted through the real registration). */
export const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, ONTOLOGY_RECORDS);
  if (!registered.ok) {
    throw new Error(`unit ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

// ---------------------------------------------------------------------------
// The canonical world scene (admitted + sealed through the REAL W016
// total admission).
// ---------------------------------------------------------------------------

function digestOf(seed: string): string {
  // Deterministic pseudo-content digests for the opaque world-entity
  // references (stable, distinct, well-formed digests; the world model is
  // authoritative elsewhere).
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
  sceneId: 'wsc-blender-unit-1',
  tenantScope: { tenantId: TENANT },
  name: 'Blender Unit Fixture World',
  entities: [
    {
      entityId: ENTITY_IDS[0],
      contentDigest: digestOf(`${ENTITY_IDS[0]}@1`),
      entityType: 'blender:structure',
      representationRecordId: 'ont-rep-blender-box',
      label: 'Foundation slab',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[1],
      contentDigest: digestOf(`${ENTITY_IDS[1]}@1`),
      entityType: 'blender:structure',
      representationRecordId: 'ont-rep-blender-box',
      label: 'Primary frame',
      position: [10, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[2],
      contentDigest: digestOf(`${ENTITY_IDS[2]}@1`),
      entityType: 'blender:node',
      representationRecordId: 'ont-rep-blender-sphere',
      label: 'Utility node delta',
      position: [0, 10, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[3],
      contentDigest: digestOf(`${ENTITY_IDS[3]}@1`),
      entityType: 'blender:node',
      representationRecordId: 'ont-rep-blender-sphere',
      position: [10, 10, 0],
      visible: false,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS[1]],
  overlays: [
    {
      overlayId: 'ovl-blender-highlight',
      overlayKind: 'highlight',
      entityId: ENTITY_IDS[1],
      color: '#ffcc00',
    },
  ],
  appliedOverlays: [{ overlayId: 'ovl-blender-highlight', orderIndex: 0 }],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-blender-start', atMs: 0, label: 'Replay window opens', markerKind: 'event' },
      { markerId: 'mrk-blender-branch', atMs: 4_000, label: 'Branch point', markerKind: 'branch-point' },
      { markerId: 'mrk-blender-end', atMs: 8_000, label: 'Replay window closes', markerKind: 'event' },
    ],
    trackLabel: 'Blender unit replay track',
    trackStartMs: 0,
    trackEndMs: 8_000,
    position: { atMs: 2_000, frameIndex: 60, paused: false },
  },
  camera: { mode: 'orbit', position: [24, 18, 24], target: [5, 5, 0] },
  participants: [],
  agents: [
    {
      kind: 'agent',
      tenantId: TENANT,
      agentId: 'agent:blender-unit-observer',
      contentDigest: digestOf('agent-blender-unit-observer@1'),
    },
  ],
  evidenceReferences: [],
  controls: [],
};

/**
 * The unit-fixture canonical world scene: admitted through the REAL W016
 * total admission (tenant-gated) and sealed content-addressed.
 */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`unit scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The unit-fixture world projection reference (identity continuity triple). */
export const WORLD_PROJECTION: WorldProjectionRef = {
  sceneId: SCENE.sceneId,
  worldDigest: SCENE.digest,
  tenantScope: SCENE.tenantScope,
};

// ---------------------------------------------------------------------------
// The device session (W013 snapshot over the W011 desktop vocabulary).
// ---------------------------------------------------------------------------

/** A deterministic desktop device session for the unit fixture's tenant. */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-blender-unit-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: {
      stereoscopic: false,
      maxPixels: 2_073_600,
      refreshHz: 60,
      colorDepthBits: 24,
    },
    spatial: {
      poseTracking: 'none',
      worldAnchored: false,
      maxTriangles: 1_000_000,
      maxTextureBytes: 268_435_456,
    },
  },
};

// ---------------------------------------------------------------------------
// The fabric wiring (the REAL capability-registry registration path).
// ---------------------------------------------------------------------------

/**
 * Register one renderer adapter with the fabric's registry: a sealed,
 * digest-verified `visualization`-category capability manifest honoring
 * the frozen `epoch.renderers` contract — the REAL registration path
 * (the shared conformance fixture's discipline, package-local).
 */
export function registerRenderer(
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
    throw new Error(`unit manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter,
  });
  if (!registered.ok) {
    throw new Error(`unit renderer failed to register: ${registered.error.message}`);
  }
}

/** The unit fabric: the REAL RendererFabric + the contract-only reference
 *  renderer (the switch-target class of the adapter battery — the shared
 *  conformance fixture's discipline, package-local). */
export function buildFabric(): {
  readonly fabric: RendererFabric;
  readonly full: ReferenceRendererAdapter;
} {
  const fabric = new RendererFabric();
  const full = new ReferenceRendererAdapter({
    identity: {
      capabilityId: 'epoch.renderer.blender-unit-reference',
      rendererId: 'rr-conformance-full',
      displayName: 'Blender Unit Reference Renderer (contract-only)',
      description: 'Contract-only reference renderer: the switch-target class of the sidecar battery.',
    },
    descriptor: REFERENCE_DESCRIPTOR,
    capabilities: REFERENCE_CAPABILITIES,
  });
  registerRenderer(fabric, full);
  return { fabric, full };
}

/** The reference renderer's W013 descriptor (full graph kinds, pointer + keys). */
const REFERENCE_DESCRIPTOR: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-conformance-full',
  graphKinds: ['2d', '3d', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 1_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/** The reference renderer's capability set (every portable field, full degrade). */
const REFERENCE_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: 'rr-conformance-full',
  hitTesting: true,
  measurement: true,
  annotation: true,
  frameCapture: true,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none', 'reduced-fidelity', 'static-frame', 'wireframe'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['material', 'mesh', 'texture'],
};

// ---------------------------------------------------------------------------
// The portable view state + the virtual clock.
// ---------------------------------------------------------------------------

/** The deterministic portable view state of the unit fixture. */
export function fixtureViewState(): PortableViewState {
  return {
    focusedEntityIds: [ENTITY_IDS[1]],
    layerVisibility: [
      { layerId: 'lyr-structure', visible: true },
      { layerId: 'lyr-utilities', visible: false },
    ],
    timelinePosition: { atMs: 3_000, frameIndex: 90, paused: false },
    camera: { mode: 'orbit', position: [30, 20, 30], target: [5, 5, 0] },
    hiddenEntityIds: [],
  };
}

/** The shared virtual times of one unit run. */
export const CLOCK = {
  sessionCreated: 1_000,
  sceneMounted: 2_000,
  firstFrame: 3_000,
  firstInput: 3_500,
  secondInput: 3_600,
  snapshotCaptured: 4_000,
  switchRequested: 4_500,
  switchMounted: 5_000,
  switchCompleted: 5_500,
} as const;
