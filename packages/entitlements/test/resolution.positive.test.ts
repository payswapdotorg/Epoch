// Positive coverage of entitlement resolution: tenancy-ridden scope
// narrowing (workspace/project), delegation to the W023 checkEntitlement
// authority (latest-grant witness, tenant-scope coverage), and the
// deterministic W009 containment path.
import { describe, expect, it } from 'vitest';
import { resolveEntitlement } from '../src/index';
import {
  ENTITLEMENT,
  ENTITLEMENT_2,
  LISTING,
  LISTING_2,
  OTHER_TENANT,
  PRINCIPAL,
  PROJECT,
  TENANT,
  T0,
  T2,
  WORKSPACE,
  grant,
  hierarchy,
  unwrap,
  workspaceGrant,
} from './fixtures';

describe('resolveEntitlement (positive)', () => {
  it('resolves a tenant-wide grant through the W023 authority', () => {
    const resolution = unwrap(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(resolution.entitlement.entitlementId).toBe(ENTITLEMENT);
    expect(resolution.scopeCoverage).toBe('tenant');
    expect(resolution.tenancyPath).toEqual(['platform:epoch', TENANT]);
    expect(resolution.matchedGrantCount).toBe(1);
    expect(resolution.revokedMatchingCount).toBe(0);
  });

  it('resolves a workspace-scoped grant and reports workspace coverage', () => {
    const resolution = unwrap(
      resolveEntitlement({
        grants: [workspaceGrant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING_2, workspaceId: WORKSPACE },
      }),
    );
    expect(resolution.entitlement.entitlementId).toBe(ENTITLEMENT_2);
    expect(resolution.scopeCoverage).toBe('workspace');
    expect(resolution.tenancyPath).toEqual(['platform:epoch', TENANT, WORKSPACE]);
  });

  it('a tenant-wide grant covers a workspace-scoped query (W023 semantics)', () => {
    const resolution = unwrap(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING, workspaceId: WORKSPACE },
      }),
    );
    expect(resolution.scopeCoverage).toBe('tenant');
    expect(resolution.entitlement.entitlementId).toBe(ENTITLEMENT);
  });

  it('a project-scoped query narrows to its containing workspace', () => {
    const grants = [workspaceGrant()];
    const resolution = unwrap(
      resolveEntitlement({
        grants,
        revocations: [],
        tenancy: hierarchy(),
        query: { tenantId: TENANT, listingId: LISTING_2, projectId: PROJECT },
      }),
    );
    expect(resolution.scopeCoverage).toBe('workspace');
    expect(resolution.tenancyPath).toEqual(['platform:epoch', TENANT, WORKSPACE, PROJECT]);
  });

  it('delegation picks the LATEST grant witness (the W023 rule, not a re-implementation)', () => {
    const later = grant({ grantedAt: T2 });
    const resolution = unwrap(
      resolveEntitlement({
        grants: [grant(), later],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(resolution.entitlement.grantedAt).toBe(T2);
    expect(resolution.matchedGrantCount).toBe(2);
  });

  it('a grant from ANOTHER tenant is invisible to the query (R12: no cross-tenant answer)', () => {
    const foreign = grant({ tenantId: OTHER_TENANT, entitlementId: 'entitlement:initech-stress' });
    const resolution = unwrap(
      resolveEntitlement({
        grants: [foreign, grant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(resolution.entitlement.tenantId).toBe(TENANT);
    expect(resolution.matchedGrantCount).toBe(1);
  });

  it('resolution works without a tenancy hierarchy (pure W023 delegation)', () => {
    const resolution = unwrap(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(resolution.entitlement.entitlementId).toBe(ENTITLEMENT);
    expect(resolution.tenancyPath).toEqual([]);
  });

  it('the witness carries full W023 provenance (direct grant by a principal)', () => {
    const resolution = unwrap(
      resolveEntitlement({
        grants: [grant()],
        revocations: [],
        query: { tenantId: TENANT, listingId: LISTING },
      }),
    );
    expect(resolution.entitlement.grantedBy).toBe(PRINCIPAL);
    expect(resolution.entitlement.grantedAt).toBe(T0);
    expect(resolution.entitlement.provenance).toEqual({ kind: 'direct' });
  });
});
