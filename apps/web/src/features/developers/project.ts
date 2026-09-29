/**
 * Pure projection functions: service-shaped records in, view models out.
 *
 * Deterministic (the house discipline): every output is a plain,
 * presentation-only record; ordering is derived from the input or
 * normalized here (sorted); no clocks, no randomness, no data fetching —
 * these are pure functions of their inputs.
 */
import type {
  CapabilityRecordInput,
  CapabilityRowViewModel,
  DeveloperListingViewModel,
  DeveloperPortalErrorInput,
  DeveloperPortalErrorViewModel,
  EntitlementAdoptionInput,
  EntitlementAdoptionViewModel,
  ListingSnapshotInput,
  ListingVersionViewModel,
  PayoutAccountInput,
  PayoutAccountViewModel,
  PortalEventInput,
  PortalEventRowViewModel,
  RevenueEntryViewModel,
  RevenueRecordInput,
  SealedListingVersionInput,
} from './contracts';

/** Render a currency amount pair as a display label. */
function money(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

/** Project one listing snapshot into a developer listing row. */
export function toDeveloperListing(snapshot: ListingSnapshotInput): DeveloperListingViewModel {
  return {
    listingId: snapshot.listingId,
    displayName: snapshot.displayName,
    lifecycle: snapshot.lifecycle,
    visibility: snapshot.visibility,
    publishedVersionCount: snapshot.publishedVersionCount,
    headVersion: snapshot.headVersion,
  };
}

/** Project the developer's listings (sorted by listingId — deterministic). */
export function toDeveloperListings(
  snapshots: readonly ListingSnapshotInput[],
): readonly DeveloperListingViewModel[] {
  return [...snapshots]
    .sort((a, b) => (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0))
    .map(toDeveloperListing);
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
    visibility: version.visibility,
    chainLabel:
      version.previousVersionDigest === null ? 'first version' : 'linked to prior version',
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

/** Project one capability record into a browse row. */
export function toCapabilityRow(record: CapabilityRecordInput): CapabilityRowViewModel {
  return {
    capabilityId: record.manifest.capabilityId,
    version: record.manifest.version,
    category: record.manifest.category,
    lifecycle: record.lifecycle,
    displayName: record.manifest.descriptor.displayName,
    manifestDigest: record.manifestDigest,
  };
}

/** Project a capability browse listing (sorted by capability id then version). */
export function toCapabilityRows(
  records: readonly CapabilityRecordInput[],
): readonly CapabilityRowViewModel[] {
  return [...records]
    .sort((a, b) => {
      if (a.manifest.capabilityId !== b.manifest.capabilityId) {
        return a.manifest.capabilityId < b.manifest.capabilityId ? -1 : 1;
      }
      return a.manifest.version < b.manifest.version ? -1 : 1;
    })
    .map(toCapabilityRow);
}

/** Project one entitlement adoption into a status row. */
export function toEntitlementAdoption(
  adoption: EntitlementAdoptionInput,
): EntitlementAdoptionViewModel {
  return {
    entitlementId: adoption.entitlementId,
    listingId: adoption.listingId,
    acquiringTenantId: adoption.tenantId,
    scopeLabel:
      adoption.scope.kind === 'tenant'
        ? 'Tenant-wide'
        : `Workspace ${adoption.scope.workspaceId}`,
    seatsLabel: adoption.seats === undefined ? null : `${adoption.seats} seats`,
    grantedAt: adoption.grantedAt,
    status: adoption.status,
  };
}

/** Project entitlement adoptions (sorted by entitlementId — deterministic). */
export function toEntitlementAdoptions(
  adoptions: readonly EntitlementAdoptionInput[],
): readonly EntitlementAdoptionViewModel[] {
  return [...adoptions]
    .sort((a, b) => (a.entitlementId < b.entitlementId ? -1 : 1))
    .map(toEntitlementAdoption);
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

/** Project the adopted payout account into a card view model. */
export function toPayoutAccount(account: PayoutAccountInput): PayoutAccountViewModel {
  return {
    accountId: account.accountId,
    displayName: account.displayName,
    currencyLabel: `Settlement currency ${account.currency}`,
    openedAt: account.openedAt,
    contentDigest: account.contentDigest,
  };
}

/** Project a portal event feed (sorted by sequence — the stream order). */
export function toPortalEventFeed(
  events: readonly PortalEventInput[],
): readonly PortalEventRowViewModel[] {
  return [...events]
    .sort((a, b) => a.sequence - b.sequence)
    .map((event) => ({
      sequence: event.sequence,
      discriminatorLabel: event.payload.discriminator.replace(/^portal:/, ''),
      actor: event.actor,
      occurredAt: event.occurredAt,
    }));
}

/** Project a typed developer-portal error into a display notice. */
export function toErrorNotice(error: DeveloperPortalErrorInput): DeveloperPortalErrorViewModel {
  return { code: error.code, message: error.message };
}
