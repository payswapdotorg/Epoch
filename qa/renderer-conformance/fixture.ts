/**
 * THE SHARED CONFORMANCE FIXTURE (W056) — ONE canonical world, TWO
 * distinguishable renderer kinds, and the fabric wired through the REAL
 * capability registry.
 *
 * Everything here is REAL product machinery — no test doubles:
 * - the canonical world is a REAL W016 `WorldScene`, admitted through the
 *   W016 total admission (schema + semantic gates) and sealed
 *   content-addressed;
 * - the renderers are TWO instances of the contract-only reference
 *   adapter (a full-capability 3D-class renderer and a reduced
 *   2D-class renderer — distinguishable capability sets, the seam
 *   template W058/W059 replace with real engines);
 * - registration goes through the REAL `@epoch/capability-registry`
 *   (sealed, digest-verified, `visualization`-category manifests
 *   honoring the frozen `epoch.renderers` contract);
 * - the fabric is the REAL `RendererFabric` — every binding and
 *   invocation goes through the REAL W013 admission boundary.
 *
 * Determinism: zero wall-clock, zero randomness. All times are fixed
 * virtual times; all ids are fixed caller-scoped slugs; the fixture is
 * byte-stable across runs (the same scene always digests identically).
 *
 * This module is imported by BOTH conformance batteries; it deliberately
 * contains no assertions — it is the FIXTURE, not the checks.
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
  PortableViewState,
  RendererCapabilitySet,
  RendererDescriptor,
  RendererSession,
  WorldProjectionRef,
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

// ---------------------------------------------------------------------------
// Fixture identity (all deterministic).
// ---------------------------------------------------------------------------

/** The tenant the shared fixture world belongs to. */
export const TENANT = 'tenant-conformance';

/** A second tenant (cross-tenant negative checks only). */
export const TENANT_OTHER = 'tenant-foreign';

/** The canonical scene id (W016 `wsc-` grammar). */
export const SCENE_ID = 'wsc-conformance-1';

/** The four semantic entities of the fixture world (sorted ids; gamma is hidden). */
export const ENTITY_IDS = [
  'we-conformance-alpha',
  'we-conformance-beta',
  'we-conformance-delta',
  'we-conformance-gamma',
] as const;

/** The semantic layer the fixture world partitions its entities into. */
export const LAYER_STRUCTURE = 'lyr-structure';
export const LAYER_UTILITIES = 'lyr-utilities';

// ---------------------------------------------------------------------------
// The canonical ontology (pack-contributable presentation recipes).
// ---------------------------------------------------------------------------

const ONTOLOGY_RECORDS: WorldOntologyRecord[] = [
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-structure',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-conformance' },
    appliesTo: ['conformance:structure'],
    primitive: 'box',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-rep-node',
    recordKind: 'representation-3d',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-conformance' },
    appliesTo: ['conformance:node'],
    primitive: 'sphere',
    materialRecordId: 'ont-mat-steel',
  },
  {
    ontologyVersion: 1,
    recordId: 'ont-mat-steel',
    recordKind: 'material',
    tenantScope: { tenantId: TENANT },
    contributor: { packId: 'pack-conformance' },
    color: '#8899aa',
    roughness: 0.4,
    metalness: 0.8,
  },
];

