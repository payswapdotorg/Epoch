/**
 * The deterministic device capability assessment — the device-side core
 * of Renderer/Device Adaptation (R29 device-aware fidelity).
 *
 * `assessDeviceDescriptor` derives a sealed
 * {@link DeviceCapabilityAssessment} from a W011 device descriptor alone:
 *
 * - the BUDGET FLOOR tier: the highest tier whose every floor is met by
 *   every DECLARED budget (undeclared budgets never downgrade — the W013
 *   negotiation convention: absent = unconstrained);
 * - the CLASS CEILING tier: the device class's ergonomic expectation
 *   (a phone with desktop-class budgets is still a field surface);
 * - the derived tier = the lower of the two (same semantics, different
 *   fidelity — spec/experience-architecture.md "Device adaptation");
 * - `remoteAssistRecommended` — the frozen "remote rendering = optional"
 *   row: true when the device cannot host even the reduced local path
 *   within its declared budgets;
 * - typed axis snapshots (display, spatial, interaction coverage) so the
 *   record is self-describing evidence of WHAT was assessed.
 *
 * Determinism: the assessment is a pure function of the descriptor and
 * the caller-supplied assessment id; it reads no clock, no environment,
 * and no randomness, and it is content-addressed (canonical SHA-256) so
 * the same descriptor+id always yields the byte-identical record.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  DeviceDescriptorSchema,
  type DeviceDescriptor,
} from '@epoch/experience-protocol';
import {
  DEVICE_ADAPTATION_TIERS,
  DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME,
  DEVICE_CAPABILITIES_PROTOCOL_VERSION,
  DEVICE_CLASS_TIER_CEILINGS,
  TIER_BUDGET_FLOORS,
  TIER_RANK,
  ADAPTATION_TIER_FIDELITY_GUIDANCE,
  DeviceAdaptationTierSchema,
  GuidedFidelityLevelSchema,
  type DeviceAdaptationTier,
} from './version';
import { AssessmentIdSchema, Sha256HexSchema } from './primitives';
import { malformedRecordError } from './issues';
import type { DeviceCapabilitiesResult } from './errors';

// ---------------------------------------------------------------------------
// Tier derivation (the deterministic decision table).
// ---------------------------------------------------------------------------

/**
 * The budget-floor tier of a descriptor: the highest tier whose pixel /
 * triangle / texture floors are all met by the descriptor's DECLARED
 * budgets. An undeclared budget satisfies every tier (unconstrained).
 * Tiers are checked by DESCENDING capability rank (full first), so the
 * first satisfying candidate is the highest.
 */
export function budgetFloorTierOf(device: DeviceDescriptor): DeviceAdaptationTier {
  const byDescendingRank = [...DEVICE_ADAPTATION_TIERS].sort(
    (a, b) => TIER_RANK[b] - TIER_RANK[a],
  );
  for (const candidate of byDescendingRank) {
    const floors = TIER_BUDGET_FLOORS[candidate];
    const pixelsOk =
      device.display.maxPixels === undefined || device.display.maxPixels >= floors.minPixels;
    const trianglesOk =
      device.spatial.maxTriangles === undefined ||
      device.spatial.maxTriangles >= floors.minTriangles;
    const texturesOk =
      device.spatial.maxTextureBytes === undefined ||
      device.spatial.maxTextureBytes >= floors.minTextureBytes;
    if (pixelsOk && trianglesOk && texturesOk) {
      return candidate;
    }
  }
  return 'reduced';
}

/**
 * The derived adaptation tier of a device descriptor: the lower of the
 * budget-floor tier and the device-class ceiling (deterministic).
 */
export function adaptationTierOf(device: DeviceDescriptor): DeviceAdaptationTier {
  const floor = budgetFloorTierOf(device);
  const ceiling = DEVICE_CLASS_TIER_CEILINGS[device.deviceClass];
  return TIER_RANK[floor] <= TIER_RANK[ceiling] ? floor : ceiling;
}

/**
 * Whether the device should be recommended the optional remote-rendering
 * assist path: true when its declared budgets cannot host even the
 * reduced local path (the frozen "low capability" row's hard floor).
 */
export function remoteAssistRecommendedFor(device: DeviceDescriptor): boolean {
  const reduced = TIER_BUDGET_FLOORS.reduced;
  if (device.display.maxPixels !== undefined && device.display.maxPixels < reduced.minPixels) {
    return true;
  }
  if (
    device.spatial.maxTriangles !== undefined &&
    device.spatial.maxTriangles < reduced.minTriangles
  ) {
    return true;
  }
  return (
    device.spatial.maxTextureBytes !== undefined &&
    device.spatial.maxTextureBytes < reduced.minTextureBytes
  );
}

