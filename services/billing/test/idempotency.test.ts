// REPLAY / IDEMPOTENCY coverage: every intake and mutating operation is
// duplicate-suppressed — same key + same content returns the ORIGINAL
// receipt; same key with different content is the typed
// `idempotency-conflict` (the W028 duplicate-suppression pin).
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
  expectError,
  grant,
  unwrap,
  usageEvent,
  ONE_TIME_PRICING,
} from './helpers';

const SETTLEMENT_CHECKED_AT = '2026-04-02T08:00:00.000Z';

function primedHost(): { host: BillingHost; accountId: string } {
  const host = new BillingHost();
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
  unwrap(host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }));
  unwrap(
    host.intakeUsageEvents({
      asTenant: TENANT,
      authorization: AUTH,
      events: [usageEvent(1), usageEvent(2)],
    }),
  );
  return { host, accountId: account.account.accountId };
}

describe('replay / idempotency', () => {
  it('account opening replays return the ORIGINAL receipt', () => {
    const { host } = primedHost();
    const replay = unwrap(
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
    expect(replay.duplicate).toBe(true);
    expect(host.health().accountCount).toBe(1);
    expect(host.health().eventCount).toBe(1);
  });

  it('seat assignment replays return the ORIGINAL receipt (no second seat consumed)', () => {
    const { host } = primedHost();
    const first = unwrap(
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
    const replay = unwrap(
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
    expect(replay.duplicate).toBe(true);
    expect(replay.seatAssignment!.seatAssignmentId).toBe(first.seatAssignment!.seatAssignmentId);
    expect(host.health().seatAssignmentCount).toBe(1);
    expect(host.health().activeSeatCount).toBe(1);
  });

  it('the same seat key with different content is the typed conflict', () => {
    const { host } = primedHost();
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
    const error = expectError(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-1',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL,
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('invoice draft replays return the ORIGINAL invoice (byte-identical)', () => {
    const { host, accountId } = primedHost();
    const first = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    const replay = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.invoice).toEqual(first.invoice);
    expect(host.health().invoiceCount).toBe(1);
    // one account event + one drafted event only.
    expect(host.health().eventCount).toBe(2);
  });

  it('the same invoice key with different sources is the typed conflict', () => {
    const { host, accountId } = primedHost();
    unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
          { basis: 'one-time', entitlementId: ENTITLEMENT, pricing: { kind: 'one-time', amount: '10', currency: 'EUR' } },
        ],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('settle replays return the settled invoice (no double settlement)', () => {
    const { host, accountId } = primedHost();
    const port = new InMemorySettlementPort('port:reference-settlement', SETTLEMENT_CHECKED_AT);
    unwrap(host.registerSettlementPort(port));
    const draft = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    const invoiceId = draft.invoice.invoiceId;
    unwrap(
      host.issueInvoice({ asTenant: TENANT, authorization: AUTH, invoiceId, issuedAt: T6, issuedBy: PRINCIPAL }),
    );
    port.markSettled({ invoiceId, tenantId: TENANT, portReference: 'settle-123' });
    const first = unwrap(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    const replay = unwrap(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    expect(replay.invoice).toEqual(first.invoice);
    expect(replay.outcome).toBeNull();
    const settledEvents = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: billingStreamIdOf(accountId),
      }),
    ).filter((event) => event.payload.discriminator === 'billing:invoice-settled');
    expect(settledEvents).toHaveLength(1);
  });

  it('usage intake replays are duplicate-suppressed with stable counts', () => {
    const { host } = primedHost();
    const replay = unwrap(
      host.intakeUsageEvents({
        asTenant: TENANT,
        authorization: AUTH,
        events: [usageEvent(1), usageEvent(2)],
      }),
    );
    expect(replay.admitted).toBe(0);
    expect(replay.duplicates).toBe(2);
    expect(host.health().usageEventCount).toBe(2);
  });

  it('delivery registration replays are digest-suppressed', () => {
    const { host } = primedHost();
    const replay = unwrap(
      host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }),
    );
    expect(replay.duplicate).toBe(true);
    expect(host.health().registeredDeliveryCount).toBe(1);
  });

  it('grant adoption replays are id-suppressed', () => {
    const { host } = primedHost();
    const replay = unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    expect(replay.duplicate).toBe(true);
    expect(host.health().grantCount).toBe(1);
  });

  it('delivery-actual lines re-derive identically from the registered record (replay-safe)', () => {
    const { host, accountId } = primedHost();
    const first = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
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
    const second = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-2',
        accountId,
        sources: [
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
    expect(second.invoice.lines).toEqual(first.invoice.lines);
    expect(second.totals.totalAmount).toBe(first.totals.totalAmount);
  });

  it('a released seat replay returns the ORIGINAL release receipt', () => {
    const { host } = primedHost();
    const assigned = unwrap(
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
    const first = unwrap(
      host.releaseSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'release-1',
        seatAssignmentId: assigned.seatAssignment!.seatAssignmentId,
        releasedAt: T3,
        releasedBy: PRINCIPAL,
      }),
    );
    const replay = unwrap(
      host.releaseSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'release-1',
        seatAssignmentId: assigned.seatAssignment!.seatAssignmentId,
        releasedAt: T3,
        releasedBy: PRINCIPAL,
      }),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.seatRelease!.releaseId).toBe(first.seatRelease!.releaseId);
    expect(host.health().activeSeatCount).toBe(0);
  });
});