/** The fixture ontology (records admitted through the real registration). */
export const ONTOLOGY: WorldOntology = (() => {
  const registered = registerOntologyRecords({ records: [] }, ONTOLOGY_RECORDS);
  if (!registered.ok) {
    throw new Error(`fixture ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

// ---------------------------------------------------------------------------
// The canonical world scene (admitted + sealed through the REAL W016
// total admission — schema validation, canonical ordering, semantic gates).
// ---------------------------------------------------------------------------

function digestOf(seed: string): string {
  // Deterministic pseudo-content digests for the opaque world-entity
  // references (the world model is authoritative elsewhere; the fixture
  // only needs stable, distinct, well-formed digests).
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
  name: 'Conformance Fixture World',
  entities: [
    {
      entityId: ENTITY_IDS[0],
      contentDigest: digestOf(`${ENTITY_IDS[0]}@1`),
      entityType: 'conformance:structure',
      representationRecordId: 'ont-rep-structure',
      label: 'Foundation slab',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[1],
      contentDigest: digestOf(`${ENTITY_IDS[1]}@1`),
      entityType: 'conformance:structure',
      representationRecordId: 'ont-rep-structure',
      label: 'Primary frame',
      position: [10, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[2],
      contentDigest: digestOf(`${ENTITY_IDS[2]}@1`),
      entityType: 'conformance:node',
      representationRecordId: 'ont-rep-node',
      label: 'Utility node delta',
      position: [0, 10, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[3],
      contentDigest: digestOf(`${ENTITY_IDS[3]}@1`),
      entityType: 'conformance:node',
      representationRecordId: 'ont-rep-node',
      position: [10, 10, 0],
      visible: false,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS[1]],
  overlays: [
    {
      overlayId: 'ovl-highlight-frame',
      overlayKind: 'highlight',
      entityId: ENTITY_IDS[1],
      color: '#ffcc00',
    },
  ],
  appliedOverlays: [{ overlayId: 'ovl-highlight-frame', orderIndex: 0 }],
  animations: [],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-start', atMs: 0, label: 'Replay window opens', markerKind: 'event' },
      { markerId: 'mrk-branch', atMs: 4_000, label: 'Branch point', markerKind: 'branch-point' },
      { markerId: 'mrk-end', atMs: 8_000, label: 'Replay window closes', markerKind: 'event' },
    ],
    trackLabel: 'Conformance replay track',
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
      agentId: 'agent:conformance-observer',
      contentDigest: digestOf('agent-conformance-observer@1'),
    },
  ],
  evidenceReferences: [],
  controls: [],
};

/**
 * The shared canonical world scene: admitted through the REAL W016 total
 * admission (tenant-gated) and sealed content-addressed. THIS OBJECT IS
 * THE CONTINUITY ANCHOR — the batteries prove it is never mutated.
 */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`fixture scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The canonical world projection reference (identity continuity triple). */
export const WORLD_PROJECTION: WorldProjectionRef = {
  sceneId: SCENE.sceneId,
  worldDigest: SCENE.digest,
  tenantScope: SCENE.tenantScope,
};

// ---------------------------------------------------------------------------
// The device session (W013 snapshot over the W011 desktop vocabulary).
// ---------------------------------------------------------------------------

/** A deterministic desktop device session for the fixture tenant. */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-conformance-1',
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
// The two reference renderers (distinguishable kinds, the seam template).
// ---------------------------------------------------------------------------

/** The full-capability renderer kind: 3D-class, measurement + annotation. */
export const RENDERER_A_ID = 'rr-conformance-full';

/** The reduced renderer kind: 2D-class, no camera portability, no measure. */
export const RENDERER_B_ID = 'rr-conformance-reduced';

/** The full renderer's W013 descriptor (full graph kinds, pointer + keys). */
export const DESCRIPTOR_A: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: RENDERER_A_ID,
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

/** The reduced renderer's W013 descriptor (tighter budgets, pointer only). */
export const DESCRIPTOR_B: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: RENDERER_B_ID,
  graphKinds: ['2d', '3d', 'timeline-replay'],
  interaction: ['pointer'],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
  },
  budgets: {
    maxGraphNodes: 1_024,
    maxGraphEdges: 2_048,
    maxTriangles: 64_000,
    maxTextureBytes: 67_108_864,
  },
};

/** The full renderer's capability set (every portable field, full degrade). */
export const CAPABILITIES_A: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: RENDERER_A_ID,
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

/** The reduced renderer's capability set (no camera restore, no measure). */
export const CAPABILITIES_B: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: RENDERER_B_ID,
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

/** Build the full reference renderer adapter instance. */
export function fullRenderer(): ReferenceRendererAdapter {
  return new ReferenceRendererAdapter({
    identity: {
      capabilityId: 'epoch.renderer.conformance-full',
      rendererId: RENDERER_A_ID,
      displayName: 'Conformance Full Renderer (reference)',
      description: 'Contract-only reference renderer: full capability set.',
    },
    descriptor: DESCRIPTOR_A,
    capabilities: CAPABILITIES_A,
  });
}

/** Build the reduced reference renderer adapter instance. */
export function reducedRenderer(): ReferenceRendererAdapter {
  return new ReferenceRendererAdapter({
    identity: {
      capabilityId: 'epoch.renderer.conformance-reduced',
      rendererId: RENDERER_B_ID,
      displayName: 'Conformance Reduced Renderer (reference)',
      description: 'Contract-only reference renderer: reduced capability set (no camera restore, no measure).',
    },
    descriptor: DESCRIPTOR_B,
    capabilities: CAPABILITIES_B,
  });
}

/**
 * Register one renderer adapter with the fabric's registry: a sealed,
 * digest-verified `visualization`-category capability manifest honoring
 * the frozen `epoch.renderers` contract — the REAL registration path
 * W058/W059 adapters take.
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

/**
 * The shared fabric: both reference renderers registered through the REAL
 * capability registry. Each battery builds its own instance (sessions are
 * ephemeral per-run presentation state; registration is per-fabric).
 */
export function buildFabric(): {
  readonly fabric: RendererFabric;
  readonly full: ReferenceRendererAdapter;
  readonly reduced: ReferenceRendererAdapter;
} {
  const fabric = new RendererFabric();
  const full = fullRenderer();
  const reduced = reducedRenderer();
  registerRenderer(fabric, full);
  registerRenderer(fabric, reduced);
  return { fabric, full, reduced };
}

// ---------------------------------------------------------------------------
// The portable view state the batteries carry across switches.
// ---------------------------------------------------------------------------

/** The deterministic portable view state of the fixture world. */
export function fixtureViewState(): PortableViewState {
  return {
    focusedEntityIds: [ENTITY_IDS[1]],
    layerVisibility: [
      { layerId: LAYER_STRUCTURE, visible: true },
      { layerId: LAYER_UTILITIES, visible: false },
    ],
    timelinePosition: { atMs: 3_000, frameIndex: 90, paused: false },
    camera: { mode: 'orbit', position: [30, 20, 30], target: [5, 5, 0] },
    hiddenEntityIds: [],
  };
}

// ---------------------------------------------------------------------------
// Raw input builders (pre-normalization envelopes; the W013 grammar).
// ---------------------------------------------------------------------------

/** Build one raw pointer-down input envelope for a session. */
export function pointerDown(
  fabricSessionId: string,
  inputId: string,
  x: number,
  atMs: number,
  intentHint?: { id: string; version: string },
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer',
    inputKind: 'pointer-down',
    pointer: { x, y: 0.5 },
    ...(intentHint !== undefined ? { intentHint: { intent: intentHint } } : {}),
  };
}

/** Build one raw wheel input envelope for a session. */
export function wheelInput(
  fabricSessionId: string,
  inputId: string,
  deltaY: number,
  atMs: number,
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer',
    inputKind: 'wheel',
    delta: { x: 0, y: deltaY },
  };
}

