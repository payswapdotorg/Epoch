// Published-surface integrity: the exported vocabularies, error codes,
// and transition table are exactly the architecture-pinned sets, and the
// category list is the agent-protocol Capability Fabric list (one source
// of truth — no drift possible).
import { describe, expect, it } from 'vitest';
import { CAPABILITY_FABRIC_CATEGORIES } from '@epoch/agent-protocol';
import {
  CAPABILITY_LIFECYCLE_STATES,
  CAPABILITY_LIFECYCLE_TRANSITIONS,
  CAPABILITY_MANIFEST_VERSION,
  CAPABILITY_ORIGINS,
  CAPABILITY_REGISTRY_CONTRACT_VERSION,
  CAPABILITY_REGISTRY_SCHEMA_SURFACE,
  CapabilityCategorySchema,
} from '../src/index';

describe('capability-registry published surface', () => {
  it('the category vocabulary is EXACTLY the architecture Capability Fabric list', () => {
    // architecture.md, "Capability Fabric" (binding): source, semantic,
    // reconstruction, visualization, simulation, evaluator, action,
    // verification — imported from @epoch/agent-protocol, so this asserts
    // both the import and the architecture in one place.
    expect([...CAPABILITY_FABRIC_CATEGORIES]).toEqual([
      'source',
      'semantic',
      'reconstruction',
      'visualization',
      'simulation',
      'evaluator',
      'action',
      'verification',
    ]);
    expect(CapabilityCategorySchema.options).toEqual([...CAPABILITY_FABRIC_CATEGORIES]);
  });

  it('the lifecycle vocabulary is registered -> deprecated -> retired', () => {
    expect([...CAPABILITY_LIFECYCLE_STATES]).toEqual(['registered', 'deprecated', 'retired']);
  });

  it('the transition table is forward-only with retired terminal', () => {
    expect(CAPABILITY_LIFECYCLE_TRANSITIONS).toEqual({
      registered: ['deprecated', 'retired'],
      deprecated: ['retired'],
      retired: [],
    });
  });

  it('the origin vocabulary matches the architecture source classes', () => {
    expect([...CAPABILITY_ORIGINS]).toEqual([
      'first-party',
      'community',
      'external-software',
      'provisional-document-derived',
    ]);
  });

  it('version constants are pinned', () => {
    expect(CAPABILITY_REGISTRY_CONTRACT_VERSION).toBe('1.0.0');
    expect(CAPABILITY_MANIFEST_VERSION).toBe(1);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = CAPABILITY_REGISTRY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of CAPABILITY_REGISTRY_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });
});
