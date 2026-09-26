/**
 * The procurement schema-surface registry: every data type published at
 * the `@epoch/procurement` ownership boundary, paired with its zod
 * schema.
 *
 * W037 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under `packages/procurement/schemas`
 *   (the W006/W007/W009/W023/W036 in-package precedent) — every entry
 *   below;
 * - the PUBLIC core-record projection under
 *   `contracts/procurement/schemas` (the W012 convention) — the
 *   CORE_RECORD_SURFACE subset (see src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { z, type ZodType } from 'zod';
import { ACQUISITION_VARIANTS } from '@epoch/solution-delivery';
import {
  LineageIdSchema,
  PackageIdSchema,
  PoIdSchema,
  PoTransitionIdSchema,
  QuoteIdSchema,
  SelectionIdSchema,
  SubstitutionIdSchema,
  SupplierIdSchema,
  ProcurementStreamIdSchema,
  ProcurementPrincipalIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  PrincipalIdSchema,
  SolutionIdSchema,
  AcquisitionIdSchema,
} from './primitives';
import {
  PackageLineSchema,
  AcquisitionPackageContentSchema,
  SealedAcquisitionPackageSchema,
} from './package';
import {
  RequirementRefSchema,
  RequirementLineageContentSchema,
  SealedRequirementLineageSchema,
} from './lineage';
import {
  LeadTimeObservationSchema,
  QuoteAllocationSchema,
  QuoteLineSchema,
  QuoteContentSchema,
  SealedQuoteSchema,
} from './quote';
import {
  ConsideredQuoteSchema,
  QuoteSelectionContentSchema,
  SealedQuoteSelectionSchema,
} from './selection';
import { CommitmentReferenceSchema } from './commitment';
import {
  PoLineSchema,
  PoTotalSchema,
  SelectionReferenceSchema,
  PurchaseOrderContentSchema,
  SealedPurchaseOrderSchema,
} from './order';
import {
  ObservationReferenceSchema,
  ReceiptLineSchema,
  ReceiptPayloadSchema,
  SupplierDeliveryTransitionContentSchema,
  SealedSupplierDeliveryTransitionSchema,
} from './delivery';
import {
  SubstitutionLineSchema,
  ConstraintEvaluationReferenceSchema,
  SubstitutionRequestContentSchema,
  SealedSubstitutionRequestSchema,
  SubstitutionDecisionContentSchema,
  SealedSubstitutionDecisionSchema,
} from './substitution';
import {
  AcquisitionStatusDetailSchema,
  SealedAcquisitionStatusSchema,
} from './status';
import {
  ProcurementEventSequenceSchema,
  ProcurementCausalParentSchema,
  ProcurementEventPayloadSchema,
  ProcurementEventContentSchema,
  SealedProcurementEventSchema,
} from './events';
import {
  SUPPLIER_DELIVERY_STATES,
  QUOTE_ALLOCATION_STATES,
  LEAD_TIME_SEMANTICS,
  QUOTE_STATES,
  PROCUREMENT_STATUS_STATES,
} from './version';
import { SUBSTITUTION_DECISION_KINDS } from './substitution';
import { REQUIREMENT_REF_KINDS } from './lineage';

/** One published schema-surface entry: the type name + its zod schema. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete in-package schema surface (the W036 in-package convention). */
export const PROCUREMENT_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Primitives.
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'LineageId', schema: LineageIdSchema },
  { type: 'PackageId', schema: PackageIdSchema },
  { type: 'QuoteId', schema: QuoteIdSchema },
  { type: 'SelectionId', schema: SelectionIdSchema },
  { type: 'PoId', schema: PoIdSchema },
  { type: 'PoTransitionId', schema: PoTransitionIdSchema },
  { type: 'SubstitutionId', schema: SubstitutionIdSchema },
  { type: 'SupplierId', schema: SupplierIdSchema },
  { type: 'ProcurementStreamId', schema: ProcurementStreamIdSchema },
  { type: 'ProcurementPrincipalId', schema: ProcurementPrincipalIdSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'AcquisitionId', schema: AcquisitionIdSchema },
  { type: 'AcquisitionVariant', schema: z.enum(ACQUISITION_VARIANTS) },
  { type: 'SupplierDeliveryState', schema: z.enum(SUPPLIER_DELIVERY_STATES) },
  { type: 'QuoteState', schema: z.enum(QUOTE_STATES) },
  { type: 'QuoteAllocationState', schema: z.enum(QUOTE_ALLOCATION_STATES) },
  { type: 'LeadTimeSemantics', schema: z.enum(LEAD_TIME_SEMANTICS) },
  { type: 'ProcurementStatusState', schema: z.enum(PROCUREMENT_STATUS_STATES) },
  { type: 'SubstitutionDecisionKind', schema: z.enum(SUBSTITUTION_DECISION_KINDS) },
  // Requirement lineage.
  { type: 'RequirementRefKind', schema: z.enum(REQUIREMENT_REF_KINDS) },
  { type: 'RequirementRef', schema: RequirementRefSchema },
  { type: 'RequirementLineageContent', schema: RequirementLineageContentSchema },
  { type: 'SealedRequirementLineage', schema: SealedRequirementLineageSchema },
  // Acquisition packages.
  { type: 'PackageLine', schema: PackageLineSchema },
  { type: 'AcquisitionPackageContent', schema: AcquisitionPackageContentSchema },
  { type: 'SealedAcquisitionPackage', schema: SealedAcquisitionPackageSchema },
  // Quotes.
  { type: 'QuoteAllocation', schema: QuoteAllocationSchema },
  { type: 'QuoteLine', schema: QuoteLineSchema },
  { type: 'LeadTimeObservation', schema: LeadTimeObservationSchema },
  { type: 'QuoteContent', schema: QuoteContentSchema },
  { type: 'SealedQuote', schema: SealedQuoteSchema },
  // Selections.
  { type: 'ConsideredQuote', schema: ConsideredQuoteSchema },
  { type: 'QuoteSelectionContent', schema: QuoteSelectionContentSchema },
  { type: 'SealedQuoteSelection', schema: SealedQuoteSelectionSchema },
  // Commitment linkage.
  { type: 'CommitmentReference', schema: CommitmentReferenceSchema },
  // Purchase orders.
  { type: 'PoLine', schema: PoLineSchema },
  { type: 'PoTotal', schema: PoTotalSchema },
  { type: 'SelectionReference', schema: SelectionReferenceSchema },
  { type: 'PurchaseOrderContent', schema: PurchaseOrderContentSchema },
  { type: 'SealedPurchaseOrder', schema: SealedPurchaseOrderSchema },
  // Supplier delivery.
  { type: 'ObservationReference', schema: ObservationReferenceSchema },
  { type: 'ReceiptLine', schema: ReceiptLineSchema },
  { type: 'ReceiptPayload', schema: ReceiptPayloadSchema },
  {
    type: 'SupplierDeliveryTransitionContent',
    schema: SupplierDeliveryTransitionContentSchema,
  },
  { type: 'SealedSupplierDeliveryTransition', schema: SealedSupplierDeliveryTransitionSchema },
  // Substitutions.
  { type: 'SubstitutionLine', schema: SubstitutionLineSchema },
  { type: 'ConstraintEvaluationReference', schema: ConstraintEvaluationReferenceSchema },
  { type: 'SubstitutionRequestContent', schema: SubstitutionRequestContentSchema },
  { type: 'SealedSubstitutionRequest', schema: SealedSubstitutionRequestSchema },
  { type: 'SubstitutionDecisionContent', schema: SubstitutionDecisionContentSchema },
  { type: 'SealedSubstitutionDecision', schema: SealedSubstitutionDecisionSchema },
  // Status projection.
  { type: 'AcquisitionStatusDetail', schema: AcquisitionStatusDetailSchema },
  { type: 'SealedAcquisitionStatus', schema: SealedAcquisitionStatusSchema },
  // Events (the W010-shaped vocabulary).
  { type: 'ProcurementEventSequence', schema: ProcurementEventSequenceSchema },
  { type: 'ProcurementCausalParent', schema: ProcurementCausalParentSchema },
  { type: 'ProcurementEventPayload', schema: ProcurementEventPayloadSchema },
  { type: 'ProcurementEventContent', schema: ProcurementEventContentSchema },
  { type: 'SealedProcurementEvent', schema: SealedProcurementEventSchema },
];

