// W032 — Scenario DSL tests: parse, digest stability, round-trip.
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  deserializeScenario,
  parseScenario,
  scenarioContent,
  scenarioDigest,
  serializeScenario,
  type ScenarioDefinition,
} from '../src';
import { ledgerScenario } from './scenarios';

describe('scenario DSL', () => {
  it('parses a well-formed scenario', () => {
    const parsed = parseScenario(ledgerScenario());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.scenarioId).toBe('scenario:fixture-ledger');
      expect(parsed.value.steps.length).toBeGreaterThan(0);
    }
  });

  it('rejects a malformed scenario with typed issues (negative)', () => {
    const parsed = parseScenario({ nonsense: true });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('scenario-parse-failed');
      expect(parsed.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('rejects unknown fields (strict objects)', () => {
    const scenario = { ...ledgerScenario(), extra: 'forbidden' } as Record<string, unknown>;
    const parsed = parseScenario(scenario);
    expect(parsed.ok).toBe(false);
  });

  it('rejects a non-tenant-grammar tenant id (W009)', () => {
    const scenario = { ...ledgerScenario(), tenantId: 'not-a-tenant-id' } as Record<string, unknown>;
    const parsed = parseScenario(scenario);
    expect(parsed.ok).toBe(false);
  });

  it('the digest is content-addressed: equal scenarios digest identically, different scenarios differ', () => {
    const first = scenarioDigest(ledgerScenario());
    const second = scenarioDigest(ledgerScenario());
    expect(second).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    const mutated = ledgerScenario();
    mutated.steps = [...mutated.steps, {
      stepId: 'step:extra',
      kind: 'call',
      driverOp: 'ledger.read',
      actorId: 'principal:lead',
      route: 'public-api',
      input: {},
      expect: 'ok',
    }];
    expect(scenarioDigest(mutated)).not.toBe(first);
  });

  it('key-order permutations digest identically (digest-stable serialization)', () => {
    const scenario = ledgerScenario();
    const permuted = deepReverseKeys(scenario) as ScenarioDefinition;
    expect(serializeScenario(permuted)).toBe(serializeScenario(scenario));
    expect(scenarioDigest(permuted)).toBe(scenarioDigest(scenario));
  });

  it('serializes + round-trips + digest-verifies', () => {
    const scenario = ledgerScenario();
    const text = serializeScenario(scenario);
    expect(text.length).toBeGreaterThan(0);
    const claimed = scenarioDigest(scenario);
    const round = deserializeScenario(text, claimed);
    expect(round.ok).toBe(true);
    if (round.ok) {
      expect(round.value.digestVerifies).toBe(true);
      expect(scenarioDigest(round.value.scenario)).toBe(claimed);
    }
  });

  it('a tampered serialization fails digest verification (negative)', () => {
    const scenario = ledgerScenario();
    const text = serializeScenario(scenario);
    const claimed = 'a'.repeat(64);
    const round = deserializeScenario(text, claimed);
    expect(round.ok).toBe(true);
    if (round.ok) {
      expect(round.value.digestVerifies).toBe(false);
    }
  });

  it('the content projection serializes canonically (byte-stable)', () => {
    const scenario = ledgerScenario();
    expect(canonicalJson(scenarioContent(scenario))).toBe(serializeScenario(scenario));
  });
});

/** Deeply reverse every object's key insertion order (a hard permutation). */
function deepReverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => deepReverseKeys(entry));
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).reverse();
    const rebuilt: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      rebuilt[key] = deepReverseKeys(entry);
    }
    return rebuilt;
  }
  return value;
}
