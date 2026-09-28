// Positive coverage of invoice records: sealing/verification, the typed
// lifecycle (draft -> issued -> settled | voided), exact decimal folds,
// and determinism of the sealed envelope.
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
  unwrap,
} from './fixtures';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

/** One usage line fixture (exact arithmetic). */
function usageLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineId: 'line:usage-april',
    basis: 'usage',
    description: 'Metered usage (3500 simulation-run, 1000 included)',
    quantity: '2500',
    unitAmount: '0.025',
    amount: '62.5',
    currency: 'EUR',
    entitlementId: ENTITLEMENT,
    listingId: 'listing:stress-suite',
    usageEventDigests: [DIGEST_A, DIGEST_B].sort(),
    ...overrides,
  };
}

/** One subscription line fixture. */
function subscriptionLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lineId: 'line:subscription-april',
    basis: 'subscription',
    description: 'Subscription (monthly)',
    quantity: '1',
    unitAmount: '99.50',
    amount: '99.50',
    currency: 'EUR',
    entitlementId: ENTITLEMENT,
    periodStart: T0,
    periodEnd: T1,
    ...overrides,
  };
}

/** One draft invoice content fixture (sorted lines). */
function invoiceContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.billing.invoice',
    schemaVersion: 1,
    invoiceId: INVOICE,
    tenantId: TENANT,
    accountId: ACCOUNT,
    currency: 'EUR',
    lines: [subscriptionLine(), usageLine()].sort(
      (a, b) => (a.lineId as string) < (b.lineId as string) ? -1 : 1,
    ),
    status: 'draft',
    createdAt: T2,
    createdBy: PRINCIPAL,
    ...overrides,
  };
}

describe('invoice sealing (positive)', () => {
  it('opens (validates + seals) a draft invoice', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    expect(sealed.status).toBe('draft');
    expect(sealed.lines).toHaveLength(2);
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verification round-trips (schema + digest + refinements)', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const verified = unwrap(verifySealedInvoice(sealed));
    expect(verified).toEqual(sealed);
  });

  it('key order never changes the digest (canonical JSON)', () => {
    const a = unwrap(openInvoice(invoiceContent()));
    const content = invoiceContent() as Record<string, unknown>;
    const reversed = Object.fromEntries(Object.entries(content).reverse());
    const b = unwrap(openInvoice(reversed));
    expect(b.contentDigest).toBe(a.contentDigest);
  });
});

describe('the invoice lifecycle (positive)', () => {
  it('draft -> issued -> settled records the typed provenance', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(
      issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL, dueAt: T3 }),
    );
    expect(issued.status).toBe('issued');
    expect(issued.issuedAt).toBe(T3);
    expect(issued.dueAt).toBe(T3);
    const settled = unwrap(
      settleInvoice(issued, {
        settledAt: T3,
        settlementId: SETTLEMENT,
        settlementPortId: SETTLEMENT_PORT,
      }),
    );
    expect(settled.status).toBe('settled');
    expect(settled.settlementId).toBe(SETTLEMENT);
    expect(settled.settlementPortId).toBe(SETTLEMENT_PORT);
    expect(settled.lines).toEqual(draft.lines);
  });

  it('draft -> voided is legal (terminal withdrawal)', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const voided = unwrap(voidInvoice(draft, { voidedAt: T3, voidedBy: PRINCIPAL }));
    expect(voided.status).toBe('voided');
    expect(voided.voidedBy).toBe(PRINCIPAL);
  });

  it('issued -> voided is legal (terminal withdrawal after issue)', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL }));
    const voided = unwrap(voidInvoice(issued, { voidedAt: T3, voidedBy: PRINCIPAL }));
    expect(voided.status).toBe('voided');
  });

  it('every transition produces a NEW sealed record (facts append-only)', () => {
    const draft = unwrap(openInvoice(invoiceContent()));
    const issued = unwrap(issueInvoice(draft, { issuedAt: T3, issuedBy: PRINCIPAL }));
    expect(issued.contentDigest).not.toBe(draft.contentDigest);
    expect(draft.status).toBe('draft');
  });
});

describe('invoice folds (positive)', () => {
  it('totals are exact decimal sums with per-basis counts', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const totals = unwrap(foldInvoiceTotals(sealed));
    expect(totals.totalAmount).toBe('162');
    expect(totals.lineCount).toBe(2);
    expect(totals.linesByBasis['subscription']).toBe(1);
    expect(totals.linesByBasis['usage']).toBe(1);
    expect(totals.linesByBasis['delivery-actual']).toBe(0);
    expect(totals.currency).toBe('EUR');
  });

  it('a zero-amount line folds to an exact zero total', () => {
    const sealed = unwrap(
      openInvoice(
        invoiceContent({
          lines: [
            {
              lineId: 'line:usage-included',
              basis: 'usage',
              description: 'Metered usage inside the allowance',
              quantity: '0',
              unitAmount: '0.025',
              amount: '0',
              currency: 'EUR',
              entitlementId: ENTITLEMENT,
              listingId: 'listing:stress-suite',
              usageEventDigests: [DIGEST_A],
            },
          ],
        }),
      ),
    );
    const totals = unwrap(foldInvoiceTotals(sealed));
    expect(totals.totalAmount).toBe('0');
  });

  it('the fold total equals the exact decimal sum of the line amounts', () => {
    const sealed = unwrap(openInvoice(invoiceContent()));
    const totals = unwrap(foldInvoiceTotals(sealed));
    const sum = sealed.lines.reduce((acc, line) => acc + Number(line.amount), 0);
    expect(Number(totals.totalAmount)).toBe(sum);
  });
});
