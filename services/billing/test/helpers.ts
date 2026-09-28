// Shared fixtures for the billing-host service tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W023/W036 records are built through the
// REAL upstream pipelines (@epoch/marketplace sealing/validation,
// @epoch/solution-delivery delivery pipeline); the authorization
// contexts are REAL @epoch/authorization shapes (W009).
import { sealUsageEvent } from '@epoch/marketplace';
import type { EntitlementGrantRecord, SealedUsageEvent } from '@epoch/marketplace';
import {
  acceptObservation,
  actualizeObservation,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
} from '@epoch/solution-delivery';
import type { SealedDeliveryRecord } from '@epoch/solution-delivery';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import type { AuthorizationContext } from '@epoch/authorization';
import type { PricingModel } from '@epoch/marketplace';

export const T0 = '2026-04-01T08:00:00.000Z';
export const T1 = '2026-04-01T08:00:01.000Z';
export const T2 = '2026-04-01T08:00:02.000Z';
export const T3 = '2026-04-01T08:00:03.000Z';
export const T4 = '2026-04-01T08:00:04.000Z';
export const T5 = '2026-04-01T08:00:05.000Z';
export const T6 = '2026-04-01T08:00:06.000Z';
export const T7 = '2026-04-01T08:00:07.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const WORKSPACE = 'workspace:globex-eng';
export const OTHER_WORKSPACE = 'workspace:initech-ops';
export const PROJECT = 'project:globex-tower';
export const PRINCIPAL = 'principal:billing-admin';
export const PRINCIPAL_2 = 'principal:field-engineer';
export const PRINCIPAL_3 = 'principal:analyst';
export const OBSERVER = 'principal:field-engineer';
export const LISTING = 'listing:stress-suite';
export const LISTING_2 = 'listing:simulation-fabric';
export const ENTITLEMENT = 'entitlement:globex-stress';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const LISTING_VERSION_DIGEST = 'c'.repeat(64);

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

/** The authorization context granting `principal` full membership in the tenant. */
export function allowContext(
  principalId: string = PRINCIPAL,
  tenantId: string = TENANT,
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
    knownTenants: [TENANT],
  };
}

/** The authorization context with an INACTIVE principal. */
export function inactivePrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'suspended', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}

/** The authorization context with a membership in ANOTHER tenant (R12 deny). */
export function foreignMembershipContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
  };
}

/** The standard authorization input. */
export const AUTH = { principalId: PRINCIPAL, context: allowContext() };

/** One typed authorization input for a (principal, tenant) pair. */
export function authFor(principalId: string, tenantId: string): {
  readonly principalId: string;
  readonly context: AuthorizationContext;
} {
  return { principalId, context: allowContext(principalId, tenantId) };
}

/** One W023 tenant-wide entitlement grant with 2 seats. */
export function grant(overrides: Record<string, unknown> = {}): EntitlementGrantRecord {
  return {
    schemaVersion: 1,
    entitlementId: ENTITLEMENT,
    tenantId: TENANT,
    listingId: LISTING,
    listingVersionDigest: LISTING_VERSION_DIGEST,
    scope: { kind: 'tenant' },
    seats: 2,
    grantedAt: T0,
    grantedBy: PRINCIPAL,
    provenance: { kind: 'direct' },
    ...overrides,
  } as EntitlementGrantRecord;
}

/** One W023 usage-metered pricing model. */
export const USAGE_PRICING: PricingModel = {
  kind: 'usage-metered',
  unitAmount: '0.025',
  currency: 'EUR',
  unitName: 'simulation-run',
  includedUnits: '1000',
};

/** One W023 seat-workspace pricing model. */
export const SEAT_PRICING: PricingModel = {
  kind: 'seat-workspace',
  perSeatAmount: '30',
  currency: 'EUR',
  billingPeriod: 'monthly',
};

/** One W023 subscription pricing model. */
export const SUBSCRIPTION_PRICING: PricingModel = {
  kind: 'subscription',
  recurringAmount: '99.50',
  currency: 'EUR',
  billingPeriod: 'monthly',
};

/** One W023 one-time pricing model. */
export const ONE_TIME_PRICING: PricingModel = {
  kind: 'one-time',
  amount: '2400.00',
  currency: 'EUR',
};

