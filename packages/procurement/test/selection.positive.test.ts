// POSITIVE: quote selection — the RECORDED offer comparison decision
// (hash-chained, exact quote digests, rationale).
import { describe, expect, it } from 'vitest';
import {
  admitQuote,
  admitQuoteSelection,
  emptyQuoteStore,
  emptySelectionStore,
  foldQuoteSelections,
  sealQuote,
  sealQuoteSelection,
  selectionHead,
  verifySealedQuoteSelection,
} from '../src/index';
import {
  PACKAGE_ID,
  QUOTE_ID,
  QUOTE_ID_B,
  SELECTION_ID,
  SELECTION_ID_2,
  TENANT,
  T3,
  T4,
  T5,
  packageStore,
  quoteContent,
  sealedQuote,
  unwrap,
} from './fixtures';

function selectionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const quote = sealedQuote();
  const quoteB = unwrap(
    sealQuote(
      quoteContent({
        quoteId: QUOTE_ID_B,
        supplierId: 'supplier:metal-craft-beta',
        lines: [
          {
            description: 'Anchor bolts M24',
            quantity: '80',
            unit: 'piece',
            unitCost: { amount: '5.90', currency: 'EUR' },
          },
          {
            description: 'Structural steel HEB 200',
            quantity: '4',
            unit: 'tonne',
            unitCost: { amount: '2410.00', currency: 'EUR' },
          },
        ],
      }),
    ),
  );
  return {
    schema: 'epoch.procurement.quote-selection',
    schemaVersion: 1,
    selectionId: SELECTION_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest: quote.packageDigest,
    selectedQuoteId: quote.quoteId,
    selectedQuoteDigest: quote.contentDigest,
    consideredQuotes: [
      { quoteId: QUOTE_ID, quoteDigest: quote.contentDigest },
      { quoteId: QUOTE_ID_B, quoteDigest: quoteB.contentDigest },
    ],
    rationale: 'Best total cost with a reserved allocation on the bolts line.',
    previousSelectionDigest: null,
    decidedAt: T4,
    decidedBy: 'principal:procurement-lead',
    ...overrides,
  };
}

describe('quote selection (positive)', () => {
  it('the recorded offer comparison + decision is admitted (exact digests + rationale)', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const quoteB = unwrap(
      admitQuote(
        packages,
        quotes,
        unwrap(
          sealQuote(
            quoteContent({
              quoteId: QUOTE_ID_B,
              supplierId: 'supplier:metal-craft-beta',
              lines: [
                {
                  description: 'Anchor bolts M24',
                  quantity: '80',
                  unit: 'piece',
                  unitCost: { amount: '5.90', currency: 'EUR' },
                },
                {
                  description: 'Structural steel HEB 200',
                  quantity: '4',
                  unit: 'tonne',
                  unitCost: { amount: '2410.00', currency: 'EUR' },
                },
              ],
            }),
          ),
        ),
      ),
    );
    const sealed = unwrap(sealQuoteSelection(selectionContent()));
    const store = unwrap(admitQuoteSelection(packages, quoteB, emptySelectionStore(), sealed));
    expect(store.selections).toHaveLength(1);
    expect(store.selections[0]!.selectedQuoteId).toBe(QUOTE_ID);
    expect(store.selections[0]!.consideredQuotes).toHaveLength(2);
    expect(verifySealedQuoteSelection(sealed).ok).toBe(true);
  });

  it('re-selection CHAINS onto the head digest (never a silent rewrite)', () => {
    const packages = packageStore();
    let quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const quoteB = unwrap(
      sealQuote(
        quoteContent({
          quoteId: QUOTE_ID_B,
          supplierId: 'supplier:metal-craft-beta',
          lines: [
            {
              description: 'Anchor bolts M24',
              quantity: '80',
              unit: 'piece',
              unitCost: { amount: '5.90', currency: 'EUR' },
            },
            {
              description: 'Structural steel HEB 200',
              quantity: '4',
              unit: 'tonne',
              unitCost: { amount: '2410.00', currency: 'EUR' },
            },
          ],
        }),
      ),
    );
    quotes = unwrap(admitQuote(packages, quotes, quoteB));
    let selections = unwrap(
      admitQuoteSelection(packages, quotes, emptySelectionStore(), unwrap(sealQuoteSelection(selectionContent()))),
    );
    const head = selectionHead(selections, PACKAGE_ID)!;
    // Re-select supplier B: a NEW selection id chained onto the head.
    const second = unwrap(
      sealQuoteSelection(
        selectionContent({
          selectionId: SELECTION_ID_2,
          selectedQuoteId: QUOTE_ID_B,
          selectedQuoteDigest: quoteB.contentDigest,
          rationale: 'Supplier B improved after the first round.',
          previousSelectionDigest: head.contentDigest,
          decidedAt: T5,
        }),
      ),
    );
    selections = unwrap(admitQuoteSelection(packages, quotes, selections, second));
    expect(foldQuoteSelections(selections)).toHaveLength(2);
    expect(selectionHead(selections, PACKAGE_ID)!.selectionId).toBe(SELECTION_ID_2);
  });

  it('exact re-admission is idempotent', () => {
    const packages = packageStore();
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const quoteB = unwrap(
      admitQuote(
        packages,
        quotes,
        unwrap(
          sealQuote(
            quoteContent({
              quoteId: QUOTE_ID_B,
              supplierId: 'supplier:metal-craft-beta',
              lines: [
                {
                  description: 'Anchor bolts M24',
                  quantity: '80',
                  unit: 'piece',
                  unitCost: { amount: '5.90', currency: 'EUR' },
                },
                {
                  description: 'Structural steel HEB 200',
                  quantity: '4',
                  unit: 'tonne',
                  unitCost: { amount: '2410.00', currency: 'EUR' },
                },
              ],
            }),
          ),
        ),
      ),
    );
    const sealed = unwrap(sealQuoteSelection(selectionContent()));
    const store = unwrap(admitQuoteSelection(packages, quoteB, emptySelectionStore(), sealed));
    const again = admitQuoteSelection(packages, quoteB, store, sealed);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.selections).toHaveLength(1);
    }
    void T3;
  });
});
