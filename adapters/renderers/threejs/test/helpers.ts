/**
 * The W058 unit-test fixture builders — REAL product machinery, no test
 * doubles: a canonical W016 scene admitted through the REAL W016 total
 * admission, a REAL ontology, the REAL W013 binding surface, and the REAL
 * adapter. Everything is deterministic (fixed virtual times, fixed ids,
 * stable digests) and HEADLESS (no GPU, no DOM).
 */
import { ThreeJsRendererAdapter } from '../src/index';
import type { RendererAdapterSession, RendererMountReport } from '@epoch/renderer-fabric';
import {
  bindRendererSession,
  RendererInputEnvelopeSchema,
  type DeviceSessionSnapshot,
  type RendererBinding,
  type PortableViewState,
  type RendererInputEnvelope,
} from '@epoch/renderer-runtime';
import {
  admitWorldScene,
  compileWorldScene,
  registerOntologyRecords,
  sealWorldSceneContent,
  type WorldOntology,
  type WorldOntologyRecord,
  type WorldScene,
  type WorldSceneContent,
} from '@epoch/world-experience';

/** The unit-fixture tenant. */
export const TENANT = 'tenant-threejs-unit';

/** The six semantic entities of the unit-fixture world (gamma is hidden). */
export const UNIT_ENTITY_IDS = [
  'we-unit-alpha',
  'we-unit-beta',
  'we-unit-delta',
  'we-unit-epsilon',
  'we-unit-gamma',
  'we-unit-zeta',
] as const;

/** The unit-fixture agent. */
export const UNIT_AGENT_ID = 'agent:unit-observer';

/** The unit-fixture participant. */
export const UNIT_PARTICIPANT_ID = 'prt-unit-inspector';

