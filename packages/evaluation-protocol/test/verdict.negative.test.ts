// Evaluation verdict — negative cases: justification-less verdicts are
// inexpressible, scored scales must be non-degenerate and contain the
// score, determinism-breaking constructs rejected, envelope discipline
// enforced.
import { describe, expect, it } from 'vitest';
import { parseEvaluationVerdict } from '../src/verdict';
import { validVerdict, validScoredVerdict } from './fixtures';

describe('parseEvaluationVerdict (negative: unjustified verdicts)', () => {
  it('rejects a verdict without any justification reference', () => {
    const verdict = validVerdict();
    verdict.justification = [];
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('rejects justifications with empty references or statements', () => {
    for (const bad of [
      { kind: 'criterion', reference: '', statement: 's' },
      { kind: 'criterion', reference: 'metric', statement: '' },
    ]) {
      const verdict = validVerdict();
      verdict.justification = [bad as never];
      const outcome = parseEvaluationVerdict(verdict);
      expect(outcome.ok, `justification=${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('rejects unknown justification kinds', () => {
    const verdict = validVerdict();
    verdict.justification = [
      { kind: 'gut-feeling', reference: 'x', statement: 'Felt right.' } as never,
    ];
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });
});

describe('parseEvaluationVerdict (negative: scored-scale discipline)', () => {
  it('rejects a degenerate scale (minimum == maximum)', () => {
    const verdict = validScoredVerdict();
    verdict.outcome = { verdictForm: 'scored', score: 5, scale: { minimum: 5, maximum: 5 } };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });

  it('rejects an inverted scale (minimum > maximum)', () => {
    const verdict = validScoredVerdict();
    verdict.outcome = { verdictForm: 'scored', score: 1, scale: { minimum: 2, maximum: 1 } };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });

  it('rejects a score outside the declared scale', () => {
    const verdict = validScoredVerdict();
    verdict.outcome = { verdictForm: 'scored', score: 1.2, scale: { minimum: 0, maximum: 1 } };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });

  it('rejects a scored verdict without a scale', () => {
    const verdict = validScoredVerdict();
    verdict.outcome = { verdictForm: 'scored', score: 0.5 } as never;
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });

  it('rejects unknown verdict forms', () => {
    const verdict = validVerdict();
    (verdict.outcome as { verdictForm: string }).verdictForm = 'narrative';
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
  });
});

describe('parseEvaluationVerdict (negative: determinism-breaking constructs)', () => {
  it('rejects wall-clock and measurement fields smuggled onto the verdict', () => {
    for (const smuggled of [
      { createdAt: '2025-02-12T09:06:00.000Z' },
      { decidedAt: '2025-02-12T09:06:00.000Z' },
      { durationMilliseconds: 42 },
      { judgeSession: 'abc' },
    ]) {
      const verdict = { ...validVerdict(), ...smuggled };
      const outcome = parseEvaluationVerdict(verdict);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });

  it('rejects vendor/model-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { judge: 'gpt-4o' },
      { model: 'claude-3' },
      { vendor: 'openai' },
    ]) {
      const verdict = { ...validVerdict(), ...smuggled };
      const outcome = parseEvaluationVerdict(verdict);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
    }
  });
});

describe('parseEvaluationVerdict (negative: envelope discipline)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    const verdict = { ...validVerdict(), protocolVersion: '0.9.0' };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe('0.9.0');
      }
    }
  });

  it('reports kind-mismatch for other evaluation message kinds', () => {
    const verdict = { ...validVerdict(), messageKind: 'evaluation.request' };
    const outcome = parseEvaluationVerdict(verdict);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('evaluation.verdict');
        expect(outcome.error.encountered).toBe('evaluation.request');
      }
    }
  });

  it('rejects malformed request binding digests', () => {
    for (const badDigest of ['short', 'E'.repeat(64), '']) {
      const verdict = validVerdict({ requestDigest: badDigest });
      const outcome = parseEvaluationVerdict(verdict);
      expect(outcome.ok, `digest=${badDigest}`).toBe(false);
    }
  });

  it('rejects non-object roots with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseEvaluationVerdict(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});
