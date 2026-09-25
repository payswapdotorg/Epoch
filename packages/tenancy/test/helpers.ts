// Shared fixtures for the tenancy tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern).
import { TenancyDirectory, computeTenancyNodeDigest } from '../src/index';
import type { SealedTenancyNode, TenancyNode, TenancySnapshot } from '../src/index';

/** The canonical example hierarchy (one of every kind). */
export const PLATFORM_ID = 'platform:epoch';
export const TENANT_A_ID = 'tenant:acme';
export const TENANT_B_ID = 'tenant:globex';
export const WS_A1_ID = 'workspace:acme-eng';
export const WS_A2_ID = 'workspace:acme-field';
export const WS_B1_ID = 'workspace:globex-eng';
export const PROJ_A1_ID = 'project:acme-bridge';
export const PROJ_B1_ID = 'project:globex-tower';
export const WORLD_A1_ID = 'world:acme-bridge-north';
export const SCENARIO_A1_ID = 'scenario:acme-bridge-worst-case';
export const EVIDENCE_A1_ID = 'evidence:acme-bridge-stress-report';

/** A valid platform node as loose JSON. */
export function platformNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: PLATFORM_ID,
    kind: 'platform',
    parentId: null,
    displayName: 'Epoch Platform',
    ...overrides,
  };
}

/** A valid tenant node as loose JSON (defaults to tenant A). */
export function tenantNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: TENANT_A_ID,
    kind: 'tenant',
    parentId: PLATFORM_ID,
    displayName: 'Acme Engineering',
    ...overrides,
  };
}

/** A valid workspace node as loose JSON (defaults to acme-eng). */
export function workspaceNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: WS_A1_ID,
    kind: 'workspace',
    parentId: TENANT_A_ID,
    ...overrides,
  };
}

/** A valid project node as loose JSON (defaults to acme-bridge). */
export function projectNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: PROJ_A1_ID,
    kind: 'project',
    parentId: WS_A1_ID,
    ...overrides,
  };
}

/** A valid world node as loose JSON. */
export function worldNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: WORLD_A1_ID,
    kind: 'world',
    parentId: PROJ_A1_ID,
    ...overrides,
  };
}

/** A valid scenario node as loose JSON. */
export function scenarioNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: SCENARIO_A1_ID,
    kind: 'scenario',
    parentId: PROJ_A1_ID,
    ...overrides,
  };
}

/** A valid evidence node as loose JSON. */
export function evidenceNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: EVIDENCE_A1_ID,
    kind: 'evidence',
    parentId: PROJ_A1_ID,
    ...overrides,
  };
}

/** All nodes of the canonical example hierarchy, creation order. */
export function canonicalNodes(): Record<string, unknown>[] {
  return [
    platformNode(),
    tenantNode(),
    tenantNode({ id: TENANT_B_ID, displayName: 'Globex' }),
    workspaceNode(),
    workspaceNode({ id: WS_A2_ID }),
    workspaceNode({ id: WS_B1_ID, parentId: TENANT_B_ID }),
    projectNode(),
    projectNode({ id: PROJ_B1_ID, parentId: WS_B1_ID }),
    worldNode(),
    scenarioNode(),
    evidenceNode(),
  ];
}

/** Build the canonical directory through the creation pipeline. */
export function canonicalDirectory(): TenancyDirectory {
  const directory = new TenancyDirectory();
  directory.createPlatform({ id: PLATFORM_ID, displayName: 'Epoch Platform' });
  directory.createNode({ id: TENANT_A_ID, parentId: PLATFORM_ID, displayName: 'Acme Engineering' });
  directory.createNode({ id: TENANT_B_ID, parentId: PLATFORM_ID, displayName: 'Globex' });
  directory.createNode({ id: WS_A1_ID, parentId: TENANT_A_ID });
  directory.createNode({ id: WS_A2_ID, parentId: TENANT_A_ID });
  directory.createNode({ id: WS_B1_ID, parentId: TENANT_B_ID });
  directory.createNode({ id: PROJ_A1_ID, parentId: WS_A1_ID });
  directory.createNode({ id: PROJ_B1_ID, parentId: WS_B1_ID });
  directory.createNode({ id: WORLD_A1_ID, parentId: PROJ_A1_ID });
  directory.createNode({ id: SCENARIO_A1_ID, parentId: PROJ_A1_ID });
  directory.createNode({ id: EVIDENCE_A1_ID, parentId: PROJ_A1_ID });
  return directory;
}

/** Seal a (possibly corrupted) node, throwing if invalid (fixture integrity). */
export function seal(nodeInput: Record<string, unknown>): SealedTenancyNode {
  const node = nodeInput as unknown as TenancyNode;
  return { node, digest: computeTenancyNodeDigest(node) };
}

/** Seal a node with the digest of OTHER content (tampered envelope). */
export function sealedWithForeignDigest(
  nodeInput: Record<string, unknown>,
): SealedTenancyNode {
  const other = seal(
    worldNode({ ...(nodeInput as { id: string }), displayName: 'Other Content' }),
  );
  return { node: nodeInput as unknown as TenancyNode, digest: other.digest };
}

/** A snapshot of the canonical hierarchy (nodes as-is, sorted by id). */
export function canonicalSnapshot(): TenancySnapshot {
  const nodes = canonicalNodes().sort((a, b) =>
    String(a['id']) < String(b['id']) ? -1 : String(a['id']) > String(b['id']) ? 1 : 0,
  );
  return { schemaVersion: 1, nodes: nodes as unknown as TenancyNode[] };
}
