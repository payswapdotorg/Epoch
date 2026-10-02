/**
 * W059 unit-battery helpers — REAL product machinery, no fabric needed:
 * a local canonical W016 scene (admitted + sealed through the REAL W016
 * total admission), compiled through the REAL W016 compiler, and bound
 * through the REAL W013 admission boundary. The adapter is exercised
 * DIRECTLY at the seam (the fabric-driven shared-fixture battery lives in
 * qa/renderer-conformance/babylonjs).
 *
 * Determinism: fixed virtual times, fixed ids, byte-stable scene.
 */
import {
  bindRendererSession,
  type DeviceSessionSnapshot,
  type RendererBinding,
  type WorldProjectionRef,
} from '@epoch/renderer-runtime';
import {
  admitWorldScene,
  compileWorldScene,
  registerOntologyRecords,
  sealWorldSceneContent,
  type SceneCompilation,
  type WorldOntology,
  type WorldOntologyRecord,
  type WorldScene,
  type WorldSceneContent,
} from '@epoch/world-experience';
import { emptyPortableViewState, type PortableViewState } from '@epoch/renderer-runtime';
import { BABYLONJS_RENDERER_ID } from '../src/version';

/** The unit-battery tenant. */
export const TENANT = 'tenant-babylonjs-unit';

/** The unit-battery scene id. */
export const SCENE_ID = 'wsc-babylonjs-unit-1';

/** The unit-battery entity ids (sorted; gamma is hidden, delta is a mesh asset). */
export const ENTITY_IDS = [
  'we-test-alpha',
  'we-test-beta',
  'we-test-delta',
  'we-test-gamma',
] as const;

/** The semantic layers the unit battery partitions into. */
export const LAYER_PRIMARY = 'lyr-primary';
export const LAYER_SECONDARY = 'lyr-secondary';

/** The unit-battery virtual clock (fixed). */
export const CLOCK = {
  created: 1_000,
  mounted: 2_000,
  firstFrame: 3_000,
  input: 3_500,
  snapshot: 4_000,
  restore: 4_500,
} as const;

/** The unit-battery device session (desktop, pointer + keyboard). */
export const DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-babylonjs-unit-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
  },
};

