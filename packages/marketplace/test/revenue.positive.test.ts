// Developer revenue positives: record-keeping with full provenance back to
// the generating record (usage event digest / entitlement / manual entry).
import { describe, expect, it } from 'vitest';
import { parseRevenueRecord, validateRevenueRecord } from '../src/index';
import { revenueRecord } from './fixtures';

describe('developer revenue positives (record-keeping only)', () => {
  it('a revenue record parses and round-trips', () => {
    const parsed = parseRevenueRecord(revenueRecord());
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.amount).toBe('1.875');
      expect(parsed.value.currency).toBe('USD');
      expect(parsed.value.basis).toBe('usage');
    }
  });

  it('usage-event provenance addresses the exact generating event digest', () => {
    const parsed = parseRevenueRecord(revenueRecord());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.provenance.kind).toBe('usage-event');
      if (parsed.value.provenance.kind === 'usage-event') {
        expect(parsed.value.provenance.usageEventDigest).toBe('0'.repeat(64));
      }
    }
  });

  it('entitlement provenance references the generating grant record', () => {
    const parsed = parseRevenueRecord(
      revenueRecord({ provenance: { kind: 'entitlement', entitlementId: 'entitlement:grant-001' } }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.provenance.kind).toBe('entitlement');
    }
  });

  it('manual-entry provenance carries an opaque reference', () => {
    const parsed = parseRevenueRecord(
      revenueRecord({ provenance: { kind: 'manual-entry', reference: 'route:accounting-adjustment-7' } }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('every revenue basis of the closed vocabulary round-trips', () => {
    for (const basis of ['one-time', 'subscription', 'seat', 'usage'] as const) {
      const parsed = parseRevenueRecord(revenueRecord({ basis }));
      expect(parsed.ok, basis).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.basis).toBe(basis);
      }
    }
  });

  it('validateRevenueRecord agrees with parseRevenueRecord on valid records', () => {
    expect(validateRevenueRecord(revenueRecord()).ok).toBe(true);
  });

  it('a zero-amount revenue record is valid (record shape, not monetization policy)', () => {
    expect(parseRevenueRecord(revenueRecord({ amount: '0' })).ok).toBe(true);
  });
});
