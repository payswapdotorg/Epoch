/**
 * THE WORLD-EXPERIENCE HARNESS FIXTURE (W057) — ONE REAL fixture problem
 * solved through the spatial world: the Riverside plant-room riser
 * coordination problem (a construction delivery slice with a hidden clash
 * risk the user must find through the WORLD, not through a table).
 *
 * The scene is a REAL canonical W016 projection: entities across THREE
 * semantic layers (site structure, MEP services, delivery logistics),
 * one deliberately hidden clash-risk entity (the legacy duct run the
 * riser would collide with — findable only by revealing its layer), a
 * declared measurement overlay (the riser run the user must measure),
 * a branch-point timeline marker (the delivery sequence can fork there),
 * two agents (the surveyor to follow, the coordinator), and the
 * candidate/action controls (branch / simulate / pause).
 *
 * The fabric registers TWO distinguishable contract-only reference
 * renderers (full + reduced — the same seam W058/W059's real engines
 * occupy), so the journey proves renderer switching + fallback over the
 * SAME canonical world.
 *
 * Everything is deterministic: fixed virtual times, fixed caller-scoped
 * ids, byte-stable digests (repeated runs produce identical evidence).
 */
import {
  ReferenceRendererAdapter,
  RendererFabric,
  rendererCapabilityManifestOf,
  type RendererAdapter,
} from '../../packages/renderer-fabric/src/index';
import { sealCapabilityManifest } from '../../packages/capability-registry/src/index';
import type {
  DeviceSessionSnapshot,
  RendererCapabilitySet,
  RendererDescriptor,
} from '../../packages/renderer-runtime/src/index';
import {
  admitWorldScene,
  registerOntologyRecords,
  sealWorldSceneContent,
  type WorldOntology,
  type WorldOntologyRecord,
  type WorldScene,
  type WorldSceneContent,
} from '../../packages/world-experience/src/index';
import type { HostClock } from '../../packages/world-runtime/src/clock';
import { ManualFrameScheduler } from '../../packages/world-runtime/src/clock';
import { WorldWorkspaceRuntime } from '../../packages/world-runtime/src/workspace';

// ---------------------------------------------------------------------------
// The problem constants.
// ---------------------------------------------------------------------------

export const TENANT = 'tenant-riverside';
export const SCENE_ID = 'wsc-riverside-plant-room';

/** The semantic layers of the problem (entity-type namespaces). */
export const LAYERS = ['lyr-delivery', 'lyr-mep', 'lyr-site'] as const;

export const ENTITY_IDS = {
  slab: 'we-slab-b1',
  frame: 'we-frame-grid-b',
  panel: 'we-panel-mdp-2',
  riser: 'we-riser-chilled-water',
  /** The hidden clash risk: legacy duct run, invisible until revealed. */
  legacyDuct: 'we-legacy-duct-l4',
  hoist: 'we-hoist-zone-north',
  staging: 'we-staging-yard',
} as const;

export const AGENT_IDS = {
  surveyor: 'agent:riverside-surveyor',
  coordinator: 'agent:riverside-coordinator',
} as const;

export const OVERLAY_IDS = {
  riserRun: 'ovl-measure-riser-run',
  clashZone: 'ovl-highlight-clash-zone',
  slabState: 'ovl-state-slab-pour',
} as const;

export const CONTROL_IDS = {
  branch: 'ctl-branch-delivery',
  simulate: 'ctl-simulate-sequence',
  pause: 'ctl-pause-replay',
} as const;

export const MARKER_IDS = {
  baseline: 'mrk-baseline-survey',
  pour: 'mrk-slab-pour-complete',
  branch: 'mrk-branch-delivery-sequence',
  close: 'mrk-delivery-window-closes',
} as const;

/** The branch point (virtual time) the delivery sequence can fork at. */
export const BRANCH_AT_MS = 5_000;

