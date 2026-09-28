/**
 * Test fixtures: deterministic builders for W011 device descriptors and
 * device-capabilities records used across the positive/negative
 * batteries.
 */
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import { descriptorFromProfile } from '../src/index';
import type { DeviceCapabilitiesError } from '../src/index';

/** The typed shape of one device-capabilities error variant. */
export type TypedError<C extends DeviceCapabilitiesError['code']> = Extract<
  DeviceCapabilitiesError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so
 * test failures remain readable).
 */
export function expectFailure<C extends DeviceCapabilitiesError['code']>(
  result: { readonly ok: false; readonly error: DeviceCapabilitiesError } | { readonly ok: true },
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

/** A desktop descriptor straight from the canonical profile table. */
export function desktopDevice(): DeviceDescriptor {
  return profileDevice('desktop');
}

/** A phone descriptor straight from the canonical profile table. */
export function phoneDevice(): DeviceDescriptor {
  return profileDevice('phone');
}

/** Build a descriptor from the canonical profile table (throws on failure). */
export function profileDevice(deviceClass: string): DeviceDescriptor {
  const filled = descriptorFromProfile(deviceClass);
  if (!filled.ok) {
    throw new Error(`fixture profile "${deviceClass}" failed: ${filled.error.message}`);
  }
  return filled.value;
}

/**
 * A deliberately LOW-capability device: budgets below the reduced floor
 * on every axis (the "low capability = 2D/reduced, remote optional" row).
 */
export const LOW_CAPABILITY_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'phone',
  interaction: ['touch'],
  display: {
    stereoscopic: false,
    maxPixels: 40_000,
    refreshHz: 30,
    colorDepthBits: 16,
  },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: 500,
    maxTextureBytes: 131_072,
  },
  latencyBudgetMs: 200,
};

/**
 * A desktop-class device with budgets EXACTLY at the full tier floors
 * (the tier boundary fixture: floors are inclusive).
 */
export const FULL_FLOOR_DEVICE: DeviceDescriptor = {
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
    maxTriangles: 500_000,
    maxTextureBytes: 134_217_728,
  },
};

/**
 * A desktop-class device with budgets one unit BELOW every full floor
 * (the tier boundary fixture: below full downgrades to normal).
 */
export const BELOW_FULL_FLOOR_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'desktop',
  interaction: ['keyboard', 'pointer'],
  display: {
    stereoscopic: false,
    maxPixels: 2_073_599,
    refreshHz: 60,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: 499_999,
    maxTextureBytes: 134_217_727,
  },
};

/**
 * A phone-class device declaring desktop-class budgets (the class
 * ceiling fixture: still a field surface).
 */
export const PHONE_FULL_BUDGETS_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'phone',
  interaction: ['touch'],
  display: {
    stereoscopic: false,
    maxPixels: 8_294_400,
    refreshHz: 120,
    colorDepthBits: 24,
  },
  spatial: {
    poseTracking: 'none',
    worldAnchored: false,
    maxTriangles: 4_000_000,
    maxTextureBytes: 2_147_483_648,
  },
};

/** A device declaring NO budgets at all (undeclared = unconstrained). */
export const UNDECLARED_BUDGET_DEVICE: DeviceDescriptor = {
  descriptorVersion: 1,
  deviceClass: 'desktop',
  interaction: ['pointer'],
  display: { stereoscopic: false },
  spatial: { poseTracking: 'none', worldAnchored: false },
};

/** A minimal valid presentation requirement (flat, no budgets). */
export const FLAT_REQUIREMENT = {
  requirementVersion: 1,
  requirementId: 'prr-flat-basic',
  spatial: false,
  stereoscopic: false,
  requiredModalities: [],
  minPoseTracking: 'none',
} as const;

/** A demanding spatial presentation requirement. */
export const SPATIAL_REQUIREMENT = {
  requirementVersion: 1,
  requirementId: 'prr-spatial-review',
  spatial: true,
  stereoscopic: true,
  minPixels: 2_073_600,
  minTriangles: 500_000,
  minTextureBytes: 134_217_728,
  requiredModalities: ['pointer', 'touch'],
  minPoseTracking: '6dof',
} as const;
