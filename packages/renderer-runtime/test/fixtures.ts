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

// ---------------------------------------------------------------------------
// W056 fabric fixtures (deterministic builders for the fabric contract).
// ---------------------------------------------------------------------------

import type {
  FabricSessionId,
  PortableViewState,
  RendererAssetBindingContent,
  RendererCapabilitySet,
  RendererConformanceResultContent,
  RendererFailure,
  RendererFrameEnvelope,
  RendererIntentReceiptContent,
  RendererSessionSnapshotContent,
  RendererSwitchReceiptContent,
  RendererSwitchRequest,
  WorldProjectionRef,
  WorldSceneIdMirror,
} from '../src/index';
import {
  captureSessionSnapshotContent,
  captureSwitchReceiptContent,
  createRendererSessionContent,
} from '../src/index';

/** A deterministic world scene id (mirrored W016 grammar). */
export const SCENE_ID: WorldSceneIdMirror = 'wsc-fixture-scene';

/** A deterministic canonical world digest (content of the fixture scene). */
export const WORLD_DIGEST = 'a'.repeat(64);

/** The fixture world projection reference (tenant A). */
export const WORLD_PROJECTION: WorldProjectionRef = {
  sceneId: SCENE_ID,
  worldDigest: WORLD_DIGEST,
  tenantScope: SCOPE_A,
};

/** A full fabric capability set for the general renderer. */
export const FULL_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: 'rr-general-1',
  hitTesting: true,
  measurement: true,
  annotation: true,
  frameCapture: true,
  sessionSwitching: true,
  snapshotCapture: true,
  degradation: ['none', 'reduced-fidelity', 'wireframe'],
  portableViewState: ['camera', 'focused-entities', 'layer-visibility', 'timeline-position'],
  assetKinds: ['material', 'mesh', 'texture'],
};

/** A reduced capability set (no camera restore, no measurement). */
export const REDUCED_CAPABILITIES: RendererCapabilitySet = {
  capabilityVersion: 1,
  rendererId: 'rr-2d-passive',
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

/** A deterministic portable view state (orbit camera, focus, layers). */
export function portableViewState(
  overrides: Partial<PortableViewState> = {},
): PortableViewState {
  return {
    focusedEntityIds: ['we-fixture-alpha', 'we-fixture-beta'],
    layerVisibility: [
      { layerId: 'lyr-structure', visible: true },
      { layerId: 'lyr-utilities', visible: false },
    ],
    timelinePosition: { atMs: 1_000, frameIndex: 30, paused: false },
    camera: { mode: 'orbit', position: [1, 2, 3], target: [0, 0, 0] },
    hiddenEntityIds: [],
    ...overrides,
  };
}

/** Deterministically create + seal a fabric session for tenant A. */
export function fabricSession(
  options: {
    fabricSessionId?: string;
    capabilityId?: string;
    capabilities?: RendererCapabilitySet;
    worldProjection?: WorldProjectionRef;
    viewState?: PortableViewState;
    createdAtMs?: number;
    switchCount?: number;
  } = {},
) {
  const binding = boundSession(undefined, {
    rendererSessionId: `rs-${(options.fabricSessionId ?? 'fx-alpha-1').slice(3)}`,
  });
  const created = createRendererSessionContent({
    fabricSessionId: options.fabricSessionId ?? 'fx-alpha-1',
    capabilityId: options.capabilityId ?? 'epoch.renderer.fixture-a',
    binding,
    capabilities: options.capabilities ?? FULL_CAPABILITIES,
    worldProjection: options.worldProjection ?? WORLD_PROJECTION,
    viewState: options.viewState ?? portableViewState(),
    createdAtMs: options.createdAtMs ?? 0,
    switchCount: options.switchCount ?? 0,
  });
  if (!created.ok) {
    throw new Error(`fixture session failed to create: ${created.error.message}`);
  }
  return created.value;
}

/** A deterministic switch request (tenant A, general renderer target). */
export function switchRequest(
  overrides: Partial<RendererSwitchRequest> = {},
): RendererSwitchRequest {
  return {
    schema: 'epoch.renderer-switch-request',
    fabricProtocolVersion: '1.0.0',
    switchId: 'sw-fixture-1',
    sourceFabricSessionId: 'fx-alpha-1',
    targetRendererId: 'rr-2d-passive',
    expectedWorldDigest: WORLD_DIGEST,
    expectedTenantId: TENANT_A,
    targetFabricSessionId: 'fx-beta-1',
    fallbackRendererIds: [],
    atMs: 5_000,
    ...overrides,
  };
}

/** A deterministic switch receipt content (tenant A continuity proven). */
export function switchReceiptContent(
  overrides: Partial<RendererSwitchReceiptContent> = {},
): RendererSwitchReceiptContent {
  const captured = captureSwitchReceiptContent({
    switchId: 'sw-fixture-1',
    fromRendererId: 'rr-general-1',
    toRendererId: 'rr-2d-passive',
    fromFabricSessionId: 'fx-alpha-1',
    toFabricSessionId: 'fx-beta-1',
    tenantScope: SCOPE_A,
    worldDigest: WORLD_DIGEST,
    sourceSnapshotDigest: 'b'.repeat(64),
    mountedProjectionDigest: WORLD_DIGEST,
    restoredViewFields: ['focused-entities', 'layer-visibility', 'timeline-position'],
    restoredViewState: portableViewState(),
    fallbackApplied: false,
    atMs: 5_000,
    ...overrides,
  });
  if (!captured.ok) {
    throw new Error(`fixture switch receipt failed: ${captured.error.message}`);
  }
  return captured.value;
}

/** A deterministic session snapshot content. */
export function sessionSnapshotContent(
  overrides: Partial<RendererSessionSnapshotContent> = {},
): RendererSessionSnapshotContent {
  const captured = captureSessionSnapshotContent({
    fabricSessionId: 'fx-alpha-1',
    capturedFromRendererId: 'rr-general-1',
    worldProjection: WORLD_PROJECTION,
    viewState: portableViewState(),
    invocationCount: 3,
    switchCount: 0,
    capturedAtMs: 4_000,
    ...overrides,
  });
  if (!captured.ok) {
    throw new Error(`fixture snapshot failed: ${captured.error.message}`);
  }
  return captured.value;
}

/** A deterministic frame envelope. */
export function frameEnvelope(
  overrides: Partial<RendererFrameEnvelope> = {},
): RendererFrameEnvelope {
  return {
    schema: 'epoch.renderer-frame-envelope',
    fabricProtocolVersion: '1.0.0',
    fabricSessionId: 'fx-alpha-1',
    frameIndex: 1,
    atMs: 1_000,
    worldDigest: WORLD_DIGEST,
    degradation: 'none',
    admissionDigest: 'c'.repeat(64),
    ...overrides,
  };
}

/** A deterministic pointer input envelope. */
export function pointerInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId: 'rin-fixture-1',
    fabricSessionId: 'fx-alpha-1',
    atMs: 1_200,
    modality: 'pointer',
    inputKind: 'pointer-down',
    pointer: { x: 0.25, y: 0.5 },
    ...overrides,
  };
}