// ---------------------------------------------------------------------------
// The virtual clock (fixed, deterministic; the batteries share it).
// ---------------------------------------------------------------------------

/** The shared virtual times of one conformance run. */
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

/**
 * The semantic entities the reference renderers PRESENT: the fixture
 * scene's visible entities in sorted order (the deterministic hit-test
 * partition basis — the same normalized pointer resolves the same entity
 * on both renderers).
 */
export const PRESENTED_ENTITY_IDS: readonly string[] = [...ENTITY_IDS.slice(0, 3)];

/** Map a normalized pointer x to the entity the reference renderers hit. */
export function hitEntityOf(x: number): string {
  const count = PRESENTED_ENTITY_IDS.length;
  const index = Math.min(count - 1, Math.max(0, Math.floor(x * count)));
  return PRESENTED_ENTITY_IDS[index]!;
}

// ---------------------------------------------------------------------------
// The standard flow (create + mount the FULL renderer session) + reads.
// ---------------------------------------------------------------------------

/**
 * Create + mount the FULL renderer session `fx-conformance-1` (the
 * standard flow start every battery shares). Throws readable errors so
 * test failures stay diagnosable.
 */
export async function mountFullSession(fabric: RendererFabric): Promise<RendererSession> {
  const created = await fabric.createSession({
    rendererId: RENDERER_A_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId: 'fx-conformance-1',
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`conformance session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene('fx-conformance-1', {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`conformance mount failed: ${mounted.error.message}`);
  }
  return mounted.value;
}

/** The lifecycle state of one fabric session (readable failure on miss). */
export function sessionStateOf(fabric: RendererFabric, fabricSessionId: string): string {
  const record = fabric.session(fabricSessionId);
  if (!record.ok) {
    throw new Error(`session read failed: ${record.error.message}`);
  }
  return record.value.state;
}

/**
 * A second canonical scene of the SAME tenant with DIFFERENT content (a
 * different world revision — the digest-continuity negative checks).
 */
export const VARIANT_SCENE: WorldScene = (() => {
  const content = structuredClone(SCENE) as Record<string, unknown>;
  delete content.digest;
  content.name = 'Conformance Fixture World (variant revision)';
  const admitted = admitWorldScene(content, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`variant scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();
