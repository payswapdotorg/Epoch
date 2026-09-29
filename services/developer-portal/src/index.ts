/**
 * @epoch/developer-portal-host — public API (service layer, Work Order
 * W025: Developer Portal/Publishing).
 *
 * The thin typed HOST FACADE for the developer-facing authoring,
 * publishing, and analytics surface: capability browsing over the REAL
 * W007 registry, listing authoring/publishing sessions over the REAL W023
 * marketplace kernel admission (sealed, immutable, hash-chained listing
 * versions), developer analytics adoption of W023 grant/revocation/
 * revenue records and the W024 sealed billing account, the deterministic
 * developer dashboard, tenant-scoped reads (R12), and health/liveness as
 * typed data — every operation behind the W009 authorization gate.
 *
 * Runtime dependency policy (W025): @epoch/agent-protocol (digests,
 * canonical JSON, timestamps), @epoch/authorization (the W009 decision
 * point), @epoch/capability-registry (the W007 browse surface), and
 * @epoch/marketplace (the W023 listing-version/entitlement/revenue
 * authority), @epoch/entitlements (the W024 billing-account verifier) are
 * the ONLY @epoch runtime dependencies. Compatibility with @epoch/event-log
 * is pinned via devDependencies + runtime parity tests — never a runtime
 * edge. The declaration-only public contract tree lives under contracts/
 * (the W012 convention: index.d.ts + manifest.json + parity.ts +
 * schemas/, NO package.json).
 */
export { DeveloperPortalHost } from './host';
export type { DeveloperPortalHostOptions } from './types';

// Version constants + vocabularies.
export {
  DEVELOPER_PORTAL_CONTRACT_VERSION,
  DEVELOPER_PORTAL_HOST_SERVICE_NAME,
  HOST_RECORD_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
  PORTAL_EVENT_DISCRIMINATORS,
  PORTAL_EVENT_RECORD_VERSION,
  PORTAL_STREAM_ID_PATTERN,
  portalDeveloperStreamIdOf,
  portalListingStreamIdOf,
} from './version';
export type { PortalEventDiscriminator } from './version';

// Host input/output surface.
export type {
  AdoptBillingAccountInput,
  AdoptGrantInput,
  AdoptRevenueInput,
  AdoptRevocationInput,
  AuthorizationInput,
  BrowseCapabilitiesInput,
  CapabilityBrowseSurface,
  CreateListingDraftInput,
  DashboardInput,
  DeveloperPortalError,
  DeveloperPortalResult,
  HostResult,
  IdempotencyKey,
  ListingDraftInput,
  ListingOperationInput,
  ListingVersionReadInput,
  ListListingsInput,
  PrincipalId,
  PublishListingVersionInput,
  ResolveCapabilityInput,
  RetireListingInput,
  StreamReadInput,
  SubmitListingInput,
  TenantId,
  UpdateListingDraftInput,
} from './types';
export type { AuthorizationContext } from './types';

// Portal-owned records (zod-validated + emitted to contracts/schemas).
export type {
  AdoptionReceipt,
  ChainSummary,
  DeveloperDashboard,
  HealthReport,
  ListingCreationReceipt,
  ListingSnapshot,
  PayoutAccountSummary,
  PublicationReceipt,
  ServiceDescription,
} from './projections';
export {
  ListingCreationReceiptSchema,
  PublicationReceiptSchema,
  AdoptionReceiptSchema,
  ListingSnapshotSchema,
  ChainSummarySchema,
  PayoutAccountSummarySchema,
  DeveloperDashboardSchema,
  HealthReportSchema,
  ServiceDescriptionSchema,
} from './projections';

// The portal event vocabulary over the W010 shapes.
export type {
  BillingAccountAdoptedData,
  DraftUpdatedData,
  GrantAdoptedData,
  GrantRevokedData,
  ListingCreatedData,
  ListingRetiredData,
  ListingSubmittedData,
  PortalCausalParent,
  PortalEventContent,
  PortalEventPayload,
  PortalEventSequence,
  RevenueAdoptedData,
  SealedPortalEvent,
  VersionPublishedData,
} from './events';
export {
  BillingAccountAdoptedDataSchema,
  DraftUpdatedDataSchema,
  GrantAdoptedDataSchema,
  GrantRevokedDataSchema,
  ListingCreatedDataSchema,
  ListingRetiredDataSchema,
  ListingSubmittedDataSchema,
  PORTAL_EVENT_DATA_SCHEMAS,
  PortalCausalParentSchema,
  PortalEventContentSchema,
  PortalEventPayloadSchema,
  PortalEventSequenceSchema,
  RevenueAdoptedDataSchema,
  SealedPortalEventSchema,
  VersionPublishedDataSchema,
  computePortalEventDigest,
  isPortalEventDiscriminator,
  parsePortalEventData,
  sealPortalEvent,
  verifySealedPortalEvent,
} from './events';

// Upstream record types re-exported for host callers (the owning
// packages stay the authorities; these are reference re-exports only).
export type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  ListingLifecycleState,
  ListingVisibility,
  RevenueRecord,
  SealedListingVersion,
} from '@epoch/marketplace';
export type { CapabilityRecord } from '@epoch/capability-registry';
export type { SealedBillingAccount } from '@epoch/entitlements';

// Published schema surface + deterministic contract emission.
export { DEVELOPER_PORTAL_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  DEVELOPER_PORTAL_CONTRACT_DIR,
  renderDeveloperPortalContractFiles,
  typeToKebabCase,
} from './contract-emission';