/** A deterministic normalized intent receipt content. */
export function intentReceiptContent(
  overrides: Partial<RendererIntentReceiptContent> = {},
): RendererIntentReceiptContent {
  return {
    schema: 'epoch.renderer-intent-receipt',
    fabricProtocolVersion: '1.0.0',
    inputId: 'rin-fixture-1',
    fabricSessionId: 'fx-alpha-1',
    modality: 'pointer',
    inputKind: 'pointer-down',
    hitEntityId: 'we-fixture-alpha',
    intent: { id: 'epoch.world.interaction.select', version: '1.0.0' },
    intentPayloadDigest: 'd'.repeat(64),
    outcome: 'normalized',
    admissionDigest: 'e'.repeat(64),
    atMs: 1_200,
    ...overrides,
  };
}

/** A deterministic validated asset binding content. */
export function assetBindingContent(
  overrides: Partial<RendererAssetBindingContent> = {},
): RendererAssetBindingContent {
  return {
    schema: 'epoch.renderer-asset-binding',
    fabricProtocolVersion: '1.0.0',
    bindingId: 'rab-fixture-1',
    fabricSessionId: 'fx-alpha-1',
    tenantScope: SCOPE_A,
    assetDigest: 'f'.repeat(64),
    assetKind: 'mesh',
    byteSize: 4_096,
    trustState: 'validated',
    validatedAtMs: 2_000,
    boundAtMs: 1_900,
    ...overrides,
  };
}

/** A deterministic passing conformance result content (both fixture renderers). */
export function conformanceResultContent(
  overrides: Partial<RendererConformanceResultContent> = {},
): RendererConformanceResultContent {
  const renderers = ['rr-2d-passive', 'rr-general-1'];
  const kinds = [
    'digest-continuity',
    'interaction-outcomes',
    'normalized-intents',
    'presentation-only-differences',
    'semantic-entity-ids',
    'semantic-focus-layers',
    'tenant-continuity',
  ] as const;
  const checks = renderers.flatMap((rendererId) =>
    kinds.map((checkKind) => ({
      checkKind,
      rendererId,
      outcome: 'pass' as const,
    })),
  );
  return {
    schema: 'epoch.renderer-conformance-result',
    fabricProtocolVersion: '1.0.0',
    runId: 'conf-fixture-1',
    renderers,
    tenantScope: SCOPE_A,
    worldDigest: WORLD_DIGEST,
    checks,
    overallOutcome: 'pass',
    startedAtMs: 0,
    completedAtMs: 100,
    ...overrides,
  };
}

/** The typed shape of one fabric-failure variant. */
export type TypedFailure<C extends RendererFailure['code']> = Extract<
  RendererFailure,
  { code: C }
>;

/** Test helper for typed fabric failures (mirrors expectFailure). */
export function expectFabricFailure<C extends RendererFailure['code']>(
  result: { readonly ok: false; readonly error: RendererFailure } | { readonly ok: true },
  code: C,
): TypedFailure<C> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" fabric failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" fabric failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as TypedFailure<C>;
}

/** A deterministic fabric session id. */
export const FABRIC_SESSION: FabricSessionId = 'fx-alpha-1';
