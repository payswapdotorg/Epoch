/**
 * The abstract device-descriptor slot (architecture.md "Experience
 * Runtime" — binding; R29 device-aware fidelity).
 *
 * The slot is TYPED, PROVIDER-NEUTRAL capability/limit data only: which
 * neutral device class a surface renders on, which interaction modalities
 * it offers, and bounded display/spatial budgets. W019 (Renderer/Device
 * Adaptation) fills and adapts it; ZERO concrete renderers, ZERO
 * WebGL/GPU/graphics-API vocabulary, and ZERO UI-framework dependencies
 * live here (lock rule 13). Every field is renderer-agnostic so any
 * future adapter (web, desktop, mobile) can consume the same descriptor.
 */
import { z } from 'zod';
import {
  DEVICE_DESCRIPTOR_VERSION,
  DeviceClassSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
} from './version';

/** Display capabilities and budgets (typed, neutral, bounded). */
export const DeviceDisplayCapabilitiesSchema = z
  .strictObject({
    /** Whether the surface renders stereoscopically (headsets, 3D walls). */
    stereoscopic: z.boolean(),
    /** Total 2D pixel budget of the surface. */
    maxPixels: z.number().int().positive().optional(),
    /** Nominal refresh rate of the surface. */
    refreshHz: z.number().int().positive().optional(),
    /** Color depth of the surface in bits per channel. */
    colorDepthBits: z.number().int().positive().optional(),
  })
  .meta({
    id: 'DeviceDisplayCapabilities',
    title: 'DeviceDisplayCapabilities',
    description: 'Neutral display capabilities and budgets of a device descriptor.',
  });

/** Display capabilities and budgets. */
export type DeviceDisplayCapabilities = z.infer<typeof DeviceDisplayCapabilitiesSchema>;

/** Spatial capabilities and budgets (typed, neutral, bounded). */
export const DeviceSpatialCapabilitiesSchema = z
  .strictObject({
    /** Pose tracking class of the device. */
    poseTracking: PoseTrackingKindSchema,
    /** Whether content can anchor to the physical world (world-scale). */
    worldAnchored: z.boolean(),
    /** Triangle budget for 3D content. */
    maxTriangles: z.number().int().positive().optional(),
    /** Texture memory budget for 3D content, in bytes. */
    maxTextureBytes: z.number().int().positive().optional(),
  })
  .meta({
    id: 'DeviceSpatialCapabilities',
    title: 'DeviceSpatialCapabilities',
    description: 'Neutral spatial capabilities and budgets of a device descriptor.',
  });

/** Spatial capabilities and budgets. */
export type DeviceSpatialCapabilities = z.infer<typeof DeviceSpatialCapabilitiesSchema>;

/**
 * The abstract device descriptor. Carried by every projection request (the
 * device the experience is requested FOR) and every Experience Graph (the
 * device the graph was produced for). `interaction` is a sorted, duplicate
 * -free, non-empty modality set (deterministic set semantics).
 */
export const DeviceDescriptorSchema = z
  .strictObject({
    descriptorVersion: z.literal(DEVICE_DESCRIPTOR_VERSION),
    deviceClass: DeviceClassSchema,
    interaction: z
      .array(InteractionModalitySchema)
      .min(1)
      .max(16)
      .refine(
        (modalities) =>
          modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'interaction modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    display: DeviceDisplayCapabilitiesSchema,
    spatial: DeviceSpatialCapabilitiesSchema,
    /** Upper bound on acceptable interaction-to-photon latency. */
    latencyBudgetMs: z.number().int().positive().optional(),
  })
  .meta({
    id: 'DeviceDescriptor',
    title: 'DeviceDescriptor',
    description:
      'Abstract, provider-neutral device descriptor: capabilities and budgets as typed data; filled/adapted by renderer/device adaptation (W019).',
  });

/** One device descriptor. */
export type DeviceDescriptor = z.infer<typeof DeviceDescriptorSchema>;
