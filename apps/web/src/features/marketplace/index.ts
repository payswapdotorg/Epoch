/**
 * The marketplace feature module barrel (W023): typed view-model contracts,
 * pure deterministic projections, and presentational components.
 *
 * This module stands alone inside `apps/web` by design (see README.md):
 * no cross-package imports, no routes, no app-shell or global-provider
 * changes (W014's surface); W014 wires it to the host/API seam.
 */
export type {
  EntitlementEvaluationInput,
  EntitlementStatusViewModel,
  ListingLifecycleInput,
  ListingSnapshotInput,
  ListingSummaryViewModel,
  ListingVersionViewModel,
  MarketplaceErrorInput,
  MarketplaceErrorViewModel,
  PricingLine,
  PricingModelInput,
  PricingModelKindInput,
  PricingSummaryViewModel,
  RevenueEntryViewModel,
  RevenueRecordInput,
  SealedListingVersionInput,
  UsageAccountInput,
  UsageSummaryViewModel,
} from './contracts';
export {
  pricingHeadline,
  pricingLines,
  toEntitlementStatus,
  toErrorNotice,
  toListingCatalog,
  toListingSummary,
  toListingVersion,
  toListingVersionHistory,
  toPricingSummary,
  toRevenueEntry,
  toRevenueLedger,
  toUsageSummary,
} from './project';
export { ListingCatalogView } from './components/ListingCatalogView';
export { ListingVersionCard } from './components/ListingVersionCard';
export { EntitlementStatusView } from './components/EntitlementStatusView';
export { PricingSummaryView } from './components/PricingSummaryView';
export { RevenueLedgerView } from './components/RevenueLedgerView';
export { UsageSummaryView } from './components/UsageSummaryView';
export { MarketplaceErrorNotice } from './components/MarketplaceErrorNotice';
