/**
 * The DESKTOP WORLD HOST fixture (W057) — the compact canonical world the
 * desktop world section presents: the plant-room riser coordination
 * slice (the same problem shape the qa/world-experience harness drives
 * at full scale), composed through the REAL stack:
 *
 * - a canonical W016 `WorldScene` (admitted + sealed through the real W016
 *   admission),
 * - the REAL `RendererFabric` with the contract-only reference renderer
 *   registered (the seam W058/W059's real engines occupy; zero engines),
 * - the full-fidelity DESKTOP device descriptor (src/device.ts) as the
 *   W013 device snapshot,
 * - and the REAL `WorldWorkspaceRuntime` (@epoch/world-runtime) owning the
 *   wall-clock host loop (the fabric core stays virtual-time-only).
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
import { DESKTOP_DEVICE } from '../../../src/device';

// ---------------------------------------------------------------------------
// The problem constants.
// ---------------------------------------------------------------------------

export const TENANT = 'tenant-desktop-world';

export const ENTITY_IDS = {
  frame: 'we-dw-frame-grid',
  slab: 'we-dw-slab-b1',
  panel: 'we-dw-panel-md-1',
  riser: 'we-dw-riser-cw',
  /** Hidden until the MEP layer is revealed (the clash risk). */
  duct: 'we-dw-legacy-duct',
  staging: 'we-dw-staging-yard',
} as const;

export const AGENT_IDS = {
  surveyor: 'agent:desktop-surveyor',
} as const;

export const BRANCH_AT_MS = 4_000;
export const TRACK = { startMs: 0, endMs: 8_000, positionAtMs: 2_000 } as const;

// ---------------------------------------------------------------------------
// The ontology (pack-contributed representation records).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: readonly WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-dw-slab',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['site:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-dw-pipe',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:duct', 'mep:riser'],
    primitive: 'cylinder',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-dw-panel',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-construction' },
    appliesTo: ['mep:panel'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-dw-zone',
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
    throw new Error(`world-host ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

// ---------------------------------------------------------------------------
// The canonical scene content.
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
  sceneId: 'wsc-desktop-plant-room',
  tenantScope: { tenantId: TENANT },
  name: 'Desktop plant-room riser coordination',
  entities: [
    {
      entityId: ENTITY_IDS.frame,
      contentDigest: digestOf(`${ENTITY_IDS.frame}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-dw-slab',
      label: 'Frame grid',
      position: [16, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      // The hidden clash risk: revealed by isolating the MEP layer.
      entityId: ENTITY_IDS.duct,
      contentDigest: digestOf(`${ENTITY_IDS.duct}@1`),
      entityType: 'mep:duct',
      representationRecordId: 'ont-dw-pipe',
      label: 'Legacy duct run',
      position: [10, 5, -8],
      visible: false,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.panel,
      contentDigest: digestOf(`${ENTITY_IDS.panel}@1`),
      entityType: 'mep:panel',
      representationRecordId: 'ont-dw-panel',
      label: 'Main distribution panel',
      position: [0, 5, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.riser,
      contentDigest: digestOf(`${ENTITY_IDS.riser}@1`),
      entityType: 'mep:riser',
      representationRecordId: 'ont-dw-pipe',
      label: 'Chilled-water riser',
      position: [10, 5, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.slab,
      contentDigest: digestOf(`${ENTITY_IDS.slab}@1`),
      entityType: 'site:structure',
      representationRecordId: 'ont-dw-slab',
      label: 'Basement slab',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS.staging,
      contentDigest: digestOf(`${ENTITY_IDS.staging}@1`),
      entityType: 'delivery:zone',
      representationRecordId: 'ont-dw-zone',
      label: 'Staging yard',
      position: [-14, 0, 0],
      visible: true,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS.riser],
  overlays: [
    {
      overlayId: 'ovl-dw-measure-run',
      overlayKind: 'measurement',
      fromEntityId: ENTITY_IDS.panel,
      toEntityId: ENTITY_IDS.riser,
      label: 'Panel-to-riser run',
    },
    {
      overlayId: 'ovl-dw-slab-state',
      overlayKind: 'state',
      entityId: ENTITY_IDS.slab,
      stateKey: 'pour-cured',
      tint: '#15803d',
      badgeLabel: 'cured',
    },
  ],
  appliedOverlays: [{ overlayId: 'ovl-dw-slab-state', orderIndex: 0 }],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-dw-baseline', atMs: 0, label: 'Baseline survey', markerKind: 'event' },
      { markerId: 'mrk-dw-branch', atMs: BRANCH_AT_MS, label: 'Delivery branch', markerKind: 'branch-point' },
      { markerId: 'mrk-dw-close', atMs: 8_000, label: 'Window closes', markerKind: 'event' },
    ],
    trackLabel: 'Delivery replay',
    trackStartMs: TRACK.startMs,
    trackEndMs: TRACK.endMs,
    position: { atMs: TRACK.positionAtMs, frameIndex: 60, paused: false },
  },
  camera: { mode: 'orbit', position: [26, 19, 26], target: [3, 2, 0], fovRadians: Math.PI / 4 },
  participants: [],
  agents: [
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
      controlId: 'ctl-dw-branch',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.branch', version: '1.0.0' },
      label: 'Branch delivery',
    },
    {
      controlId: 'ctl-dw-pause',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.pause', version: '1.0.0' },
      label: 'Pause replay',
    },
    {
      controlId: 'ctl-dw-simulate',
      controlKind: 'button',
      intent: { id: 'epoch.world.interaction.simulate', version: '1.0.0' },
      label: 'Simulate hoist',
    },
  ],
};