/**
 * The CORE record surface — the subset published at
 * `contracts/procurement/schemas` (the W012 public-contract
 * convention): the core record types a domain pack or downstream
 * consumer binds to.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'RequirementRef', schema: RequirementRefSchema },
  { type: 'RequirementLineageContent', schema: RequirementLineageContentSchema },
  { type: 'SealedRequirementLineage', schema: SealedRequirementLineageSchema },
  { type: 'PackageLine', schema: PackageLineSchema },
  { type: 'AcquisitionPackageContent', schema: AcquisitionPackageContentSchema },
  { type: 'SealedAcquisitionPackage', schema: SealedAcquisitionPackageSchema },
  { type: 'LeadTimeObservation', schema: LeadTimeObservationSchema },
  { type: 'QuoteContent', schema: QuoteContentSchema },
  { type: 'SealedQuote', schema: SealedQuoteSchema },
  { type: 'QuoteSelectionContent', schema: QuoteSelectionContentSchema },
  { type: 'SealedQuoteSelection', schema: SealedQuoteSelectionSchema },
  { type: 'CommitmentReference', schema: CommitmentReferenceSchema },
  { type: 'PurchaseOrderContent', schema: PurchaseOrderContentSchema },
  { type: 'SealedPurchaseOrder', schema: SealedPurchaseOrderSchema },
  { type: 'ReceiptPayload', schema: ReceiptPayloadSchema },
  {
    type: 'SupplierDeliveryTransitionContent',
    schema: SupplierDeliveryTransitionContentSchema,
  },
  { type: 'SealedSupplierDeliveryTransition', schema: SealedSupplierDeliveryTransitionSchema },
  { type: 'ConstraintEvaluationReference', schema: ConstraintEvaluationReferenceSchema },
  { type: 'SubstitutionRequestContent', schema: SubstitutionRequestContentSchema },
  { type: 'SealedSubstitutionRequest', schema: SealedSubstitutionRequestSchema },
  { type: 'SealedAcquisitionStatus', schema: SealedAcquisitionStatusSchema },
  { type: 'ProcurementEventContent', schema: ProcurementEventContentSchema },
  { type: 'SealedProcurementEvent', schema: SealedProcurementEventSchema },
];
