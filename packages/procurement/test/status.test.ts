// The derived-only acquisition-status projection through every state
// (awaiting-quote -> quoted -> selected -> committed -> ordered -> the
// delivery states), tamper detection, determinism.
import { describe, expect, it } from 'vitest';
import {
  appendSupplierDeliveryTransition,
  deriveAcquisitionStatus,
  emptyDeliveryLog,
  sealSupplierDeliveryTransition,
  verifySealedAcquisitionStatus,
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
const OBSERVATIONS = [receiptObservation(OBSERVATION_ID, '40')];

function inputsFor(log = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId)) {
  return {
    packages,
    quotes,
    selections,
    commitments: [commitment],
    orders,
    deliveryLog: log,
    packageId: orders.orders[0]!.packageId,
    asOf: T5,
  };
}

describe('the derived-only acquisition-status projection', () => {
  it('with the full record set and no transitions: ordered', () => {
    const projection = unwrap(deriveAcquisitionStatus(inputsFor()));
    expect(projection.state).toBe('ordered');
    expect(projection.detail).toEqual({
      liveQuoteCount: 1,
      selectionCount: 1,
      purchaseOrderCount: 1,
      deliveryTransitionCount: 0,
      receivedLineCount: 0,
    });
  });

  it('without quotes: awaiting-quote; without selection: quoted', () => {
    const awaiting = unwrap(
      deriveAcquisitionStatus({
        ...inputsFor(),
        quotes: { quotes: [] },
        selections: { selections: [] },
        commitments: [],
        orders: { orders: [] },
      }),
    );
    expect(awaiting.state).toBe('awaiting-quote');
    const quoted = unwrap(
      deriveAcquisitionStatus({
        ...inputsFor(),
        selections: { selections: [] },
        commitments: [],
        orders: { orders: [] },
      }),
    );
    expect(quoted.state).toBe('quoted');
    const selected = unwrap(
      deriveAcquisitionStatus({
        ...inputsFor(),
        commitments: [],
        orders: { orders: [] },
      }),
    );
    expect(selected.state).toBe('selected');
    const committed = unwrap(
      deriveAcquisitionStatus({
        ...inputsFor(),
        orders: { orders: [] },
      }),
    );
    expect(committed.state).toBe('committed');
  });

  it('the delivery states derive from the transition log (confirmed ... accepted)', () => {
    let log = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            schema: 'epoch.procurement.supplier-delivery-transition',
            schemaVersion: 1,
            transitionId: 'po-transition:status-1',
            tenantId: orders.orders[0]!.tenantId,
            poId: PO_ID,
            poVersionDigest: orders.orders[0]!.contentDigest,
            from: 'ordered',
            to: 'confirmed',
            occurredAt: T6,
            recordedBy: 'principal:site-buyer',
          }),
        ),
      ),
    );
    expect(unwrap(deriveAcquisitionStatus(inputsFor(log))).state).toBe('confirmed');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            schema: 'epoch.procurement.supplier-delivery-transition',
            schemaVersion: 1,
            transitionId: 'po-transition:status-2',
            tenantId: orders.orders[0]!.tenantId,
            poId: PO_ID,
            poVersionDigest: orders.orders[0]!.contentDigest,
            from: 'confirmed',
            to: 'shipped',
            occurredAt: T7,
            recordedBy: 'principal:site-buyer',
          }),
        ),
      ),
    );
    expect(unwrap(deriveAcquisitionStatus(inputsFor(log))).state).toBe('shipped');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            schema: 'epoch.procurement.supplier-delivery-transition',
            schemaVersion: 1,
            transitionId: 'po-transition:status-3',
            tenantId: orders.orders[0]!.tenantId,
            poId: PO_ID,
            poVersionDigest: orders.orders[0]!.contentDigest,
            from: 'shipped',
            to: 'partial',
            receipt: {
              observationRef: { recordId: OBSERVATION_ID, contentDigest: OBSERVATIONS[0]!.contentDigest },
              lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
              receivedAt: T7,
              receivedBy: 'principal:site-buyer',
            },
            occurredAt: T7,
            recordedBy: 'principal:site-buyer',
          }),
        ),
      ),
    );
    const partial = unwrap(deriveAcquisitionStatus(inputsFor(log)));
    expect(partial.state).toBe('partial');
    expect(partial.detail.receivedLineCount).toBe(1);
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            schema: 'epoch.procurement.supplier-delivery-transition',
            schemaVersion: 1,
            transitionId: 'po-transition:status-4',
            tenantId: orders.orders[0]!.tenantId,
            poId: PO_ID,
            poVersionDigest: orders.orders[0]!.contentDigest,
            from: 'partial',
            to: 'received',
            receipt: {
              observationRef: { recordId: OBSERVATION_ID, contentDigest: OBSERVATIONS[0]!.contentDigest },
              lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
              receivedAt: T8,
              receivedBy: 'principal:site-buyer',
            },
            occurredAt: T8,
            recordedBy: 'principal:site-buyer',
          }),
        ),
      ),
    );
    expect(unwrap(deriveAcquisitionStatus(inputsFor(log))).state).toBe('received');
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        OBSERVATIONS,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            schema: 'epoch.procurement.supplier-delivery-transition',
            schemaVersion: 1,
            transitionId: 'po-transition:status-5',
            tenantId: orders.orders[0]!.tenantId,
            poId: PO_ID,
            poVersionDigest: orders.orders[0]!.contentDigest,
            from: 'received',
            to: 'accepted',
            occurredAt: T9,
            recordedBy: 'principal:site-buyer',
          }),
        ),
      ),
    );
    expect(unwrap(deriveAcquisitionStatus(inputsFor(log))).state).toBe('accepted');
  });

  it('there is NO in-place mutation: deriving twice yields identical sealed projections; tampering is digest-mismatch', () => {
    const first = unwrap(deriveAcquisitionStatus(inputsFor()));
    const second = unwrap(deriveAcquisitionStatus(inputsFor()));
    expect(second.contentDigest).toBe(first.contentDigest);
    const tampered = { ...first, state: 'accepted' };
    const verified = verifySealedAcquisitionStatus(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('a missing package cannot be projected (dangling-reference-rejected)', () => {
    const projection = deriveAcquisitionStatus({
      ...inputsFor(),
      packageId: 'package:does-not-exist',
    });
    expect(projection.ok).toBe(false);
    if (projection.ok) return;
    expect(projection.error.code).toBe('dangling-reference-rejected');
  });
});