// ---------------------------------------------------------------------------
// The sealed assessment record.
// ---------------------------------------------------------------------------

/** The typed display-axis snapshot of an assessment. */
export const DisplayAxisSchema = z
  .strictObject({
    stereoscopic: z.boolean(),
    maxPixels: z.number().int().positive().optional(),
    refreshHz: z.number().int().positive().optional(),
    colorDepthBits: z.number().int().positive().optional(),
  })
  .meta({
    id: 'DisplayAxis',
    title: 'DisplayAxis',
    description: 'The display-axis snapshot of a device capability assessment.',
  });

/** One display axis. */
export type DisplayAxis = z.infer<typeof DisplayAxisSchema>;

/** The typed spatial-axis snapshot of an assessment. */
export const SpatialAxisSchema = z
  .strictObject({
    poseTracking: z.enum(['none', '3dof', '6dof']),
    worldAnchored: z.boolean(),
    maxTriangles: z.number().int().positive().optional(),
    maxTextureBytes: z.number().int().positive().optional(),
  })
  .meta({
    id: 'SpatialAxis',
    title: 'SpatialAxis',
    description: 'The spatial-axis snapshot of a device capability assessment.',
  });

/** One spatial axis. */
export type SpatialAxis = z.infer<typeof SpatialAxisSchema>;

