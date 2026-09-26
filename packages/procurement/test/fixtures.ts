// Shared fixtures for the procurement kernel tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely (the W036/W006/W007 helpers pattern). ZERO clock reads:
// every instant is a fixed constant (caller-supplied payload data).
// W036 records (acquisition requests, distinction records, delivery
// records) are built through the REAL @epoch/solution-delivery
// pipelines — never hand-rolled digests.
import {
  admitAcquisitionRequest,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  type AcquisitionRequestRecord,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  admitAcquisitionPackage,
  admitPurchaseOrder,
  admitQuote,
  admitQuoteSelection,
  canonicalDigest,
  emptyPackageStore,
  emptyPurchaseOrderStore,
  emptyQuoteStore,
  emptySelectionStore,
  purchaseOrderHead,
  sealAcquisitionPackage,
  sealProcurementCommitment,
  sealPurchaseOrder,
  sealQuote,
  sealQuoteSelection,
  type PurchaseOrderStore,
  type QuoteStore,
  type SelectionStore,
  type SealedAcquisitionPackage,
  type SealedQuote,
} from '../src/index';

export const T0 = '2026-04-01T09:00:00.000Z';
export const T1 = '2026-04-01T09:00:01.000Z';
export const T2 = '2026-04-01T09:00:02.000Z';
export const T3 = '2026-04-01T09:00:03.000Z';
export const T4 = '2026-04-01T09:00:04.000Z';
export const T5 = '2026-04-01T09:00:05.000Z';
export const T6 = '2026-04-01T09:00:06.000Z';
export const T7 = '2026-04-01T09:00:07.000Z';
export const T8 = '2026-04-01T09:00:08.000Z';
export const T9 = '2026-04-01T09:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:procurement-lead';
export const BUYER = 'principal:site-buyer';
export const APPROVER = 'principal:chief-engineer';
export const OBSERVER = 'principal:field-engineer';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const SOLUTION_LINE_ID = 'line:earthworks';
export const ACQUISITION_ID = 'acquisition:earthworks-materials';
export const PACKAGE_ID = 'package:earthworks-steel-a';
export const PACKAGE_ID_B = 'package:earthworks-steel-b';
export const QUOTE_ID = 'quote:steel-supplier-a';
export const QUOTE_ID_B = 'quote:steel-supplier-b';
export const QUOTE_ID_C = 'quote:steel-supplier-c';
export const SELECTION_ID = 'selection:earthworks-first';
export const SELECTION_ID_2 = 'selection:earthworks-second';
export const PO_ID = 'po:earthworks-001';
export const PO_TRANSITION_ID = 'po-transition:confirm-001';
export const SUBSTITUTION_ID = 'substitution:anchor-bolts';
export const SUPPLIER_A = 'supplier:steel-works-alpha';
export const SUPPLIER_B = 'supplier:metal-craft-beta';
export const COMMITMENT_ID = 'commitment:earthworks-order-1';
export const OBSERVATION_ID = 'observation:delivery-receipt-1';
export const PREDICTION_ID = 'prediction:lead-time-alpha';
export const ESTIMATE_ID = 'estimate:lead-time-beta';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const CONSTRAINT_EVALUATION_DIGEST = 'c'.repeat(64);

const DIGEST = (char: string): string => char.repeat(64);
export const EVIDENCE_DIGEST = DIGEST('a');

/** One valid uncertainty state (derived provenance, fresh, stated confidence). */
export function uncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'reported', sourceRef: 'source:supplier-system', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'supplier statement' },
    ...overrides,
  };
}

/** Unwrap a total result or fail loudly (positive-path test helper). */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// --------------------------------------------------------------------------------
// W036 fixtures (built through the REAL solution-delivery pipelines).
// --------------------------------------------------------------------------------

/** One W036 external-procurement acquisition request (loose JSON). */
export function acquisitionRequestContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId: ACQUISITION_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
    detail: {
      variant: 'external-procurement',
      lines: [
        {
          description: 'Anchor bolts M24',
          quantity: '80',
          unit: 'piece',
          solutionLineId: SOLUTION_LINE_ID,
        },
        { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
      ],
    },
    requestedAt: T1,
    requestedBy: PRINCIPAL,
    neededBy: T5,
    ...overrides,
  };
}

