// Negative tests: every boundary the tenancy directory must reject —
// named for the W009 acceptance criteria. Every rejection is a TYPED
// error value (never a throw, never a silent accept):
//   unknown-parent, cycle, hierarchy-escape (incl. cross-workspace
//   escape and hierarchy traversal without membership),
//   cross-tenant-reference (tenant isolation), unknown-node,
//   duplicate-node, validation (malformed ids, vendor fields), and
//   digest-mismatch (tamper detection).
import { describe, expect, it } from 'vitest';
import type { TenancyError, TenancyResult } from '../src/index';
import {
  TenancyDirectory,
  parseSealedTenancyNode,
  parseTenancyNode,
  parseTenancySnapshot,
  sealTenancyNode,
} from '../src/index';
import {
  PLATFORM_ID,
  PROJ_A1_ID,
  PROJ_B1_ID,
  TENANT_A_ID,
  TENANT_B_ID,
  WS_A1_ID,
  WS_A2_ID,
  WS_B1_ID,
  WORLD_A1_ID,
  platformNode,
  sealedWithForeignDigest,
  seal,
  tenantNode,
  workspaceNode,
  worldNode,
} from './helpers';

/** Unwrap a failing result (asserts the failure for the test reader). */
function failureOf<T>(result: TenancyResult<T>): TenancyError {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a failure result');
  return result.error;
}

describe('unknown-parent (negative)', () => {
  it('rejects creating a node under an absent parent', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    const error = failureOf(
      directory.createNode({ id: WS_A1_ID, parentId: 'tenant:ghost' }),
    );
    expect(error.code).toBe('unknown-parent');
    if (error.code !== 'unknown-parent') return;
    expect(error.parentId).toBe('tenant:ghost');
    expect(error.nodeId).toBe(WS_A1_ID);
  });

  it('restore rejects a snapshot with a dangling parent reference', () => {
    const dangling = [
      platformNode(),
      tenantNode(),
      workspaceNode({ parentId: 'tenant:ghost' }),
    ];
    const error = failureOf(
      TenancyDirectory.restore({ schemaVersion: 1, nodes: dangling }),
    );
    expect(error.code).toBe('unknown-parent');
  });
});

describe('cycle (negative)', () => {
  it('restore rejects a parent chain that loops', () => {
    // a -> b, b -> a: both parents "exist", no parentless root in the loop.
    const cyclic = [
      platformNode(),
      { ...workspaceNode(), id: WS_A1_ID, parentId: WS_A2_ID },
      { ...workspaceNode(), id: WS_A2_ID, parentId: WS_A1_ID },
      tenantNode({ id: TENANT_A_ID, parentId: PLATFORM_ID }),
    ];
    const error = failureOf(TenancyDirectory.restore({ schemaVersion: 1, nodes: cyclic }));
    expect(error.code).toBe('cycle');
    if (error.code !== 'cycle') return;
    expect(error.cycle[0]).toBe(error.cycle[error.cycle.length - 1]);
    expect(error.cycle).toContain(WS_A1_ID);
    expect(error.cycle).toContain(WS_A2_ID);
  });

  it('a rejected cyclic snapshot leaves no partial state (all-or-nothing)', () => {
    const cyclic = [
      platformNode(),
      { ...workspaceNode(), id: WS_A1_ID, parentId: WS_A2_ID },
      { ...workspaceNode(), id: WS_A2_ID, parentId: WS_A1_ID },
    ];
    const result = TenancyDirectory.restore({ schemaVersion: 1, nodes: cyclic });
    expect(result.ok).toBe(false);
    // Nothing to observe on a failed construction; the typed error is
    // the only artifact. (Admission is static + total.)
    expect(failureOf(result).code).toBe('cycle');
  });

  it('restoreSealed rejects cyclic sealed nodes with the typed cycle error', () => {
    const cyclic = [
      seal(platformNode()),
      seal({ ...workspaceNode(), id: WS_A1_ID, parentId: WS_A2_ID }),
      seal({ ...workspaceNode(), id: WS_A2_ID, parentId: WS_A1_ID }),
    ];
    expect(failureOf(TenancyDirectory.restoreSealed(cyclic)).code).toBe('cycle');
  });
});

