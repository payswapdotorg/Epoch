/**
 * Reference-grade deterministic simulator — REFERENCE ONLY, NOT A
 * PRODUCTION ENGINE.
 *
 * Purpose: prove the simulation protocol end-to-end inside this package's
 * tests (registration -> invocation request -> conformance -> result ->
 * digests) with a simulator that is trivially auditable. It computes an
 * exact first-order affine scalar mapping `y = slope * x + intercept` and
 * satisfies every contract it declares. Real simulation engines remain
 * external capabilities behind adapters (architecture lock rule 5); the
 * execution fabric is W021.
 *
 * Determinism evidence: `runReferenceSimulation` is a pure function of the
 * admitted request — the derived result id and the result digest depend
 * only on the request digest, so identical requests produce byte-identical
 * results (proven by tests).
 */
import type { JsonValue, ProtocolError } from '@epoch/agent-protocol';
import { canonicalDigest } from '@epoch/agent-protocol';
import { validateSimulatorRegistration, type SimulatorRegistration } from './registration';
import {
  parseSimulationInvocationRequest,
  type SimulationInvocationRequest,
} from './invocation';
import { parseSimulationResult, type SimulationResult } from './result';
import {
  checkInvocationConformance,
  registrationDigest,
  type ConformanceViolation,
} from './conformance';
import { SIMULATION_PROTOCOL_VERSION } from './version';

/** Registered id of the reference simulator. */
export const REFERENCE_SIMULATOR_ID = 'simulator:reference-affine-scalar';

/**
 * The reference simulator's own registration — a valid, fully declared
 * simulator contract (fidelity, validity domain, assumptions,
 * reproducibility, cost, latency).
 */
export const REFERENCE_SIMULATOR_REGISTRATION: SimulatorRegistration =
  validateSimulatorRegistration({
    protocolVersion: SIMULATION_PROTOCOL_VERSION,
    messageKind: 'simulation.registration',
    messageId: 'msg-reference-simulator-registration',
    createdAt: '2025-02-01T00:00:00.000Z',
    simulatorId: REFERENCE_SIMULATOR_ID,
    displayName: 'Reference Affine Scalar Simulator',
    description:
      'Reference-grade deterministic simulator: exact first-order affine scalar mapping y = slope * x + intercept. Proves the simulation protocol end-to-end; not a production engine.',
    inputs: [
      {
        name: 'x',
        kind: 'number',
        required: true,
        description: 'Independent scalar value.',
      },
      {
        name: 'slope',
        kind: 'number',
        required: true,
        description: 'Affine slope coefficient.',
      },
      {
        name: 'intercept',
        kind: 'number',
        required: true,
        description: 'Affine intercept term.',
      },
    ],
    outputs: [
      {
        name: 'y',
        kind: 'number',
        required: true,
        description: 'Dependent scalar value: slope * x + intercept.',
      },
    ],
    fidelity: {
      summary:
        'Exact evaluation of the affine scalar mapping under IEEE-754 double-precision arithmetic; no approximation is introduced beyond floating-point rounding.',
      knownDeviations: [],
    },
    validityDomain: {
      summary:
        'Applicable to scalar quantities governed by an affine (first-order polynomial) relation.',
      includes: [
        'Real-valued scalar inputs and outputs representable as finite IEEE-754 doubles.',
      ],
      excludes: [
        'Nonlinear governing relations.',
        'Vector, field, or temporally evolving quantities.',
        'Inputs whose affine combination overflows the finite double range.',
      ],
    },
    assumptions: [
      'The quantity of interest is exactly affine in the independent variable x.',
      'IEEE-754 double-precision arithmetic is available and deterministic across runs.',
    ],
    reproducibility: {
      deterministic: true,
      seedPolicy: 'not-applicable',
    },
    costProfile: { basis: 'none' },
    latencyProfile: { p50Milliseconds: 0, p95Milliseconds: 0 },
  });

