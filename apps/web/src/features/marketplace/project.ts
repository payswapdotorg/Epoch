/**
 * Pure projection functions: kernel-shaped records in, view models out.
 *
 * Deterministic (the house discipline): every output is a plain,
 * presentation-only record; ordering is derived from the input or
 * normalized here (sorted); no clocks, no randomness, no data fetching —
 * these are pure functions of their inputs.
 */
import type {
  EntitlementEvaluationInput,
  EntitlementStatusViewModel,
  ListingSnapshotInput,
  ListingSummaryViewModel,
  ListingVersionViewModel,
  MarketplaceErrorInput,
  MarketplaceErrorViewModel,
  PricingLine,
  PricingModelInput,
  PricingSummaryViewModel,
  RevenueEntryViewModel,
  RevenueRecordInput,
  SealedListingVersionInput,
  UsageAccountInput,
  UsageSummaryViewModel,
} from './contracts';

/** Render a currency amount pair as a display label. */
function money(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

/**
 * Project one pricing model into display lines. The projection covers
 * every member of the closed vocabulary; future kernel additions surface
 * here as compile-time exhaustiveness errors (never silent).
 */
export function pricingLines(pricing: PricingModelInput): readonly PricingLine[] {
  switch (pricing.kind) {
    case 'free':
      return [];
    case 'one-time':
      return [{ label: 'One-time price', value: money(pricing.amount, pricing.currency) }];
    case 'subscription':
      return [
        { label: 'Recurring price', value: money(pricing.recurringAmount, pricing.currency) },
        { label: 'Billing period', value: pricing.billingPeriod },
      ];
    case 'seat-workspace': {
      const lines: PricingLine[] = [
        { label: 'Per-seat price', value: money(pricing.perSeatAmount, pricing.currency) },
        { label: 'Billing period', value: pricing.billingPeriod },
      ];
      if (pricing.minSeats !== undefined) {
        lines.push({ label: 'Minimum seats', value: String(pricing.minSeats) });
      }
      if (pricing.maxSeats !== undefined) {
        lines.push({ label: 'Maximum seats', value: String(pricing.maxSeats) });
      }
      return lines;
    }
    case 'usage-metered': {
      const lines: PricingLine[] = [
        { label: 'Metered unit', value: pricing.unitName },
        { label: 'Price per unit', value: money(pricing.unitAmount, pricing.currency) },
      ];
      if (pricing.includedUnits !== undefined) {
        lines.push({ label: 'Included units', value: pricing.includedUnits });
      }
      return lines;
    }
    case 'hybrid':
      return [
        ...pricingLines(pricing.fixed).map((line) => ({
          label: `Base — ${line.label}`,
          value: line.value,
        })),
        ...pricingLines(pricing.metered).map((line) => ({
          label: `Metered — ${line.label}`,
          value: line.value,
        })),
      ];
    case 'enterprise-private':
      return [
        { label: 'Contact route', value: pricing.contactRoute },
        { label: 'Private audience', value: String(pricing.audienceTenantIds.length) },
      ];
  }
}

/** The one-line headline of a pricing model. */
export function pricingHeadline(pricing: PricingModelInput): string {
  switch (pricing.kind) {
    case 'free':
      return 'Free';
    case 'one-time':
      return `${money(pricing.amount, pricing.currency)} one-time`;
    case 'subscription':
      return `${money(pricing.recurringAmount, pricing.currency)} / ${pricing.billingPeriod}`;
    case 'seat-workspace':
      return `${money(pricing.perSeatAmount, pricing.currency)} per seat / ${pricing.billingPeriod}`;
    case 'usage-metered':
      return `${money(pricing.unitAmount, pricing.currency)} per ${pricing.unitName}`;
    case 'hybrid':
      return `${pricingHeadline(pricing.fixed)} + ${pricingHeadline(pricing.metered)}`;
    case 'enterprise-private':
      return 'Private — contact for terms';
  }
}

/** Project one pricing model into its summary view model. */
export function toPricingSummary(pricing: PricingModelInput): PricingSummaryViewModel {
  return {
    kind: pricing.kind,
    headline: pricingHeadline(pricing),
    lines: pricingLines(pricing),
  };
}

/** Project one catalog snapshot into a summary view model. */
export function toListingSummary(
  snapshot: ListingSnapshotInput,
  pricing?: PricingModelInput | undefined,
): ListingSummaryViewModel {
  return {
    listingId: snapshot.listingId,
    displayName: snapshot.displayName,
    developerTenantId: snapshot.developerTenantId,
    lifecycle: snapshot.lifecycle,
    visibility: snapshot.visibility,
    publishedVersionCount: snapshot.publishedVersionCount,
    headVersion: snapshot.headVersion,
    pricingHeadline: pricing === undefined ? null : pricingHeadline(pricing),
  };
}

/** Project a catalog (sorted by listingId — deterministic order). */
export function toListingCatalog(
  snapshots: readonly ListingSnapshotInput[],
  pricingByListing?: ReadonlyMap<string, PricingModelInput>,
): readonly ListingSummaryViewModel[] {
  return [...snapshots]
    .sort((a, b) => (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0))
    .map((snapshot) => toListingSummary(snapshot, pricingByListing?.get(snapshot.listingId)));
}

/** Project one sealed published version into a version card view model. */
export function toListingVersion(version: SealedListingVersionInput): ListingVersionViewModel {
  return {
    listingId: version.listingId,
    version: version.version,
    displayName: version.displayName,
    publishedAt: version.publishedAt,
    contentDigest: version.contentDigest,
    capabilityCount: version.capabilityReferences.length,
    trustEvidenceCount: version.trustEvidenceCount,
    visibility: version.visibility,
  };
}

/** Project a version history (ascending by semver core, deterministic). */
export function toListingVersionHistory(
  versions: readonly SealedListingVersionInput[],
): readonly ListingVersionViewModel[] {
  const ordered = [...versions].sort((a, b) => {
    const [amajor, aminor, apatch] = a.version.split('.').map(Number);
    const [bmajor, bminor, bpatch] = b.version.split('.').map(Number);
    if (amajor !== bmajor) return amajor - bmajor;
    if (aminor !== bminor) return aminor - bminor;
    return apatch - bpatch;
  });
  return ordered.map(toListingVersion);
}

/** Project one entitlement evaluation into a status view model. */
export function toEntitlementStatus(
  evaluation: EntitlementEvaluationInput,
): EntitlementStatusViewModel {
  const { entitlement } = evaluation;
  return {
    entitlementId: entitlement.entitlementId,
    listingId: entitlement.listingId,
    tenantId: entitlement.tenantId,
    scopeLabel:
      entitlement.scope.kind === 'tenant'
        ? 'Tenant-wide'
        : `Workspace ${entitlement.scope.workspaceId}`,
    seatsLabel: entitlement.seats === undefined ? null : `${entitlement.seats} seats`,
    grantedAt: entitlement.grantedAt,
    grantedBy: entitlement.grantedBy,
    provenanceLabel:
      entitlement.provenance.kind === 'direct'
        ? 'Granted directly'
        : `Synced from payment port ${entitlement.provenance.portId}`,
    status: 'active',
    revokedRelatedCount: evaluation.revokedMatchingCount,
  };
}

/** Project one usage account into a summary view model. */
export function toUsageSummary(account: UsageAccountInput): UsageSummaryViewModel {
  const hasWindow = account.firstEventAt !== undefined && account.lastEventAt !== undefined;
  return {
    entitlementId: account.entitlementId,
    listingId: account.listingId,
    eventCount: account.eventCount,
    totalUnits: account.totalUnits,
    windowLabel: hasWindow ? `${account.firstEventAt} — ${account.lastEventAt}` : null,
    streamId: account.streamId,
  };
}

/** Project one revenue record into a ledger entry view model. */
export function toRevenueEntry(record: RevenueRecordInput): RevenueEntryViewModel {
  return {
    revenueId: record.revenueId,
    acquiringTenantId: record.acquiringTenantId,
    listingId: record.listingId,
    basis: record.basis,
    amountLabel: money(record.amount, record.currency),
    recordedAt: record.recordedAt,
    provenanceLabel: provenanceLabelOf(record.provenance.kind),
  };
}

/** Project a revenue ledger (sorted by recordedAt then revenueId). */
export function toRevenueLedger(
  records: readonly RevenueRecordInput[],
): readonly RevenueEntryViewModel[] {
  return [...records]
    .sort((a, b) => {
      if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
      return a.revenueId < b.revenueId ? -1 : 1;
    })
    .map(toRevenueEntry);
}

function provenanceLabelOf(kind: string): string {
  switch (kind) {
    case 'usage-event':
      return 'From usage event';
    case 'entitlement':
      return 'From entitlement';
    case 'manual-entry':
      return 'Manual entry';
    default:
      return kind;
  }
}

/** Project a typed marketplace error into a display notice. */
export function toErrorNotice(error: MarketplaceErrorInput): MarketplaceErrorViewModel {
  return { code: error.code, message: error.message };
}
