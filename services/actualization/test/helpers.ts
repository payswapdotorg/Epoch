// Shared fixtures for the actualization-runtime service tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely. ZERO clock reads. W036 records are built through the REAL
// @epoch/solution-delivery pipelines; the authorization contexts are
// REAL @epoch/authorization shapes (W009).
import { openDeliveryRecord, sealDistinctionRecord } from '@epoch/solution-delivery';
import type {
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';
import { sealComparisonFact } from '@epoch/actualization';
import type { SealedComparisonFact } from '@epoch/actualization';

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

export const T0 = '2026-04-06T08:00:00.000Z';
export const T1 = '2026-04-06T08:00:01.000Z';
export const T2 = '2026-04-06T08:00:02.000Z';
export const T3 = '2026-04-06T08:00:03.000Z';
export const T4 = '2026-04-06T08:00:04.000Z';
export const T5 = '2026-04-06T08:00:05.000Z';
export const T6 = '2026-04-06T08:00:06.000Z';
export const T7 = '2026-04-06T08:00:07.000Z';
export const T8 = '2026-04-06T08:00:08.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const ACTIVITY_ID = 'activity:excavate';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

/** One valid uncertainty state. */
export function uncertainty(overrides: Record<string, unknown> = {}): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

/** The opened W036 delivery record (with optional overrides). */
export function openedDelivery(overrides: Record<string, unknown> = {}): SealedDeliveryRecord {
  return unwrap(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      solutionVersion: '1.0.0',
      solutionVersionDigest: 'c'.repeat(64),
      openedAt: T0,
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
      ...overrides,
    }),
  );
}

/** One W036 observation record content as loose JSON. */
export function observationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: 'observation:pit-volume-monday',
    tenantId: TENANT,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    measure: { kind: 'quantity', value: '60', unit: 'm3' },
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

/** The sealed W036 observation record. */
export function sealedObservation(overrides: Record<string, unknown> = {}): SealedDistinctionRecord {
  return unwrap(sealDistinctionRecord(observationContent(overrides)));
}

/** One W036 ACTUAL record (sealed) — the bypass-attempt fixture. */
export function sealedActualRecord(): SealedDistinctionRecord {
  return unwrap(
    sealDistinctionRecord({
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: 1,
      kind: 'actual',
      recordId: 'actual:pit-volume-monday',
      tenantId: TENANT,
      subject: {
        solutionId: SOLUTION_ID,
        subjectKind: 'activity',
        subjectId: ACTIVITY_ID,
      },
      measure: { kind: 'quantity', value: '60', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        derivedFromObservationId: 'observation:pit-volume-monday',
        actualizedAt: T5,
        actualizedBy: PRINCIPAL,
      },
      recordedAt: T5,
      recordedBy: PRINCIPAL,
      uncertainty: uncertainty(),
    }),
  );
}

/** A corroborating Tuesday observation (the accumulating increment). */
export function tuesdayObservation(): SealedDistinctionRecord {
  return sealedObservation({
    recordId: 'observation:pit-volume-tuesday',
    measure: { kind: 'quantity', value: '58.5', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST_2 }],
    },
  });
}

/** A conflicting Tuesday observation (the repeat-measurement conflict). */
export function conflictingTuesdayObservation(): SealedDistinctionRecord {
  return sealedObservation({
    recordId: 'observation:pit-volume-tuesday',
    measure: { kind: 'quantity', value: '85', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST_2 }],
    },
  });
}

/** One comparison-fact content builder (loose JSON). */
export function comparisonFactContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.actualization.comparison-fact',
    schemaVersion: 1,
    factId: 'comparison-fact:pit-volume-f1-a1',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    comparisonRef: { recordId: 'comparison:pit-volume-f1-a1', contentDigest: 'd'.repeat(64) },
    forecastRef: { recordId: 'forecast:pit-volume-r1', contentDigest: 'e'.repeat(64) },
    actualRef: { recordId: 'actual:pit-volume-monday', contentDigest: 'f'.repeat(64) },
    forecastMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
    actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    deviation: '11.5',
    bias: 'over-forecast',
    observedAt: T6,
    ...overrides,
  };
}

/** The sealed comparison fact. */
export function sealedComparisonFact(
  overrides: Record<string, unknown> = {},
): SealedComparisonFact {
  return unwrap(sealComparisonFact(comparisonFactContent(overrides)));
}

// --------------------------------------------------------------------------------
// The W009 authorization contexts (REAL @epoch/authorization shapes).
// --------------------------------------------------------------------------------

/** The authorization context that allows the operation principal. */
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