/** The digest of the reference registration's canonical JSON. */
export function referenceRegistrationDigest(): string {
  return registrationDigest(REFERENCE_SIMULATOR_REGISTRATION);
}

/**
 * Deterministically derive the result id for a request digest: identical
 * requests always map to the identical result id.
 */
export function deriveReferenceResultId(requestDigest: string): string {
  return `simresult-${requestDigest.slice(0, 16)}`;
}

/** Typed failure of a reference-simulation run. */
export type ReferenceSimulationFailure =
  | { readonly kind: 'invalid-request'; readonly error: ProtocolError }
  | { readonly kind: 'nonconforming-request'; readonly violations: ConformanceViolation[] };

/** Successful reference run: the admitted chain with digests. */
export interface ReferenceSimulationRun {
  readonly registration: SimulatorRegistration;
  readonly request: SimulationInvocationRequest;
  readonly requestDigest: string;
  readonly result: SimulationResult;
  readonly resultDigest: string;
}

export type ReferenceSimulationOutcome =
  | { readonly ok: true; readonly run: ReferenceSimulationRun }
  | { readonly ok: false; readonly failure: ReferenceSimulationFailure };

/**
 * Run the reference simulator for one invocation request (unknown input):
 * admit the request, check conformance against the reference
 * registration, evaluate the affine mapping, and admit the result.
 *
 * Overflowing affine combinations (non-finite y) yield a protocol-valid
 * FAILED result with code `numerical-divergence` rather than a
 * non-canonicalizable value.
 */
export function runReferenceSimulation(input: unknown): ReferenceSimulationOutcome {
  const parsed = parseSimulationInvocationRequest(input);
  if (!parsed.ok) {
    return { ok: false, failure: { kind: 'invalid-request', error: parsed.error } };
  }
  const request = parsed.value;
  const requestDigest = parsed.digest;

  const violations = checkInvocationConformance(REFERENCE_SIMULATOR_REGISTRATION, request);
  if (violations.length > 0) {
    return { ok: false, failure: { kind: 'nonconforming-request', violations } };
  }

  const x = request.inputs.x as number;
  const slope = request.inputs.slope as number;
  const intercept = request.inputs.intercept as number;
  const y = slope * x + intercept;

  const simulator = {
    simulatorId: REFERENCE_SIMULATOR_ID,
    registrationDigest: referenceRegistrationDigest(),
  };
  const requestBinding = { requestId: request.requestId, requestDigest };
  const resultId = deriveReferenceResultId(requestDigest);

  let resultDocument: SimulationResult;
  if (Number.isFinite(y)) {
    resultDocument = {
      protocolVersion: SIMULATION_PROTOCOL_VERSION,
      messageKind: 'simulation.result',
      resultId,
      request: requestBinding,
      simulator,
      outcome: { status: 'completed', outputs: { y } },
      deterministic: true,
    };
  } else {
    resultDocument = {
      protocolVersion: SIMULATION_PROTOCOL_VERSION,
      messageKind: 'simulation.result',
      resultId,
      request: requestBinding,
      simulator,
      outcome: {
        status: 'failed',
        failure: {
          code: 'numerical-divergence',
          message: 'The affine combination slope * x + intercept is not a finite double.',
        },
      },
      deterministic: true,
    };
  }

  const admitted = parseSimulationResult(resultDocument);
  if (!admitted.ok) {
    // The reference simulator builds only schema-valid results; reaching
    // this branch is a programming error in the reference itself.
    return { ok: false, failure: { kind: 'invalid-request', error: admitted.error } };
  }

  return {
    ok: true,
    run: {
      registration: REFERENCE_SIMULATOR_REGISTRATION,
      request,
      requestDigest,
      result: admitted.value,
      resultDigest: admitted.digest,
    },
  };
}

/**
 * Canonical digest of an arbitrary admitted JSON document — re-exported
 * convenience for consumers building subject references from runs.
 */
export function documentDigest(value: JsonValue): string {
  return canonicalDigest(value);
}
