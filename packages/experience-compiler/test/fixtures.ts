/**
 * Test fixtures: deterministic builders for valid W011 envelopes of every
 * graph kind, neutral device descriptors, and compiled plans used across
 * the positive/negative batteries.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import type {
  DeviceDescriptor,
  ExperienceGraph,
  ExperienceGraphContent,
  ExperienceGraphKind,
  ProjectedReference,
  TenantScope,
} from '@epoch/experience-protocol';
import {
  compileExperienceGraph,
  type CompilerError,
  type RenderPlan,
} from '../src/index';

/** The typed shape of one compiler-error variant. */
export type TypedError<C extends CompilerError['code']> = Extract<CompilerError, { code: C }>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so test
 * failures remain readable).
 */
export function expectFailure<C extends CompilerError['code']>(
  result: { readonly ok: false; readonly error: CompilerError } | { readonly ok: true },
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

export const ENTITY_REF: ProjectedReference = {
  kind: 'world-entity',
  tenantId: TENANT_A,
  entityId: 'building-7',
  contentDigest: DIGEST_A,
};

export const EVENT_REF: ProjectedReference = {
  kind: 'world-event',
  tenantId: TENANT_A,
  eventId: 'evt-3',
  contentDigest: DIGEST_B,
};

export const AGENT_REF: ProjectedReference = {
  kind: 'agent',
  tenantId: TENANT_A,
  agentId: 'agent:planner-1',
  contentDigest: DIGEST_C,
};

export const EVIDENCE_REF: ProjectedReference = {
  kind: 'evidence-record',
  tenantId: TENANT_A,
  recordDigest: DIGEST_D,
};

export const CAPABILITY_REF: ProjectedReference = {
  kind: 'capability',
  tenantId: TENANT_A,
  capabilityId: 'engineering.stress-analysis',
  capabilityVersion: '1.4.0',
  contentDigest: DIGEST_A,
};

export const TENANT_SCOPE: TenantScope = {
  tenantId: TENANT_A,
  workspaceId: 'ws-main',
  projectId: 'proj-tower-a',
};

/** Deep clone: fixtures are built fresh per call so tests that mutate their documents never corrupt shared constants. */
function deepClone<T>(value: T): T {
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

export function phoneDevice(): DeviceDescriptor {
  return {
    descriptorVersion: 1,
    deviceClass: 'phone',
    interaction: ['touch', 'voice'],
    display: { stereoscopic: false, maxPixels: 2_272_512, refreshHz: 120 },
    spatial: { poseTracking: 'none', worldAnchored: false },
    latencyBudgetMs: 50,
  };
}

/** Content builders per graph kind; every builder returns VALID content. */
export function graphContent(kind: ExperienceGraphKind): ExperienceGraphContent {
  const base = {
    schema: 'epoch.experience-graph' as const,
    protocolVersion: '1.0.0' as const,
    graphId: `xg-${kind.replace(/[^a-z0-9]/g, '-')}`,
    graphKind: kind,
    tenantScope: deepClone(TENANT_SCOPE),
    projectedFrom: deepClone([AGENT_REF, ENTITY_REF, EVENT_REF]),
    device: deepClone(desktopDevice()),
  };
  switch (kind) {
    case '2d':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-label-1',
            kind: 'label',
            ref: deepClone(ENTITY_REF),
            descriptor: { text: 'Tower A — level 3', offset2d: { x: 8, y: -12 } },
            attributes: { 'display-hint': 'primary' },
          },
          {
            id: 'xn-shape-1',
            kind: 'shape-2d',
            ref: deepClone(ENTITY_REF),
            descriptor: {
              geometry: { form: 'rect', x: 0, y: 0, width: 100, height: 50 },
              stroke: { color: '#123456', lineWidth: 1.5 },
              fill: { color: '#89abcd' },
              zIndex: 2,
            },
          },
        ],
        edges: [{ kind: 'anchors', from: 'xn-label-1', to: 'xn-shape-1' }],
      };
    case '3d':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-label-1',
            kind: 'label',
            descriptor: { text: 'Level 3', offset3d: [1, 1, 1] },
          },
          {
            id: 'xn-mesh-1',
            kind: 'spatial-3d',
            ref: deepClone(ENTITY_REF),
            descriptor: {
              primitive: 'mesh',
              position: [1, 2, 3],
              orientation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              mesh: {
                assetDigest: DIGEST_B,
                byteSize: 4096,
                mediaType: 'application/octet-stream',
              },
            },
          },
          {
            id: 'xn-shape-3d-1',
            kind: 'spatial-3d',
            descriptor: { primitive: 'box', position: [0, 0, 0] },
          },
        ],
        edges: [
          { kind: 'anchors', from: 'xn-label-1', to: 'xn-mesh-1' },
          { kind: 'contains', from: 'xn-mesh-1', to: 'xn-shape-3d-1' },
        ],
      };
    case 'animation':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-box-1',
            kind: 'spatial-3d',
            ref: deepClone(ENTITY_REF),
            descriptor: { primitive: 'box', position: [0, 0, 0] },
          },
          {
            id: 'xn-clip-1',
            kind: 'animation-clip',
            descriptor: {
              durationMs: 2000,
              tracks: [
                {
                  targetNodeId: 'xn-box-1',
                  propertyPath: 'scale',
                  keyframes: [
                    { atMs: 0, value: [1, 1, 1], easing: 'linear' },
                    { atMs: 1000, value: [2, 2, 2], easing: 'ease-out' },
                    { atMs: 2000, value: [1, 1, 1] },
                  ],
                },
              ],
            },
          },
        ],
        edges: [{ kind: 'animates', from: 'xn-clip-1', to: 'xn-box-1' }],
      };
    case 'narrative':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-beat-1',
            kind: 'narrative-beat',
            ref: deepClone(AGENT_REF),
            descriptor: {
              title: 'Structural review pending',
              body: 'The stress analysis agent flagged level 3 for review.',
              tone: 'cautionary',
            },
          },
          {
            id: 'xn-beat-2',
            kind: 'narrative-beat',
            descriptor: { title: 'Approval reached', tone: 'celebratory' },
          },
          {
            id: 'xn-beat-3',
            kind: 'narrative-beat',
            descriptor: { title: 'Closed out' },
          },
        ],
        edges: [
          { kind: 'follows', from: 'xn-beat-1', to: 'xn-beat-2' },
          { kind: 'follows', from: 'xn-beat-2', to: 'xn-beat-3' },
        ],
      };
    case 'timeline-replay':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-marker-1',
            kind: 'timeline-marker',
            ref: deepClone(EVENT_REF),
            descriptor: { atMs: 500, label: 'world created', markerKind: 'event' },
          },
          {
            id: 'xn-marker-2',
            kind: 'timeline-marker',
            descriptor: { atMs: 0, markerKind: 'branch-point' },
          },
          {
            id: 'xn-track-1',
            kind: 'timeline-track',
            descriptor: { label: 'Main line', startMs: 0, endMs: 10_000 },
          },
        ],
        edges: [{ kind: 'synchronizes', from: 'xn-marker-1', to: 'xn-track-1' }],
      };
    case 'presence':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-cursor-1',
            kind: 'presence-cursor',
            descriptor: {
              participant: { participantId: 'user:alice', participantKind: 'human' },
              position2d: { x: 10, y: 20 },
              atMs: 1234,
            },
          },
          {
            id: 'xn-seat-1',
            kind: 'presence-seat',
            ref: deepClone(AGENT_REF),
            descriptor: {
              participant: { participantId: 'agent:planner-1', participantKind: 'agent' },
            },
          },
        ],
        edges: [{ kind: 'anchors', from: 'xn-cursor-1', to: 'xn-seat-1' }],
      };
    case 'controls':
      return {
        ...base,
        nodes: [
          {
            id: 'xn-control-1',
            kind: 'control',
            descriptor: {
              controlKind: 'button',
              intent: { id: 'world.entity.focus', version: '1.0.0' },
              label: 'Focus Tower A',
            },
            attributes: { 'slot-index': 0 },
          },
          {
            id: 'xn-control-2',
            kind: 'control',
            descriptor: {
              controlKind: 'selector',
              intent: { id: 'world.view.switch', version: '1.2.0' },
              options: ['isometric', 'top-down', 'walkthrough'],
            },
          },
        ],
        edges: [{ kind: 'binds-control', from: 'xn-control-1', to: 'xn-control-2' }],
      };
  }
}

/** Seal valid content into a full envelope (fails the test if invalid). */
export function sealedGraph(kind: ExperienceGraphKind): ExperienceGraph {
  const sealed = sealExperienceGraph(graphContent(kind));
  if (!sealed.ok) {
    throw new Error(`fixture failed to seal (${kind}): ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** Compile a fixture envelope for a device (fails the test if it does not compile). */
export function compiledPlan(
  kind: ExperienceGraphKind,
  device: unknown = desktopDevice(),
): RenderPlan {
  const compiled = compileExperienceGraph({ envelope: sealedGraph(kind), device });
  if (!compiled.ok) {
    throw new Error(`fixture failed to compile (${kind}): ${JSON.stringify(compiled.error)}`);
  }
  return compiled.value;
}

/** Digest helper for tests: canonical SHA-256 of a JSON value. */
export function digestOf(value: JsonValue): Sha256Hex {
  return canonicalDigest(value);
}
