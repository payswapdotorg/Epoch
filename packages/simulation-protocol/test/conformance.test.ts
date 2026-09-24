// Cross-document conformance checks: the exact-revision evidence chain
// (registration digest -> request -> result), input/output contract
// enforcement, seed discipline, and determinism-claim consistency.
import { describe, expect, it } from 'vitest';
import {
  checkInvocationConformance,
  checkResultConformance,
  invocationRequestDigest,
  registrationDigest,
  valueConformsToSpec,
} from '../src/conformance';
import { parseSimulatorRegistration } from '../src/registration';
import { parseSimulationInvocationRequest } from '../src/invocation';
import { parseSimulationResult } from '../src/result';
import {
  validRegistration,
  validInvocationRequest,
  validResult,
  referenceInvocationRequest,
} from './fixtures';
import { runReferenceSimulation } from '../src/reference';

function admitted() {
  const registration = parseSimulatorRegistration(validRegistration());
  const request = parseSimulationInvocationRequest(
    validInvocationRequest({
      registrationDigest: registration.ok ? registration.digest : '0'.repeat(64),
    }),
  );
  const result = parseSimulationResult(
    validResult({
      registrationDigest: registration.ok ? registration.digest : '0'.repeat(64),
      requestDigest: request.ok ? request.digest : '0'.repeat(64),
    }),
  );
  if (!registration.ok || !request.ok || !result.ok) {
    throw new Error('fixture admission failed');
  }
  return { registration: registration.value, request: request.value, result: result.value };
}

describe('checkInvocationConformance', () => {
  it('accepts a conforming request with zero violations', () => {
    const { registration, request } = admitted();
    expect(checkInvocationConformance(registration, request)).toEqual([]);
  });

  it('rejects a request binding the wrong registration digest (exact-revision chain)', () => {
    const { registration } = admitted();
    const request = parseSimulationInvocationRequest(validInvocationRequest());
    if (!request.ok) throw new Error('fixture admission failed');
    const violations = checkInvocationConformance(registration, request.value);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.path).toBe('simulator.registrationDigest');
  });

  it('rejects a request targeting a different simulator id', () => {
    const { registration } = admitted();
    const request = parseSimulationInvocationRequest(
      validInvocationRequest({
        registration: validRegistration({ simulatorId: 'simulator:other-simulator' }),
        registrationDigest: registrationDigest(registration),
      }),
    );
    if (!request.ok) throw new Error('fixture admission failed');
    const violations = checkInvocationConformance(registration, request.value);
    expect(violations.some((v) => v.path === 'simulator.simulatorId')).toBe(true);
  });

  it('rejects undeclared inputs', () => {
    const { registration, request } = admitted();
    request.inputs['undeclared-input' as keyof typeof request.inputs] = 5;
    const violations = checkInvocationConformance(registration, request);
    expect(violations.some((v) => v.path === 'inputs.undeclared-input')).toBe(true);
  });

  it('rejects missing required inputs', () => {
    const { registration, request } = admitted();
    delete request.inputs['heat-input'];
    const violations = checkInvocationConformance(registration, request);
    expect(violations.some((v) => v.path === 'inputs.heat-input')).toBe(true);
  });

  it('rejects inputs whose values violate the declared kind', () => {
    const { registration, request } = admitted();
    request.inputs['heat-input' as keyof typeof request.inputs] = 'one-hundred-twenty';
    request.inputs['refinement-level' as keyof typeof request.inputs] = 1.5; // integer kind
    const violations = checkInvocationConformance(registration, request);
    expect(violations.some((v) => v.path === 'inputs.heat-input')).toBe(true);
    expect(violations.some((v) => v.path === 'inputs.refinement-level')).toBe(true);
  });

  it('rejects enum inputs outside the declared values', () => {
    const { registration, request } = admitted();
    request.inputs['convection-model' as keyof typeof request.inputs] = 'supercritical';
    const violations = checkInvocationConformance(registration, request);
    expect(violations.some((v) => v.path === 'inputs.convection-model')).toBe(true);
  });

  it('accepts optional inputs being absent', () => {
    const { registration, request } = admitted();
    expect('refinement-level' in request.inputs).toBe(false);
    expect(checkInvocationConformance(registration, request)).toEqual([]);
  });

  it('enforces seed discipline: external-seed requires a seed, other policies forbid one', () => {
    const seeded = validRegistration();
    seeded.reproducibility = { deterministic: true, seedPolicy: 'external-seed' };
    const admittedSeeded = parseSimulatorRegistration(seeded);
    if (!admittedSeeded.ok) throw new Error('fixture admission failed');

    const withoutSeed = parseSimulationInvocationRequest(
      validInvocationRequest({ registrationDigest: admittedSeeded.digest }),
    );
    if (!withoutSeed.ok) throw new Error('fixture admission failed');
    let violations = checkInvocationConformance(admittedSeeded.value, withoutSeed.value);
    expect(violations.some((v) => v.path === 'seed')).toBe(true);

    const withSeed = validInvocationRequest({ registrationDigest: admittedSeeded.digest });
    (withSeed as { seed?: number }).seed = 7;
    const admittedWithSeed = parseSimulationInvocationRequest(withSeed);
    if (!admittedWithSeed.ok) throw new Error('fixture admission failed');
    violations = checkInvocationConformance(admittedSeeded.value, admittedWithSeed.value);
    expect(violations).toEqual([]);

    // The not-applicable registration must reject a seeded request.
    const { registration } = admitted();
    const seededRequest = validInvocationRequest({
      registrationDigest: registrationDigest(registration),
    });
    (seededRequest as { seed?: number }).seed = 7;
    const admittedSeededRequest = parseSimulationInvocationRequest(seededRequest);
    if (!admittedSeededRequest.ok) throw new Error('fixture admission failed');
    violations = checkInvocationConformance(registration, admittedSeededRequest.value);
    expect(violations.some((v) => v.path === 'seed')).toBe(true);
  });
});

