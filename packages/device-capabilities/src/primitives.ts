/**
 * Neutral primitives — device-capabilities-owned id grammar plus the
 * reused shared vocabularies (canonical homes: @epoch/agent-protocol,
 * @epoch/experience-protocol).
 */
import { z } from 'zod';
import {
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
  Sha256HexSchema,
} from '@epoch/experience-protocol';

/**
 * Assessment id grammar (`dca-<slug>`): opaque, kind-prefixed, stable
 * under canonical serialization (the W010/W013 id discipline).
 */
export const ASSESSMENT_ID_PATTERN = /^dca-[a-z0-9][a-z0-9-]{0,62}$/;

export const AssessmentIdSchema = z.string().regex(ASSESSMENT_ID_PATTERN).meta({
  id: 'AssessmentId',
  title: 'AssessmentId',
  description: 'Opaque device-capability assessment id (dca-<slug>).',
});

/** One assessment id. */
export type AssessmentId = z.infer<typeof AssessmentIdSchema>;

/** Presentation-requirement id grammar (`prr-<slug>`). */
export const PRESENTATION_REQUIREMENT_ID_PATTERN = /^prr-[a-z0-9][a-z0-9-]{0,62}$/;

export const PresentationRequirementIdSchema = z
  .string()
  .regex(PRESENTATION_REQUIREMENT_ID_PATTERN)
  .meta({
    id: 'PresentationRequirementId',
    title: 'PresentationRequirementId',
    description: 'Opaque presentation-requirement id (prr-<slug>).',
  });

/** One presentation-requirement id. */
export type PresentationRequirementId = z.infer<typeof PresentationRequirementIdSchema>;

// Reused shared primitives (re-exported so consumers need one import site).
export {
  Sha256HexSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  InteractionModalitySchema,
  PoseTrackingKindSchema,
};
export type {
  Sha256Hex,
  DeviceClass,
  DeviceDescriptor,
  DeviceDisplayCapabilities,
  DeviceSpatialCapabilities,
  InteractionModality,
  PoseTrackingKind,
} from '@epoch/experience-protocol';
