// NEGATIVE: quote selection — dangling-quote-rejected (missing /
// withdrawn / expired), digest drift, tenant isolation, broken
// selection chains, schema discipline.
import { describe, expect, it } from 'vitest';
import {
  admitQuote,
  admitQuoteSelection,
  emptyQuoteStore,
  emptySelectionStore,
  sealQuote,
  sealQuoteSelection,
  verifySealedQuoteSelection,
} from '../src/index';
import {
  PACKAGE_ID,
  QUOTE_ID,
  QUOTE_ID_B,
  SELECTION_ID,
  TENANT,
  T4,
  T5,
  T7,
  packageStore,
  quoteContent,
  sealedQuote,
  unwrap,
} from './fixtures';

function selectionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const quote = sealedQuote();
  return {
    schema: 'epoch.procurement.quote-selection',
    schemaVersion: 1,
    selectionId: SELECTION_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest: quote.packageDigest,
    selectedQuoteId: QUOTE_ID,
    selectedQuoteDigest: quote.contentDigest,
    consideredQuotes: [{ quoteId: QUOTE_ID, quoteDigest: quote.contentDigest }],
    rationale: 'Single live quote.',
    previousSelectionDigest: null,
    decidedAt: T4,
    decidedBy: 'principal:procurement-lead',
    ...overrides,
  };
}

describe('quote selection (negative)', () => {
  it('dangling-quote-rejected (reason missing): the selected quote does not resolve', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const sealed = unwrap(
      sealQuoteSelection(
        selectionContent({
          selectedQuoteId: 'quote:not-admitted',
          consideredQuotes: [
            { quoteId: 'quote:not-admitted', quoteDigest: '0'.repeat(64) },
            { quoteId: QUOTE_ID, quoteDigest: sealedQuote().contentDigest },
          ],
        }),
      ),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-quote-rejected');
    if (admitted.error.code === 'dangling-quote-rejected') {
      expect(admitted.error.reason).toBe('missing');
      expect(admitted.error.quoteId).toBe('quote:not-admitted');
    }
  });

  it('dangling-quote-rejected (reason withdrawn): the selected quote was withdrawn before the decision', () => {
    const packages = packageStore();
    const submitted = sealedQuote();
    let quotes = unwrap(admitQuote(packages, emptyQuoteStore(), submitted));
    const withdrawn = unwrap(
      sealQuote(
        quoteContent({
          state: 'withdrawn',
          revision: 2,
          previousQuoteRevisionDigest: submitted.contentDigest,
          submittedAt: T5,
        }),
      ),
    );
    quotes = unwrap(admitQuote(packages, quotes, withdrawn));
    const sealed = unwrap(
      sealQuoteSelection(
        selectionContent({ selectedQuoteDigest: withdrawn.contentDigest, decidedAt: T5 }),
      ),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-quote-rejected');
    if (admitted.error.code === 'dangling-quote-rejected') {
      expect(admitted.error.reason).toBe('withdrawn');
    }
  });

  it('dangling-quote-rejected (reason expired): the selected quote expired before the decision', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const sealed = unwrap(
      sealQuoteSelection(
        selectionContent({ decidedAt: '2026-04-02T09:00:00.000Z' }),
      ),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-quote-rejected');
    if (admitted.error.code === 'dangling-quote-rejected') {
      expect(admitted.error.reason).toBe('expired');
    }
  });

  it('a selection referencing a stale quote digest is digest-mismatch', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const sealed = unwrap(
      sealQuoteSelection(selectionContent({ selectedQuoteDigest: '0'.repeat(64) })),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
  });

  it('a cross-tenant selection is tenant-isolation-rejected', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const sealed = unwrap(
      sealQuoteSelection(selectionContent({ tenantId: 'tenant:initech' })),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('tenant-isolation-rejected');
  });

  it('a re-selection that does NOT chain the head is dangling-reference-rejected', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const first = unwrap(sealQuoteSelection(selectionContent()));
    const selections = unwrap(
      admitQuoteSelection(packages, quotes, emptySelectionStore(), first),
    );
    const second = unwrap(
      sealQuoteSelection(selectionContent({ selectionId: 'selection:un-chained' })),
    );
    const admitted = admitQuoteSelection(packages, quotes, selections, second);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('version-conflict');
  });

  it('a broken considered-quote reference is dangling-reference-rejected (kind quote)', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const sealed = unwrap(
      sealQuoteSelection(
        selectionContent({
          consideredQuotes: [
            { quoteId: QUOTE_ID, quoteDigest: sealedQuote().contentDigest },
            { quoteId: QUOTE_ID_B, quoteDigest: '1'.repeat(64) },
          ],
        }),
      ),
    );
    const admitted = admitQuoteSelection(packages, quotes, emptySelectionStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('quote');
    }
  });

  it('vendor fields cannot enter a selection; a tampered digest is digest-mismatch', () => {
    const withVendor = sealQuoteSelection(selectionContent({ erpReference: 'vendor-erp-1' }));
    expect(withVendor.ok).toBe(false);
    if (withVendor.ok) return;
    expect(withVendor.error.code).toBe('vendor-fields-rejected');

    const sealed = unwrap(sealQuoteSelection(selectionContent()));
    const tampered = { ...sealed, contentDigest: 'e'.repeat(64) };
    const verified = verifySealedQuoteSelection(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
    void T7;
  });
});
