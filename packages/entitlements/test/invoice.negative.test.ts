// Negative coverage of invoice records: illegal lifecycle transitions,
// arithmetic discipline (amount != quantity x unitAmount), currency
// uniformity, ordering, status-field discipline, tamper detection, and
// vendor-field rejection.
import { describe, expect, it } from 'vitest';
import {
  foldInvoiceTotals,
  issueInvoice,
  openInvoice,
  settleInvoice,
  verifySealedInvoice,
  voidInvoice,
} from '../src/index';
import {
  ACCOUNT,
  ENTITLEMENT,
  INVOICE,
  PRINCIPAL,
  SETTLEMENT,
  SETTLEMENT_PORT,
  TENANT,
  T0,
  T1,
  T2,
  T3,
  expectError,
  unwrap,
} from './fixtures';

/** One one-time line fixture (exact arithmetic). */
function oneTimeLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineId: 'line:acquisition',
    basis: 'one-time',
    description: 'One-time acquisition',
    quantity: '1',
    unitAmount: '2400.00',
    amount: '2400.00',
    currency: 'EUR',
    entitlementId: ENTITLEMENT,
    ...overrides,
  };
}

/** One draft invoice content fixture. */
function invoiceContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.billing.invoice',
    schemaVersion: 1,
    invoiceId: INVOICE,
    tenantId: TENANT,
    accountId: ACCOUNT,
    currency: 'EUR',
    lines: [oneTimeLine()],
    status: 'draft',
    createdAt: T2,
    createdBy: PRINCIPAL,
    ...overrides,
  };
}

