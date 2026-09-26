/**
 * Epoch Procurement v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/procurement` ownership boundary (Work Order W037). It is
 * self-contained: no imports, no runtime code, no vendor/brand/Aurum
 * vocabulary. The runtime implementation lives in `@epoch/procurement`
 * (kernel layer); `parity.ts` in this directory proves at compile time
 * that the implementation's zod-inferred types are identical to these
 * declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (USL1.0 / W036): the acquisition-variant catalog, the nine
 * semantic-distinction records, the ProgramOfWork, the DeliveryRecord
 * observation/acceptance/actualization machinery and the uncertainty
 * states are @epoch/solution-delivery's. This surface is the
 * construction/commercial PROJECTION of the universal Acquire contract:
 * procurement creates/links W036 records (commitments, receipt
 * observations), it never re-implements them, and it never creates a
 * second lifecycle authority.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Version of the published procurement contract surface. */
export type ProcurementContractVersion = '1.0.0';

/** The supplier-delivery states of one purchase order. */
export type SupplierDeliveryState =
  | 'ordered'
  | 'confirmed'
  | 'shipped'
  | 'partial'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'disputed';

/** The quote lifecycle states (a quote is withdrawn by a new revision). */
export type QuoteState = 'submitted' | 'withdrawn';

/** The quote-line allocation states (offers/allocations vocabulary). */
export type QuoteAllocationState = 'reserved' | 'allocated';

/** The lead-time observation semantics (W036 distinction references). */
export type LeadTimeSemantics = 'prediction' | 'estimate';

/** The derived acquisition-status states of one acquisition package. */
export type ProcurementStatusState =
  | 'awaiting-quote'
  | 'quoted'
  | 'selected'
  | 'committed'
  | 'ordered'
  | 'confirmed'
  | 'shipped'
  | 'partial'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'disputed';

/** The substitution decision kinds. */
export type SubstitutionDecisionKind = 'accepted' | 'rejected';

/** The procurement lifecycle event discriminators (the open namespace). */
export type ProcurementEventDiscriminator =
  | 'procurement:package-assembled'
  | 'procurement:quote-received'
  | 'procurement:quote-selected'
  | 'procurement:commitment-linked'
  | 'procurement:po-issued'
  | 'procurement:po-amended'
  | 'procurement:delivery-transition-recorded'
  | 'procurement:receipt-recorded'
  | 'procurement:substitution-requested'
  | 'procurement:substitution-decided'
  | 'procurement:status-projected';

/** The requirement-reference kinds (opaque ids into W036 records). */
export type RequirementRefKind = 'work-package' | 'solution-line';

/** Why a selected quote was not live at selection time. */
export type DanglingQuoteReason = 'missing' | 'withdrawn' | 'expired';

/** The reference kinds a dangling reference may name. */
export type ProcurementReferenceKind =
  | 'requirement'
  | 'acquisition-request'
  | 'acquisition-package'
  | 'quote'
  | 'selection'
  | 'purchase-order'
  | 'commitment-record'
  | 'observation-record'
  | 'constraint-evaluation'
  | 'lead-time-record'
  | 'substitution-request';

/** The complete procurement error-code vocabulary. */
export type ProcurementErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'dangling-reference-rejected'
  | 'dangling-quote-rejected'
  | 'unevaluated-substitution-rejected'
  | 'distinction-collapse-rejected'
  | 'tenant-isolation-rejected'
  | 'version-conflict'
  | 'digest-mismatch'
  | 'lifecycle-conflict'
  | 'authority-violation-rejected';

// ---------------------------------------------------------------------------
// Neutral primitives.
// ---------------------------------------------------------------------------

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** Opaque supplier identity: `supplier:<slug>` (never a vendor name). */
export type SupplierId = string;

/** Requirement-lineage record identity: `lineage:<slug>`. */
export type LineageId = string;

/** Acquisition-package record identity: `package:<slug>`. */
export type PackageId = string;

/** Quote record identity: `quote:<slug>`. */
export type QuoteId = string;

