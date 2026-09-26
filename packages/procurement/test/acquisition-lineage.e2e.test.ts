// THE END-TO-END CONTRACT TEST (acceptance): the acquisition lineage
// requirement -> package -> quote -> selection -> commitment -> PO ->
// delivery -> receipt -> CONSUMPTION linkage, proven over the REAL W036
// pipelines (acquisition requests, distinction records, DeliveryRecord
// observation/acceptance/actualization — the consumption linkage is the
// W036 ACTUAL derived from the ACCEPTED receipt observation).
import { describe, expect, it } from 'vitest';
import {
  acceptObservation,
  actualizeObservation,
  admitAcquisitionRequest,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  admitAcquisitionPackage,
  admitPurchaseOrder,
  admitQuote,
  admitQuoteSelection,
  admitRequirementLineage,
  appendSupplierDeliveryTransition,
  canonicalDigest,
  deriveAcquisitionStatus,
  emptyDeliveryLog,
  emptyLineageStore,
  emptyPackageStore,
  emptyPurchaseOrderStore,
  emptyQuoteStore,
  emptySelectionStore,
  foldSupplierDelivery,
  linkProcurementCommitment,
  procurementStreamIdOf,
  sealAcquisitionPackage,
  sealProcurementCommitment,
  sealPurchaseOrder,
  sealQuote,
  sealQuoteSelection,
  sealRequirementLineage,
  sealSupplierDeliveryTransition,
} from '../src/index';
import {
  ACQUISITION_ID,
  OBSERVATION_ID,
  PACKAGE_ID,
  PO_ID,
  PRINCIPAL,
  QUOTE_ID,
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
  leadTimeEstimate,
  leadTimePrediction,
  unwrap,
} from './fixtures';

