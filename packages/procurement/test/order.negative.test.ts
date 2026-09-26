// NEGATIVE: the purchase order — dangling references, digest drift,
// distinction collapse (a non-commitment grounding), supplier mismatch,
// commercial-rewrite-at-order-time, broken version chains, tampered
// digests.
import { describe, expect, it } from 'vitest';
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  admitPurchaseOrder,
  admitQuote,
  admitQuoteSelection,
  emptyPurchaseOrderStore,
  emptyQuoteStore,
  emptySelectionStore,
  sealPurchaseOrder,
  sealQuoteSelection,
  verifySealedPurchaseOrder,
} from '../src/index';
import {
  ACQUISITION_ID,
  COMMITMENT_ID,
  PACKAGE_ID,
  PO_ID,
  QUOTE_ID,
  SELECTION_ID,
  SOLUTION_ID,
  TENANT,
  T4,
  T5,
  packageStore,
  sealedQuote,
  uncertainty,
  unwrap,
} from './fixtures';
import { sealProcurementCommitment } from '../src/index';

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
    supplierId: 'supplier:steel-works-alpha',
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

describe('the purchase order (negative)', () => {
  it('a dangling selection is dangling-reference-rejected (kind selection)', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(
      sealPurchaseOrder(poContent({ selectionRef: { selectionId: 'selection:missing', contentDigest: '0'.repeat(64) } })),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('selection');
    }
  });

  it('a dangling commitment record is dangling-reference-rejected (kind commitment-record)', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(
      sealPurchaseOrder(poContent({ commitmentRef: { recordId: 'commitment:missing', contentDigest: '0'.repeat(64) } })),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('commitment-record');
    }
  });

  it('DISTINCTION COLLAPSE: a PREDICTION record cannot ground an order', () => {
    const { packages, quotes, selections } = chain();
    // A sealed distinction record whose id carries the commitment prefix
    // but whose KIND is prediction — the schema admits the reference, the
    // ADMISSION kind check fires the distinction-collapse rejection.
    const prediction = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'prediction',
        recordId: 'commitment:not-a-commitment',
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
        measure: { kind: 'cost', amount: '2356.1', currency: 'EUR' },
        payload: {},
        recordedAt: T5,
        recordedBy: 'principal:procurement-lead',
        uncertainty: uncertainty() as never,
      } as never),
    );
    const sealed = unwrap(
      sealPurchaseOrder(poContent({ commitmentRef: { recordId: 'commitment:not-a-commitment', contentDigest: prediction.contentDigest } })),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [prediction], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('distinction-collapse-rejected');
    if (admitted.error.code === 'distinction-collapse-rejected') {
      expect(admitted.error.expectedKind).toBe('commitment');
      expect(admitted.error.encounteredKind).toBe('prediction');
    }
  });

  it('a supplier mismatch against the selected quote is validation', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(
      sealPurchaseOrder(poContent({ supplierId: 'supplier:someone-else' })),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('validation');
  });

  it('commercial lines rewritten at order time are validation (mirror discipline)', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(
      sealPurchaseOrder(
        poContent({
          lines: [
            { description: 'Anchor bolts M24', quantity: '99', unit: 'piece', unitCost: { amount: '6.10', currency: 'EUR' } },
            { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne', unitCost: { amount: '2350.00', currency: 'EUR' } },
          ],
        }),
      ),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('validation');
  });

  it('a wrong totalCost fold is validation', () => {
    const { packages, quotes, selections, commitment } = chain();
    const sealed = unwrap(sealPurchaseOrder(poContent({ totalCost: { amount: '1.00', currency: 'EUR' } })));
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('validation');
  });

  it('a broken version chain (wrong previousPOVersionDigest) is digest-mismatch', () => {
    const { packages, quotes, selections, commitment } = chain();
    const store = unwrap(
      admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), unwrap(sealPurchaseOrder(poContent()))),
    );
    const broken = unwrap(
      sealPurchaseOrder(poContent({ poVersion: 2, previousPOVersionDigest: '0'.repeat(64) })),
    );
    const admitted = admitPurchaseOrder(packages, quotes, selections, [commitment], store, broken);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
  });

  it('a version that skips the head is version-conflict; a tampered digest is digest-mismatch', () => {
    const { packages, quotes, selections, commitment } = chain();
    const store = unwrap(
      admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), unwrap(sealPurchaseOrder(poContent()))),
    );
    const skipped = unwrap(
      sealPurchaseOrder(poContent({ poVersion: 3, previousPOVersionDigest: '0'.repeat(64) })),
    );
    const skippedAdmission = admitPurchaseOrder(packages, quotes, selections, [commitment], store, skipped);
    expect(skippedAdmission.ok).toBe(false);
    if (skippedAdmission.ok) return;
    expect(skippedAdmission.error.code).toBe('version-conflict');

    const sealed = unwrap(sealPurchaseOrder(poContent()));
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const verified = verifySealedPurchaseOrder(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });
});
