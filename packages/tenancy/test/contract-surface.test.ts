// Published-surface integrity: the exported vocabularies, the containment
// table, and the id patterns are exactly the architecture-pinned sets
// (architecture.md, "Tenancy": Platform -> Tenant -> Workspace -> Project
// -> World/Scenario/Evidence).
import { describe, expect, it } from 'vitest';
import {
  TENANCY_CONTRACT_VERSION,
  TENANCY_NODE_ID_PATTERN,
  TENANCY_NODE_KINDS,
  TENANCY_PARENT_KINDS,
  TENANCY_RECORD_VERSION,
  TENANCY_SCHEMA_SURFACE,
  TenancyNodeKindSchema,
} from '../src/index';

describe('tenancy published surface', () => {
  it('the node-kind vocabulary is EXACTLY the architecture hierarchy', () => {
    expect([...TENANCY_NODE_KINDS]).toEqual([
      'platform',
      'tenant',
      'workspace',
      'project',
      'world',
      'scenario',
      'evidence',
    ]);
    expect(TenancyNodeKindSchema.options).toEqual([...TENANCY_NODE_KINDS]);
  });

  it('the containment table matches Platform -> Tenant -> Workspace -> Project -> World/Scenario/Evidence', () => {
    expect(TENANCY_PARENT_KINDS).toEqual({
      platform: [],
      tenant: ['platform'],
      workspace: ['tenant'],
      project: ['workspace'],
      world: ['project'],
      scenario: ['project'],
      evidence: ['project'],
    });
  });

  it('node ids are kind-prefixed opaque slugs (no embedded objects)', () => {
    expect('tenant:acme').toMatch(TENANCY_NODE_ID_PATTERN);
    expect('workspace:acme-eng').toMatch(TENANCY_NODE_ID_PATTERN);
    expect('project:bridge-12').toMatch(TENANCY_NODE_ID_PATTERN);
    expect('Tenant:ACME').not.toMatch(TENANCY_NODE_ID_PATTERN);
    expect('tenant:').not.toMatch(TENANCY_NODE_ID_PATTERN);
    expect('tenant:-leading-dash').not.toMatch(TENANCY_NODE_ID_PATTERN);
    expect('acme').not.toMatch(TENANCY_NODE_ID_PATTERN);
    expect('tenant:a'.repeat(64)).not.toMatch(TENANCY_NODE_ID_PATTERN);
  });

  it('version constants are pinned', () => {
    expect(TENANCY_CONTRACT_VERSION).toBe('1.0.0');
    expect(TENANCY_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = TENANCY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of TENANCY_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });
});
