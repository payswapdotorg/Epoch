// Shared fixtures for the developer-portal service tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. Capability registrations are built through
// the REAL W007 pipeline (@epoch/capability-registry sealing); the
// authorization contexts are REAL @epoch/authorization shapes (W009);
// the billing account is built through the REAL W024 sealer
// (@epoch/entitlements); marketplace records are REAL W023 shapes.
import { CapabilityRegistry } from '@epoch/capability-registry';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import type { CapabilityRecord } from '@epoch/capability-registry';
import { sealBillingAccount } from '@epoch/entitlements';
import type { SealedBillingAccount } from '@epoch/entitlements';
import type { AuthorizationContext } from '@epoch/authorization';
import type { ListingDraftInput } from '../src/index';
import type { EntitlementGrantRecord, PricingModel, RevenueRecord, TrustEvidenceRecord } from '@epoch/marketplace';

export const T0 = '2026-05-01T08:00:00.000Z';
export const T1 = '2026-05-01T08:00:01.000Z';
export const T2 = '2026-05-01T08:00:02.000Z';
export const T3 = '2026-05-01T08:00:03.000Z';
export const T4 = '2026-05-01T08:00:04.000Z';
export const T5 = '2026-05-01T08:00:05.000Z';
export const T6 = '2026-05-01T08:00:06.000Z';
export const T7 = '2026-05-01T08:00:07.000Z';

export const DEVELOPER = 'tenant:acme-dev';
export const OTHER_DEVELOPER = 'tenant:hooli-dev';
export const ACQUIRER = 'tenant:globex';
export const OTHER_ACQUIRER = 'tenant:initech';
export const PRINCIPAL = 'principal:portal-dev';
export const PRINCIPAL_2 = 'principal:portal-ops';
export const WORKSPACE = 'workspace:globex-eng';
export const CAPABILITY = 'stress.sim-fabric';
export const CAPABILITY_2 = 'stress.ifc-source';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}

// --------------------------------------------------------------------------------
// W009 authorization fixtures.
// --------------------------------------------------------------------------------

/** The authorization context granting `principal` full membership in the tenant. */
export function allowContext(
  principalId: string = PRINCIPAL,
  tenantId: string = DEVELOPER,
): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [tenantId],
  };
}

/** The authorization context with an UNKNOWN principal (fail-closed deny). */
export function unknownPrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [DEVELOPER],
  };
}

/** The authorization context with an INACTIVE principal. */
export function inactivePrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'suspended', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: DEVELOPER }],
    knownTenants: [DEVELOPER],
  };
}

/** The authorization context with a membership in ANOTHER tenant (R12 deny). */
export function foreignMembershipContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_DEVELOPER }],
    knownTenants: [DEVELOPER, OTHER_DEVELOPER],
  };
}

/** The standard authorization input. */
export const AUTH = { principalId: PRINCIPAL, context: allowContext() };

// --------------------------------------------------------------------------------
// W007 registry fixtures (REAL pipeline).
// --------------------------------------------------------------------------------

function parameterSpec(name: string) {
  return {
    name,
    kind: 'number',
    required: true,
    description: `${name} of the stress model`,
    unit: 'ms',
  };
}

/** One sealed capability manifest (REAL W007 pipeline). */
export function registeredCapability(
  capabilityId: string,
  version: string,
  overrides: Record<string, unknown> = {},
): CapabilityRecord {
  const manifest = {
    schemaVersion: 1,
    capabilityId,
    category: 'simulation',
    version,
    descriptor: {
      displayName: `${capabilityId} v${version}`,
      description: 'Deterministic stress-model capability for the portal fixtures.',
      inputs: [parameterSpec('load')],
      outputs: [parameterSpec('max-displacement')],
      assumptions: ['Linear elastic range only.'],
    },
    contracts: [{ contractId: 'epoch.simulation-request', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party' },
    ...overrides,
  };
  const sealed = unwrap(sealCapabilityManifest(manifest));
  return {
    schemaVersion: 1,
    manifest: sealed.manifest,
    lifecycle: 'registered',
    manifestDigest: sealed.digest,
  };
}

/** A REAL W007 registry holding the fixture capabilities. */
export function fixtureRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const [capabilityId, version] of [
    [CAPABILITY, '1.0.0'],
    [CAPABILITY, '1.1.0'],
    [CAPABILITY_2, '2.0.0'],
  ] as const) {
    const record = registeredCapability(capabilityId, version);
    unwrap(registry.register({ manifest: record.manifest, digest: record.manifestDigest }));
  }
  return registry;
}

