/**
 * The canonical device-class profile table — the W011 device-slot FILLER
 * (the "fills and adapts it" pin of spec/…/device.ts: W019 fills the
 * abstract slot).
 *
 * A host that knows only which neutral device class a surface is gets a
 * valid, provider-neutral W011 {@link DeviceDescriptor} from this table
 * (pure frozen data — never environment-sniffed, never a vendor product
 * fingerprint). {@link descriptorFromProfile} then merges caller
 * overrides (partial interaction/display/spatial values) into the class
 * baseline, re-establishing the W011 deterministic set semantics for the
 * interaction modality list.
 *
 * The baselines are CAPABILITY DATA, not hardware claims: they encode the
 * frozen device-adaptation expectations (desktop = full fidelity surface,
 * phone = field surface, headset = stereoscopic spatial surface, wall
 * display = large passive surface) as typed budgets the adaptation
 * kernel downstream can assess.
 */
import { z } from 'zod';
import {
  DEVICE_CLASSES,
  DEVICE_DESCRIPTOR_VERSION,
  DeviceClassSchema,
  InteractionModalitySchema,
  type DeviceClass,
  type DeviceDescriptor,
  type InteractionModality,
} from '@epoch/experience-protocol';
import {
  DEVICE_CLASS_TIER_CEILINGS,
  DeviceAdaptationTierSchema,
  type DeviceAdaptationTier,
} from './version';
import { unknownDeviceClassError } from './issues';
import type { DeviceCapabilitiesResult } from './errors';

/** One device-class baseline: interaction, display, and spatial budgets. */
export interface DeviceClassProfile {
  /** The neutral device class this profile fills. */
  readonly deviceClass: DeviceClass;
  /** Sorted interaction modality set of the class baseline. */
  readonly interaction: readonly InteractionModality[];
  /** Display baseline of the class. */
  readonly display: {
    readonly stereoscopic: boolean;
    readonly maxPixels: number;
    readonly refreshHz: number;
    readonly colorDepthBits: number;
  };
  /** Spatial baseline of the class. */
  readonly spatial: {
    readonly poseTracking: 'none' | '3dof' | '6dof';
    readonly worldAnchored: boolean;
    readonly maxTriangles: number;
    readonly maxTextureBytes: number;
  };
  /** Upper bound on acceptable interaction-to-photon latency. */
  readonly latencyBudgetMs: number;
  /** The tier ceiling this class caps assessments at. */
  readonly tierCeiling: DeviceAdaptationTier;
}

/**
 * The canonical device-class profile table (frozen data). Budgets are
 * inclusive floors' round numbers aligned with the tier floor table
 * (src/version.ts): every baseline satisfies its class ceiling tier.
 */
export const DEVICE_CLASS_PROFILES: Readonly<Record<DeviceClass, DeviceClassProfile>> = {
  desktop: {
    deviceClass: 'desktop',
    interaction: ['keyboard', 'pointer', 'voice'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 2_000_000, maxTextureBytes: 536_870_912 },
    latencyBudgetMs: 50,
    tierCeiling: 'full',
  },
  laptop: {
    deviceClass: 'laptop',
    interaction: ['keyboard', 'pointer', 'touch'],
    display: { stereoscopic: false, maxPixels: 1_440_000, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 1_000_000, maxTextureBytes: 268_435_456 },
    latencyBudgetMs: 50,
    tierCeiling: 'normal',
  },
  tablet: {
    deviceClass: 'tablet',
    interaction: ['pointer', 'touch', 'voice'],
    display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 250_000, maxTextureBytes: 67_108_864 },
    latencyBudgetMs: 100,
    tierCeiling: 'field',
  },
  phone: {
    deviceClass: 'phone',
    interaction: ['touch', 'voice'],
    display: { stereoscopic: false, maxPixels: 1_048_576, refreshHz: 60, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 100_000, maxTextureBytes: 33_554_432 },
    latencyBudgetMs: 100,
    tierCeiling: 'field',
  },
  headset: {
    deviceClass: 'headset',
    interaction: ['gesture', 'voice'],
    display: { stereoscopic: true, maxPixels: 4_147_200, refreshHz: 90, colorDepthBits: 24 },
    spatial: { poseTracking: '6dof', worldAnchored: true, maxTriangles: 500_000, maxTextureBytes: 134_217_728 },
    latencyBudgetMs: 20,
    tierCeiling: 'normal',
  },
  'wall-display': {
    deviceClass: 'wall-display',
    interaction: ['pointer'],
    display: { stereoscopic: false, maxPixels: 16_777_216, refreshHz: 30, colorDepthBits: 24 },
    spatial: { poseTracking: 'none', worldAnchored: false, maxTriangles: 2_000_000, maxTextureBytes: 536_870_912 },
    latencyBudgetMs: 100,
    tierCeiling: 'full',
  },
};

