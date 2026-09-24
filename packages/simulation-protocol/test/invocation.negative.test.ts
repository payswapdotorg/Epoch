// Invocation request — negative cases: schema-violating inputs, envelope
// discipline, and version/kind gates. Every rejection is a typed protocol
// error.
import { describe, expect, it } from 'vitest';
import { parseSimulationInvocationRequest } from '../src/invocation';
import { validInvocationRequest } from './fixtures';

describe('parseSimulationInvocationRequest (negative: schema-violating inputs)', () => {
  it('rejects requests with an empty inputs record', () => {
    const request = validInvocationRequest({ inputs: {} });
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('rejects inputs with non-parameter-shaped names', () => {
    for (const badName of ['Heat Input', '1starts-with-digit', 'UPPER', 'a.b']) {
      const request = validInvocationRequest({
        inputs: { [badName]: 1, 'heat-input': 120, 'convection-model': 'natural', assembly: 'a' },
      });
      const outcome = parseSimulationInvocationRequest(request);
      expect(outcome.ok, `inputName=${badName}`).toBe(false);
    }
  });

  it('rejects a malformed registration digest (not 64 lowercase hex)', () => {
    for (const badDigest of ['XYZ', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), '']) {
      const request = validInvocationRequest({ registrationDigest: badDigest });
      const outcome = parseSimulationInvocationRequest(request);
      expect(outcome.ok, `digest=${badDigest}`).toBe(false);
    }
  });

  it('rejects seeds that are negative, fractional, or beyond safe integers', () => {
    for (const seed of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const request = validInvocationRequest();
      (request as { seed?: number }).seed = seed;
      const outcome = parseSimulationInvocationRequest(request);
      expect(outcome.ok, `seed=${seed}`).toBe(false);
    }
  });

  it('rejects non-object inputs and non-JSON values inside the inputs record', () => {
    const bad: unknown[] = [
      { ...validInvocationRequest(), inputs: { x: undefined } },
      { ...validInvocationRequest(), inputs: { x: () => 1 } },
      { ...validInvocationRequest(), inputs: { x: Symbol('x') } },
    ];
    for (const input of bad) {
      const outcome = parseSimulationInvocationRequest(input);
      expect(outcome.ok).toBe(false);
    }
  });

  it('rejects non-object request roots with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseSimulationInvocationRequest(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseSimulationInvocationRequest (negative: engine-vocabulary smuggling)', () => {
  it('rejects solver/engine/provider-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { solver: 'openfoam' },
      { engine: 'drake' },
      { backend: 'chrono' },
      { apiEndpoint: 'https://vendor.example' },
      { apiKey: 'secret' },
    ]) {
      const request = { ...validInvocationRequest(), ...smuggled };
      const outcome = parseSimulationInvocationRequest(request);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseSimulationInvocationRequest (negative: envelope discipline)', () => {
  it('rejects malformed simulator ids in the reference', () => {
    const request = validInvocationRequest();
    (request.simulator as { simulatorId: string }).simulatorId = 'openfoam-solver';
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(false);
  });

  it('reports version-mismatch with expected and encountered versions', () => {
    const request = { ...validInvocationRequest(), protocolVersion: '2.0.0' };
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe('2.0.0');
      }
    }
  });

  it('reports kind-mismatch for other simulation message kinds', () => {
    const request = { ...validInvocationRequest(), messageKind: 'simulation.result' };
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('simulation.invocation-request');
        expect(outcome.error.encountered).toBe('simulation.result');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const request = {
      ...validInvocationRequest(),
      protocolVersion: '0.9.0',
      messageKind: 'simulation.result',
    };
    const outcome = parseSimulationInvocationRequest(request);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });
});