describe('hierarchy-escape (negative)', () => {
  it('rejects a workspace attached directly to the platform (level skip)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    const error = failureOf(directory.createNode({ id: WS_A1_ID, parentId: PLATFORM_ID }));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a project attached directly to a tenant (level skip)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    const error = failureOf(directory.createNode({ id: PROJ_A1_ID, parentId: TENANT_A_ID }));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a world attached directly to a workspace (level skip)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: WS_A1_ID, parentId: TENANT_A_ID });
    const error = failureOf(directory.createNode({ id: WORLD_A1_ID, parentId: WS_A1_ID }));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a second platform root (single-root rule)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    const error = failureOf(directory.createPlatform({ id: 'platform:other' }));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a platform node reaching createNode (the root has no parent)', () => {
    const directory = new TenancyDirectory();
    const error = failureOf(
      directory.createNode({ id: 'platform:rogue', parentId: PLATFORM_ID }),
    );
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects a cross-workspace escape (assertAncestorOf outside the container)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: TENANT_B_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: WS_A1_ID, parentId: TENANT_A_ID });
    directory.createNode({ id: WS_B1_ID, parentId: TENANT_B_ID });
    directory.createNode({ id: PROJ_A1_ID, parentId: WS_A1_ID });
    directory.createNode({ id: PROJ_B1_ID, parentId: WS_B1_ID });
    // A project of workspace A claimed to be inside workspace B: escape.
    const error = failureOf(directory.assertAncestorOf(WS_B1_ID, PROJ_A1_ID));
    expect(error.code).toBe('hierarchy-escape');
  });

  it('rejects hierarchy traversal without membership (node outside the claimed container)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: WS_A1_ID, parentId: TENANT_A_ID });
    directory.createNode({ id: WS_A2_ID, parentId: TENANT_A_ID });
    directory.createNode({ id: PROJ_A1_ID, parentId: WS_A1_ID });
    // A project of workspace acme-eng is NOT within acme-field.
    const error = failureOf(directory.assertAncestorOf(WS_A2_ID, PROJ_A1_ID));
    expect(error.code).toBe('hierarchy-escape');
    if (error.code !== 'hierarchy-escape') return;
    expect(error.message).toContain('hierarchy traversal without membership');
  });

  it('contains fails closed for unknown ids (no membership leak)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    expect(directory.contains(WS_A1_ID, 'world:ghost')).toBe(false);
    expect(directory.contains('tenant:ghost', WS_A1_ID)).toBe(false);
  });
});

describe('cross-tenant-reference (negative — tenant isolation, R12)', () => {
  it('rejects a reference between nodes of different tenants', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: TENANT_B_ID, parentId: PLATFORM_ID });
    directory.createNode({ id: WS_A1_ID, parentId: TENANT_A_ID });
    directory.createNode({ id: WS_B1_ID, parentId: TENANT_B_ID });
    const error = failureOf(directory.assertSameTenant(WS_A1_ID, WS_B1_ID));
    expect(error.code).toBe('cross-tenant-reference');
    if (error.code !== 'cross-tenant-reference') return;
    expect(error.firstTenant).toBe(TENANT_A_ID);
    expect(error.secondTenant).toBe(TENANT_B_ID);
  });

  it('fails closed when a node is not tenant-scoped (the platform root)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    const error = failureOf(directory.assertSameTenant(PLATFORM_ID, TENANT_A_ID));
    expect(error.code).toBe('cross-tenant-reference');
  });
});