/** The canonical profile of one device class (pure lookup). */
export function deviceClassProfileOf(deviceClass: string): DeviceCapabilitiesResult<DeviceClassProfile> {
  const parsed = DeviceClassSchema.safeParse(deviceClass);
  if (!parsed.success) {
    return { ok: false, error: unknownDeviceClassError(deviceClass) };
  }
  return { ok: true, value: DEVICE_CLASS_PROFILES[parsed.data] };
}

/** Caller overrides merged into a class baseline (all members optional). */
export interface ProfileOverrides {
  /** Replacement sorted modality set (validated for set semantics). */
  readonly interaction?: readonly string[];
  /** Partial display overrides. */
  readonly display?: {
    readonly stereoscopic?: boolean;
    readonly maxPixels?: number;
    readonly refreshHz?: number;
    readonly colorDepthBits?: number;
  };
  /** Partial spatial overrides. */
  readonly spatial?: {
    readonly poseTracking?: 'none' | '3dof' | '6dof';
    readonly worldAnchored?: boolean;
    readonly maxTriangles?: number;
    readonly maxTextureBytes?: number;
  };
  /** Replacement latency budget. */
  readonly latencyBudgetMs?: number;
}

/**
 * Fill the W011 device-descriptor slot from a device-class profile plus
 * optional overrides (total: unknown classes and invalid overrides yield
 * typed errors; the interaction list is re-sorted so the result always
 * satisfies the W011 deterministic set semantics). Pure — no
 * environment sniffing, no clock, no randomness.
 */
export function descriptorFromProfile(
  deviceClass: string,
  overrides: ProfileOverrides = {},
): DeviceCapabilitiesResult<DeviceDescriptor> {
  const profile = deviceClassProfileOf(deviceClass);
  if (!profile.ok) {
    return profile;
  }

  const interaction = [...(overrides.interaction ?? profile.value.interaction)].sort();
  const interactionParsed = z
    .array(InteractionModalitySchema)
    .min(1)
    .max(16)
    .refine(
      (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
      'interaction modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
    )
    .safeParse(interaction);
  if (!interactionParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the interaction override failed the W011 modality-set semantics',
        issues: interactionParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? 'interaction' : `interaction.${issue.path.map(String).join('.')}`,
          message: issue.message,
        })),
      },
    };
  }

  const display = {
    stereoscopic: overrides.display?.stereoscopic ?? profile.value.display.stereoscopic,
    maxPixels: overrides.display?.maxPixels ?? profile.value.display.maxPixels,
    refreshHz: overrides.display?.refreshHz ?? profile.value.display.refreshHz,
    colorDepthBits: overrides.display?.colorDepthBits ?? profile.value.display.colorDepthBits,
  };
  const spatial = {
    poseTracking: overrides.spatial?.poseTracking ?? profile.value.spatial.poseTracking,
    worldAnchored: overrides.spatial?.worldAnchored ?? profile.value.spatial.worldAnchored,
    maxTriangles: overrides.spatial?.maxTriangles ?? profile.value.spatial.maxTriangles,
    maxTextureBytes: overrides.spatial?.maxTextureBytes ?? profile.value.spatial.maxTextureBytes,
  };

  const descriptor: DeviceDescriptor = {
    descriptorVersion: DEVICE_DESCRIPTOR_VERSION,
    deviceClass: profile.value.deviceClass,
    interaction: interactionParsed.data,
    display,
    spatial,
    latencyBudgetMs: overrides.latencyBudgetMs ?? profile.value.latencyBudgetMs,
  };
  return { ok: true, value: descriptor };
}

/** The tier ceiling of one device class (pure lookup over the closed table). */
export function tierCeilingOf(deviceClass: DeviceClass): DeviceAdaptationTier {
  return DEVICE_CLASS_TIER_CEILINGS[deviceClass];
}

// Re-exported for the schema surface (zod validators of profile shapes).
export const DeviceClassProfileSchema = z
  .strictObject({
    deviceClass: DeviceClassSchema,
    interaction: z
      .array(InteractionModalitySchema)
      .min(1)
      .max(16)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'interaction modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    display: z.strictObject({
      stereoscopic: z.boolean(),
      maxPixels: z.number().int().positive(),
      refreshHz: z.number().int().positive(),
      colorDepthBits: z.number().int().positive(),
    }),
    spatial: z.strictObject({
      poseTracking: z.enum(['none', '3dof', '6dof']),
      worldAnchored: z.boolean(),
      maxTriangles: z.number().int().positive(),
      maxTextureBytes: z.number().int().positive(),
    }),
    latencyBudgetMs: z.number().int().positive(),
    tierCeiling: DeviceAdaptationTierSchema,
  })
  .meta({
    id: 'DeviceClassProfile',
    title: 'DeviceClassProfile',
    description:
      'The canonical baseline of one neutral device class: interaction set, display and spatial budgets, latency budget, and tier ceiling (pure data — fills the W011 device slot).',
  });

/** The frozen device-class vocabulary (re-export for consumers). */
export { DEVICE_CLASSES };