/** The unit-fixture ontology: three representation recipes + one material. */
export const UNIT_ONTOLOGY: WorldOntology = (() => {
  const records: WorldOntologyRecord[] = [
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-box',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-unit' },
      appliesTo: ['unit:structure'],
      primitive: 'box',
      scale: [2, 2, 2],
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-sphere',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-unit' },
      appliesTo: ['unit:node'],
      primitive: 'sphere',
      materialRecordId: 'ont-mat-unit',
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-rep-cylinder',
      recordKind: 'representation-3d',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-unit' },
      appliesTo: ['unit:utility'],
      primitive: 'cylinder',
    },
    {
      ontologyVersion: 1,
      recordId: 'ont-mat-unit',
      recordKind: 'material',
      tenantScope: { tenantId: TENANT },
      contributor: { packId: 'pack-unit' },
      color: '#4060a0',
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.2,
    },
  ];
  const registered = registerOntologyRecords({ records: [] }, records);
  if (!registered.ok) {
    throw new Error(`unit ontology failed registration: ${registered.error.message}`);
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

/** The unit-fixture canonical scene (admitted + sealed through the REAL W016 admission). */
export const UNIT_SCENE: WorldScene = (() => {
  const content: WorldSceneContent = {
    schema: 'epoch.world-scene',
    protocolVersion: '1.0.0',
    sceneId: 'wsc-threejs-unit-1',
    tenantScope: { tenantId: TENANT },
    name: 'Three.js Unit Fixture World',
    entities: [
      {
        entityId: UNIT_ENTITY_IDS[0],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[0]}@1`),
        entityType: 'unit:structure',
        representationRecordId: 'ont-rep-box',
        label: 'Foundation slab',
        position: [0, 0, 0],
        visible: true,
        isolated: false,
      },
      {
        entityId: UNIT_ENTITY_IDS[1],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[1]}@1`),
        entityType: 'unit:structure',
        representationRecordId: 'ont-rep-box',
        label: 'Primary frame',
        position: [10, 0, 0],
        visible: true,
        isolated: false,
      },
      {
        entityId: UNIT_ENTITY_IDS[2],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[2]}@1`),
        entityType: 'unit:node',
        representationRecordId: 'ont-rep-sphere',
        label: 'Utility node delta',
        position: [0, 10, 0],
        visible: true,
        isolated: false,
      },
      {
        entityId: UNIT_ENTITY_IDS[3],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[3]}@1`),
        entityType: 'unit:utility',
        representationRecordId: 'ont-rep-cylinder',
        position: [10, 10, 0],
        visible: true,
        isolated: false,
      },
      {
        entityId: UNIT_ENTITY_IDS[4],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[4]}@1`),
        entityType: 'unit:node',
        representationRecordId: 'ont-rep-sphere',
        position: [20, 0, 0],
        visible: false,
        isolated: false,
      },
      {
        entityId: UNIT_ENTITY_IDS[5],
        contentDigest: digestOf(`${UNIT_ENTITY_IDS[5]}@1`),
        entityType: 'unit:utility',
        representationRecordId: 'ont-rep-cylinder',
        position: [0, 20, 0],
        visible: true,
        isolated: false,
      },
    ],
    focusedEntityIds: [UNIT_ENTITY_IDS[1]],
    overlays: [
      {
        overlayId: 'ovl-unit-annotation',
        overlayKind: 'annotation',
        entityId: UNIT_ENTITY_IDS[3],
        text: 'annotated utility',
      },
      {
        overlayId: 'ovl-unit-highlight',
        overlayKind: 'highlight',
        entityId: UNIT_ENTITY_IDS[1],
        color: '#ffcc00',
      },
      {
        overlayId: 'ovl-unit-measure',
        overlayKind: 'measurement',
        fromEntityId: UNIT_ENTITY_IDS[0],
        toEntityId: UNIT_ENTITY_IDS[1],
        label: 'span',
      },
      {
        overlayId: 'ovl-unit-state',
        overlayKind: 'state',
        entityId: UNIT_ENTITY_IDS[2],
        stateKey: 'commissioned',
        tint: '#2fae62',
        badgeLabel: 'OK',
      },
    ],
    appliedOverlays: [
      { overlayId: 'ovl-unit-highlight', orderIndex: 0 },
      { overlayId: 'ovl-unit-state', orderIndex: 1 },
      { overlayId: 'ovl-unit-measure', orderIndex: 2 },
      { overlayId: 'ovl-unit-annotation', orderIndex: 3 },
    ],
    animations: [
      {
        instructionId: 'ani-unit-orbit-delta',
        targetEntityId: UNIT_ENTITY_IDS[2],
        propertyPath: 'position.y',
        keyframes: [
          { atMs: 0, value: 10, easing: 'linear' },
          { atMs: 4_000, value: 16, easing: 'linear' },
          { atMs: 8_000, value: 10, easing: 'linear' },
        ],
        easing: 'linear',
        durationMs: 8_000,
        loop: true,
      },
    ],
    narrativeBlocks: [],
    timeline: {
      markers: [
        { markerId: 'mrk-unit-start', atMs: 0, label: 'start', markerKind: 'event' },
        { markerId: 'mrk-unit-end', atMs: 10_000, label: 'end', markerKind: 'event' },
      ],
      trackLabel: 'Unit replay track',
      trackStartMs: 0,
      trackEndMs: 10_000,
      position: { atMs: 1_000, frameIndex: 30, paused: false },
    },
    camera: { mode: 'orbit', position: [26, 20, 26], target: [8, 6, 0] },
    participants: [
      {
        participantId: UNIT_PARTICIPANT_ID,
        participantKind: 'human',
      },
    ],
    agents: [
      {
        kind: 'agent',
        tenantId: TENANT,
        agentId: UNIT_AGENT_ID,
        contentDigest: digestOf('agent-unit-observer@1'),
      },
    ],
    evidenceReferences: [],
    controls: [],
  };
  const admitted = admitWorldScene(content, { expectedTenantId: TENANT });
  if (!admitted.ok) {
    throw new Error(`unit scene failed W016 admission: ${admitted.error.message}`);
  }
  return sealWorldSceneContent(admitted.value);
})();

/** The unit-fixture device session (desktop, pointer + keyboard). */
export const UNIT_DEVICE: DeviceSessionSnapshot = {
  deviceSessionId: 'ds-threejs-unit-1',
  tenantScope: { tenantId: TENANT },
  device: {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
  },
};

/** The unit-fixture portable view state. */
export function unitViewState(): PortableViewState {
  return {
    focusedEntityIds: [UNIT_ENTITY_IDS[1]],
    layerVisibility: [
      { layerId: 'lyr-node', visible: true },
      { layerId: 'lyr-structure', visible: true },
    ],
    timelinePosition: { atMs: 2_000, frameIndex: 60, paused: false },
    camera: { mode: 'orbit', position: [26, 20, 26], target: [8, 6, 0] },
    hiddenEntityIds: [],
  };
}

/** The REAL W013 binding of the unit fixture (descriptor x device). */
export function unitBinding(atMs = 1_000): RendererBinding {
  const adapter = new ThreeJsRendererAdapter();
  const bound = bindRendererSession({
    rendererSessionId: 'rs-threejs-unit-1',
    renderer: adapter.descriptor(),
    device: UNIT_DEVICE,
    boundAtMs: atMs,
  });
  if (!bound.ok) {
    throw new Error(`unit binding failed: ${bound.error.message}`);
  }
  return bound.value;
}

/** Build a REAL W016 compilation of the unit scene (the mount pipeline's input). */
export function unitCompilation(atMs = 2_000) {
  const compiled = compileWorldScene(UNIT_SCENE, {
    ontology: UNIT_ONTOLOGY,
    device: UNIT_DEVICE.device,
    invocation: {
      invocationId: 'wi-unit-mount-1',
      rendererSessionId: 'rs-threejs-unit-1',
      atMs,
    },
  });
  if (!compiled.ok) {
    throw new Error(`unit compilation failed: ${compiled.error.message}`);
  }
  return compiled.value;
}

/** Create + mount one adapter session over the unit fixture (headless). */
export async function mountUnitSession(options?: {
  readonly adapter?: ThreeJsRendererAdapter;
  readonly fabricSessionId?: string;
  readonly viewState?: PortableViewState;
}): Promise<{
  readonly adapter: ThreeJsRendererAdapter;
  readonly session: RendererAdapterSession;
  readonly mount: RendererMountReport;
}> {
  const adapter = options?.adapter ?? new ThreeJsRendererAdapter();
  const fabricSessionId = options?.fabricSessionId ?? 'fx-threejs-unit-1';
  const binding = unitBinding();
  const created = await adapter.createSession({
    fabricSessionId,
    binding,
    worldProjection: {
      sceneId: UNIT_SCENE.sceneId,
      worldDigest: UNIT_SCENE.digest,
      tenantScope: UNIT_SCENE.tenantScope,
    },
    viewState: options?.viewState ?? unitViewState(),
    createdAtMs: 1_000,
  });
  if (!created.ok) {
    throw new Error(`unit session failed: ${created.error.message}`);
  }
  const mounted = await adapter.mountProjection(created.value, {
    scene: UNIT_SCENE,
    compilation: unitCompilation(),
    admittedReceipts: [],
  });
  if (!mounted.ok) {
    throw new Error(`unit mount failed: ${mounted.error.message}`);
  }
  return { adapter, session: created.value, mount: mounted.value };
}

/** Build one raw pointer input envelope (the W056 grammar). */
export function pointerInput(
  fabricSessionId: string,
  inputId: string,
  x: number,
  y: number,
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
    pointer: { x, y },
    ...(intentHint !== undefined ? { intentHint: { intent: intentHint } } : {}),
  };
}

/** Build one raw key input envelope (the W056 grammar). */
export function keyInput(
  fabricSessionId: string,
  inputId: string,
  key: string,
  modifiers: readonly string[] = [],
  atMs = 3_000,
  inputKind: 'key-down' | 'key-up' = 'key-down',
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs,
    modality: 'keyboard',
    inputKind,
    key: { key, modifiers: [...modifiers].sort() },
  };
}

/** Build one raw wheel input envelope (the W056 grammar). */
export function wheelEnvelope(
  fabricSessionId: string,
  inputId: string,
  deltaY: number,
  atMs = 3_000,
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

/** Parse one raw envelope through the REAL W056 schema (typed input). */
export function parseEnvelope(envelope: Record<string, unknown>): RendererInputEnvelope {
  // The batteries hand the adapter SCHEMA-VALID envelopes; the fabric does
  // the same at submitInput. This helper keeps the unit fixtures honest by
  // parsing through the real schema surface.
  const parsed = RendererInputEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new Error(`unit envelope failed schema validation: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }
  return parsed.data;
}
