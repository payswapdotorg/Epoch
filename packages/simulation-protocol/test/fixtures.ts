// Shared fixtures: valid protocol documents used across the positive tests.
import type { SimulatorRegistration } from '../src/registration';
import type { SimulationInvocationRequest } from '../src/invocation';
import type { SimulationResult } from '../src/result';
import {
  REFERENCE_SIMULATOR_REGISTRATION,
  referenceRegistrationDigest,
} from '../src/reference';

export { REFERENCE_SIMULATOR_REGISTRATION, referenceRegistrationDigest };

/** A valid, fully declared simulator registration (structural domain). */
export function validRegistration(overrides?: {
  simulatorId?: string;
  messageId?: string;
}): SimulatorRegistration {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.registration',
    messageId: overrides?.messageId ?? 'msg-0001-registration',
    createdAt: '2025-02-10T08:00:00.000Z',
    simulatorId: overrides?.simulatorId ?? 'simulator:thermal-steady-state',
    displayName: 'Thermal Steady-State Simulator',
    description: 'Predicts steady-state temperatures for planar assemblies.',
    inputs: [
      {
        name: 'assembly',
        kind: 'entity-reference',
        required: true,
        description: 'World entity holding the assembly geometry.',
      },
      {
        name: 'heat-input',
        kind: 'number',
        required: true,
        description: 'Applied heat input.',
        unit: 'W',
      },
      {
        name: 'convection-model',
        kind: 'enum',
        required: true,
        description: 'Convection correlation to apply.',
        enumValues: ['natural', 'forced-low', 'forced-high'],
      },
      {
        name: 'refinement-level',
        kind: 'integer',
        required: false,
        description: 'Optional solver refinement multiplier.',
      },
    ],
    outputs: [
      {
        name: 'peak-temperature',
        kind: 'number',
        required: true,
        description: 'Predicted peak steady-state temperature.',
        unit: 'K',
      },
      {
        name: 'margin',
        kind: 'number',
        required: false,
        description: 'Optional margin to the design limit.',
        unit: 'K',
      },
    ],
    fidelity: {
      summary:
        'First-order steady-state thermal network over lumped planar elements; convection linearized around the operating point.',
      knownDeviations: [
        'Radiative exchange is ignored below 400 K.',
        'Contact resistance is approximated by a constant.',
      ],
    },
    validityDomain: {
      summary: 'Steady-state planar thermal assemblies without phase change.',
      includes: [
        'Planar assemblies in steady state with constant material properties.',
        'Operating temperatures between 200 K and 600 K.',
      ],
      excludes: ['Transient regimes.', 'Phase-change materials.', 'Vacuum environments.'],
    },
    assumptions: [
      'Material properties are constant over the predicted range.',
      'Heat flow is dominantly through-plane.',
    ],
    reproducibility: {
      deterministic: true,
      seedPolicy: 'not-applicable',
    },
    costProfile: { basis: 'per-proposal', currency: 'USD', amount: '0.80' },
    latencyProfile: { p50Milliseconds: 2_000, p95Milliseconds: 9_000 },
  };
}

/** A valid invocation request against `validRegistration()`. */
export function validInvocationRequest(overrides?: {
  registration?: SimulatorRegistration;
  registrationDigest?: string;
  requestId?: string;
  inputs?: SimulationInvocationRequest['inputs'];
}): SimulationInvocationRequest {
  const registration = overrides?.registration ?? validRegistration();
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.invocation-request',
    messageId: 'msg-0002-invocation',
    createdAt: '2025-02-10T08:05:00.000Z',
    requestId: overrides?.requestId ?? 'simreq-0001',
    simulator: {
      simulatorId: registration.simulatorId,
      registrationDigest:
        overrides?.registrationDigest ?? 'a'.repeat(64),
    },
    inputs: overrides?.inputs ?? {
      assembly: 'entity:assembly:planar-01',
      'heat-input': 120,
      'convection-model': 'natural',
    },
  };
}

/** A valid completed result answering `validInvocationRequest()`. */
export function validResult(overrides?: {
  registration?: SimulatorRegistration;
  registrationDigest?: string;
  requestId?: string;
  requestDigest?: string;
}): SimulationResult {
  const registration = overrides?.registration ?? validRegistration();
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.result',
    resultId: 'simresult-0123456789abcdef',
    request: {
      requestId: overrides?.requestId ?? 'simreq-0001',
      requestDigest: overrides?.requestDigest ?? 'b'.repeat(64),
    },
    simulator: {
      simulatorId: registration.simulatorId,
      registrationDigest:
        overrides?.registrationDigest ?? 'a'.repeat(64),
    },
    outcome: {
      status: 'completed',
      outputs: {
        'peak-temperature': 355.25,
        margin: 44.75,
      },
    },
    deterministic: true,
  };
}

/** A valid invocation request against the reference simulator. */
export function referenceInvocationRequest(
  overrides?: Partial<Pick<SimulationInvocationRequest, 'requestId' | 'inputs'>>,
): SimulationInvocationRequest {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.invocation-request',
    messageId: 'msg-reference-invocation',
    createdAt: '2025-02-10T08:10:00.000Z',
    requestId: overrides?.requestId ?? 'simreq-reference-0001',
    simulator: {
      simulatorId: REFERENCE_SIMULATOR_REGISTRATION.simulatorId,
      registrationDigest: referenceRegistrationDigest(),
    },
    inputs: overrides?.inputs ?? { x: 2, slope: 3, intercept: 1 },
  };
}
