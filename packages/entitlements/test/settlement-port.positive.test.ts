// Positive coverage of the SettlementPort seam: record-shaped outcomes,
// the primed in-memory reference port, fixed producer-supplied instants,
// and the fail-closed default.
import { describe, expect, it } from 'vitest';
import { InMemorySettlementPort, parseSettlementOutcome, parseSettlementRequest } from '../src/index';
import { INVOICE, TENANT, unwrap } from './fixtures';

const CHECKED_AT = '2026-04-02T08:00:00.000Z';

describe('InMemorySettlementPort (positive)', () => {
  it('reports settled for a primed invoice with the port reference', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    port.markSettled({ invoiceId: INVOICE, tenantId: TENANT, portReference: 'settle-123' });
    const outcome = unwrap(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(outcome.result).toBe('settled');
    expect(outcome.portId).toBe('port:reference-settlement');
    expect(outcome.portReference).toBe('settle-123');
    expect(outcome.checkedAt).toBe(CHECKED_AT);
  });

  it('reports unpaid and declined for primed records', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    port.markUnpaid({ invoiceId: INVOICE, tenantId: TENANT });
    const unpaid = unwrap(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(unpaid.result).toBe('unpaid');
    port.markDeclined({ invoiceId: INVOICE, tenantId: TENANT });
    const declined = unwrap(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(declined.result).toBe('declined');
  });

  it('an unprimed invoice is fail-closed unpaid (never guessed settled)', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    const outcome = unwrap(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(outcome.result).toBe('unpaid');
    expect(outcome.portReference).toBeUndefined();
  });

  it('the outcome instant is the fixed producer-supplied one (no clock reads)', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    port.markSettled({ invoiceId: INVOICE, tenantId: TENANT, portReference: 'settle-456' });
    const first = unwrap(port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }));
    const second = unwrap(port.checkSettlement({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }));
    expect(first.checkedAt).toBe(CHECKED_AT);
    expect(second.checkedAt).toBe(CHECKED_AT);
  });

  it('state is pinned by exact (invoiceId, tenantId): other tenants are unaffected', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    port.markSettled({ invoiceId: INVOICE, tenantId: TENANT, portReference: 'settle-789' });
    const foreign = unwrap(
      port.checkSettlement({ invoiceId: INVOICE, tenantId: 'tenant:initech', amount: '162', currency: 'EUR' }),
    );
    expect(foreign.result).toBe('unpaid');
  });

  it('the primed entry count is a deterministic test surface', () => {
    const port = new InMemorySettlementPort('port:reference-settlement', CHECKED_AT);
    expect(port.size).toBe(0);
    port.markSettled({ invoiceId: INVOICE, tenantId: TENANT, portReference: 'settle-1' });
    expect(port.size).toBe(1);
  });
});

describe('settlement document parsing (positive)', () => {
  it('a settlement request parses through the runtime validator', () => {
    const parsed = unwrap(
      parseSettlementRequest({ invoiceId: INVOICE, tenantId: TENANT, amount: '162', currency: 'EUR' }),
    );
    expect(parsed.invoiceId).toBe(INVOICE);
  });

  it('a settlement outcome parses through the runtime validator', () => {
    const parsed = unwrap(
      parseSettlementOutcome({
        portId: 'port:reference-settlement',
        checkedAt: CHECKED_AT,
        result: 'settled',
        portReference: 'settle-123',
      }),
    );
    expect(parsed.result).toBe('settled');
  });
});