/** The admitted W036 acquisition request. */
export function acquisitionRequest(
  overrides: Record<string, unknown> = {},
): AcquisitionRequestRecord {
  return unwrap(admitAcquisitionRequest(acquisitionRequestContent(overrides)));
}

/** One W036 lead-time PREDICTION distinction record (sealed). */
export function leadTimePrediction(): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'prediction',
      recordId: PREDICTION_ID,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      measure: { kind: 'instant', at: T8 },
      payload: { predictedFor: T8, basisRef: 'basis:historical-lead-times' },
      recordedAt: T1,
      recordedBy: PRINCIPAL,
      uncertainty: uncertainty({ provenance: { kind: 'derived', sourceRef: 'source:model' } }),
    }),
  );
}

/** One W036 lead-time ESTIMATE distinction record (sealed). */
export function leadTimeEstimate(): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'estimate',
      recordId: ESTIMATE_ID,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      measure: { kind: 'quantity', value: '14', unit: 'day' },
      payload: { method: 'source:supplier-statement', range: { low: '10', high: '18' } },
      recordedAt: T1,
      recordedBy: PRINCIPAL,
      uncertainty: uncertainty(),
    }),
  );
}

/** One W036 OBSERVATION distinction record for a delivery receipt (sealed). */
export function receiptObservation(
  recordId: string = OBSERVATION_ID,
  measureValue: string = '40',
): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'observation',
      recordId,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: 'activity:excavate' },
      measure: { kind: 'quantity', value: measureValue, unit: 'piece' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T6,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
      recordedAt: T6,
      recordedBy: OBSERVER,
      uncertainty: uncertainty({
        provenance: { kind: 'observed', sourceRef: 'source:goods-receipt', actor: OBSERVER },
        confidence: { method: 'measured', value: 0.99, rationale: 'counted at the gate' },
      }),
    }),
  );
}

/** The W036 sealed distinction records a full flow needs. */
export function distinctionRecords(): readonly SealedDistinctionRecord[] {
  return [leadTimePrediction(), leadTimeEstimate(), receiptObservation()];
}

// --------------------------------------------------------------------------------
// Procurement package fixtures.
// --------------------------------------------------------------------------------

/** One procurement acquisition-package content (loose JSON). */
export function packageContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionId: ACQUISITION_ID,
    acquisitionRequestDigest: 'computed-by-builder',
    variant: 'external-procurement',
    lines: [
      {
        description: 'Anchor bolts M24',
        quantity: '80',
        unit: 'piece',
        solutionLineId: SOLUTION_LINE_ID,
      },
      { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
    ],
    assembledAt: T2,
    assembledBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed acquisition package over the REAL W036 request. */
export function sealedPackage(
  request: AcquisitionRequestRecord = acquisitionRequest(),
  overrides: Record<string, unknown> = {},
): SealedAcquisitionPackage {
  const canonical = JSON.parse(JSON.stringify(request)) as never;
  // canonicalDigest over the parsed request gives the exact-revision
  // digest of the admitted record.
  const content = packageContent({
    acquisitionRequestDigest: canonicalDigest(canonical),
    ...overrides,
  });
  return unwrap(sealAcquisitionPackage(content));
}

/** The admitted package store holding one package. */
export function packageStore(
  request: AcquisitionRequestRecord = acquisitionRequest(),
): ReturnType<typeof emptyPackageStore> {
  const sealed = sealedPackage(request);
  return unwrap(admitAcquisitionPackage([request], emptyPackageStore(), sealed));
}

// --------------------------------------------------------------------------------
// Quote fixtures.
// --------------------------------------------------------------------------------

/** One lead-time observation (typed reference) as loose JSON. */
export function leadTimeObservation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const estimate = leadTimeEstimate();
  return {
    semantics: 'estimate',
    recordId: estimate.recordId,
    contentDigest: estimate.contentDigest,
    uncertainty: uncertainty(),
    ...overrides,
  };
}

