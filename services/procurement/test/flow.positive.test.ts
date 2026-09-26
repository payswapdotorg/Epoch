// THE GOLDEN PATH (success coverage): requirement intake -> package
// assembly -> quoting (SupplierPort) -> selection -> commitment -> PO ->
// delivery transitions (partial x2 accumulating) -> received ->
// accepted; the events on one stream; the status projection; the
// consumption linkage through the W036 DeliveryRecord observation
// intake (registerObservationRecords).
import { describe, expect, it } from 'vitest';
import { acceptObservation, actualizeObservation, openDeliveryRecord, recordObservation } from '@epoch/solution-delivery';
import { ProcurementRuntime } from '../src/index';
import {
  ACQUISITION_ID,
  COMMITMENT_ID,
  OBSERVATION_ID,
  OBSERVATION_ID_2,
  PACKAGE_ID,
  PO_ID,
  PRINCIPAL,
  QUOTE_ID,
  QUOTE_ID_B,
  SELECTION_ID,
  SOLUTION_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
  T8,
  T9,
  WORK_PACKAGE_ID,
  acquisitionRequest,
  allowContext,
  receiptObservation,
  seededAdapter,
  unwrap,
} from './helpers';

function runtime() {
  return new ProcurementRuntime({ supplierPort: seededAdapter() });
}