/** The sealed canonical scene the desktop world host presents. */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`world-host scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The desktop device session snapshot (the full-fidelity W011 slot). */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-desktop-world-1',
  tenantScope: { tenantId: TENANT },
  device: DESKTOP_DEVICE,
};

// ---------------------------------------------------------------------------
// The renderers behind the seam.
// ---------------------------------------------------------------------------

export const FULL_RENDERER_ID = 'rr-desktop-world-full';
export const REDUCED_RENDERER_ID = 'rr-desktop-world-reduced';

const DESCRIPTOR_FULL: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: FULL_RENDERER_ID,
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: { stereoscopic: false, maxPixels: 8_294_400, refreshHz: 144, colorDepthBits: 24 },
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

/** The W013 renderer ids of the REAL engine adapters (re-exported for the section). */
export { THREE_RENDERER_ID } from '@epoch/adapter-renderer-threejs';
export { BABYLONJS_RENDERER_ID } from '@epoch/adapter-renderer-babylonjs';

/** The renderer ids whose presenters draw real engine pixels. */
export const ENGINE_RENDERER_IDS: readonly string[] = [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID];

/** Whether one renderer id presents through a real engine (pixels). */
export function isEngineRenderer(rendererId: string): boolean {
  return (ENGINE_RENDERER_IDS as readonly string[]).includes(rendererId);
}

/** The construction inputs of the desktop world fabric (real engines + fallbacks). */
export interface DesktopWorldFabricOptions {
  /** The REAL Three.js adapter (the section injects the browser GL surface). */
  readonly three: ThreeJsRendererAdapter;
  /** The REAL Babylon.js adapter (the section injects the browser engine host). */
  readonly babylon: BabylonRendererAdapter;
}

/** The built fabric + its real adapters (evidence helpers for the section/tests). */
export interface DesktopWorldFabric {
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
}

/**
 * Build the desktop world fabric (W061): the REAL Three.js and Babylon.js
 * renderers registered through the REAL capability registry ahead of the
 * contract-only reference pair (the declared fallback chain of the desktop
 * world host). The REAL adapters register under their OWN capability
 * identities (`epoch.renderer.three` / `epoch.renderer.babylonjs` — the
 * registry requires the manifest capability id to equal the adapter
 * identity's); the reference pair keeps its host-scoped identities.
 */
export function buildWorldFabric(
  options?: DesktopWorldFabricOptions,
): DesktopWorldFabric {
  const three = options?.three ?? new ThreeJsRendererAdapter();
  const babylon =
    options?.babylon ?? new BabylonRendererAdapter({ host: nullEngineHost() });
  const fabric = new RendererFabric();
  const entries: readonly { readonly adapter: RendererAdapter }[] = [
    { adapter: three },
    { adapter: babylon },
    {
      adapter: new ReferenceRendererAdapter({
        identity: {
          capabilityId: 'epoch.renderer.desktop-world-full',
          rendererId: FULL_RENDERER_ID,
          displayName: 'World Full (reference)',
        },
        descriptor: DESCRIPTOR_FULL,
        capabilities: CAPABILITIES_FULL,
      }),
    },
    {
      adapter: new ReferenceRendererAdapter({
        identity: {
          capabilityId: 'epoch.renderer.desktop-world-reduced',
          rendererId: REDUCED_RENDERER_ID,
          displayName: 'World Reduced (reference)',
        },
        descriptor: DESCRIPTOR_REDUCED,
        capabilities: CAPABILITIES_REDUCED,
      }),
    },
  ] as const;
  for (const entry of entries) {
    const identity = entry.adapter.identity();
    const manifest = rendererCapabilityManifestOf({
      capabilityId: identity.capabilityId,
      version: '1.0.0',
      descriptor: entry.adapter.descriptor(),
      capabilities: entry.adapter.capabilities(),
      displayName: identity.displayName,
      description: identity.description,
    });
    const sealed = sealCapabilityManifest(manifest);
    if (!sealed.ok) {
      throw new Error(`world-host manifest failed to seal: ${sealed.error.message}`);
    }
    const registered = fabric.adapters.register({
      manifest: sealed.value.manifest,
      digest: sealed.value.digest,
      adapter: entry.adapter,
    });
    if (!registered.ok) {
      throw new Error(`world-host renderer failed to register: ${registered.error.message}`);
    }
  }
  return { fabric, three, babylon };
}

/**
 * The ordered renderer preference of the desktop world host (W061): the
 * REAL Three.js renderer first, the REAL Babylon.js renderer second, the
 * contract-only reference pair as the declared fallback chain.
 */
export const RENDERER_PREFERENCE: readonly string[] = [
  THREE_RENDERER_ID,
  BABYLONJS_RENDERER_ID,
  FULL_RENDERER_ID,
  REDUCED_RENDERER_ID,
];
