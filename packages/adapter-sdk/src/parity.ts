/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W007 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  ActionRequestPayload,
  ActionResponsePayload,
  AdapterDescriptor,
  AdapterRequest,
  AdapterRequestEnvelope,
  AdapterResponse,
  AdapterResponseEnvelope,
  BindableCapability,
  BindingPin,
  CapabilityBinding,
  CapabilityLifecycleState,
  EvaluatorRequestPayload,
  EvaluatorResponsePayload,
  NeutralRequestPayload,
  NeutralResponsePayload,
  SimulationRequestPayload,
  SimulationResponsePayload,
  VerificationRequestPayload,
  VerificationResponsePayload,
} from './types';
import type {
  ActionRequestPayloadSchema,
  ActionResponsePayloadSchema,
  AdapterDescriptorSchema,
  AdapterRequestSchema,
  AdapterResponseSchema,
  BindableCapabilitySchema,
  BindingPinSchema,
  CapabilityBindingSchema,
  CapabilityLifecycleStateSchema,
  EvaluatorRequestPayloadSchema,
  EvaluatorResponsePayloadSchema,
  NeutralRequestPayloadSchema,
  NeutralResponsePayloadSchema,
  SimulationRequestPayloadSchema,
  SimulationResponsePayloadSchema,
  VerificationRequestPayloadSchema,
  VerificationResponsePayloadSchema,
} from './schema';

export type AdapterSdkSchemaSync = [
  Expect<Equals<z.infer<typeof CapabilityLifecycleStateSchema>, CapabilityLifecycleState>>,
  Expect<Equals<z.infer<typeof CapabilityBindingSchema>, CapabilityBinding>>,
  Expect<Equals<z.infer<typeof AdapterDescriptorSchema>, AdapterDescriptor>>,
  Expect<Equals<z.infer<typeof BindableCapabilitySchema>, BindableCapability>>,
  Expect<Equals<z.infer<typeof BindingPinSchema>, BindingPin>>,
  Expect<Equals<z.infer<typeof NeutralRequestPayloadSchema>, NeutralRequestPayload>>,
  Expect<Equals<z.infer<typeof NeutralResponsePayloadSchema>, NeutralResponsePayload>>,
  Expect<Equals<z.infer<typeof SimulationRequestPayloadSchema>, SimulationRequestPayload>>,
  Expect<Equals<z.infer<typeof SimulationResponsePayloadSchema>, SimulationResponsePayload>>,
  Expect<Equals<z.infer<typeof EvaluatorRequestPayloadSchema>, EvaluatorRequestPayload>>,
  Expect<Equals<z.infer<typeof EvaluatorResponsePayloadSchema>, EvaluatorResponsePayload>>,
  Expect<Equals<z.infer<typeof ActionRequestPayloadSchema>, ActionRequestPayload>>,
  Expect<Equals<z.infer<typeof ActionResponsePayloadSchema>, ActionResponsePayload>>,
  Expect<Equals<z.infer<typeof VerificationRequestPayloadSchema>, VerificationRequestPayload>>,
  Expect<Equals<z.infer<typeof VerificationResponsePayloadSchema>, VerificationResponsePayload>>,
  Expect<Equals<z.infer<typeof AdapterRequestSchema>, AdapterRequest>>,
  Expect<Equals<z.infer<typeof AdapterResponseSchema>, AdapterResponse>>,
];

/**
 * The generic envelope form distributes to the same union the schema
 * infers: every branch of `AdapterRequest`/`AdapterResponse` is exactly
 * the generic envelope instantiated at that category (the default
 * parameter `AdapterRequestEnvelope` alone would NOT distribute — the
 * distributed union is `AdapterRequest`).
 */
export type AdapterSdkEnvelopeSync = [
  Expect<Equals<AdapterRequestEnvelope<'source'>, Extract<AdapterRequest, { category: 'source' }>>>,
  Expect<
    Equals<AdapterRequestEnvelope<'simulation'>, Extract<AdapterRequest, { category: 'simulation' }>>
  >,
  Expect<
    Equals<AdapterRequestEnvelope<'evaluator'>, Extract<AdapterRequest, { category: 'evaluator' }>>
  >,
  Expect<
    Equals<
      AdapterRequestEnvelope<'verification'>,
      Extract<AdapterRequest, { category: 'verification' }>
    >
  >,
  Expect<
    Equals<AdapterResponseEnvelope<'source'>, Extract<AdapterResponse, { category: 'source' }>>
  >,
  Expect<
    Equals<
      AdapterResponseEnvelope<'simulation'>, Extract<AdapterResponse, { category: 'simulation' }>
    >
  >,
  Expect<
    Equals<
      AdapterResponseEnvelope<'evaluator'>, Extract<AdapterResponse, { category: 'evaluator' }>
    >
  >,
  Expect<
    Equals<
      AdapterResponseEnvelope<'verification'>,
      Extract<AdapterResponse, { category: 'verification' }>
    >
  >,
];

/** String-literal unions are additionally pinned member-for-member. */
export type AdapterSdkLiteralSync = [
  Expect<
    Equals<
      AdapterDescriptor['category'],
      'source' | 'semantic' | 'reconstruction' | 'visualization' | 'simulation' | 'evaluator' | 'action' | 'verification'
    >
  >,
  Expect<Equals<CapabilityLifecycleState, 'registered' | 'deprecated' | 'retired'>>,
];