describe('unknown-node / duplicate-node (negative)', () => {
  it('get rejects an unknown node id', () => {
    const directory = new TenancyDirectory();
    expect(failureOf(directory.get('workspace:ghost')).code).toBe('unknown-node');
  });

  it('ancestryOf/resolveMembership/childrenOf reject unknown ids', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    expect(failureOf(directory.ancestryOf('world:ghost')).code).toBe('unknown-node');
    expect(failureOf(directory.resolveMembership('world:ghost')).code).toBe('unknown-node');
    expect(failureOf(directory.childrenOf('world:ghost')).code).toBe('unknown-node');
  });

  it('createNode rejects a duplicate node id', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID });
    const error = failureOf(directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID }));
    expect(error.code).toBe('duplicate-node');
  });

  it('restore rejects a snapshot with duplicate ids', () => {
    const duplicated = [platformNode(), tenantNode(), tenantNode()];
    expect(
      failureOf(TenancyDirectory.restore({ schemaVersion: 1, nodes: duplicated })).code,
    ).toBe('duplicate-node');
  });
});

describe('malformed documents (negative — validation)', () => {
  it('rejects malformed ids (wrong prefix, wrong pattern, empty)', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: PLATFORM_ID });
    for (const badId of [
      '',
      'tenant',
      'tenant:',
      'Tenant:Acme',
      'tenant:Acme',
      'tenant:acme extra',
      'tenant:a%b',
      `tenant:${'x'.repeat(64)}`,
      'cloud:acme',
    ]) {
      const result = directory.createNode({ id: badId, parentId: PLATFORM_ID });
      const error = failureOf(result);
      expect(error.code, JSON.stringify(badId)).toBe('validation');
    }
  });

  it('rejects an id whose prefix does not match the encoded kind', () => {
    // The id itself is a well-formed node id, but the prefix-kind
    // mismatch is a refinement violation — typed validation issue.
    const mismatched = tenantNode({ id: WS_A1_ID }); // workspace: id, kind tenant
    const error = failureOf(parseTenancyNode(mismatched));
    expect(error.code).toBe('validation');
  });

  it('rejects vendor/provider fields on node documents (strict objects)', () => {
    const withVendor = workspaceNode({ provider: 'acme-cloud', region: 'eu-west' });
    const error = failureOf(parseTenancyNode(withVendor));
    expect(error.code).toBe('validation');
    if (error.code !== 'validation') return;
    expect(error.issues.some((issue) => issue.path === 'provider')).toBe(true);
  });

  it('rejects an unknown kind and version skew', () => {
    expect(failureOf(parseTenancyNode(workspaceNode({ kind: 'region' }))).code).toBe(
      'validation',
    );
    expect(
      failureOf(parseTenancyNode(workspaceNode({ schemaVersion: 2 }))).code,
    ).toBe('validation');
    expect(
      failureOf(parseTenancySnapshot({ schemaVersion: 2, nodes: [] })).code,
    ).toBe('validation');
  });

  it('rejects a non-platform node with a null parent', () => {
    const orphan = workspaceNode({ parentId: null });
    expect(failureOf(parseTenancyNode(orphan)).code).toBe('validation');
  });

  it('rejects a platform node with a parent', () => {
    const rooted = platformNode({ parentId: PLATFORM_ID });
    expect(failureOf(parseTenancyNode(rooted)).code).toBe('validation');
  });
});

describe('digest-mismatch (negative — tamper detection)', () => {
  it('parseSealedTenancyNode rejects a node whose claimed digest does not match its content', () => {
    const tampered = sealedWithForeignDigest(worldNode());
    const error = failureOf(parseSealedTenancyNode(tampered));
    expect(error.code).toBe('digest-mismatch');
    if (error.code !== 'digest-mismatch') return;
    expect(error.expected).not.toBe(error.encountered);
  });

  it('restoreSealed rejects a tampered sealed node before admission', () => {
    const tampered = [
      seal(platformNode()),
      seal(tenantNode()),
      sealedWithForeignDigest(workspaceNode()),
    ];
    const error = failureOf(TenancyDirectory.restoreSealed(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('sealTenancyNode rejects invalid nodes (total form)', () => {
    const result = sealTenancyNode(workspaceNode({ id: 'nope' }));
    expect(failureOf(result).code).toBe('validation');
  });

  it('restoreSealed rejects non-record entries (typed validation)', () => {
    expect(failureOf(TenancyDirectory.restoreSealed([{}])).code).toBe('validation');
    expect(failureOf(TenancyDirectory.restoreSealed(['x'])).code).toBe('validation');
  });
});
