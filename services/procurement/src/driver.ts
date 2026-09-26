/**
 * The pure procurement driver: the per-step kernels of the host flow
 * (requirement intake -> package assembly -> quoting -> selection ->
 * commitment -> PO -> delivery tracking -> receipt/acceptance), as
 * total functions over the kernel records. The HOST (src/runtime.ts)
 * owns state, authorization, idempotency and event emission; this
 * module owns the record-level step logic (the agent-runtime
 * driver/runtime split).
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every
 * instant is caller-supplied; every fold is sorted.
 */
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
  sealAcquisitionPackage,
  sealProcurementCommitment,
  sealPurchaseOrder,
  sealQuote,
  sealQuoteSelection,
  sealRequirementLineage,
  sealSubstitutionRequest,
  decideSubstitutionRequest,
  admitSubstitutionRequest,
  sealSupplierDeliveryTransition,
  purchaseOrderHead,
  type AcquisitionPackageStore,
  type ProcurementResult,
  type PurchaseOrderStore,
  type QuoteStore,
  type SealedAcquisitionPackage,
  type SealedDistinctionRecord,
  type SealedProcurementEvent,
  type SealedPurchaseOrder,
  type SealedQuote,
  type SealedQuoteSelection,
  type SealedSubstitutionDecision,
  type SealedSubstitutionRequest,
  type SealedSupplierDeliveryTransition,
  type SupplierDeliveryLog,
} from '@epoch/procurement';
import type {
  DecideSubstitutionOptions,
  IntakeRequirementOptions,
  IssuePurchaseOrderOptions,
  LinkCommitmentOptions,
  RecordDeliveryTransitionOptions,
  SelectQuoteOptions,
  SupplierQuoteSubmission,
  UncertaintyState,
} from './types';

// --------------------------------------------------------------------------------
// Step 1: requirement intake -> package assembly + lineage.
// --------------------------------------------------------------------------------

/** The record outputs of one requirement intake. */
export interface RequirementIntakeRecords {
  readonly pkg: SealedAcquisitionPackage;
  readonly packages: AcquisitionPackageStore;
  readonly lineageStore: import('@epoch/procurement').RequirementLineageStore;
}

/** Assemble the acquisition package + its primary lineage binding. */
export function assembleRequirementPackage(
  options: IntakeRequirementOptions,
): ProcurementResult<RequirementIntakeRecords> {
  const sealed = sealAcquisitionPackage({
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId: options.packageId,
    tenantId: options.tenantId,
    solutionId: options.request.solutionId,
    acquisitionId: options.request.acquisitionId,
    acquisitionRequestDigest: canonicalDigest(options.request as never),
    variant: options.request.detail.variant,
    lines:
      options.request.detail.variant === 'external-procurement'
        ? (options.request.detail as {
            lines: readonly {
              description: string;
              quantity: string;
              unit: string;
              solutionLineId?: string | undefined;
              externalPartyRef?: string | undefined;
            }[];
          }).lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            ...(line.solutionLineId !== undefined ? { solutionLineId: line.solutionLineId } : {}),
            ...(line.externalPartyRef !== undefined ? { externalPartyRef: line.externalPartyRef } : {}),
          }))
        : [],
    assembledAt: options.assembledAt,
    assembledBy: options.authorization.principalId,
  });
  if (!sealed.ok) {
    return sealed;
  }
  const packages = admitAcquisitionPackage(
    [options.request],
    emptyPackageStore(),
    sealed.value,
  );
  if (!packages.ok) {
    return packages;
  }
  const lineage = sealRequirementLineage({
    schema: 'epoch.procurement.requirement-lineage',
    schemaVersion: 1,
    lineageId: options.lineageId,
    tenantId: options.tenantId,
    solutionId: options.request.solutionId,
    requirementRef:
      options.requirementRef.kind === 'work-package'
        ? { kind: 'work-package', workPackageId: options.requirementRef.id }
        : { kind: 'solution-line', solutionLineId: options.requirementRef.id },
    packageId: options.packageId,
    recordedAt: options.assembledAt,
    recordedBy: options.authorization.principalId,
  });
  if (!lineage.ok) {
    return lineage;
  }
  const lineageStore = admitRequirementLineage(
    options.requirements,
    packages.value,
    emptyLineageStore(),
    lineage.value,
  );
  if (!lineageStore.ok) {
    return lineageStore;
  }
  return {
    ok: true,
    value: { pkg: sealed.value, packages: packages.value, lineageStore: lineageStore.value },
  };
}

// --------------------------------------------------------------------------------
// Step 2: quoting (the submissions the port returns become quotes).
// --------------------------------------------------------------------------------

