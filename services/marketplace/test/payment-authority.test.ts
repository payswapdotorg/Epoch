// The architectural pin, end to end (architecture lock rule 11):
// "Marketplace entitlement is separate from payment processor state."
// A settled payment alone never authorizes; only the synced Epoch-owned
// grant record flips the check; revocation flips it back immediately.
import { describe, expect, it } from 'vitest';
import { InMemoryPaymentPort } from '@epoch/marketplace';
import {
  BUYER,
  hostWithRegistry,
  PRINCIPAL,
  publishedListing,
  T2,
  T3,
} from './fixtures';

describe('payment state is never entitlement authority (end to end)', () => {
  it('NAMED NEGATIVE: a settled payment never authorizes without a grant record', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: receipt.contentDigest, tenantId: BUYER, portReference: 'ref-42' });
    expect(host.registerPaymentPort(port).ok).toBe(true);

    // The port CHECK confirms the settled state...
    const outcome = host.checkPaymentHost({ asTenant: BUYER, listingId, portId: 'port:reference' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('settled');
    }

    // ...but the entitlement check still DENIES (no Epoch-owned record).
    const check = host.checkEntitlementHost({ asTenant: BUYER, listingId });
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.error.code).toBe('entitlement-denied');
      expect(check.error.message).toContain('payment state is never entitlement authority');
    }
  });

  it('the synced grant record (payment-sync provenance) IS the authority', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: receipt.contentDigest, tenantId: BUYER, portReference: 'ref-42' });
    expect(host.registerPaymentPort(port).ok).toBe(true);

    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-authority',
      listingId,
      portId: 'port:reference',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok).toBe(true);
    if (synced.ok) {
      expect(synced.value.entitlement.provenance.kind).toBe('payment-sync');
    }
    // NOW the check passes — because the grant RECORD exists.
    const check = host.checkEntitlementHost({ asTenant: BUYER, listingId });
    expect(check.ok).toBe(true);

    // And revoking the grant flips it back IMMEDIATELY, regardless of the
    // port still reporting settled.
    const revoked = host.revokeEntitlement({
      asTenant: BUYER,
      entitlementId: synced.ok ? synced.value.entitlement.entitlementId : 'entitlement:missing',
      revokedAt: T3,
      revokedBy: PRINCIPAL,
      reason: 'charge refunded out of band',
    });
    expect(revoked.ok).toBe(true);
    const afterRevoke = host.checkEntitlementHost({ asTenant: BUYER, listingId });
    expect(afterRevoke.ok).toBe(false);
    if (!afterRevoke.ok) {
      expect(afterRevoke.ok ? '' : afterRevoke.error.code).toBe('entitlement-revoked');
    }
    // The port state is unchanged and irrelevant.
    const stillSettled = host.checkPaymentHost({ asTenant: BUYER, listingId, portId: 'port:reference' });
    expect(stillSettled.ok && stillSettled.value.result).toBe('settled');
  });

  it('a refunded port outcome cannot sync a grant', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const port = new InMemoryPaymentPort('port:refunds');
    port.refund({ listingVersionDigest: receipt.contentDigest, tenantId: BUYER, portReference: 'ref-42' });
    expect(host.registerPaymentPort(port).ok).toBe(true);
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-refund',
      listingId,
      portId: 'port:refunds',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok).toBe(false);
    if (!synced.ok) {
      expect(synced.error.code).toBe('entitlement-denied');
    }
  });

  it('usage intake is rejected immediately after revocation', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const port = new InMemoryPaymentPort('port:usage');
    expect(host.registerPaymentPort(port).ok).toBe(true);
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-usage',
      listingId,
      portId: 'port:usage', // free? no — one-time; unpaid -> denied
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    // The one-time listing is unpaid at this port: no grant, so a direct
    // grant is needed for the usage path.
    expect(synced.ok).toBe(false);
    const granted = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-usage',
      listingId,
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    const usage = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.value.entitlement.entitlementId,
      idempotencyKey: 'usage-before-revoke',
      units: '1',
      meteredAt: T2,
      actor: PRINCIPAL,
    });
    expect(usage.ok).toBe(true);
    const revoked = host.revokeEntitlement({
      asTenant: BUYER,
      entitlementId: granted.value.entitlement.entitlementId,
      revokedAt: T3,
      revokedBy: PRINCIPAL,
    });
    expect(revoked.ok).toBe(true);
    const usageAfter = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.value.entitlement.entitlementId,
      idempotencyKey: 'usage-after-revoke',
      units: '1',
      meteredAt: T3,
      actor: PRINCIPAL,
    });
    expect(usageAfter.ok).toBe(false);
    if (!usageAfter.ok) {
      expect(usageAfter.error.code).toBe('entitlement-revoked');
    }
  });
});
