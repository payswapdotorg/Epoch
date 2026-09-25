// Negative tests: every admission/reparenting/adoption class the tenancy
// hierarchy must reject — malformed ids, unknown parents, duplicates,
// containment-table violations (level skips), parentless non-platform
// nodes, second roots, parent-link cycles, cross-tenant moves, and
// tampered digests. Tenant isolation is a security boundary (R12).
import { describe, expect, it } from 'vitest';
import type { TenancyError, TenancyResult } from '../src/index';
import {
  computeTenancyNodeDigest,
  parseTenancyNodeRecord,
  parseTenancySnapshot,
  TenancyHierarchy,
} from '../src/index';
import {
  bogusSeal,
  fixtureHierarchy,
  platformNode,
  projectNode,
  seal,
  sealedWithForeignDigest,
  tenantNode,
  workspaceNode,
} from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: TenancyResult<T>): TenancyError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('malformed ids + vendor fields (negative — validation boundary)', () => {
  it('rejects a node whose id prefix does not match its kind', () => {
    const hierarchy = new TenancyHierarchy();
    hierarchy.createNode(seal(platformNode()));
    const error = failureOf(
      hierarchy.createNode(bogusSeal(workspaceNode({ nodeId: 'tenant:acme-eng', kind: 'workspace' }))),
    );
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'nodeId' || issue.path === '')).toBe(true);
  });

  it('rejects malformed ids outright (wrong case, missing prefix, overlong slug)', () => {
    const hierarchy = new TenancyHierarchy();
    for (const badId of ['Tenant:ACME', 'acme', 'tenant:', 'tenant:a'.repeat(64)]) {
      const error = failureOf(
        hierarchy.createNode(bogusSeal(tenantNode({ nodeId: badId }))),
      );
      expect(error.code, badId).toBe('validation');
    }
  });

  it('rejects unknown fields (strict objects — vendor metadata cannot enter)', () => {
    const hierarchy = new TenancyHierarchy();
    const error = failureOf(
      hierarchy.createNode(bogusSeal(platformNode({ region: 'eu-west-1' }))),
    );
    expect(error.code).toBe('validation');
  });
});

describe('unknown parent (negative)', () => {
  it('rejects a node whose parent id does not exist', () => {
    const hierarchy = new TenancyHierarchy();
    const error = failureOf(
      hierarchy.createNode(seal(tenantNode({ parentId: 'platform:ghost' }))),
    );
    expect(error.code).toBe('unknown-parent');
    if (error.code !== 'unknown-parent') return;
    expect(error.parentId).toBe('platform:ghost');
  });
});

describe('duplicate node (negative)', () => {
  it('rejects re-creating an existing node id', () => {
    const hierarchy = new TenancyHierarchy();
    hierarchy.createNode(seal(platformNode()));
    const error = failureOf(hierarchy.createNode(seal(platformNode())));
    expect(error.code).toBe('duplicate-node');
  });
});

describe('containment-table violations (negative — level discipline)', () => {
  it('rejects a project hanging directly off a tenant (level skip)', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.createNode(
        seal(projectNode({ nodeId: 'project:skip-level', parentId: 'tenant:acme' })),
      ),
    );
    expect(error.code).toBe('illegal-parent-kind');
    if (error.code !== 'illegal-parent-kind') return;
    expect(error.kind).toBe('project');
    expect(error.parentKind).toBe('tenant');
    expect(error.legalParentKinds).toEqual(['workspace']);
  });

  it('rejects a workspace under a workspace (sideways containment)', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.createNode(
        seal(workspaceNode({ nodeId: 'workspace:acme-eng-2', parentId: 'workspace:acme-eng' })),
      ),
    );
    expect(error.code).toBe('illegal-parent-kind');
  });

  it('rejects a scenario under a world (world/scenario/evidence are project-level siblings)', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.createNode(
        seal({
          schemaVersion: 1,
          nodeId: 'scenario:load-case-2',
          kind: 'scenario',
          displayName: 'Second load case',
          parentId: 'world:bridge-12-model',
        }),
      ),
    );
    expect(error.code).toBe('illegal-parent-kind');
  });
});