describe('invoice admission (negative)', () => {
  it('an invoice with no lines is rejected (empty-invoice)', () => {
    const error = expectError(openInvoice(invoiceContent({ lines: [] })));
    expect(error.code).toBe('validation');
  });

  it('amount must equal quantity x unitAmount (exact decimal arithmetic)', () => {
    const error = expectError(
      openInvoice(invoiceContent({ lines: [oneTimeLine({ amount: '2400.01' })] })),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('quantity x unitAmount');
  });

  it('a line currency disagreeing with the invoice currency is rejected', () => {
    const error = expectError(
      openInvoice(invoiceContent({ lines: [oneTimeLine({ currency: 'USD' })] })),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('disagrees with the invoice currency');
  });

  it('lines must be sorted and duplicate-free by lineId', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [oneTimeLine({ lineId: 'line:b' }), oneTimeLine({ lineId: 'line:a' })],
        }),
      ),
    );
    expect(error.code).toBe('validation');
    const duplicate = expectError(
      openInvoice(invoiceContent({ lines: [oneTimeLine(), oneTimeLine()] })),
    );
    expect(duplicate.code).toBe('validation');
  });

  it('a usage line without usage-event digests is rejected', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:usage-bare',
              basis: 'usage',
              description: 'Usage without provenance',
              quantity: '10',
              unitAmount: '0.025',
              amount: '0.25',
              currency: 'EUR',
              entitlementId: ENTITLEMENT,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('usage-event digests');
  });

  it('a delivery-actual line without its W036 reference is rejected', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:delivery-bare',
              basis: 'delivery-actual',
              description: 'Delivery without provenance',
              quantity: '1',
              unitAmount: '12500.75',
              amount: '12500.75',
              currency: 'EUR',
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('validated-actual reference');
  });

  it('a subscription line without period bounds is rejected', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:subscription-bare',
              basis: 'subscription',
              description: 'Subscription without period',
              quantity: '1',
              unitAmount: '99.50',
              amount: '99.50',
              currency: 'EUR',
              entitlementId: ENTITLEMENT,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('billing period bounds');
  });

  it('an entitlement-priced line without its entitlement id is rejected', () => {
    const error = expectError(
      openInvoice(invoiceContent({ lines: [oneTimeLine({ entitlementId: undefined })] })),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('entitlement id');
  });

  it('a draft invoice cannot carry lifecycle fields', () => {
    const error = expectError(openInvoice(invoiceContent({ issuedAt: T3, issuedBy: PRINCIPAL })));
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('lifecycle fields');
  });

  it('an issued invoice must carry issuedAt and issuedBy', () => {
    const error = expectError(openInvoice(invoiceContent({ status: 'issued' })));
    expect(error.code).toBe('validation');
  });

  it('a settled invoice must carry its settlement provenance', () => {
    const error = expectError(
      openInvoice(invoiceContent({ status: 'settled', issuedAt: T3, issuedBy: PRINCIPAL })),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('settlementId');
  });

  it('a voided invoice must carry voidedAt and voidedBy', () => {
    const error = expectError(openInvoice(invoiceContent({ status: 'voided' })));
    expect(error.code).toBe('validation');
  });

  it('an unknown status is rejected', () => {
    const error = expectError(openInvoice(invoiceContent({ status: 'overdue' })));
    expect(error.code).toBe('validation');
  });

  it('vendor fields are the typed vendor-fields rejection', () => {
    const error = expectError(
      openInvoice(invoiceContent({ stripeInvoiceId: 'in_123' })),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a line with vendor fields is the typed vendor-fields rejection', () => {
    const error = expectError(
      openInvoice(invoiceContent({ lines: [oneTimeLine({ taxCode: 'DE19' })] })),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('schemaVersion skew is reported at the version path', () => {
    const error = expectError(openInvoice(invoiceContent({ schemaVersion: 999 })));
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('schemaVersion');
  });

  it('usageEventDigests must be sorted and duplicate-free', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:usage-unsorted',
              basis: 'usage',
              description: 'Usage',
              quantity: '10',
              unitAmount: '0.025',
              amount: '0.25',
              currency: 'EUR',
              entitlementId: ENTITLEMENT,
              usageEventDigests: ['f'.repeat(64), 'a'.repeat(64)],
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('sorted ascending');
  });

  it('inverted subscription period bounds are rejected', () => {
    const error = expectError(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:subscription-inverted',
              basis: 'subscription',
              description: 'Subscription',
              quantity: '1',
              unitAmount: '99.50',
              amount: '99.50',
              currency: 'EUR',
              entitlementId: ENTITLEMENT,
              periodStart: T1,
              periodEnd: T0,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });
});

describe('invoice lifecycle transitions (negative)', () => {
  it('settling a draft is an invoice-state-conflict', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const error = expectError(
      settleInvoice(draft, {
        settledAt: T3,
        settlementId: SETTLEMENT,
        settlementPortId: SETTLEMENT_PORT,
      }),
    );
    expect(error.code).toBe('invoice-state-conflict');
  });

  it('issuing an issued invoice is an invoice-state-conflict', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL }));
    const error = expectError(issueInvoice(issued, { issuedAt: T3, issuedBy: PRINCIPAL }));
    expect(error.code).toBe('invoice-state-conflict');
  });

  it('voiding a settled invoice is an invoice-state-conflict (terminal)', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL }));
    const settled = unwrap(
      settleInvoice(issued, {
        settledAt: T3,
        settlementId: SETTLEMENT,
        settlementPortId: SETTLEMENT_PORT,
      }),
    );
    const error = expectError(voidInvoice(settled, { voidedAt: T3, voidedBy: PRINCIPAL }));
    expect(error.code).toBe('invoice-state-conflict');
    expect((error as { from?: string }).from).toBe('settled');
    expect((error as { to?: string }).to).toBe('voided');
  });

  it('settling a settled invoice is an invoice-state-conflict (terminal)', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL }));
    const settled = unwrap(
      settleInvoice(issued, {
        settledAt: T3,
        settlementId: SETTLEMENT,
        settlementPortId: SETTLEMENT_PORT,
      }),
    );
    const error = expectError(
      settleInvoice(settled, {
        settledAt: T3,
        settlementId: SETTLEMENT,
        settlementPortId: SETTLEMENT_PORT,
      }),
    );
    expect(error.code).toBe('invoice-state-conflict');
  });
});

describe('invoice tamper detection (negative)', () => {
  it('a tampered line description never verifies (digest-mismatch)', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const tampered = {
      ...sealed,
      lines: [oneTimeLine({ description: 'Tampered description' })],
    };
    const error = expectError(verifySealedInvoice(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a tampered line amount never admits (the line arithmetic refinement)', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const tampered = {
      ...sealed,
      lines: [oneTimeLine({ amount: '0.01' })],
    };
    const error = expectError(verifySealedInvoice(tampered));
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('quantity x unitAmount');
  });

  it('a structurally-parseable but refinement-violating envelope never verifies', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const tampered = {
      ...sealed,
      lines: [oneTimeLine({ amount: '2400.01', lineId: 'line:acquisition' })],
      contentDigest: sealed.contentDigest,
    };
    // digest will mismatch AND the content refinement fails — either typed
    // rejection is correct; both are non-ok.
    const outcome = verifySealedInvoice(tampered);
    expect(outcome.ok).toBe(false);
  });

  it('a tampered envelope never folds', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const tampered = { ...sealed, currency: 'USD' };
    const error = expectError(foldInvoiceTotals(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});
