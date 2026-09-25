/**
 * Test fixtures: deterministic builders for valid ontologies, scenes,
 * devices, intents, and compilations used across the positive/negative
 * batteries.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import {
  emptyOntology,
  registerOntologyRecords,
  type AffordanceRecord,
  type MaterialRecord,
  type Representation3dRecord,
  type StateOverlayRecord,
  type Symbol2dRecord,
  type WorldOntology,
} from '../src/ontology';
import type { WorldSceneContent } from '../src/scene';
import type { WorldInteractionIntent } from '../src/intent';

/** The typed shape of one world-experience error variant. */
export type TypedError<C extends import('../src/errors').WorldExperienceError['code']> =
  Extract<import('../src/errors').WorldExperienceError, { code: C }>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so test
 * failures remain readable).
 */
export function expectFailure<C extends import('../src/errors').WorldExperienceError['code']>(
  result:
    | { readonly ok: false; readonly error: import('../src/errors').WorldExperienceError }
    | { readonly ok: true },
  code: C,
): TypedError<C> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as TypedError<C>;
}

export const TENANT_A = 'tenant-alpha';
export const TENANT_B = 'tenant-beta';

export const DIGEST_A: Sha256Hex = 'a'.repeat(64);
export const DIGEST_B: Sha256Hex = 'b'.repeat(64);
export const DIGEST_C: Sha256Hex = 'c'.repeat(64);
export const DIGEST_D: Sha256Hex = 'd'.repeat(64);
export const DIGEST_E: Sha256Hex = 'e'.repeat(64);

export const AGENT_REF = {
  kind: 'agent' as const,
  tenantId: TENANT_A,
  agentId: 'agent:planner-1',
  contentDigest: DIGEST_C,
};

export const EVIDENCE_REF = {
  kind: 'evidence-record' as const,
  tenantId: TENANT_A,
  recordDigest: DIGEST_D,
};

export const EVIDENCE_REF_2 = {
  kind: 'evidence-record' as const,
  tenantId: TENANT_A,
  recordDigest: DIGEST_E,
};

export const TENANT_SCOPE = {
  tenantId: TENANT_A,
  workspaceId: 'ws-main',
  projectId: 'proj-tower-a',
};

/** Deep clone: fixtures are built fresh per call. */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function desktopDevice(): DeviceDescriptor {
  return {
    descriptorVersion: 1,
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer'],
    display: { stereoscopic: false, maxPixels: 8_294_400, refreshHz: 60, colorDepthBits: 8 },
    spatial: { poseTracking: 'none', worldAnchored: false },
    latencyBudgetMs: 100,
  };
}

/** A budgeted headset: 2,000 triangles, 1 MiB of 3D content memory. */
export function budgetedHeadsetDevice(): DeviceDescriptor {
  return {
    descriptorVersion: 1,
    deviceClass: 'headset',
    interaction: ['gaze', 'gesture', 'voice'],
    display: { stereoscopic: true, maxPixels: 4_147_840, refreshHz: 90 },
    spatial: { poseTracking: '6dof', worldAnchored: true, maxTriangles: 2_000, maxTextureBytes: 1_048_576 },
  };
}

// ---------------------------------------------------------------------------
// Ontology fixtures.
// ---------------------------------------------------------------------------

export const REPRESENTATION_BOX: Representation3dRecord = {
  ontologyVersion: 1,
  recordId: 'ont-rep-box',
  recordKind: 'representation-3d',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  appliesTo: ['arch:slab', 'arch:wall'],
  primitive: 'box',
};

export const REPRESENTATION_SPHERE: Representation3dRecord = {
  ontologyVersion: 1,
  recordId: 'ont-rep-sphere',
  recordKind: 'representation-3d',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  appliesTo: ['arch:column'],
  primitive: 'sphere',
  materialRecordId: 'ont-mat-concrete',
};

export const MATERIAL_CONCRETE: MaterialRecord = {
  ontologyVersion: 1,
  recordId: 'ont-mat-concrete',
  recordKind: 'material',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  color: '#8c8c8c',
  roughness: 0.9,
  texture: {
    assetDigest: DIGEST_B,
    byteSize: 4096,
    mediaType: 'image/neutral-texture',
  },
};

