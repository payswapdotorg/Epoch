// COMPOSITE integration (test-only, devDependencies): the three W009
// packages compose end-to-end WITHOUT runtime coupling — @epoch/tenancy
// owns the hierarchy, @epoch/identity owns principals and authentication
// results, @epoch/authorization decides over caller-supplied FACTS that
// THIS TEST wires from the other two packages' records (the shape the
// Action Gateway, W022, will project in production).
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import { IdentityRegistry } from '@epoch/identity';
import type { AuthenticationResult, Principal } from '@epoch/identity';
import { TenancyHierarchy } from '@epoch/tenancy';
import { evaluate } from '../src/index';
import type {
  AuthorizationContext,
  AuthorizationRequest,
  MembershipFact,
  PrincipalFact,
} from '../src/index';

interface LooseNode {
  readonly nodeId: string;
  readonly kind: string;
  readonly displayName: string;
  readonly parentId: string | null;
  readonly schemaVersion: number;
}

const NODES: readonly LooseNode[] = [
  { nodeId: 'platform:epoch', kind: 'platform', displayName: 'Epoch Platform', parentId: null, schemaVersion: 1 },
  { nodeId: 'tenant:acme', kind: 'tenant', displayName: 'Acme', parentId: 'platform:epoch', schemaVersion: 1 },
  { nodeId: 'tenant:globex', kind: 'tenant', displayName: 'Globex', parentId: 'platform:epoch', schemaVersion: 1 },
  { nodeId: 'workspace:acme-eng', kind: 'workspace', displayName: 'Acme Engineering', parentId: 'tenant:acme', schemaVersion: 1 },
  { nodeId: 'workspace:globex-eng', kind: 'workspace', displayName: 'Globex Engineering', parentId: 'tenant:globex', schemaVersion: 1 },
  { nodeId: 'project:bridge-12', kind: 'project', displayName: 'Bridge 12', parentId: 'workspace:acme-eng', schemaVersion: 1 },
  { nodeId: 'world:bridge-12-model', kind: 'world', displayName: 'Bridge 12 Model', parentId: 'project:bridge-12', schemaVersion: 1 },
];

/** Seal arbitrary JSON content with its canonical SHA-256 (fixture helper). */
function digestOf(value: unknown): string {
  return canonicalDigest(value as never);
}

/** The composite fixture: a real tenancy tree + a real identity registry. */
function fixture() {
  const hierarchy = new TenancyHierarchy();
  for (const node of NODES) {
    const admitted = hierarchy.createNode({ node, digest: digestOf(node) } as never);
    expect(admitted.ok, node.nodeId).toBe(true);
  }

  const identity = new IdentityRegistry();
  const ada: Principal = {
    schemaVersion: 1,
    principalId: 'principal:ada',
    kind: 'human',
    displayName: 'Ada Lovelace',
  };
  expect(identity.registerPrincipal({ principal: ada, digest: digestOf(ada) }).ok).toBe(true);
  const verified: AuthenticationResult = {
    schemaVersion: 1,
    resultId: 'result-0001',
    assertionId: 'assertion-0001',
    principalId: 'principal:ada',
    outcome: 'verified',
    decidedAt: '2026-02-01T09:15:01.000Z',
  };
  expect(
    identity.recordAuthentication({ result: verified, digest: digestOf(verified) }).ok,
  ).toBe(true);

  return { hierarchy, identity };
}

/** Project principal facts from the identity registry's records. */
function principalFacts(identity: IdentityRegistry): PrincipalFact[] {
  return identity.listPrincipals().map((record) => {
    const latest = identity.latestAuthentication(record.principal.principalId);
    return {
      principalId: record.principal.principalId,
      status: record.lifecycle,
      authenticated:
        latest.ok && latest.value !== null
          ? latest.value.result.outcome === 'verified'
          : false,
    };
  });
}

/** Project a project-scoped membership fact from tenancy containment. */
function projectMembership(
  hierarchy: TenancyHierarchy,
  principalId: string,
  projectId: string,
): MembershipFact {
  const chain = hierarchy.pathToRoot(projectId);
  expect(chain.ok).toBe(true);
  if (!chain.ok) throw new Error('unreachable');
  const byKind = new Map(chain.value.map((record) => [record.node.kind, record.node.nodeId]));
  return {
    principalId,
    tenantId: byKind.get('tenant')!,
    workspaceId: byKind.get('workspace')!,
    projectId,
  };
}

/** The known tenants, projected from the tenancy tree. */
function knownTenantsOf(hierarchy: TenancyHierarchy): string[] {
  return hierarchy.listNodes({ kind: 'tenant' }).map((record) => record.node.nodeId);
}

