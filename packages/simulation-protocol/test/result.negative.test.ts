// Simulation result — negative cases: non-deterministic constructs are
// structurally inexpressible (wall-clock/measurement smuggling rejected),
// malformed outcomes rejected, envelope discipline enforced.
import { describe, expect, it } from 'vitest';
import { parseSimulationResult } from '../src/result';
import { validResult } from './fixtures';

describe('parseSimulationResult (negative: determinism-breaking constructs)', () => {
  it('rejects wall-clock and measurement fields smuggled onto the result', () => {
    for (const smuggled of [
      { createdAt: '2025-02-10T08:06:00.000Z' },
      { completedAt: '2025-02-10T08:06:00.000Z' },
      { durationMilliseconds: 1_240 },
      { wallClock: { start: 0, end: 1 } },
      { measuredLatencyMilliseconds: 900 },
    ]) {
      const result = { ...validResult(), ...smuggled };
      const outcome = parseSimulationResult(result);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });

  it('rejects engine/provider-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { solver: 'openfoam' },
      { engine: 'chrono' },
      { backend: 'drake' },
      { vendor: 'ansys' },
    ]) {
      const result = { ...validResult(), ...smuggled };
      const outcome = parseSimulationResult(result);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
    }
  });
});

describe('parseSimulationResult (negative: malformed outcomes)', () => {
  it('rejects a completed result with zero outputs', () => {
    const result = validResult();
    result.outcome = { status: 'completed', outputs: {} };
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects a failed result without a failure reason', () => {
    const result = validResult();
    result.outcome = { status: 'failed', failure: { code: 'internal-error' } } as never;
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects a failed result with an unknown failure code', () => {
    const result = validResult();
    result.outcome = {
      status: 'failed',
      failure: { code: 'solver-crashed', message: 'Engine crashed.' },
    } as never;
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects an outcome without a recognized status', () => {
    const result = validResult();
    (result.outcome as { status: string }).status = 'partial';
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects outputs with non-parameter-shaped names', () => {
    const result = validResult();
    if (result.outcome.status !== 'completed') return;
    result.outcome.outputs = { 'Peak Temperature': 355.25 };
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects a completed result that also carries a failure', () => {
    const result = validResult();
    result.outcome = {
      status: 'completed',
      outputs: { 'peak-temperature': 1 },
      failure: { code: 'internal-error', message: 'x' },
    } as never;
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
  });

  it('rejects non-object roots with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseSimulationResult(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseSimulationResult (negative: envelope discipline)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    const result = { ...validResult(), protocolVersion: '0.9.0' };
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe('0.9.0');
      }
    }
  });

  it('reports kind-mismatch for other simulation message kinds', () => {
    const result = { ...validResult(), messageKind: 'simulation.registration' };
    const outcome = parseSimulationResult(result);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('simulation.result');
        expect(outcome.error.encountered).toBe('simulation.registration');
      }
    }
  });

  it('rejects malformed request binding digests', () => {
    for (const badDigest of ['short', 'A'.repeat(64), '']) {
      const result = validResult({ requestDigest: badDigest });
      const outcome = parseSimulationResult(result);
      expect(outcome.ok, `digest=${badDigest}`).toBe(false);
    }
  });
});
