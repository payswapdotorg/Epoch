// Positive tests: the material tenancy behaviors — hierarchy round-trips,
// membership/path/tenant resolution, digest-checked admission, snapshot
// determinism, and full-depth hierarchy construction across all seven
// kinds.
import { describe, expect, it } from 'vitest';
import {
  computeTenancyNodeDigest,
  parseTenancyNodeRecord,
  sealTenancyNode,
  TenancyHierarchy,
} from '../src/index';
import {
  evidenceNode,
  fixtureHierarchy,
  platformNode,
  projectNode,
  scenarioNode,
  seal,
  tenantNode,
  workspaceNode,
  worldNode,
} from './helpers';

describe('hierarchy construction (positive)', () => {
  it('admits the full Platform -> ... -> Evidence chain across all seven kinds', () => {
    const hierarchy = fixtureHierarchy();
    expect(hierarchy.size).toBe(8);
    expect(hierarchy.platform.node.nodeId).toBe('platform:epoch');
  });

  it('admission returns the stored record with its verified content address', () => {
    const hierarchy = new TenancyHierarchy();
    hierarchy.createNode(seal(platformNode()));
    const result = hierarchy.createNode(seal(tenantNode()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.node.nodeId).toBe('tenant:acme');
    expect(result.value.nodeDigest).toBe(computeTenancyNodeDigest(result.value.node));
  });

  it('records round-trip through parse (digest verified)', () => {
    const hierarchy = fixtureHierarchy();
    const record = hierarchy.getNode('project:bridge-12');
    expect(record.ok).toBe(true);
    if (!record.ok) return;
    const parsed = parseTenancyNodeRecord(record.value);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual(record.value);
  });
});

describe('membership + path resolution (positive)', () => {
  it('pathToRoot returns the root-first containment chain', () => {
    const hierarchy = fixtureHierarchy();
    const path = hierarchy.pathToRoot('evidence:bridge-12-report');
    expect(path.ok).toBe(true);
    if (!path.ok) return;
    expect(path.value.map((record) => record.node.nodeId)).toEqual([
      'platform:epoch',
      'tenant:acme',
      'workspace:acme-eng',
      'project:bridge-12',
      'evidence:bridge-12-report',
    ]);
  });

  it('tenantOf resolves the owning tenant (a tenant owns itself; platform is null)', () => {
    const hierarchy = fixtureHierarchy();
    expect(hierarchy.tenantOf('tenant:acme')).toEqual({ ok: true, value: 'tenant:acme' });
    expect(hierarchy.tenantOf('workspace:acme-eng')).toEqual({ ok: true, value: 'tenant:acme' });
    expect(hierarchy.tenantOf('world:bridge-12-model')).toEqual({ ok: true, value: 'tenant:acme' });
    expect(hierarchy.tenantOf('platform:epoch')).toEqual({ ok: true, value: null });
  });

  it('isWithin answers containment for every scope level (membership resolution)', () => {
    const hierarchy = fixtureHierarchy();
    expect(hierarchy.isWithin('scenario:bridge-12-load-case', 'platform:epoch')).toEqual({
      ok: true,
      value: true,
    });
    expect(hierarchy.isWithin('scenario:bridge-12-load-case', 'tenant:acme')).toEqual({
      ok: true,
      value: true,
    });
    expect(hierarchy.isWithin('scenario:bridge-12-load-case', 'workspace:acme-eng')).toEqual({
      ok: true,
      value: true,
    });
    expect(hierarchy.isWithin('scenario:bridge-12-load-case', 'project:bridge-12')).toEqual({
      ok: true,
      value: true,
    });
    // A scope contains itself.
    expect(hierarchy.isWithin('tenant:acme', 'tenant:acme')).toEqual({ ok: true, value: true });
    // Siblings and ancestors do not contain it.
    expect(hierarchy.isWithin('tenant:acme', 'tenant:globex')).toEqual({ ok: true, value: false });
    expect(hierarchy.isWithin('platform:epoch', 'tenant:acme')).toEqual({
      ok: true,
      value: false,
    });
  });

  it('childrenOf lists direct children sorted by node id', () => {
    const hierarchy = fixtureHierarchy();
    const children = hierarchy.childrenOf('project:bridge-12');
    expect(children.ok).toBe(true);
    if (!children.ok) return;
    expect(children.value.map((record) => record.node.nodeId)).toEqual([
      'evidence:bridge-12-report',
      'scenario:bridge-12-load-case',
      'world:bridge-12-model',
    ]);
  });
});

describe('snapshot determinism + round-trips (positive)', () => {
  it('snapshots list records sorted by node id (no insertion-order leaks)', () => {
    const hierarchy = fixtureHierarchy();
    const snapshot = hierarchy.snapshot();
    expect(snapshot.records.map((record) => record.node.nodeId)).toEqual([
      'evidence:bridge-12-report',
      'platform:epoch',
      'project:bridge-12',
      'scenario:bridge-12-load-case',
      'tenant:acme',
      'tenant:globex',
      'workspace:acme-eng',
      'world:bridge-12-model',
    ]);
  });

  it('creation order never leaks: a different valid insertion order emits an identical snapshot', () => {
    const reference = fixtureHierarchy();
    const alternative = new TenancyHierarchy();
    // A different topological order: siblings admitted in reverse, world/
    // scenario/evidence in a different sequence — same nodes, same tree.
    const order = [
      platformNode(),
      tenantNode({ nodeId: 'tenant:globex', displayName: 'Globex Industries' }),
      tenantNode(),
      workspaceNode(),
      projectNode(),
      evidenceNode(),
      scenarioNode(),
      worldNode(),
    ];
    for (const node of order) {
      const admitted = alternative.createNode(seal(node));
      expect(admitted.ok, String(node.nodeId)).toBe(true);
    }
    expect(alternative.size).toBe(reference.size);
    expect(JSON.stringify(alternative.snapshot())).toBe(
      JSON.stringify(reference.snapshot()),
    );
  });

  it('snapshots round-trip through TenancyHierarchy.fromSnapshot', () => {
    const hierarchy = fixtureHierarchy();
    const adopted = TenancyHierarchy.fromSnapshot(hierarchy.snapshot());
    expect(adopted.ok).toBe(true);
    if (!adopted.ok) return;
    expect(JSON.stringify(adopted.value.snapshot())).toBe(
      JSON.stringify(hierarchy.snapshot()),
    );
    expect(adopted.value.tenantOf('world:bridge-12-model')).toEqual({
      ok: true,
      value: 'tenant:acme',
    });
  });
});

describe('sealing helpers (positive)', () => {
  it('sealTenancyNode is total: valid nodes seal, key order never matters', () => {
    const sealed = sealTenancyNode(tenantNode());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    // Equivalent content in a different key order digests identically.
    const reordered = sealTenancyNode({
      parentId: 'platform:epoch',
      displayName: 'Acme Engineering',
      kind: 'tenant',
      nodeId: 'tenant:acme',
      schemaVersion: 1,
    });
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;
    expect(sealed.value.digest).toBe(reordered.value.digest);
  });
});

describe('reparenting within one tenant (positive)', () => {
  it('moves a world under another project of the same workspace (same tenant)', () => {
    const hierarchy = fixtureHierarchy();
    const admitted = hierarchy.createNode(
      seal(projectNode({ nodeId: 'project:bridge-13', displayName: 'Bridge 13 Design' })),
    );
    expect(admitted.ok).toBe(true);
    const moved = hierarchy.moveNode({
      nodeId: 'world:bridge-12-model',
      newParentId: 'project:bridge-13',
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.node.parentId).toBe('project:bridge-13');
    // The moved record is re-sealed: its digest matches its new content.
    expect(moved.value.nodeDigest).toBe(computeTenancyNodeDigest(moved.value.node));
    expect(hierarchy.tenantOf('world:bridge-12-model')).toEqual({
      ok: true,
      value: 'tenant:acme',
    });
  });
});
