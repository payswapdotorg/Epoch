/**
 * Test fixtures: deterministic builders for valid experience-runtime
 * documents (device descriptors over the W011 vocabulary, frame
 * schedules, device sessions, event traces) used across the
 * positive/negative batteries.
 */
import type {
  DeviceDescriptor,
  DeviceSessionRecord,
  ExperienceRuntimeError,
  FrameSchedule,
  RuntimeEvent,
  TenantScope,
} from '../src/index';
import { openDeviceSession } from '../src/index';

/** The typed shape of one session-error variant. */
export type TypedError<C extends ExperienceRuntimeError['code']> = Extract<
  ExperienceRuntimeError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so test
 * failures remain readable).
 */
export function expectFailure<C extends ExperienceRuntimeError['code']>(
  result: { readonly ok: false; readonly error: ExperienceRuntimeError } | { readonly ok: true },
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
export const SCOPE_B: TenantScope = { tenantId: TENANT_B, workspaceId: 'ws-1', projectId: 'prj-1' };

/** A neutral desktop device descriptor (W011 vocabulary). */
export const DESKTOP_DEVICE: DeviceDescriptor = {
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
  latencyBudgetMs: 50,
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

/** A 60Hz schedule with a tick every frame. */
export const SCHEDULE_60: FrameSchedule = {
  scheduleVersion: 1,
  frameDurationMs: 16,
  tickCadence: 1,
};

/** A 30Hz schedule with a tick every 2 frames. */
export const SCHEDULE_30_EVERY_2: FrameSchedule = {
  scheduleVersion: 1,
  frameDurationMs: 33,
  tickCadence: 2,
};

/** Deterministically open a valid active session for tenant A. */
export function openSession(
  overrides: Partial<{
    deviceSessionId: string;
    device: DeviceDescriptor;
    schedule: FrameSchedule | undefined;
    openedAtMs: number;
  }> = {},
): DeviceSessionRecord {
  const opened = openDeviceSession({
    deviceSessionId: overrides.deviceSessionId ?? 'ds-alpha-1',
    tenantScope: SCOPE_A,
    device: overrides.device ?? DESKTOP_DEVICE,
    schedule: overrides.schedule,
    openedAtMs: overrides.openedAtMs ?? 0,
  });
  if (!opened.ok) {
    throw new Error(`fixture session failed to open: ${opened.error.message}`);
  }
  return opened.value.session;
}

/** Deterministically collect the full event history of a fixture script. */
export function collectEvents(
  transitions: ReadonlyArray<{ readonly events: readonly RuntimeEvent[] }>,
): RuntimeEvent[] {
  return transitions.flatMap((transition) => [...transition.events]);
}
