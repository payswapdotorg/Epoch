// INVOICE SESSION coverage: the golden path draft -> issue -> settle
// (kernel-derived amounts from every source family), void, typed
// lifecycle conflicts, settlement rejections, and tenant-scoped reads.
import { describe, expect, it } from 'vitest';
import { InMemorySettlementPort } from '@epoch/entitlements';
import { BillingHost } from '../src/index';
import {
  AUTH,
  DELIVERY_ID,
  authFor,
  ENTITLEMENT,
  OTHER_TENANT,
  PRINCIPAL,
  PRINCIPAL_2,
  PRINCIPAL_3,
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
  SEAT_PRICING,
  SUBSCRIPTION_PRICING,
  USAGE_PRICING,
} from './helpers';

const SETTLEMENT_CHECKED_AT = '2026-04-02T08:00:00.000Z';

/** A primed host: account + grant + usage + delivery registered. */
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
  unwrap(
    host.intakeUsageEvents({
      asTenant: TENANT,
      authorization: AUTH,
      events: [usageEvent(1), usageEvent(2)],
    }),
  );
  unwrap(host.registerDelivery({ asTenant: TENANT, authorization: AUTH, delivery: deliveredActual() }));
  return { host, accountId: account.account.accountId };
}

describe('invoice sessions (positive)', () => {
  it('drafts an invoice with kernel-derived amounts from every source family', () => {
    const { host, accountId } = primedHost();
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
    const receipt = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
          { basis: 'subscription', entitlementId: ENTITLEMENT, periodStart: T0, periodEnd: T1, pricing: SUBSCRIPTION_PRICING },
          { basis: 'seat', entitlementId: ENTITLEMENT, pricing: SEAT_PRICING },
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
    // subscription 99.5 + seat 30 + usage 62.5 + delivery 2192.25
    expect(receipt.totals.totalAmount).toBe('2384.25');
    expect(receipt.totals.lineCount).toBe(4);
    expect(receipt.invoice.status).toBe('draft');
    expect(receipt.invoice.lines.map((line) => line.basis).sort()).toEqual([
      'delivery-actual',
      'seat',
      'subscription',
      'usage',
    ]);
  });

  it('one-time pricing bills the acquisition amount', () => {
    const { host, accountId } = primedHost();
    const receipt = unwrap(
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
    expect(receipt.totals.totalAmount).toBe('2400');
  });

  it('the usage line carries the exact event digests it bills', () => {
    const { host, accountId } = primedHost();
    const receipt = unwrap(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'usage', entitlementId: ENTITLEMENT, pricing: USAGE_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    const usageLine = receipt.invoice.lines.find((line) => line.basis === 'usage')!;
    expect(usageLine.usageEventDigests).toHaveLength(2);
    expect(usageLine.quantity).toBe('2500');
  });

  it('draft -> issue -> settle through the SettlementPort seam', () => {
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
    const issued = unwrap(
      host.issueInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        issuedAt: T6,
        issuedBy: PRINCIPAL,
        dueAt: T7,
      }),
    );
    expect(issued.invoice.status).toBe('issued');
    port.markSettled({ invoiceId, tenantId: TENANT, portReference: 'settle-123' });
    const settled = unwrap(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    expect(settled.invoice.status).toBe('settled');
    expect(settled.invoice.settlementPortId).toBe('port:reference-settlement');
    expect(settled.outcome?.result).toBe('settled');
    expect(settled.outcome?.portReference).toBe('settle-123');
  });

  it('voiding an issued invoice is legal (terminal)', () => {
    const { host, accountId } = primedHost();
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
    const voided = unwrap(
      host.voidInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        voidedAt: T7,
        voidedBy: PRINCIPAL,
        reason: 'duplicate acquisition',
      }),
    );
    expect(voided.invoice.status).toBe('voided');
  });

  it('the account stream carries the full invoice lifecycle', () => {
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
    port.markSettled({ invoiceId, tenantId: TENANT, portReference: 'settle-1' });
    unwrap(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: `stream:billing-${accountId.slice('billing-account:'.length)}`,
      }),
    );
    const discriminators = stream.map((event) => event.payload.discriminator);
    expect(discriminators).toEqual([
      'billing:account-opened',
      'billing:invoice-drafted',
      'billing:invoice-issued',
      'billing:invoice-settled',
    ]);
    // Contiguous sequences with causal parents.
    expect(stream.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(stream[3]!.causalParent).toEqual({ streamId: stream[3]!.streamId, sequence: 3 });
  });

  it('listInvoices projects a deterministic, tenant-scoped listing', () => {
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
    const listing = unwrap(host.listInvoices({ asTenant: TENANT, authorization: AUTH }));
    expect(listing).toHaveLength(1);
    expect(listing[0]!.status).toBe('draft');
    expect(listing[0]!.totalAmount).toBe('2400');
  });
});

