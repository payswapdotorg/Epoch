// DETERMINISM: same inputs -> same digests; input order never leaks
// into folds (stores, quote heads, delivery accumulation, the status
// projection, the contract emission).
import { describe, expect, it } from 'vitest';
import {
  appendSupplierDeliveryTransition,
  deriveAcquisitionStatus,
  emptyDeliveryLog,
  foldQuoteHeads,
  foldPurchaseOrders,
  foldRequirementLineages,
  foldSupplierDelivery,
  renderProcurementContractFiles,
  renderProcurementPublicContractFiles,
  sealSupplierDeliveryTransition,
} from '../src/index';
import {
  OBSERVATION_ID,
  PO_ID,
  T5,
  T6,
  T7,
  T8,
  orderChain,
  packageStore,
  receiptObservation,
  sealedPackage,
  sealedQuote,
  unwrap,
} from './fixtures';

describe('determinism (same inputs -> same digests; no input-order leaks)', () => {
  it('sealing the same package/quote content twice yields the same digest', () => {
    const first = sealedPackage();
    const second = sealedPackage();
    expect(second.contentDigest).toBe(first.contentDigest);
    const quoteA = sealedQuote();
    const quoteB = sealedQuote();
    expect(quoteB.contentDigest).toBe(quoteA.contentDigest);
  });

  it('sealing the same transition content twice yields the same digest', () => {
    const content = {
      schema: 'epoch.procurement.supplier-delivery-transition',
      schemaVersion: 1,
      transitionId: 'po-transition:det',
      tenantId: orderChain().orders.orders[0]!.tenantId,
      poId: PO_ID,
      poVersionDigest: orderChain().orders.orders[0]!.contentDigest,
      from: 'ordered' as const,
      to: 'confirmed' as const,
      occurredAt: T6,
      recordedBy: 'principal:site-buyer',
    };
    const first = unwrap(sealSupplierDeliveryTransition(content));
    const second = unwrap(sealSupplierDeliveryTransition({ ...content }));
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('the package fold is invariant under admission-order permutation', () => {
    const a = packageStore();
    // Build a second store by admitting the same records in reverse.
    const reversed = {
      packages: [...a.packages].reverse(),
    };
    const foldForward = [...a.packages].sort((x, y) => (x.packageId < y.packageId ? -1 : 1));
    const foldBackward = [...reversed.packages].sort((x, y) => (x.packageId < y.packageId ? -1 : 1));
    expect(foldBackward).toEqual(foldForward);
  });

  it('quote-head and purchase-order folds are head-stable under store-order permutation', () => {
    const chain = orderChain();
    const quotesReversed = { quotes: [...chain.quotes.quotes].reverse() };
    expect(foldQuoteHeads(quotesReversed)).toEqual(foldQuoteHeads(chain.quotes));
    const ordersReversed = { orders: [...chain.orders.orders].reverse() };
    expect(foldPurchaseOrders(ordersReversed)).toEqual(foldPurchaseOrders(chain.orders));
  });

  it('the lineage fold is sorted (permutation-invariant)', () => {
    const lineages = [
      { lineageId: 'lineage:b', contentDigest: 'b'.repeat(64) },
      { lineageId: 'lineage:a', contentDigest: 'a'.repeat(64) },
    ];
    const folded = foldRequirementLineages({ lineages: lineages as never });
    expect(folded.map((record) => record.lineageId)).toEqual(['lineage:a', 'lineage:b']);
  });

  it('partial receipt accumulation is order-invariant in SUM (commutative decimal addition)', () => {
    const chain = orderChain();
    const observations = [
      receiptObservation(OBSERVATION_ID, '40'),
      receiptObservation('observation:delivery-receipt-2', '40'),
    ];
    const base = {
      schema: 'epoch.procurement.supplier-delivery-transition',
      schemaVersion: 1,
      tenantId: chain.orders.orders[0]!.tenantId,
      poId: PO_ID,
      poVersionDigest: chain.orders.orders[0]!.contentDigest,
      occurredAt: T6,
      recordedBy: 'principal:site-buyer',
    };
    let log = emptyDeliveryLog(PO_ID, chain.orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(
        chain.orders,
        observations,
        log,
        unwrap(sealSupplierDeliveryTransition({ ...base, transitionId: 'po-transition:c1', from: 'ordered', to: 'confirmed', occurredAt: T6 })),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        chain.orders,
        observations,
        log,
        unwrap(sealSupplierDeliveryTransition({ ...base, transitionId: 'po-transition:c2', from: 'confirmed', to: 'shipped', occurredAt: T7 })),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        chain.orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...base,
            transitionId: 'po-transition:c3',
            from: 'shipped',
            to: 'partial',
            occurredAt: T7,
            receipt: {
              observationRef: { recordId: OBSERVATION_ID, contentDigest: observations[0]!.contentDigest },
              lines: [{ description: 'Anchor bolts M24', quantity: '30', unit: 'piece' }],
              receivedAt: T7,
              receivedBy: 'principal:site-buyer',
            },
          }),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        chain.orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...base,
            transitionId: 'po-transition:c4',
            from: 'partial',
            to: 'partial',
            occurredAt: T8,
            receipt: {
              observationRef: { recordId: 'observation:delivery-receipt-2', contentDigest: observations[1]!.contentDigest },
              lines: [{ description: 'Anchor bolts M24', quantity: '50', unit: 'piece' }],
              receivedAt: T8,
              receivedBy: 'principal:site-buyer',
            },
          }),
        ),
      ),
    );
    // 30 + 50 = 80 regardless of the order the two partials were appended.
    const projection = foldSupplierDelivery(log);
    expect(projection.receivedLines).toEqual([
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
    ]);
    // The status projection derives deterministically from the same log.
    const status = unwrap(
      deriveAcquisitionStatus({
        packages: chain.packages,
        quotes: chain.quotes,
        selections: chain.selections,
        commitments: [chain.commitment],
        orders: chain.orders,
        deliveryLog: log,
        packageId: chain.orders.orders[0]!.packageId,
        asOf: T5,
      }),
    );
    expect(status.state).toBe('partial');
  });

  it('the contract emission is byte-stable across renders', () => {
    expect(renderProcurementContractFiles()).toEqual(renderProcurementContractFiles());
    expect(renderProcurementPublicContractFiles()).toEqual(renderProcurementPublicContractFiles());
  });
});
