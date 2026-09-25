// Entitlement NEGATIVES (named rejections): PAYMENT STATE ASSERTING
// AUTHORITY REJECTED (the architectural pin); revoked checks fail
// immediately; vendor fields rejected; malformed records.
import { describe, expect, it } from 'vitest';
import {
  checkEntitlement,
  InMemoryPaymentPort,
  parseEntitlementGrant,
  parseEntitlementRevoke,
  type EntitlementGrantRecord,
} from '../src/index';
import { entitlementGrant, entitlementRevoke, typedPaymentCheckRequest, BUYER, ZERO } from './fixtures';

describe('payment state is never entitlement authority (architecture lock rule 11)', () => {
  it('NAMED NEGATIVE: a settled payment outcome alone never authorizes an entitlement', () => {
    // The port holds a SETTLED payment record for the exact version the
    // acquiring tenant wants. The pure entitlement check reads
    // Epoch-owned records ONLY: with no grant record, the answer is
    // entitlement-denied — payment state cannot flip it.
    const port = new InMemoryPaymentPort('port:reference', '2026-02-10T09:00:03.000Z');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const outcome = port.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('settled');
    }

    const check = checkEntitlement({
      grants: [],
      revocations: [],
      query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
    });
    expect(check.ok).toBe(false);
    if (!check.ok && check.error.code === 'entitlement-denied') {
      expect(check.error.message).toContain('payment state is never entitlement authority');
    }
  });

  it('NAMED NEGATIVE: a revoked entitlement check fails IMMEDIATELY (no grace semantics)', () => {
    const grant = parseEntitlementGrant(entitlementGrant());
    const revocation = parseEntitlementRevoke(entitlementRevoke());
    expect(grant.ok && revocation.ok).toBe(true);
    if (grant.ok && revocation.ok) {
      const check = checkEntitlement({
        grants: [grant.value],
        revocations: [revocation.value],
        query: { tenantId: BUYER, listingId: 'listing:stress-suite' },
      });
      expect(check.ok).toBe(false);
      if (!check.ok && check.error.code === 'entitlement-revoked') {
        // Immediate: the witness IS the revocation record, nothing else.
        expect(check.error.revokedAt).toBe(revocation.value.revokedAt);
      }
    }
  });

  it('NAMED NEGATIVE: vendor/provider fields on grant records are rejected', () => {
    const parsed = parseEntitlementGrant({
      ...entitlementGrant(),
      chargeId: 'ch_not_a_real_brand',
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('an unknown provenance kind is rejected', () => {
    // A record attempting to claim payment state as a THIRD provenance
    // authority — e.g. a "brand-assertion" — is outside the closed
    // vocabulary: only direct (Epoch actor) and payment-sync (record
    // proposal) exist.
    const parsed = parseEntitlementGrant({
      ...entitlementGrant(),
      provenance: { kind: 'brand-assertion', brandId: 'not-a-real-brand' },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });

  it('a malformed principal grammar on grantedBy is rejected with a precise path', () => {
    const parsed = parseEntitlementGrant({ ...entitlementGrant(), grantedBy: 'user:bob' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'grantedBy')).toBe(true);
    }
  });

  it('a malformed entitlement id is rejected', () => {
    const parsed = parseEntitlementGrant({ ...entitlementGrant(), entitlementId: 'ent:1' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'entitlementId')).toBe(true);
    }
  });

  it('a malformed revocation record is rejected', () => {
    const parsed = parseEntitlementRevoke({ ...entitlementRevoke(), revocationId: 'bad id' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });

  it('schemaVersion skew on grant records reports at the schemaVersion path first', () => {
    const parsed = parseEntitlementGrant({ ...entitlementGrant(), schemaVersion: 7 });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues[0]?.path).toBe('schemaVersion');
    }
  });

  it('zero grants for a listing yields entitlement-denied with the query echo', () => {
    const grants: EntitlementGrantRecord[] = [];
    const check = checkEntitlement({
      grants,
      revocations: [],
      query: { tenantId: BUYER, listingId: 'listing:unknown', workspaceId: 'workspace:w' },
    });
    expect(check.ok).toBe(false);
    if (!check.ok && check.error.code === 'entitlement-denied') {
      expect(check.error.query).toEqual({
        listingId: 'listing:unknown',
        tenantId: BUYER,
        workspaceId: 'workspace:w',
      });
    }
  });
});
