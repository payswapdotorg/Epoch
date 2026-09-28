// ACCOUNT + ADMISSION coverage: idempotent account opening, W023
// grant/revocation adoption (verified through the REAL marketplace
// validators), W036 delivery registration (REAL verification), and usage
// intake (idempotent by (stream, sequence)).
import { describe, expect, it } from 'vitest';
import { BillingHost } from '../src/index';
import {
  AUTH,
  ENTITLEMENT,
  OTHER_TENANT,
  authFor,
  PRINCIPAL,
  TENANT,
  T0,
  T3,
  T5,
  deliveredActual,
  expectError,
  grant,
  unwrap,
  usageEvent,
} from './helpers';

function openAccount(host: BillingHost, key = 'account-key-1') {
  return unwrap(
    host.openAccount({
      asTenant: TENANT,
      authorization: AUTH,
      idempotencyKey: key,
      currency: 'EUR',
      displayName: 'Globex EUR billing account',
      openedAt: T0,
      openedBy: PRINCIPAL,
    }),
  );
}

describe('billing accounts (positive)', () => {
  it('opens an account idempotently (same key + content -> duplicate receipt)', () => {
    const host = new BillingHost();
    const first = openAccount(host);
    expect(first.duplicate).toBe(false);
    const second = openAccount(host);
    expect(second.duplicate).toBe(true);
    expect(second.account).toEqual(first.account);
    expect(host.health().accountCount).toBe(1);
  });

  it('the account id is derived deterministically from (key, tenant)', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    expect(openAccount(hostA).account.accountId).toBe(openAccount(hostB).account.accountId);
  });

  it('account opening emits billing:account-opened on the account stream', () => {
    const host = new BillingHost();
    const receipt = openAccount(host);
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: `stream:billing-${receipt.account.accountId.slice('billing-account:'.length)}`,
      }),
    );
    expect(stream).toHaveLength(1);
    expect(stream[0]!.payload.discriminator).toBe('billing:account-opened');
    expect(stream[0]!.sequence).toBe(1);
  });

  it('distinct tenants derive distinct account ids (no cross-tenant collisions)', () => {
    const host = new BillingHost();
    const mine = openAccount(host, 'account-key-1');
    const foreign = unwrap(
      host.openAccount({
        asTenant: OTHER_TENANT,
        authorization: authFor(PRINCIPAL, OTHER_TENANT),
        idempotencyKey: 'account-key-2',
        currency: 'EUR',
        displayName: 'Initech EUR billing account',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    expect(mine.account.accountId).not.toBe(foreign.account.accountId);
  });
});

describe('billing accounts (negative)', () => {
  it('the same key with different content is the typed idempotency-conflict', () => {
    const host = new BillingHost();
    openAccount(host);
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'USD',
        displayName: 'Globex USD billing account',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('a malformed idempotency key is a typed validation rejection', () => {
    const host = new BillingHost();
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'bad key!',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('an account with vendor input fields is rejected', () => {
    const host = new BillingHost();
    const malformed = {
      asTenant: TENANT,
      authorization: AUTH,
      idempotencyKey: 'account-key-2',
      currency: 'EUR',
      displayName: 'Globex EUR',
      openedAt: T0,
      openedBy: PRINCIPAL,
      stripeCustomerId: 'cus_123',
    };
    const error = expectError(host.openAccount(malformed as never));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

describe('W023 grant adoption (positive + negative)', () => {
  it('adopts a REAL W023 grant record (idempotent)', () => {
    const host = new BillingHost();
    const first = unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    expect(first.duplicate).toBe(false);
    const second = unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    expect(second.duplicate).toBe(true);
    expect(host.health().grantCount).toBe(1);
  });

  it('a malformed grant is a typed validation rejection (REAL validator)', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerGrant({
        asTenant: TENANT,
        authorization: AUTH,
        grant: { ...grant(), entitlementId: 'not-an-entitlement' },
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a grant with vendor fields is the typed vendor-fields rejection', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerGrant({
        asTenant: TENANT,
        authorization: AUTH,
        grant: { ...grant(), stripeSubscriptionId: 'sub_123' },
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a grant of ANOTHER tenant is a cross-tenant denial (R12)', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerGrant({
        asTenant: TENANT,
        authorization: AUTH,
        grant: grant({ tenantId: OTHER_TENANT }),
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('the same entitlement id with different content is the typed conflict', () => {
    const host = new BillingHost();
    unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    const error = expectError(
      host.registerGrant({
        asTenant: TENANT,
        authorization: AUTH,
        grant: grant({ listingVersionDigest: 'd'.repeat(64) }),
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('adopts a revocation (idempotent by revocation id) and it flips resolution', () => {
    const host = new BillingHost();
    unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    const resolved = unwrap(
      host.resolveEntitlement({ asTenant: TENANT, authorization: AUTH, listingId: 'listing:stress-suite' }),
    );
    expect(resolved.entitlement.entitlementId).toBe(ENTITLEMENT);
    unwrap(
      host.registerRevocation({
        asTenant: TENANT,
        authorization: AUTH,
        revocation: {
          schemaVersion: 1,
          revocationId: 'revocation:globex-stress-1',
          entitlementId: ENTITLEMENT,
          tenantId: TENANT,
          revokedAt: T3,
          revokedBy: PRINCIPAL,
        },
      }),
    );
    const denied = expectError(
      host.resolveEntitlement({ asTenant: TENANT, authorization: AUTH, listingId: 'listing:stress-suite' }),
    );
    expect(denied.code).toBe('entitlement-revoked');
  });
});

describe('W036 delivery registration (positive + negative)', () => {
  it('registers a verified sealed delivery record (idempotent by digest)', () => {
    const host = new BillingHost();
    const first = unwrap(
      host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }),
    );
    expect(first.duplicate).toBe(false);
    const second = unwrap(
      host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }),
    );
    expect(second.duplicate).toBe(true);
    expect(host.health().registeredDeliveryCount).toBe(1);
  });

  it('a tampered delivery record NEVER registers (only VALIDATED actuals may bill)', () => {
    const host = new BillingHost();
    const tampered = { ...deliveredActual(), tenantId: OTHER_TENANT };
    const error = expectError(
      host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: tampered }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a delivery of ANOTHER tenant is a cross-tenant denial', () => {
    const host = new BillingHost();
    const foreign = deliveredActual();
    const error = expectError(
      host.registerDelivery({
        asTenant: OTHER_TENANT,
        authorization: authFor(PRINCIPAL, OTHER_TENANT),
        delivery: foreign,
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('a malformed delivery envelope is rejected (REAL W036 verification)', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: { nope: true } }),
    );
    expect(error.code).toBe('delivery-actual-rejected');
  });
});

describe('usage intake (positive + negative)', () => {
  it('intakes sealed W023 usage events and folds the account through the REAL fold', () => {
    const host = new BillingHost();
    const receipt = unwrap(
      host.intakeUsageEvents({
        asTenant: TENANT,
        authorization: AUTH,
        events: [usageEvent(1), usageEvent(2)],
      }),
    );
    expect(receipt.admitted).toBe(2);
    const account = unwrap(
      host.usageAccountOf({ asTenant: TENANT, authorization: AUTH, entitlementId: ENTITLEMENT }),
    );
    expect(account.eventCount).toBe(2);
    expect(account.totalUnits).toBe('3500');
  });

  it('re-intake of the same events is duplicate-suppressed', () => {
    const host = new BillingHost();
    unwrap(
      host.intakeUsageEvents({ asTenant: TENANT, authorization: AUTH, events: [usageEvent(1)] }),
    );
    const receipt = unwrap(
      host.intakeUsageEvents({ asTenant: TENANT, authorization: AUTH, events: [usageEvent(1)] }),
    );
    expect(receipt.admitted).toBe(0);
    expect(receipt.duplicates).toBe(1);
  });

  it('the same (stream, sequence) with different content is the typed conflict', () => {
    const host = new BillingHost();
    unwrap(
      host.intakeUsageEvents({ asTenant: TENANT, authorization: AUTH, events: [usageEvent(1)] }),
    );
    const error = expectError(
      host.intakeUsageEvents({
        asTenant: TENANT,
        authorization: AUTH,
        events: [usageEvent(1, { occurredAt: T5 })],
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('a usage event of ANOTHER tenant is a cross-tenant denial', () => {
    const host = new BillingHost();
    const foreign = usageEvent(1, { tenantId: OTHER_TENANT });
    const error = expectError(
      host.intakeUsageEvents({ asTenant: TENANT, authorization: AUTH, events: [foreign] }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('an unsealed usage event is the typed vendor-fields rejection (REAL verification)', () => {
    const host = new BillingHost();
    const error = expectError(
      host.intakeUsageEvents({ asTenant: TENANT, authorization: AUTH, events: [{ nope: true }] }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});
