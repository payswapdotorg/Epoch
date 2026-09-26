// W017 acceptance: session-scoped tenants via @epoch/tenancy — scope
// resolution against the reference hierarchy, the W011 TenantScope
// projection, and the typed cross-tenant/malformed rejections (R12).
import { describe, expect, it } from 'vitest';
import { tenancyNodeRecordFor } from '@epoch/tenancy';
import {
  isWithinTenant,
  resolveSessionScope,
  tenantScopeOf,
} from '../src/index';
import {
  PROJECT_A,
  TENANT_A,
  TENANT_B,
  WORKSPACE_A,
  WORKSPACE_B,
  buildHierarchy,
  expectFailure,
} from './fixtures';

describe('session-scope resolution (via @epoch/tenancy)', () => {
  it('resolves a tenant-scoped session with exact-revision node digests', () => {
    const resolved = resolveSessionScope(buildHierarchy(), { tenantId: TENANT_A });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.tenantId).toBe(TENANT_A);
      expect(resolved.value.workspaceId).toBeUndefined();
      expect(resolved.value.tenantNodeDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('resolves a workspace- and project-narrowed scope through the containment path', () => {
    const resolved = resolveSessionScope(buildHierarchy(), {
      tenantId: TENANT_A,
      workspaceId: WORKSPACE_A,
      projectId: PROJECT_A,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.workspaceId).toBe(WORKSPACE_A);
      expect(resolved.value.projectId).toBe(PROJECT_A);
      expect(resolved.value.workspaceNodeDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(resolved.value.projectNodeDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('projects the resolved scope onto the W011 TenantScope vocabulary', () => {
    const resolved = resolveSessionScope(buildHierarchy(), {
      tenantId: TENANT_A,
      workspaceId: WORKSPACE_A,
    });
    if (!resolved.ok) {
      throw new Error(resolved.error.message);
    }
    expect(tenantScopeOf(resolved.value)).toEqual({
      tenantId: TENANT_A,
      workspaceId: WORKSPACE_A,
      projectId: undefined,
    });
    expect(isWithinTenant(resolved.value, TENANT_A)).toBe(true);
    expect(isWithinTenant(resolved.value, TENANT_B)).toBe(false);
  });

  it('rejects malformed scope ids with the typed malformed-record', () => {
    expectFailure(resolveSessionScope(buildHierarchy(), { tenantId: 'not-a-tenant-id' }), 'malformed-record');
    expectFailure(
      resolveSessionScope(buildHierarchy(), { tenantId: TENANT_A, workspaceId: 42 as unknown as string }),
      'malformed-record',
    );
  });

  it('rejects unknown nodes with the tenancy code surfaced inside the typed error', () => {
    const unknown = resolveSessionScope(buildHierarchy(), { tenantId: 'tenant:ghost' });
    expectFailure(unknown, 'malformed-record');
    if (!unknown.ok) {
      expect(unknown.error.message).toContain('unknown-node');
    }
  });

  it('rejects a scope whose workspace belongs to another tenant (cross-tenant-denied, R12)', () => {
    const cross = resolveSessionScope(buildHierarchy(), {
      tenantId: TENANT_A,
      workspaceId: WORKSPACE_B, // belongs to tenant B
    });
    expectFailure(cross, 'cross-tenant-denied');
  });

  it('rejects a project without its workspace (containment cannot skip a level)', () => {
    expectFailure(
      resolveSessionScope(buildHierarchy(), { tenantId: TENANT_A, projectId: PROJECT_A }),
      'malformed-record',
    );
  });

  it('rejects a project of another tenant under this tenant\u2019s workspace (cross-tenant-denied)', () => {
    const hierarchy = buildHierarchy();
    // Admit a tenant-B project (properly sealed).
    const sealed = tenancyNodeRecordFor({
      schemaVersion: 1,
      nodeId: 'project:foreign',
      kind: 'project',
      displayName: 'Foreign',
      description: 'Tenant B project',
      parentId: WORKSPACE_B,
    });
    const created = hierarchy.createNode({ node: sealed.node, digest: sealed.nodeDigest });
    expect(created.ok).toBe(true);
    // Tenant A session attempting to scope to tenant B's project.
    const cross = resolveSessionScope(hierarchy, {
      tenantId: TENANT_A,
      workspaceId: WORKSPACE_A,
      projectId: 'project:foreign',
    });
    expectFailure(cross, 'cross-tenant-denied');
  });
});
