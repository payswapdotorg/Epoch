/**
 * The simulation result message (`messageKind: "simulation.result"`).
 *
 * The prediction artifact an external simulator produces for one admitted
 * invocation request. Two evidence-grade invariants are encoded
 * structurally:
 *
 * 1. **Exact-revision addressability.** The result binds to the request
 *    (id + request digest) and to the simulator contract revision (id +
 *    registration digest); the admission pipeline computes the result's
 *    own canonical digest, so every run is addressable evidence.
 *
 * 2. **Digest stability for deterministic runs.** A result carries NO
 *    wall-clock or measurement fields (no `createdAt`, no durations): a
 *    deterministic simulator's result digest must be a pure function of
 *    the request digest, so anything time-varying is structurally
 *    inexpressible here. Measured cost/latency belong to the declared
 *    profiles and to the execution fabric (W021), not the prediction.
 *    The `deterministic` flag mirrors the registration and is checked by
 *    the conformance helpers.
 *
 * The outcome is an exhaustive discriminated union: `completed` (with at
 * least one named output) or `failed` (with a machine-readable code and a
 * required reason). Unknown fields are rejected (strict objects), so no
 * solver-specific field can be smuggled into a result.
 */
import { z } from 'zod';
import { JsonValueSchema, MessageIdSchema, PARAMETER_NAME_PATTERN } from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { SimulatorReferenceSchema } from './invocation';
import {
  SIMULATION_MESSAGE_KIND_RESULT,
  SIMULATION_PROTOCOL_VERSION,
  SimulationProtocolVersionSchema,
} from './version';

/**
 * Exact-revision reference to an invocation request: the request id plus
 * the SHA-256 digest of the request's canonical JSON.
 */
export const InvocationReferenceSchema = z
  .strictObject({
    requestId: MessageIdSchema,
    requestDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .meta({
    id: 'InvocationReference',
    title: 'InvocationReference',
    description:
      'Exact-revision invocation reference: request id plus the SHA-256 digest of the request canonical JSON.',
  });

export type InvocationReference = z.infer<typeof InvocationReferenceSchema>;

/** Machine-readable simulation failure codes (protocol-level, neutral). */
export const SIMULATION_FAILURE_CODES = [
  'input-out-of-domain',
  'numerical-divergence',
  'resource-limit-exceeded',
  'internal-error',
] as const;

export type SimulationFailureCode = (typeof SIMULATION_FAILURE_CODES)[number];

export const SimulationFailureCodeSchema = z.enum(SIMULATION_FAILURE_CODES).meta({
  id: 'SimulationFailureCode',
  title: 'SimulationFailureCode',
  description: 'Machine-readable failure code carried by failed simulation results.',
});

/** A simulation failure with a machine-readable code and required reason. */
export const SimulationFailureSchema = z
  .strictObject({
    code: SimulationFailureCodeSchema,
    message: z.string().min(1).max(4000),
  })
  .meta({
    id: 'SimulationFailure',
    title: 'SimulationFailure',
    description: 'A simulation failure: machine-readable code plus a human-auditable reason.',
  });

export type SimulationFailure = z.infer<typeof SimulationFailureSchema>;

/** Outcome status of a simulation run. */
export const SIMULATION_RESULT_STATUSES = ['completed', 'failed'] as const;

export type SimulationResultStatus = (typeof SIMULATION_RESULT_STATUSES)[number];

export const SimulationResultStatusSchema = z.enum(SIMULATION_RESULT_STATUSES).meta({
  id: 'SimulationResultStatus',
  title: 'SimulationResultStatus',
  description: 'Outcome status of a simulation run: completed or failed.',
});

/** A completed run: at least one named output value. */
export const CompletedSimulationResultSchema = z
  .strictObject({
    status: z.literal('completed'),
    outputs: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema),
  })
  .refine(
    (outcome) => Object.keys(outcome.outputs).length >= 1,
    'a completed simulation result must carry at least one named output',
  )
  .meta({
    id: 'CompletedSimulationResult',
    title: 'CompletedSimulationResult',
    description: 'Completed simulation outcome: at least one named output value.',
  });

export type CompletedSimulationResult = z.infer<typeof CompletedSimulationResultSchema>;

/** A failed run: machine-readable failure, no outputs. */
export const FailedSimulationResultSchema = z
  .strictObject({
    status: z.literal('failed'),
    failure: SimulationFailureSchema,
  })
  .meta({
    id: 'FailedSimulationResult',
    title: 'FailedSimulationResult',
    description: 'Failed simulation outcome: machine-readable failure code and reason.',
  });

export type FailedSimulationResult = z.infer<typeof FailedSimulationResultSchema>;

/** The exhaustive run outcome union. */
export const SimulationOutcomeSchema = z
  .discriminatedUnion('status', [
    CompletedSimulationResultSchema,
    FailedSimulationResultSchema,
  ])
  .meta({
    id: 'SimulationOutcome',
    title: 'SimulationOutcome',
    description: 'Exhaustive simulation outcome union: completed (with outputs) or failed (with a failure).',
  });

export type SimulationOutcome = z.infer<typeof SimulationOutcomeSchema>;

/**
 * The simulation result message. `resultId` is an opaque identifier (a
 * deterministic simulator derives it from the request digest so identical
 * requests yield identical results); `deterministic` mirrors the
 * registration's reproducibility claim and is conformance-checked.
 */
export const SimulationResultSchema = z
  .strictObject({
    protocolVersion: SimulationProtocolVersionSchema,
    messageKind: z.literal(SIMULATION_MESSAGE_KIND_RESULT),
    resultId: MessageIdSchema,
    request: InvocationReferenceSchema,
    simulator: SimulatorReferenceSchema,
    outcome: SimulationOutcomeSchema,
    deterministic: z.boolean(),
  })
  .meta({
    id: 'SimulationResult',
    title: 'SimulationResult',
    description:
      'Simulation result message: exact-revision request and simulator bindings, completed/failed outcome, and the determinism claim.',
  });

export type SimulationResult = z.infer<typeof SimulationResultSchema>;

/**
 * Admit a simulation result through the shared pipeline.
 */
export function parseSimulationResult(input: unknown): ParseOutcome<SimulationResult> {
  return admitMessage({
    input,
    expectedVersion: SIMULATION_PROTOCOL_VERSION,
    expectedKind: SIMULATION_MESSAGE_KIND_RESULT,
    schema: SimulationResultSchema,
  });
}

/** Throwing variant of {@link parseSimulationResult}. */
export function validateSimulationResult(input: unknown): SimulationResult {
  return unwrapOrThrow(parseSimulationResult(input));
}