describe('hierarchy escape (negative — single-rooted platform tree)', () => {
  it('rejects a parentless non-platform node', () => {
    const hierarchy = new TenancyHierarchy();
    const error = failureOf(hierarchy.createNode(seal(tenantNode({ parentId: null }))));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a platform node that carries a parent', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.createNode(
        seal(platformNode({ nodeId: 'platform:other', parentId: 'tenant:acme' })),
      ),
    );
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a second platform root', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.createNode(seal(platformNode({ nodeId: 'platform:other' }))),
    );
    expect(error.code).toBe('hierarchy-escape');
  });

  it('fromSnapshot rejects a record set with no platform root', () => {
    const hierarchy = fixtureHierarchy();
    const snapshot = hierarchy.snapshot();
    const withoutPlatform = {
      ...snapshot,
      records: snapshot.records.filter((record) => record.node.kind !== 'platform'),
    };
    const error = failureOf(TenancyHierarchy.fromSnapshot(withoutPlatform));
    expect(error.code).toBe('hierarchy-escape');
  });
});

describe('parent-link cycles (negative — cycle prevention)', () => {
  it('fromSnapshot rejects a re-sealed workspace pointing at its own project (loop)', () => {
    const hierarchy = fixtureHierarchy();
    const snapshot = hierarchy.snapshot();
    // Tamper the workspace to point at its own project, then RE-SEAL the
    // record so the digest check passes and the CYCLE check is what fires
    // (the semantic layer, not the integrity layer).
    const records = snapshot.records.map((record) => {
      if (record.node.nodeId === 'workspace:acme-eng') {
        const node = { ...record.node, parentId: 'project:bridge-12' };
        return { schemaVersion: 1, node, nodeDigest: computeTenancyNodeDigest(node) };
      }
      return record;
    });
    const error = failureOf(TenancyHierarchy.fromSnapshot({ ...snapshot, records }));
    expect(error.code).toBe('cycle');
    if (error.code !== 'cycle') return;
    expect(error.cyclePath).toContain('workspace:acme-eng');
    expect(error.cyclePath).toContain('project:bridge-12');
  });

  it('fromSnapshot rejects a two-node parent loop with matching digests', () => {
    const looped = {
      schemaVersion: 1,
      records: [
        seal(platformNode()),
        seal(tenantNode({ parentId: 'tenant:globex' })),
        seal(tenantNode({ nodeId: 'tenant:globex', parentId: 'tenant:acme' })),
      ].map((registration) => ({
        schemaVersion: 1,
        node: registration.node,
        nodeDigest: registration.digest,
      })),
    };
    const error = failureOf(TenancyHierarchy.fromSnapshot(looped));
    expect(error.code).toBe('cycle');
    if (error.code !== 'cycle') return;
    expect(error.cyclePath.length).toBeGreaterThanOrEqual(2);
  });

  it('moveNode rejects reparenting a node under itself', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.moveNode({ nodeId: 'project:bridge-12', newParentId: 'project:bridge-12' }),
    );
    expect(error.code).toBe('cycle');
  });

  it('moveNode rejects reparenting a node under its own descendant', () => {
    const hierarchy = fixtureHierarchy();
    const error = failureOf(
      hierarchy.moveNode({ nodeId: 'workspace:acme-eng', newParentId: 'world:bridge-12-model' }),
    );
    expect(error.code).toBe('cycle');
    if (error.code !== 'cycle') return;
    expect(error.cyclePath).toContain('workspace:acme-eng');
    expect(error.cyclePath).toContain('world:bridge-12-model');
  });
});