/** Quote-selection record identity: `selection:<slug>`. */
export type SelectionId = string;

/** Purchase-order record identity: `po:<slug>`. */
export type PoId = string;

/** Supplier-delivery transition record identity: `po-transition:<slug>`. */
export type PoTransitionId = string;

/** Substitution record identity: `substitution:<slug>`. */
export type SubstitutionId = string;

/** Procurement event stream identity (the W010 stream grammar). */
export type ProcurementStreamId = string;

/** Acting principal identity (the W009/W010 grammar). */
export type ProcurementPrincipalId = string;

/** Timestamp (the canonical UTC form). */
export type Timestamp = string;

/** Tenant scope (the W009 grammar). */
export type TenantId = string;

/** Acting principal (the W036/W009 grammar). */
export type PrincipalId = string;

/** Opaque solution identity (the W036 grammar). */
export type SolutionId = string;

/** Opaque acquisition-request identity (the W036 grammar). */
export type AcquisitionId = string;

// ---------------------------------------------------------------------------
// Typed error taxonomy + result.
// ---------------------------------------------------------------------------

/** One flattened validation issue (dotted path + message; "$" = root). */
export type ProcurementIssue = { readonly path: string; readonly message: string };

/** The typed procurement error taxonomy (values, never thrown). */
export type ProcurementError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ProcurementIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly ProcurementIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: ProcurementReferenceKind;
      readonly referenceId: string;
    }
  | {
      readonly code: 'dangling-quote-rejected';
      readonly message: string;
      readonly selectionId: string;
      readonly quoteId: string;
      readonly reason: DanglingQuoteReason;
    }
  | {
      readonly code: 'unevaluated-substitution-rejected';
      readonly message: string;
      readonly substitutionId: string;
    }
  | {
      readonly code: 'distinction-collapse-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly expectedKind: 'prediction' | 'estimate' | 'baseline' | 'commitment' | 'observation' | 'actual' | 'forecast' | 'outcome' | 'learning';
      readonly encounteredKind: 'prediction' | 'estimate' | 'baseline' | 'commitment' | 'observation' | 'actual' | 'forecast' | 'outcome' | 'learning' | 'prediction' | 'estimate';
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly code: 'authority-violation-rejected';
      readonly message: string;
      readonly field: string;
    };

/** Result of a procurement operation: a value or a typed error. */
export type ProcurementResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProcurementError };

// ---------------------------------------------------------------------------
// Requirement -> acquisition-package lineage.
// ---------------------------------------------------------------------------

/** One opaque requirement reference into a W036 ProgramOfWork. */
export type RequirementRef =
  | { readonly kind: 'work-package'; readonly workPackageId: string }
  | { readonly kind: 'solution-line'; readonly solutionLineId: string };

/** The immutable content of one requirement-lineage record. */
export type RequirementLineageContent = {
  readonly schema: 'epoch.procurement.requirement-lineage';
  readonly schemaVersion: 1;
  readonly lineageId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly requirementRef: RequirementRef;
  readonly packageId: string;
  readonly recordedAt: string;
  readonly recordedBy: string;
  readonly note?: string | undefined;
};

