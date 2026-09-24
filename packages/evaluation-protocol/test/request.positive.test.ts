// Evaluation request — positive cases: admission round-trips and digest
// discipline.
import { describe, expect, it } from 'vitest';
import { parseEvaluationRequest } from '../src/request';
import { validRequest, validRegistration } from './fixtures';

describe('parseEvaluationRequest (positive)', () => {
  it('admits a well-formed request and returns canonical evidence form', () => {
    const outcome = parseEvaluationRequest(validRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.requestId).toBe('evalreq-0001');
    expect(outcome.value.subject.kind).toBe('simulation-result');
    expect(outcome.value.evaluator.registrationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('criteria key order never changes the request digest', () => {
    const a = validRequest();
    const b = validRequest();
    b.criteria = { limit: 360, metric: 'peak-temperature' };
    const outcomeA = parseEvaluationRequest(a);
    const outcomeB = parseEvaluationRequest(b);
    expect(outcomeA.ok && outcomeB.ok).toBe(true);
    if (!outcomeA.ok || !outcomeB.ok) return;
    expect(outcomeA.digest).toBe(outcomeB.digest);
  });

  it('different subjects produce different digests', () => {
    const first = parseEvaluationRequest(validRequest());
    const secondRequest = validRequest();
    secondRequest.subject = { ...secondRequest.subject, subjectDigest: 'a'.repeat(64) };
    const second = parseEvaluationRequest(secondRequest);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.digest).not.toBe(second.digest);
  });

  it('admits world-outcome subjects neutrally', () => {
    const request = validRequest({
      registration: validRegistration({ evaluatorId: 'evaluator:outcome-watcher' }),
    });
    request.subject = {
      kind: 'world-outcome',
      subjectId: 'outcome-observed-0001',
      subjectDigest: '1'.repeat(64),
    };
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.subject.kind).toBe('world-outcome');
  });

  it('admits optional criteria and nested JSON criterion values', () => {
    const request = validRequest();
    request.criteria = {
      metric: 'peak-temperature',
      limit: 360,
      severity: 'aggravated',
      'tolerance-context': { zones: ['a', 'b'], factor: 1.2 },
    };
    const outcome = parseEvaluationRequest(request);
    expect(outcome.ok).toBe(true);
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
