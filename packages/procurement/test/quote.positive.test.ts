// POSITIVE: quotes/offers/allocations — supplier quotes with typed
// lead-time observations (Prediction/Estimate distinction references),
// allocation sub-records, revision chaining (withdrawal), liveness
// derivation, idempotent re-admission.
import { describe, expect, it } from 'vitest';
import {
  admitQuote,
  emptyQuoteStore,
  foldQuoteHeads,
  isQuoteLive,
  quoteHead,
  quoteRevisions,
  resolveLeadTimeObservation,
  sealQuote,
  verifySealedQuote,
} from '../src/index';
import {
  ESTIMATE_ID,
  QUOTE_ID,
  SUPPLIER_A,
  T3,
  T5,
  T7,
  leadTimeEstimate,
  leadTimePrediction,
  packageStore,
  quoteContent,
  sealedQuote,
  unwrap,
} from './fixtures';

describe('quotes / offers / allocations (positive)', () => {
  it('a supplier quote over the exact package revision is admitted', () => {
    const store = unwrap(admitQuote(packageStore(), emptyQuoteStore(), sealedQuote()));
    expect(store.quotes).toHaveLength(1);
    expect(store.quotes[0]!.supplierId).toBe(SUPPLIER_A);
    expect(store.quotes[0]!.lines[0]!.allocation?.state).toBe('reserved');
  });

  it('the typed lead-time observation references the W036 ESTIMATE record and resolves to its MEASURE (not a bare number)', () => {
    const quote = sealedQuote();
    const observation = quote.leadTimes[0]!;
    expect(observation.semantics).toBe('estimate');
    expect(observation.recordId).toBe(ESTIMATE_ID);
    const resolved = unwrap(
      resolveLeadTimeObservation(observation, [leadTimeEstimate(), leadTimePrediction()]),
    );
    // The resolved value is the W036 MEASURE (quantity of days) — the
    // lead time never flattens to a bare number.
    expect(resolved.measure.kind).toBe('quantity');
    expect((resolved.measure as { value: string }).value).toBe('14');
    expect((resolved.measure as { unit: string }).unit).toBe('day');
  });

  it('a PREDICTION lead-time observation also carries (typed reference + uncertainty)', () => {
    const prediction = leadTimePrediction();
    const quote = unwrap(
      sealQuote(
        quoteContent({
          leadTimes: [
            {
              semantics: 'prediction',
              recordId: prediction.recordId,
              contentDigest: prediction.contentDigest,
              uncertainty: (quoteContent().leadTimes as Record<string, unknown>[])[0]!.uncertainty as never,
            },
          ],
        }),
      ),
    );
    const resolved = unwrap(
      resolveLeadTimeObservation(quote.leadTimes[0]!, [leadTimeEstimate(), leadTimePrediction()]),
    );
    expect(resolved.record.kind).toBe('prediction');
    expect(resolved.measure.kind).toBe('instant');
  });

  it('withdrawal ships as a NEW revision chained onto the head; liveness flips', () => {
    const packages = packageStore();
    let store = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const head = quoteHead(store, QUOTE_ID)!;
    expect(isQuoteLive(store, head, T5)).toBe(true);
    // Withdraw: revision 2, state withdrawn, chained onto revision 1.
    const withdrawn = unwrap(
      sealQuote(
        quoteContent({
          state: 'withdrawn',
          revision: 2,
          previousQuoteRevisionDigest: head.contentDigest,
          submittedAt: T5,
        }),
      ),
    );
    store = unwrap(admitQuote(packages, store, withdrawn));
    expect(quoteRevisions(store, QUOTE_ID)).toHaveLength(2);
    expect(isQuoteLive(store, quoteHead(store, QUOTE_ID)!, T5)).toBe(false);
  });

  it('an expired validity window flips liveness (derivation only)', () => {
    const packages = packageStore();
    const store = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const head = quoteHead(store, QUOTE_ID)!;
    expect(isQuoteLive(store, head, T7)).toBe(true);
    expect(isQuoteLive(store, head, '2026-04-02T09:00:00.000Z')).toBe(false);
  });

  it('exact re-admission is idempotent; the fold of heads is sorted by quote id', () => {
    const packages = packageStore();
    const store = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
    const again = admitQuote(packages, store, sealedQuote());
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.quotes).toHaveLength(1);
    }
    expect(foldQuoteHeads(store).map((quote) => quote.quoteId)).toEqual([QUOTE_ID]);
  });

  it('a second supplier quote over the same package is admitted (comparison set)', () => {
    const packages = packageStore();
    const first = sealedQuote();
    const second = unwrap(
      sealQuote(
        quoteContent({
          quoteId: 'quote:steel-supplier-b',
          supplierId: 'supplier:metal-craft-beta',
          lines: [
            {
              description: 'Anchor bolts M24',
              quantity: '80',
              unit: 'piece',
              unitCost: { amount: '5.90', currency: 'EUR' },
              allocation: { state: 'allocated', quantity: '80', allocatedAt: T3 },
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
    let store = unwrap(admitQuote(packages, emptyQuoteStore(), first));
    store = unwrap(admitQuote(packages, store, second));
    expect(foldQuoteHeads(store)).toHaveLength(2);
    expect(foldQuoteHeads(store).map((quote) => quote.quoteId)).toEqual([
      QUOTE_ID,
      'quote:steel-supplier-b',
    ]);
  });

  it('the quote round-trips through JSON and re-verifies', () => {
    const sealed = sealedQuote();
    const roundTripped = JSON.parse(JSON.stringify(sealed)) as unknown;
    const verified = verifySealedQuote(roundTripped);
    expect(verified.ok).toBe(true);
  });
});