/** The sealed requirement-lineage record: content plus its content digest. */
export type SealedRequirementLineage = {
  readonly schema: 'epoch.procurement.requirement-lineage';
  readonly schemaVersion: 1;
  readonly lineageId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly requirementRef: RequirementRef;
  readonly packageId: string;
  readonly recordedAt: string;
  readonly recordedBy: string;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Acquisition packages (the commercial projection of W036 requests).
// ---------------------------------------------------------------------------

/** One commercial line of an acquisition package. */
export type PackageLine = {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly solutionLineId?: string | undefined;
  readonly externalPartyRef?: string | undefined;
};

/** The immutable content of one acquisition package. */
export type AcquisitionPackageContent = {
  readonly schema: 'epoch.procurement.acquisition-package';
  readonly schemaVersion: 1;
  readonly packageId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly acquisitionId: string;
  readonly acquisitionRequestDigest: string;
  readonly variant: 'external-procurement' | 'internal-allocation' | 'subscription-license' | 'cloud-service-provisioning' | 'fabrication-request' | 'specialist-capability-assignment' | 'data-evidence-acquisition';
  readonly lines: PackageLine[];
  readonly assembledAt: string;
  readonly assembledBy: string;
  readonly note?: string | undefined;
};

/** The sealed acquisition package: content plus its content digest. */
export type SealedAcquisitionPackage = {
  readonly schema: 'epoch.procurement.acquisition-package';
  readonly schemaVersion: 1;
  readonly packageId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly acquisitionId: string;
  readonly acquisitionRequestDigest: string;
  readonly variant: 'external-procurement' | 'internal-allocation' | 'subscription-license' | 'cloud-service-provisioning' | 'fabrication-request' | 'specialist-capability-assignment' | 'data-evidence-acquisition';
  readonly lines: PackageLine[];
  readonly assembledAt: string;
  readonly assembledBy: string;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Quotes / offers / allocations + lead-time observations.
// ---------------------------------------------------------------------------

/**
 * One typed lead-time observation: a Prediction/Estimate
 * distinction-record reference (exact digest) plus the mandatory
 * uncertainty state — never a bare number.
 */
export type LeadTimeObservation = {
  readonly semantics: 'prediction' | 'estimate';
  readonly recordId: string;
  readonly contentDigest: string;
  readonly uncertainty: UncertaintyState;
  readonly subjectNote?: string | undefined;
};

/** The W036 uncertainty state (composed at runtime from the kernel). */
export type UncertaintyState = {
  readonly schemaVersion: 1;
  readonly provenance: {
    readonly kind: 'observed' | 'reported' | 'derived' | 'assumed' | 'imported' | 'unknown';
    readonly sourceRef?: string | undefined;
    readonly actor?: string | undefined;
  };
  readonly freshness: { readonly state: 'fresh' | 'aging' | 'stale' | 'unknown'; readonly assessedAt: string };
  readonly confidence: {
    readonly method: 'stated' | 'measured' | 'estimated' | 'derived' | 'imported';
    readonly value: number;
    readonly interval?: { readonly low: number; readonly high: number } | undefined;
    readonly rationale?: string | undefined;
  };
};

/** One allocation sub-record of a quote line. */
export type QuoteAllocation = {
  readonly state: 'reserved' | 'allocated';
  readonly quantity: string;
  readonly allocatedAt: string;
  readonly allocationRef?: string | undefined;
};

/** One commercial line of a supplier quote. */
export type QuoteLine = {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitCost: { readonly amount: string; readonly currency: string };
  readonly allocation?: QuoteAllocation | undefined;
};

/** The immutable content of one quote revision. */
export type QuoteContent = {
  readonly schema: 'epoch.procurement.quote';
  readonly schemaVersion: 1;
  readonly quoteId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly supplierId: string;
  readonly state: 'submitted' | 'withdrawn';
  readonly revision: number;
  readonly previousQuoteRevisionDigest: string | null;
  readonly lines: QuoteLine[];
  readonly leadTimes: LeadTimeObservation[];
  readonly validUntil?: string | undefined;
  readonly submittedAt: string;
  readonly submittedBy?: string | undefined;
  readonly note?: string | undefined;
};

/** The sealed supplier-quote revision: content plus its content digest. */
export type SealedQuote = {
  readonly schema: 'epoch.procurement.quote';
  readonly schemaVersion: 1;
  readonly quoteId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly supplierId: string;
  readonly state: 'submitted' | 'withdrawn';
  readonly revision: number;
  readonly previousQuoteRevisionDigest: string | null;
  readonly lines: QuoteLine[];
  readonly leadTimes: LeadTimeObservation[];
  readonly validUntil?: string | undefined;
  readonly submittedAt: string;
  readonly submittedBy?: string | undefined;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Quote selection (the recorded decision).
// ---------------------------------------------------------------------------

/** One considered-quote comparison entry (by exact digest). */
export type ConsideredQuote = {
  readonly quoteId: string;
  readonly quoteDigest: string;
};

/** The immutable content of one quote-selection record. */
export type QuoteSelectionContent = {
  readonly schema: 'epoch.procurement.quote-selection';
  readonly schemaVersion: 1;
  readonly selectionId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly selectedQuoteId: string;
  readonly selectedQuoteDigest: string;
  readonly consideredQuotes: ConsideredQuote[];
  readonly rationale: string;
  readonly previousSelectionDigest: string | null;
  readonly decidedAt: string;
  readonly decidedBy: string;
};

/** The sealed quote-selection record: content plus its content digest. */
export type SealedQuoteSelection = {
  readonly schema: 'epoch.procurement.quote-selection';
  readonly schemaVersion: 1;
  readonly selectionId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly selectedQuoteId: string;
  readonly selectedQuoteDigest: string;
  readonly consideredQuotes: ConsideredQuote[];
  readonly rationale: string;
  readonly previousSelectionDigest: string | null;
  readonly decidedAt: string;
  readonly decidedBy: string;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Commitment linkage (W036 records, linked — never re-implemented).
// ---------------------------------------------------------------------------

/** One W036 Commitment-distinction record reference (exact revision). */
export type CommitmentReference = {
  readonly recordId: string;
  readonly contentDigest: string;
};

/** The linkage provenance returned by linkProcurementCommitment. */
export type CommitmentLinkage = {
  readonly reference: CommitmentReference;
  readonly committedBy: string;
  readonly committedAt: string;
  readonly committedMeasure:
    | { readonly kind: 'quantity'; readonly value: string; readonly unit: string }
    | { readonly kind: 'cost'; readonly amount: string; readonly currency: string }
    | { readonly kind: 'instant'; readonly at: string }
    | { readonly kind: 'progress'; readonly fraction: number };
};

// ---------------------------------------------------------------------------
// Purchase orders (version-chained documents).
// ---------------------------------------------------------------------------

/** One commercial line of a purchase order. */
export type PoLine = {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitCost: { readonly amount: string; readonly currency: string };
};

/** The folded total cost of a purchase order. */
export type PoTotal = { readonly amount: string; readonly currency: string };

/** The selection reference of a purchase order (exact revision). */
export type SelectionReference = {
  readonly selectionId: string;
  readonly contentDigest: string;
};

/** The immutable content of one purchase-order version. */
export type PurchaseOrderContent = {
  readonly schema: 'epoch.procurement.purchase-order';
  readonly schemaVersion: 1;
  readonly poId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly selectionRef: SelectionReference;
  readonly commitmentRef: CommitmentReference;
  readonly supplierId: string;
  readonly poVersion: number;
  readonly previousPOVersionDigest: string | null;
  readonly lines: PoLine[];
  readonly totalCost: PoTotal;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly amendmentNote?: string | undefined;
};

/** The sealed purchase-order version: content plus its content digest. */
export type SealedPurchaseOrder = {
  readonly schema: 'epoch.procurement.purchase-order';
  readonly schemaVersion: 1;
  readonly poId: string;
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly selectionRef: SelectionReference;
  readonly commitmentRef: CommitmentReference;
  readonly supplierId: string;
  readonly poVersion: number;
  readonly previousPOVersionDigest: string | null;
  readonly lines: PoLine[];
  readonly totalCost: PoTotal;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly amendmentNote?: string | undefined;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Supplier delivery (the append-only state machine + receipts).
// ---------------------------------------------------------------------------

/** One W036 Observation-distinction record reference (exact revision). */
export type ObservationReference = {
  readonly recordId: string;
  readonly contentDigest: string;
};

/** One received-quantity line of a receipt payload. */
export type ReceiptLine = {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
};

/** The receipt payload of a partial/received transition. */
export type ReceiptPayload = {
  readonly observationRef: ObservationReference;
  readonly lines: ReceiptLine[];
  readonly receivedAt: string;
  readonly receivedBy: string;
  readonly note?: string | undefined;
};

/** The immutable content of one supplier-delivery transition record. */
export type SupplierDeliveryTransitionContent = {
  readonly schema: 'epoch.procurement.supplier-delivery-transition';
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly poVersionDigest: string;
  readonly from: SupplierDeliveryState;
  readonly to: SupplierDeliveryState;
  readonly receipt?: ReceiptPayload | undefined;
  readonly occurredAt: string;
  readonly recordedBy: string;
  readonly note?: string | undefined;
};

/** The sealed supplier-delivery transition record. */
export type SealedSupplierDeliveryTransition = {
  readonly schema: 'epoch.procurement.supplier-delivery-transition';
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly poVersionDigest: string;
  readonly from: SupplierDeliveryState;
  readonly to: SupplierDeliveryState;
  readonly receipt?: ReceiptPayload | undefined;
  readonly occurredAt: string;
  readonly recordedBy: string;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

/** The derived delivery state (the fold of the transition log). */
export type SupplierDeliveryProjection = {
  readonly poId: string;
  readonly state: SupplierDeliveryState;
  readonly transitionCount: number;
  readonly receivedLines: ReceiptLine[];
  readonly receiptCount: number;
};

// ---------------------------------------------------------------------------
// Substitutions (the constraint-evaluation gate).
// ---------------------------------------------------------------------------

/** One quantity line of a substitution request. */
export type SubstitutionLine = {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
};

/**
 * The constraint-evaluation reference a substitution acceptance must
 * carry: an opaque digest in the W004 policy-evaluation shape.
 */
export type ConstraintEvaluationReference = {
  readonly evaluationDigest: string;
  readonly policyShapeRef?: string | undefined;
};

/** The immutable content of one substitution request. */
export type SubstitutionRequestContent = {
  readonly schema: 'epoch.procurement.substitution-request';
  readonly schemaVersion: 1;
  readonly substitutionId: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly poVersionDigest: string;
  readonly originalLines: SubstitutionLine[];
  readonly substituteLines: SubstitutionLine[];
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly note?: string | undefined;
};

/** The sealed substitution request record. */
export type SealedSubstitutionRequest = {
  readonly schema: 'epoch.procurement.substitution-request';
  readonly schemaVersion: 1;
  readonly substitutionId: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly poVersionDigest: string;
  readonly originalLines: SubstitutionLine[];
  readonly substituteLines: SubstitutionLine[];
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

/** The immutable content of one substitution decision. */
export type SubstitutionDecisionContent = {
  readonly schema: 'epoch.procurement.substitution-decision';
  readonly schemaVersion: 1;
  readonly substitutionId: string;
  readonly substitutionRequestDigest: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly decision: 'accepted' | 'rejected';
  readonly constraintEvaluation: ConstraintEvaluationReference;
  readonly decidedAt: string;
  readonly decidedBy: string;
  readonly note?: string | undefined;
};

/** The sealed substitution decision record. */
export type SealedSubstitutionDecision = {
  readonly schema: 'epoch.procurement.substitution-decision';
  readonly schemaVersion: 1;
  readonly substitutionId: string;
  readonly substitutionRequestDigest: string;
  readonly tenantId: string;
  readonly poId: string;
  readonly decision: 'accepted' | 'rejected';
  readonly constraintEvaluation: ConstraintEvaluationReference;
  readonly decidedAt: string;
  readonly decidedBy: string;
  readonly note?: string | undefined;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// The derived-only acquisition-status projection.
// ---------------------------------------------------------------------------

/** The derived status detail of one acquisition package. */
export type AcquisitionStatusDetail = {
  readonly liveQuoteCount: number;
  readonly selectionCount: number;
  readonly purchaseOrderCount: number;
  readonly deliveryTransitionCount: number;
  readonly receivedLineCount: number;
};

/** The sealed acquisition-status projection (derived only, never mutated). */
export type SealedAcquisitionStatus = {
  readonly schema: 'epoch.procurement.acquisition-status';
  readonly schemaVersion: 1;
  readonly packageId: string;
  readonly tenantId: string;
  readonly asOf: string;
  readonly state: ProcurementStatusState;
  readonly detail: AcquisitionStatusDetail;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// The procurement:* event vocabulary over the W010 event shapes.
// ---------------------------------------------------------------------------

/** One procurement event sequence number (1-based, contiguous per stream). */
export type ProcurementEventSequence = number;

/** The causal parent reference of a procurement event. */
export type ProcurementCausalParent = {
  readonly streamId: string;
  readonly sequence: number;
};

/** JSON value space (the shared protocol grammar). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The typed event payload of a procurement event (the W010 shape). */
export type ProcurementEventPayload = {
  readonly discriminator: string;
  readonly data: Readonly<Record<string, JsonValue>>;
};

/** The immutable content of one procurement event (the W010 shape). */
export type ProcurementEventContent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: number;
  readonly tenantId: string;
  readonly actor: string;
  readonly causalParent: ProcurementCausalParent | null;
  readonly payload: ProcurementEventPayload;
  readonly occurredAt: string;
};

/** The sealed procurement event record. */
export type SealedProcurementEvent = {
  readonly schemaVersion: 1;
  readonly streamId: string;
  readonly sequence: number;
  readonly tenantId: string;
  readonly actor: string;
  readonly causalParent: ProcurementCausalParent | null;
  readonly payload: ProcurementEventPayload;
  readonly occurredAt: string;
  readonly contentDigest: string;
};

// ---------------------------------------------------------------------------
// Typed event payload data (one per procurement:* kind).
// ---------------------------------------------------------------------------

/** Payload data of `procurement:package-assembled`. */
export type PackageAssembledData = {
  readonly packageId: string;
  readonly acquisitionId: string;
  readonly variant: string;
  readonly assembledAt: string;
};

/** Payload data of `procurement:quote-received`. */
export type QuoteReceivedData = {
  readonly packageId: string;
  readonly quoteId: string;
  readonly supplierId: string;
  readonly revision: number;
  readonly submittedAt: string;
};

/** Payload data of `procurement:quote-selected`. */
export type QuoteSelectedData = {
  readonly packageId: string;
  readonly selectionId: string;
  readonly selectedQuoteId: string;
  readonly decidedAt: string;
};

/** Payload data of `procurement:commitment-linked`. */
export type CommitmentLinkedData = {
  readonly packageId: string;
  readonly commitmentRecordId: string;
  readonly committedAt: string;
};

/** Payload data of `procurement:po-issued` / `procurement:po-amended`. */
export type PoIssuedData = {
  readonly packageId: string;
  readonly poId: string;
  readonly poVersion: number;
  readonly issuedAt: string;
};

/** Payload data of `procurement:delivery-transition-recorded`. */
export type DeliveryTransitionRecordedData = {
  readonly poId: string;
  readonly from: SupplierDeliveryState;
  readonly to: SupplierDeliveryState;
  readonly occurredAt: string;
};

/** Payload data of `procurement:receipt-recorded`. */
export type ReceiptRecordedData = {
  readonly poId: string;
  readonly transitionId: string;
  readonly observationRecordId: string;
  readonly lineCount: number;
  readonly occurredAt: string;
};

/** Payload data of `procurement:substitution-requested`. */
export type SubstitutionRequestedData = {
  readonly poId: string;
  readonly substitutionId: string;
  readonly requestedAt: string;
};

/** Payload data of `procurement:substitution-decided`. */
export type SubstitutionDecidedData = {
  readonly poId: string;
  readonly substitutionId: string;
  readonly decision: 'accepted' | 'rejected';
  readonly decidedAt: string;
};

/** Payload data of `procurement:status-projected`. */
export type StatusProjectedData = {
  readonly packageId: string;
  readonly state: string;
  readonly asOf: string;
};