describe('invoice sessions (negative)', () => {
  it('drafting against an unknown account is the typed unknown-account', () => {
    const host = new BillingHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId: 'billing-account:missing',
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: ONE_TIME_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-account');
  });

  it('an empty source list is the typed empty-invoice rejection', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('empty-invoice-rejected');
  });

  it('free pricing derives no billable lines (unsupported-pricing-model)', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'one-time', entitlementId: ENTITLEMENT, pricing: { kind: 'free' } }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unsupported-pricing-model');
  });

  it('a malformed pricing model is a typed marketplace rejection', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
          {
            basis: 'one-time',
            entitlementId: ENTITLEMENT,
            pricing: { kind: 'one-time', amount: '-5', currency: 'EUR' } as never,
          },
        ],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    // The marketplace authority (W023) rejects the malformed model; the
    // adapter boundary carries it as a typed validation rejection.
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('invalid-pricing-model');
  });

  it('a currency mismatch between derived lines and the account is typed', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
          {
            basis: 'one-time',
            entitlementId: ENTITLEMENT,
            pricing: { kind: 'one-time', amount: '10', currency: 'USD' },
          },
        ],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('currency-mismatch');
  });

  it('an unregistered delivery never bills (only VALIDATED actuals may bill)', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [
          {
            basis: 'delivery-actual',
            deliveryId: 'delivery:not-registered',
            unitRates: { m3: { unitAmount: '18.50', currency: 'EUR' } },
          },
        ],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-delivery');
  });

  it('a quantity actual without a unit rate never silently bills zero', () => {
    const { host, accountId } = primedHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId,
        sources: [{ basis: 'delivery-actual', deliveryId: DELIVERY_ID }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('delivery-actual-rejected');
  });

  it('usage with no metered events is the typed fold rejection', () => {
    const host = new BillingHost();
    const account = unwrap(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'inv-1',
        accountId: account.account.accountId,
        sources: [{ basis: 'usage', entitlementId: ENTITLEMENT, pricing: USAGE_PRICING }],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('settling without a registered port is the typed seam-absent rejection', () => {
    const { host, accountId } = primedHost();
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
    const error = expectError(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    expect(error.code).toBe('settlement-port-unavailable');
  });

  it('a port outcome of unpaid/declined rejects the settle (invoice stays issued)', () => {
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
    port.markDeclined({ invoiceId, tenantId: TENANT });
    const error = expectError(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    expect(error.code).toBe('settlement-rejected');
    expect((error as { result?: string }).result).toBe('declined');
    const still = unwrap(host.getInvoice({ asTenant: TENANT, authorization: AUTH, invoiceId }));
    expect(still.status).toBe('issued');
  });

  it('settling a draft is the typed lifecycle conflict', () => {
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
    port.markSettled({ invoiceId, tenantId: TENANT, portReference: 'settle-1' });
    const error = expectError(
      host.settleInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId,
        idempotencyKey: 'settle-1',
        settledAt: T7,
      }),
    );
    expect(error.code).toBe('invoice-state-conflict');
  });

  it('an unknown invoice is the typed unknown-invoice on every operation', () => {
    const { host } = primedHost();
    const error = expectError(
      host.issueInvoice({
        asTenant: TENANT,
        authorization: AUTH,
        invoiceId: 'invoice:missing',
        issuedAt: T6,
        issuedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-invoice');
  });

  it('a read of ANOTHER tenant\'s invoice is a cross-tenant denial', () => {
    const { host, accountId } = primedHost();
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
    const foreignAuth = authFor(PRINCIPAL, OTHER_TENANT);
    const error = expectError(
      host.getInvoice({
        asTenant: OTHER_TENANT,
        authorization: foreignAuth,
        invoiceId: draft.invoice.invoiceId,
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('the tenant-scoped listing never shows another tenant\'s invoices', () => {
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
    const foreignAuth = authFor(PRINCIPAL, OTHER_TENANT);
    const listing = unwrap(host.listInvoices({ asTenant: OTHER_TENANT, authorization: foreignAuth }));
    expect(listing).toHaveLength(0);
  });
});

describe('seat operations (positive + negative)', () => {
  it('assigns and releases seats with events on the entitlement stream', () => {
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
    expect(assigned.seatAccount.activeCount).toBe(1);
    const streamId = `stream:entitlements-${ENTITLEMENT.slice('entitlement:'.length)}`;
    const stream = unwrap(host.readStream({ asTenant: TENANT, authorization: AUTH, streamId }));
    expect(stream.map((event) => event.payload.discriminator)).toEqual(['entitlements:seat-assigned']);
    const released = unwrap(
      host.releaseSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'release-1',
        seatAssignmentId: assigned.seatAssignment!.seatAssignmentId,
        releasedAt: T3,
        releasedBy: PRINCIPAL,
      }),
    );
    expect(released.seatAccount.activeCount).toBe(0);
    const streamAfter = unwrap(host.readStream({ asTenant: TENANT, authorization: AUTH, streamId }));
    expect(streamAfter.map((event) => event.payload.discriminator)).toEqual([
      'entitlements:seat-assigned',
      'entitlements:seat-released',
    ]);
  });

  it('seat capacity is enforced through the kernel admission', () => {
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
    unwrap(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-2',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL,
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-3',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL_3,
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('seat-limit-exceeded');
  });

  it('a seat assignment against an unregistered entitlement is typed', () => {
    const host = new BillingHost();
    const error = expectError(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-1',
        entitlementId: 'entitlement:not-registered',
        principalId: PRINCIPAL_2,
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('releasing an unknown seat assignment is typed', () => {
    const { host } = primedHost();
    const error = expectError(
      host.releaseSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'release-1',
        seatAssignmentId: 'seat:missing',
        releasedAt: T3,
        releasedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('unknown-seat-assignment');
  });

  it('a revocation immediately refuses further seat assignments', () => {
    const { host } = primedHost();
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
    const error = expectError(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-1',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL_2,
        assignedAt: T5,
        assignedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('entitlement-revoked');
  });
});

describe('entitlement resolution at the host (tenancy seam)', () => {
  it('resolves with the W009 hierarchy attached (workspace/project narrowing)', () => {
    const { host } = primedHost();
    const resolved = unwrap(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:stress-suite',
        projectId: 'project:globex-tower',
      }),
    );
    expect(resolved.entitlement.entitlementId).toBe(ENTITLEMENT);
    expect(resolved.tenancyPath).toEqual([]);
  });

  it('denials echo the W023 authority (entitlement-denied)', () => {
    const { host } = primedHost();
    const error = expectError(
      host.resolveEntitlement({
        asTenant: TENANT,
        authorization: AUTH,
        listingId: 'listing:unknown',
      }),
    );
    expect(error.code).toBe('entitlement-denied');
  });
});
