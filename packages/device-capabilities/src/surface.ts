/**
 * The device-capabilities schema surface registry: every data type
 * published at the `packages/device-capabilities/schemas` boundary,
 * paired with its zod schema.
 *
 * Invariants enforced by tests (`test/contract-surface.test.ts` and
 * `test/contract-drift.test.ts`): every entry is exported from the
 * package index, and every entry has an emitted JSON Schema file listed
 * in `schemas/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { Sha256HexSchema, AssessmentIdSchema, PresentationRequirementIdSchema } from './primitives';
import {
  DeviceAdaptationTierSchema,
  DeviceCapabilitiesErrorCodeSchema,
  DeviceCapabilitiesProtocolVersionSchema,
  GuidedFidelityLevelSchema,
  CapabilityGapKindSchema,
} from './version';
import {
  DisplayAxisSchema,
  SpatialAxisSchema,
  ModalityCoverageSchema,
  TierDerivationSchema,
  DeviceCapabilityAssessmentContentSchema,
  DeviceCapabilityAssessmentSchema,
} from './assessment';
import {
  PresentationRequirementSchema,
  CapabilityGapSchema,
  PresentationFitSchema,
} from './fit';
import { DeviceClassProfileSchema } from './profile';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  /** The published type name (kebab-cased into its schema file). */
  readonly type: string;
  /** The zod schema of the type. */
  readonly schema: ZodType;
}

/** The complete published data-type surface of @epoch/device-capabilities. */
export const DEVICE_CAPABILITIES_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AssessmentId', schema: AssessmentIdSchema },
  { type: 'CapabilityGap', schema: CapabilityGapSchema },
  { type: 'CapabilityGapKind', schema: CapabilityGapKindSchema },
  { type: 'DeviceAdaptationTier', schema: DeviceAdaptationTierSchema },
  { type: 'DeviceCapabilitiesErrorCode', schema: DeviceCapabilitiesErrorCodeSchema },
  { type: 'DeviceCapabilitiesProtocolVersion', schema: DeviceCapabilitiesProtocolVersionSchema },
  { type: 'DeviceCapabilityAssessment', schema: DeviceCapabilityAssessmentSchema },
  { type: 'DeviceCapabilityAssessmentContent', schema: DeviceCapabilityAssessmentContentSchema },
  { type: 'DeviceClassProfile', schema: DeviceClassProfileSchema },
  { type: 'DisplayAxis', schema: DisplayAxisSchema },
  { type: 'GuidedFidelityLevel', schema: GuidedFidelityLevelSchema },
  { type: 'ModalityCoverage', schema: ModalityCoverageSchema },
  { type: 'PresentationFit', schema: PresentationFitSchema },
  { type: 'PresentationRequirement', schema: PresentationRequirementSchema },
  { type: 'PresentationRequirementId', schema: PresentationRequirementIdSchema },
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'SpatialAxis', schema: SpatialAxisSchema },
  { type: 'TierDerivation', schema: TierDerivationSchema },
];
