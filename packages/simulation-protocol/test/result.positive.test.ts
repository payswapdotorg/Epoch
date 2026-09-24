// Simulation result — positive cases: completed and failed outcomes,
// canonical digests, and the strict no-wall-clock shape.
import { describe, expect, it } from 'vitest';
import { parseSimulationResult } from '../src/result';
import { validResult } from './fixtures';

describe('parseSimulationResult (positive)', () => {
  it('admits a completed result and returns canonical evidence form', () => {
    const outcome = parseSimulationResult(validResult());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.outcome.status).toBe('completed');
    if (outcome.value.outcome.status !== 'completed') return;
    expect(outcome.value.outcome.outputs['peak-temperature']).toBe(355.25);
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('admits a failed result with a machine-readable code and reason', () => {
    const result = validResult();
    result.outcome = {
      status: 'failed',
      failure: {
        code: 'input-out-of-domain',
        message: 'Assembly outside the declared validity domain (phase change).',
      },
    };
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.outcome.status).toBe('failed');
    if (outcome.value.outcome.status !== 'failed') return;
    expect(outcome.value.outcome.failure.code).toBe('input-out-of-domain');
    expect(outcome.value.outcome.failure.message.length).toBeGreaterThan(0);
  });

  it('output key order never changes the result digest', () => {
    const a = validResult();
    const b = validResult();
    if (a.outcome.status !== 'completed' || b.outcome.status !== 'completed') return;
    b.outcome.outputs = { margin: 44.75, 'peak-temperature': 355.25 };
    const outcomeA = parseSimulationResult(a);
    const outcomeB = parseSimulationResult(b);
    expect(outcomeA.ok && outcomeB.ok).toBe(true);
    if (!outcomeA.ok || !outcomeB.ok) return;
    expect(outcomeA.digest).toBe(outcomeB.digest);
  });

  it('carries no wall-clock or measurement fields (digest-stability shape)', () => {
    const outcome = parseSimulationResult(validResult());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const keys = Object.keys(outcome.value);
    for (const forbidden of ['createdAt', 'completedAt', 'startedAt', 'durationMilliseconds', 'wallClock']) {
      expect(keys, `result must not carry ${forbidden}`).not.toContain(forbidden);
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
