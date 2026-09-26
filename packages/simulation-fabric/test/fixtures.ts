// Shared fixtures for the simulation-fabric tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern). ZERO clock reads: instants are fixed
// constants (caller-supplied data). Registrations, invocation requests
// and results are built through the REAL W005 shapes — never hand-rolled
// digests. Capability binding references are opaque typed references
// (never structural copies of registry records).
import type { PortExecution, SimulationExecutionPort, AdmittedInvocation } from '../src/index';
import type { SimulationResult } from '@epoch/simulation-protocol';
import {
  REFERENCE_SIMULATOR_REGISTRATION,
  parseSimulationInvocationRequest,
  referenceRegistrationDigest,
  registrationDigest,
} from '@epoch/simulation-protocol';
import type { SimulatorRegistration } from '@epoch/simulation-protocol';

export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T09:00:01.000Z';
export const T2 = '2026-03-01T09:00:02.000Z';
export const T3 = '2026-03-01T09:00:03.000Z';
export const T4 = '2026-03-01T09:00:04.000Z';
export const T5 = '2026-03-01T09:00:05.000Z';

export const TENANT = 'tenant:acme';
export const OTHER_TENANT = 'tenant:bridge';
export const ACTOR = 'principal:simulation-lead';
export const OTHER_ACTOR = 'principal:field-engineer';

/** A capability binding reference with an arbitrary (opaque) digest pin. */
export function bindingFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    capabilityId: 'engineering.stress-analysis',
    version: '1.2.3',
    registrationDigest: 'c'.repeat(64),
    ...overrides,
  };
}

/** A second, distinct capability binding reference. */
export function secondBindingFixture(): Record<string, unknown> {
  return bindingFixture({
    capabilityId: 'engineering.meshing',
    version: '2.0.0',
    registrationDigest: 'd'.repeat(64),
  });
}

/**
 * The admitted capability set the fixtures' bindings resolve against
 * (the opaque seam shape; the service layer adapts the real W007 registry
 * to this in the runner tests).
 */
export function admittedCapabilities(): Record<string, unknown>[] {
  return [bindingFixture(), secondBindingFixture()];
}

/** The W005 reference simulator registration as a loose JSON object. */
export function referenceRegistrationFixture(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(REFERENCE_SIMULATOR_REGISTRATION)) as Record<string, unknown>;
}

/** The digest of the reference registration's canonical JSON. */
export function referenceDigest(): string {
  return referenceRegistrationDigest();
}

/**
 * A fully-declared NON-reference simulator registration (a thermal
 * steady-state simulator, the W005 fixture shape) as loose JSON. Tests
 * that need an executable simulator use the reference registration; this
 * fixture exercises admission/planning against a distinct contract.
 */
export function thermalRegistrationFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.registration',
    messageId: 'msg-thermal-registration-0001',
    createdAt: T0,
    simulatorId: 'simulator:thermal-steady-state',
    displayName: 'Thermal Steady-State Simulator',
    description: 'Predicts steady-state temperatures for planar assemblies.',
    inputs: [
      {
        name: 'heat-input',
        kind: 'number',
        required: true,
        description: 'Applied heat input.',
        unit: 'W',
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
    ],
    fidelity: {
      summary: 'First-order steady-state thermal network over lumped planar elements.',
      knownDeviations: ['Radiative exchange is ignored below 400 K.'],
    },
    validityDomain: {
      summary: 'Steady-state planar thermal assemblies without phase change.',
      includes: ['Planar assemblies in steady state.'],
      excludes: ['Transient regimes.'],
    },
    assumptions: ['Material properties are constant over the predicted range.'],
    reproducibility: { deterministic: true, seedPolicy: 'not-applicable' },
    costProfile: { basis: 'none' },
    latencyProfile: { p50Milliseconds: 100, p95Milliseconds: 900 },
    ...overrides,
  };
}

/** The canonical digest of the thermal registration fixture. */
export function thermalDigest(): string {
  return registrationDigest(thermalRegistrationFixture() as unknown as SimulatorRegistration);
}

