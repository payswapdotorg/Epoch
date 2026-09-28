// DETERMINISM: two hosts fed the same operation sequences hold
// byte-identical state — same derived ids, same digests, same events,
// same projections. Zero wall-clock, zero randomness (pinned by test).
import { describe, expect, it } from 'vitest';
import { InMemorySettlementPort, billingStreamIdOf } from '@epoch/entitlements';
import { BillingHost } from '../src/index';
import {
  AUTH,
  DELIVERY_ID,
  ENTITLEMENT,
  PRINCIPAL,
  PRINCIPAL_2,
  TENANT,
  T0,
  T1,
  T3,
  T5,
  T6,
  T7,
  deliveredActual,
  grant,
  unwrap,
  usageEvent,
  ONE_TIME_PRICING,
  SUBSCRIPTION_PRICING,
  USAGE_PRICING,
} from './helpers';

const SETTLEMENT_CHECKED_AT = '2026-04-02T08:00:00.000Z';

/** The full reference operation sequence (the golden-path workload). */
function runSequence(host: BillingHost): { accountId: string } {
  const account = unwrap(
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
  const accountId = account.account.accountId;
  unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
  unwrap(
    host.intakeUsageEvents({
      asTenant: TENANT,
      authorization: AUTH,
      events: [usageEvent(1), usageEvent(2)],
    }),
  );
  unwrap(host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }));
  const seat = unwrap(
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
  const port = new InMemorySettlementPort('port:reference-settlement', SETTLEMENT_CHECKED_AT);
  unwrap(host.registerSettlementPort(port));
  const draft = unwrap(
    host.draftInvoice({
      asTenant: TENANT,
      authorization: AUTH,
      idempotencyKey: 'inv-1',
      accountId,
      sources: [
        { basis: 'subscription', entitlementId: ENTITLEMENT, periodStart: T0, periodEnd: T1, pricing: SUBSCRIPTION_PRICING },
        { basis: 'usage', entitlementId: ENTITLEMENT, pricing: USAGE_PRICING },
        {
          basis: 'delivery-actual',
          deliveryId: DELIVERY_ID,
          unitRates: { m3: { unitAmount: '18.50', currency: 'EUR' } },
        },
      ],
      createdAt: T5,
      createdBy: PRINCIPAL,
    }),
  );
  const invoiceId = draft.invoice.invoiceId;
  unwrap(
    host.issueInvoice({ asTenant: TENANT, authorization: AUTH, invoiceId, issuedAt: T6, issuedBy: PRINCIPAL }),
  );
  port.markSettled({ invoiceId, tenantId: TENANT, portReference: 'settle-123' });
  unwrap(
    host.settleInvoice({
      asTenant: TENANT,
      authorization: AUTH,
      invoiceId,
      idempotencyKey: 'settle-1',
      settledAt: T7,
    }),
  );
  unwrap(
    host.releaseSeat({
      asTenant: TENANT,
      authorization: AUTH,
      idempotencyKey: 'release-1',
      seatAssignmentId: seat.seatAssignment!.seatAssignmentId,
      releasedAt: T3,
      releasedBy: PRINCIPAL,
    }),
  );
  return { accountId };
}

describe('billing host determinism', () => {
  it('two hosts fed the same sequence hold byte-identical health', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    runSequence(hostA);
    runSequence(hostB);
    expect(hostA.health()).toEqual(hostB.health());
  });

  it('the same sequence derives the same invoice ids and digests', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    runSequence(hostA);
    runSequence(hostB);
    const listingA = unwrap(hostA.listInvoices({ asTenant: TENANT, authorization: AUTH }));
    const listingB = unwrap(hostB.listInvoices({ asTenant: TENANT, authorization: AUTH }));
    expect(listingA).toEqual(listingB);
    const invoiceA = unwrap(hostA.getInvoice({ asTenant: TENANT, authorization: AUTH, invoiceId: listingA[0]!.invoiceId }));
    const invoiceB = unwrap(hostB.getInvoice({ asTenant: TENANT, authorization: AUTH, invoiceId: listingB[0]!.invoiceId }));
    expect(invoiceA).toEqual(invoiceB);
    expect(invoiceA.contentDigest).toBe(invoiceB.contentDigest);
  });

  it('the same sequence produces byte-identical event streams', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    const { accountId } = runSequence(hostA);
    runSequence(hostB);
    const streamA = unwrap(
      hostA.readStream({ asTenant: TENANT, authorization: AUTH, streamId: billingStreamIdOf(accountId) }),
    );
    const streamB = unwrap(
      hostB.readStream({ asTenant: TENANT, authorization: AUTH, streamId: billingStreamIdOf(accountId) }),
    );
    expect(streamA).toEqual(streamB);
    const seatsA = unwrap(
      hostA.readStream({ asTenant: TENANT, authorization: AUTH, streamId: 'stream:entitlements-globex-stress' }),
    );
    const seatsB = unwrap(
      hostB.readStream({ asTenant: TENANT, authorization: AUTH, streamId: 'stream:entitlements-globex-stress' }),
    );
    expect(seatsA).toEqual(seatsB);
  });

  it('reordered usage intake produces the identical folded account', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    unwrap(
      hostA.intakeUsageEvents({
        asTenant: TENANT,
        authorization: AUTH,
        events: [usageEvent(1), usageEvent(2)],
      }),
    );
    unwrap(
      hostB.intakeUsageEvents({
        asTenant: TENANT,
        authorization: AUTH,
        events: [usageEvent(2), usageEvent(1)],
      }),
    );
    const accountA = unwrap(
      hostA.usageAccountOf({ asTenant: TENANT, authorization: AUTH, entitlementId: ENTITLEMENT }),
    );
    const accountB = unwrap(
      hostB.usageAccountOf({ asTenant: TENANT, authorization: AUTH, entitlementId: ENTITLEMENT }),
    );
    expect(accountA).toEqual(accountB);
  });

  it('the describe surface is a stable typed projection', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    expect(hostA.describe()).toEqual(hostB.describe());
  });

  it('ONE_TIME_PRICING derives the identical canonical amount across hosts', () => {
    const hostA = new BillingHost();
    const hostB = new BillingHost();
    for (const host of [hostA, hostB]) {
      const account = unwrap(
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
      unwrap(
        host.draftInvoice({
          asTenant: TENANT,
          authorization: AUTH,
          idempotencyKey: 'inv-1',
          accountId: account.account.accountId,
          sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
          createdAt: T5,
          createdBy: PRINCIPAL,
        }),
      );
    }
    const invoicesA = unwrap(hostA.listInvoices({ asTenant: TENANT, authorization: AUTH }));
    const invoicesB = unwrap(hostB.listInvoices({ asTenant: TENANT, authorization: AUTH }));
    expect(invoicesA[0]!.totalAmount).toBe('2400');
    expect(invoicesA).toEqual(invoicesB);
  });
});
