// Positive battery: every graph kind round-trips through the full
// admission pipeline (version gate, schema gate, digest gate, tenant gate,
// resolvability gate, authority gate); sealing and parsing are inverse
// operations; serialization is canonical; and the projection invariants
// hold on admitted graphs.
import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_GRAPH_KINDS,
  computeExperienceGraphDigest,
  parseExperienceGraph,
  sealExperienceGraph,
  serializeExperienceGraph,
  serializeProjectionRequest,
  parseProjectionRequest,
  projectedReferenceKey,
} from '../src/index';
import {
  CAPABILITY_REF,
  EVIDENCE_REF,
  TENANT_A,
  graphContent,
  projectionRequest,
  sealedGraph,
} from './fixtures';

describe('experience graph admission (positive)', () => {
  it.each(EXPERIENCE_GRAPH_KINDS)('admits a valid "%s" graph end-to-end', (kind) => {
    const graph = sealedGraph(kind);
    const result = parseExperienceGraph(graph);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.graphKind).toBe(kind);
    expect(result.value.digest).toBe(graph.digest);
    expect(result.value.nodes.length).toBeGreaterThan(0);
  });

  it.each(EXPERIENCE_GRAPH_KINDS)('serializes a valid "%s" graph canonically', (kind) => {
    const graph = sealedGraph(kind);
    const serialized = serializeExperienceGraph(graph);
    // Canonical form sorts keys (deterministic), so it deep-equals the
    // envelope rather than matching JSON.stringify's insertion order.
    expect(JSON.parse(serialized)).toEqual(graph);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it('seal → parse round-trips every graph kind with stable digests', () => {
    for (const kind of EXPERIENCE_GRAPH_KINDS) {
      const first = sealedGraph(kind);
      const second = sealExperienceGraph(graphContent(kind));
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.digest).toBe(first.digest);
      }
      const parsed = parseExperienceGraph(first);
      expect(parsed.ok).toBe(true);
    }
  });

  it('admits a graph with all six projected-reference kinds', () => {
    const content = graphContent('narrative');
    // Sorted by (kind, target id): agent < capability < evidence-record <
    // world-entity < world-event < world-relation.
    content.projectedFrom = [
      { kind: 'agent', tenantId: TENANT_A, agentId: 'agent:planner-1', contentDigest: 'c'.repeat(64) },
      CAPABILITY_REF,
      EVIDENCE_REF,
      { kind: 'world-entity', tenantId: TENANT_A, entityId: 'building-7', contentDigest: 'a'.repeat(64) },
      { kind: 'world-event', tenantId: TENANT_A, eventId: 'evt-3', contentDigest: 'b'.repeat(64) },
      { kind: 'world-relation', tenantId: TENANT_A, relationId: `rel-${'e'.repeat(64)}`, contentDigest: 'f'.repeat(64) },
    ];
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) throw new Error(JSON.stringify(sealed.error));
    const parsed = parseExperienceGraph(sealed.value);
    expect(parsed.ok).toBe(true);
  });

  it('admits a pure-presentation graph with zero projected references', () => {
    const content = graphContent('controls');
    content.projectedFrom = [];
    content.nodes.forEach((node) => {
      delete (node as { ref?: unknown }).ref;
    });
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      const parsed = parseExperienceGraph(sealed.value);
      expect(parsed.ok).toBe(true);
    }
  });

  it('accepts the expected-tenant option when tenants match', () => {
    const result = parseExperienceGraph(sealedGraph('2d'), { expectedTenantId: TENANT_A });
    expect(result.ok).toBe(true);
  });

  it('computes the digest over the canonical content form', () => {
    const content = graphContent('presence');
    const digest = computeExperienceGraphDigest(content);
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.digest).toBe(digest);
    }
  });

  it('exposes deterministic reference sort keys', () => {
    expect(projectedReferenceKey(EVIDENCE_REF)).toBe(
      `evidence-record:${EVIDENCE_REF.recordDigest}`,
    );
    expect(projectedReferenceKey(CAPABILITY_REF)).toBe(
      `capability:${CAPABILITY_REF.capabilityId}@${CAPABILITY_REF.capabilityVersion}`,
    );
  });
});

describe('projection request admission (positive)', () => {
  it.each(EXPERIENCE_GRAPH_KINDS)('admits a valid "%s" projection request', (kind) => {
    const result = parseProjectionRequest(projectionRequest(kind));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.graphKind).toBe(kind);
  });

  it('serializes a request canonically', () => {
    const request = projectionRequest('3d');
    const serialized = serializeProjectionRequest(request);
    expect(JSON.parse(serialized)).toEqual(request);
  });

  it('admits a headset device descriptor with stereoscopic display and 6dof tracking', () => {
    const request = projectionRequest('3d', {
      device: {
        descriptorVersion: 1,
        deviceClass: 'headset',
        interaction: ['gaze', 'gesture', 'voice'],
        display: { stereoscopic: true, refreshHz: 90 },
        spatial: { poseTracking: '6dof', worldAnchored: true, maxTriangles: 1_000_000 },
        latencyBudgetMs: 20,
      },
    });
    const result = parseProjectionRequest(request);
    expect(result.ok).toBe(true);
  });

  it('accepts the expected-tenant option when tenants match', () => {
    const result = parseProjectionRequest(projectionRequest('2d'), { expectedTenantId: TENANT_A });
    expect(result.ok).toBe(true);
  });
});
