// Evaluation verdict — positive cases: pass/fail and scored outcomes,
// justification references, canonical digests.
import { describe, expect, it } from 'vitest';
import { parseEvaluationVerdict } from '../src/verdict';
import { validVerdict, validScoredVerdict } from './fixtures';

describe('parseEvaluationVerdict (positive)', () => {
  it('admits a pass/fail verdict with referenced justifications', () => {
    const outcome = parseEvaluationVerdict(validVerdict());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.outcome).toEqual({ verdictForm: 'pass-fail', outcome: 'pass' });
    expect(outcome.value.justification.length).toBeGreaterThanOrEqual(1);
    const criterionRefs = outcome.value.justification
      .filter((j) => j.kind === 'criterion')
      .map((j) => j.reference);
    expect(criterionRefs).toContain('metric');
    expect(criterionRefs).toContain('limit');
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits a fail verdict', () => {
    const verdict = validVerdict();
    verdict.outcome = { verdictForm: 'pass-fail', outcome: 'fail' };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(true);
  });

  it('admits a scored verdict on a declared scale', () => {
    const outcome = parseEvaluationVerdict(validScoredVerdict());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.outcome).toEqual({
      verdictForm: 'scored',
      score: 0.87,
      scale: { minimum: 0, maximum: 1 },
    });
  });

  it('admits all justification kinds', () => {
    const verdict = validVerdict();
    verdict.justification = [
      { kind: 'criterion', reference: 'metric', statement: 'Judged metric.' },
      { kind: 'subject-output', reference: 'peak-temperature', statement: 'Observed 355.25.' },
      { kind: 'subject-failure', reference: 'numerical-divergence', statement: 'Run failed.' },
      { kind: 'assumption', reference: 'single-limit-semantics', statement: 'Assumed.' },
      { kind: 'method', reference: 'direct-comparison', statement: 'Compared directly.' },
    ];
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(true);
  });

  it('carries no wall-clock or measurement fields (digest-stability shape)', () => {
    const outcome = parseEvaluationVerdict(validVerdict());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const keys = Object.keys(outcome.value);
    for (const forbidden of ['createdAt', 'decidedAt', 'judgedAt', 'durationMilliseconds']) {
      expect(keys, `verdict must not carry ${forbidden}`).not.toContain(forbidden);
    }
  });
});

/** Canonical-form check: re-serialize with recursively sorted keys (no
 * insignificant whitespace between tokens; string CONTENTS may contain
 * spaces, which is legitimate JSON). */
function canonicalJsonOf(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
