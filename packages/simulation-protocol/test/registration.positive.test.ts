// Simulator registration — positive cases: registration round-trips
// (parse -> canonical form -> digest), the evidence chain binds, and the
// reference simulator's own registration is admitted.
import { describe, expect, it } from 'vitest';
import { parseSimulatorRegistration } from '../src/registration';
import { canonicalDigest } from '@epoch/agent-protocol';
import { validRegistration, REFERENCE_SIMULATOR_REGISTRATION } from './fixtures';

describe('parseSimulatorRegistration (positive)', () => {
  it('admits a fully declared registration and returns canonical evidence form', () => {
    const outcome = parseSimulatorRegistration(validRegistration());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.simulatorId).toBe('simulator:thermal-steady-state');
    // Canonical JSON: sorted keys, no insignificant whitespace.
    expect(outcome.canonicalJson).toBe(canonicalJsonOf(outcome.value));
    // Digest is the SHA-256 of the canonical form (exact-revision address).
    expect(outcome.digest).toBe(canonicalDigest(outcome.value));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('key insertion order never changes the registration digest', () => {
    const a = validRegistration();
    const b = validRegistration();
    // Reverse the top-level key order of b.
    const reversed = Object.fromEntries(
      Object.keys(b)
        .reverse()
        .map((key) => [key, (b as unknown as Record<string, unknown>)[key]]),
    );
    const outcomeA = parseSimulatorRegistration(a);
    const outcomeB = parseSimulatorRegistration(reversed);
    expect(outcomeA.ok && outcomeB.ok).toBe(true);
    if (!outcomeA.ok || !outcomeB.ok) return;
    expect(outcomeA.digest).toBe(outcomeB.digest);
  });

  it('two different registrations produce different digests', () => {
    const first = parseSimulatorRegistration(validRegistration());
    const second = parseSimulatorRegistration(
      validRegistration({ simulatorId: 'simulator:thermal-transient' }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.digest).not.toBe(second.digest);
  });

  it('round-trips through JSON serialization without losing admission', () => {
    const outcome = parseSimulatorRegistration(validRegistration());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const reparsed = parseSimulatorRegistration(JSON.parse(outcome.canonicalJson));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.digest).toBe(outcome.digest);
  });

  it('admits the reference simulator registration (self-declared contract)', () => {
    const outcome = parseSimulatorRegistration(REFERENCE_SIMULATOR_REGISTRATION);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.simulatorId).toBe('simulator:reference-affine-scalar');
    expect(outcome.value.reproducibility.deterministic).toBe(true);
    expect(outcome.value.validityDomain.includes.length).toBeGreaterThan(0);
    expect(outcome.value.assumptions.length).toBeGreaterThan(0);
  });

  it('admits registrations with optional inputs and outputs declared', () => {
    const registration = validRegistration();
    const outcome = parseSimulatorRegistration(registration);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.value.inputs.some((spec) => !spec.required && spec.name === 'refinement-level'),
    ).toBe(true);
    expect(outcome.value.outputs.some((spec) => !spec.required)).toBe(true);
  });
});

/** Canonical JSON of an admitted value (sorted keys, no whitespace). */
function canonicalJsonOf(value: unknown): string {
  return JSON.stringify(sortKeys(value as object));
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
