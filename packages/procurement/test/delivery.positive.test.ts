// POSITIVE: the supplier-delivery state machine — the full happy path
// ordered -> confirmed -> shipped -> partial (x2, ACCUMULATING) ->
// received -> accepted; rejected and disputed paths; the receipt
// linkage to W036 observation records; the status projection
// derived-only.
import { describe, expect, it } from 'vitest';
import {
  appendSupplierDeliveryTransition,
  deriveAcquisitionStatus,
  emptyDeliveryLog,
  foldSupplierDelivery,
  sealSupplierDeliveryTransition,
  verifySealedSupplierDeliveryTransition,
  type SupplierDeliveryLog,
} from '../src/index';
import {
  OBSERVATION_ID,
  PO_ID,
  T5,
  T6,
  T7,
  T8,
  T9,
  orderChain,
  receiptObservation,
  unwrap,
} from './fixtures';

const { orders, packages, quotes, selections, commitment } = orderChain();
const OBSERVATIONS = [receiptObservation(OBSERVATION_ID, '40'), receiptObservation('observation:delivery-receipt-2', '40')];

function transitionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.supplier-delivery-transition',
    schemaVersion: 1,
    transitionId: 'po-transition:step-1',
    tenantId: orders.orders[0]!.tenantId,
    poId: PO_ID,
    poVersionDigest: orders.orders[0]!.contentDigest,
    from: 'ordered',
    to: 'confirmed',
    occurredAt: T6,
    recordedBy: 'principal:site-buyer',
    ...overrides,
  };
}

function receipt(recordId: string, quantity: string, at: string): Record<string, unknown> {
  const observation = recordId === OBSERVATION_ID ? OBSERVATIONS[0]! : OBSERVATIONS[1]!;
  return {
    observationRef: { recordId, contentDigest: observation.contentDigest },
    lines: [{ description: 'Anchor bolts M24', quantity, unit: 'piece' }],
    receivedAt: at,
    receivedBy: 'principal:site-buyer',
  };
}

describe('the supplier-delivery state machine (positive)', () => {
  it('the full happy path: ordered -> confirmed -> shipped -> partial x2 -> received -> accepted', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    expect(foldSupplierDelivery(log).state).toBe('confirmed');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({ transitionId: 'po-transition:step-2', from: 'confirmed', to: 'shipped', occurredAt: T7 }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('shipped');
    // Partial deliveries ACCUMULATE (never overwrite): 40 then 40 = 80.
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:step-3',
              from: 'shipped',
              to: 'partial',
              receipt: receipt(OBSERVATION_ID, '40', T7),
              occurredAt: T7,
            }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:step-4',
              from: 'partial',
              to: 'partial',
              receipt: receipt('observation:delivery-receipt-2', '40', T8),
              occurredAt: T8,
            }),
          ),
        ),
      ),
    );
    const partial = foldSupplierDelivery(log);
    expect(partial.state).toBe('partial');
    expect(partial.receivedLines).toEqual([
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
    ]);
    expect(partial.receiptCount).toBe(2);
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:step-5',
              from: 'partial',
              to: 'received',
              receipt: receipt('observation:delivery-receipt-2', '0', T8),
              occurredAt: T8,
            }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('received');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({ transitionId: 'po-transition:step-6', from: 'received', to: 'accepted', occurredAt: T9 }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('accepted');
    expect(foldSupplierDelivery(log).transitionCount).toBe(6);
  });

  it('the rejected path: shipped -> received -> rejected -> disputed (escalation)', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:reject-0',
              from: 'confirmed',
              to: 'shipped',
              occurredAt: T7,
            }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:reject-1',
              from: 'shipped',
              to: 'received',
              receipt: receipt(OBSERVATION_ID, '40', T7),
              occurredAt: T7,
            }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:reject-2',
              from: 'received',
              to: 'rejected',
              occurredAt: T8,
            }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('rejected');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:reject-3',
              from: 'rejected',
              to: 'disputed',
              occurredAt: T9,
            }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('disputed');
  });

  it('the disputed path resolves back to received (disputed -> received)', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:dispute-0',
              from: 'confirmed',
              to: 'shipped',
              occurredAt: T7,
            }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:dispute-1',
              from: 'shipped',
              to: 'received',
              receipt: receipt(OBSERVATION_ID, '40', T7),
              occurredAt: T7,
            }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({ transitionId: 'po-transition:dispute-2', from: 'received', to: 'disputed', occurredAt: T8 }),
          ),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition(
            transitionContent({
              transitionId: 'po-transition:dispute-3',
              from: 'disputed',
              to: 'received',
              receipt: receipt('observation:delivery-receipt-2', '40', T9),
              occurredAt: T9,
            }),
          ),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('received');
  });

  it('the transition record round-trips through JSON and re-verifies', () => {
    const sealed = unwrap(sealSupplierDeliveryTransition(transitionContent()));
    const roundTripped = JSON.parse(JSON.stringify(sealed)) as unknown;
    expect(verifySealedSupplierDeliveryTransition(roundTripped).ok).toBe(true);
  });

  it('STATUS IS DERIVED ONLY: the sealed acquisition-status projection folds the records', () => {
    const projection = unwrap(
      deriveAcquisitionStatus({
        packages,
        quotes,
        selections,
        commitments: [commitment],
        orders,
        deliveryLog: emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId),
        packageId: orders.orders[0]!.packageId,
        asOf: T5,
      }),
    );
    // PO exists, no transitions: the derived state is 'ordered'.
    expect(projection.state).toBe('ordered');
    expect(projection.detail.purchaseOrderCount).toBe(1);
    expect(projection.contentDigest).toHaveLength(64);
  });
});
