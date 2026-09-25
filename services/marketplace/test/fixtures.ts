// Shared fixtures for the marketplace-host tests. ZERO clock reads: every
// instant is a fixed constant (producer-supplied payload data). Builders
// return typed shapes; negative tests corrupt inputs precisely.
import {
  computeCapabilityManifestDigest,
  CapabilityRegistry,
  type CapabilityRegistration,
} from '@epoch/capability-registry';
import {
  MarketplaceHost,
  type ListingDraftInput,
  type PublishListingVersionInput,
  type PublicationReceipt,
  type EntitlementGrantReceipt,
  type CreateListingInput,
  type GrantEntitlementInput,
} from '../src/index';
import type { TrustEvidenceRecord } from '@epoch/marketplace';

export const T0 = '2026-02-10T09:00:00.000Z';
export const T1 = '2026-02-10T09:00:01.000Z';
export const T2 = '2026-02-10T09:00:02.000Z';
export const T3 = '2026-02-10T09:00:03.000Z';
export const T4 = '2026-02-10T09:00:04.000Z';
export const T5 = '2026-02-10T09:00:05.000Z';
export const T6 = '2026-02-10T09:00:06.000Z';

export const VENDOR = 'tenant:acme-tools';
export const BUYER = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:lead-eng';
export const BUYER_PRINCIPAL = 'principal:site-admin';

const ZERO_DIGEST = '0'.repeat(64);

/** The fixture capability manifest (loose JSON). */
export function capabilityManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis.',
      inputs: [
        { name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kilonewtons.', unit: 'kN' },
      ],
      outputs: [
        { name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.', unit: 'MPa' },
      ],
      assumptions: ['Linear-elastic behavior.'],
    },
    contracts: [],
    trust: { origin: 'first-party' },
  };
}

/** A registry with the fixture capability registered (real W007). */
export function registryWithFixtureCapability(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const manifest = capabilityManifest() as unknown as CapabilityRegistration['manifest'];
  const registered = registry.register({
    manifest,
    digest: computeCapabilityManifestDigest(manifest),
  });
  if (!registered.ok) {
    throw new Error(`fixture registration failed: ${JSON.stringify(registered.error)}`);
  }
  return registry;
}

/** The fixture manifest digest (trust-evidence subject). */
export function fixtureCapabilityDigest(): string {
  const manifest = capabilityManifest() as unknown as CapabilityRegistration['manifest'];
  return computeCapabilityManifestDigest(manifest);
}

/** One W006-shaped trust-evidence record (typed fixture). */
export function trustEvidenceFixture(): TrustEvidenceRecord {
  return {
    schemaVersion: 1,
    kind: 'computation',
    subject: {
      artifactId: 'engineering.stress-analysis',
      revision: '1.2.3',
      digest: fixtureCapabilityDigest(),
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
  };
}

/** A valid public listing draft. */
export function publicDraft(overrides: Partial<ListingDraftInput> = {}): ListingDraftInput {
  return {
    displayName: 'Stress Analysis Suite',
    description: 'Simulation capability bundle with regression evidence.',
    capabilityReferences: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
    pricing: { kind: 'one-time', amount: '199.00', currency: 'USD' },
    trustEvidence: [trustEvidenceFixture()],
    visibility: 'public',
    privateAllowList: [],
    ...overrides,
  };
}

/** A host with the fixture registry (and optionally one published listing). */
export function hostWithRegistry(): MarketplaceHost {
  return MarketplaceHost.create({ registry: registryWithFixtureCapability() });
}

/** Create + submit + publish one listing version; throws on failure. */
export function publishedListing(
  host: MarketplaceHost,
  options: {
    idempotencyKey?: string;
    version?: string;
    publishedAt?: string;
    draft?: ListingDraftInput;
    asTenant?: string;
  } = {},
): { listingId: string; receipt: PublicationReceipt } {
  const asTenant = options.asTenant ?? VENDOR;
  const createInput: CreateListingInput = {
    asTenant,
    idempotencyKey: options.idempotencyKey ?? 'list-stress-suite',
    draft: options.draft ?? publicDraft(),
  };
  const created = host.createListing(createInput);
  if (!created.ok) {
    throw new Error(`fixture create failed: ${JSON.stringify(created.error)}`);
  }
  const submitted = host.submitListing({ asTenant, listingId: created.value.listingId });
  if (!submitted.ok) {
    throw new Error(`fixture submit failed: ${JSON.stringify(submitted.error)}`);
  }
  const publishInput: PublishListingVersionInput = {
    asTenant,
    listingId: created.value.listingId,
    version: options.version ?? '1.0.0',
    publishedAt: options.publishedAt ?? T1,
  };
  const published = host.publishListingVersion(publishInput);
  if (!published.ok) {
    throw new Error(`fixture publish failed: ${JSON.stringify(published.error)}`);
  }
  return { listingId: created.value.listingId, receipt: published.value };
}

/** Grant one entitlement; throws on failure. */
export function grantedEntitlement(
  host: MarketplaceHost,
  listingId: string,
  options: Partial<GrantEntitlementInput> = {},
): EntitlementGrantReceipt {
  const input: GrantEntitlementInput = {
    asTenant: BUYER,
    idempotencyKey: options.idempotencyKey ?? 'grant-globex-001',
    listingId,
    scope: { kind: 'tenant' },
    grantedAt: options.grantedAt ?? T2,
    grantedBy: options.grantedBy ?? PRINCIPAL,
    ...options,
  };
  const granted = host.grantEntitlement(input);
  if (!granted.ok) {
    throw new Error(`fixture grant failed: ${JSON.stringify(granted.error)}`);
  }
  return granted.value;
}

export const ZERO = ZERO_DIGEST;
export const FIXTURE_INSTANTS = { T0, T1, T2, T3, T4, T5, T6 } as const;