export const SYMBOL_PLAN: Symbol2dRecord = {
  ontologyVersion: 1,
  recordId: 'ont-sym-plan',
  recordKind: 'symbol-2d',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  appliesTo: ['arch:wall'],
  geometry: { form: 'rect', x: 0, y: 0, width: 100, height: 50 },
  stroke: { color: '#123456', lineWidth: 1.5 },
};

export const STATE_OVERLAY_DAMAGED: StateOverlayRecord = {
  ontologyVersion: 1,
  recordId: 'ont-state-damaged',
  recordKind: 'state-overlay',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  appliesTo: ['arch:wall'],
  stateKey: 'damage-state',
  tint: '#cc4444',
  badgeLabel: 'damaged',
};

export const AFFORDANCE_WALL: AffordanceRecord = {
  ontologyVersion: 1,
  recordId: 'ont-aff-wall',
  recordKind: 'affordance',
  tenantScope: deepClone(TENANT_SCOPE),
  contributor: { packId: 'pack-construction-core' },
  appliesTo: ['arch:wall'],
  interactions: ['inspect', 'measure', 'select'],
  modalities: ['keyboard', 'pointer'],
};

/** The reference ontology used by most fixtures. */
export function referenceOntology(): WorldOntology {
  const registered = registerOntologyRecords(emptyOntology(), [
    deepClone(REPRESENTATION_BOX),
    deepClone(REPRESENTATION_SPHERE),
    deepClone(MATERIAL_CONCRETE),
    deepClone(SYMBOL_PLAN),
    deepClone(STATE_OVERLAY_DAMAGED),
    deepClone(AFFORDANCE_WALL),
  ]);
  if (!registered.ok) {
    throw new Error(`fixture ontology failed registration: ${registered.error.message}`);
  }
  return registered.value;
}

// ---------------------------------------------------------------------------
// Scene fixtures.
// ---------------------------------------------------------------------------

/** Valid scene content: two entities, overlays, narrative, timeline, controls, agents. */
export function sceneContent(): WorldSceneContent {
  return {
    schema: 'epoch.world-scene',
    protocolVersion: '1.0.0',
    sceneId: 'wsc-tower-a-site',
    tenantScope: deepClone(TENANT_SCOPE),
    name: 'Tower A — site view',
    entities: [
      {
        entityId: 'wall-north-1',
        contentDigest: DIGEST_A,
        entityType: 'arch:wall',
        representationRecordId: 'ont-rep-box',
        affordanceRecordId: 'ont-aff-wall',
        label: 'North wall',
        position: [0, 0, 0],
        orientation: [0, 0, 0, 1],
        scale: [10, 3, 0.3],
        visible: true,
        isolated: false,
      },
      {
        entityId: 'wall-south-2',
        contentDigest: DIGEST_B,
        entityType: 'arch:wall',
        representationRecordId: 'ont-rep-sphere',
        label: 'South wall',
        position: [0, 0, 20],
        visible: true,
        isolated: false,
      },
    ],
    focusedEntityIds: ['wall-north-1'],
    overlays: [
      {
        overlayId: 'ovl-highlight-north',
        overlayKind: 'highlight',
        entityId: 'wall-north-1',
        color: '#ff8800',
      },
      {
        overlayId: 'ovl-measure-span',
        overlayKind: 'measurement',
        fromEntityId: 'wall-north-1',
        toEntityId: 'wall-south-2',
        label: 'clear span',
        evidenceDigests: [DIGEST_D],
      },
      {
        overlayId: 'ovl-state-damaged',
        overlayKind: 'state',
        entityId: 'wall-south-2',
        stateKey: 'damage-state',
        tint: '#cc4444',
      },
    ],
    appliedOverlays: [
      { overlayId: 'ovl-highlight-north', orderIndex: 0 },
      { overlayId: 'ovl-measure-span', orderIndex: 1 },
    ],
    animations: [
      {
        instructionId: 'ani-lift-north',
        targetEntityId: 'wall-north-1',
        propertyPath: 'position',
        keyframes: [
          { atMs: 0, value: [0, 0, 0] },
          { atMs: 1000, value: [0, 2, 0] },
        ],
        easing: 'ease-in-out',
        durationMs: 1000,
        loop: false,
      },
    ],
    narrativeBlocks: [
      {
        blockId: 'nrb-status-inspect',
        title: 'South wall inspection pending',
        tone: 'cautionary',
        atMs: 500,
      },
      {
        blockId: 'nrb-status-lift',
        title: 'North wall lift started',
        body: 'The crane has lifted the north wall panel into position.',
        tone: 'informative',
        statusKey: 'lift-status',
        evidenceDigests: [DIGEST_D],
        atMs: 0,
      },
    ],
    timeline: {
      markers: [
        { markerId: 'mrk-phase-start', atMs: 0, label: 'phase start', markerKind: 'phase-start' },
        { markerId: 'mrk-event-lift', atMs: 500, label: 'lift', markerKind: 'event' },
        { markerId: 'mrk-branch-alternative', atMs: 900, markerKind: 'branch-point' },
      ],
      trackLabel: 'Tower A — construction replay',
      trackStartMs: 0,
      trackEndMs: 1000,
      position: { atMs: 0, frameIndex: 0, paused: false },
    },
    camera: {
      mode: 'orbit',
      position: [30, 20, 30],
      orientation: [0, 0, 0, 1],
      target: [0, 0, 10],
      fovRadians: 1.2,
    },
    participants: [
      { participantId: 'agent:planner-1', participantKind: 'agent' },
      { participantId: 'user:alice', participantKind: 'human' },
    ],
    agents: [deepClone(AGENT_REF)],
    evidenceReferences: [deepClone(EVIDENCE_REF), deepClone(EVIDENCE_REF_2)],
    controls: [
      {
        controlId: 'ctl-simulate-lift',
        controlKind: 'button',
        intent: { id: 'epoch.world.interaction.simulate', version: '1.0.0' },
        label: 'Simulate lift plan',
      },
      {
        controlId: 'ctl-view-selector',
        controlKind: 'selector',
        intent: { id: 'epoch.world.interaction.select', version: '1.0.0' },
        label: 'Focus entity',
        options: ['wall-north-1', 'wall-south-2'],
      },
    ],
  } as unknown as WorldSceneContent;
}

