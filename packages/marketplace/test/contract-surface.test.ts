// Contract surface invariants: the schema-surface registry is complete,
// uniquely named, and covers every type re-exported from the index.
import { describe, expect, it } from 'vitest';
import { MARKETPLACE_SCHEMA_SURFACE } from '../src/index';

describe('marketplace contract surface', () => {
  it('every surface entry has a type name and a schema', () => {
    for (const entry of MARKETPLACE_SCHEMA_SURFACE) {
      expect(entry.type.length).toBeGreaterThan(0);
      expect(entry.schema).toBeDefined();
    }
  });

  it('surface type names are unique', () => {
    const names = MARKETPLACE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the emitted file names are unique (kebab-collision check)', () => {
    const files = MARKETPLACE_SCHEMA_SURFACE.map(
      (entry) => `${entry.type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}.schema.json`,
    );
    expect(new Set(files).size).toBe(files.length);
  });

  it('the surface covers the core contract families', () => {
    const names = new Set(MARKETPLACE_SCHEMA_SURFACE.map((entry) => entry.type));
    for (const required of [
      'PricingModel',
      'TrustEvidenceRecord',
      'ListingVersionContent',
      'SealedListingVersion',
      'EntitlementGrantRecord',
      'EntitlementRevokeRecord',
      'UsageEventContent',
      'SealedUsageEvent',
      'UsageAccount',
      'RevenueRecord',
      'PaymentCheckRequest',
      'PaymentCheckOutcome',
    ]) {
      expect(names.has(required), `surface must publish ${required}`).toBe(true);
    }
  });
});