/** One quote content (loose JSON). */
export function quoteContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const pkg = sealedPackage();
  return {
    schema: 'epoch.procurement.quote',
    schemaVersion: 1,
    quoteId: QUOTE_ID,
    tenantId: TENANT,
    packageId: pkg.packageId,
    packageDigest: pkg.contentDigest,
    supplierId: SUPPLIER_A,
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
    leadTimes: [leadTimeObservation()],
    validUntil: T7,
    submittedAt: T3,
    submittedBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed quote over the sealed package. */
export function sealedQuote(overrides: Record<string, unknown> = {}): SealedQuote {
  return unwrap(sealQuote(quoteContent(overrides)));
}

// --------------------------------------------------------------------------------
// Delivery-record observation intake (W036) for the receipt linkage.
// --------------------------------------------------------------------------------

/** The W036 delivery record after recording + accepting the receipt observation. */
export function deliveryWithObservation(): SealedDeliveryRecord {
  const opened = unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: '1.0.0',
      solutionVersionDigest: DIGEST('b'),
      openedAt: T1,
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    }),
  );
  const observation = receiptObservation();
  const recorded = unwrap(recordObservation(opened, observation));
  return recorded;
}

// --------------------------------------------------------------------------------
// The full prerequisite chain: packages -> quotes -> selection -> commitment -> PO.
// --------------------------------------------------------------------------------

/** The chain inputs of a purchase order (packages, quotes, selections, commitment, orders, head PO). */
export function orderChain() {
  const packages = packageStore();
  const quotes: QuoteStore = unwrap(admitQuote(packages, emptyQuoteStore(), sealedQuote()));
  const selection = unwrap(
    sealQuoteSelection({
      schema: 'epoch.procurement.quote-selection',
      schemaVersion: 1,
      selectionId: 'selection:earthworks-first',
      tenantId: TENANT,
      packageId: PACKAGE_ID,
      packageDigest: packages.packages[0]!.contentDigest,
      selectedQuoteId: QUOTE_ID,
      selectedQuoteDigest: quotes.quotes[0]!.contentDigest,
      consideredQuotes: [{ quoteId: QUOTE_ID, quoteDigest: quotes.quotes[0]!.contentDigest }],
      rationale: 'Single live quote with a reserved allocation.',
      previousSelectionDigest: null,
      decidedAt: T4,
      decidedBy: PRINCIPAL,
    }),
  );
  const selections: SelectionStore = unwrap(
    admitQuoteSelection(packages, quotes, emptySelectionStore(), selection),
  );
  const commitment = unwrap(
    sealProcurementCommitment({
      recordId: 'commitment:earthworks-order-1',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      quote: quotes.quotes[0]!,
      acquisitionId: ACQUISITION_ID,
      committedBy: PRINCIPAL,
      committedAt: T4,
      recordedAt: T4,
      uncertainty: uncertainty() as never,
    }),
  );
  const quote = quotes.quotes[0]!;
  const po = unwrap(
    sealPurchaseOrder({
      schema: 'epoch.procurement.purchase-order',
      schemaVersion: 1,
      poId: 'po:earthworks-001',
      tenantId: TENANT,
      packageId: PACKAGE_ID,
      packageDigest: packages.packages[0]!.contentDigest,
      selectionRef: { selectionId: 'selection:earthworks-first', contentDigest: selections.selections[0]!.contentDigest },
      commitmentRef: { recordId: 'commitment:earthworks-order-1', contentDigest: commitment.contentDigest },
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
      issuedBy: PRINCIPAL,
    }),
  );
  const orders: PurchaseOrderStore = unwrap(
    admitPurchaseOrder(packages, quotes, selections, [commitment], emptyPurchaseOrderStore(), po),
  );
  return { packages, quotes, selections, commitment, orders, po: purchaseOrderHead(orders, 'po:earthworks-001')! };
}
