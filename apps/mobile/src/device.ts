/**
 * @epoch/mobile — the FIELD-fidelity device descriptor (Work Order W018
 * Tech Lead pin).
 *
 * The mobile client's DeviceDescriptor fills the W011 device-descriptor
 * SLOT at FIELD fidelity per the experience-architecture device-adaptation
 * ladder ("mobile = field"): same semantics, reduced fidelity. The
 * descriptor is validated through @epoch/experience-protocol's
 * `validateDeviceDescriptor` (the W011 admission machinery) — this module
 * owns only the FIELD capability SET, never a second descriptor contract
 * (lock rule 16: one responsibility, one authority).
 *
 * Field fidelity means:
 * - a `phone`/`tablet` device class (the neutral W011 classes — never
 *   vendor products);
 * - interaction on the field modality set: touch, gesture, voice
 *   (low-friction capture; keyboard/pointer/gamepad/gaze stay at higher
 *   rungs of the ladder);
 * - non-stereoscopic, bounded displays; NO spatial tracking and NO world
 *   anchoring (full/normal fidelity rungs own those);
 * - a bounded interaction latency budget.
 */
import {
  DEVICE_DESCRIPTOR_VERSION,
  DeviceDescriptorSchema,
  type DeviceDescriptor,
  type DeviceClass,
  type InteractionModality,
} from '@epoch/experience-protocol';
import { fieldError, fieldOk, type MobileFieldResult } from './errors';
import { FIELD_FIDELITY_INTERACTION_MODALITIES } from './version';

/** The neutral device classes valid for a field client (W011 vocabulary). */
export const FIELD_DEVICE_CLASSES = ['phone', 'tablet'] as const;

/** One field device class. */
export type FieldDeviceClass = (typeof FIELD_DEVICE_CLASSES)[number];

/** The field display budgets (reduced fidelity rung of the ladder). */
export const FIELD_DISPLAY_BUDGETS = {
  /** Stereoscopic rendering stays off at field fidelity. */
  stereoscopic: false,
  /** Bounded 2D pixel budget of a field device surface. */
  maxPixels: 2_764_800,
  /** Nominal refresh rate of a field device surface. */
  refreshHz: 60,
  /** Color depth per channel of a field device surface. */
  colorDepthBits: 24,
} as const;

/** The field spatial capabilities: none (field fidelity has no 3D pose/anchoring). */
export const FIELD_SPATIAL_CAPABILITIES = {
  poseTracking: 'none',
  worldAnchored: false,
} as const;

/** The field interaction-to-photon latency budget (milliseconds). */
export const FIELD_LATENCY_BUDGET_MS = 100 as const;

/**
 * The complete FIELD-fidelity capability set (the ladder pin, exported for
 * the field-fidelity evidence test).
 */
export const FIELD_DEVICE_CAPABILITY_SET = {
  deviceClasses: [...FIELD_DEVICE_CLASSES],
  interactionModalities: [...FIELD_FIDELITY_INTERACTION_MODALITIES],
  display: FIELD_DISPLAY_BUDGETS,
  spatial: FIELD_SPATIAL_CAPABILITIES,
  latencyBudgetMs: FIELD_LATENCY_BUDGET_MS,
} as const;

/** Options of {@link buildFieldDeviceDescriptor}. */
export interface FieldDeviceDescriptorOptions {
  /** The neutral device class (defaults to `phone`). */
  readonly deviceClass?: FieldDeviceClass;
  /**
   * The interaction modalities, defaulting to the full field set. Must be a
   * non-empty SUBSET of the field set; admission sorts and deduplicates the
   * set (the W011 deterministic set semantics).
   */
  readonly interaction?: readonly InteractionModality[];
}

/**
 * Build the mobile DeviceDescriptor at FIELD fidelity. The result is
 * validated through the W011 admission machinery (typed rejection on any
 * shape drift). Deterministic: identical options produce identical
 * descriptors (and therefore identical descriptor digests).
 */
export function buildFieldDeviceDescriptor(
  options: FieldDeviceDescriptorOptions = {},
): MobileFieldResult<DeviceDescriptor> {
  const deviceClass: DeviceClass = options.deviceClass ?? 'phone';
  if (!FIELD_DEVICE_CLASSES.includes(deviceClass as FieldDeviceClass)) {
    return fieldError({
      code: 'validation',
      message: `device class "${deviceClass}" is not a field client class (${FIELD_DEVICE_CLASSES.join(' | ')})`,
    });
  }
  const requested =
    options.interaction === undefined
      ? [...FIELD_FIDELITY_INTERACTION_MODALITIES]
      : [...new Set(options.interaction)].sort();
  if (requested.length === 0) {
    return fieldError({
      code: 'validation',
      message: 'a field device descriptor requires at least one interaction modality',
    });
  }
  for (const modality of requested) {
    if (!(FIELD_FIDELITY_INTERACTION_MODALITIES as readonly string[]).includes(modality)) {
      return fieldError({
        code: 'validation',
        message:
          `interaction modality "${modality}" is not a field-fidelity modality ` +
          `(${FIELD_FIDELITY_INTERACTION_MODALITIES.join(' | ')} — the experience-architecture ladder pins mobile to the field set)`,
      });
    }
  }
  const descriptor: DeviceDescriptor = {
    descriptorVersion: DEVICE_DESCRIPTOR_VERSION,
    deviceClass,
    interaction: requested,
    display: { ...FIELD_DISPLAY_BUDGETS },
    spatial: { ...FIELD_SPATIAL_CAPABILITIES },
    latencyBudgetMs: FIELD_LATENCY_BUDGET_MS,
  };
  const parsed = DeviceDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    return fieldError({
      code: 'validation',
      message: 'the built field device descriptor failed W011 admission',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  }
  return fieldOk(parsed.data);
}

/** Validate a serialized field device descriptor through W011 admission. */
export function validateFieldDeviceDescriptor(input: unknown): MobileFieldResult<DeviceDescriptor> {
  const parsed = DeviceDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return fieldError({
      code: 'validation',
      message: 'not a valid W011 device descriptor',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  }
  if (!FIELD_DEVICE_CLASSES.includes(parsed.data.deviceClass as FieldDeviceClass)) {
    return fieldError({
      code: 'validation',
      message: `device class "${parsed.data.deviceClass}" is not a field client class`,
    });
  }
  for (const modality of parsed.data.interaction) {
    if (!(FIELD_FIDELITY_INTERACTION_MODALITIES as readonly string[]).includes(modality)) {
      return fieldError({
        code: 'validation',
        message: `interaction modality "${modality}" exceeds the field-fidelity rung of the ladder`,
      });
    }
  }
  return fieldOk(parsed.data);
}
