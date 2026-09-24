// Invocation request — positive cases: admission round-trips, canonical
// digest discipline, and seed attachment when declared.
import { describe, expect, it } from 'vitest';
import { parseSimulationInvocationRequest } from '../src/invocation';
import { validInvocationRequest, validRegistration } from './fixtures';

describe('parseSimulationInvocationRequest (positive)', () => {
  it('admits a well-formed request and returns canonical evidence form', () => {
    const outcome = parseSimulationInvocationRequest(validInvocationRequest());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.requestId).toBe('simreq-0001');
    expect(outcome.value.simulator.registrationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('input key order never changes the request digest', () => {
    const a = validInvocationRequest();
    const b = validInvocationRequest({
      inputs: {
        'convection-model': 'natural',
        'heat-input': 120,
        assembly: 'entity:assembly:planar-01',
      },
    });
    const outcomeA = parseSimulationInvocationRequest(a);
    const outcomeB = parseSimulationInvocationRequest(b);
    expect(outcomeA.ok && outcomeB.ok).toBe(true);
    if (!outcomeA.ok || !outcomeB.ok) return;
    expect(outcomeA.digest).toBe(outcomeB.digest);
  });

  it('different inputs produce different digests', () => {
    const first = parseSimulationInvocationRequest(
      validInvocationRequest({ inputs: { 'heat-input': 120, assembly: 'a', 'convection-model': 'natural' } }),
    );
    const second = parseSimulationInvocationRequest(
      validInvocationRequest({ inputs: { 'heat-input': 121, assembly: 'a', 'convection-model': 'natural' } }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.digest).not.toBe(second.digest);
  });

  it('admits a request carrying a seed and nested JSON input values', () => {
    const request = validInvocationRequest({
      registration: validRegistration({ simulatorId: 'simulator:seeded-thermal' }),
      inputs: {
        assembly: 'entity:assembly:planar-01',
        'heat-input': 120,
        'convection-model': 'natural',
        'extra-context': { layers: 3, notes: ['a', 'b'] },
      },
      requestId: 'simreq-seeded-0001',
    });
    (request as { seed?: number }).seed = 42;
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.seed).toBe(42);
    expect(outcome.value.inputs['extra-context']).toEqual({ layers: 3, notes: ['a', 'b'] });
  });

  it('admits a request against the reference simulator registration digest', () => {
    const request = validInvocationRequest({
      registration: validRegistration({ simulatorId: 'simulator:reference-affine-scalar' }),
    });
    const outcome = parseSimulationInvocationRequest(request);
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
