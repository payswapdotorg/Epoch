// TENANCY coverage: the entitlement resolution rides the REAL W009
// hierarchy (workspace/project narrowing, unknown/foreign scope
// rejections) and tenant isolation holds across every host path.
import { describe, expect, it } from 'vitest';
import { billingStreamIdOf } from '@epoch/entitlements';
import { BillingHost } from '../src/index';
import {
  AUTH,
  ENTITLEMENT,
  authFor,
  OTHER_TENANT,
  OTHER_WORKSPACE,
  PRINCIPAL,
  PRINCIPAL_2,
  PROJECT,
  TENANT,
  T0,
  T1,
  T5,
  WORKSPACE,
  expectError,
  grant,
  hierarchy,
  unwrap,
} from './helpers';

function hostWithTenancy(): BillingHost {
  return new BillingHost({ tenancy: hierarchy() });
}

function primed(host: BillingHost): void {
  unwrap(
    host.openAccount({
      asTenant: TENANT,
      authorization: AUTH,
      idempotencyKey: 'account-key-1',
      currency: 'EUR',
      displayName: 'Globex EUR billing account',
      openedAt: T0,
      openedBy: PRINCIPAL,
    }),
  );
  unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
}

describe('the tenancy seam (W009 hierarchy)', () => {
  it('a tenant-wide query resolves with the root-first containment path', () => {
    const host = hostWithTenancy();
    primed(host);
    const resolved = unwrap(
      host.resolveEntitlement({ asTenant: TENANT, authorization: AUTH, listingId: 'listing:stress-suite' }),
    );
    expect(resolved.tenancyPath).toEqual(['platform:epoch', TENANT]);
  });

  it('a workspace-scoped query resolves with the workspace in the path', () => {
    const host = hostWithTenancy();
    primed(host);
    const resolved = unwrap(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        workspaceId: WORKSPACE,
      }),
    );
    expect(resolved.tenancyPath).toEqual(['platform:epoch', TENANT, WORKSPACE]);
    expect(resolved.scopeCoverage).toBe('tenant');
  });

  it('a project-scoped query narrows to its containing workspace', () => {
    const host = hostWithTenancy();
    primed(host);
    const resolved = unwrap(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        projectId: PROJECT,
      }),
    );
    expect(resolved.tenancyPath).toEqual(['platform:epoch', TENANT, WORKSPACE, PROJECT]);
  });

  it('an unknown workspace is the typed tenant-scope rejection', () => {
    const host = hostWithTenancy();
    primed(host);
    const error = expectError(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        workspaceId: 'workspace:missing',
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });

  it('a workspace of ANOTHER tenant is a cross-tenant denial (R12)', () => {
    const host = hostWithTenancy();
    primed(host);
    const error = expectError(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        workspaceId: OTHER_WORKSPACE,
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('a project outside the queried workspace is the typed tenant-scope rejection', () => {
    const host = hostWithTenancy();
    primed(host);
    const error = expectError(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        workspaceId: 'workspace:globex-ops',
        projectId: PROJECT,
      }),
    );
    expect(error.code).toBe('tenant-scope-rejected');
  });
});

describe('tenant isolation across host paths (R12)', () => {
  it('a foreign principal cannot operate on this tenant (gate-level R12)', () => {
    const host = new BillingHost();
    // The tenant is KNOWN but the principal holds no membership in it —
    // the R12-by-construction denial.
    const foreignAuth = {
      principalId: PRINCIPAL,
      context: {
        schemaVersion: 1 as const,
        principals: [{ principalId: PRINCIPAL, status: 'active' as const, authenticated: true }],
        memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
        knownTenants: [TENANT, OTHER_TENANT],
      },
    };
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: foreignAuth,
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect((error as { denialCode?: string }).denialCode).toBe('cross-tenant-denied');
  });

  it('health never counts another tenant\'s records as visible', () => {
    const host = new BillingHost();
    primed(host);
    const foreignAuth = authFor(PRINCIPAL, OTHER_TENANT);
    const listing = unwrap(host.listInvoices({ asTenant: OTHER_TENANT, authorization: foreignAuth }));
    expect(listing).toHaveLength(0);
  });

  it('the stream read is tenant-scoped (another tenant sees nothing)', () => {
    const host = new BillingHost();
    const receipt = unwrap(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'EUR',
        displayName: 'Globex EUR billing account',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    primed(host);
    const streamId = billingStreamIdOf(receipt.account.accountId);
    const foreignAuth = authFor(PRINCIPAL_2, OTHER_TENANT);
    const events = unwrap(host.readStream({ asTenant: OTHER_TENANT, authorization: foreignAuth, streamId }));
    expect(events).toHaveLength(0);
  });

  it('the seat account read of another tenant\'s entitlement is empty, not leaked', () => {
    const host = new BillingHost();
    primed(host);
    unwrap(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-1',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL_2,
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    const foreignAuth = authFor(PRINCIPAL_2, OTHER_TENANT);
    // The other tenant has no assignment records — the fold is empty.
    const error = expectError(
      host.usageAccountOf({
        asTenant: OTHER_TENANT,
        authorization: foreignAuth,
        entitlementId: ENTITLEMENT,
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('a draft against another tenant\'s account id is the typed unknown-account', () => {
    const host = new BillingHost();
    primed(host);
    const foreignAuth = authFor(PRINCIPAL, OTHER_TENANT);
    const error = expectError(
      host.draftInvoice({
        asTenant: OTHER_TENANT,
        authorization: foreignAuth,
        idempotencyKey: 'inv-1',
        accountId: 'billing-account:globex-eur',
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: { kind: 'one-time', amount: '10', currency: 'EUR' } }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-account');
  });
});
