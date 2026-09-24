/**
 * The adapter-sdk schema surface registry: every data type published at
 * the `@epoch/adapter-sdk` ownership boundary, paired with its zod
 * schema (W007 publishes its versioned contract surface inside the
 * package; see src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ActionRequestPayloadSchema,
  ActionResponsePayloadSchema,
  AdapterDescriptorSchema,
  AdapterDescriptorVersionSchema,
  AdapterEnvelopeVersionSchema,
  AdapterIdSchema,
  AdapterRequestSchema,
  AdapterResponseSchema,
  BindableCapabilitySchema,
  BindingPinSchema,
  CapabilityBindingSchema,
  CapabilityCategorySchema,
  CapabilityLifecycleStateSchema,
  EvaluatorRequestPayloadSchema,
  EvaluatorResponsePayloadSchema,
  NeutralRequestPayloadSchema,
  NeutralResponsePayloadSchema,
  SemverCoreSchema,
  SimulationRequestPayloadSchema,
  SimulationResponsePayloadSchema,
  VerificationRequestPayloadSchema,
  VerificationResponsePayloadSchema,
  VersionConstraintSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the adapter-sdk contract v1. */
export const ADAPTER_SDK_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionRequestPayload', schema: ActionRequestPayloadSchema },
  { type: 'ActionResponsePayload', schema: ActionResponsePayloadSchema },
  { type: 'AdapterDescriptor', schema: AdapterDescriptorSchema },
  { type: 'AdapterDescriptorVersion', schema: AdapterDescriptorVersionSchema },
  { type: 'AdapterEnvelopeVersion', schema: AdapterEnvelopeVersionSchema },
  { type: 'AdapterId', schema: AdapterIdSchema },
  { type: 'AdapterRequest', schema: AdapterRequestSchema },
  { type: 'AdapterResponse', schema: AdapterResponseSchema },
  { type: 'BindableCapability', schema: BindableCapabilitySchema },
  { type: 'BindingPin', schema: BindingPinSchema },
  { type: 'CapabilityBinding', schema: CapabilityBindingSchema },
  { type: 'CapabilityCategory', schema: CapabilityCategorySchema },
  { type: 'CapabilityLifecycleState', schema: CapabilityLifecycleStateSchema },
  { type: 'EvaluatorRequestPayload', schema: EvaluatorRequestPayloadSchema },
  { type: 'EvaluatorResponsePayload', schema: EvaluatorResponsePayloadSchema },
  { type: 'NeutralRequestPayload', schema: NeutralRequestPayloadSchema },
  { type: 'NeutralResponsePayload', schema: NeutralResponsePayloadSchema },
  { type: 'SemverCore', schema: SemverCoreSchema },
  { type: 'SimulationRequestPayload', schema: SimulationRequestPayloadSchema },
  { type: 'SimulationResponsePayload', schema: SimulationResponsePayloadSchema },
  { type: 'VerificationRequestPayload', schema: VerificationRequestPayloadSchema },
  { type: 'VerificationResponsePayload', schema: VerificationResponsePayloadSchema },
  { type: 'VersionConstraint', schema: VersionConstraintSchema },
];
