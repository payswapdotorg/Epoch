// Positive tests: the frozen hierarchy round-trips end-to-end — typed
// creation of every kind, ancestry/membership resolution, tenant
// isolation checks, deterministic ordering, snapshot/restore
// round-trips, and content-addressed sealing.
import { describe, expect, it } from 'vitest';
import {
  TenancyDirectory,
  parseSealedTenancyNode,
  parseTenancyNode,
  parseTenancySnapshot,
  sealTenancyNode,
} from '../src/index';
import {
  EVIDENCE_A1_ID,
  PLATFORM_ID,
  PROJ_A1_ID,
  PROJ_B1_ID,
  SCENARIO_A1_ID,
  TENANT_A_ID,
  TENANT_B_ID,
  WS_A1_ID,
  WS_A2_ID,
  WS_B1_ID,
  WORLD_A1_ID,
  canonicalDirectory,
  canonicalNodes,
  canonicalSnapshot,
  seal,
  worldNode,
} from './helpers';

describe('hierarchy round-trip (positive)', () => {
  it('creates one node of every kind through the typed pipeline', () => {
    const directory = canonicalDirectory();
    expect(directory.size).toBe(11);
    const kindsOf = (id: string): string => {
      const node = directory.get(id);
      expect(node.ok, id).toBe(true);
      if (!node.ok) throw new Error(`fixture node missing: ${id}`);
      return node.value.kind;
    };
    expect(kindsOf(PLATFORM_ID)).toBe('platform');
    expect(kindsOf(TENANT_A_ID)).toBe('tenant');
    expect(kindsOf(WS_A1_ID)).toBe('workspace');
    expect(kindsOf(PROJ_A1_ID)).toBe('project');
    expect(kindsOf(WORLD_A1_ID)).toBe('world');
    expect(kindsOf(SCENARIO_A1_ID)).toBe('scenario');
    expect(kindsOf(EVIDENCE_A1_ID)).toBe('evidence');
  });

  it('nodes reference parents by opaque id — no embedded objects', () => {
    const directory = canonicalDirectory();
    const workspace = directory.get(WS_A1_ID);
    if (!workspace.ok) throw new Error('fixture workspace missing');
    // The workspace references its tenant ONLY by opaque typed id.
    expect(workspace.value.parentId).toBe(TENANT_A_ID);
    expect(Object.keys(workspace.value)).not.toContain('tenant');
    expect(JSON.stringify(workspace.value)).not.toContain('"displayName":"Acme');
  });

  it('ancestryOf walks node-first to the platform root', () => {
    const directory = canonicalDirectory();
    const chain = directory.ancestryOf(WORLD_A1_ID);
    expect(chain.ok).toBe(true);
    if (!chain.ok) return;
    expect(chain.value).toEqual([
      WORLD_A1_ID,
      PROJ_A1_ID,
      WS_A1_ID,
      TENANT_A_ID,
      PLATFORM_ID,
    ]);
  });

  it('ancestryOf of the platform root is the root alone', () => {
    const directory = canonicalDirectory();
    const chain = directory.ancestryOf(PLATFORM_ID);
    expect(chain.ok && chain.value).toEqual([PLATFORM_ID]);
  });
});

describe('membership resolution (positive)', () => {
  it('resolveMembership of a world node carries tenant, workspace, and project', () => {
    const directory = canonicalDirectory();
    const membership = directory.resolveMembership(WORLD_A1_ID);
    expect(membership.ok).toBe(true);
    if (!membership.ok) return;
    expect(membership.value).toEqual({
      nodeId: WORLD_A1_ID,
      kind: 'world',
      platformId: PLATFORM_ID,
      tenantId: TENANT_A_ID,
      workspaceId: WS_A1_ID,
      projectId: PROJ_A1_ID,
    });
  });

  it('resolveMembership of a tenant node carries itself, no workspace/project', () => {
    const directory = canonicalDirectory();
    const membership = directory.resolveMembership(TENANT_A_ID);
    expect(membership.ok).toBe(true);
    if (!membership.ok) return;
    expect(membership.value).toEqual({
      nodeId: TENANT_A_ID,
      kind: 'tenant',
      platformId: PLATFORM_ID,
      tenantId: TENANT_A_ID,
    });
  });

  it('resolveMembership of the platform root carries only the platform', () => {
    const directory = canonicalDirectory();
    const membership = directory.resolveMembership(PLATFORM_ID);
    expect(membership.ok).toBe(true);
    if (!membership.ok) return;
    expect(membership.value).toEqual({
      nodeId: PLATFORM_ID,
      kind: 'platform',
      platformId: PLATFORM_ID,
    });
  });

  it('tenantOf resolves the containing tenant for every node kind', () => {
    const directory = canonicalDirectory();
    expect(directory.tenantOf(WORLD_A1_ID)).toBe(TENANT_A_ID);
    expect(directory.tenantOf(EVIDENCE_A1_ID)).toBe(TENANT_A_ID);
    expect(directory.tenantOf(PROJ_B1_ID)).toBe(TENANT_B_ID);
    expect(directory.tenantOf(TENANT_B_ID)).toBe(TENANT_B_ID);
    expect(directory.tenantOf(PLATFORM_ID)).toBeUndefined();
  });

  it('assertSameTenant succeeds for same-tenant nodes and reports the tenant', () => {
    const directory = canonicalDirectory();
    const result = directory.assertSameTenant(WORLD_A1_ID, WS_A2_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tenantId).toBe(TENANT_A_ID);
  });

  it('contains / assertAncestorOf resolve subtree membership', () => {
    const directory = canonicalDirectory();
    expect(directory.contains(WS_A1_ID, WORLD_A1_ID)).toBe(true);
    expect(directory.contains(TENANT_A_ID, PROJ_B1_ID)).toBe(false);
    const within = directory.assertAncestorOf(WS_A1_ID, SCENARIO_A1_ID);
    expect(within.ok && within.value.projectId).toBe(PROJ_A1_ID);
  });
});

