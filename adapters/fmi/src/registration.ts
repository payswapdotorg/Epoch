/**
 * @epoch/adapter-fmi — the W005 simulator-registration derivation: typed
 * participants become REGISTERED simulation capabilities.
 *
 * The participant's declared ports become the registration's inputs and
 * outputs (the shared ParameterSpec shape); the reproducibility profile
 * declares deterministic / not-applicable seeding; the registration is
 * a REAL `SimulatorRegistration` document admitted through the REAL
 * W005 pipeline (pinned by the registration + fabric parity tests) and
 * content-addressed by its canonical digest — the exact revision a
 * simulation fabric binds to.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  SIMULATION_PROTOCOL_VERSION,
  validateSimulatorRegistration,
  type SimulatorRegistration,
} from '@epoch/simulation-protocol';
import type { TypedParticipant } from './types';
import { portsOfDirection } from './participant';

/** The canonical instant of derived registrations (deterministic; no wall-clock in src). */
export const REGISTRATION_INSTANT = '2026-03-01T00:00:00.000Z' as const;

/** The derived simulator id of a typed participant (`simulator:<slug>-reference`). */
export function simulatorIdOf(participant: TypedParticipant): string {
  return `simulator:${participant.participantId.replace(/^participant:/, '')}-reference`;
}

/**
 * Derive the participant's W005 simulator registration (a REAL,
 * pipeline-admissible document): declared input ports as inputs,
 * declared output ports as outputs, deterministic reproducibility,
 * reference-grade fidelity/validity/cost/latency profiles.
 */
export function deriveSimulatorRegistration(participant: TypedParticipant): SimulatorRegistration {
  const inputPorts = portsOfDirection(participant, 'input');
  const outputPorts = portsOfDirection(participant, 'output');
  const registration = validateSimulatorRegistration({
    protocolVersion: SIMULATION_PROTOCOL_VERSION,
    messageKind: 'simulation.registration',
    messageId: `msg-${participant.contentDigest.slice(0, 16)}`,
    createdAt: REGISTRATION_INSTANT,
    simulatorId: simulatorIdOf(participant),
    displayName: `${participant.displayName} reference registration`,
    description:
      'Reference co-simulation participant registration: declared typed ports as inputs/outputs; deterministic step semantics (decay-coupled state advance over the input drive).',
    inputs: inputPorts.map((port) => ({
      name: port.name,
      kind: 'number' as const,
      required: true,
      description: `The declared input port ${port.name}${port.unit !== undefined ? ` (unit ${port.unit})` : ''}.`,
    })),
    outputs: outputPorts.map((port) => ({
      name: port.name,
      kind: 'number' as const,
      required: true,
      description: `The declared output port ${port.name}${port.unit !== undefined ? ` (unit ${port.unit})` : ''}.`,
    })),
    fidelity: {
      summary:
        'First-order deterministic coupling: each output decays toward the summed input drive with a parameter-scaled contraction; no approximation error beyond floating-point rounding.',
      knownDeviations: [
        'Floating-point summation order is fixed (ports iterate in name order) but rounding is platform-standard IEEE-754.',
      ],
    },
    validityDomain: {
      summary: 'Any finite numeric inputs and parameters; the contraction keeps outputs bounded.',
      includes: ['All finite input values over the declared ports.'],
      excludes: ['Non-finite inputs (rejected at the port-conformance gate).'],
    },
    assumptions: [
      'The participant state is one value per output port, initialized from the declared start values.',
      'Parameters are fixed at the declared start values for the lifetime of a step sequence.',
    ],
    reproducibility: {
      deterministic: true,
      seedPolicy: 'not-applicable',
    },
    costProfile: { basis: 'none' },
    latencyProfile: { p50Milliseconds: 1, p95Milliseconds: 5 },
  });
  return registration;
}

/** The canonical digest of a derived registration (the exact-revision pin a fabric binds to). */
export function registrationDigestOf(registration: SimulatorRegistration): Sha256Hex {
  return canonicalDigest(registration as unknown as JsonValue);
}

/** Input of {@link deriveParticipantRegistration} (the composite derivation). */
export interface DeriveRegistrationInput {
  readonly participant: TypedParticipant;
}

/** The composite derivation: the registration + its digest + the participant binding. */
export function deriveParticipantRegistration(
  input: DeriveRegistrationInput,
): { readonly registration: SimulatorRegistration; readonly registrationDigest: Sha256Hex; readonly participantId: string } {
  const registration = deriveSimulatorRegistration(input.participant);
  return {
    registration,
    registrationDigest: registrationDigestOf(registration),
    participantId: input.participant.participantId,
  };
}
