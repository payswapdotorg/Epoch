// Shared fixtures for the marketplace kernel tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern). ZERO clock reads: every instant is a fixed
// constant (producer-supplied payload data).
import {
  computeCapabilityManifestDigest,
  CapabilityRegistry,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import {
  computeTrustEvidenceDigest,
  sealListingVersion,
  sealUsageEvent,
  type PaymentCheckRequest,
  type SealedListingVersion,
  type SealedUsageEvent,
  type TrustEvidenceRecord,
} from '../src/index';
import { usageStreamIdOf } from '../src/version';

export const T0 = '2026-02-10T09:00:00.000Z';
export const T1 = '2026-02-10T09:00:01.000Z';
export const T2 = '2026-02-10T09:00:02.000Z';
export const T3 = '2026-02-10T09:00:03.000Z';
export const T4 = '2026-02-10T09:00:04.000Z';
export const T5 = '2026-02-10T09:00:05.000Z';

export const VENDOR = 'tenant:acme-tools';
export const BUYER = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:lead-eng';
export const BUYER_PRINCIPAL = 'principal:site-admin';

const ZERO_DIGEST: string = '0'.repeat(64);

/** One W006-shaped trust-evidence record as loose JSON. */
export function trustEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'computation',
    subject: {
      artifactId: 'engineering.stress-analysis',
      revision: '1.2.3',
      digest: ZERO_DIGEST,
    },
    producedBy: {
      runId: 'run:nightly-2026-02-09',
      actorId: 'principal:verifier-bot',
      methodId: 'method:suite-regression',
    },
    observedAt: T0,
    content: {
      mediaType: 'application/json',
      data: { passed: true, checks: 42 },
    },
    confidence: {
      distribution: { kind: 'point', value: 1 },
      method: 'stated',
      rationale: 'deterministic regression suite',
    },
    ...overrides,
  };
}

/** Trust evidence with a subject digest pinned to a registered manifest. */
export function trustEvidenceFor(digest: string): Record<string, unknown> {
  return trustEvidence({
    subject: {
      artifactId: 'engineering.stress-analysis',
      revision: '1.2.3',
      digest,
    },
  });
}

/** Sort trust-evidence fixtures by content digest (canonical ordering). */
export function sortedTrustEvidence(
  records: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return [...records].sort((a, b) => {
    const da = computeTrustEvidenceDigest(a as unknown as TrustEvidenceRecord);
    const db = computeTrustEvidenceDigest(b as unknown as TrustEvidenceRecord);
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

/** One pricing model per closed-vocabulary kind, as loose JSON. */
export const PRICING_SAMPLES: Record<string, Record<string, unknown>> = {
  free: { kind: 'free' },
  'one-time': { kind: 'one-time', amount: '199.00', currency: 'USD' },
  subscription: { kind: 'subscription', recurringAmount: '49.50', currency: 'EUR', billingPeriod: 'monthly' },
  'seat-workspace': {
    kind: 'seat-workspace',
    perSeatAmount: '12.00',
    currency: 'USD',
    billingPeriod: 'annual',
    minSeats: 1,
    maxSeats: 500,
  },
  'usage-metered': { kind: 'usage-metered', unitAmount: '0.75', currency: 'USD', unitName: 'simulation-run' },
  hybrid: {
    kind: 'hybrid',
    fixed: { kind: 'subscription', recurringAmount: '99.00', currency: 'USD', billingPeriod: 'monthly' },
    metered: { kind: 'usage-metered', unitAmount: '0.10', currency: 'USD', unitName: 'gpu-hour' },
  },
  'enterprise-private': {
    kind: 'enterprise-private',
    contactRoute: 'route:acme-enterprise-desk',
    audienceTenantIds: ['tenant:globex'],
  },
};

/** One capability manifest registration for the W007 registry (loose JSON). */
export function capabilityManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis.',
      inputs: [
        {
          name: 'load-kn',
          kind: 'number',
          required: true,
          description: 'Rated load in kilonewtons.',
          unit: 'kN',
        },
      ],
      outputs: [
        {
          name: 'max-stress-mpa',
          kind: 'number',
          required: true,
          description: 'Peak von Mises stress.',
          unit: 'MPa',
        },
      ],
      assumptions: ['Linear-elastic behavior.'],
    },
    contracts: [],
    trust: { origin: 'first-party' },
    ...overrides,
  };
}

/** A registry containing the fixture capability (real W007 consumption). */
export function registryWithFixtureCapability(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const manifest = capabilityManifest();
  const registration: CapabilityRegistration = {
    manifest: manifest as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(manifest as unknown as CapabilityRegistration['manifest']),
  };
  const registered = registry.register(registration);
  if (!registered.ok) {
    throw new Error(`fixture registration failed: ${JSON.stringify(registered.error)}`);
  }
  return registry;
}

