// End-to-end composition proof (devDependency on
// @epoch/simulation-protocol): the full chain a prediction-then-judgment
// flow takes through the two protocols —
//
//   simulator registration -> invocation request -> simulation result
//   -> evaluation request (subject = the result, by digest) -> verdict,
//
// with exact-revision digests flowing across the package boundary and
// simulation/evaluation remaining distinct protocols (lock rule 6: the
// evaluation package imports the simulation package ONLY in this test).
import { describe, expect, it } from 'vitest';
import {
  REFERENCE_SIMULATOR_REGISTRATION,
  referenceRegistrationDigest,
  runReferenceSimulation,
} from '@epoch/simulation-protocol';
import type { SimulationResult } from '@epoch/simulation-protocol';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  REFERENCE_EVALUATOR_REGISTRATION,
  checkVerdictConformance,
  runReferenceEvaluation,
} from '../src/index';

describe('simulation -> evaluation end-to-end', () => {
  it('predicts with the reference simulator, then judges the exact result revision', () => {
    // 1. Simulate: y = 3 * 2 + 1 = 7 (deterministic, pure).
    const run = runReferenceSimulation({
      protocolVersion: '1.0.0',
      messageKind: 'simulation.invocation-request',
      messageId: 'msg-e2e-invocation',
      createdAt: '2025-02-12T10:00:00.000Z',
      requestId: 'simreq-e2e-0001',
      simulator: {
        simulatorId: REFERENCE_SIMULATOR_REGISTRATION.simulatorId,
        registrationDigest: referenceRegistrationDigest(),
      },
      inputs: { x: 2, slope: 3, intercept: 1 },
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.run.result.outcome.status).toBe('completed');

    // 2. Address the result as an evaluation subject (kind, id, digest).
    const subject = {
      kind: 'simulation-result' as const,
      subjectId: run.run.result.resultId,
      subjectDigest: run.run.resultDigest,
    };

    // 3. Judge it: y <= 10 must PASS; y >= 10 must FAIL.
    const subjects = new Map([
      [run.run.resultDigest, { subjectId: run.run.result.resultId, outputs: subjectOutputs(run.run.result) }],
    ]);
    const passing = runReferenceEvaluation(
      {
        protocolVersion: '1.0.0',
        messageKind: 'evaluation.request',
        messageId: 'msg-e2e-evaluation-pass',
        createdAt: '2025-02-12T10:05:00.000Z',
        requestId: 'evalreq-e2e-0001',
        evaluator: {
          evaluatorId: REFERENCE_EVALUATOR_REGISTRATION.evaluatorId,
          registrationDigest: canonicalDigest(REFERENCE_EVALUATOR_REGISTRATION),
        },
        subject,
        criteria: { metric: 'y', operator: '<=', threshold: 10 },
      },
      subjects,
    );
    expect(passing.ok).toBe(true);
    if (!passing.ok) return;
    expect(passing.run.verdict.outcome).toEqual({ verdictForm: 'pass-fail', outcome: 'pass' });

    const failing = runReferenceEvaluation(
      {
        protocolVersion: '1.0.0',
        messageKind: 'evaluation.request',
        messageId: 'msg-e2e-evaluation-fail',
        createdAt: '2025-02-12T10:06:00.000Z',
        requestId: 'evalreq-e2e-0002',
        evaluator: {
          evaluatorId: REFERENCE_EVALUATOR_REGISTRATION.evaluatorId,
          registrationDigest: canonicalDigest(REFERENCE_EVALUATOR_REGISTRATION),
        },
        subject,
        criteria: { metric: 'y', operator: '>=', threshold: 10 },
      },
      subjects,
    );
    expect(failing.ok).toBe(true);
    if (!failing.ok) return;
    expect(failing.run.verdict.outcome).toEqual({ verdictForm: 'pass-fail', outcome: 'fail' });

    // 4. The verdicts conform to their registration and requests.
    expect(
      checkVerdictConformance(passing.run.registration, passing.run.request, passing.run.verdict),
    ).toEqual([]);
    expect(
      checkVerdictConformance(failing.run.registration, failing.run.request, failing.run.verdict),
    ).toEqual([]);

    // 5. The evidence chain is intact across both protocols.
    expect(passing.run.verdict.subject).toEqual(subject);
    expect(passing.run.verdict.request.requestDigest).toBe(passing.run.requestDigest);
    expect(passing.run.verdict.evaluator.evaluatorId).toBe(
      REFERENCE_EVALUATOR_REGISTRATION.evaluatorId,
    );
  });

  it('rejects judgment of a simulation result whose digest is not registered', () => {
    const run = runReferenceSimulation({
      protocolVersion: '1.0.0',
      messageKind: 'simulation.invocation-request',
      messageId: 'msg-e2e-invocation-unknown',
      createdAt: '2025-02-12T10:10:00.000Z',
      requestId: 'simreq-e2e-0002',
      simulator: {
        simulatorId: REFERENCE_SIMULATOR_REGISTRATION.simulatorId,
        registrationDigest: referenceRegistrationDigest(),
      },
      inputs: { x: 1, slope: 1, intercept: 1 },
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    // The evaluation request points at the result, but no subject payload
    // is registered for its digest.
    const outcome = runReferenceEvaluation(
      {
        protocolVersion: '1.0.0',
        messageKind: 'evaluation.request',
        messageId: 'msg-e2e-evaluation-unknown',
        createdAt: '2025-02-12T10:15:00.000Z',
        requestId: 'evalreq-e2e-0003',
        evaluator: {
          evaluatorId: REFERENCE_EVALUATOR_REGISTRATION.evaluatorId,
          registrationDigest: canonicalDigest(REFERENCE_EVALUATOR_REGISTRATION),
        },
        subject: {
          kind: 'simulation-result',
          subjectId: run.run.result.resultId,
          subjectDigest: run.run.resultDigest,
        },
        criteria: { metric: 'y', operator: '<=', threshold: 10 },
      },
      new Map(),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('unknown-subject');
  });

  it('re-simulating the same request yields the same subject digest (stable judging input)', () => {
    const request = {
      protocolVersion: '1.0.0',
      messageKind: 'simulation.invocation-request' as const,
      messageId: 'msg-e2e-invocation-repeat',
      createdAt: '2025-02-12T10:20:00.000Z',
      requestId: 'simreq-e2e-0003',
      simulator: {
        simulatorId: REFERENCE_SIMULATOR_REGISTRATION.simulatorId,
        registrationDigest: referenceRegistrationDigest(),
      },
      inputs: { x: 5, slope: 2, intercept: -1 },
    };
    const first = runReferenceSimulation(request);
    const second = runReferenceSimulation(request);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.resultDigest).toBe(second.run.resultDigest);
  });
});

/** Adapt a simulation result into named outputs for the reference judge. */
function subjectOutputs(result: SimulationResult): Record<string, JsonValue> {
  if (result.outcome.status !== 'completed') return {};
  return result.outcome.outputs;
}
