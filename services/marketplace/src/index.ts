/**
 * @epoch/marketplace-host — public API (service layer, Work Order W023).
 *
 * The long-running in-memory reference HOST of the marketplace: listing
 * lifecycle sessions (draft -> submitted -> published; publication seals
 * the immutable hash-chained version), entitlement evaluation sessions
 * (check + grant/revoke with full provenance and immediate revocation),
 * payment-port registration and check passthrough (payment state never
 * authority), idempotent duplicate-suppressed usage metering intake,
 * developer revenue record intake, tenant-scoped reads (R12), and
 * health/liveness as typed data.
 *
 * NO persistence, NO network, NO real processes. The typed domain model
 * lives in @epoch/marketplace (kernel); this host never recreates the
 * kernel's authorities (it consumes the real W007 registry, the real
 * kernel seals/verifiers, and the real pure entitlement check).
 */
export { HOST_RECORD_VERSION, IDEMPOTENCY_KEY_PATTERN, MARKETPLACE_HOST_SERVICE_NAME } from './version';

export { MarketplaceHost, type MarketplaceHostOptions } from './host';

export type {
  CheckEntitlementInput,
  CreateListingInput,
  EntitlementEvaluation,
  EntitlementGrantReceipt,
  EntitlementRevokeReceipt,
  GrantEntitlementInput,
  HealthReport,
  HostPaymentCheckInput,
  HostResult,
  IdempotencyKey,
  ListingChainSummary,
  ListingCreationReceipt,
  ListingDraftInput,
  ListingLifecycleInput,
  ListingSnapshot,
  ListingVersionInput,
  ListListingsInput,
  ListRevenueInput,
  PrincipalId,
  PublishListingVersionInput,
  PublicationReceipt,
  RecordRevenueInput,
  RecordUsageInput,
  RevenueRecordReceipt,
  RevokeEntitlementInput,
  ServiceDescription,
  SyncEntitlementInput,
  TenantId,
  UpdateDraftInput,
  UsageAccountInput,
  UsageAccountProjection,
  UsageRecordReceipt,
} from './types';
export type {
  MarketplaceError,
  PaymentCheckOutcome,
  SealedListingVersion,
  SealedUsageEvent,
  UsageEventData,
} from '@epoch/marketplace';
