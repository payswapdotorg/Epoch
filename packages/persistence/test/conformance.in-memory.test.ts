// The SHARED conformance suite against the in-memory reference
// implementation (W046 acceptance 4: in-memory SPI conformance).
import { describe, expect, it } from 'vitest';
import { InMemoryPersistence, persistenceConformanceCases } from '../src';

const cases = persistenceConformanceCases(() => new InMemoryPersistence());

describe('persistence SPI conformance — in-memory reference', () => {
  it('the suite is complete (every group present)', () => {
    const groups = new Set(cases.map((testCase) => testCase.group));
    expect([...groups].sort()).toEqual(['migrations', 'records', 'transactions', 'validation']);
    expect(cases.length).toBeGreaterThanOrEqual(14);
  });

  for (const testCase of cases) {
    it(`${testCase.group}: ${testCase.name}`, async () => {
      await expect(testCase.run()).resolves.toBeUndefined();
    });
  }
});