/**
 * The delivery replay track: 0..9s, position 1.5s, playing. NOTE: marker
 * times are same-digit-width values — the W016 marker ordering compares
 * `${atMs}\0${markerId}` lexicographically, so mixed-width times would
 * mis-sort (see the harness README's advisory note).
 */
export const TRACK = { startMs: 0, endMs: 9_000, positionAtMs: 1_500 } as const;

// ---------------------------------------------------------------------------
// The ontology (pack-contributed representation records).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: readonly WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-slab',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['site:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-pipe',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:duct', 'mep:riser'],
    primitive: 'cylinder',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-panel',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:panel'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-zone',
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
    throw new Error(`fixture ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

// ---------------------------------------------------------------------------
// The canonical scene content (the REAL fixture problem).
// ---------------------------------------------------------------------------

function digestOf(seed: string): string {
  // Deterministic FNV-1a-derived 64-hex digest (fixture-only; the REAL
  // sealing computes the canonical-JSON SHA-256 over the content).
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
  tenantScope: { tenantId: TENANT, projectId: 'scope-riverside-block-b' },
  name: 'Riverside plant-room riser coordination',
  entities: [
    {
      entityId: ENTITY_IDS.frame,
      contentDigest: digestOf(`${ENTITY_IDS.frame}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-rep-slab',
      label: 'Frame grid B',
      position: [18, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.hoist,
      contentDigest: digestOf(`${ENTITY_IDS.hoist}@1`),
      entityType: 'delivery:zone',
      representationRecordId: 'ont-rep-zone',
      label: 'North hoist zone',
      position: [-6, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      // The hidden clash risk: the legacy duct the riser route crosses.
      // Invisible until the user REVEALS/isolates the MEP layer — the
      // spatial-world acceptance: the problem is solved IN the world.
      entityId: ENTITY_IDS.legacyDuct,
      contentDigest: digestOf(`${ENTITY_IDS.legacyDuct}@1`),
      entityType: 'mep:duct',
      representationRecordId: 'ont-rep-pipe',
      label: 'Legacy duct run L4',
      position: [12, 6, -9],
      visible: false,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.panel,
      contentDigest: digestOf(`${ENTITY_IDS.panel}@1`),
      entityType: 'mep:panel',
      representationRecordId: 'ont-rep-panel',
      label: 'Main distribution panel MD-2',
      position: [0, 6, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.riser,
      contentDigest: digestOf(`${ENTITY_IDS.riser}@1`),
      entityType: 'mep:riser',
      representationRecordId: 'ont-rep-pipe',
      label: 'Chilled-water riser',
      position: [12, 6, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.slab,
      contentDigest: digestOf(`${ENTITY_IDS.slab}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-rep-slab',
      label: 'Basement slab B1',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.staging,
      contentDigest: digestOf(`${ENTITY_IDS.staging}@1`),
      entityType: 'delivery:zone',
      representationRecordId: 'ont-rep-zone',
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
  appliedOverlays: [
    { overlayId: OVERLAY_IDS.slabState, orderIndex: 0 },
  ],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: MARKER_IDS.baseline, atMs: 0, label: 'Baseline survey', markerKind: 'event' },
      { markerId: MARKER_IDS.pour, atMs: 3_000, label: 'Slab pour complete', markerKind: 'phase-end' },
      { markerId: MARKER_IDS.branch, atMs: BRANCH_AT_MS, label: 'Delivery sequence branch', markerKind: 'branch-point' },
      { markerId: MARKER_IDS.close, atMs: 9_000, label: 'Delivery window closes', markerKind: 'event' },
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

/** The sealed canonical scene (the exact fixture revision under test). */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`fixture scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The full-fidelity desktop device the workspace binds (W013 snapshot). */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-riverside-1',
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
// The renderers behind the seam (contract-only reference instances).
// ---------------------------------------------------------------------------

export const FULL_RENDERER_ID = 'rr-riverside-full';
export const REDUCED_RENDERER_ID = 'rr-riverside-reduced';

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

function registerRenderer(
  fabric: RendererFabric,
  adapter: RendererAdapter,
  capabilityId: string,
): void {
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
  registerRenderer(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.riverside-full',
        rendererId: FULL_RENDERER_ID,
        displayName: 'Riverside Full (reference)',
      },
      descriptor: DESCRIPTOR_FULL,
      capabilities: CAPABILITIES_FULL,
    }),
    'epoch.renderer.riverside-full',
  );
  registerRenderer(
    fabric,
    new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.riverside-reduced',
        rendererId: REDUCED_RENDERER_ID,
        displayName: 'Riverside Reduced (reference)',
      },
      descriptor: DESCRIPTOR_REDUCED,
      capabilities: CAPABILITIES_REDUCED,
    }),
    'epoch.renderer.riverside-reduced',
  );
  return fabric;
}