describe('deterministic ordering (positive)', () => {
  it('listing is sorted by id regardless of creation order', () => {
    const forward = canonicalDirectory();
    // Build the same node set in REVERSE creation order.
    const reverse = new TenancyDirectory();
    reverse.createPlatform({ id: PLATFORM_ID });
    const pairs: Array<[string, string]> = [
      [EVIDENCE_A1_ID, PROJ_A1_ID],
      [SCENARIO_A1_ID, PROJ_A1_ID],
      [WORLD_A1_ID, PROJ_A1_ID],
      [PROJ_B1_ID, WS_B1_ID],
      [PROJ_A1_ID, WS_A1_ID],
      [WS_B1_ID, TENANT_B_ID],
      [WS_A2_ID, TENANT_A_ID],
      [WS_A1_ID, TENANT_A_ID],
      [TENANT_B_ID, PLATFORM_ID],
      [TENANT_A_ID, PLATFORM_ID],
    ];
    for (const [id, parentId] of pairs.reverse()) {
      expect(reverse.createNode({ id, parentId }).ok).toBe(true);
    }
    expect(reverse.list().map((node) => node.id)).toEqual(
      forward.list().map((node) => node.id),
    );
  });

  it('snapshot() is byte-identical across creation orders (no insertion-order leaks)', () => {
    const forward = canonicalDirectory();
    // Build the same node set in a DIFFERENT valid creation order
    // (parent-exists still honored: swapped siblings).
    const swapped = new TenancyDirectory();
    swapped.createPlatform({ id: PLATFORM_ID, displayName: 'Epoch Platform' });
    const pairs: Array<[string, string, string?]> = [
      [TENANT_B_ID, PLATFORM_ID, 'Globex'],
      [TENANT_A_ID, PLATFORM_ID, 'Acme Engineering'],
      [WS_A2_ID, TENANT_A_ID],
      [WS_A1_ID, TENANT_A_ID],
      [WS_B1_ID, TENANT_B_ID],
      [PROJ_B1_ID, WS_B1_ID],
      [PROJ_A1_ID, WS_A1_ID],
      [EVIDENCE_A1_ID, PROJ_A1_ID],
      [SCENARIO_A1_ID, PROJ_A1_ID],
      [WORLD_A1_ID, PROJ_A1_ID],
    ];
    for (const [id, parentId, displayName] of pairs) {
      expect(swapped.createNode({ id, parentId, displayName }).ok).toBe(true);
    }
    expect(JSON.stringify(swapped.snapshot())).toBe(JSON.stringify(forward.snapshot()));
  });

  it('childrenOf returns children sorted by id', () => {
    const directory = canonicalDirectory();
    const children = directory.childrenOf(PROJ_A1_ID);
    expect(children.ok && children.value.map((node) => node.id)).toEqual([
      EVIDENCE_A1_ID,
      SCENARIO_A1_ID,
      WORLD_A1_ID,
    ]);
  });

  it('list(kind) filters deterministically', () => {
    const directory = canonicalDirectory();
    expect(directory.list({ kind: 'tenant' }).map((node) => node.id)).toEqual([
      TENANT_A_ID,
      TENANT_B_ID,
    ]);
  });
});

describe('snapshot/restore round-trip (positive)', () => {
  it('restore(snapshot) rebuilds an equivalent directory', () => {
    const original = canonicalDirectory();
    const restored = TenancyDirectory.restore(canonicalSnapshot());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.size).toBe(original.size);
    expect(JSON.stringify(restored.value.snapshot())).toBe(
      JSON.stringify(original.snapshot()),
    );
  });

  it('snapshot -> restore -> snapshot is byte-stable', () => {
    const restored = TenancyDirectory.restore(canonicalSnapshot());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const again = TenancyDirectory.restore(restored.value.snapshot());
    expect(again.ok && JSON.stringify(again.value.snapshot())).toBe(
      JSON.stringify(restored.value.snapshot()),
    );
  });

  it('restoreSealed accepts correctly sealed nodes', () => {
    const sealed = canonicalNodes().map((node) => seal(node));
    const restored = TenancyDirectory.restoreSealed(sealed);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.size).toBe(canonicalNodes().length);
  });

  it('parse surfaces round-trip every node kind', () => {
    for (const node of canonicalNodes()) {
      expect(parseTenancyNode(node).ok, String(node['id'])).toBe(true);
      expect(parseSealedTenancyNode(seal(node)).ok, String(node['id'])).toBe(true);
    }
    expect(parseTenancySnapshot(canonicalSnapshot()).ok).toBe(true);
  });
});

describe('digest discipline (positive)', () => {
  it('sealTenancyNode produces stable, key-order-independent digests', () => {
    const node = canonicalNodes()[5]!; // a workspace node
    const reordered = {
      parentId: node['parentId'],
      id: node['id'],
      kind: node['kind'],
      schemaVersion: node['schemaVersion'],
    };
    const first = sealTenancyNode(node);
    const second = sealTenancyNode(reordered);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.digest).toBe(second.value.digest);
  });

  it('parseSealedTenancyNode accepts a correctly sealed record', () => {
    const sealed = seal(worldNode());
    const parsed = parseSealedTenancyNode(sealed);
    expect(parsed.ok && parsed.value.node.id).toBe(WORLD_A1_ID);
  });
});