describe('the golden path (requirement intake -> ... -> acceptance)', () => {
  it('carries the full flow with events on ONE stream', () => {
    const host = runtime();
    const request = acquisitionRequest();
    const auth = { principalId: PRINCIPAL, context: allowContext() };

    // 1. Requirement intake -> package assembly + lineage.
    const intake = unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request,
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID, 'line:earthworks'],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    expect(intake.kind).toBe('admitted');
    expect(intake.record.pkg.packageId).toBe(PACKAGE_ID);
    expect(intake.record.pkg.acquisitionId).toBe(ACQUISITION_ID);

    // 2. Quoting through the SupplierPort seam (two quotes).
    const quotes = unwrap(
      host.requestQuotes({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, requestedAt: T3 }),
    );
    expect(quotes.map((quote) => quote.quoteId).sort()).toEqual([QUOTE_ID, QUOTE_ID_B].sort());

    // 3. Selection (the recorded decision).
    const selection = unwrap(
      host.selectQuote({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        selectionId: SELECTION_ID,
        selectedQuoteId: QUOTE_ID,
        rationale: 'Best total cost with a reserved allocation on the bolts line.',
        decidedAt: T4,
      }),
    );
    expect(selection.kind).toBe('admitted');
    expect(selection.record.selectedQuoteId).toBe(QUOTE_ID);

    // 4. Commitment (a W036 record, created through the kernel).
    const commitment = unwrap(
      host.linkCommitment({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        commitmentRecordId: COMMITMENT_ID,
        committedAt: T4,
      }),
    );
    expect(commitment.kind).toBe('commitment');
    expect(((commitment as { measure?: { amount?: string } }).measure ?? {}).amount).toBe('2356.1');

    // 5. Purchase order (v1).
    const po = unwrap(
      host.issuePurchaseOrder({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        poId: PO_ID,
        issuedAt: T5,
      }),
    );
    expect(po.poVersion).toBe(1);
    expect(po.supplierId).toBe('supplier:steel-works-alpha');

    // 6. Delivery: register the W036 receipt observations, then the
    //    transitions (partial x2 ACCUMULATE).
    host.registerObservationRecords([receiptObservation(OBSERVATION_ID, '40'), receiptObservation(OBSERVATION_ID_2, '40')]);
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'confirmed',
        occurredAt: T6,
        transitionId: 'po-transition:step-1',
      }),
    );
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'shipped',
        occurredAt: T7,
        transitionId: 'po-transition:step-2',
      }),
    );
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'partial',
        occurredAt: T7,
        transitionId: 'po-transition:step-3',
        receipt: {
          observationRef: { recordId: OBSERVATION_ID, contentDigest: receiptObservation(OBSERVATION_ID, '40').contentDigest },
          lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
          receivedAt: T7,
          receivedBy: 'principal:site-buyer',
        },
      }),
    );
    const secondPartial = unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'partial',
        occurredAt: T8,
        transitionId: 'po-transition:step-4',
        receipt: {
          observationRef: { recordId: OBSERVATION_ID_2, contentDigest: receiptObservation(OBSERVATION_ID_2, '40').contentDigest },
          lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
          receivedAt: T8,
          receivedBy: 'principal:site-buyer',
        },
      }),
    );
    expect(secondPartial.record.to).toBe('partial');
    const projection = unwrap(host.deliveryProjection({ tenantId: TENANT, poId: PO_ID }));
    expect(projection.receivedLines).toEqual([
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
    ]);
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'received',
        occurredAt: T8,
        transitionId: 'po-transition:step-5',
        receipt: {
          observationRef: { recordId: OBSERVATION_ID_2, contentDigest: receiptObservation(OBSERVATION_ID_2, '40').contentDigest },
          lines: [{ description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' }],
          receivedAt: T8,
          receivedBy: 'principal:site-buyer',
        },
      }),
    );
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'accepted',
        occurredAt: T9,
        transitionId: 'po-transition:step-6',
      }),
    );
    expect(unwrap(host.deliveryProjection({ tenantId: TENANT, poId: PO_ID })).state).toBe('accepted');

    // 7. ONE package = ONE stream with every step's events.
    const stream = unwrap(host.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    // 1 assembled + 2 quotes + 1 selected + 1 commitment + 1 po-issued +
    // 6 transitions + 3 receipt events (the receipts of steps 3/4/5).
    expect(stream.length).toBe(15);
    const discriminators = stream.map((event) => event.payload.discriminator);
    expect(discriminators).toContain('procurement:package-assembled');
    expect(discriminators).toContain('procurement:quote-received');
    expect(discriminators).toContain('procurement:quote-selected');
    expect(discriminators).toContain('procurement:commitment-linked');
    expect(discriminators).toContain('procurement:po-issued');
    expect(discriminators).toContain('procurement:delivery-transition-recorded');
    expect(discriminators).toContain('procurement:receipt-recorded');
    // Sequences are exactly 1..N (contiguous per stream).
    expect(stream.map((event) => event.sequence)).toEqual(
      Array.from({ length: stream.length }, (_, index) => index + 1),
    );

    // 8. The status projection is derived-only and sealed.
    const status = unwrap(
      host.projectStatus({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, asOf: T9 }),
    );
    expect(status.state).toBe('accepted');
    expect(status.detail.deliveryTransitionCount).toBe(6);

    // 9. The consumption linkage: the receipt observation flows through
    //    the REAL W036 DeliveryRecord intake -> acceptance -> actualization.
    const opened = unwrap(
      openDeliveryRecord({
        schema: 'epoch.solution-delivery.delivery-record',
        schemaVersion: 1,
        deliveryId: 'delivery:tower-retrofit-v1',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        solutionVersion: '1.0.0',
        solutionVersionDigest: 'b'.repeat(64),
        openedAt: T1,
        openedBy: PRINCIPAL,
        status: 'open',
        observations: [],
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        actuals: [],
      }),
    );
    const observation = receiptObservation(OBSERVATION_ID, '40');
    const delivery = unwrap(recordObservation(opened, observation));
    const accepted = unwrap(
      acceptObservation(delivery, OBSERVATION_ID, { acceptedBy: PRINCIPAL, acceptedAt: T9 }),
    );
    const actualized = unwrap(
      actualizeObservation(accepted, OBSERVATION_ID, {
        actualId: 'actual:consumption-bolts-1',
        actualizedBy: PRINCIPAL,
        actualizedAt: T9,
      }),
    );
    expect(actualized.actuals[0]!.payload.derivedFromObservationId).toBe(OBSERVATION_ID);
    void delivery;
    void T2;
  });

  it('PO amendment chains a new version (po-amended event)', () => {
    const host = runtime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    unwrap(host.requestQuotes({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, requestedAt: T3 }));
    unwrap(
      host.selectQuote({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        selectionId: SELECTION_ID,
        selectedQuoteId: QUOTE_ID,
        rationale: 'Single round.',
        decidedAt: T4,
      }),
    );
    unwrap(
      host.linkCommitment({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        commitmentRecordId: COMMITMENT_ID,
        committedAt: T4,
      }),
    );
    unwrap(
      host.issuePurchaseOrder({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, poId: PO_ID, issuedAt: T5 }),
    );
    const amended = unwrap(
      host.issuePurchaseOrder({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        poId: PO_ID,
        issuedAt: T6,
        amendmentNote: 'Delivery window extended by supplier request.',
      }),
    );
    expect(amended.poVersion).toBe(2);
    expect(amended.previousPOVersionDigest).toHaveLength(64);
    const stream = unwrap(host.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    expect(stream.map((event) => event.payload.discriminator)).toContain('procurement:po-amended');
  });

  it('health reports the typed counts', () => {
    const host = runtime();
    const health = host.health();
    expect(health.schemaVersion).toBe(1);
    expect(health.status).toBe('healthy');
    expect(health.packageCount).toBe(0);
    expect(health.eventStreamCount).toBe(0);
  });
});