/** The sorted modality-coverage snapshot of an assessment. */
export const ModalityCoverageSchema = z
  .array(z.enum(['gamepad', 'gaze', 'gesture', 'keyboard', 'pointer', 'touch', 'voice']))
  .max(7)
  .refine(
    (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
    'interaction modalities must be sorted ascending and duplicate-free (deterministic set semantics)',
  )
  .meta({
    id: 'ModalityCoverage',
    title: 'ModalityCoverage',
    description: 'The sorted interaction-modality coverage snapshot of an assessment.',
  });

/** One modality coverage snapshot. */
export type ModalityCoverage = z.infer<typeof ModalityCoverageSchema>;

/**
 * The assessment's derivation trace: the intermediate tiers of the
 * deterministic decision, recorded so the tier is never an unexplained
 * verdict (typed evidence — the W016 never-silent discipline).
 */
export const TierDerivationSchema = z
  .strictObject({
    budgetFloorTier: DeviceAdaptationTierSchema,
    classCeilingTier: DeviceAdaptationTierSchema,
    derivedTier: DeviceAdaptationTierSchema,
    guidedFidelity: GuidedFidelityLevelSchema,
    remoteAssistRecommended: z.boolean(),
  })
  .meta({
    id: 'TierDerivation',
    title: 'TierDerivation',
    description:
      'The deterministic tier-derivation trace: budget-floor tier, class ceiling, derived tier, guided fidelity level, and the remote-assist recommendation.',
  });

/** One tier derivation. */
export type TierDerivation = z.infer<typeof TierDerivationSchema>;

/**
 * Derive the deterministic tier-derivation trace of a device descriptor
 * (pure; the canonical-consistency authority shared by the content
 * schema's refinement and {@link assessDeviceDescriptor}).
 */
export function tierDerivationOf(device: DeviceDescriptor): TierDerivation {
  const derived = adaptationTierOf(device);
  return {
    budgetFloorTier: budgetFloorTierOf(device),
    classCeilingTier: DEVICE_CLASS_TIER_CEILINGS[device.deviceClass],
    derivedTier: derived,
    guidedFidelity: ADAPTATION_TIER_FIDELITY_GUIDANCE[derived],
    remoteAssistRecommended: remoteAssistRecommendedFor(device),
  };
}

/**
 * The shared canonical-consistency refinement: the tier and derivation
 * must equal the deterministic derivation of the embedded descriptor,
 * and the axis snapshots must mirror the descriptor member-for-member
 * (tamper detection for hand-edited verdicts).
 */
function refineAssessment(
  assessment: {
    readonly device: DeviceDescriptor;
    readonly tier: DeviceAdaptationTier;
    readonly derivation: TierDerivation;
    readonly display: DisplayAxis;
    readonly spatial: SpatialAxis;
    readonly interaction: ModalityCoverage;
  },
  ctx: z.RefinementCtx,
): void {
  const expected = tierDerivationOf(assessment.device);
  if (JSON.stringify(assessment.derivation) !== JSON.stringify(expected)) {
    ctx.addIssue({
      code: 'custom',
      message:
        'the derivation trace must equal the deterministic derivation of the embedded device descriptor',
      path: ['derivation'],
    });
  }
  if (assessment.tier !== expected.derivedTier) {
    ctx.addIssue({
      code: 'custom',
      message: 'the tier must equal the deterministic derived tier of the embedded descriptor',
      path: ['tier'],
    });
  }
  if (JSON.stringify(assessment.display) !== JSON.stringify(assessment.device.display)) {
    ctx.addIssue({
      code: 'custom',
      message: 'the display axis must mirror the embedded device descriptor display',
      path: ['display'],
    });
  }
  if (JSON.stringify(assessment.spatial) !== JSON.stringify(assessment.device.spatial)) {
    ctx.addIssue({
      code: 'custom',
      message: 'the spatial axis must mirror the embedded device descriptor spatial budgets',
      path: ['spatial'],
    });
  }
  if (JSON.stringify(assessment.interaction) !== JSON.stringify(assessment.device.interaction)) {
    ctx.addIssue({
      code: 'custom',
      message: 'the interaction coverage must mirror the embedded device descriptor modality set',
      path: ['interaction'],
    });
  }
}

/** The content of a capability assessment (everything except the digest). */
export const DeviceCapabilityAssessmentContentSchema = z
  .strictObject({
    schema: z.literal(DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME),
    protocolVersion: z.literal(DEVICE_CAPABILITIES_PROTOCOL_VERSION),
    assessmentId: AssessmentIdSchema,
    /** The assessed W011 device descriptor (embedded, verbatim). */
    device: DeviceDescriptorSchema,
    tier: DeviceAdaptationTierSchema,
    derivation: TierDerivationSchema,
    display: DisplayAxisSchema,
    spatial: SpatialAxisSchema,
    interaction: ModalityCoverageSchema,
  })
  .superRefine(refineAssessment)
  .meta({
    id: 'DeviceCapabilityAssessmentContent',
    title: 'DeviceCapabilityAssessmentContent',
    description:
      'The content of a device capability assessment: assessed descriptor, derived tier, derivation trace, and axis snapshots.',
  });

/** One assessment content. */
export type DeviceCapabilityAssessmentContent = z.infer<
  typeof DeviceCapabilityAssessmentContentSchema
>;

/**
 * The sealed device capability assessment: content plus its SHA-256
 * digest over the canonical JSON of the content (the digest field
 * excluded). The digest addresses the exact assessment revision. The
 * content refinement is re-applied verbatim (the W013 sealed-envelope
 * convention: content and sealed schemas share the identical
 * canonical-consistency refinement).
 */
export const DeviceCapabilityAssessmentSchema = z
  .strictObject({
    schema: z.literal(DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME),
    protocolVersion: z.literal(DEVICE_CAPABILITIES_PROTOCOL_VERSION),
    assessmentId: AssessmentIdSchema,
    device: DeviceDescriptorSchema,
    tier: DeviceAdaptationTierSchema,
    derivation: TierDerivationSchema,
    display: DisplayAxisSchema,
    spatial: SpatialAxisSchema,
    interaction: ModalityCoverageSchema,
    digest: Sha256HexSchema,
  })
  .superRefine((assessment, ctx) => {
    refineAssessment(assessment, ctx);
    const { digest: _sealed, ...content } = assessment;
    void _sealed;
    const check = DeviceCapabilityAssessmentContentSchema.safeParse(content);
    if (!check.success) {
      for (const issue of check.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  })
  .meta({
    id: 'DeviceCapabilityAssessment',
    title: 'DeviceCapabilityAssessment',
    description:
      'The sealed device capability assessment: deterministic tier derivation over a W011 device descriptor, content-addressed by canonical SHA-256.',
  });

/** One sealed assessment. */
export type DeviceCapabilityAssessment = z.infer<typeof DeviceCapabilityAssessmentSchema>;

// ---------------------------------------------------------------------------
// Assessment entry point.
// ---------------------------------------------------------------------------

/**
 * Assess one W011 device descriptor (total, deterministic, pure). The
 * caller supplies the assessment id (deterministic addressing); invalid
 * descriptors yield typed `malformed-record` errors.
 */
export function assessDeviceDescriptor(
  input: {
    readonly assessmentId: unknown;
    readonly device: unknown;
  },
): DeviceCapabilitiesResult<DeviceCapabilityAssessment> {
  const idParsed = AssessmentIdSchema.safeParse(input.assessmentId);
  if (!idParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(idParsed.error),
        message: 'assessmentId failed schema validation',
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
  const device = deviceParsed.data;
  const content: DeviceCapabilityAssessmentContent = {
    schema: DEVICE_CAPABILITY_ASSESSMENT_SCHEMA_NAME,
    protocolVersion: DEVICE_CAPABILITIES_PROTOCOL_VERSION,
    assessmentId: idParsed.data,
    device,
    tier: adaptationTierOf(device),
    derivation: tierDerivationOf(device),
    display: { ...device.display },
    spatial: { ...device.spatial },
    interaction: [...device.interaction],
  };
  return {
    ok: true,
    value: {
      ...content,
      digest: canonicalDigest(content as unknown as JsonValue),
    },
  };
}