/** Admit one supplier submission as a sealed quote revision. */
export function admitSupplierSubmission(
  submission: SupplierQuoteSubmission,
  packageId: string,
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
): ProcurementResult<QuoteStore> {
  const target = packages.packages.find((candidate) => candidate.packageId === packageId);
  if (target === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `quote "${submission.quoteId}" references package "${packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: packageId,
      },
    };
  }
  const sealed = sealQuote({
    schema: 'epoch.procurement.quote',
    schemaVersion: 1,
    quoteId: submission.quoteId,
    tenantId: target.tenantId,
    packageId: target.packageId,
    packageDigest: target.contentDigest,
    supplierId: submission.supplierId,
    state: 'submitted',
    revision: 1,
    previousQuoteRevisionDigest: null,
    lines: submission.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: { amount: line.unitCost.amount, currency: line.unitCost.currency },
      ...(line.allocation !== undefined
        ? {
            allocation: {
              state: line.allocation.state,
              quantity: line.allocation.quantity,
              allocatedAt: line.allocation.allocatedAt,
            },
          }
        : {}),
    })),
    leadTimes: submission.leadTimes.map((observation) => ({
      semantics: observation.semantics,
      recordId: observation.recordId,
      contentDigest: observation.contentDigest,
      uncertainty: observation.uncertainty,
    })),
    ...(submission.validUntil !== undefined ? { validUntil: submission.validUntil } : {}),
    submittedAt: submission.submittedAt,
    ...(submission.submittedBy !== undefined ? { submittedBy: submission.submittedBy } : {}),
  });
  if (!sealed.ok) {
    return sealed;
  }
  return admitQuote(packages, quotes, sealed.value);
}

// --------------------------------------------------------------------------------
// Step 3: selection.
// --------------------------------------------------------------------------------

/** Seal + admit one quote selection (the recorded decision). */
export function recordQuoteSelection(
  options: SelectQuoteOptions,
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
  selections: import('@epoch/procurement').SelectionStore,
): ProcurementResult<{ store: import('@epoch/procurement').SelectionStore; selection: SealedQuoteSelection }> {
  const pkg = packages.packages.find((candidate) => candidate.packageId === options.packageId);
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `selection "${options.selectionId}" references package "${options.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: options.packageId,
      },
    };
  }
  const selected = quotes.quotes
    .filter((quote) => quote.quoteId === options.selectedQuoteId)
    .sort((a, b) => a.revision - b.revision)
    .pop();
  if (selected === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-quote-rejected',
        message: `selection "${options.selectionId}" selects quote "${options.selectedQuoteId}", which does not resolve`,
        selectionId: options.selectionId,
        quoteId: options.selectedQuoteId,
        reason: 'missing',
      },
    };
  }
  const considered = [...new Map(quotes.quotes.filter((quote) => quote.packageId === options.packageId).map((quote) => [quote.quoteId, quote])).values()]
    .sort((a, b) => (a.quoteId < b.quoteId ? -1 : 1))
    .map((quote) => ({ quoteId: quote.quoteId, quoteDigest: quote.contentDigest }));
  const head = selections.selections.filter((record) => record.packageId === options.packageId).pop();
  const sealed = sealQuoteSelection({
    schema: 'epoch.procurement.quote-selection',
    schemaVersion: 1,
    selectionId: options.selectionId,
    tenantId: options.tenantId,
    packageId: options.packageId,
    packageDigest: pkg.contentDigest,
    selectedQuoteId: options.selectedQuoteId,
    selectedQuoteDigest: selected.contentDigest,
    consideredQuotes: considered.length === 0 ? [{ quoteId: selected.quoteId, quoteDigest: selected.contentDigest }] : considered,
    rationale: options.rationale,
    previousSelectionDigest: head === undefined ? null : head.contentDigest,
    decidedAt: options.decidedAt,
    decidedBy: options.authorization.principalId,
  });
  if (!sealed.ok) {
    return sealed;
  }
  const store = admitQuoteSelection(packages, quotes, selections, sealed.value);
  if (!store.ok) {
    return store;
  }
  return { ok: true, value: { store: store.value, selection: sealed.value } };
}

// --------------------------------------------------------------------------------
// Step 4: commitment (created through the REAL W036 kernel).
// --------------------------------------------------------------------------------

/** Seal one procurement commitment through the W036 kernel. */
export function sealCommitmentForSelection(
  options: LinkCommitmentOptions,
  pkg: SealedAcquisitionPackage,
  selectedQuote: SealedQuote,
  uncertainty: UncertaintyState,
): ProcurementResult<SealedDistinctionRecord> {
  return sealProcurementCommitment({
    recordId: options.commitmentRecordId,
    tenantId: options.tenantId,
    subject: { solutionId: pkg.solutionId, subjectKind: 'solution', subjectId: pkg.solutionId },
    quote: selectedQuote,
    acquisitionId: pkg.acquisitionId,
    committedBy: options.authorization.principalId,
    committedAt: options.committedAt,
    recordedAt: options.committedAt,
    uncertainty,
  });
}

