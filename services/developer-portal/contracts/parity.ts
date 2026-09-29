/**
 * Compile-time conformance assertions for the developer-portal contract
 * surface (the W012 declaration-only convention, adapted to W025's owned
 * tree: the declarations live INSIDE the service package because W025
 * owns no `contracts/` package path).
 *
 * Mirrors `contracts/experience-compiler/parity.ts`: imports both the
 * published declarations (`./index`) and the runtime implementation
 * (`../src/index`) and asserts strict type identity for every surface
 * type, so the self-contained declarations cannot drift from the
 * implementation types (which are themselves largely re-exports of the
 * upstream kernel contracts). The W010 event shape is additionally
 * asserted against the REAL `@epoch/event-log` `EventContent` (the
 * devDependency parity pin — never a runtime edge). Compiled by
 * `services/developer-portal/tsconfig.json` as part of `pnpm typecheck`.
 * Verification-only; no runtime code.
 */
import type * as contracts from './index';
import type * as impl from '../src/index';
import type { EventContent } from '@epoch/event-log';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// ---------------------------------------------------------------------------
// Versions + vocabularies.
// ---------------------------------------------------------------------------
export type PortalEventDiscriminatorParity = Expect<
  Equals<contracts.PortalEventDiscriminator, impl.PortalEventDiscriminator>
>;
export type ListingLifecycleStateParity = Expect<
  Equals<contracts.ListingLifecycleState, impl.ListingLifecycleState>
>;
export type ListingVisibilityParity = Expect<
  Equals<contracts.ListingVisibility, impl.ListingVisibility>
>;

// ---------------------------------------------------------------------------
// Mirrored upstream payload shapes (W023 pricing/references/trust, W009
// authorization contexts).
// ---------------------------------------------------------------------------
export type PricingModelParity = Expect<
  Equals<contracts.PricingModelInput, impl.ListingDraftInput['pricing']>
>;
export type CapabilityVersionReferenceParity = Expect<
  Equals<
    contracts.CapabilityVersionReferenceInput,
    impl.ListingDraftInput['capabilityReferences'][number]
  >
>;
export type TrustEvidenceRecordParity = Expect<
  Equals<contracts.TrustEvidenceRecordInput, impl.ListingDraftInput['trustEvidence'][number]>
>;
export type AuthorizationContextParity = Expect<
  Equals<contracts.AuthorizationContextInput, impl.AuthorizationContext>
>;

// ---------------------------------------------------------------------------
// Inputs.
// ---------------------------------------------------------------------------
export type ListingDraftInputParity = Expect<
  Equals<contracts.ListingDraftInput, impl.ListingDraftInput>
>;
export type CreateListingDraftInputParity = Expect<
  Equals<contracts.CreateListingDraftInput, impl.CreateListingDraftInput>
>;
export type UpdateListingDraftInputParity = Expect<
  Equals<contracts.UpdateListingDraftInput, impl.UpdateListingDraftInput>
>;
export type ListingOperationInputParity = Expect<
  Equals<contracts.ListingOperationInput, impl.ListingOperationInput>
>;
export type SubmitListingInputParity = Expect<
  Equals<contracts.SubmitListingInput, impl.SubmitListingInput>
>;
export type RetireListingInputParity = Expect<
  Equals<contracts.RetireListingInput, impl.RetireListingInput>
>;
export type PublishListingVersionInputParity = Expect<
  Equals<contracts.PublishListingVersionInput, impl.PublishListingVersionInput>
>;
export type ListingVersionReadInputParity = Expect<
  Equals<contracts.ListingVersionReadInput, impl.ListingVersionReadInput>
>;
export type ListListingsInputParity = Expect<
  Equals<contracts.ListListingsInput, impl.ListListingsInput>
>;
export type BrowseCapabilitiesInputParity = Expect<
  Equals<contracts.BrowseCapabilitiesInput, impl.BrowseCapabilitiesInput>
>;
export type ResolveCapabilityInputParity = Expect<
  Equals<contracts.ResolveCapabilityInput, impl.ResolveCapabilityInput>
>;
export type AdoptGrantInputParity = Expect<Equals<contracts.AdoptGrantInput, impl.AdoptGrantInput>>;
export type AdoptRevocationInputParity = Expect<
  Equals<contracts.AdoptRevocationInput, impl.AdoptRevocationInput>