describe('checkResultConformance', () => {
  it('accepts a conforming completed result with zero violations', () => {
    const { registration, request, result } = admitted();
    expect(checkResultConformance(registration, request, result)).toEqual([]);
  });

  it('rejects a result binding the wrong request digest', () => {
    const { registration, request } = admitted();
    const result = parseSimulationResult(validResult());
    if (!result.ok) throw new Error('fixture admission failed');
    const violations = checkResultConformance(registration, request, result.value);
    expect(violations.some((v) => v.path === 'request.requestDigest')).toBe(true);
  });

  it('rejects a result claiming a different request id', () => {
    const { registration, request } = admitted();
    const result = parseSimulationResult(
      validResult({
        requestId: 'simreq-other',
        requestDigest: invocationRequestDigest(request),
        registrationDigest: registrationDigest(registration),
      }),
    );
    if (!result.ok) throw new Error('fixture admission failed');
    const violations = checkResultConformance(registration, request, result.value);
    expect(violations.some((v) => v.path === 'request.requestId')).toBe(true);
  });

  it('rejects a determinism claim contradicting the registration', () => {
    const { registration, request } = admitted();
    const result = parseSimulationResult(
      validResult({
        requestDigest: invocationRequestDigest(request),
        registrationDigest: registrationDigest(registration),
      }),
    );
    if (!result.ok) throw new Error('fixture admission failed');
    result.value.deterministic = false;
    const violations = checkResultConformance(registration, request, result.value);
    expect(violations.some((v) => v.path === 'deterministic')).toBe(true);
  });

  it('rejects undeclared outputs on a completed result', () => {
    const { registration, request } = admitted();
    const result = parseSimulationResult(
      validResult({
        requestDigest: invocationRequestDigest(request),
        registrationDigest: registrationDigest(registration),
      }),
    );
    if (!result.ok || result.value.outcome.status !== 'completed') throw new Error('bad fixture');
    result.value.outcome.outputs['smuggled-output' as keyof typeof result.value.outcome.outputs] = 1;
    const violations = checkResultConformance(registration, request, result.value);
    expect(violations.some((v) => v.path === 'outcome.outputs.smuggled-output')).toBe(true);
  });

  it('rejects completed results missing a required output', () => {
    const { registration, request } = admitted();
    const result = parseSimulationResult(
      validResult({
        requestDigest: invocationRequestDigest(request),
        registrationDigest: registrationDigest(registration),
      }),
    );
    if (!result.ok || result.value.outcome.status !== 'completed') throw new Error('bad fixture');
    delete result.value.outcome.outputs['peak-temperature'];
    const violations = checkResultConformance(registration, request, result.value);
    expect(violations.some((v) => v.path === 'outcome.outputs.peak-temperature')).toBe(true);
  });

  it('accepts a conforming failed result (no output checks apply)', () => {
    const { registration, request } = admitted();
    const document = validResult({
      requestDigest: invocationRequestDigest(request),
      registrationDigest: registrationDigest(registration),
    });
    document.outcome = {
      status: 'failed',
      failure: { code: 'input-out-of-domain', message: 'Outside validity domain.' },
    };
    const result = parseSimulationResult(document);
    if (!result.ok) throw new Error('fixture admission failed');
    expect(checkResultConformance(registration, request, result.value)).toEqual([]);
  });
});

describe('valueConformsToSpec', () => {
  it('classifies every parameter kind correctly', () => {
    const integer = { name: 'n', kind: 'integer' as const, required: true, description: '' };
    const number = { name: 'v', kind: 'number' as const, required: true, description: '' };
    const string = { name: 's', kind: 'string' as const, required: true, description: '' };
    const boolean = { name: 'b', kind: 'boolean' as const, required: true, description: '' };
    const enumeration = {
      name: 'e',
      kind: 'enum' as const,
      required: true,
      description: '',
      enumValues: ['a', 'b'],
    };
    const entity = { name: 'r', kind: 'entity-reference' as const, required: true, description: '' };
    const json = { name: 'j', kind: 'json' as const, required: true, description: '' };

    expect(valueConformsToSpec(3, integer)).toBe(true);
    expect(valueConformsToSpec(3.5, integer)).toBe(false);
    expect(valueConformsToSpec(3.5, number)).toBe(true);
    expect(valueConformsToSpec('x', number)).toBe(false);
    expect(valueConformsToSpec('x', string)).toBe(true);
    expect(valueConformsToSpec(1, string)).toBe(false);
    expect(valueConformsToSpec(true, boolean)).toBe(true);
    expect(valueConformsToSpec('a', enumeration)).toBe(true);
    expect(valueConformsToSpec('c', enumeration)).toBe(false);
    expect(valueConformsToSpec('entity:x', entity)).toBe(true);
    expect(valueConformsToSpec({ any: ['json'] }, json)).toBe(true);
  });
});

describe('reference simulator conformance failures', () => {
  it('reports nonconforming-request as a typed failure with violations', () => {
    const badRequest = referenceInvocationRequest({ inputs: { x: 2, slope: 3 } });
    const outcome = runReferenceSimulation(badRequest);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('nonconforming-request');
    if (outcome.failure.kind === 'nonconforming-request') {
      expect(outcome.failure.violations.some((v) => v.path === 'inputs.intercept')).toBe(true);
    }
  });

  it('reports invalid-request as a typed failure for schema-violating input', () => {
    const outcome = runReferenceSimulation({ nonsense: true });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('invalid-request');
  });
});
