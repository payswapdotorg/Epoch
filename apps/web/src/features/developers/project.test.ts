// Developer Portal feature projections: deterministic view-model
// derivation from service-shaped records (structural mirrors). Pure
// functions — no clock, no randomness, no environment access.
import { describe, expect, it } from 'vitest';
import {
  toCapabilityRows,
  toDeveloperListings,
  toEntitlementAdoptions,
  toErrorNotice,
  toListingVersionHistory,
  toPayoutAccount,
  toPortalEventFeed,
  toRevenueLedger,
} from './project';
import type {
  CapabilityRecordInput,
  EntitlementAdoptionInput,
  ListingSnapshotInput,
  PayoutAccountInput,
  PortalEventInput,
  RevenueRecordInput,
  SealedListingVersionInput,
} from './contracts';

const LISTING_A: ListingSnapshotInput = {
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

const LISTING_B: ListingSnapshotInput = {
  schemaVersion: 1,
  listingId: 'listing:aaa',
  developerTenantId: 'tenant:acme-dev',
  lifecycle: 'draft',
  visibility: 'private',
  displayName: 'IFC Source Bundle',
  publishedVersionCount: 0,
  headVersion: null,
  headDigest: null,
};

const VERSION_1: SealedListingVersionInput = {
  listingId: 'listing:bbb',
  version: '1.0.0',
  developerTenantId: 'tenant:acme-dev',
  displayName: 'Stress Simulation Suite',
  capabilityReferences: [
    { capabilityId: 'stress.ifc-source', version: '2.0.0' },
    { capabilityId: 'stress.sim-fabric', version: '1.0.0' },
  ],
  visibility: 'public',
  publishedAt: '2026-05-01T08:00:02.000Z',
  contentDigest: '1'.repeat(64),
  previousVersionDigest: null,
};

const VERSION_2: SealedListingVersionInput = {
  ...VERSION_1,
  version: '1.1.0',
  contentDigest: '2'.repeat(64),
  previousVersionDigest: '1'.repeat(64),
};

const CAPABILITY_A: CapabilityRecordInput = {
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

const CAPABILITY_B: CapabilityRecordInput = {
  schemaVersion: 1,
  manifest: {
    capabilityId: 'stress.ifc-source',
    category: 'source',
    version: '2.0.0',
    descriptor: { displayName: 'IFC Source' },
  },
  lifecycle: 'deprecated',
  manifestDigest: 'c'.repeat(64),
};

const ADOPTION: EntitlementAdoptionInput = {
  entitlementId: 'entitlement:globex-stress',
  tenantId: 'tenant:globex',
  listingId: 'listing:bbb',
  listingVersionDigest: '2'.repeat(64),
  scope: { kind: 'workspace', workspaceId: 'workspace:globex-eng' },
  seats: 3,
  grantedAt: '2026-05-01T08:00:02.000Z',
  grantedBy: 'principal:portal-ops',
  status: 'active',
};

const REVENUE_A: RevenueRecordInput = {
  revenueId: 'revenue:globex-001',
  developerTenantId: 'tenant:acme-dev',
  acquiringTenantId: 'tenant:globex',
  listingId: 'listing:bbb',
  basis: 'usage',
  amount: '43.75',
  currency: 'EUR',
  recordedAt: '2026-05-01T08:00:03.000Z',
};

const REVENUE_B: RevenueRecordInput = {
  ...REVENUE_A,
  revenueId: 'revenue:globex-002',
  recordedAt: '2026-05-01T08:00:01.000Z',
};

const PAYOUT: PayoutAccountInput = {
  schemaVersion: 1,
  accountId: 'billing-account:acme-payout',
  currency: 'EUR',
  displayName: 'Acme developer payout account',
  openedAt: '2026-05-01T08:00:01.000Z',
  contentDigest: 'd'.repeat(64),
};

const EVENT_1: PortalEventInput = {
  sequence: 1,
  tenantId: 'tenant:acme-dev',
  actor: 'principal:portal-dev',
  payload: { discriminator: 'portal:listing-created', data: { listingId: 'listing:bbb' } },
  occurredAt: '2026-05-01T08:00:00.000Z',
  contentDigest: 'e'.repeat(64),
};

const EVENT_2: PortalEventInput = {
  ...EVENT_1,
  sequence: 2,
  payload: { discriminator: 'portal:version-published', data: {} },
  occurredAt: '2026-05-01T08:00:02.000Z',
};

describe('developer portal feature projections', () => {
  it('projects and sorts the developer listings by listing id', () => {
    const rows = toDeveloperListings([LISTING_A, LISTING_B]);
    expect(rows.map((row) => row.listingId)).toEqual(['listing:aaa', 'listing:bbb']);
    expect(rows[1]!.displayName).toBe('Stress Simulation Suite');
    expect(rows[0]!.headVersion).toBeNull();
    expect(rows[1]!.headVersion).toBe('1.1.0');
  });

  it('projects the version history ascending by semver with chain labels', () => {
    const cards = toListingVersionHistory([VERSION_2, VERSION_1]);
    expect(cards.map((card) => card.version)).toEqual(['1.0.0', '1.1.0']);
    expect(cards[0]!.chainLabel).toBe('first version');
    expect(cards[1]!.chainLabel).toBe('linked to prior version');
    expect(cards[0]!.capabilityCount).toBe(2);
    expect(cards[0]!.contentDigest).toBe('1'.repeat(64));
  });

  it('projects and sorts the capability browse rows', () => {
    const rows = toCapabilityRows([CAPABILITY_A, CAPABILITY_B]);
    expect(rows.map((row) => row.capabilityId)).toEqual([
      'stress.ifc-source',
      'stress.sim-fabric',
    ]);
    expect(rows[0]!.category).toBe('source');
    expect(rows[0]!.lifecycle).toBe('deprecated');
    expect(rows[1]!.displayName).toBe('Sim Fabric');
  });

  it('projects entitlement adoptions with scope and seat labels', () => {
    const rows = toEntitlementAdoptions([ADOPTION]);
    expect(rows[0]!.scopeLabel).toBe('Workspace workspace:globex-eng');
    expect(rows[0]!.seatsLabel).toBe('3 seats');
    expect(rows[0]!.status).toBe('active');
    const tenantWide = toEntitlementAdoptions([
      { ...ADOPTION, scope: { kind: 'tenant' }, seats: undefined },
    ]);
    expect(tenantWide[0]!.scopeLabel).toBe('Tenant-wide');
    expect(tenantWide[0]!.seatsLabel).toBeNull();
  });

  it('projects and sorts the revenue ledger by recorded instant then id', () => {
    const entries = toRevenueLedger([REVENUE_A, REVENUE_B]);
    expect(entries.map((entry) => entry.revenueId)).toEqual([
      'revenue:globex-002',
      'revenue:globex-001',
    ]);
    expect(entries[1]!.amountLabel).toBe('43.75 EUR');
  });

  it('projects the payout account card', () => {
    const card = toPayoutAccount(PAYOUT);
    expect(card.accountId).toBe('billing-account:acme-payout');
    expect(card.currencyLabel).toBe('Settlement currency EUR');
  });

  it('projects the portal event feed in stream order with trimmed labels', () => {
    const rows = toPortalEventFeed([EVENT_2, EVENT_1]);
    expect(rows.map((row) => row.sequence)).toEqual([1, 2]);
    expect(rows[0]!.discriminatorLabel).toBe('listing-created');
    expect(rows[1]!.discriminatorLabel).toBe('version-published');
  });

  it('projects typed errors into display notices', () => {
    const notice = toErrorNotice({ code: 'version-conflict', message: 'boom' });
    expect(notice).toEqual({ code: 'version-conflict', message: 'boom' });
  });
});