>;
export type AdoptRevenueInputParity = Expect<
  Equals<contracts.AdoptRevenueInput, impl.AdoptRevenueInput>
>;
export type AdoptBillingAccountInputParity = Expect<
  Equals<contracts.AdoptBillingAccountInput, impl.AdoptBillingAccountInput>
>;
export type DashboardInputParity = Expect<Equals<contracts.DashboardInput, impl.DashboardInput>>;
export type StreamReadInputParity = Expect<Equals<contracts.StreamReadInput, impl.StreamReadInput>>;
export type AuthorizationInputParity = Expect<
  Equals<contracts.AuthorizationInput, impl.AuthorizationInput>
>;

// ---------------------------------------------------------------------------
// Host records (receipts + projections).
// ---------------------------------------------------------------------------
export type ListingCreationReceiptParity = Expect<
  Equals<contracts.ListingCreationReceipt, impl.ListingCreationReceipt>
>;
export type PublicationReceiptParity = Expect<
  Equals<contracts.PublicationReceipt, impl.PublicationReceipt>
>;
export type AdoptionReceiptParity = Expect<
  Equals<contracts.AdoptionReceipt, impl.AdoptionReceipt>
>;
export type ListingSnapshotParity = Expect<Equals<contracts.ListingSnapshot, impl.ListingSnapshot>>;
export type ChainSummaryParity = Expect<Equals<contracts.ChainSummary, impl.ChainSummary>>;
export type PayoutAccountSummaryParity = Expect<
  Equals<contracts.PayoutAccountSummary, impl.PayoutAccountSummary>
>;
export type DeveloperDashboardParity = Expect<
  Equals<contracts.DeveloperDashboard, impl.DeveloperDashboard>
>;
export type HealthReportParity = Expect<Equals<contracts.HealthReport, impl.HealthReport>>;
export type ServiceDescriptionParity = Expect<
  Equals<contracts.ServiceDescription, impl.ServiceDescription>
>;

// ---------------------------------------------------------------------------
// The portal event vocabulary (W010 shapes).
// ---------------------------------------------------------------------------
export type PortalEventSequenceParity = Expect<
  Equals<contracts.PortalEventSequence, impl.PortalEventSequence>
>;
export type PortalCausalParentParity = Expect<
  Equals<contracts.PortalCausalParent, impl.PortalCausalParent>
>;
export type PortalEventPayloadParity = Expect<
  Equals<contracts.PortalEventPayload, impl.PortalEventPayload>
>;
export type PortalEventContentParity = Expect<
  Equals<contracts.PortalEventContent, impl.PortalEventContent>
>;
export type SealedPortalEventParity = Expect<
  Equals<contracts.SealedPortalEvent, impl.SealedPortalEvent>
>;
export type ListingCreatedDataParity = Expect<
  Equals<contracts.ListingCreatedData, impl.ListingCreatedData>
>;
export type DraftUpdatedDataParity = Expect<
  Equals<contracts.DraftUpdatedData, impl.DraftUpdatedData>
>;
export type ListingSubmittedDataParity = Expect<
  Equals<contracts.ListingSubmittedData, impl.ListingSubmittedData>
>;
export type VersionPublishedDataParity = Expect<
  Equals<contracts.VersionPublishedData, impl.VersionPublishedData>
>;
export type ListingRetiredDataParity = Expect<
  Equals<contracts.ListingRetiredData, impl.ListingRetiredData>
>;
export type GrantAdoptedDataParity = Expect<
  Equals<contracts.GrantAdoptedData, impl.GrantAdoptedData>
>;
export type GrantRevokedDataParity = Expect<
  Equals<contracts.GrantRevokedData, impl.GrantRevokedData>
>;
export type RevenueAdoptedDataParity = Expect<
  Equals<contracts.RevenueAdoptedData, impl.RevenueAdoptedData>
>;
export type BillingAccountAdoptedDataParity = Expect<
  Equals<contracts.BillingAccountAdoptedData, impl.BillingAccountAdoptedData>
>;

/** The W010 shape pin: the implementation's event content is W010-shaped. */
export type W010EventContentParity = Expect<Equals<impl.PortalEventContent, EventContent>>;

// ---------------------------------------------------------------------------
// The typed error union.
// ---------------------------------------------------------------------------
export type DeveloperPortalErrorParity = Expect<
  Equals<contracts.DeveloperPortalErrorInput, impl.DeveloperPortalError>
>;
