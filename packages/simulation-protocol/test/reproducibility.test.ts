// Reproducibility evidence for the reference simulator: identical
// requests produce identical result digests (bit-for-bit), the full
// registration -> request -> result chain is exact-revision addressable,
// and the failed-result path is protocol-valid.
import { describe, expect, it } from 'vitest';
import {
  deriveReferenceResultId,
  referenceRegistrationDigest,
  runReferenceSimulation,
} from '../src/reference';
import { referenceInvocationRequest } from './fixtures';
import { checkResultConformance } from '../src/conformance';
import { parseSimulationResult } from '../src/result';

describe('reference simulator reproducibility', () => {
  it('produces byte-identical results for identical requests', () => {
    const first = runReferenceSimulation(referenceInvocationRequest());
    const second = runReferenceSimulation(referenceInvocationRequest());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.resultDigest).toBe(second.run.resultDigest);
    expect(first.run.result).toEqual(second.run.result);
  });

  it('is a pure function of the request revision (key order included)', () => {
    const first = runReferenceSimulation(referenceInvocationRequest());
    const reordered = referenceInvocationRequest({
      inputs: { intercept: 1, slope: 3, x: 2 },
    });
    const second = runReferenceSimulation(reordered);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.requestDigest).toBe(second.run.requestDigest);
    expect(first.run.resultDigest).toBe(second.run.resultDigest);
  });

  it('different inputs produce different result digests', () => {
    const first = runReferenceSimulation(referenceInvocationRequest());
    const second = runReferenceSimulation(
      referenceInvocationRequest({ inputs: { x: 3, slope: 3, intercept: 1 } }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.requestDigest).not.toBe(second.run.requestDigest);
    expect(first.run.resultDigest).not.toBe(second.run.resultDigest);
  });

  it('computes the declared affine mapping exactly', () => {
    const outcome = runReferenceSimulation(
      referenceInvocationRequest({ inputs: { x: 2, slope: 3, intercept: 1 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    if (outcome.run.result.outcome.status !== 'completed') throw new Error('expected completion');
    expect(outcome.run.result.outcome.outputs.y).toBe(7);
  });

  it('derives the result id deterministically from the request digest', () => {
    const outcome = runReferenceSimulation(referenceInvocationRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.result.resultId).toBe(
      deriveReferenceResultId(outcome.run.requestDigest),
    );
    // Same request -> same derived id.
    const again = runReferenceSimulation(referenceInvocationRequest());
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.run.result.resultId).toBe(outcome.run.result.resultId);
  });
});

describe('reference simulator evidence chain', () => {
  it('binds the full chain: registration digest -> request -> result', () => {
    const outcome = runReferenceSimulation(referenceInvocationRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { registration, request, result, requestDigest } = outcome.run;

    expect(request.simulator.simulatorId).toBe(registration.simulatorId);
    expect(request.simulator.registrationDigest).toBe(referenceRegistrationDigest());
    expect(result.request.requestId).toBe(request.requestId);
    expect(result.request.requestDigest).toBe(requestDigest);
    expect(result.simulator.registrationDigest).toBe(referenceRegistrationDigest());
    expect(result.deterministic).toBe(registration.reproducibility.deterministic);
  });

  it('produces results that pass result conformance with zero violations', () => {
    const outcome = runReferenceSimulation(referenceInvocationRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      checkResultConformance(outcome.run.registration, outcome.run.request, outcome.run.result),
    ).toEqual([]);
  });

  it('produces a protocol-valid failed result on numerical divergence', () => {
    const outcome = runReferenceSimulation(
      referenceInvocationRequest({
        inputs: { x: 1e308, slope: 10, intercept: 0 },
      }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { result, resultDigest } = outcome.run;
    expect(result.outcome.status).toBe('failed');
    if (result.outcome.status !== 'failed') return;
    expect(result.outcome.failure.code).toBe('numerical-divergence');
    // The failed result is still admitted evidence with a digest.
    expect(resultDigest).toMatch(/^[0-9a-f]{64}$/);
    // And it re-admits cleanly.
    const reAdmitted = parseSimulationResult(JSON.parse(JSON.stringify(result)));
    expect(reAdmitted.ok).toBe(true);
  });
});