/** A world.read request whose tenancy scope is derived from the REAL tree. */
function requestOver(hierarchy: TenancyHierarchy, resourceId: string): AuthorizationRequest {
  const chain = hierarchy.pathToRoot(resourceId);
  expect(chain.ok).toBe(true);
  if (!chain.ok) throw new Error('unreachable');
  const byKind = new Map(chain.value.map((record) => [record.node.kind, record.node.nodeId]));
  return {
    schemaVersion: 1,
    principalId: 'principal:ada',
    actionKind: 'world.read',
    resource: {
      resourceType: 'world',
      resourceId,
      tenantId: byKind.get('tenant')!,
      workspaceId: byKind.get('workspace')!,
      projectId: byKind.get('project')!,
    },
    justification: 'Composite integration request.',
  };
}

describe('W009 composite: tenancy + identity + authorization (test-only wiring)', () => {
  it('end-to-end allow: authenticated active member with a covering project membership', () => {
    const { hierarchy, identity } = fixture();
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: principalFacts(identity),
      memberships: [projectMembership(hierarchy, 'principal:ada', 'project:bridge-12')],
      knownTenants: knownTenantsOf(hierarchy),
    };
    const decision = evaluate(requestOver(hierarchy, 'world:bridge-12-model'), context);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('allow');
  });

  it('cross-tenant access is denied against the REAL tenancy tree (R12)', () => {
    const { hierarchy, identity } = fixture();
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: principalFacts(identity),
      memberships: [projectMembership(hierarchy, 'principal:ada', 'project:bridge-12')],
      knownTenants: knownTenantsOf(hierarchy),
    };
    // A Globex resource: the tenancy tree KNOWS the tenant (it is in
    // knownTenants), but Ada holds no Globex membership — isolation wins.
    const decision = evaluate(
      {
        schemaVersion: 1,
        principalId: 'principal:ada',
        actionKind: 'world.read',
        resource: {
          resourceType: 'report',
          resourceId: 'report:globex-q1',
          tenantId: 'tenant:globex',
          workspaceId: 'workspace:globex-eng',
        },
        justification: 'Cross-tenant attempt.',
      },
      context,
    );
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome !== 'deny') return;
    expect(decision.value.denial.code).toBe('cross-tenant-denied');
  });

  it('a suspended principal is denied after the identity lifecycle transition', () => {
    const { hierarchy, identity } = fixture();
    identity.suspend('principal:ada');
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: principalFacts(identity),
      memberships: [projectMembership(hierarchy, 'principal:ada', 'project:bridge-12')],
      knownTenants: knownTenantsOf(hierarchy),
    };
    const decision = evaluate(requestOver(hierarchy, 'world:bridge-12-model'), context);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome !== 'deny') return;
    expect(decision.value.denial.code).toBe('inactive-principal');
  });

  it('a failed latest authentication flips the fact to unauthenticated and denies', () => {
    const { hierarchy, identity } = fixture();
    const failed: AuthenticationResult = {
      schemaVersion: 1,
      resultId: 'result-0002',
      assertionId: 'assertion-0001',
      principalId: 'principal:ada',
      outcome: 'failed',
      reason: 'invalid-credential',
      decidedAt: '2026-02-02T09:15:01.000Z',
    };
    expect(
      identity.recordAuthentication({ result: failed, digest: digestOf(failed) }).ok,
    ).toBe(true);
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: principalFacts(identity),
      memberships: [projectMembership(hierarchy, 'principal:ada', 'project:bridge-12')],
      knownTenants: knownTenantsOf(hierarchy),
    };
    const decision = evaluate(requestOver(hierarchy, 'world:bridge-12-model'), context);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome !== 'deny') return;
    expect(decision.value.denial.code).toBe('unauthenticated-principal');
  });

  it('hierarchy traversal without membership is denied: a sibling project in the same workspace', () => {
    const { hierarchy, identity } = fixture();
    // Ada is a member of project:bridge-12; she requests a world under a
    // DIFFERENT project of the same workspace — derived from the real tree.
    const other = {
      schemaVersion: 1,
      nodeId: 'project:bridge-13',
      kind: 'project',
      displayName: 'Bridge 13',
      parentId: 'workspace:acme-eng',
    };
    const otherWorld = {
      schemaVersion: 1,
      nodeId: 'world:bridge-13-model',
      kind: 'world',
      displayName: 'Bridge 13 Model',
      parentId: 'project:bridge-13',
    };
    expect(hierarchy.createNode({ node: other, digest: digestOf(other) } as never).ok).toBe(true);
    expect(hierarchy.createNode({ node: otherWorld, digest: digestOf(otherWorld) } as never).ok).toBe(true);
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: principalFacts(identity),
      memberships: [projectMembership(hierarchy, 'principal:ada', 'project:bridge-12')],
      knownTenants: knownTenantsOf(hierarchy),
    };
    const decision = evaluate(requestOver(hierarchy, 'world:bridge-13-model'), context);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome !== 'deny') return;
    expect(decision.value.denial.code).toBe('cross-project-denied');
  });
});
