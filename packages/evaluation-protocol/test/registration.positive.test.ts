// Evaluator registration — positive cases: registration round-trips and
// the reference evaluator's own registration is admitted.
import { describe, expect, it } from 'vitest';
import { parseEvaluatorRegistration } from '../src/registration';
import { canonicalDigest } from '@epoch/agent-protocol';
import { validRegistration, REFERENCE_EVALUATOR_REGISTRATION } from './fixtures';

describe('parseEvaluatorRegistration (positive)', () => {
  it('admits a fully declared registration and returns canonical evidence form', () => {
    const outcome = parseEvaluatorRegistration(validRegistration());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.evaluatorId).toBe('evaluator:thermal-margin');
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    expect(outcome.digest).toBe(canonicalDigest(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('key insertion order never changes the registration digest', () => {
    const a = validRegistration();
    const b = validRegistration();
    const reversed = Object.fromEntries(
      Object.keys(b)
        .reverse()
        .map((key) => [key, (b as unknown as Record<string, unknown>)[key]]),
    );
    const outcomeA = parseEvaluatorRegistration(a);
    const outcomeB = parseEvaluatorRegistration(reversed);
    expect(outcomeA.ok && outcomeB.ok).toBe(true);
    if (!outcomeA.ok || !outcomeB.ok) return;
    expect(outcomeA.digest).toBe(outcomeB.digest);
  });

  it('admits registrations judging both subject kinds', () => {
    const registration = validRegistration();
    registration.subjectKinds = ['simulation-result', 'world-outcome'];
    const outcome = parseEvaluatorRegistration(registration);
    expect(outcome.ok).toBe(true);
  });

  it('admits the reference evaluator registration (self-declared contract)', () => {
    const outcome = parseEvaluatorRegistration(REFERENCE_EVALUATOR_REGISTRATION);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.evaluatorId).toBe('evaluator:reference-threshold');
    expect(outcome.value.deterministic).toBe(true);
    expect(outcome.value.judgmentBasis.assumptions.length).toBeGreaterThan(0);
    expect(outcome.value.verdictForms).toEqual(['pass-fail']);
  });

  it('round-trips through JSON serialization without losing admission', () => {
    const outcome = parseEvaluatorRegistration(validRegistration());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const reparsed = parseEvaluatorRegistration(JSON.parse(outcome.canonicalJson));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.digest).toBe(outcome.digest);
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
