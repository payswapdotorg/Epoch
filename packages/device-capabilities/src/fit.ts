/**
 * Presentation fit / gap analysis — comparing a W011 device descriptor
 * against a declared presentation requirement (the "which surface can
 * host which presentation" half of device adaptation).
 *
 * A {@link PresentationRequirement} is typed DATA (what a presentation
 * needs: spatial or flat, stereoscopic or not, minimum budgets, required
 * modalities, minimum pose tracking). {@link assessPresentationFit}
 * compares the requirement against a device descriptor and yields a
 * {@link PresentationFit} record: `fits` plus a typed gap list — every
 * shortfall is an explicit typed record (encountered vs required), never
 * a silent downgrade (the W016 never-silent discipline applied to
 * capability checks).
 *
 * Semantics:
 * - a declared device budget BELOW a required minimum is a
 *   `*-budget-shortfall` gap; an UNDECLARED device budget satisfies any
 *   requirement (unconstrained, the W013 negotiation convention);
 * - a required modality the device does not service is a `modality-gap`;
 * - a required stereoscopic presentation on a non-stereoscopic device is
 *   a `stereoscopic-mismatch`;
 * - a required pose-tracking class above the device's is a
 *   `pose-tracking-insufficient` gap (none < 3dof < 6dof).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  DeviceDescriptorSchema,
  InteractionModalitySchema,
} from '@epoch/experience-protocol';
import {
  CAPABILITY_GAP_KINDS,
  CapabilityGapKindSchema,
  DEVICE_CAPABILITIES_PROTOCOL_VERSION,
  PRESENTATION_FIT_SCHEMA_NAME,
} from './version';
import { PresentationRequirementIdSchema, Sha256HexSchema } from './primitives';
import { malformedRecordError } from './issues';
import type { DeviceCapabilitiesResult } from './errors';

/** Version discriminator of the presentation-requirement record. */
export const PRESENTATION_REQUIREMENT_VERSION = 1 as const;

/** The pose-tracking capability order (none < 3dof < 6dof). */
const POSE_RANK: Readonly<Record<'none' | '3dof' | '6dof', number>> = {
  none: 0,
  '3dof': 1,
  '6dof': 2,
};

/**
 * One declared presentation requirement (typed data: what a presentation
 * needs). All members are optional except the spatial flag — a flat
 * presentation imposes no spatial budgets.
 */
export const PresentationRequirementSchema = z
  .strictObject({
    requirementVersion: z.literal(PRESENTATION_REQUIREMENT_VERSION),
    requirementId: PresentationRequirementIdSchema,
    /** Whether the presentation is spatial (3D/animation) or flat (2D). */
    spatial: z.boolean(),
    /** Whether the presentation requires stereoscopic output. */
    stereoscopic: z.boolean(),
    /** Minimum total pixel budget the presentation targets. */
    minPixels: z.number().int().positive().optional(),
    /** Minimum triangle budget a spatial presentation needs. */
    minTriangles: z.number().int().positive().optional(),
    /** Minimum texture-memory budget a spatial presentation needs. */
    minTextureBytes: z.number().int().positive().optional(),
    /** Interaction modalities the presentation requires (sorted set). */
    requiredModalities: z
      .array(InteractionModalitySchema)
      .max(7)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'requiredModalities must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Minimum pose-tracking class an immersive presentation needs. */
    minPoseTracking: z.enum(['none', '3dof', '6dof']),
  })
  .superRefine((requirement, ctx) => {
    if (!requirement.spatial && requirement.minTriangles !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a flat (non-spatial) presentation cannot declare a triangle requirement',
        path: ['minTriangles'],
      });
    }
    if (!requirement.spatial && requirement.minTextureBytes !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a flat (non-spatial) presentation cannot declare a texture-memory requirement',
        path: ['minTextureBytes'],
      });
    }
  })
  .meta({
    id: 'PresentationRequirement',
    title: 'PresentationRequirement',
    description:
      'One declared presentation requirement: spatial flag, stereoscopic flag, minimum budgets, required modalities, and minimum pose tracking (typed data).',
  });

/** One presentation requirement. */
export type PresentationRequirement = z.infer<typeof PresentationRequirementSchema>;

/** One typed capability gap: the axis that fell short, with both values. */
export const CapabilityGapSchema = z
  .strictObject({
    kind: CapabilityGapKindSchema,
    /** Dotted path of the device field that fell short. */
    path: z.string().min(1),
    /** The device's declared value (absent for set-membership gaps). */
    encountered: z.number().int().nonnegative().optional(),
    /** The requirement's demanded value (absent for set-membership gaps). */
    required: z.number().int().nonnegative().optional(),
    /** The modality that is missing (modality gaps only). */
    modality: z.enum(['gamepad', 'gaze', 'gesture', 'keyboard', 'pointer', 'touch', 'voice']).optional(),
  })
  .meta({
    id: 'CapabilityGap',
    title: 'CapabilityGap',
    description:
      'One typed capability gap: kind, device path, encountered vs required values, and the missing modality when applicable.',
  });

/** One capability gap. */
export type CapabilityGap = z.infer<typeof CapabilityGapSchema>;

