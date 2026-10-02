/**
 * The world-runtime unit-test fixture (W057): ONE compact canonical world
 * + TWO distinguishable reference renderers behind the REAL fabric — the
 * same machinery qa/world-experience drives at full scale (the shared
 * REAL fixture problem). Everything is deterministic: fixed virtual
 * times, fixed caller-scoped ids, byte-stable digests.
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
import type { HostClock } from '../src/clock';
import { ManualFrameScheduler } from '../src/clock';

export const TENANT = 'tenant-workspace';

export const SCENE_ID = 'wsc-workspace-fixture';

export const ENTITY_IDS = [
  'we-mep-hidden-node',
  'we-mep-panel',
  'we-site-frame',
  'we-site-slab',
] as const;

export const LAYERS = ['lyr-mep', 'lyr-site'] as const;

const ONTOLOGY_RECORDS: WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-slab',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-workspace' },
    appliesTo: ['site:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-node',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-workspace' },
    appliesTo: ['mep:panel'],
    primitive: 'sphere',
  },
];

export const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, ONTOLOGY_RECORDS);
  if (!registered.ok) {
    throw new Error(`fixture ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

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
  tenantScope: { tenantId: TENANT },
  name: 'Workspace Fixture Problem',
  entities: [
    {
      entityId: ENTITY_IDS[0],
      contentDigest: digestOf(`${ENTITY_IDS[0]}@1`),
      entityType: 'mep:panel',
      representationRecordId: 'ont-rep-node',
      position: [12, 9, 0],
      visible: false,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[1],
      contentDigest: digestOf(`${ENTITY_IDS[1]}@1`),
      entityType: 'mep:panel',
      representationRecordId: 'ont-rep-node',
      label: 'Distribution panel',
      position: [0, 9, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[2],
      contentDigest: digestOf(`${ENTITY_IDS[2]}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-rep-slab',
      label: 'Primary frame',
      position: [12, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[3],
      contentDigest: digestOf(`${ENTITY_IDS[3]}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-rep-slab',
      label: 'Foundation slab',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS[3]],
  overlays: [
    {
      overlayId: 'ovl-measure-panel-slab',
      overlayKind: 'measurement',
      fromEntityId: ENTITY_IDS[1],
      toEntityId: ENTITY_IDS[3],
      label: 'Panel-to-slab riser run',
    },
  ],
  appliedOverlays: [],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-base', atMs: 0, label: 'Baseline', markerKind: 'event' },
      { markerId: 'mrk-branch', atMs: 4_000, label: 'Branch point', markerKind: 'branch-point' },
      { markerId: 'mrk-done', atMs: 9_000, label: 'Delivery window closes', markerKind: 'event' },
    ],
    trackLabel: 'Delivery replay track',
    trackStartMs: 0,
    trackEndMs: 9_000,
    position: { atMs: 1_000, frameIndex: 30, paused: false },
  },
  camera: { mode: 'orbit', position: [24, 18, 24], target: [6, 4, 0], fovRadians: Math.PI / 4 },
  participants: [],
  agents: [
    {
      kind: 'agent',
      tenantId: TENANT,
      agentId: 'agent:workspace-surveyor',
      contentDigest: digestOf('agent-workspace-surveyor@1'),
    },
  ],
  evidenceReferences: [],
  controls: [
    {
      controlId: 'ctl-branch-here',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.branch', version: '1.0.0' },
      label: 'Branch from here',
    },
    {
      controlId: 'ctl-pause',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.pause', version: '1.0.0' },
      label: 'Pause replay',
    },
    {
      controlId: 'ctl-simulate',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.simulate', version: '1.0.0' },
      label: 'Run delivery simulation',
    },
  ],
};

export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`fixture scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-workspace-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
  },
};

export const FULL_RENDERER_ID = 'rr-workspace-full';
export const REDUCED_RENDERER_ID = 'rr-workspace-reduced';

const DESCRIPTOR_FULL: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: FULL_RENDERER_ID,
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
  budgets: { maxGraphNodes: 4_096, maxGraphEdges: 8_192, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
};

const DESCRIPTOR_REDUCED: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: REDUCED_RENDERER_ID,
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['pointer'],
  output: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60 },
  budgets: { maxGraphNodes: 1_024, maxGraphEdges: 2_048, maxTriangles: 64_000, maxTextureBytes: 67_108_864 },
};

const CAPABILITIES_FULL: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: FULL_RENDERER_ID,
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

const CAPABILITIES_REDUCED: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: REDUCED_RENDERER_ID,
  hitTesting: true,
  measurement: false,
  annotation: false,
  frameCapture: false,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none', 'static-frame'],
  portableViewState: ['focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: [],
};

function register(fabric: RendererFabric, adapter: RendererAdapter, capabilityId: string): void {
  const identity = adapter.identity();
  const manifest = rendererCapabilityManifestOf({
    capabilityId,
    version: '1.0.0',
    descriptor: adapter.descriptor(),
    capabilities: adapter.capabilities(),
    displayName: identity.displayName,
    description: identity.description,
  });
  const sealed = sealCapabilityManifest(manifest);
  if (!sealed.ok) {
    throw new Error(`fixture manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter,
  });
  if (!registered.ok) {
    throw new Error(`fixture renderer failed to register: ${registered.error.message}`);
  }
}

/** Build the fixture fabric: both reference renderers registered. */
export function buildFabric(): RendererFabric {
  const fabric = new RendererFabric();
  register(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.workspace-full',
        rendererId: FULL_RENDERER_ID,
        displayName: 'Workspace Full Renderer (reference)',
      },
      descriptor: DESCRIPTOR_FULL,
      capabilities: CAPABILITIES_FULL,
    }),
    'epoch.renderer.workspace-full',
  );
  register(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.workspace-reduced',
        rendererId: REDUCED_RENDERER_ID,
        displayName: 'Workspace Reduced Renderer (reference)',
      },
      descriptor: DESCRIPTOR_REDUCED,
      capabilities: CAPABILITIES_REDUCED,
    }),
    'epoch.renderer.workspace-reduced',
  );
  return fabric;
}

/** The deterministic manual clock of one unit-test run. */
export class FixtureClock implements HostClock {
  private currentMs = 10_000;

  nowMs(): number {
    return this.currentMs;
  }

  advanceTo(ms: number): void {
    this.currentMs = Math.max(this.currentMs, Math.trunc(ms));
  }
}

/** The shared construction inputs of one workspace runtime under test. */
export function workspaceInputs(clock: FixtureClock, scheduler: ManualFrameScheduler) {
  return {
    slug: 'workspace-test',
    fabric: buildFabric(),
    scene: SCENE,
    ontology: ONTOLOGY,
    device: DEVICE,
    clock,
    scheduler,
    rendererPreference: [FULL_RENDERER_ID, REDUCED_RENDERER_ID],
  };
}

/**
 * The presented entities of the fixture scene (visible, sorted — the
 * reference adapter's deterministic hit-test partition basis).
 */
export const PRESENTED_ENTITY_IDS: readonly string[] = [ENTITY_IDS[1], ENTITY_IDS[2], ENTITY_IDS[3]];

/** Map a normalized pointer x to the entity the reference renderers hit. */
export function hitEntityOf(x: number): string {
  const count = PRESENTED_ENTITY_IDS.length;
  const index = Math.min(count - 1, Math.max(0, Math.floor(x * count)));
  return PRESENTED_ENTITY_IDS[index]!;
}
