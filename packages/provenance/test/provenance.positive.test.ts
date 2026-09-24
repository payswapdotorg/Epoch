// Positive tests: full graphs validate, digests are deterministic and
// key-order insensitive, all six relation kinds are admitted, and empty
// graphs are vacuously valid.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  admitProvenanceGraph,
  computeProvenanceDigest,
  parseProvenanceGraph,
  validateProvenanceGraph,
} from '../src/index';
import { provenanceGraph, T0, T1, T2 } from './helpers';

describe('provenance graph schema (positive)', () => {
  it('admits a complete graph exercising all six core relations', () => {
    const result = admitProvenanceGraph(provenanceGraph());
    expect(result.ok).toBe(true);
  });

  it('admits an empty graph (vacuously valid)', () => {
    const result = admitProvenanceGraph({
      schemaVersion: 1,
      agents: [],
      activities: [],
      entities: [],
      statements: [],
    });
    expect(result.ok).toBe(true);
  });

  it('admits every agent kind in the adapted PROV vocabulary', () => {
    // Keep the referenced agents; add one unreferenced agent per kind
    // (unreferenced nodes are legal — a graph may declare spare actors).
    const result = admitProvenanceGraph(
      provenanceGraph({
        agents: [
          { agentId: 'actor:solver-01', agentKind: 'software', displayName: 'FE solver' },
          { agentId: 'actor:reviewer-01', agentKind: 'person', displayName: 'Dr. Chen' },
          { agentId: 'org:engineering', agentKind: 'organization' },
          { agentId: 'agent:person-1', agentKind: 'person' },
          { agentId: 'agent:org-1', agentKind: 'organization' },
          { agentId: 'agent:software-1', agentKind: 'software' },
          { agentId: 'agent:hardware-1', agentKind: 'hardware' },
          { agentId: 'agent:system-1', agentKind: 'system' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('admits long derivation chains (a -> b -> c)', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        entities: [
          { entityId: 'e:a', entityKind: 'document' },
          { entityId: 'e:b', entityKind: 'document' },
          { entityId: 'e:c', entityKind: 'document' },
        ],
        statements: [
          { relation: 'was-derived-from', generatedEntityId: 'e:b', usedEntityId: 'e:a' },
          { relation: 'was-derived-from', generatedEntityId: 'e:c', usedEntityId: 'e:b' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('provenance parse surface (positive)', () => {
  it('parses a valid graph to the typed model', () => {
    const parsed = parseProvenanceGraph(provenanceGraph());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.graph.agents).toHaveLength(3);
    expect(parsed.graph.statements).toHaveLength(9);
    expect(parsed.graph.statements[0]?.relation).toBe('was-associated-with');
  });
});

describe('content-addressed graph identity (positive)', () => {
  it('digests a graph to the SHA-256 of its canonical JSON form', () => {
    const parsed = parseProvenanceGraph(provenanceGraph());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const digest = computeProvenanceDigest(parsed.graph);
    expect(digest).toBe(canonicalDigest(parsed.graph as never));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is key-order insensitive: reordered graphs share one address', () => {
    const a = parseProvenanceGraph(provenanceGraph());
    // Object member order is irrelevant to canonical JSON; array order is
    // semantic and intentionally NOT permuted here.
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>).reverse()) {
          out[k] = reverseKeys(v);
        }
        return out;
      }
      return value;
    };
    const b = parseProvenanceGraph(reverseKeys(provenanceGraph()));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(computeProvenanceDigest(a.graph)).toBe(computeProvenanceDigest(b.graph));
  });
});

describe('validateProvenanceGraph on already-typed graphs (positive)', () => {
  it('validates a parsed graph directly and returns it on success', () => {
    const parsed = parseProvenanceGraph(provenanceGraph());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validation = validateProvenanceGraph(parsed.graph);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.graph).toBe(parsed.graph);
    }
  });

  it('accepts activities with only start or only end times', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        activities: [
          { activityId: 'run:stress-check-1', activityKind: 'verification-run', startedAt: T0 },
          { activityId: 'approval:signoff-1', activityKind: 'approval', endedAt: T2 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a statement with a timestamp between activity bounds', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-associated-with', activityId: 'run:stress-check-1', agentId: 'actor:solver-01' },
          { relation: 'was-generated-by', entityId: 'evidence:abc123', activityId: 'run:stress-check-1', time: T1 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    void T2;
  });
});
