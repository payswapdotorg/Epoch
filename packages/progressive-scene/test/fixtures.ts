/**
 * Test fixtures: deterministic builders for sealed W011 Experience
 * Graphs across graph kinds, used by the progressive-scene batteries.
 */
import type { ExperienceGraph, TenantScope } from '@epoch/experience-protocol';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import type { ProgressiveSceneError } from '../src/index';

/** The typed shape of one progressive-scene error variant. */
export type TypedError<C extends ProgressiveSceneError['code']> = Extract<
  ProgressiveSceneError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so
 * test failures remain readable).
 */
export function expectFailure<C extends ProgressiveSceneError['code']>(
  result: { readonly ok: false; readonly error: ProgressiveSceneError } | { readonly ok: true },
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

export const SCOPE_A: TenantScope = { tenantId: TENANT_A };
export const SCOPE_B: TenantScope = { tenantId: TENANT_B };

/** A neutral desktop device descriptor (the W013 fixture convention). */
export const DESKTOP_DEVICE = {
  descriptorVersion: 1,
  deviceClass: 'desktop' as const,
  interaction: ['keyboard', 'pointer', 'voice'],
  display: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: 'none' as const,
    worldAnchored: false,
    maxTriangles: 1_000_000,
    maxTextureBytes: 268_435_456,
  },
};

/** A neutral phone device descriptor (a field-class surface). */
export const PHONE_DEVICE = {
  descriptorVersion: 1,
  deviceClass: 'phone' as const,
  interaction: ['touch' as const, 'voice' as const],
  display: {
    stereoscopic: false,
    maxPixels: 1_048_576,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: 'none' as const,
    worldAnchored: false,
    maxTriangles: 100_000,
    maxTextureBytes: 33_554_432,
  },
};

/**
 * A rich animation-graph fixture exercising every reducible aspect:
 * spatial nodes (spheres, meshes, boxes), shape-2d nodes, labels,
 * animation clips, presence seats/cursors, and timeline tracks/markers.
 */
export function richAnimationGraph(): ExperienceGraph {
  const nodes = [
    {
      id: 'xn-clip-turntable',
      kind: 'animation-clip' as const,
      descriptor: {
        durationMs: 4_000,
        tracks: [
          {
            targetNodeId: 'xn-gantry',
            propertyPath: 'position',
            keyframes: [
              { atMs: 0, value: 0 },
              { atMs: 4_000, value: 1 },
            ],
          },
          {
            targetNodeId: 'xn-tower',
            propertyPath: 'scale',
            keyframes: [
              { atMs: 0, value: 1 },
              { atMs: 2_000, value: 2 },
            ],
          },
        ],
      },
    },
    {
      id: 'xn-crane-mesh',
      kind: 'spatial-3d' as const,
      descriptor: {
        primitive: 'mesh' as const,
        position: [10, 0, 0],
        mesh: { assetDigest: 'a'.repeat(64), byteSize: 8_388_608 },
      },
    },
    {
      id: 'xn-gantry',
      kind: 'spatial-3d' as const,
      descriptor: { primitive: 'sphere' as const, position: [0, 5, 0] },
    },
    {
      id: 'xn-plan-view',
      kind: 'shape-2d' as const,
      descriptor: {
        geometry: { form: 'rect' as const, x: 0, y: 0, width: 100, height: 50 },
        fill: { color: '#00ff00' },
      },
    },
    {
      id: 'xn-tower',
      kind: 'spatial-3d' as const,
      descriptor: { primitive: 'box' as const, position: [0, 0, 0] },
    },
  ];
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  const edges = [
    { kind: 'animates' as const, from: 'xn-clip-turntable', to: 'xn-tower' },
    { kind: 'animates' as const, from: 'xn-clip-turntable', to: 'xn-gantry' },
    { kind: 'contains' as const, from: 'xn-plan-view', to: 'xn-tower' },
  ];
  edges.sort((a, b) =>
    `${a.from}\u0000${a.to}\u0000${a.kind}` < `${b.from}\u0000${b.to}\u0000${b.kind}` ? -1 : 1,
  );
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-rich-1',
    graphKind: 'animation',
    tenantScope: SCOPE_A,
    projectedFrom: [],
    nodes,
    edges,
    device: DESKTOP_DEVICE,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** A presence-graph fixture (seats + cursors). */
export function presenceGraph(): ExperienceGraph {
  const nodes = [
    {
      id: 'xn-cursor-1',
      kind: 'presence-cursor' as const,
      descriptor: {
        participant: { participantId: 'p-lead', participantKind: 'human' as const },
        position2d: { x: 1, y: 2 },
      },
    },
    {
      id: 'xn-seat-lead',
      kind: 'presence-seat' as const,
      descriptor: {
        participant: { participantId: 'p-lead', participantKind: 'human' as const },
      },
    },
    {
      id: 'xn-seat-reviewer',
      kind: 'presence-seat' as const,
      descriptor: {
        participant: { participantId: 'p-reviewer', participantKind: 'agent' as const },
      },
    },
  ];
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-presence-1',
    graphKind: 'presence',
    tenantScope: SCOPE_A,
    projectedFrom: [],
    nodes,
    edges: [],
    device: DESKTOP_DEVICE,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** A minimal one-node graph (already at the minimal core). */
export function minimalGraph(): ExperienceGraph {
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-minimal-1',
    graphKind: 'narrative',
    tenantScope: SCOPE_A,
    projectedFrom: [],
    nodes: [{ id: 'xn-beat-1', kind: 'narrative-beat', descriptor: { title: 'Beat' } }],
    edges: [],
    device: DESKTOP_DEVICE,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** A timeline-replay fixture (tracks + markers). */
export function timelineGraph(): ExperienceGraph {
  const nodes = [
    {
      id: 'xn-marker-1',
      kind: 'timeline-marker' as const,
      descriptor: { atMs: 0, markerKind: 'event' as const },
    },
    {
      id: 'xn-marker-2',
      kind: 'timeline-marker' as const,
      descriptor: { atMs: 1_000, markerKind: 'event' as const },
    },
    {
      id: 'xn-track-main',
      kind: 'timeline-track' as const,
      descriptor: { label: 'Main', startMs: 0, endMs: 60_000 },
    },
  ];
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  const edges = [
    { kind: 'contains' as const, from: 'xn-track-main', to: 'xn-marker-1' },
    { kind: 'contains' as const, from: 'xn-track-main', to: 'xn-marker-2' },
  ];
  edges.sort((a, b) =>
    `${a.from}\u0000${a.to}\u0000${a.kind}` < `${b.from}\u0000${b.to}\u0000${b.kind}` ? -1 : 1,
  );
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-timeline-1',
    graphKind: 'timeline-replay',
    tenantScope: SCOPE_A,
    projectedFrom: [],
    nodes,
    edges,
    device: DESKTOP_DEVICE,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** A W013-shaped effective-limits record (the fit target). */
export function limitsOf(overrides: {
  maxGraphNodes?: number;
  maxGraphEdges?: number;
  maxTriangles?: number;
  maxTextureBytes?: number;
}) {
  return {
    graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'] as const,
    interaction: ['keyboard', 'pointer', 'touch', 'voice'] as const,
    stereoscopic: false,
    maxGraphNodes: overrides.maxGraphNodes ?? 4_096,
    maxGraphEdges: overrides.maxGraphEdges ?? 8_192,
    ...(overrides.maxTriangles !== undefined ? { maxTriangles: overrides.maxTriangles } : {}),
    ...(overrides.maxTextureBytes !== undefined
      ? { maxTextureBytes: overrides.maxTextureBytes }
      : {}),
  };
}
