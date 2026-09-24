// Negative tests: every broken-envelope class the SDK must reject —
// category/payload confusion, tampered binding pins, precise paths, and
// version skew.
import { describe, expect, it } from 'vitest';
import type { AdapterSdkError, AdapterSdkResult } from '../src/index';
import { parseAdapterRequest, parseAdapterResponse } from '../src/index';
import { REQUEST_PAYLOADS, RESPONSE_PAYLOADS } from './helpers';

const PIN = {
  capabilityId: 'engineering.stress-analysis',
  capabilityVersion: '1.2.3',
  manifestDigest: 'a'.repeat(64),
  adapterId: 'adapter:stress-solver',
  adapterDescriptorDigest: 'b'.repeat(64),
};

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: AdapterSdkResult<T>): AdapterSdkError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

function validationIssues(error: AdapterSdkError): readonly { path: string; message: string }[] {
  expect(error.code).toBe('validation');
  if (error.code !== 'validation') throw new Error('expected a validation error');
  return error.issues;
}

describe('category/payload confusion (negative)', () => {
  it('rejects an evaluator payload in a simulation request envelope', () => {
    const error = failureOf(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'simulation',
        binding: PIN,
        payload: REQUEST_PAYLOADS.evaluator,
      }),
    );
    expect(validationIssues(error).length).toBeGreaterThan(0);
  });

  it('rejects a response payload in a request envelope', () => {
    expect(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'simulation',
        binding: PIN,
        payload: RESPONSE_PAYLOADS.simulation,
      }).ok,
    ).toBe(false);
  });

  it('rejects an unknown category discriminator', () => {
    const error = failureOf(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'orchestration',
        binding: PIN,
        payload: {},
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects a failed action payload under the simulation response discriminator', () => {
    expect(
      parseAdapterResponse({
        schemaVersion: 1,
        category: 'action',
        binding: PIN,
        payload: RESPONSE_PAYLOADS.simulation,
      }).ok,
    ).toBe(false);
  });
});

describe('tampered binding pins (negative)', () => {
  it('rejects a malformed manifest digest in the pin', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterRequest({
          schemaVersion: 1,
          category: 'simulation',
          binding: { ...PIN, manifestDigest: 'not-a-digest' },
          payload: REQUEST_PAYLOADS.simulation,
        }),
      ),
    );
    expect(issues.some((issue) => issue.path === 'binding.manifestDigest')).toBe(true);
  });

  it('rejects a malformed adapter descriptor digest in the pin', () => {
    expect(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'simulation',
        binding: { ...PIN, adapterDescriptorDigest: 42 },
        payload: REQUEST_PAYLOADS.simulation,
      }).ok,
    ).toBe(false);
  });

  it('rejects a malformed capability version in the pin', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterRequest({
          schemaVersion: 1,
          category: 'simulation',
          binding: { ...PIN, capabilityVersion: '1.2' },
          payload: REQUEST_PAYLOADS.simulation,
        }),
      ),
    );
    expect(issues.some((issue) => issue.path === 'binding.capabilityVersion')).toBe(true);
  });
});

describe('schema violations with precise paths (negative)', () => {
  it('rejects version discriminator skew with a path at schemaVersion', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterRequest({
          schemaVersion: 2,
          category: 'simulation',
          binding: PIN,
          payload: REQUEST_PAYLOADS.simulation,
        }),
      ),
    );
    expect(issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('rejects a bad parameter-name key in simulation inputs with a precise path', () => {
    const issues = validationIssues(
      failureOf(
        parseAdapterRequest({
          schemaVersion: 1,
          category: 'simulation',
          binding: PIN,
          payload: { inputs: { 'Bad-Key': 1 } },
        }),
      ),
    );
    expect(issues.some((issue) => issue.path.startsWith('payload.inputs'))).toBe(true);
  });

  it('rejects a completed simulation response without outputs', () => {
    expect(
      parseAdapterResponse({
        schemaVersion: 1,
        category: 'simulation',
        binding: PIN,
        payload: { status: 'completed', outputs: {} },
      }).ok,
    ).toBe(false);
  });

  it('rejects an evaluator response without justification (judgment must be referenced)', () => {
    expect(
      parseAdapterResponse({
        schemaVersion: 1,
        category: 'evaluator',
        binding: PIN,
        payload: { verdict: { verdictForm: 'pass-fail', outcome: 'pass' }, justification: [] },
      }).ok,
    ).toBe(false);
  });

  it('rejects a scored verdict outside its declared scale', () => {
    expect(
      parseAdapterResponse({
        schemaVersion: 1,
        category: 'evaluator',
        binding: PIN,
        payload: {
          verdict: { verdictForm: 'scored', score: 11, scale: { minimum: 0, maximum: 10 } },
          justification: [{ kind: 'criterion', reference: 'quality', statement: 's' }],
        },
      }).ok,
    ).toBe(false);
  });

  it('rejects vendor fields inside an envelope (strict objects)', () => {
    expect(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'simulation',
        binding: PIN,
        payload: { ...REQUEST_PAYLOADS.simulation, vendor: 'acme' },
      }).ok,
    ).toBe(false);
  });

  it('rejects a verification request with a fused stage vocabulary', () => {
    expect(
      parseAdapterRequest({
        schemaVersion: 1,
        category: 'verification',
        binding: PIN,
        payload: {
          method: { methodId: 'm', claimId: 'c', stage: 'judgment' },
          inputs: { x: 1 },
        },
      }).ok,
    ).toBe(false);
  });
});