/** Deterministic pseudo-content digests (opaque world references). */
export function digestOf(seed: string): string {
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

/** The unit-battery ontology (box + sphere + steel material + 2D symbol). */
export const ONTOLOGY: WorldOntology = (() => {
  const records: WorldOntologyRecord[] = [
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-box',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-babylonjs-unit' },
      appliesTo: ['test:box'],
      primitive: 'box',
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-sphere',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-babylonjs-unit' },
      appliesTo: ['test:sphere'],
      primitive: 'sphere',
      materialRecordId: 'ont-mat-steel',
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-mesh',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-babylonjs-unit' },
      appliesTo: ['test:mesh'],
      primitive: 'mesh',
      mesh: { assetDigest: digestOf('mesh-asset-1'), byteSize: 2048, mediaType: 'model/gltf+json' },
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-mat-steel',
      recordKind: 'material',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-babylonjs-unit' },
      color: '#8899aa',
      roughness: 0.4,
      metalness: 0.8,
    },
  ];
  const registered = registerOntologyRecords({ records: [] }, records);
  if (!registered.ok) {
    throw new Error(`unit ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
})();

/** The unit-battery canonical scene content (admitted + sealed below). */
const SCENE_CONTENT: WorldSceneContent = {
  schema: 'epoch.world-scene',
  protocolVersion: '1.0.0',
  sceneId: SCENE_ID,
  tenantScope: { tenantId: TENANT },
  name: 'Babylon.js Adapter Unit World',
  entities: [
    {
      entityId: ENTITY_IDS[0],
      contentDigest: digestOf(`${ENTITY_IDS[0]}@1`),
      entityType: 'test:box',
      representationRecordId: 'ont-rep-box',
      label: 'Alpha box',
      position: [0, 0, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[1],
      contentDigest: digestOf(`${ENTITY_IDS[1]}@1`),
      entityType: 'test:sphere',
      representationRecordId: 'ont-rep-sphere',
      label: 'Beta sphere',
      position: [12, 0, 0],
      orientation: [0, 0, 0, 1],
      scale: [1.5, 1.5, 1.5],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[2],
      contentDigest: digestOf(`${ENTITY_IDS[2]}@1`),
      entityType: 'test:mesh',
      representationRecordId: 'ont-rep-mesh',
      position: [0, 12, 0],
      visible: true,
      isolated: false,
    },
    {
      entityId: ENTITY_IDS[3],
      contentDigest: digestOf(`${ENTITY_IDS[3]}@1`),
      entityType: 'test:sphere',
      representationRecordId: 'ont-rep-sphere',
      position: [12, 12, 0],
      visible: false,
      isolated: false,
    },
  ],
  focusedEntityIds: [ENTITY_IDS[0]],
  overlays: [
    { overlayId: 'ovl-highlight-beta', overlayKind: 'highlight', entityId: ENTITY_IDS[1], color: '#ffcc00' },
    { overlayId: 'ovl-measure', overlayKind: 'measurement', fromEntityId: ENTITY_IDS[0], toEntityId: ENTITY_IDS[1], label: 'span' },
    { overlayId: 'ovl-note-alpha', overlayKind: 'annotation', entityId: ENTITY_IDS[0], text: 'unit annotation' },
  ],
  appliedOverlays: [
    { overlayId: 'ovl-highlight-beta', orderIndex: 0 },
    { overlayId: 'ovl-measure', orderIndex: 1 },
    { overlayId: 'ovl-note-alpha', orderIndex: 2 },
  ],
  animations: [
    {
      instructionId: 'ani-alpha-rise',
      targetEntityId: ENTITY_IDS[0],
      propertyPath: 'position',
      keyframes: [
        { atMs: 0, value: [0, 0, 0] },
        { atMs: 2_000, value: [0, 4, 0] },
      ],
      easing: 'linear',
      durationMs: 2_000,
      loop: false,
    },
  ],
  narrativeBlocks: [],
  timeline: {
    markers: [
      { markerId: 'mrk-start', atMs: 0, label: 'Start', markerKind: 'event' },
      { markerId: 'mrk-end', atMs: 4_000, label: 'End', markerKind: 'event' },
    ],
    trackLabel: 'Unit track',
    trackStartMs: 0,
    trackEndMs: 4_000,
    position: { atMs: 1_000, frameIndex: 60, paused: false },
  },
  camera: { mode: 'orbit', position: [26, 20, 26], target: [6, 6, 0] },
  participants: [],
  agents: [
    { kind: 'agent', tenantId: TENANT, agentId: 'agent:unit-observer', contentDigest: digestOf('agent-unit-observer@1') },
  ],
  evidenceReferences: [],
  controls: [],
};

/** The sealed unit-battery canonical scene (the continuity anchor). */
export const SCENE: WorldScene = (() => {
  const admitted = admitWorldScene(SCENE_CONTENT, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`unit scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The unit-battery world projection reference. */
export const WORLD_PROJECTION: WorldProjectionRef = {
  sceneId: SCENE.sceneId,
  worldDigest: SCENE.digest,
  tenantScope: SCENE.tenantScope,
};

/** The unit-battery initial portable view state. */
export function unitViewState(): PortableViewState {
  return {
    focusedEntityIds: [ENTITY_IDS[0]],
    layerVisibility: [
      { layerId: LAYER_PRIMARY, visible: true },
      { layerId: LAYER_SECONDARY, visible: false },
    ],
    timelinePosition: { atMs: 1_500, frameIndex: 90, paused: false },
    camera: { mode: 'orbit', position: [32, 22, 32], target: [6, 6, 0] },
    hiddenEntityIds: [],
  };
}

/** Bind a REAL W013 renderer session for the adapter (the W013 boundary). */
export function unitBinding(boundAtMs: number): RendererBinding {
  const bound = bindRendererSession(
    {
      rendererSessionId: 'rs-babylonjs-unit-1',
      renderer: {
        descriptorVersion: 1,
        rendererId: BABYLONJS_RENDERER_ID,
        graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
        interaction: ['keyboard', 'pointer', 'touch'],
        output: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
        budgets: {
          maxGraphNodes: 4_096,
          maxGraphEdges: 8_192,
          maxTriangles: 1_000_000,
          maxTextureBytes: 268_435_456,
        },
      },
      device: DEVICE,
      boundAtMs,
    },
    { expectedTenantId: TENANT },
  );
  if (!bound.ok) {
    throw new Error(`unit binding failed W013 admission: ${bound.error.message}`);
  }
  return bound.value;
}

/** Compile the unit scene through the REAL W016 compiler. */
export function unitCompilation(): SceneCompilation {
  const compiled = compileWorldScene(SCENE, {
    ontology: ONTOLOGY,
    device: DEVICE.device,
    invocation: { invocationId: 'wi-unit-mount-1', rendererSessionId: 'rs-babylonjs-unit-1', atMs: CLOCK.mounted },
  });
  if (!compiled.ok) {
    throw new Error(`unit compilation failed: ${compiled.error.message}`);
  }
  return compiled.value;
}

/** The visible entities of the unit scene (sorted — the presented set). */
export const PRESENTED_ENTITY_IDS: readonly string[] = [ENTITY_IDS[0], ENTITY_IDS[1], ENTITY_IDS[2]];

/** One raw pointer input envelope (pre-normalization). */
export function pointerInput(
  fabricSessionId: string,
  inputId: string,
  inputKind: 'pointer-down' | 'pointer-move' | 'pointer-up',
  x: number,
  y: number,
  atMs: number,
  intentHint?: { id: string; version: string },
) {
  return {
    schema: 'epoch.renderer-input-envelope' as const,
    fabricProtocolVersion: '1.0.0' as const,
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer' as const,
    inputKind,
    pointer: { x, y },
    ...(intentHint !== undefined ? { intentHint: { intent: intentHint } } : {}),
  };
}

/** One raw wheel input envelope. */
export function wheelInputOf(fabricSessionId: string, inputId: string, deltaY: number, atMs: number) {
  return {
    schema: 'epoch.renderer-input-envelope' as const,
    fabricProtocolVersion: '1.0.0' as const,
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer' as const,
    inputKind: 'wheel' as const,
    delta: { x: 0, y: deltaY },
  };
}

/** One raw key input envelope. */
export function keyInputOf(
  fabricSessionId: string,
  inputId: string,
  inputKind: 'key-down' | 'key-up',
  key: string,
  modifiers: string[],
  atMs: number,
) {
  return {
    schema: 'epoch.renderer-input-envelope' as const,
    fabricProtocolVersion: '1.0.0' as const,
    inputId,
    fabricSessionId,
    atMs,
    modality: 'keyboard' as const,
    inputKind,
    key: { key, modifiers },
  };
}

/** One frame envelope (the fabric emits these after W013 admission). */
export function frameEnvelopeOf(
  fabricSessionId: string,
  frameIndex: number,
  degradation: 'none' | 'reduced-fidelity' | 'static-frame' | 'wireframe',
  atMs: number,
) {
  return {
    schema: 'epoch.renderer-frame-envelope' as const,
    fabricProtocolVersion: '1.0.0' as const,
    fabricSessionId,
    frameIndex,
    atMs,
    worldDigest: SCENE.digest,
    degradation,
    admissionDigest: digestOf(`frame-${frameIndex}`),
  };
}

/** The empty portable view state at a virtual time (W013 helper). */
export { emptyPortableViewState };