/** An invocation request against the reference simulator, as loose JSON. */
export function referenceRequestFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.invocation-request',
    messageId: 'msg-reference-request-0001',
    createdAt: T1,
    requestId: 'simreq-reference-0001',
    simulator: {
      simulatorId: 'simulator:reference-affine-scalar',
      registrationDigest: referenceDigest(),
    },
    inputs: { x: 2, slope: 3, intercept: 1 },
    ...overrides,
  };
}

/** An invocation request against the thermal simulator, as loose JSON. */
export function thermalRequestFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.invocation-request',
    messageId: 'msg-thermal-request-0001',
    createdAt: T1,
    requestId: 'simreq-thermal-0001',
    simulator: {
      simulatorId: 'simulator:thermal-steady-state',
      registrationDigest: thermalDigest(),
    },
    inputs: { 'heat-input': 120 },
    ...overrides,
  };
}

/** A completed W005 result answering the thermal request, as loose JSON. */
export function thermalResultFixture(
  requestDigest: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'simulation.result',
    resultId: 'simresult-thermal-0001',
    request: {
      requestId: 'simreq-thermal-0001',
      requestDigest,
    },
    simulator: {
      simulatorId: 'simulator:thermal-steady-state',
      registrationDigest: thermalDigest(),
    },
    outcome: { status: 'completed', outputs: { 'peak-temperature': 355.25 } },
    deterministic: true,
    ...overrides,
  };
}

/** The standard submission options against the reference simulator. */
export function referenceSubmission(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT,
    registration: referenceRegistrationFixture(),
    request: referenceRequestFixture(),
    capabilityBindings: [bindingFixture()],
    actor: ACTOR,
    at: T1,
    ...overrides,
  };
}

/**
 * A recording stub port (the adapter seam exercised by tests): returns a
 * fixed behavior and records every admitted invocation, so tests prove
 * replay NEVER re-executes.
 */
export function stubPort(
  behavior: (invocation: AdmittedInvocation, call: number) => PortExecution,
): { port: SimulationExecutionPort; calls: AdmittedInvocation[] } {
  const calls: AdmittedInvocation[] = [];
  const port: SimulationExecutionPort = {
    execute(invocation: AdmittedInvocation): PortExecution {
      const call = calls.length + 1;
      calls.push(invocation);
      return behavior(invocation, call);
    },
  };
  return { port, calls };
}

/** A stub port that always succeeds with the given result document. */
export function succeedingPort(result: unknown): { port: SimulationExecutionPort; calls: AdmittedInvocation[] } {
  return stubPort(() => ({ ok: true, result }));
}

/** A stub port that always fails with the given W005 failure. */
export function failingPort(failure: {
  code: import('@epoch/simulation-protocol').SimulationFailure['code'];
  message: string;
}): {
  port: SimulationExecutionPort;
  calls: AdmittedInvocation[];
} {
  return stubPort(() => ({
    ok: false,
    failure: { code: failure.code, message: failure.message },
  }));
}

/** Admit a fixture request through the REAL W005 pipeline and return its digest. */
export function admittedRequestDigest(fixture: Record<string, unknown>): string {
  const parsed = parseSimulationInvocationRequest(fixture);
  if (!parsed.ok) {
    throw new Error(`fixture request must admit: ${JSON.stringify(parsed.error)}`);
  }
  return parsed.digest;
}

/** The W010 event CONTENT of a sealed fabric event (the envelope minus the digest). */
export function eventContentOf(
  sealed: Record<string, unknown>,
): Record<string, unknown> {
  const content: Record<string, unknown> = { ...sealed };
  delete content.contentDigest;
  return content;
}

/** Assert-helper: unwrap or fail loudly with the typed error. */
export function unwrap<T>(outcome: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!outcome.ok) {
    throw new Error(`fixture operation must succeed: ${JSON.stringify(outcome.error)}`);
  }
  return outcome.value;
}

/** Type-only re-export for test convenience. */
export type { SimulationResult };