describe('cross-tenant reference (negative — the tenant isolation boundary, R12)', () => {
  it('rejects moving a project into another tenant workspace', () => {
    const hierarchy = fixtureHierarchy();
    hierarchy.createNode(
      seal(workspaceNode({ nodeId: 'workspace:globex-eng', parentId: 'tenant:globex' })),
    );
    const error = failureOf(
      hierarchy.moveNode({ nodeId: 'project:bridge-12', newParentId: 'workspace:globex-eng' }),
    );
    expect(error.code).toBe('cross-tenant-reference');
    if (error.code !== 'cross-tenant-reference') return;
    expect(error.tenantOfNode).toBe('tenant:acme');
    expect(error.tenantOfNewParent).toBe('tenant:globex');
  });

  it('rejects moving a world to a project of another tenant', () => {
    const hierarchy = fixtureHierarchy();
    hierarchy.createNode(
      seal(workspaceNode({ nodeId: 'workspace:globex-eng', parentId: 'tenant:globex' })),
    );
    hierarchy.createNode(
      seal(projectNode({ nodeId: 'project:globex-1', parentId: 'workspace:globex-eng' })),
    );
    const error = failureOf(
      hierarchy.moveNode({ nodeId: 'world:bridge-12-model', newParentId: 'project:globex-1' }),
    );
    expect(error.code).toBe('cross-tenant-reference');
  });

  it('the rejected move leaves the hierarchy untouched (atomic rejection)', () => {
    const hierarchy = fixtureHierarchy();
    hierarchy.createNode(
      seal(workspaceNode({ nodeId: 'workspace:globex-eng', parentId: 'tenant:globex' })),
    );
    hierarchy.moveNode({ nodeId: 'project:bridge-12', newParentId: 'workspace:globex-eng' });
    const record = hierarchy.getNode('project:bridge-12');
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    expect(record.value.node.parentId).toBe('workspace:acme-eng');
  });
});

describe('unknown node (negative)', () => {
  it('getNode/tenantOf/pathToRoot/childrenOf reject unknown ids', () => {
    const hierarchy = fixtureHierarchy();
    const results: TenancyResult<unknown>[] = [
      hierarchy.getNode('tenant:ghost'),
      hierarchy.tenantOf('tenant:ghost'),
      hierarchy.pathToRoot('tenant:ghost'),
      hierarchy.childrenOf('tenant:ghost'),
      hierarchy.isWithin('tenant:ghost', 'platform:epoch'),
    ];
    for (const result of results) {
      expect(failureOf(result).code).toBe('unknown-node');
    }
  });

  it('moveNode rejects unknown node and unknown new parent', () => {
    const hierarchy = fixtureHierarchy();
    expect(
      failureOf(hierarchy.moveNode({ nodeId: 'tenant:ghost', newParentId: 'tenant:acme' })).code,
    ).toBe('unknown-node');
    expect(
      failureOf(hierarchy.moveNode({ nodeId: 'tenant:acme', newParentId: 'tenant:ghost' })).code,
    ).toBe('unknown-parent');
  });
});

describe('tampered digests (negative — integrity boundary)', () => {
  it('createNode rejects a node whose claimed digest does not match its content', () => {
    const hierarchy = new TenancyHierarchy();
    const error = failureOf(
      hierarchy.createNode(sealedWithForeignDigest(platformNode())),
    );
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.expected).not.toBe(error.encountered);
  });

  it('a tampered registration never enters the hierarchy', () => {
    const hierarchy = new TenancyHierarchy();
    hierarchy.createNode(sealedWithForeignDigest(platformNode()));
    expect(hierarchy.size).toBe(0);
  });

  it('parseTenancyNodeRecord rejects a tampered record digest', () => {
    const hierarchy = fixtureHierarchy();
    const record = hierarchy.getNode('tenant:acme');
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    const tampered = { ...record.value, nodeDigest: 'b'.repeat(64) };
    const error = failureOf(parseTenancyNodeRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('parseTenancySnapshot rejects a tampered record inside a snapshot', () => {
    const hierarchy = fixtureHierarchy();
    const snapshot = hierarchy.snapshot();
    const tampered = {
      ...snapshot,
      records: snapshot.records.map((record) =>
        record.node.nodeId === 'tenant:acme' ? { ...record, nodeDigest: 'c'.repeat(64) } : record,
      ),
    };
    const error = failureOf(parseTenancySnapshot(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('fromSnapshot rejects a snapshot whose records fail digest verification', () => {
    const hierarchy = fixtureHierarchy();
    const snapshot = hierarchy.snapshot();
    const tampered = {
      ...snapshot,
      records: snapshot.records.map((record) =>
        record.node.nodeId === 'workspace:acme-eng'
          ? { ...record, node: { ...record.node, displayName: 'Silently Renamed' } }
          : record,
      ),
    };
    const error = failureOf(TenancyHierarchy.fromSnapshot(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});
