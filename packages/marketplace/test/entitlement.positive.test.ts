// Entitlement positives: grant/check/revoke with IMMEDIATE revocation;
// provenance (direct + payment-sync); tenant scoping; determinism of the
// witness choice.
import { describe, expect, it } from 'vitest';
import { checkEntitlement, parseEntitlementGrant, parseEntitlementRevoke } from '../src/index';
import { entitlementGrant, entitlementRevoke, BUYER, OTHER_TENANT } from './fixtures';

describe('entitlement positives', () => {
  it('a grant record parses and the pure check passes', () => {
    const grant = parseEntitlementGrant(entitlementGrant());
    expect(grant.ok, JSON.stringify(grant)).toBe(true);
    if (grant.ok) {
      const check = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(check.ok).toBe(true);
      if (check.ok) {
        expect(check.value.entitlement.entitlementId).toBe('entitlement:grant-001');
        expect(check.value.matchedGrantCount).toBe(1);
      }
    }
  });

  it('a workspace-scoped grant covers its workspace and nothing else', () => {
    const grant = parseEntitlementGrant(
      entitlementGrant({ scope: { kind: 'workspace', workspaceId: 'workspace:globex-eng' } }),
    );
    expect(grant.ok).toBe(true);
    if (grant.ok) {
      const covered = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite', workspaceId: 'workspace:globex-eng' },
      });
      expect(covered.ok).toBe(true);
      const uncovered = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite', workspaceId: 'workspace:other' },
      });
      expect(uncovered.ok).toBe(false);
      if (!uncovered.ok && uncovered.error.code === 'entitlement-denied') {
        // tenant-scoped denial as expected
      }
      const noWorkspaceQuery = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(noWorkspaceQuery.ok).toBe(false);
    }
  });

  it('a tenant-wide grant covers any workspace query', () => {
    const grant = parseEntitlementGrant(entitlementGrant());
    expect(grant.ok).toBe(true);
    if (grant.ok) {
      const check = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite', workspaceId: 'workspace:any' },
      });
      expect(check.ok).toBe(true);
    }
  });

  it('IMMEDIATE revocation: the check flips the moment the revocation record exists', () => {
    const grant = parseEntitlementGrant(entitlementGrant());
    const revocation = parseEntitlementRevoke(entitlementRevoke());
    expect(grant.ok && revocation.ok).toBe(true);
    if (grant.ok && revocation.ok) {
      const before = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(before.ok).toBe(true);
      const after = checkEntitlement({
        grants: [grant.value],
        revocations: [revocation.value],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(after.ok).toBe(false);
      if (!after.ok && after.error.code === 'entitlement-revoked') {
        expect(after.error.entitlementId).toBe('entitlement:grant-001');
        expect(after.error.revokedAt).toBe(revocation.value.revokedAt);
      }
    }
  });

  it('revocation is TOTAL: a re-grant after revocation restores the check and reports the revoked count', () => {
    const original = parseEntitlementGrant(entitlementGrant());
    const revocation = parseEntitlementRevoke(entitlementRevoke());
    const regrant = parseEntitlementGrant(
      entitlementGrant({ entitlementId: 'entitlement:grant-002', grantedAt: '2026-02-10T09:00:04.000Z' }),
    );
    expect(original.ok && revocation.ok && regrant.ok).toBe(true);
    if (original.ok && revocation.ok && regrant.ok) {
      const check = checkEntitlement({
        grants: [original.value, regrant.value],
        revocations: [revocation.value],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(check.ok).toBe(true);
      if (check.ok) {
        expect(check.value.entitlement.entitlementId).toBe('entitlement:grant-002');
        expect(check.value.revokedMatchingCount).toBe(1);
      }
    }
  });

  it('payment-sync provenance is a first-class grant record (the record is the authority)', () => {
    const grant = parseEntitlementGrant(
      entitlementGrant({
        provenance: { kind: 'payment-sync', portId: 'port:reference', portReference: 'ref-42' },
      }),
    );
    expect(grant.ok, JSON.stringify(grant)).toBe(true);
    if (grant.ok) {
      expect(grant.value.provenance.kind).toBe('payment-sync');
      const check = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(check.ok).toBe(true);
    }
  });

  it('the witness choice is deterministic: latest grantedAt, ties by entitlementId', () => {
    const a = parseEntitlementGrant(
      entitlementGrant({ entitlementId: 'entitlement:aaa', grantedAt: '2026-02-10T09:00:01.000Z' }),
    );
    const b = parseEntitlementGrant(
      entitlementGrant({ entitlementId: 'entitlement:zzz', grantedAt: '2026-02-10T09:00:02.000Z' }),
    );
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      const forward = checkEntitlement({
        grants: [a.value, b.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      const backward = checkEntitlement({
        grants: [b.value, a.value],
        revocations: [],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(forward.ok && backward.ok).toBe(true);
      if (forward.ok && backward.ok) {
        expect(forward.value.entitlement.entitlementId).toBe('entitlement:zzz');
        expect(backward.value.entitlement.entitlementId).toBe('entitlement:zzz');
      }
    }
  });

  it('seats are optional typed data on the grant record', () => {
    const grant = parseEntitlementGrant(entitlementGrant({ seats: 25 }));
    expect(grant.ok).toBe(true);
    if (grant.ok) {
      expect(grant.value.seats).toBe(25);
    }
  });

  it('the exact listing version digest travels with the grant', () => {
    const grant = parseEntitlementGrant(
      entitlementGrant({ listingVersionDigest: 'a'.repeat(64) }),
    );
    expect(grant.ok).toBe(true);
    if (grant.ok) {
      expect(grant.value.listingVersionDigest).toBe('a'.repeat(64));
    }
  });
});

describe('entitlement tenant scoping (R12)', () => {
  it('another tenant\u2019s grants never satisfy a query', () => {
    const grant = parseEntitlementGrant(entitlementGrant());
    expect(grant.ok).toBe(true);
    if (grant.ok) {
      const check = checkEntitlement({
        grants: [grant.value],
        revocations: [],
        query: { tenantId: OTHER_TENANT, listingId: 'listing:stress-suite' },
      });
      expect(check.ok).toBe(false);
      if (!check.ok && check.error.code === 'entitlement-denied') {
        expect(check.error.query.tenantId).toBe(OTHER_TENANT);
      }
    }
  });
});
