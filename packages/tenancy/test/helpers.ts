// Shared fixtures for the tenancy tests. Builders return loose JSON
// objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern).
import { computeTenancyNodeDigest, TenancyHierarchy } from '../src/index';
import type { TenancyNodeRegistration } from '../src/index';

/** A valid platform root node as loose JSON. */
export function platformNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'platform:epoch',
    kind: 'platform',
    displayName: 'Epoch Platform',
    parentId: null,
    ...overrides,
  };
}

/** A valid tenant node as loose JSON. */
export function tenantNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'tenant:acme',
    kind: 'tenant',
    displayName: 'Acme Engineering',
    parentId: 'platform:epoch',
    ...overrides,
  };
}

/** A valid workspace node as loose JSON. */
export function workspaceNode(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'workspace:acme-eng',
    kind: 'workspace',
    displayName: 'Acme Engineering Workspace',
    parentId: 'tenant:acme',
    ...overrides,
  };
}

/** A valid project node as loose JSON. */
export function projectNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'project:bridge-12',
    kind: 'project',
    displayName: 'Bridge 12 Design',
    parentId: 'workspace:acme-eng',
    ...overrides,
  };
}

/** A valid world node as loose JSON. */
export function worldNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'world:bridge-12-model',
    kind: 'world',
    displayName: 'Bridge 12 World Model',
    parentId: 'project:bridge-12',
    ...overrides,
  };
}

/** A valid scenario node as loose JSON. */
export function scenarioNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'scenario:bridge-12-load-case',
    kind: 'scenario',
    displayName: 'Bridge 12 Rated Load Case',
    parentId: 'project:bridge-12',
    ...overrides,
  };
}

/** An evidence node as loose JSON. */
export function evidenceNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nodeId: 'evidence:bridge-12-report',
    kind: 'evidence',
    displayName: 'Bridge 12 Verification Report',
    parentId: 'project:bridge-12',
    ...overrides,
  };
}

/** Validate + seal a node, throwing if invalid (fixture integrity). */
export function seal(nodeInput: Record<string, unknown>): TenancyNodeRegistration {
  const node = nodeInput as unknown as TenancyNodeRegistration['node'];
  return {
    node,
    digest: computeTenancyNodeDigest(node),
  };
}

/**
 * Wrap (possibly INVALID) node content in an envelope with a placeholder
 * digest: admission validation runs BEFORE digest verification, so the
 * typed `validation` error is what surfaces (seal would throw instead).
 */
export function bogusSeal(nodeInput: Record<string, unknown>): TenancyNodeRegistration {
  return {
    node: nodeInput as unknown as TenancyNodeRegistration['node'],
    digest: 'f'.repeat(64),
  };
}

/** Seal a (possibly corrupted) node with the digest of OTHER content. */
export function sealedWithForeignDigest(
  nodeInput: Record<string, unknown>,
): TenancyNodeRegistration {
  const other = seal({ ...nodeInput, displayName: 'Tampered Other Content' });
  return {
    node: nodeInput as unknown as TenancyNodeRegistration['node'],
    digest: other.digest,
  };
}

/**
 * A complete fixture hierarchy: platform -> tenant:acme -> workspace ->
 * project -> world/scenario/evidence, plus a second tenant for isolation
 * tests. Returns the hierarchy for further assertions.
 */
export function fixtureHierarchy(): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const admitted = [
    hierarchy.createNode(seal(platformNode())),
    hierarchy.createNode(seal(tenantNode())),
    hierarchy.createNode(
      seal(tenantNode({ nodeId: 'tenant:globex', displayName: 'Globex Industries' })),
    ),
    hierarchy.createNode(seal(workspaceNode())),
    hierarchy.createNode(seal(projectNode())),
    hierarchy.createNode(seal(worldNode())),
    hierarchy.createNode(seal(scenarioNode())),
    hierarchy.createNode(seal(evidenceNode())),
  ];
  for (const result of admitted) {
    if (!result.ok) throw new Error(`fixture hierarchy admission failed: ${result.error.code}`);
  }
  return hierarchy;
}