// --------------------------------------------------------------------------------
// Step 5: purchase-order issue (v1) / amendment (v2+).
// --------------------------------------------------------------------------------

/** Seal + admit one purchase-order version (issue or amendment). */
export function issueOrderVersion(
  options: IssuePurchaseOrderOptions,
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
  selections: import('@epoch/procurement').SelectionStore,
  commitments: readonly SealedDistinctionRecord[],
  orders: PurchaseOrderStore,
): ProcurementResult<{ store: PurchaseOrderStore; order: SealedPurchaseOrder }> {
  const pkg = packages.packages.find((candidate) => candidate.packageId === options.packageId);
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${options.poId}" references package "${options.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: options.packageId,
      },
    };
  }
  const selection = selections.selections
    .filter((record) => record.packageId === options.packageId)
    .pop();
  if (selection === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${options.poId}" grounds no recorded selection of package "${options.packageId}"`,
        referenceKind: 'selection',
        referenceId: options.packageId,
      },
    };
  }
  const quote = quotes.quotes
    .filter((candidate) => candidate.quoteId === selection.selectedQuoteId)
    .sort((a, b) => a.revision - b.revision)
    .pop();
  if (quote === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-quote-rejected',
        message: `the selection's quote "${selection.selectedQuoteId}" does not resolve`,
        selectionId: selection.selectionId,
        quoteId: selection.selectedQuoteId,
        reason: 'missing',
      },
    };
  }
  const commitment = commitments.find((record) => {
    const payload = record.payload as { acquisitionId?: string | undefined };
    return payload.acquisitionId === pkg.acquisitionId;
  });
  if (commitment === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${options.poId}" grounds no linked commitment of package "${options.packageId}"`,
        referenceKind: 'commitment-record',
        referenceId: options.packageId,
      },
    };
  }
  const head = purchaseOrderHead(orders, options.poId);
  let total = '0';
  for (const line of quote.lines) {
    total = addDecimals(total, line.unitCost.amount);
  }
  const sealed = sealPurchaseOrder({
    schema: 'epoch.procurement.purchase-order',
    schemaVersion: 1,
    poId: options.poId,
    tenantId: options.tenantId,
    packageId: options.packageId,
    packageDigest: pkg.contentDigest,
    selectionRef: { selectionId: selection.selectionId, contentDigest: selection.contentDigest },
    commitmentRef: { recordId: commitment.recordId, contentDigest: commitment.contentDigest },
    supplierId: quote.supplierId,
    poVersion: head === undefined ? 1 : head.poVersion + 1,
    previousPOVersionDigest: head === undefined ? null : head.contentDigest,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitCost: { amount: line.unitCost.amount, currency: line.unitCost.currency },
    })),
    totalCost: { amount: total, currency: quote.lines[0]!.unitCost.currency },
    issuedAt: options.issuedAt,
    issuedBy: options.authorization.principalId,
    ...(options.amendmentNote !== undefined ? { amendmentNote: options.amendmentNote } : {}),
  });
  if (!sealed.ok) {
    return sealed;
  }
  const store = admitPurchaseOrder(packages, quotes, selections, commitments, orders, sealed.value);
  if (!store.ok) {
    return store;
  }
  return { ok: true, value: { store: store.value, order: sealed.value } };
}

/** Exact decimal addition (the W036 discipline, reused through the kernel). */
function addDecimals(a: string, b: string): string {
  // Reuse the kernel-exported decimal fold via foldQuoteCost indirectly:
  // the local bigint discipline keeps the driver pure without importing
  // a runtime decimal library (the W036 addNonNegativeDecimals contract).
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const sum =
    aScaled * 10n ** BigInt(scale - aFraction) + bScaled * 10n ** BigInt(scale - bFraction);
  if (scale === 0) return sum.toString();
  const text = sum.toString().padStart(scale + 1, '0');
  const integerPart = text.slice(0, -scale);
  const fractionPart = text.slice(-scale).replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}

function splitDecimal(value: string): [bigint, number] {
  const separator = value.indexOf('.');
  if (separator === -1) return [BigInt(value), 0];
  const fraction = value.slice(separator + 1);
  return [BigInt(value.slice(0, separator) + fraction), fraction.length];
}

// --------------------------------------------------------------------------------
// Step 6: supplier-delivery transitions.
// --------------------------------------------------------------------------------