/** The fit verdict of one presentation requirement against one device. */
export const PresentationFitSchema = z
  .strictObject({
    schema: z.literal(PRESENTATION_FIT_SCHEMA_NAME),
    protocolVersion: z.literal(DEVICE_CAPABILITIES_PROTOCOL_VERSION),
    requirementId: PresentationRequirementIdSchema,
    /** The assessed device descriptor (embedded, verbatim). */
    device: DeviceDescriptorSchema,
    /** Whether the device satisfies the requirement with no gaps. */
    fits: z.boolean(),
    /** Every encountered gap, in the fixed evaluation order. */
    gaps: z.array(CapabilityGapSchema),
    /** Content digest of this fit verdict (canonical SHA-256). */
    digest: Sha256HexSchema,
  })
  .superRefine((fit, ctx) => {
    if (fit.fits && fit.gaps.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'a fitting verdict cannot carry gaps',
        path: ['gaps'],
      });
    }
    if (!fit.fits && fit.gaps.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'a non-fitting verdict must carry at least one gap',
        path: ['gaps'],
      });
    }
  })
  .meta({
    id: 'PresentationFit',
    title: 'PresentationFit',
    description:
      'The typed fit verdict of one presentation requirement against one W011 device descriptor: fits flag plus the explicit gap list.',
  });

/** One fit verdict. */
export type PresentationFit = z.infer<typeof PresentationFitSchema>;

/** The fixed evaluation order of gap kinds (deterministic verdicts). */
const GAP_ORDER: readonly (typeof CAPABILITY_GAP_KINDS)[number][] = [
  'stereoscopic-mismatch',
  'pose-tracking-insufficient',
  'pixel-budget-shortfall',
  'triangle-budget-shortfall',
  'texture-budget-shortfall',
  'modality-gap',
];

/**
 * Assess whether one device descriptor satisfies one presentation
 * requirement (pure, deterministic, total). Gaps are emitted in the fixed
 * {@link GAP_ORDER} order; the verdict record carries a canonical
 * content digest.
 */
export function assessPresentationFit(
  input: {
    readonly requirement: unknown;
    readonly device: unknown;
  },
): DeviceCapabilitiesResult<PresentationFit> {
  const requirementParsed = PresentationRequirementSchema.safeParse(input.requirement);
  if (!requirementParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(requirementParsed.error),
        message: 'the presentation requirement failed schema admission',
      },
    };
  }
  const deviceParsed = DeviceDescriptorSchema.safeParse(input.device);
  if (!deviceParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(deviceParsed.error),
        message: 'the assessed value failed W011 device-descriptor admission',
      },
    };
  }
  const requirement = requirementParsed.data;
  const device = deviceParsed.data;

  const gaps: CapabilityGap[] = [];
  if (requirement.stereoscopic && !device.display.stereoscopic) {
    gaps.push({
      kind: 'stereoscopic-mismatch',
      path: 'device.display.stereoscopic',
    });
  }
  if (POSE_RANK[device.spatial.poseTracking] < POSE_RANK[requirement.minPoseTracking]) {
    gaps.push({
      kind: 'pose-tracking-insufficient',
      path: 'device.spatial.poseTracking',
    });
  }
  if (
    requirement.minPixels !== undefined &&
    device.display.maxPixels !== undefined &&
    device.display.maxPixels < requirement.minPixels
  ) {
    gaps.push({
      kind: 'pixel-budget-shortfall',
      path: 'device.display.maxPixels',
      encountered: device.display.maxPixels,
      required: requirement.minPixels,
    });
  }
  if (
    requirement.minTriangles !== undefined &&
    device.spatial.maxTriangles !== undefined &&
    device.spatial.maxTriangles < requirement.minTriangles
  ) {
    gaps.push({
      kind: 'triangle-budget-shortfall',
      path: 'device.spatial.maxTriangles',
      encountered: device.spatial.maxTriangles,
      required: requirement.minTriangles,
    });
  }
  if (
    requirement.minTextureBytes !== undefined &&
    device.spatial.maxTextureBytes !== undefined &&
    device.spatial.maxTextureBytes < requirement.minTextureBytes
  ) {
    gaps.push({
      kind: 'texture-budget-shortfall',
      path: 'device.spatial.maxTextureBytes',
      encountered: device.spatial.maxTextureBytes,
      required: requirement.minTextureBytes,
    });
  }
  const serviced = new Set<string>(device.interaction);
  for (const modality of requirement.requiredModalities) {
    if (!serviced.has(modality)) {
      gaps.push({
        kind: 'modality-gap',
        path: 'device.interaction',
        modality,
      });
    }
  }

  // The fixed evaluation order (deterministic verdicts, stable digests).
  gaps.sort((a, b) => GAP_ORDER.indexOf(a.kind) - GAP_ORDER.indexOf(b.kind));

  const content = {
    schema: PRESENTATION_FIT_SCHEMA_NAME,
    protocolVersion: DEVICE_CAPABILITIES_PROTOCOL_VERSION,
    requirementId: requirement.requirementId,
    device,
    fits: gaps.length === 0,
    gaps,
  };
  return {
    ok: true,
    value: {
      ...content,
      digest: canonicalDigest(content as unknown as JsonValue),
    },
  };
}