// --------------------------------------------------------------------------------
// W023 marketplace fixtures (REAL shapes).
// --------------------------------------------------------------------------------

/** One W023 usage-metered pricing model. */
export const USAGE_PRICING: PricingModel = {
  kind: 'usage-metered',
  unitAmount: '0.025',
  currency: 'EUR',
  unitName: 'simulation-run',
  includedUnits: '1000',
};

/** One W023 one-time pricing model. */
export const ONE_TIME_PRICING: PricingModel = {
  kind: 'one-time',
  amount: '2400.00',
  currency: 'EUR',
};

/** One W023 free pricing model. */
export const FREE_PRICING: PricingModel = { kind: 'free' };

/** One W006-shaped trust-evidence record (REAL shape). */
export function trustEvidence(overrides: Record<string, unknown> = {}): TrustEvidenceRecord {
  return {
    schemaVersion: 1,
    kind: 'computation',
    subject: { artifactId: CAPABILITY, revision: '1.0.0', digest: 'a'.repeat(64) },
    producedBy: { runId: 'run:stress-validation-1', actorId: 'principal:portal-ops' },
    observedAt: T0,
    content: { mediaType: 'application/json', data: { verdict: 'validated' } },
    confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
    ...overrides,
  } as TrustEvidenceRecord;
}

/** The draft fields of one listing (REAL shape). */
export function draft(overrides: Record<string, unknown> = {}): ListingDraftInput {
  return {
    displayName: 'Stress Simulation Suite',
    description: 'Deterministic stress-model capability bundle.',
    capabilityReferences: [
      { capabilityId: CAPABILITY_2, version: '2.0.0' },
      { capabilityId: CAPABILITY, version: '1.0.0' },
    ],
    pricing: USAGE_PRICING,
    trustEvidence: [trustEvidence()],
    visibility: 'public',
    ...overrides,
  } as ListingDraftInput;
}

/** One W023 tenant-wide entitlement grant with 2 seats. */
export function grant(overrides: Record<string, unknown> = {}): EntitlementGrantRecord {
  return {
    schemaVersion: 1,
    entitlementId: 'entitlement:globex-stress',
    tenantId: ACQUIRER,
    listingId: 'listing:fixture', // callers patch the real derived id
    listingVersionDigest: 'c'.repeat(64),
    scope: { kind: 'tenant' },
    seats: 2,
    grantedAt: T2,
    grantedBy: PRINCIPAL_2,
    provenance: { kind: 'direct' },
    ...overrides,
  } as EntitlementGrantRecord;
}

/** One W023 developer revenue record. */
export function revenue(overrides: Record<string, unknown> = {}): RevenueRecord {
  return {
    schemaVersion: 1,
    revenueId: 'revenue:globex-001',
    developerTenantId: DEVELOPER,
    acquiringTenantId: ACQUIRER,
    listingId: 'listing:fixture', // callers patch the real derived id
    listingVersionDigest: 'c'.repeat(64),
    basis: 'usage',
    amount: '43.75',
    currency: 'EUR',
    recordedAt: T3,
    recordedBy: PRINCIPAL_2,
    provenance: { kind: 'manual-entry', reference: 'ledger:may-week-1' },
    ...overrides,
  } as RevenueRecord;
}

// --------------------------------------------------------------------------------
// W024 billing-account fixture (REAL pipeline).
// --------------------------------------------------------------------------------

/** The developer's sealed W024 billing account (REAL sealer). */
export function billingAccount(overrides: Record<string, unknown> = {}): SealedBillingAccount {
  return unwrap(
    sealBillingAccount({
      schema: 'epoch.billing.account',
      schemaVersion: 1,
      accountId: 'billing-account:acme-payout',
      tenantId: DEVELOPER,
      currency: 'EUR',
      displayName: 'Acme developer payout account',
      openedAt: T1,
      openedBy: PRINCIPAL,
      ...overrides,
    }),
  );
}