// ---------------------------------------------------------------------------
// The workspace construction (the harness drives the REAL runtime).
// ---------------------------------------------------------------------------

/** The deterministic manual clock of one harness run (virtual-time script). */
export class JourneyClock implements HostClock {
  private currentMs = 100_000;

  nowMs(): number {
    return this.currentMs;
  }

  advanceTo(ms: number): void {
    this.currentMs = Math.max(this.currentMs, Math.trunc(ms));
  }
}

/** The shared construction inputs of one workspace runtime under test. */
export function workspaceInputs(clock: JourneyClock, scheduler: ManualFrameScheduler) {
  return {
    slug: 'riverside',
    fabric: buildFabric(),
    scene: SCENE,
    ontology: ONTOLOGY,
    device: DEVICE,
    clock,
    scheduler,
    rendererPreference: [FULL_RENDERER_ID, REDUCED_RENDERER_ID] as const,
  };
}

/** Open one REAL workspace runtime over the fixture problem. */
export async function openWorkspace(
  clock: JourneyClock = new JourneyClock(),
  scheduler: ManualFrameScheduler = new ManualFrameScheduler(),
): Promise<{ runtime: WorldWorkspaceRuntime; clock: JourneyClock; scheduler: ManualFrameScheduler }> {
  const runtime = new WorldWorkspaceRuntime(workspaceInputs(clock, scheduler));
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`the fixture workspace failed to open: ${opened.error.code}: ${opened.error.message}`);
  }
  return { runtime, clock, scheduler };
}

/**
 * The presented entities of the fixture scene (visible, sorted — the
 * reference adapter's deterministic hit-test partition basis). The hidden
 * legacy duct is NOT presented until its layer is revealed.
 */
export const PRESENTED_ENTITY_IDS: readonly string[] = [
  ENTITY_IDS.frame,
  ENTITY_IDS.hoist,
  ENTITY_IDS.panel,
  ENTITY_IDS.riser,
  ENTITY_IDS.slab,
  ENTITY_IDS.staging,
];

/** Map a normalized pointer x to the entity the reference renderers hit. */
export function hitEntityOf(x: number): string {
  const count = PRESENTED_ENTITY_IDS.length;
  const index = Math.min(count - 1, Math.max(0, Math.floor(x * count)));
  return PRESENTED_ENTITY_IDS[index] as string;
}

/** The normalized pointer x that picks one specific presented entity. */
export function pointerXOf(entityId: string): number {
  const index = PRESENTED_ENTITY_IDS.indexOf(entityId);
  if (index === -1) {
    throw new Error(`entity ${entityId} is not presented by the fixture`);
  }
  const count = PRESENTED_ENTITY_IDS.length;
  // The reference hit-test partition: floor(x * count) === index. Any x in
  // [index/count, (index+1)/count) resolves this entity; x=1 clamps to the
  // last — stay strictly inside the partition for determinism.
  return (index + 0.5) / count;
}

/** The entity the hidden legacy duct's layer reveal brings back. */
export const HIDDEN_ENTITY_ID = ENTITY_IDS.legacyDuct;
