// Shared fixtures for the @epoch/entitlements kernel tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W003/W009-shaped records are built through
// the REAL upstream pipelines (@epoch/marketplace validators,
// @epoch/solution-delivery sealing); grants are REAL W023 shapes.
import { TenancyHierarchy } from '@epoch/tenancy';
import { sealTenancyNode } from '@epoch/tenancy';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  OneTimePricing,
  SeatWorkspacePricing,
  SubscriptionPricing,
  UsageMeteredPricing,
} from '@epoch/marketplace';
import type { UsageAccount } from '@epoch/marketplace';
import {
  acceptObservation,
  actualizeObservation,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
} from '@epoch/solution-delivery';
import type { SealedDeliveryRecord } from '@epoch/solution-delivery';
import { sealSeatAssignment, sealSeatRelease } from '../src/index';
import type { SealedSeatAssignment, SealedSeatRelease } from '../src/index';

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
export const WORKSPACE_2 = 'workspace:globex-ops';
export const OTHER_WORKSPACE = 'workspace:initech-ops';
export const PROJECT = 'project:globex-tower';
export const PRINCIPAL = 'principal:billing-admin';
export const PRINCIPAL_2 = 'principal:field-engineer';
export const PRINCIPAL_3 = 'principal:analyst';
export const OBSERVER = 'principal:field-engineer';
export const LISTING = 'listing:stress-suite';
export const LISTING_2 = 'listing:simulation-fabric';
export const ENTITLEMENT = 'entitlement:globex-stress';
export const ENTITLEMENT_2 = 'entitlement:globex-sim';
export const ACCOUNT = 'billing-account:globex-eur';
export const INVOICE = 'invoice:globex-2026-04-001';
export const SETTLEMENT = 'settlement:globex-2026-04-001';
export const SETTLEMENT_PORT = 'port:reference-settlement';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const DIGEST_A = 'a'.repeat(64);
export const DIGEST_B = 'b'.repeat(64);
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

/** One W023 tenant-wide entitlement grant (seats optional). */
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

/** One W023 workspace-scoped entitlement grant. */
export function workspaceGrant(overrides: Record<string, unknown> = {}): EntitlementGrantRecord {
  return grant({
    entitlementId: ENTITLEMENT_2,
    listingId: LISTING_2,
    scope: { kind: 'workspace', workspaceId: WORKSPACE },
    seats: undefined,
    ...overrides,
  });
}

/** One W023 revocation record. */
export function revocation(overrides: Record<string, unknown> = {}): EntitlementRevokeRecord {
  return {
    schemaVersion: 1,
    revocationId: 'revocation:globex-stress-1',
    entitlementId: ENTITLEMENT,
    tenantId: TENANT,
    revokedAt: T3,
    revokedBy: PRINCIPAL,
    ...overrides,
  } as EntitlementRevokeRecord;
}

/** The W009 reference hierarchy: platform -> tenant -> workspace -> project. */
export function hierarchy(): TenancyHierarchy {
  const tenancy = new TenancyHierarchy();
  admit(tenancy, 'platform:epoch', 'platform', null);
  admit(tenancy, TENANT, 'tenant', 'platform:epoch');
  admit(tenancy, OTHER_TENANT, 'tenant', 'platform:epoch');
  admit(tenancy, WORKSPACE, 'workspace', TENANT);
  admit(tenancy, WORKSPACE_2, 'workspace', TENANT);
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
  const node = {
    schemaVersion: 1,
    nodeId,
    kind,
    displayName: nodeId,
    parentId,
  };
  const sealed = sealTenancyNode(node);
  if (!sealed.ok) {
    throw new Error(`tenancy fixture failed: ${JSON.stringify(sealed.error)}`);
  }
  const created = tenancy.createNode(sealed.value);
  if (!created.ok) {
    throw new Error(`tenancy fixture failed: ${JSON.stringify(created.error)}`);
  }
}

/** One seat-assignment content as loose JSON. */
export function seatAssignmentContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.entitlements.seat-assignment',
    schemaVersion: 1,
    seatAssignmentId: 'seat:globex-stress-1',
    entitlementId: ENTITLEMENT,
    tenantId: TENANT,
    principalId: PRINCIPAL_2,
    assignedAt: T1,
    assignedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One sealed seat assignment. */
export function sealedSeatAssignment(overrides: Record<string, unknown> = {}): SealedSeatAssignment {
  return unwrap(sealSeatAssignment(seatAssignmentContent(overrides)));
}

/** One seat-release content as loose JSON. */
export function seatReleaseContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.entitlements.seat-release',
    schemaVersion: 1,
    releaseId: 'seat-release:globex-stress-1',
    seatAssignmentId: 'seat:globex-stress-1',
    entitlementId: ENTITLEMENT,
    tenantId: TENANT,
    releasedAt: T4,
    releasedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One sealed seat release. */
