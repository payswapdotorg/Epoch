// Developer revenue NEGATIVES: malformed records; vendor fields; payout
// vocabulary rejection (record-keeping only).
import { describe, expect, it } from 'vitest';
import { parseRevenueRecord } from '../src/index';
import { revenueRecord } from './fixtures';

describe('developer revenue negatives', () => {
  it('NAMED NEGATIVE: vendor/provider fields on revenue records are rejected', () => {
    const parsed = parseRevenueRecord({
      ...revenueRecord(),
      payoutBrand: 'not-a-real-brand',
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('an unknown revenue basis is rejected (closed vocabulary)', () => {
    const parsed = parseRevenueRecord({ ...revenueRecord(), basis: 'tip-jar' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'basis')).toBe(true);
    }
  });

  it('a malformed amount is rejected with a precise path', () => {
    const parsed = parseRevenueRecord({ ...revenueRecord(), amount: '1.87.5' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'amount')).toBe(true);
    }
  });

  it('a malformed currency is rejected with a precise path', () => {
    const parsed = parseRevenueRecord({ ...revenueRecord(), currency: 'usd1' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'currency')).toBe(true);
    }
  });

  it('a malformed revenue id is rejected', () => {
    const parsed = parseRevenueRecord({ ...revenueRecord(), revenueId: 'rev:1' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'validation') {
      expect(parsed.error.issues.some((issue) => issue.path === 'revenueId')).toBe(true);
    }
  });

  it('an unknown provenance kind is rejected', () => {
    const parsed = parseRevenueRecord({
      ...revenueRecord(),
      provenance: { kind: 'automatic-payout', brandId: 'not-a-real-brand' },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });
});
