// Authority boundary (negative — FIRST-CLASS): an experience graph that
// attempts to embed or redefine kernel semantics in presentation
// attributes is REJECTED with a typed `authority-violation` error naming
// every violating path (architecture lock rule 8 — Experience is a
// projection, never a second source of truth).
import { describe, expect, it } from 'vitest';
import {
  KERNEL_RESERVED_ATTRIBUTE_KEYS,
  parseExperienceGraph,
  sealExperienceGraph,
} from '../src/index';
import { expectFailure, graphContent } from './fixtures';

describe('authority gate (negative — kernel semantics cannot be embedded or redefined)', () => {
  it('rejects inline world state in node attributes (a full entity object)', () => {
    const content = graphContent('2d');
    (content.nodes[1] as { attributes?: Record<string, unknown> }).attributes = {
      entity: {
        id: 'building-7',
        type: 'core:building',
        properties: { height: 42 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    expect(error.violations).toEqual([
      { path: 'nodes.1.attributes.entity', key: 'entity' },
    ]);
  });

  it('rejects a restated kernel property bag (properties key)', () => {
    const content = graphContent('narrative');
    (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
      properties: { height: 42, status: 'planned' },
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    expect(error.violations).toEqual([
      { path: 'nodes.0.attributes.properties', key: 'properties' },
    ]);
  });

  it('rejects an explicit authority claim (worldState / semanticAuthority)', () => {
    const content = graphContent('presence');
    (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
      worldState: 'authoritative',
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    expect(error.violations[0]).toEqual({
      path: 'nodes.0.attributes.worldState',
      key: 'worldState',
    });
  });

  it('rejects kernel temporal/provenance vocabulary (assertionId, provenance, confidence, validity)', () => {
    const content = graphContent('timeline-replay');
    (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
      assertionId: 'ass-42',
      provenance: 'direct-observation',
      confidence: 0.95,
      validity: 'live',
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    const keys = error.violations.map((v) => v.key).sort();
    expect(keys).toEqual(['assertionId', 'confidence', 'provenance', 'validity']);
  });

  it('rejects kernel vocabulary smuggled into EDGE attributes too', () => {
    const content = graphContent('2d');
    (content.edges[0] as { attributes?: Record<string, unknown> }).attributes = {
      relations: [],
      source: 'building-7',
      target: 'building-8',
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    expect(error.violations).toEqual([
      { path: 'edges.0.attributes.relations', key: 'relations' },
      { path: 'edges.0.attributes.source', key: 'source' },
      { path: 'edges.0.attributes.target', key: 'target' },
    ]);
  });

  it('reports every violation across nodes and edges in one error', () => {
    const content = graphContent('controls');
    (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
      world: 'state',
    };
    (content.edges[0] as { attributes?: Record<string, unknown> }).attributes = {
      subject: 'building-7',
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const error = expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    expect(error.violations.length).toBe(2);
  });

  it('admits neutral presentation attributes untouched by the scan', () => {
    const content = graphContent('2d');
    (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
      'display-hint': 'primary',
      opacity: 0.85,
      layerName: 'annotations',
      'tooltip-variant': 'compact',
    };
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      const result = parseExperienceGraph(sealed.value);
      expect(result.ok).toBe(true);
    }
  });

  it('every reserved key is actually rejected (the exported list is complete and live)', () => {
    for (const key of KERNEL_RESERVED_ATTRIBUTE_KEYS) {
      const content = graphContent('narrative');
      (content.nodes[0] as { attributes?: Record<string, unknown> }).attributes = {
        [key]: 'x',
      };
      const sealed = sealExperienceGraph(content);
      expect(sealed.ok, `sealing with reserved key "${key}"`).toBe(true);
      if (!sealed.ok) continue;
      expectFailure(parseExperienceGraph(sealed.value), 'authority-violation');
    }
  });

  it('a structurally foreign kernel object on a node is malformed, not authority-violation (precedence)', () => {
    // Kernel state smuggled as an UNKNOWN FIELD (not inside the open
    // attributes record) is rejected one gate earlier by the strict-object
    // schema as malformed-descriptor.
    const content = graphContent('narrative');
    (content.nodes[0] as unknown as Record<string, unknown>).assertion = {
      id: 'ass-42',
      statement: {},
    };
    const error = expectFailure(sealExperienceGraph(content), 'malformed-descriptor');
    expect(error.issues.some((i) => i.path === 'nodes.0.assertion')).toBe(true);
  });
});