/** Build one sealed W023 usage event through the REAL marketplace sealer. */
export function usageEvent(
  sequence: number,
  overrides: Record<string, unknown> = {},
): SealedUsageEvent {
  return unwrap(
    sealUsageEvent({
      schemaVersion: 1,
      streamId: 'stream:usage-globex-stress',
      sequence,
      tenantId: TENANT,
      actor: PRINCIPAL_2,
      causalParent: sequence > 1 ? { streamId: 'stream:usage-globex-stress', sequence: sequence - 1 } : null,
      payload: {
        discriminator: 'marketplace:usage',
        data: {
          entitlementId: ENTITLEMENT,
          listingId: LISTING,
          listingVersionDigest: LISTING_VERSION_DIGEST,
          units: '1750',
          unitName: 'simulation-run',
          meteredAt: T2,
        },
      },
      occurredAt: T2,
      ...overrides,
    }),
  );
}

// --------------------------------------------------------------------------------
// W036 delivery fixture (REAL pipeline).
// --------------------------------------------------------------------------------

const EVIDENCE_DIGEST = 'e'.repeat(64);

/** The sealed W036 solution version. */
function sealedSolution(): { version: string; digest: string } {
  const sealed = unwrap(
    sealSolutionVersion({
      schema: 'epoch.solution-delivery.solution-version',
      schemaVersion: 1,
      solutionId: SOLUTION_ID,
      version: '1.0.0',
      tenantId: TENANT,
      title: 'Tower retrofit solution',
      solutionLines: [
        {
          lineId: 'line:earthworks',
          title: 'Excavation and grading',
          quantity: { value: '120', unit: 'm3' },
          unitCost: { amount: '18.50', currency: 'EUR' },
          acquisitionVariant: 'external-procurement',
        },
      ],
      worldReferences: [{ entityId: 'site-tower-a' }],
      constraintReferences: [{ constraintId: 'max-height-limit' }],
      previousVersionDigest: null,
      createdAt: T0,
      createdBy: PRINCIPAL,
    }),
  );
  return { version: sealed.version, digest: sealed.contentDigest };
}

/**
 * The sealed W036 delivery record carrying ONE validated quantity actual
 * (118.5 m3), built through the REAL W036 pipeline.
 */
export function deliveredActual(): SealedDeliveryRecord {
  const solution = sealedSolution();
  let delivery = unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: solution.version,
      solutionVersionDigest: solution.digest,
      openedAt: T1,
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    }),
  );
  const observation = unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'observation',
      recordId: 'observation:excavation-done',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: 'activity:excavate' },
      measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T2,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
      recordedAt: T2,
      recordedBy: OBSERVER,
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
        freshness: { state: 'fresh', assessedAt: T1 },
        confidence: { method: 'stated', value: 0.9, rationale: 'direct field measurement' },
      },
    }),
  );
  delivery = unwrap(recordObservation(delivery, observation));
  delivery = unwrap(
    acceptObservation(delivery, 'observation:excavation-done', {
      acceptedBy: PRINCIPAL,
      acceptedAt: T3,
    }),
  );
  delivery = unwrap(
    actualizeObservation(delivery, 'observation:excavation-done', {
      actualId: 'actual:excavation-done',
      actualizedBy: PRINCIPAL,
      actualizedAt: T4,
    }),
  );
  return delivery;
}

/** The W009 reference hierarchy (platform -> tenants -> workspaces -> project). */
export function hierarchy(): TenancyHierarchy {
  const tenancy = new TenancyHierarchy();
  admit(tenancy, 'platform:epoch', 'platform', null);
  admit(tenancy, TENANT, 'tenant', 'platform:epoch');
  admit(tenancy, OTHER_TENANT, 'tenant', 'platform:epoch');
  admit(tenancy, WORKSPACE, 'workspace', TENANT);
  admit(tenancy, OTHER_WORKSPACE, 'workspace', OTHER_TENANT);
  admit(tenancy, PROJECT, 'project', WORKSPACE);
  return tenancy;
}

/** Admit one sealed tenancy node (fixture helper). */
function admit(
  tenancy: TenancyHierarchy,
  nodeId: string,
  kind: 'platform' | 'tenant' | 'workspace' | 'project',
  parentId: string | null,
): void {
  const sealed = sealTenancyNode({
    schemaVersion: 1,
    nodeId,
    kind,
    displayName: nodeId,
    parentId,
  });
  const created = tenancy.createNode(unwrap(sealed));
  if (!created.ok) {
    throw new Error(`tenancy fixture failed: ${JSON.stringify(created.error)}`);
  }
}
