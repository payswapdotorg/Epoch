/**
 * @epoch/procurement — public API (kernel layer, Work Order W037).
 *
 * Resource acquisition as the universal acquisition layer, with
 * procurement/supplier delivery as the concrete construction/commercial
 * PROJECTION of @epoch/solution-delivery's Acquire contract (W036):
 *
 * - typed, content-addressed REQUIREMENT-TO-ACQUISITION-PACKAGE
 *   lineage (one requirement fans out to many acquisition attempts);
 * - sealed commercial packages over the W036 acquisition requests
 *   (exact digest reference; the closed seven-variant catalog is
 *   extended as a projection, never a second lifecycle authority);
 * - provider-neutral QUOTES/OFFERS/ALLOCATIONS with recorded,
 *   hash-chained quote SELECTIONS referencing exact quote digests (a
 *   selection not backed by a live quote digest is
 *   `dangling-quote-rejected`);
 * - COMMITMENT linkage through W036 Commitment-distinction records
 *   (created via the REAL W036 sealing, linked by exact digest — never
 *   re-implemented);
 * - version-chained PURCHASE ORDERS (`previousPOVersionDigest`, the
 *   W023 convention);
 * - the supplier-delivery STATE MACHINE (ordered -> confirmed ->
 *   shipped/partial -> received -> accepted|rejected|disputed) with
 *   append-only transitions, accumulating partial receipts linked to
 *   the W036 DeliveryRecord observation intake;
 * - SUBSTITUTION requests whose acceptance REQUIRES a
 *   constraint-evaluation reference (W004 policy shapes, opaque
 *   digest) — `unevaluated-substitution-rejected` otherwise;
 * - typed LEAD-TIME observations (Prediction/Estimate distinction
 *   references with mandatory uncertainty — never a bare number);
 * - the DERIVED-ONLY acquisition-status projection (sealed, never
 *   mutated in place);
 * - the procurement:* event vocabulary over the W010 event shapes
 *   (one package = one stream `stream:procurement-<suffix>`) and
 *   deterministic intake idempotency keys.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023/W036 convention), the
 * public core-record surface at contracts/procurement/ (the W012
 * convention), both pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ACQUISITION_PACKAGE_SCHEMA_NAME,
  INITIAL_SUPPLIER_DELIVERY_STATE,
  LEAD_TIME_SEMANTICS,
  LINEAGE_ID_PATTERN,
  PACKAGE_ID_PATTERN,
  PO_ID_PATTERN,
  PO_TRANSITION_ID_PATTERN,
  PO_VERSION_PATTERN,
  PROCUREMENT_ACQUISITION_VARIANTS,
  PROCUREMENT_CONTRACT_VERSION,
  PROCUREMENT_EVENT_DISCRIMINATORS,
  PROCUREMENT_EVENT_RECORD_VERSION,
  PROCUREMENT_EVENT_SCHEMA_NAME,
  PROCUREMENT_PRINCIPAL_ID_PATTERN,
  PROCUREMENT_RECORD_VERSION,
  PROCUREMENT_STATUS_STATES,
  PROCUREMENT_STREAM_ID_PATTERN,
  QUOTE_ALLOCATION_STATES,
  QUOTE_ID_PATTERN,
  QUOTE_SCHEMA_NAME,
  QUOTE_SELECTION_SCHEMA_NAME,
  QUOTE_STATES,
  RECEIPT_BEARING_STATES,
  REQUIREMENT_LINEAGE_SCHEMA_NAME,
  SELECTION_ID_PATTERN,
  SUBSTITUTION_ID_PATTERN,
  SUPPLIER_DELIVERY_STATES,
  SUPPLIER_DELIVERY_TRANSITIONS,
  SUPPLIER_DELIVERY_TRANSITION_SCHEMA_NAME,
  SUPPLIER_ID_PATTERN,
  ACQUISITION_STATUS_SCHEMA_NAME,
  SUBSTITUTION_REQUEST_SCHEMA_NAME,
  SUBSTITUTION_DECISION_SCHEMA_NAME,
  PURCHASE_ORDER_SCHEMA_NAME,
  kindPrefixOf,
  procurementStreamIdOf,
} from './version';
export type {
  LeadTimeSemantics,
  ProcurementEventDiscriminator,
  ProcurementStatusState,
  QuoteAllocationState,
  QuoteState,
  SupplierDeliveryState,
} from './version';

// Primitives (zod schemas + types).
export {
  AcquisitionIdSchema,
  LineageIdSchema,
  PackageIdSchema,
  PoIdSchema,
  PoTransitionIdSchema,
  ProcurementPrincipalIdSchema,
  ProcurementStreamIdSchema,
  PrincipalIdSchema,
  QuoteIdSchema,
  SelectionIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SubstitutionIdSchema,
  SupplierIdSchema,
  TimestampSchema,
  canonicalDigest,
  sha256Hex,
} from './primitives';
export type {
  AcquisitionId,
  LineageId,
  PackageId,
  PoId,
  PoTransitionId,
  ProcurementPrincipalId,
  ProcurementStreamId,
  QuoteId,
  SelectionId,
  SubstitutionId,
  SupplierId,
  Sha256Hex,
} from './primitives';

// Typed error taxonomy + result.
export type {
  DanglingQuoteReason,
  ProcurementError,
  ProcurementErrorCode,
  ProcurementIssue,
  ProcurementReferenceKind,
  ProcurementResult,
} from './errors';

// Composed W036 types re-exported for one-stop typed consumption (the
// runtime-composition surface over the solution-delivery kernel).
export type {
  AcquisitionRequestRecord,
  CostMeasure,
  DistinctionSubject,
  Measure,
  ObservationRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from '@epoch/solution-delivery';

// Requirement -> acquisition-package lineage.
export {
  acquisitionAttemptsOf,
  admitRequirementLineage,
  computeRequirementLineageDigest,
  emptyLineageStore,
  foldRequirementLineages,
  requirementRefId,
  sealRequirementLineage,
  verifySealedRequirementLineage,
  RequirementLineageContentSchema,
  RequirementRefSchema,
  SealedRequirementLineageSchema,
  REQUIREMENT_REF_KINDS,
} from './lineage';
export type {
  RequirementLineageContent,
  RequirementLineageStore,
  RequirementRef,
  RequirementRefKind,
  SealedRequirementLineage,
} from './lineage';

// Acquisition packages (the commercial projection).
export {
  admitAcquisitionPackage,
  computeAcquisitionPackageDigest,
  emptyPackageStore,
  foldAcquisitionPackages,
  packageHead,
  sealAcquisitionPackage,
  verifySealedAcquisitionPackage,
  AcquisitionPackageContentSchema,
  PackageLineSchema,
  SealedAcquisitionPackageSchema,
} from './package';
export type {
  AcquisitionPackageContent,
  AcquisitionPackageStore,
  PackageLine,
  SealedAcquisitionPackage,
} from './package';

// Quotes / offers / allocations + lead-time observations.
export {
  admitQuote,
  computeQuoteDigest,
  emptyQuoteStore,
  foldQuoteHeads,
  isQuoteLive,
  leadTimeSemanticsOfKind,
  quoteHead,
  quoteRevisions,
  sealQuote,
  verifySealedQuote,
  LeadTimeObservationSchema,
  QuoteAllocationSchema,
  QuoteContentSchema,
  QuoteLineSchema,
  SealedQuoteSchema,
} from './quote';
export type {
  LeadTimeObservation,
  QuoteAllocation,
  QuoteContent,
  QuoteLine,
  QuoteStore,
  SealedQuote,
} from './quote';

// Quote selection (the recorded decision).
export {
  admitQuoteSelection,
  computeQuoteSelectionDigest,
  emptySelectionStore,
  foldQuoteSelections,
  sealQuoteSelection,
  selectionHead,
  verifySealedQuoteSelection,
  ConsideredQuoteSchema,
  QuoteSelectionContentSchema,
  SealedQuoteSelectionSchema,
} from './selection';
export type {
  ConsideredQuote,
  QuoteSelectionContent,
  SealedQuoteSelection,
  SelectionStore,
} from './selection';

// Commitment linkage (W036 records, linked — never re-implemented).
export {
  foldQuoteCost,
  linkProcurementCommitment,
  procurementCommitmentContent,
  sealProcurementCommitment,
  CommitmentReferenceSchema,
} from './commitment';
export type {
  CommitmentLinkage,
  CommitmentReference,
  ProcurementCommitmentInput,
} from './commitment';

// Purchase orders (version-chained documents).
export {
  admitPurchaseOrder,
  computePurchaseOrderDigest,
  emptyPurchaseOrderStore,
  foldPurchaseOrders,
  purchaseOrderHead,
  sealPurchaseOrder,
  verifySealedPurchaseOrder,
  PoLineSchema,
  PoTotalSchema,
  PurchaseOrderContentSchema,
  SelectionReferenceSchema,
  SealedPurchaseOrderSchema,
} from './order';
export type {
  PoLine,
  PoTotal,
  PurchaseOrderContent,
  PurchaseOrderStore,
  SealedPurchaseOrder,
  SelectionReference,
} from './order';

// Supplier delivery (the append-only state machine + receipts).
export {
  appendSupplierDeliveryTransition,
  computeSupplierDeliveryTransitionDigest,
  emptyDeliveryLog,
  foldSupplierDelivery,
  isLegalTransition,
  sealSupplierDeliveryTransition,
  verifySealedSupplierDeliveryTransition,
  ObservationReferenceSchema,
  ReceiptLineSchema,
  ReceiptPayloadSchema,
  SealedSupplierDeliveryTransitionSchema,
  SupplierDeliveryTransitionContentSchema,
} from './delivery';
export type {
  ObservationReference,
  ReceiptLine,
  ReceiptPayload,
  SealedSupplierDeliveryTransition,
  SupplierDeliveryLog,
  SupplierDeliveryProjection,
  SupplierDeliveryTransitionContent,
} from './delivery';

// Substitutions (the constraint-evaluation gate).
export {
  admitSubstitutionRequest,
  computeSubstitutionRequestDigest,
  decideSubstitutionRequest,
  emptySubstitutionStore,
  sealSubstitutionRequest,
  verifySealedSubstitutionDecision,
  verifySealedSubstitutionRequest,
  ConstraintEvaluationReferenceSchema,
  SealedSubstitutionDecisionSchema,
  SealedSubstitutionRequestSchema,
  SubstitutionDecisionContentSchema,
  SubstitutionLineSchema,
  SubstitutionRequestContentSchema,
  SUBSTITUTION_DECISION_KINDS,
} from './substitution';
export type {
  ConstraintEvaluationReference,
  SealedSubstitutionDecision,
  SealedSubstitutionRequest,
  SubstitutionDecisionContent,
  SubstitutionDecisionInput,
  SubstitutionDecisionKind,
  SubstitutionLine,
  SubstitutionRequestContent,
  SubstitutionStore,
} from './substitution';

// Lead-time resolution (never a bare number).
export { resolveLeadTimeObservation } from './lead-time';

// The derived-only acquisition-status projection.
export {
  deriveAcquisitionStatus,
  verifySealedAcquisitionStatus,
  AcquisitionStatusDetailSchema,
  SealedAcquisitionStatusSchema,
} from './status';
export type {
  AcquisitionStatusDetail,
  AcquisitionStatusInputs,
  SealedAcquisitionStatus,
} from './status';

// The procurement:* event vocabulary over the W010 event shapes.
export {
  computeProcurementEventDigest,
  parseProcurementEventData,
  sealProcurementEvent,
  verifySealedProcurementEvent,
  CommitmentLinkedDataSchema,
  DeliveryTransitionRecordedDataSchema,
  PackageAssembledDataSchema,
  PoIssuedDataSchema,
  ProcurementCausalParentSchema,
  ProcurementEventContentSchema,
  ProcurementEventPayloadSchema,
  ProcurementEventSequenceSchema,
  QuoteReceivedDataSchema,
  QuoteSelectedDataSchema,
  ReceiptRecordedDataSchema,
  SealedProcurementEventSchema,
  StatusProjectedDataSchema,
  SubstitutionDecidedDataSchema,
  SubstitutionRequestedDataSchema,
  PROCUREMENT_EVENT_DATA_SCHEMAS,
} from './events';
export type {
  CommitmentLinkedData,
  DeliveryTransitionRecordedData,
  PackageAssembledData,
  PoIssuedData,
  ProcurementCausalParent,
  ProcurementEventContent,
  ProcurementEventPayload,
  ProcurementEventSequence,
  QuoteReceivedData,
  QuoteSelectedData,
  ReceiptRecordedData,
  SealedProcurementEvent,
  StatusProjectedData,
  SubstitutionDecidedData,
  SubstitutionRequestedData,
} from './events';

// Deterministic intake idempotency keys.
export {
  deriveProcurementEventKey,
  deriveProcurementIntakeKey,
} from './idempotency';
export type { ProcurementIntakeKey } from './idempotency';

// Published schema surface + contract emission.
export { PROCUREMENT_SCHEMA_SURFACE, CORE_RECORD_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  PROCUREMENT_CONTRACT_DIR,
  PROCUREMENT_PUBLIC_CONTRACT_DIR,
  renderProcurementContractFiles,
  renderProcurementPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