describe('the acquisition lineage END-TO-END (requirement -> ... -> consumption)', () => {
  it('carries the whole chain over the REAL W036 pipelines', () => {
    // 0. The W036 side: a REAL admitted acquisition request + the REAL
    //    ProgramOfWork requirement + the receipt observation records.
    const request = acquisitionRequest();
    const requirements = [WORK_PACKAGE_ID, 'line:earthworks'];
    const estimate = leadTimeEstimate();
    const prediction = leadTimePrediction();
    const receiptObservation = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: OBSERVATION_ID,
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: 'activity:excavate' },
        measure: { kind: 'quantity', value: '40', unit: 'piece' },
        payload: {
          deliveryId: 'delivery:tower-retrofit-v1',
          observedAt: T6,
          observedBy: 'principal:field-engineer',
          evidence: [{ digest: 'a'.repeat(64) }],
        },
        recordedAt: T6,
        recordedBy: 'principal:field-engineer',
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:goods-receipt' },
          freshness: { state: 'fresh', assessedAt: T6 },
          confidence: { method: 'measured', value: 0.99 },
        },
      } as never),
    );

    // 1. REQUIREMENT INTAKE -> package assembly (the commercial projection).
    const pkg = unwrap(
      sealAcquisitionPackage({
        schema: 'epoch.procurement.acquisition-package',
        schemaVersion: 1,
        packageId: PACKAGE_ID,
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        acquisitionId: ACQUISITION_ID,
        acquisitionRequestDigest: canonicalDigest(request),
        variant: 'external-procurement',
        lines: [
          { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
          { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
        ],
        assembledAt: T2,
        assembledBy: PRINCIPAL,
      }),
    );
    const packages = unwrap(admitAcquisitionPackage([request], emptyPackageStore(), pkg));

    // 2. The requirement -> package LINEAGE (fan-out evidence lives in
    //    lineage.positive; here the single binding).
    const lineage = unwrap(
      sealRequirementLineage({
        schema: 'epoch.procurement.requirement-lineage',
        schemaVersion: 1,
        lineageId: 'lineage:earthworks-steel-a',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        requirementRef: { kind: 'work-package', workPackageId: WORK_PACKAGE_ID },
        packageId: PACKAGE_ID,
        recordedAt: T2,
        recordedBy: PRINCIPAL,
      }),
    );
    const lineages = unwrap(
      admitRequirementLineage(requirements, packages, emptyLineageStore(), lineage),
    );
    expect(lineages.lineages).toHaveLength(1);

    // 3. QUOTING (typed lead-time observations referencing the W036
    //    prediction/estimate distinction records).
    const quote = unwrap(
      sealQuote({
        schema: 'epoch.procurement.quote',
        schemaVersion: 1,
        quoteId: QUOTE_ID,
        tenantId: TENANT,
        packageId: PACKAGE_ID,
        packageDigest: packages.packages[0]!.contentDigest,
        supplierId: 'supplier:steel-works-alpha',
        state: 'submitted',
        revision: 1,
        previousQuoteRevisionDigest: null,
        lines: [
          {
            description: 'Anchor bolts M24',
            quantity: '80',
            unit: 'piece',
            unitCost: { amount: '6.10', currency: 'EUR' },
            allocation: { state: 'reserved', quantity: '80', allocatedAt: T3, allocationRef: 'alloc:alpha-1' },
          },
          {
            description: 'Structural steel HEB 200',
            quantity: '4',
            unit: 'tonne',
            unitCost: { amount: '2350.00', currency: 'EUR' },
          },
        ],
        leadTimes: [
          {
            semantics: 'estimate',
            recordId: estimate.recordId,
            contentDigest: estimate.contentDigest,
            uncertainty: {
              schemaVersion: 1,
              provenance: { kind: 'reported', sourceRef: 'source:supplier-statement' },
              freshness: { state: 'fresh', assessedAt: T3 },
              confidence: { method: 'stated', value: 0.9 },
            },
          },
          {
            semantics: 'prediction',
            recordId: prediction.recordId,
            contentDigest: prediction.contentDigest,
            uncertainty: {
              schemaVersion: 1,
              provenance: { kind: 'derived', sourceRef: 'source:model' },
              freshness: { state: 'aging', assessedAt: T3 },
              confidence: { method: 'derived', value: 0.7 },
            },
          },
        ],
        validUntil: T8,
        submittedAt: T3,
        submittedBy: PRINCIPAL,
      }),
    );
    const quotes = unwrap(admitQuote(packages, emptyQuoteStore(), quote));

    // 4. SELECTION (the recorded decision with the exact quote digest).
    const selection = unwrap(
      sealQuoteSelection({
        schema: 'epoch.procurement.quote-selection',
        schemaVersion: 1,
        selectionId: 'selection:earthworks-first',
        tenantId: TENANT,
        packageId: PACKAGE_ID,
        packageDigest: packages.packages[0]!.contentDigest,
        selectedQuoteId: QUOTE_ID,
        selectedQuoteDigest: quote.contentDigest,
        consideredQuotes: [{ quoteId: QUOTE_ID, quoteDigest: quote.contentDigest }],
        rationale: 'Best total cost with a reserved allocation on the bolts line.',
        previousSelectionDigest: null,
        decidedAt: T4,
        decidedBy: PRINCIPAL,
      }),
    );
    const selections = unwrap(
      admitQuoteSelection(packages, quotes, emptySelectionStore(), selection),
    );

    // 5. COMMITMENT (created through the REAL W036 kernel and linked).
    const commitment = unwrap(
      sealProcurementCommitment({
        recordId: 'commitment:earthworks-order-1',
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
        quote,
        acquisitionId: ACQUISITION_ID,
        committedBy: PRINCIPAL,
        committedAt: T4,
        recordedAt: T4,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'reported', sourceRef: 'source:supplier-statement' },
          freshness: { state: 'fresh', assessedAt: T4 },
          confidence: { method: 'stated', value: 0.95 },
        },
      }),
    );
    const linkage = unwrap(linkProcurementCommitment(commitment, quote, ACQUISITION_ID));
    expect(linkage.committedMeasure).toEqual({ kind: 'cost', amount: '2356.1', currency: 'EUR' });

    // 6. PURCHASE ORDER (version-chained v1).
    const po = unwrap(
      sealPurchaseOrder({
        schema: 'epoch.procurement.purchase-order',
        schemaVersion: 1,
        poId: PO_ID,
        tenantId: TENANT,
        packageId: PACKAGE_ID,
        packageDigest: packages.packages[0]!.contentDigest,
        selectionRef: { selectionId: 'selection:earthworks-first', contentDigest: selection.contentDigest },
        commitmentRef: { recordId: 'commitment:earthworks-order-1', contentDigest: commitment.contentDigest },
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
        issuedBy: PRINCIPAL,
      }),
    );
    const orders = unwrap(
      admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), po),
    );

    // 7. DELIVERY TRACKING (ordered -> confirmed -> shipped -> partial x2
    //    -> received -> accepted) with receipts linked to the W036
    //    observation intake.
    const receiptObservationB = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: 'observation:delivery-receipt-2',
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: 'activity:excavate' },
        measure: { kind: 'quantity', value: '40', unit: 'piece' },
        payload: {
          deliveryId: 'delivery:tower-retrofit-v1',
          observedAt: T8,
          observedBy: 'principal:field-engineer',
          evidence: [{ digest: 'b'.repeat(64) }],
        },
        recordedAt: T8,
        recordedBy: 'principal:field-engineer',
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:goods-receipt' },
          freshness: { state: 'fresh', assessedAt: T8 },
          confidence: { method: 'measured', value: 0.99 },
        },
      } as never),
    );
    const observations = [receiptObservation, receiptObservationB];
    const transitionBase = {
      schema: 'epoch.procurement.supplier-delivery-transition',
      schemaVersion: 1,
      tenantId: TENANT,
      poId: PO_ID,
      poVersionDigest: orders.orders[0]!.contentDigest,
      recordedBy: 'principal:site-buyer',
    };
    let log = emptyDeliveryLog(PO_ID, TENANT);
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-1',
            from: 'ordered',
            to: 'confirmed',
            occurredAt: T6,
          }),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-2',
            from: 'confirmed',
            to: 'shipped',
            occurredAt: T7,
          }),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-3',
            from: 'shipped',
            to: 'partial',
            occurredAt: T7,
            receipt: {
              observationRef: { recordId: OBSERVATION_ID, contentDigest: receiptObservation.contentDigest },
              lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
              receivedAt: T7,
              receivedBy: 'principal:site-buyer',
            },
          }),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-4',
            from: 'partial',
            to: 'partial',
            occurredAt: T8,
            receipt: {
              observationRef: {
                recordId: 'observation:delivery-receipt-2',
                contentDigest: receiptObservationB.contentDigest,
              },
              lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
              receivedAt: T8,
              receivedBy: 'principal:site-buyer',
            },
          }),
        ),
      ),
    );
    const accumulated = foldSupplierDelivery(log);
    expect(accumulated.receivedLines).toEqual([
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
    ]);
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-5',
            from: 'partial',
            to: 'received',
            occurredAt: T8,
            receipt: {
              observationRef: {
                recordId: 'observation:delivery-receipt-2',
                contentDigest: receiptObservationB.contentDigest,
              },
              lines: [{ description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' }],
              receivedAt: T8,
              receivedBy: 'principal:site-buyer',
            },
          }),
        ),
      ),
    );
    log = unwrap(
      appendSupplierDeliveryTransition(
        orders,
        observations,
        log,
        unwrap(
          sealSupplierDeliveryTransition({
            ...transitionBase,
            transitionId: 'po-transition:e2e-6',
            from: 'received',
            to: 'accepted',
            occurredAt: T9,
          }),
        ),
      ),
    );
    expect(foldSupplierDelivery(log).state).toBe('accepted');

    // 8. RECEIPT/ACCEPTANCE -> CONSUMPTION LINKAGE: the receipt
    //    observations flow through the REAL W036 DeliveryRecord intake,
    //    acceptance, and ACTUALIZATION — the Actual is the consumption
    //    fact derived from the accepted receipt observation.
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
    let delivery = unwrap(recordObservation(opened, receiptObservation));
    delivery = unwrap(recordObservation(delivery, receiptObservationB));
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
    expect(actualized.actuals).toHaveLength(1);
    expect(actualized.actuals[0]!.payload.derivedFromObservationId).toBe(OBSERVATION_ID);
    // The consumption linkage: the procurement receipt observation IS the
    // W036 actualized fact.
    expect(observations[0]!.recordId).toBe(actualized.actuals[0]!.payload.derivedFromObservationId);

    // 9. The derived-only STATUS projection over the full record set.
    const status = unwrap(
      deriveAcquisitionStatus({
        packages,
        quotes,
        selections,
        commitments: [commitment],
        orders,
        deliveryLog: log,
        packageId: PACKAGE_ID,
        asOf: T9,
      }),
    );
    expect(status.state).toBe('accepted');
    expect(status.detail.deliveryTransitionCount).toBe(6);

    // 10. The stream identity: one package = one stream.
    expect(procurementStreamIdOf(PACKAGE_ID)).toBe('stream:procurement-earthworks-steel-a');
    void admitAcquisitionRequest;
    void T2;
    void T5;
    void packages;
  });
});
