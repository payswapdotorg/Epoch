// Shared fixtures for the procurement-runtime service tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W036 records are built through the REAL
// @epoch/solution-delivery pipelines; the authorization contexts are
// REAL @epoch/authorization shapes (W009).
import { admitAcquisitionRequest, sealDistinctionRecord } from '@epoch/solution-delivery';
import type {
  AcquisitionRequestRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';
import { InMemorySupplierAdapter } from '../src/index';
import type { ReferenceSupplierSeed } from '../src/index';

export const T0 = '2026-05-01T09:00:00.000Z';
export const T1 = '2026-05-01T09:00:01.000Z';
export const T2 = '2026-05-01T09:00:02.000Z';
export const T3 = '2026-05-01T09:00:03.000Z';
export const T4 = '2026-05-01T09:00:04.000Z';
export const T5 = '2026-05-01T09:00:05.000Z';
export const T6 = '2026-05-01T09:00:06.000Z';
export const T7 = '2026-05-01T09:00:07.000Z';
export const T8 = '2026-05-01T09:00:08.000Z';
export const T9 = '2026-05-01T09:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:procurement-lead';
export const BUYER = 'principal:site-buyer';
export const ENGINEER = 'principal:field-engineer';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const ACQUISITION_ID = 'acquisition:earthworks-materials';
export const PACKAGE_ID = 'package:earthworks-steel-a';
export const QUOTE_ID = 'quote:steel-supplier-a';
export const QUOTE_ID_B = 'quote:steel-supplier-b';
export const SELECTION_ID = 'selection:earthworks-first';
export const PO_ID = 'po:earthworks-001';
export const SUPPLIER_A = 'supplier:steel-works-alpha';
export const SUPPLIER_B = 'supplier:metal-craft-beta';
export const COMMITMENT_ID = 'commitment:earthworks-order-1';
export const OBSERVATION_ID = 'observation:delivery-receipt-1';
export const OBSERVATION_ID_2 = 'observation:delivery-receipt-2';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** One valid uncertainty state. */
export function uncertainty(
  overrides: Record<string, unknown> = {},
): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'reported', sourceRef: 'source:supplier-statement', actor: ENGINEER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'supplier statement' },
    ...overrides,
  } as UncertaintyState;
}

/** The REAL W036 admitted acquisition request. */
export function acquisitionRequest(
  overrides: Record<string, unknown> = {},
): AcquisitionRequestRecord {
  return unwrap(
    admitAcquisitionRequest({
      schema: 'epoch.solution-delivery.acquisition-request',
      schemaVersion: 1,
      acquisitionId: ACQUISITION_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      detail: {
        variant: 'external-procurement',
        lines: [
          { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
          { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
        ],
      },
      requestedAt: T1,
      requestedBy: PRINCIPAL,
      neededBy: T5,
      ...overrides,
    }),
  );
}

/** One W036 receipt observation record (sealed). */
export function receiptObservation(
  recordId: string = OBSERVATION_ID,
  quantity = '40',
): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'observation',
      recordId,
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: 'activity:excavate' },
      measure: { kind: 'quantity', value: quantity, unit: 'piece' },
      payload: {
        deliveryId: 'delivery:tower-retrofit-v1',
        observedAt: T6,
        observedBy: ENGINEER,
        evidence: [{ digest: 'a'.repeat(64) }],
      },
      recordedAt: T6,
      recordedBy: ENGINEER,
      uncertainty: uncertainty({
        provenance: { kind: 'observed', sourceRef: 'source:goods-receipt', actor: ENGINEER },
        confidence: { method: 'measured', value: 0.99, rationale: 'counted at the gate' },
      }),
    } as never),
  );
}

/** One W036 lead-time estimate record (for the quote lead-times). */
export function leadTimeEstimate(): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'estimate',
      recordId: 'estimate:lead-time-alpha',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
      measure: { kind: 'quantity', value: '14', unit: 'day' },
      payload: { method: 'source:supplier-statement', range: { low: '10', high: '18' } },
      recordedAt: T1,
      recordedBy: PRINCIPAL,
      uncertainty: uncertainty(),
    } as never),
  );
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

/** The authorization context with a membership in ANOTHER tenant (R12 deny). */
export function foreignMembershipContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
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

/** The supplier-port seeds: two provider-neutral quote submissions. */
export function supplierSeeds(): readonly ReferenceSupplierSeed[] {
  const estimate = leadTimeEstimate();
  return [
    {
      quoteId: QUOTE_ID,
      supplierId: SUPPLIER_A,
      lines: [
        {
          description: 'Anchor bolts M24',
          quantity: '80',
          unit: 'piece',
          unitCost: { amount: '6.10', currency: 'EUR' },
          allocation: { state: 'reserved', quantity: '80', allocatedAt: T3 },
        },
        {
          description: 'Structural steel HEB 200',
          quantity: '4',
          unit: 'tonne',
          unitCost: { amount: '2350.00', currency: 'EUR' },
        },
      ],
      leadTimes: [
        {
          semantics: 'estimate',
          recordId: estimate.recordId,
          contentDigest: estimate.contentDigest,
          uncertainty: uncertainty(),
        },
      ],
      validUntil: T8,
      submittedAt: T3,
      submittedBy: PRINCIPAL,
    },
    {
      quoteId: QUOTE_ID_B,
      supplierId: SUPPLIER_B,
      lines: [
        {
          description: 'Anchor bolts M24',
          quantity: '80',
          unit: 'piece',
          unitCost: { amount: '5.90', currency: 'EUR' },
        },
        {
          description: 'Structural steel HEB 200',
          quantity: '4',
          unit: 'tonne',
          unitCost: { amount: '2410.00', currency: 'EUR' },
        },
      ],
      leadTimes: [],
      validUntil: T8,
      submittedAt: T3,
      submittedBy: PRINCIPAL,
    },
  ];
}

/** The in-memory reference adapter over the default seeds. */
export function seededAdapter(): InMemorySupplierAdapter {
  return new InMemorySupplierAdapter(supplierSeeds());
}
