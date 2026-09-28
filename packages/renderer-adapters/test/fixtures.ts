/**
 * Test fixtures: deterministic W013 bindings over W019-assessed devices,
 * used across the renderer-adapters batteries.
 */
import type { RendererBinding, RendererDescriptor } from '@epoch/renderer-runtime';
import { bindRendererSession, deviceSessionSnapshotOf } from '@epoch/renderer-runtime';
import type { DeviceCapabilityAssessment, DeviceDescriptor } from '@epoch/device-capabilities';
import { assessDeviceDescriptor, descriptorFromProfile } from '@epoch/device-capabilities';
import type { RendererAdaptersError } from '../src/index';

/** The typed shape of one renderer-adapters error variant. */
export type TypedError<C extends RendererAdaptersError['code']> = Extract<
  RendererAdaptersError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so
 * test failures remain readable).
 */
export function expectFailure<C extends RendererAdaptersError['code']>(
  result: { readonly ok: false; readonly error: RendererAdaptersError } | { readonly ok: true },
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

/** A full-fidelity desktop device (from the canonical profile table). */
export function desktopDevice(): DeviceDescriptor {
  return profileDevice('desktop');
}

/** A stereoscopic headset device (from the canonical profile table). */
export function headsetDevice(): DeviceDescriptor {
  return profileDevice('headset');
}

/**
 * A reduced-tier device: budgets above the reduced floors but below the
 * field floors (tier 'reduced', remote assist NOT recommended).
 */
export const REDUCED_TIER_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'phone',
  interaction: ['touch'],
  display: { stereoscopic: false, maxPixels: 100_000, refreshHz: 60, colorDepthBits: 24 },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: 2_000,
    maxTextureBytes: 300_000,
  },
};

/**
 * A low-capability device: budgets below the reduced floors (tier
 * 'reduced' with the remote-assist recommendation).
 */
export const REMOTE_ASSIST_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'phone',
  interaction: ['touch'],
  display: { stereoscopic: false, maxPixels: 40_000, refreshHz: 30, colorDepthBits: 16 },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: 500,
    maxTextureBytes: 100_000,
  },
};

/** Build a device from the profile table (throws on failure). */
export function profileDevice(deviceClass: string): DeviceDescriptor {
  const filled = descriptorFromProfile(deviceClass);
  if (!filled.ok) {
    throw new Error(`fixture profile "${deviceClass}" failed: ${filled.error.message}`);
  }
  return filled.value;
}

/** Assess a device (throws on failure). */
export function assess(device: DeviceDescriptor, assessmentId: string): DeviceCapabilityAssessment {
  const verdict = assessDeviceDescriptor({ assessmentId, device });
  if (!verdict.ok) {
    throw new Error(`fixture assessment failed: ${verdict.error.message}`);
  }
  return verdict.value;
}

/** A general-purpose renderer descriptor hosting every graph kind (mono). */
export const FULL_RENDERER: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-general-1',
  graphKinds: ['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay'],
  interaction: ['keyboard', 'pointer', 'voice'],
  output: { stereoscopic: false, maxPixels: 4_147_200, refreshHz: 90, colorDepthBits: 24 },
  budgets: {
    maxGraphNodes: 4_096,
    maxGraphEdges: 8_192,
    maxTriangles: 2_000_000,
    maxTextureBytes: 536_870_912,
  },
};

/** A stereoscopic renderer descriptor (hosting every graph kind). */
export const STEREO_RENDERER: RendererDescriptor = {
  ...FULL_RENDERER,
  rendererId: 'rr-stereo-1',
  output: { ...FULL_RENDERER.output, stereoscopic: true },
};

/** A flat renderer descriptor (2D/controls/narrative/timeline only). */
export const FLAT_RENDERER: RendererDescriptor = {
  descriptorVersion: 1,
  rendererId: 'rr-flat-1',
  graphKinds: ['2d', 'controls', 'narrative', 'timeline-replay'],
  interaction: ['keyboard', 'pointer'],
  output: { stereoscopic: false },
  budgets: { maxGraphNodes: 1_024, maxGraphEdges: 2_048 },
};

/** Bind a renderer session for tenant A on a device (throws on failure). */
export function boundSession(
  renderer: RendererDescriptor = FULL_RENDERER,
  options: {
    rendererSessionId?: string;
    device?: DeviceDescriptor;
    tenantId?: string;
    boundAtMs?: number;
  } = {},
): RendererBinding {
  const bound = bindRendererSession({
    rendererSessionId: options.rendererSessionId ?? 'rs-alpha-1',
    renderer,
    device: deviceSessionSnapshotOf({
      deviceSessionId: 'ds-fixture-1',
      tenantScope: { tenantId: options.tenantId ?? TENANT_A },
      device: options.device ?? desktopDevice(),
    }),
    boundAtMs: options.boundAtMs ?? 0,
  });
  if (!bound.ok) {
    throw new Error(`fixture binding failed: ${bound.error.message}`);
  }
  return bound.value;
}