export function sealedSeatRelease(overrides: Record<string, unknown> = {}): SealedSeatRelease {
  return unwrap(sealSeatRelease(seatReleaseContent(overrides)));
}

/** One billing-account content as loose JSON. */
export function billingAccountContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.billing.account',
    schemaVersion: 1,
    accountId: ACCOUNT,
    tenantId: TENANT,
    currency: 'EUR',
    displayName: 'Globex EUR billing account',
    openedAt: T0,
    openedBy: PRINCIPAL,
    ...overrides,
  };
}

// --------------------------------------------------------------------------------
// W023 pricing fixtures.
// --------------------------------------------------------------------------------

export const ONE_TIME_PRICING: OneTimePricing = {
  kind: 'one-time',
  amount: '2400.00',
  currency: 'EUR',
};

export const SUBSCRIPTION_PRICING: SubscriptionPricing = {
  kind: 'subscription',
  recurringAmount: '99.50',
  currency: 'EUR',
  billingPeriod: 'monthly',
};

export const SEAT_PRICING: SeatWorkspacePricing = {
  kind: 'seat-workspace',
  perSeatAmount: '30',
  currency: 'EUR',
  billingPeriod: 'monthly',
  minSeats: 1,
  maxSeats: 10,
};

export const USAGE_PRICING: UsageMeteredPricing = {
  kind: 'usage-metered',
  unitAmount: '0.025',
  currency: 'EUR',
  unitName: 'simulation-run',
  includedUnits: '1000',
};

/** One W023 usage account fixture. */
export function usageAccount(overrides: Record<string, unknown> = {}): UsageAccount {
  return {
    schemaVersion: 1,
    entitlementId: ENTITLEMENT,
    tenantId: TENANT,
    listingId: LISTING,
    listingVersionDigest: LISTING_VERSION_DIGEST,
    streamId: 'stream:usage-globex-stress',
    eventCount: 3,
    totalUnits: '3500',
    firstEventAt: T1,
    lastEventAt: T3,
    eventDigests: [DIGEST_A, DIGEST_B, 'd'.repeat(64)].sort(),
    ...overrides,
  } as UsageAccount;
}

// --------------------------------------------------------------------------------
// W036 delivery fixtures (REAL pipeline: solution -> delivery ->
// observation -> acceptance -> actualization).
// --------------------------------------------------------------------------------

const EVIDENCE_DIGEST = 'e'.repeat(64);

/** The sealed W036 solution version. */
function sealedSolution(): { version: string; digest: string } {
  const sealed = sealSolutionVersion({
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
  });
  return {
    version: unwrap(sealed).version,
    digest: unwrap(sealed).contentDigest,
  };
}

function uncertainty(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'direct field measurement' },
  };
}

/** One observation distinction record as loose JSON. */
function observationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:excavation-done',
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: 'activity:excavate',
    },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T2,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST }],
    },
    recordedAt: T2,
    recordedBy: OBSERVER,
    uncertainty: uncertainty(),
    ...overrides,
  };
}

/**
 * The sealed W036 delivery record carrying ONE VALIDATED actual (an
 * accepted observation converted through the REAL W036 pipeline).
 */
export function deliveredActual(overrides: Record<string, unknown> = {}): SealedDeliveryRecord {
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
      ...overrides,
    }),
  );
  delivery = unwrap(recordObservation(delivery, unwrap(sealDistinctionRecord(observationContent()))));
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

/**
 * The sealed W036 delivery record carrying ONE COST-measure validated
 * actual (bills at its recorded amount).
 */
export function deliveredCostActual(): SealedDeliveryRecord {
  const solution = sealedSolution();
  let delivery = unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: 'delivery:tower-retrofit-v2',
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
  delivery = unwrap(
    recordObservation(
      delivery,
      unwrap(
        sealDistinctionRecord(
          observationContent({
            recordId: 'observation:site-cost',
            measure: { kind: 'cost', amount: '12500.75', currency: 'EUR' },
            payload: {
              deliveryId: 'delivery:tower-retrofit-v2',
              observedAt: T2,
              observedBy: OBSERVER,
              evidence: [{ digest: EVIDENCE_DIGEST }],
            },
          }),
        ),
      ),
    ),
  );
  delivery = unwrap(
    acceptObservation(delivery, 'observation:site-cost', {
      acceptedBy: PRINCIPAL,
      acceptedAt: T3,
    }),
  );
  delivery = unwrap(
    actualizeObservation(delivery, 'observation:site-cost', {
      actualId: 'actual:site-cost',
      actualizedBy: PRINCIPAL,
      actualizedAt: T4,
    }),
  );
  return delivery;
}
