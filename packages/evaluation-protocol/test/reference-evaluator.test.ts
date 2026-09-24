// Reference evaluator: deterministic judgment with typed failures —
// including the required negative case "evaluation of an unknown result
// is rejected" (unknown-subject), plus reproducibility evidence.
import { describe, expect, it } from 'vitest';
import {
  deriveReferenceVerdictId,
  runReferenceEvaluation,
  type ReferenceSubjectPayload,
} from '../src/reference';
import { referenceRequest } from './fixtures';
import { checkVerdictConformance } from '../src/conformance';

const KNOWN_DIGEST = 'f'.repeat(64);

function subjectsWith(payload: ReferenceSubjectPayload): Map<string, ReferenceSubjectPayload> {
  return new Map([[KNOWN_DIGEST, payload]]);
}

describe('reference evaluator (positive)', () => {
  it('judges a known subject: pass', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.verdict.outcome).toEqual({ verdictForm: 'pass-fail', outcome: 'pass' });
  });

  it('judges a known subject: fail', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 11 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.verdict.outcome).toEqual({ verdictForm: 'pass-fail', outcome: 'fail' });
  });

  it('applies every declared operator', () => {
    const cases: Array<{ operator: string; value: number; expected: 'pass' | 'fail' }> = [
      { operator: '<', value: 9, expected: 'pass' },
      { operator: '<', value: 10, expected: 'fail' },
      { operator: '<=', value: 10, expected: 'pass' },
      { operator: '<=', value: 11, expected: 'fail' },
      { operator: '>', value: 11, expected: 'pass' },
      { operator: '>', value: 10, expected: 'fail' },
      { operator: '>=', value: 10, expected: 'pass' },
      { operator: '>=', value: 9, expected: 'fail' },
      { operator: '==', value: 10, expected: 'pass' },
      { operator: '==', value: 10.0001, expected: 'fail' },
    ];
    for (const { operator, value, expected } of cases) {
      const outcome = runReferenceEvaluation(
        referenceRequest({ criteria: { metric: 'y', operator, threshold: 10 } }),
        subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: value } }),
      );
      expect(outcome.ok, `operator=${operator} value=${value}`).toBe(true);
      if (!outcome.ok) continue;
      expect(outcome.run.verdict.outcome).toEqual({ verdictForm: 'pass-fail', outcome: expected });
    }
  });

  it('justifies verdicts with references that resolve against the request criteria', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const criterionRefs = outcome.run.verdict.justification
      .filter((j) => j.kind === 'criterion')
      .map((j) => j.reference)
      .sort();
    expect(criterionRefs).toEqual(['metric', 'operator', 'threshold']);
    const outputRefs = outcome.run.verdict.justification
      .filter((j) => j.kind === 'subject-output')
      .map((j) => j.reference);
    expect(outputRefs).toEqual(['y']);
  });

  it('produces verdicts that pass verdict conformance with zero violations', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      checkVerdictConformance(outcome.run.registration, outcome.run.request, outcome.run.verdict),
    ).toEqual([]);
  });
});

describe('reference evaluator (negative: unknown and mismatched subjects)', () => {
  it('rejects evaluation of an unknown result (unknown subject digest)', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest({ subject: { kind: 'simulation-result', subjectId: 'simresult-unknown', subjectDigest: '0'.repeat(64) } }),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('unknown-subject');
    if (outcome.failure.kind === 'unknown-subject') {
      expect(outcome.failure.message).toContain('0'.repeat(64));
    }
  });

  it('rejects evaluation against an empty subject registry', () => {
    const outcome = runReferenceEvaluation(referenceRequest(), new Map());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('unknown-subject');
  });

  it('rejects a registry entry whose subject id does not match the request', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-someone-else', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('subject-id-mismatch');
  });
});

describe('reference evaluator (negative: inapplicable criteria and bad requests)', () => {
  it('rejects judgment when the metric is absent from the subject outputs', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { 'other-output': 1 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('criterion-not-applicable');
  });

  it('rejects judgment when the metric is not a finite number', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({
        subjectId: 'simresult-ffffffffffffffff',
        outputs: { y: 'not-a-number' as unknown as number },
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('criterion-not-applicable');
  });

  it('reports nonconforming-request as a typed failure with violations', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest({ criteria: { metric: 'y', operator: '<=' } }),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('nonconforming-request');
    if (outcome.failure.kind === 'nonconforming-request') {
      expect(outcome.failure.violations.some((v) => v.path === 'criteria.threshold')).toBe(true);
    }
  });

  it('reports invalid-request as a typed failure for schema-violating input', () => {
    const outcome = runReferenceEvaluation({ nonsense: true }, new Map());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.failure.kind).toBe('invalid-request');
  });
});

describe('reference evaluator reproducibility', () => {
  it('produces byte-identical verdicts for identical requests and subjects', () => {
    const subjects = subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } });
    const first = runReferenceEvaluation(referenceRequest(), subjects);
    const second = runReferenceEvaluation(referenceRequest(), subjects);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.verdictDigest).toBe(second.run.verdictDigest);
    expect(first.run.verdict).toEqual(second.run.verdict);
  });

  it('different subjects produce different verdicts', () => {
    const first = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    const second = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 99 } }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.run.verdictDigest).not.toBe(second.run.verdictDigest);
    expect(first.run.verdict.outcome).not.toEqual(second.run.verdict.outcome);
  });

  it('derives the verdict id deterministically from the request digest', () => {
    const outcome = runReferenceEvaluation(
      referenceRequest(),
      subjectsWith({ subjectId: 'simresult-ffffffffffffffff', outputs: { y: 7 } }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.run.verdict.verdictId).toBe(
      deriveReferenceVerdictId(outcome.run.requestDigest),
    );
  });
});