/** Seal + append one supplier-delivery transition. */
export function recordDeliveryTransition(
  options: RecordDeliveryTransitionOptions,
  orders: PurchaseOrderStore,
  observations: readonly SealedDistinctionRecord[],
  log: SupplierDeliveryLog,
): ProcurementResult<{ log: SupplierDeliveryLog; transition: SealedSupplierDeliveryTransition }> {
  const head = purchaseOrderHead(orders, options.poId);
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `transition "${options.transitionId}" references purchase order "${options.poId}", which does not resolve`,
        referenceKind: 'purchase-order',
        referenceId: options.poId,
      },
    };
  }
  const current = foldSupplierDelivery(log);
  const sealed = sealSupplierDeliveryTransition({
    schema: 'epoch.procurement.supplier-delivery-transition',
    schemaVersion: 1,
    transitionId: options.transitionId,
    tenantId: options.tenantId,
    poId: options.poId,
    poVersionDigest: head.contentDigest,
    from: current.state,
    to: options.to,
    ...(options.receipt !== undefined
      ? {
          receipt: {
            observationRef: {
              recordId: options.receipt.observationRef.recordId,
              contentDigest: options.receipt.observationRef.contentDigest,
            },
            lines: options.receipt.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
            })),
            receivedAt: options.receipt.receivedAt,
            receivedBy: options.receipt.receivedBy,
          },
        }
      : {}),
    occurredAt: options.occurredAt,
    recordedBy: options.authorization.principalId,
    ...(options.note !== undefined ? { note: options.note } : {}),
  });
  if (!sealed.ok) {
    return sealed;
  }
  const appended = appendSupplierDeliveryTransition(orders, observations, log, sealed.value);
  if (!appended.ok) {
    return appended;
  }
  return { ok: true, value: { log: appended.value, transition: sealed.value } };
}

// --------------------------------------------------------------------------------
// Step 7: substitution decision (the constraint-evaluation gate).
// --------------------------------------------------------------------------------

/** Seal + admit a substitution request, then decide it (the gate applies). */
export function requestAndDecideSubstitution(
  options: DecideSubstitutionOptions,
  orders: PurchaseOrderStore,
): ProcurementResult<{ request: SealedSubstitutionRequest; decision: SealedSubstitutionDecision }> {
  const head = purchaseOrderHead(orders, options.poId);
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `substitution "${options.substitutionId}" references purchase order "${options.poId}", which does not resolve`,
        referenceKind: 'purchase-order',
        referenceId: options.poId,
      },
    };
  }
  const request = sealSubstitutionRequest({
    schema: 'epoch.procurement.substitution-request',
    schemaVersion: 1,
    substitutionId: options.substitutionId,
    tenantId: options.tenantId,
    poId: options.poId,
    poVersionDigest: head.contentDigest,
    originalLines: options.originalLines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
    })),
    substituteLines: options.substituteLines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
    })),
    requestedAt: options.requestedAt,
    requestedBy: options.authorization.principalId,
  });
  if (!request.ok) {
    return request;
  }
  const admitted = admitSubstitutionRequest(orders, { requests: [], decisions: [] }, request.value);
  if (!admitted.ok) {
    return admitted;
  }
  const decision = decideSubstitutionRequest([request.value], {
    request: request.value,
    decision: options.decision,
    ...(options.constraintEvaluation !== undefined
      ? { constraintEvaluation: options.constraintEvaluation }
      : {}),
    decidedAt: options.decidedAt,
    decidedBy: options.authorization.principalId,
  });
  if (!decision.ok) {
    return decision;
  }
  return { ok: true, value: { request: request.value, decision: decision.value } };
}

// --------------------------------------------------------------------------------
// Step 8: the derived-only status projection.
// --------------------------------------------------------------------------------

/** Project the sealed acquisition status of one package (the driver fold). */
export function projectStatus(
  options: { readonly tenantId: string; readonly packageId: string; readonly asOf: string },
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
  selections: import('@epoch/procurement').SelectionStore,
  commitments: readonly SealedDistinctionRecord[],
  orders: PurchaseOrderStore,
  log: SupplierDeliveryLog,
): ProcurementResult<import('@epoch/procurement').SealedAcquisitionStatus> {
  return deriveAcquisitionStatus({
    packages,
    quotes,
    selections,
    commitments,
    orders,
    deliveryLog: log,
    packageId: options.packageId,
    asOf: options.asOf,
  });
}

/** Re-exported store constructors for host-only use. */
export {
  emptyPackageStore,
  emptyQuoteStore,
  emptySelectionStore,
  emptyPurchaseOrderStore,
  emptyDeliveryLog,
  emptyLineageStore,
};

/** The event record type re-export (the host emits these). */
export type { SealedProcurementEvent };