/** The manifest digest of the fixture capability. */
export function fixtureCapabilityDigest(): string {
  const manifest = capabilityManifest() as unknown as CapabilityRegistration['manifest'];
  return computeCapabilityManifestDigest(manifest);
}

/**
 * A valid listing version content as loose JSON. `version` defaults to
 * `1.0.0`; `previousVersionDigest` defaults to null (first publication).
 */
export function listingContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.marketplace.listing-version',
    schemaVersion: 1,
    listingId: 'listing:stress-suite',
    version: '1.0.0',
    developerTenantId: VENDOR,
    displayName: 'Stress Analysis Suite',
    description: 'Simulation capability bundle with regression evidence.',
    capabilityReferences: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
    pricing: PRICING_SAMPLES['one-time']!,
    trustEvidence: [trustEvidenceFor(fixtureCapabilityDigest())],
    visibility: 'public',
    privateAllowList: [],
    previousVersionDigest: null,
    publishedAt: T1,
    ...overrides,
  };
}

/** Seal a (possibly corrupted) listing version content; throws on invalid. */
export function sealedListing(content: Record<string, unknown>): SealedListingVersion {
  const sealed = sealListingVersion(content);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** A second published version linking to the first (hash chain). */
export function chainedSecondVersion(previousDigest: string): Record<string, unknown> {
  return listingContent({
    version: '1.1.0',
    pricing: PRICING_SAMPLES['usage-metered']!,
    previousVersionDigest: previousDigest,
    publishedAt: T2,
  });
}

/** One entitlement grant record as loose JSON. */
export function entitlementGrant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    entitlementId: 'entitlement:grant-001',
    tenantId: BUYER,
    listingId: 'listing:stress-suite',
    listingVersionDigest: ZERO_DIGEST,
    scope: { kind: 'tenant' },
    grantedAt: T2,
    grantedBy: PRINCIPAL,
    provenance: { kind: 'direct' },
    ...overrides,
  };
}

/** One entitlement revocation record as loose JSON. */
export function entitlementRevoke(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    revocationId: 'revocation:revoke-001',
    entitlementId: 'entitlement:grant-001',
    tenantId: BUYER,
    revokedAt: T3,
    revokedBy: PRINCIPAL,
    reason: 'subscription cancelled',
    ...overrides,
  };
}

/** One usage event content as loose JSON (W010 shape). */
export function usageEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:usage-grant-001',
    sequence: 1,
    tenantId: BUYER,
    actor: BUYER_PRINCIPAL,
    causalParent: null,
    payload: {
      discriminator: 'marketplace:usage',
      data: {
        entitlementId: 'entitlement:grant-001',
        listingId: 'listing:stress-suite',
        listingVersionDigest: ZERO_DIGEST,
        units: '2.5',
        unitName: 'simulation-run',
        meteredAt: T3,
      },
    },
    occurredAt: T3,
    ...overrides,
  };
}

/** Seal a (possibly corrupted) usage event; throws on invalid. */
export function sealedUsage(event: Record<string, unknown>): SealedUsageEvent {
  const sealed = sealUsageEvent(event);
  if (!sealed.ok) {
    throw new Error(`fixture must seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** The usage stream of the fixture entitlement. */
export const FIXTURE_USAGE_STREAM = usageStreamIdOf('entitlement:grant-001');

/** One developer revenue record as loose JSON. */
export function revenueRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    revenueId: 'revenue:rev-001',
    developerTenantId: VENDOR,
    acquiringTenantId: BUYER,
    listingId: 'listing:stress-suite',
    listingVersionDigest: ZERO_DIGEST,
    entitlementId: 'entitlement:grant-001',
    basis: 'usage',
    amount: '1.875',
    currency: 'USD',
    recordedAt: T4,
    recordedBy: PRINCIPAL,
    provenance: { kind: 'usage-event', usageEventDigest: ZERO_DIGEST },
    ...overrides,
  };
}

/** A payment check request as loose JSON. */
export function paymentCheckRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    listingId: 'listing:stress-suite',
    listingVersionDigest: ZERO_DIGEST,
    tenantId: BUYER,
    pricing: PRICING_SAMPLES['one-time']!,
    ...overrides,
  };
}

/** A TYPED payment check request (for the port API surface). */
export function typedPaymentCheckRequest(): PaymentCheckRequest {
  return {
    listingId: 'listing:stress-suite',
    listingVersionDigest: ZERO_DIGEST,
    tenantId: BUYER,
    pricing: { kind: 'one-time', amount: '199.00', currency: 'USD' },
  };
}

export const FIXTURE_INSTANTS = { T0, T1, T2, T3, T4, T5 } as const;
export const ZERO = ZERO_DIGEST;
