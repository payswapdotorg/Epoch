/**
 * The simulator registration message (`messageKind:
 * "simulation.registration"`).
 *
 * One provider-neutral declaration of a simulator's contract: inputs,
 * outputs, fidelity, validity domain, assumptions, reproducibility, cost
 * and latency (architecture.md, "Simulation / Evaluation"). Simulators are
 * external capabilities behind this protocol (lock rule 5): solver
 * engines, numerical frameworks, and co-simulation standards are adapter
 * concerns (W021/W029) and can never be expressed inside a registration.
 */
import { z } from 'zod';
import {
  CostProfileSchema,
  LatencyProfileSchema,
  MessageIdSchema,
  ParameterSpecSchema,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import {
  FidelityProfileSchema,
  ReproducibilityProfileSchema,
  SimulatorIdSchema,
  ValidityDomainSchema,
} from './contract';
import {
  SIMULATION_MESSAGE_KIND_REGISTRATION,
  SIMULATION_PROTOCOL_VERSION,
  SimulationProtocolVersionSchema,
} from './version';

/**
 * The simulator registration message. Runtime refinements (not
 * representable in the structural JSON Schema projection): input names,
 * output names, and input/output name sets must each be free of duplicates
 * — an input and an output may never share a name, so a result's output
 * keys are unambiguously bound to the declared output specs.
 */
export const SimulatorRegistrationSchema = z
  .strictObject({
    protocolVersion: SimulationProtocolVersionSchema,
    messageKind: z.literal(SIMULATION_MESSAGE_KIND_REGISTRATION),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    simulatorId: SimulatorIdSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    inputs: z.array(ParameterSpecSchema).min(1),
    outputs: z.array(ParameterSpecSchema).min(1),
    fidelity: FidelityProfileSchema,
    validityDomain: ValidityDomainSchema,
    assumptions: z.array(z.string().min(1).max(2000)).min(1),
    reproducibility: ReproducibilityProfileSchema,
    costProfile: CostProfileSchema,
    latencyProfile: LatencyProfileSchema,
  })
  .refine(
    (registration) =>
      new Set(registration.inputs.map((spec) => spec.name)).size === registration.inputs.length,
    'input names must be unique within a registration',
  )
  .refine(
    (registration) =>
      new Set(registration.outputs.map((spec) => spec.name)).size === registration.outputs.length,
    'output names must be unique within a registration',
  )
  .refine(
    (registration) => {
      const inputNames = new Set(registration.inputs.map((spec) => spec.name));
      return registration.outputs.every((spec) => !inputNames.has(spec.name));
    },
    'input and output names must be disjoint within a registration',
  )
  .meta({
    id: 'SimulatorRegistration',
    title: 'SimulatorRegistration',
    description:
      'Simulator registration message: inputs, outputs, fidelity, validity domain, assumptions, reproducibility, cost and latency.',
  });

export type SimulatorRegistration = z.infer<typeof SimulatorRegistrationSchema>;

/**
 * Admit a simulator registration through the shared pipeline (version
 * gate, kind gate, schema validation, canonical evidence form).
 */
export function parseSimulatorRegistration(
  input: unknown,
): ParseOutcome<SimulatorRegistration> {
  return admitMessage({
    input,
    expectedVersion: SIMULATION_PROTOCOL_VERSION,
    expectedKind: SIMULATION_MESSAGE_KIND_REGISTRATION,
    schema: SimulatorRegistrationSchema,
  });
}

/** Throwing variant of {@link parseSimulatorRegistration}. */
export function validateSimulatorRegistration(input: unknown): SimulatorRegistration {
  return unwrapOrThrow(parseSimulatorRegistration(input));
}
