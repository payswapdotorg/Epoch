import type {
  ActorRef,
  AssertionInput,
  Confidence,
  EvidenceRef,
  JsonValue,
  Provenance,
} from '@epoch/world-contracts';
import type { Clock } from '../src/index';

/**
 * Test fixtures: a deterministic stepping clock and provenance/confidence
 * factories.
 */

export function stepClock(startMs = Date.UTC(2026, 0, 1, 9, 0, 0), stepMs = 60_000): { clock: Clock; advance: (steps?: number) => string; now: () => string } {
  let current = startMs;
  const clock: Clock = () => new Date(current).toISOString();
  return {
    clock,
    advance(steps = 1) {
      current += steps * stepMs;
      return clock();
    },
    now: clock,
  };
}

export function humanActor(id = 'user:alice'): ActorRef {
  return { id, role: 'human', displayName: 'Alice' };
}

export function agentActor(id = 'agent:planner-1'): ActorRef {
  return { id, role: 'agent' };
}

export function evidence(id: string, overrides: Partial<EvidenceRef> = {}): EvidenceRef {
  return { id, kind: 'document', ...overrides };
}

export function measuredConfidence(value: number): Confidence {
  return { distribution: { kind: 'point', value }, method: 'measured' };
}

export function statedConfidence(value: number): Confidence {
  return { distribution: { kind: 'point', value }, method: 'stated' };
}

export function provenance(overrides: Partial<Provenance> = {}): Provenance {
  return {
    actor: humanActor(),
    method: 'direct-observation',
    evidence: [evidence('ev:doc-1')],
    ...overrides,
  };
}

export function entityAssertion(
  entityId: string,
  entityType: string,
  properties: Record<string, JsonValue> = {},
  overrides: Partial<Omit<AssertionInput, 'statement'>> = {},
): AssertionInput {
  return {
    statement: { kind: 'entity', entityId, entityType, properties },
    provenance: provenance(),
    confidence: measuredConfidence(0.95),
    ...overrides,
  };
}

export function propertyAssertion(
  entityId: string,
  property: string,
  value: JsonValue,
  overrides: Partial<Omit<AssertionInput, 'statement'>> = {},
): AssertionInput {
  return {
    statement: { kind: 'entity-property', entityId, property, value },
    provenance: provenance(),
    confidence: measuredConfidence(0.9),
    ...overrides,
  };
}

export function relationAssertion(
  relationType: string,
  source: string,
  target: string,
  properties: Record<string, JsonValue> = {},
  overrides: Partial<Omit<AssertionInput, 'statement'>> = {},
): AssertionInput {
  return {
    statement: { kind: 'relation', relationType, source, target, properties },
    provenance: provenance(),
    confidence: measuredConfidence(0.9),
    ...overrides,
  };
}
