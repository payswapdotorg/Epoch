// Developer Portal feature components: rendering smoke (server markup).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CapabilityBrowseView } from './components/CapabilityBrowseView';
import { DeveloperListingsView } from './components/DeveloperListingsView';
import { EntitlementAdoptionsView } from './components/EntitlementAdoptionsView';
import { ListingVersionCard } from './components/ListingVersionCard';
import { PayoutAccountView } from './components/PayoutAccountView';
import { PortalEventFeedView } from './components/PortalEventFeedView';
import { RevenueLedgerView } from './components/RevenueLedgerView';
import {
  toCapabilityRows,
  toDeveloperListings,
  toEntitlementAdoptions,
  toListingVersionHistory,
  toPayoutAccount,
  toPortalEventFeed,
  toRevenueLedger,
} from './project';
import type {
  CapabilityRecordInput,
  ListingSnapshotInput,
  PortalEventInput,
  RevenueRecordInput,
  SealedListingVersionInput,
} from './contracts';

const LISTING: ListingSnapshotInput = {
  schemaVersion: 1,
  listingId: 'listing:bbb',
  developerTenantId: 'tenant:acme-dev',
  lifecycle: 'published',
  visibility: 'public',
  displayName: 'Stress Simulation Suite',
  publishedVersionCount: 2,
  headVersion: '1.1.0',
  headDigest: 'b'.repeat(64),
};

const VERSION: SealedListingVersionInput = {
  listingId: 'listing:bbb',
  version: '1.0.0',
  developerTenantId: 'tenant:acme-dev',
  displayName: 'Stress Simulation Suite',
  capabilityReferences: [{ capabilityId: 'stress.sim-fabric', version: '1.0.0' }],
  visibility: 'public',
  publishedAt: '2026-05-01T08:00:02.000Z',
  contentDigest: '1'.repeat(64),
  previousVersionDigest: null,
};

const CAPABILITY: CapabilityRecordInput = {
  schemaVersion: 1,
  manifest: {
    capabilityId: 'stress.sim-fabric',
    category: 'simulation',
    version: '1.1.0',
    descriptor: { displayName: 'Sim Fabric' },
  },
  lifecycle: 'registered',
  manifestDigest: 'a'.repeat(64),
};

const ADOPTION = {
  entitlementId: 'entitlement:globex-stress',
  tenantId: 'tenant:globex',
  listingId: 'listing:bbb',
  listingVersionDigest: '2'.repeat(64),
  scope: { kind: 'tenant' as const },
  seats: 3,
  grantedAt: '2026-05-01T08:00:02.000Z',
  grantedBy: 'principal:portal-ops',
  status: 'active' as const,
};

const REVENUE: RevenueRecordInput = {
  revenueId: 'revenue:globex-001',
  developerTenantId: 'tenant:acme-dev',
  acquiringTenantId: 'tenant:globex',
  listingId: 'listing:bbb',
  basis: 'usage',
  amount: '43.75',
  currency: 'EUR',
  recordedAt: '2026-05-01T08:00:03.000Z',
};

const EVENT: PortalEventInput = {
  sequence: 1,
  tenantId: 'tenant:acme-dev',
  actor: 'principal:portal-dev',
  payload: { discriminator: 'portal:listing-created', data: {} },
  occurredAt: '2026-05-01T08:00:00.000Z',
  contentDigest: 'e'.repeat(64),
};

describe('developer portal feature components', () => {
  it('DeveloperListingsView renders the developer listing table', () => {
    const html = renderToStaticMarkup(
      createElement(DeveloperListingsView, { listings: toDeveloperListings([LISTING]) }),
    );
    expect(html).toContain('<table');
    expect(html).toContain('Stress Simulation Suite');
    expect(html).toContain('published');
    expect(html).toContain('1.1.0');
  });

  it('DeveloperListingsView renders the empty state', () => {
    const html = renderToStaticMarkup(createElement(DeveloperListingsView, { listings: [] }));
    expect(html).toContain('role="status"');
    expect(html).toContain('No listings authored');
  });

  it('ListingVersionCard renders the sealed version with its digest', () => {
    const html = renderToStaticMarkup(
      createElement(ListingVersionCard, {
        version: toListingVersionHistory([VERSION])[0]!,
      }),
    );
    expect(html).toContain('<article');
    expect(html).toContain('Stress Simulation Suite');
    expect(html).toContain('1'.repeat(64));
    expect(html).toContain('first version');
    expect(html).toContain('<time');
  });

  it('CapabilityBrowseView renders the registry rows', () => {
    const html = renderToStaticMarkup(
      createElement(CapabilityBrowseView, { rows: toCapabilityRows([CAPABILITY]) }),
    );
    expect(html).toContain('stress.sim-fabric');
    expect(html).toContain('simulation');
    expect(html).toContain('Sim Fabric');
  });

  it('EntitlementAdoptionsView renders the adoption rows', () => {
    const html = renderToStaticMarkup(
      createElement(EntitlementAdoptionsView, {
        adoptions: toEntitlementAdoptions([ADOPTION]),
      }),
    );
    expect(html).toContain('entitlement:globex-stress');
    expect(html).toContain('Tenant-wide');
    expect(html).toContain('3 seats');
    expect(html).toContain('active');
  });

  it('RevenueLedgerView renders the ledger rows with money labels', () => {
    const html = renderToStaticMarkup(
      createElement(RevenueLedgerView, { entries: toRevenueLedger([REVENUE]) }),
    );
    expect(html).toContain('revenue:globex-001');
    expect(html).toContain('43.75 EUR');
  });

  it('PayoutAccountView renders the account card and the empty state', () => {
    const html = renderToStaticMarkup(
      createElement(PayoutAccountView, {
        account: toPayoutAccount({
          schemaVersion: 1,
          accountId: 'billing-account:acme-payout',
          currency: 'EUR',
          displayName: 'Acme developer payout account',
          openedAt: '2026-05-01T08:00:01.000Z',
          contentDigest: 'd'.repeat(64),
        }),
      }),
    );
    expect(html).toContain('billing-account:acme-payout');
    expect(html).toContain('Settlement currency EUR');
    const empty = renderToStaticMarkup(createElement(PayoutAccountView, { account: null }));
    expect(empty).toContain('No payout account adopted yet.');
  });

  it('PortalEventFeedView renders the ordered event feed', () => {
    const html = renderToStaticMarkup(
      createElement(PortalEventFeedView, { rows: toPortalEventFeed([EVENT]) }),
    );
    expect(html).toContain('<ol');
    expect(html).toContain('listing-created');
    expect(html).toContain('principal:portal-dev');
  });
});
