/**
 * Cross-document conformance checks for the simulation protocol.
 *
 * Schema admission validates one message in isolation; these helpers
 * verify the *bindings between* documents — the exact-revision evidence
 * chain a registrar or executor must enforce before trusting a run:
 *
 * - the invocation request really targets the registered simulator at the
 *   exact registration revision (digest match);
 * - the request inputs really satisfy the registered input contract
 *   (declared names, required presence, value kinds);
 * - the seed discipline declared by the registration is honored
 *   (`external-seed` requires a seed; other policies forbid one);
 * - the result really binds to the request and registration revisions and
 *   mirrors the registration's determinism claim;
 * - completed results only carry DECLARED outputs, with every required
 *   output present.
 *
 * All checks are pure and return typed violations; none of them execute
 * anything (this protocol never becomes an execution fabric — W021).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { ParameterSpec } from '@epoch/agent-protocol';
import type { SimulatorRegistration } from './registration';
import type { SimulationInvocationRequest } from './invocation';
import type { SimulationResult } from './result';

/** One typed conformance violation (dotted path + message). */
export interface ConformanceViolation {
  readonly path: string;
  readonly message: string;
}

/** Does a JSON value satisfy a declared parameter spec's kind? */
export function valueConformsToSpec(value: JsonValue, spec: ParameterSpec): boolean {
  switch (spec.kind) {
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && (spec.enumValues ?? []).includes(value);
    case 'entity-reference':
      return typeof value === 'string';
    case 'json':
      return true;
  }
}

function specByName(specs: readonly ParameterSpec[], name: string): ParameterSpec | undefined {
  return specs.find((spec) => spec.name === name);
}

/**
 * Canonical digest of an admitted registration (recomputed from the
 * canonical JSON form — the same digest the admission pipeline produced).
 */
export function registrationDigest(registration: SimulatorRegistration): string {
  return canonicalDigest(registration as unknown as JsonValue);
}

/**
 * Canonical digest of an admitted invocation request.
 */
export function invocationRequestDigest(request: SimulationInvocationRequest): string {
  return canonicalDigest(request as unknown as JsonValue);
}

/**
 * Check an admitted invocation request against the registration it
 * targets. Returns the list of violations (empty = conforming).
 */
export function checkInvocationConformance(
  registration: SimulatorRegistration,
  request: SimulationInvocationRequest,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (request.simulator.simulatorId !== registration.simulatorId) {
    violations.push({
      path: 'simulator.simulatorId',
      message: `request targets simulator "${request.simulator.simulatorId}" but the registration declares "${registration.simulatorId}"`,
    });
  }

  const expectedDigest = registrationDigest(registration);
  if (request.simulator.registrationDigest !== expectedDigest) {
    violations.push({
      path: 'simulator.registrationDigest',
      message: `request binds registration digest ${request.simulator.registrationDigest} but the registration's canonical digest is ${expectedDigest}`,
    });
  }

  for (const [name, value] of Object.entries(request.inputs)) {
    const spec = specByName(registration.inputs, name);
    if (spec === undefined) {
      violations.push({
        path: `inputs.${name}`,
        message: `input "${name}" is not declared by the registration`,
      });
      continue;
    }
    if (!valueConformsToSpec(value, spec)) {
      violations.push({
        path: `inputs.${name}`,
        message: `input "${name}" does not conform to declared kind "${spec.kind}"`,
      });
    }
  }

  for (const spec of registration.inputs) {
    if (spec.required && !(spec.name in request.inputs)) {
      violations.push({
        path: `inputs.${spec.name}`,
        message: `required input "${spec.name}" is missing from the request`,
      });
    }
  }

  const seedRequired = registration.reproducibility.seedPolicy === 'external-seed';
  if (seedRequired && request.seed === undefined) {
    violations.push({
      path: 'seed',
      message: 'registration declares seedPolicy "external-seed" but the request carries no seed',
    });
  }
  if (!seedRequired && request.seed !== undefined) {
    violations.push({
      path: 'seed',
      message: `registration declares seedPolicy "${registration.reproducibility.seedPolicy}" but the request carries a seed`,
    });
  }

  return violations;
}

/**
 * Check an admitted simulation result against the registration and the
 * invocation request it claims to answer. Returns the list of violations
 * (empty = conforming).
 */
export function checkResultConformance(
  registration: SimulatorRegistration,
  request: SimulationInvocationRequest,
  result: SimulationResult,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (result.request.requestId !== request.requestId) {
    violations.push({
      path: 'request.requestId',
      message: `result claims request "${result.request.requestId}" but was checked against request "${request.requestId}"`,
    });
  }

  const expectedRequestDigest = invocationRequestDigest(request);
  if (result.request.requestDigest !== expectedRequestDigest) {
    violations.push({
      path: 'request.requestDigest',
      message: `result binds request digest ${result.request.requestDigest} but the request's canonical digest is ${expectedRequestDigest}`,
    });
  }

  if (result.simulator.simulatorId !== registration.simulatorId) {
    violations.push({
      path: 'simulator.simulatorId',
      message: `result claims simulator "${result.simulator.simulatorId}" but the registration declares "${registration.simulatorId}"`,
    });
  }

  const expectedRegistrationDigest = registrationDigest(registration);
  if (result.simulator.registrationDigest !== expectedRegistrationDigest) {
    violations.push({
      path: 'simulator.registrationDigest',
      message: `result binds registration digest ${result.simulator.registrationDigest} but the registration's canonical digest is ${expectedRegistrationDigest}`,
    });
  }

  if (result.deterministic !== registration.reproducibility.deterministic) {
    violations.push({
      path: 'deterministic',
      message: `result claims deterministic=${result.deterministic} but the registration declares deterministic=${registration.reproducibility.deterministic}`,
    });
  }

  if (result.outcome.status === 'completed') {
    for (const name of Object.keys(result.outcome.outputs)) {
      const spec = specByName(registration.outputs, name);
      if (spec === undefined) {
        violations.push({
          path: `outcome.outputs.${name}`,
          message: `output "${name}" is not declared by the registration`,
        });
        continue;
      }
      if (!valueConformsToSpec(result.outcome.outputs[name]!, spec)) {
        violations.push({
          path: `outcome.outputs.${name}`,
          message: `output "${name}" does not conform to declared kind "${spec.kind}"`,
        });
      }
    }
    for (const spec of registration.outputs) {
      if (spec.required && !(spec.name in result.outcome.outputs)) {
        violations.push({
          path: `outcome.outputs.${spec.name}`,
          message: `required output "${spec.name}" is missing from the completed result`,
        });
      }
    }
  }

  return violations;
}
