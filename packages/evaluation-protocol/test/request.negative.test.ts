// Evaluation request — negative cases: schema-violating criteria,
// malformed subjects, envelope discipline.
import { describe, expect, it } from 'vitest';
import { parseEvaluationRequest } from '../src/request';
import { validRequest } from './fixtures';

describe('parseEvaluationRequest (negative: schema violations)', () => {
  it('rejects requests with an empty criteria record', () => {
    const request = validRequest();
    request.criteria = {};
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('rejects criteria with non-parameter-shaped names', () => {
    for (const badName of ['Max Limit', '1limit', 'UPPER', 'a.b']) {
      const request = validRequest();
      request.criteria = { ...request.criteria, [badName]: 1 };
      const outcome = parseEvaluationRequest(request);
      expect(outcome.ok, `criterion=${badName}`).toBe(false);
    }
  });

  it('rejects malformed registration digests (not 64 lowercase hex)', () => {
    for (const badDigest of ['XYZ', 'c'.repeat(63), 'C'.repeat(64), '']) {
      const request = validRequest({ registrationDigest: badDigest });
      const outcome = parseEvaluationRequest(request);
      expect(outcome.ok, `digest=${badDigest}`).toBe(false);
    }
  });

  it('rejects malformed subject digests', () => {
    for (const badDigest of ['short', 'D'.repeat(64), '']) {
      const request = validRequest();
      request.subject = { ...request.subject, subjectDigest: badDigest };
      const outcome = parseEvaluationRequest(request);
      expect(outcome.ok, `digest=${badDigest}`).toBe(false);
    }
  });

  it('rejects unknown subject kinds', () => {
    const request = validRequest();
    (request.subject as { kind: string }).kind = 'vendor-benchmark';
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(false);
  });

  it('rejects non-object roots with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseEvaluationRequest(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseEvaluationRequest (negative: vendor-vocabulary smuggling)', () => {
  it('rejects vendor/model/provider-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { judge: 'gpt-4o' },
      { model: 'claude-3' },
      { vendor: 'openai' },
      { apiKey: 'secret' },
    ]) {
      const request = { ...validRequest(), ...smuggled };
      const outcome = parseEvaluationRequest(request);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseEvaluationRequest (negative: envelope discipline)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    const request = { ...validRequest(), protocolVersion: '3.0.0' };
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe('3.0.0');
      }
    }
  });

  it('reports kind-mismatch for other evaluation message kinds', () => {
    const request = { ...validRequest(), messageKind: 'evaluation.registration' };
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('evaluation.request');
        expect(outcome.error.encountered).toBe('evaluation.registration');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const request = {
      ...validRequest(),
      protocolVersion: '0.9.0',
      messageKind: 'evaluation.verdict',
    };
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });
});
