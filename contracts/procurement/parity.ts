/**
 * Compile-time conformance assertions for the procurement contract
 * surface.
 *
 * Mirrors `contracts/solution-delivery/parity.ts` and
 * `contracts/agent/parity.ts`: imports both the published declarations
 * (`./index`) and the runtime implementation (`@epoch/procurement`)
 * and asserts strict type identity for every surface type, so the
 * self-contained declarations cannot drift from the zod-inferred
 * implementation types. Compiled by `packages/procurement`'s
 * `typecheck` script (`tsconfig.contracts.json`); any drift fails
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/procurement';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type SupplierDeliveryStateParity = Expect<
  Equals<contracts.SupplierDeliveryState, impl.SupplierDeliveryState>
>;
export type QuoteStateParity = Expect<Equals<contracts.QuoteState, impl.QuoteState>>;
export type QuoteAllocationStateParity = Expect<
  Equals<contracts.QuoteAllocationState, impl.QuoteAllocationState>
>;
export type LeadTimeSemanticsParity = Expect<
  Equals<contracts.LeadTimeSemantics, impl.LeadTimeSemantics>
>;
export type ProcurementStatusStateParity = Expect<
  Equals<contracts.ProcurementStatusState, impl.ProcurementStatusState>
>;
export type SubstitutionDecisionKindParity = Expect<
  Equals<contracts.SubstitutionDecisionKind, impl.SubstitutionDecisionKind>
>;
export type ProcurementEventDiscriminatorParity = Expect<
  Equals<contracts.ProcurementEventDiscriminator, impl.ProcurementEventDiscriminator>
>;
export type RequirementRefKindParity = Expect<
  Equals<contracts.RequirementRefKind, impl.RequirementRefKind>
>;
export type DanglingQuoteReasonParity = Expect<
  Equals<contracts.DanglingQuoteReason, impl.DanglingQuoteReason>
>;
export type ProcurementReferenceKindParity = Expect<
  Equals<contracts.ProcurementReferenceKind, impl.ProcurementReferenceKind>
>;
export type ProcurementErrorCodeParity = Expect<
  Equals<contracts.ProcurementErrorCode, impl.ProcurementErrorCode>
>;

// Neutral primitives.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type SupplierIdParity = Expect<Equals<contracts.SupplierId, impl.SupplierId>>;
export type LineageIdParity = Expect<Equals<contracts.LineageId, impl.LineageId>>;
export type PackageIdParity = Expect<Equals<contracts.PackageId, impl.PackageId>>;
export type QuoteIdParity = Expect<Equals<contracts.QuoteId, impl.QuoteId>>;
export type SelectionIdParity = Expect<Equals<contracts.SelectionId, impl.SelectionId>>;
export type PoIdParity = Expect<Equals<contracts.PoId, impl.PoId>>;
export type PoTransitionIdParity = Expect<Equals<contracts.PoTransitionId, impl.PoTransitionId>>;
export type SubstitutionIdParity = Expect<
  Equals<contracts.SubstitutionId, impl.SubstitutionId>
>;
export type ProcurementStreamIdParity = Expect<
  Equals<contracts.ProcurementStreamId, impl.ProcurementStreamId>
>;
export type ProcurementPrincipalIdParity = Expect<
  Equals<contracts.ProcurementPrincipalId, impl.ProcurementPrincipalId>
>;

// Error taxonomy + result.
export type ProcurementIssueParity = Expect<
  Equals<contracts.ProcurementIssue, impl.ProcurementIssue>
>;
export type ProcurementErrorParity = Expect<
  Equals<contracts.ProcurementError, impl.ProcurementError>
>;
export type ProcurementResultParity = Expect<
  Equals<contracts.ProcurementResult<string>, impl.ProcurementResult<string>>
>;

// Requirement lineage.
export type RequirementRefParity = Expect<
  Equals<contracts.RequirementRef, impl.RequirementRef>
>;
export type RequirementLineageContentParity = Expect<
  Equals<contracts.RequirementLineageContent, impl.RequirementLineageContent>
>;
export type SealedRequirementLineageParity = Expect<
  Equals<contracts.SealedRequirementLineage, impl.SealedRequirementLineage>
>;

// Acquisition packages.
export type PackageLineParity = Expect<Equals<contracts.PackageLine, impl.PackageLine>>;
export type AcquisitionPackageContentParity = Expect<
  Equals<contracts.AcquisitionPackageContent, impl.AcquisitionPackageContent>
>;
export type SealedAcquisitionPackageParity = Expect<
  Equals<contracts.SealedAcquisitionPackage, impl.SealedAcquisitionPackage>
>;

// Quotes.
export type LeadTimeObservationParity = Expect<
  Equals<contracts.LeadTimeObservation, impl.LeadTimeObservation>
>;
export type QuoteAllocationParity = Expect<
  Equals<contracts.QuoteAllocation, impl.QuoteAllocation>
>;
export type QuoteLineParity = Expect<Equals<contracts.QuoteLine, impl.QuoteLine>>;
export type QuoteContentParity = Expect<Equals<contracts.QuoteContent, impl.QuoteContent>>;
export type SealedQuoteParity = Expect<Equals<contracts.SealedQuote, impl.SealedQuote>>;

// Selections.
export type ConsideredQuoteParity = Expect<
  Equals<contracts.ConsideredQuote, impl.ConsideredQuote>
>;
export type QuoteSelectionContentParity = Expect<
  Equals<contracts.QuoteSelectionContent, impl.QuoteSelectionContent>
>;
export type SealedQuoteSelectionParity = Expect<
  Equals<contracts.SealedQuoteSelection, impl.SealedQuoteSelection>
>;

// Commitment linkage.
export type CommitmentReferenceParity = Expect<
  Equals<contracts.CommitmentReference, impl.CommitmentReference>
>;
export type CommitmentLinkageParity = Expect<
  Equals<contracts.CommitmentLinkage, impl.CommitmentLinkage>
>;

// Purchase orders.
export type PoLineParity = Expect<Equals<contracts.PoLine, impl.PoLine>>;
export type PoTotalParity = Expect<Equals<contracts.PoTotal, impl.PoTotal>>;
export type SelectionReferenceParity = Expect<
  Equals<contracts.SelectionReference, impl.SelectionReference>
>;
export type PurchaseOrderContentParity = Expect<
  Equals<contracts.PurchaseOrderContent, impl.PurchaseOrderContent>
>;
export type SealedPurchaseOrderParity = Expect<
  Equals<contracts.SealedPurchaseOrder, impl.SealedPurchaseOrder>
>;

// Supplier delivery.
export type ObservationReferenceParity = Expect<
  Equals<contracts.ObservationReference, impl.ObservationReference>
>;
export type ReceiptLineParity = Expect<Equals<contracts.ReceiptLine, impl.ReceiptLine>>;
export type ReceiptPayloadParity = Expect<
  Equals<contracts.ReceiptPayload, impl.ReceiptPayload>
>;
export type SupplierDeliveryTransitionContentParity = Expect<
  Equals<contracts.SupplierDeliveryTransitionContent, impl.SupplierDeliveryTransitionContent>
>;
export type SealedSupplierDeliveryTransitionParity = Expect<
  Equals<contracts.SealedSupplierDeliveryTransition, impl.SealedSupplierDeliveryTransition>
>;

// Substitutions.
export type SubstitutionLineParity = Expect<
  Equals<contracts.SubstitutionLine, impl.SubstitutionLine>
>;
export type ConstraintEvaluationReferenceParity = Expect<
  Equals<contracts.ConstraintEvaluationReference, impl.ConstraintEvaluationReference>
>;
export type SubstitutionRequestContentParity = Expect<
  Equals<contracts.SubstitutionRequestContent, impl.SubstitutionRequestContent>
>;
export type SealedSubstitutionRequestParity = Expect<
  Equals<contracts.SealedSubstitutionRequest, impl.SealedSubstitutionRequest>
>;
export type SubstitutionDecisionContentParity = Expect<
  Equals<contracts.SubstitutionDecisionContent, impl.SubstitutionDecisionContent>
>;
export type SealedSubstitutionDecisionParity = Expect<
  Equals<contracts.SealedSubstitutionDecision, impl.SealedSubstitutionDecision>
>;

// Status projection.
export type AcquisitionStatusDetailParity = Expect<
  Equals<contracts.AcquisitionStatusDetail, impl.AcquisitionStatusDetail>
>;
export type SealedAcquisitionStatusParity = Expect<
  Equals<contracts.SealedAcquisitionStatus, impl.SealedAcquisitionStatus>
>;

// Events.
export type ProcurementEventSequenceParity = Expect<
  Equals<contracts.ProcurementEventSequence, impl.ProcurementEventSequence>
>;
export type ProcurementCausalParentParity = Expect<
  Equals<contracts.ProcurementCausalParent, impl.ProcurementCausalParent>
>;
export type ProcurementEventPayloadParity = Expect<
  Equals<contracts.ProcurementEventPayload, impl.ProcurementEventPayload>
>;
export type ProcurementEventContentParity = Expect<
  Equals<contracts.ProcurementEventContent, impl.ProcurementEventContent>
>;
export type SealedProcurementEventParity = Expect<
  Equals<contracts.SealedProcurementEvent, impl.SealedProcurementEvent>
>;

// Event payload data.
export type PackageAssembledDataParity = Expect<
  Equals<contracts.PackageAssembledData, impl.PackageAssembledData>
>;
export type QuoteReceivedDataParity = Expect<
  Equals<contracts.QuoteReceivedData, impl.QuoteReceivedData>
>;
export type QuoteSelectedDataParity = Expect<
  Equals<contracts.QuoteSelectedData, impl.QuoteSelectedData>
>;
export type CommitmentLinkedDataParity = Expect<
  Equals<contracts.CommitmentLinkedData, impl.CommitmentLinkedData>
>;
export type PoIssuedDataParity = Expect<Equals<contracts.PoIssuedData, impl.PoIssuedData>>;
export type DeliveryTransitionRecordedDataParity = Expect<
  Equals<contracts.DeliveryTransitionRecordedData, impl.DeliveryTransitionRecordedData>
>;
export type ReceiptRecordedDataParity = Expect<
  Equals<contracts.ReceiptRecordedData, impl.ReceiptRecordedData>
>;
export type SubstitutionRequestedDataParity = Expect<
  Equals<contracts.SubstitutionRequestedData, impl.SubstitutionRequestedData>
>;
export type SubstitutionDecidedDataParity = Expect<
  Equals<contracts.SubstitutionDecidedData, impl.SubstitutionDecidedData>
>;
export type StatusProjectedDataParity = Expect<
  Equals<contracts.StatusProjectedData, impl.StatusProjectedData>
>;

// Uncertainty state (composed from W036 at runtime).
export type UncertaintyStateParity = Expect<
  Equals<contracts.UncertaintyState, impl.UncertaintyState>
>;
