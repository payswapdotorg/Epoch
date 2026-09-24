/**
 * The simulation invocation request message (`messageKind:
 * "simulation.invocation-request"`).
 *
 * A request to run a registered simulator at an EXACT revision of its
 * registration: the {@link SimulatorReference} binds the simulator id to
 * the SHA-256 digest of the registration's canonical JSON, so a run is
 * always attributable to the precise contract revision it was made
 * against. Inputs are a named JSON record; a seed may be attached when the
 * registered contract declares `external-seed` (checked by the
 * cross-document conformance helpers in `conformance.ts`).
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  MessageIdSchema,
  PARAMETER_NAME_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { SimulatorIdSchema } from './contract';
import {
  SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST,
  SIMULATION_PROTOCOL_VERSION,
  SimulationProtocolVersionSchema,
} from './version';

/** Canonical digest shape: lowercase hex SHA-256 (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Exact-revision reference to a registered simulator: the simulator id
 * plus the SHA-256 digest of the registration's canonical JSON.
 */
export const SimulatorReferenceSchema = z
  .strictObject({
    simulatorId: SimulatorIdSchema,
    registrationDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .meta({
    id: 'SimulatorReference',
    title: 'SimulatorReference',
    description:
      'Exact-revision simulator reference: id plus the SHA-256 digest of the registration canonical JSON.',
  });

export type SimulatorReference = z.infer<typeof SimulatorReferenceSchema>;

/** Upper bound for request seeds: the exact integer range of IEEE-754 doubles. */
export const MAX_SAFE_SEED = Number.MAX_SAFE_INTEGER;

/**
 * The simulation invocation request message.
 */
export const SimulationInvocationRequestSchema = z
  .strictObject({
    protocolVersion: SimulationProtocolVersionSchema,
    messageKind: z.literal(SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    requestId: MessageIdSchema,
    simulator: SimulatorReferenceSchema,
    inputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema),
    seed: z.number().int().min(0).max(MAX_SAFE_SEED).optional(),
    notes: z.string().max(4000).optional(),
  })
  .refine(
    (request) => Object.keys(request.inputs).length >= 1,
    'an invocation request must carry at least one named input',
  )
  .meta({
    id: 'SimulationInvocationRequest',
    title: 'SimulationInvocationRequest',
    description:
      'Request to run a registered simulator at an exact registration revision: named inputs, optional seed, optional notes.',
  });

export type SimulationInvocationRequest = z.infer<typeof SimulationInvocationRequestSchema>;

/**
 * Admit an invocation request through the shared pipeline.
 */
export function parseSimulationInvocationRequest(
  input: unknown,
): ParseOutcome<SimulationInvocationRequest> {
  return admitMessage({
    input,
    expectedVersion: SIMULATION_PROTOCOL_VERSION,
    expectedKind: SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST,
    schema: SimulationInvocationRequestSchema,
  });
}

/** Throwing variant of {@link parseSimulationInvocationRequest}. */
export function validateSimulationInvocationRequest(
  input: unknown,
): SimulationInvocationRequest {
  return unwrapOrThrow(parseSimulationInvocationRequest(input));
}
