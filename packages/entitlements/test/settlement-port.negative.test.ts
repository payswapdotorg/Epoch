// Negative coverage of the SettlementPort seam: malformed requests are
// typed rejections, and the outcome vocabulary stays closed (no charge,
// capture, refund-execution, or credential vocabulary anywhere).
import { describe, expect, it } from 'vitest';
import { InMemorySettlementPort, SETTLEMENT_RESULTS, parseSettlementOutcome } from '../src/index';
import { INVOICE, TENANT, expectError } from './fixtures';

describe('settlement requests (negative)', () => {
  it('a malformed request is a typed validation rejection', () => {
    const port = new InMemorySettlementPort('port:reference-settlement');
    const error = expectError(
      port.checkSettlement({ invoiceId: 'not-an-invoice', tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(error.code).toBe('validation');
  });

  it('a request with vendor fields is the typed vendor-fields rejection', () => {
    const port = new InMemorySettlementPort('port:reference-settlement');
    const malformed = {
      invoiceId: INVOICE,
      tenantId: TENANT,
      amount: '162',
      currency: 'EUR',
      stripePaymentIntentId: 'pi_123',
    };
    const error = expectError(port.checkSettlement(malformed as never));
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a malformed amount is rejected', () => {
    const port = new InMemorySettlementPort('port:reference-settlement');
    const error = expectError(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '16.2.0', currency: 'EUR' }),
    );
    expect(error.code).toBe('validation');
  });

  it('a lowercase currency code is rejected (ISO 4217 grammar)', () => {
    const port = new InMemorySettlementPort('port:reference-settlement');
    const error = expectError(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'eur' }),
    );
    expect(error.code).toBe('validation');
  });
});

describe('settlement outcomes (negative)', () => {
  it('an outcome outside the closed vocabulary is rejected', () => {
    const error = expectError(
      parseSettlementOutcome({
        portId: 'port:reference-settlement',
        checkedAt: '2026-04-02T08:00:00.000Z',
        result: 'refunded',
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('the closed vocabulary contains ONLY check results (no execution verbs)', () => {
    expect([...SETTLEMENT_RESULTS].sort()).toEqual(['declined', 'settled', 'unpaid']);
    expect(SETTLEMENT_RESULTS).not.toContain('captured');
    expect(SETTLEMENT_RESULTS).not.toContain('charged');
    expect(SETTLEMENT_RESULTS).not.toContain('refunded');
    expect(SETTLEMENT_RESULTS).not.toContain('payout-executed');
  });

  it('an outcome with vendor fields is the typed vendor-fields rejection', () => {
    const malformed = {
      portId: 'port:reference-settlement',
      checkedAt: '2026-04-02T08:00:00.000Z',
      result: 'settled',
      braintreeTransactionId: 'txn_123',
    };
    const error = expectError(parseSettlementOutcome(malformed));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});
