// POSITIVE: the purchase order — issued over the selection chain +
// W036 commitment (exact digests), amended through the version chain
// (previousPOVersionDigest, the W023 convention), idempotent
// re-admission.
import { describe, expect, it } from 'vitest';
import {
  admitPurchaseOrder,
  admitQuote,
  admitQuoteSelection,
  emptyPurchaseOrderStore,
  emptyQuoteStore,
  emptySelectionStore,
  foldPurchaseOrders,
  purchaseOrderHead,
  sealPurchaseOrder,
  sealQuoteSelection,
  verifySealedPurchaseOrder,
  type PurchaseOrderStore,
} from '../src/index';
import {
  ACQUISITION_ID,
  COMMITMENT_ID,
  PACKAGE_ID,
  PO_ID,
  QUOTE_ID,
  SELECTION_ID,
  SOLUTION_ID,
  SUPPLIER_A,
  TENANT,
  T4,
  T5,
  packageStore,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';
import { sealProcurementCommitment } from '../src/index';

/** The full prerequisite chain: packages -> quotes -> selection -> commitment. */
function chain() {
  const packages = packageStore();
  const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
  const selection = unwrap(
    sealQuoteSelection({
      schema: 'epoch.procurement.quote-selection',
      schemaVersion: 1,
      selectionId: SELECTION_ID,
      tenantId: TENANT,
      packageId: PACKAGE_ID,
      packageDigest: packages.packages[0]!.contentDigest,
      selectedQuoteId: QUOTE_ID,
      selectedQuoteDigest: quotes.quotes[0]!.contentDigest,
      consideredQuotes: [{ quoteId: QUOTE_ID, quoteDigest: quotes.quotes[0]!.contentDigest }],
      rationale: 'Single live quote.',
      previousSelectionDigest: null,
      decidedAt: T4,
      decidedBy: 'principal:procurement-lead',
    }),
  );
  const selections = unwrap(admitQuoteSelection(packages, quotes, emptySelectionStore(), selection));
  const commitment = unwrap(
    sealProcurementCommitment({
      recordId: COMMITMENT_ID,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      quote: quotes.quotes[0]!,
      acquisitionId: ACQUISITION_ID,
      committedBy: 'principal:procurement-lead',
      committedAt: T4,
      recordedAt: T4,
      uncertainty: uncertainty() as never,
    }),
  );
  return { packages, quotes, selections, commitment };
}

function poContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { packages, quotes, selections, commitment } = chain();
  const quote = quotes.quotes[0]!;
  return {
    schema: 'epoch.procurement.purchase-order',
    schemaVersion: 1,
    poId: PO_ID,
    tenantId: TENANT,
    packageId: PACKAGE_ID,
    packageDigest: packages.packages[0]!.contentDigest,
    selectionRef: { selectionId: SELECTION_ID, contentDigest: selections.selections[0]!.contentDigest },
    commitmentRef: { recordId: COMMITMENT_ID, contentDigest: commitment.contentDigest },
    supplierId: SUPPLIER_A,
    poVersion: 1,
    previousPOVersionDigest: null,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: { amount: line.unitCost.amount, currency: line.unitCost.currency },
    })),
    totalCost: { amount: '2356.1', currency: 'EUR' },
    issuedAt: T5,
    issuedBy: 'principal:procurement-lead',
    ...overrides,
  };
}

describe('the purchase order (positive)', () => {
  it('issues over the selection chain + W036 commitment (exact digests, mirrored lines)', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(sealPurchaseOrder(poContent()));
    const store = unwrap(
      admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed),
    );
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0]!.supplierId).toBe(SUPPLIER_A);
    expect(store.orders[0]!.selectionRef.selectionId).toBe(SELECTION_ID);
    expect(store.orders[0]!.commitmentRef.recordId).toBe(COMMITMENT_ID);
    expect(verifySealedPurchaseOrder(sealed).ok).toBe(true);
  });

  it('AMENDMENT: a new version chains previousPOVersionDigest onto the head (W023 convention)', () => {
    const { packages, quotes, selections, commitment } = chain();
    let store: PurchaseOrderStore = unwrap(
      admitPurchaseOrder(
        packages,
        quotes,
        selections,
        [commitment],
        emptyPurchaseOrderStore(),
        unwrap(sealPurchaseOrder(poContent())),
      ),
    );
    const head = purchaseOrderHead(store, PO_ID)!;
    const amended = unwrap(
      sealPurchaseOrder(
        poContent({
          poVersion: 2,
          previousPOVersionDigest: head.contentDigest,
          amendmentNote: 'Delivery window extended by supplier request.',
          issuedAt: '2026-04-01T09:00:06.000Z',
        }),
      ),
    );
    store = unwrap(admitPurchaseOrder(packages, quotes, selections, [commitment], store, amended));
    expect(store.orders).toHaveLength(2);
    expect(purchaseOrderHead(store, PO_ID)!.poVersion).toBe(2);
    expect(purchaseOrderHead(store, PO_ID)!.previousPOVersionDigest).toBe(head.contentDigest);
  });

  it('exact re-admission is idempotent; the fold of heads is sorted by po id', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(sealPurchaseOrder(poContent()));
    const store = unwrap(
      admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed),
    );
    const again = admitPurchaseOrder(packages, quotes, selections, [commitment], store, sealed);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.orders).toHaveLength(1);
    }
    expect(foldPurchaseOrders(store)).toHaveLength(1);
  });
});
