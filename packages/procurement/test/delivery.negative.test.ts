// NEGATIVE: the supplier-delivery state machine — illegal transitions
// (lifecycle-conflict), missing receipts on receipt-bearing states,
// observation digest drift, distinction collapse (a non-observation
// receipt record), tenant isolation, non-monotonic instants, replays.
import { describe, expect, it } from 'vitest';
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  appendSupplierDeliveryTransition,
  emptyDeliveryLog,
  sealSupplierDeliveryTransition,
  type SupplierDeliveryLog,
} from '../src/index';
import {
  OBSERVATION_ID,
  PO_ID,
  SOLUTION_ID,
  T6,
  T7,
  T8,
  orderChain,
  receiptObservation,
  uncertainty,
  unwrap,
} from './fixtures';

const { orders } = orderChain();
const OBSERVATIONS = [receiptObservation(OBSERVATION_ID, '40')];

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

/** A log holding just the confirm transition (derived state `confirmed`). */
function logWithConfirm(): SupplierDeliveryLog {
  return unwrap(
    appendSupplierDeliveryTransition(
      orders,
      OBSERVATIONS,
      emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId),
      unwrap(sealSupplierDeliveryTransition(transitionContent())),
    ),
  );
}

describe('the supplier-delivery state machine (negative)', () => {
  it('an illegal transition is lifecycle-conflict (closed transition table)', () => {
    const log = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    // ordered -> accepted is not in the table.
    const illegal = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({ from: 'ordered', to: 'accepted', occurredAt: T6 }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, illegal);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('lifecycle-conflict');
    if (appended.error.code === 'lifecycle-conflict') {
      expect(appended.error.from).toBe('ordered');
      expect(appended.error.to).toBe('accepted');
    }
  });

  it('a transition whose `from` disagrees with the derived state is lifecycle-conflict', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    // The derived state is 'confirmed'; claim from 'ordered'.
    const mismatch = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({ transitionId: 'po-transition:mismatch', from: 'ordered', to: 'shipped', occurredAt: T7 }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, mismatch);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('lifecycle-conflict');
  });

  it('a received/partial transition without a receipt payload is schema-rejected', () => {
    const sealed = sealSupplierDeliveryTransition(
      transitionContent({ from: 'ordered', to: 'received' }),
    );
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('a receipt observation digest that drifted is digest-mismatch', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    const sealed = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({
          transitionId: 'po-transition:drifted-receipt',
          from: 'confirmed',
          to: 'partial',
          receipt: {
            observationRef: { recordId: OBSERVATION_ID, contentDigest: '0'.repeat(64) },
            lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
            receivedAt: T7,
            receivedBy: 'principal:site-buyer',
          },
          occurredAt: T7,
        }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, sealed);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('digest-mismatch');
  });

  it('DISTINCTION COLLAPSE: a PREDICTION record cannot serve as the receipt observation', () => {
    // A sealed W036 distinction record whose id carries the observation
    // prefix but whose KIND is prediction — the schema admits the
    // reference (the prefix parses), the ADMISSION kind check fires the
    // distinction-collapse rejection.
    const fake = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'prediction',
        recordId: 'observation:not-an-observation',
        tenantId: orders.orders[0]!.tenantId,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
        measure: { kind: 'quantity', value: '40', unit: 'piece' },
        payload: {},
        recordedAt: T7,
        recordedBy: 'principal:procurement-lead',
        uncertainty: uncertainty() as never,
      } as never),
    );
    const sealed = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({
          transitionId: 'po-transition:collapse-receipt',
          from: 'confirmed',
          to: 'partial',
          receipt: {
            observationRef: { recordId: fake.recordId, contentDigest: fake.contentDigest },
            lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
            receivedAt: T7,
            receivedBy: 'principal:site-buyer',
          },
          occurredAt: T7,
        }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(
      orders,
      [fake],
      logWithConfirm(),
      sealed,
    );
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('distinction-collapse-rejected');
    if (appended.error.code === 'distinction-collapse-rejected') {
      expect(appended.error.expectedKind).toBe('observation');
      expect(appended.error.encounteredKind).toBe('prediction');
    }
  });

  it('a cross-tenant transition is tenant-isolation-rejected', () => {
    const sealed = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({ tenantId: 'tenant:initech' }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId), sealed);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('tenant-isolation-rejected');
  });

  it('a transition grounding a stale PO version digest is digest-mismatch', () => {
    const sealed = unwrap(
      sealSupplierDeliveryTransition(transitionContent({ poVersionDigest: '0'.repeat(64) })),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId), sealed);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('digest-mismatch');
  });

  it('a non-monotonic transition instant is validation', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent({ occurredAt: T8 })))),
    );
    const earlier = unwrap(
      sealSupplierDeliveryTransition(
        transitionContent({ transitionId: 'po-transition:earlier', from: 'confirmed', to: 'shipped', occurredAt: T6 }),
      ),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, earlier);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('validation');
  });

  it('the same transition id with different content is version-conflict; vendor fields rejected', () => {
    let log: SupplierDeliveryLog = emptyDeliveryLog(PO_ID, orders.orders[0]!.tenantId);
    log = unwrap(
      appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, unwrap(sealSupplierDeliveryTransition(transitionContent()))),
    );
    const conflicting = unwrap(
      sealSupplierDeliveryTransition(transitionContent({ note: 'different content' })),
    );
    const appended = appendSupplierDeliveryTransition(orders, OBSERVATIONS, log, conflicting);
    expect(appended.ok).toBe(false);
    if (appended.ok) return;
    expect(appended.error.code).toBe('version-conflict');

    const withVendor = sealSupplierDeliveryTransition(transitionContent({ carrierPortal: 'vendor.example' }));
    expect(withVendor.ok).toBe(false);
    if (withVendor.ok) return;
    expect(withVendor.error.code).toBe('vendor-fields-rejected');
  });
});