// ---------------------------------------------------------------------------
// Intent fixtures (one per kind — the full world subset).
// ---------------------------------------------------------------------------

export function intentFixtures(): WorldInteractionIntent[] {
  return [
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'select', intentId: 'intent-select-1', entityId: 'wall-north-1' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'inspect', intentId: 'intent-inspect-1', entityId: 'wall-north-1' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'measure', intentId: 'intent-measure-1', fromEntityId: 'wall-north-1', toEntityId: 'wall-south-2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'move', intentId: 'intent-move-1', entityId: 'wall-north-1', delta: [1, 0, 0] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'rotate', intentId: 'intent-rotate-1', entityId: 'wall-north-1', delta: [0, 0, 0, 1] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'zoom', intentId: 'intent-zoom-1', factor: 1.5 },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'isolate', intentId: 'intent-isolate-1', entityId: 'wall-south-2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'hide', intentId: 'intent-hide-1', entityIds: ['wall-south-2'] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'show', intentId: 'intent-show-1', entityIds: ['wall-south-2'] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'compare', intentId: 'intent-compare-1', leftEntityId: 'wall-north-1', rightEntityId: 'wall-south-2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'annotate', intentId: 'intent-annotate-1', entityId: 'wall-north-1', text: 'check anchor bolts', evidenceDigests: [DIGEST_D] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'simulate', intentId: 'intent-simulate-1', scenarioRef: 'scenario:lift-plan-v2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'change', intentId: 'intent-change-1', entityId: 'wall-north-1', propertyPath: 'label', value: 'North wall (revised)' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'connect', intentId: 'intent-connect-1', fromEntityId: 'wall-north-1', toEntityId: 'wall-south-2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'disconnect', intentId: 'intent-disconnect-1', fromEntityId: 'wall-north-1', toEntityId: 'wall-south-2' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'filter', intentId: 'intent-filter-1', includeEntityIds: ['wall-north-1'] },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'query', intentId: 'intent-query-1', text: 'which walls are damaged?' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'branch', intentId: 'intent-branch-1', atMs: 900 },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'replay', intentId: 'intent-replay-1', fromMs: 100 },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'pause', intentId: 'intent-pause-1' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'resume', intentId: 'intent-resume-1' },
    { schema: 'epoch.world-intent', intentVersion: 1, kind: 'follow-agent', intentId: 'intent-follow-1', agentId: 'agent:planner-1' },
  ] as unknown as WorldInteractionIntent[];
}

/** Canonical digest helper for tests. */
export function digestOf(value: JsonValue): string {
  return canonicalDigest(value);
}
