/**
 * Test fixtures: deterministic builders for valid renderer descriptors,
 * device-session snapshots, sealed W011 Experience Graphs, and bindings
 * used across the positive/negative batteries.
 */
import type {
  DeviceDescriptor,
  DeviceSessionSnapshot,
  ExperienceGraphKind,
  RendererBinding,
  RendererDescriptor,
  RendererRuntimeError,
  TenantScope,
} from '../src/index';
import { bindRendererSession } from '../src/index';
import { sealExperienceGraph, type ExperienceGraph } from '@epoch/experience-protocol';

/** The typed shape of one renderer-error variant. */
export type TypedError<C extends RendererRuntimeError['code']> = Extract<
  RendererRuntimeError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so test
 * failures remain readable).
 */
export function expectFailure<C extends RendererRuntimeError['code']>(
  result: { readonly ok: false; readonly error: RendererRuntimeError } | { readonly ok: true },
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

/** A neutral desktop device descriptor (W011 vocabulary). */
export const DESKTOP_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'desktop',
  interaction: ['keyboard', 'pointer', 'voice'],
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
};

/** A neutral headset device descriptor (W011 vocabulary). */
export const HEADSET_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'headset',
  interaction: ['gesture', 'voice'],
  display: {
    stereoscopic: true,
    maxPixels: 4_147_200,
    refreshHz: 90,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: '6dof',
    worldAnchored: true,
    maxTriangles: 500_000,
    maxTextureBytes: 134_217_728,
  },
};

/** A general-purpose renderer descriptor hosting every graph kind. */
export const FULL_RENDERER: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-general-1',
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer', 'voice'],
  output: {
    stereoscopic: true,
    maxPixels: 4_147_200,
    refreshHz: 90,
    colorDepthBits: 24,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 2_000_000,
    maxTextureBytes: 536_870_912,
  },
};

/** A 2D-only passive renderer (no input modalities, small budgets). */
export const RENDERER_2D_ONLY: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-2d-passive',
  graphKinds: ['2d'],
  interaction: [],
  output: {
    stereoscopic: false,
    maxPixels: 2_073_600,
    refreshHz: 60,
  },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
  },
};

/** A renderer with deliberately tight node/triangle budgets. */
export const RENDERER_TIGHT_BUDGETS: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-tight-budgets',
  graphKinds: ['2d', '3d'],
  interaction: ['pointer'],
  output: { stereoscopic: false },
  budgets: {
    maxGraphNodes: 2,
    maxGraphEdges: 1,
    maxTriangles: 1_000,
    maxTextureBytes: 1_048_576,
  },
};

/** Deterministic device snapshot for tenant A on the desktop device. */
export function desktopSnapshot(
  overrides: Partial<{ deviceSessionId: string; tenantScope: TenantScope; device: DeviceDescriptor }> = {},
): DeviceSessionSnapshot {
  return {
    deviceSessionId: overrides.deviceSessionId ?? 'ds-alpha-1',
    tenantScope: overrides.tenantScope ?? SCOPE_A,
    device: overrides.device ?? DESKTOP_DEVICE,
  };
}

/** Deterministically build a valid sealed W011 graph of the given kind. */
export function sealedGraph(
  kind: ExperienceGraphKind,
  options: { nodeCount?: number; tenantScope?: TenantScope; device?: DeviceDescriptor } = {},
): ExperienceGraph {
  const nodeCount = options.nodeCount ?? 1;
  const tenantScope = options.tenantScope ?? SCOPE_A;
  const device = options.device ?? DESKTOP_DEVICE;
  const nodes = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const id = `xn-fixture-${`${i}`.padStart(3, '0')}`;
    if (kind === '2d' || kind === 'animation') {
      nodes.push({
        id,
        kind: 'shape-2d',
        descriptor: {
          geometry: { form: 'rect', x: 0, y: 0, width: 10, height: 10 },
          fill: { color: '#ff0000' },
        },
      });
    } else if (kind === '3d') {
      nodes.push({
        id,
        kind: 'spatial-3d',
        descriptor: { primitive: 'box', position: [0, 0, 0] },
      });
    } else if (kind === 'narrative') {
      nodes.push({ id, kind: 'narrative-beat', descriptor: { title: 'Beat' } });
    } else if (kind === 'timeline-replay') {
      nodes.push({
        id,
        kind: 'timeline-marker',
        descriptor: { atMs: 0, markerKind: 'event' },
      });
    } else if (kind === 'presence') {
      nodes.push({
        id,
        kind: 'presence-seat',
        descriptor: { participant: { participantId: 'p-1', participantKind: 'human' } },
      });
    } else {
      nodes.push({
        id,
        kind: 'control',
        descriptor: {
          controlKind: 'button',
          intent: { id: 'world.view.refresh', version: '1.0.0' },
        },
      });
    }
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
  const sealed = sealExperienceGraph({
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: 'xg-fixture-1',
    graphKind: kind,
    tenantScope,
    projectedFrom: [],
    nodes,
    edges: [],
    device,
  });
  if (!sealed.ok) {
    throw new Error(`fixture graph failed to seal: ${sealed.error.message}`);
  }
  return sealed.value;
}

/** Deterministically bind a renderer session for tenant A. */
export function boundSession(
  renderer: RendererDescriptor = FULL_RENDERER,
  options: { rendererSessionId?: string; snapshot?: DeviceSessionSnapshot; boundAtMs?: number } = {},
): RendererBinding {
  const bound = bindRendererSession({
    rendererSessionId: options.rendererSessionId ?? 'rs-alpha-1',
    renderer,
    device: options.snapshot ?? desktopSnapshot(),
    boundAtMs: options.boundAtMs ?? 0,
  });
  if (!bound.ok) {
    throw new Error(`fixture binding failed: ${bound.error.message}`);
  }
  return bound.value;
}
