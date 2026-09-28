// Negative coverage of entitlement resolution: unknown/foreign tenancy
// scopes, W023-authority denials echoed typed (no grant / revoked), and
// malformed inputs.
import { describe, expect, it } from 'vitest';
import { resolveEntitlement } from '../src/index';
import {
  ENTITLEMENT,
  LISTING,
  LISTING_2,
  OTHER_TENANT,
  OTHER_WORKSPACE,
  PROJECT,
  TENANT,
  T3,
  WORKSPACE_2,
  expectError,
  grant,
  hierarchy,
  revocation,
  workspaceGrant,
} from './fixtures';

describe('resolveEntitlement (negative)', () => {
  it('an unknown workspace is a typed tenant-scope rejection', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING, workspaceId: 'workspace:missing' },
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });

  it('a workspace of ANOTHER tenant is a cross-tenant denial (R12)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING, workspaceId: OTHER_WORKSPACE },
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('a project of ANOTHER tenant is a typed tenant-scope rejection', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING, projectId: 'project:initech-thing' },
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });

  it('a project outside the queried workspace is rejected', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [workspaceGrant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING_2, workspaceId: WORKSPACE_2, projectId: PROJECT },
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });

  it('no matching grant echoes the W023 entitlement-denied (payment state is never authority)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: 'listing:unknown' },
      }),
    );
    expect(error.code).toBe('entitlement-denied');
  });

  it('a revoked grant echoes the W023 entitlement-revoked (immediate, no grace)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [revocation()],
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(error.code).toBe('entitlement-revoked');
    expect((error as { entitlementId?: string }).entitlementId).toBe(ENTITLEMENT);
    expect((error as { revokedAt?: string }).revokedAt).toBe(T3);
  });

  it('a workspace-scoped grant never satisfies a tenant-wide query (W023 scope rule)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [workspaceGrant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING_2 },
      }),
    );
    expect(error.code).toBe('entitlement-denied');
  });

  it('a workspace-scoped grant never covers a DIFFERENT workspace (W023 scope rule)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [workspaceGrant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING_2, workspaceId: OTHER_WORKSPACE },
      }),
    );
    expect(error.code).toBe('entitlement-denied');
  });

  it('a foreign tenant query never resolves on this tenant\'s grants', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        query: { tenantId: OTHER_TENANT, listingId: LISTING },
      }),
    );
    expect(error.code).toBe('entitlement-denied');
    expect((error as { query?: { tenantId: string } }).query?.tenantId).toBe(OTHER_TENANT);
  });

  it('an unknown project is a typed tenant-scope rejection (hierarchy consulted)', () => {
    const error = expectError(
      resolveEntitlement({
        grants: [workspaceGrant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING_2, projectId: 'project:missing' },
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });
});
