// Shared fixtures for the actualization kernel tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely (the W036/W038 helpers pattern). ZERO clock reads: every
// instant is a fixed constant (producer-supplied payload data). W036
// records are built through the REAL @epoch/solution-delivery pipelines.
import {
  openDeliveryRecord,
  sealDistinctionRecord,
  openDeliveryRecord as openDelivery,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  type UncertaintyState,
} from '@epoch/solution-delivery';
import { unwrap } from './helpers';

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
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const DELIVERY_ID = 'delivery:tower-retrofit-v1';
export const ACTIVITY_ID = 'activity:excavate';
export const ACTIVITY_ID_2 = 'activity:grade';
export const WORK_PACKAGE_ID = 'work-package:earthworks';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

/** One valid uncertainty state (observed provenance, fresh, measured confidence). */
export function uncertainty(overrides: Record<string, unknown> = {}): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

/** An empty (just-opened) W036 delivery record state. */
export function openedDelivery(): SealedDeliveryRecord {
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
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST }],
    },
    recordedAt: T3,
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
      measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
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

/** A family of corroborating quantity observations for one group (partial deliveries). */
export function corroboratingObservations(): SealedDistinctionRecord[] {
  return [
    sealedObservation({
      recordId: 'observation:pit-volume-monday',
      measure: { kind: 'quantity', value: '60', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T2,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
    }),
    sealedObservation({
      recordId: 'observation:pit-volume-tuesday',
      measure: { kind: 'quantity', value: '58.5', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T3,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST_2 }],
      },
    }),
  ];
}

/** A conflicting observation pair for one group (beyond a small tolerance). */
export function conflictingObservations(): SealedDistinctionRecord[] {
  return [
    sealedObservation({
      recordId: 'observation:pit-volume-monday',
      measure: { kind: 'quantity', value: '60', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T2,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
    }),
    sealedObservation({
      recordId: 'observation:pit-volume-tuesday',
      measure: { kind: 'quantity', value: '85', unit: 'm3' },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T3,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST_2 }],
      },
    }),
  ];
}

/** A second-group observation (cost of the same activity). */
export function costObservation(): SealedDistinctionRecord {
  return sealedObservation({
    recordId: 'observation:pit-cost-monday',
    subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
    measure: { kind: 'cost', amount: '1107.75', currency: 'EUR' },
    payload: {
      deliveryId: DELIVERY_ID,
      observedAt: T3,
      observedBy: OBSERVER,
      evidence: [{ digest: EVIDENCE_DIGEST }],
    },
  });
}

/** A progress observation of a second group (latest-wins fold). */
export function progressObservations(): SealedDistinctionRecord[] {
  return [
    sealedObservation({
      recordId: 'observation:pit-progress-monday',
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID_2 },
      measure: { kind: 'progress', fraction: 0.25 },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T2,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST }],
      },
    }),
    sealedObservation({
      recordId: 'observation:pit-progress-tuesday',
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID_2 },
      measure: { kind: 'progress', fraction: 0.6 },
      payload: {
        deliveryId: DELIVERY_ID,
        observedAt: T4,
        observedBy: OBSERVER,
        evidence: [{ digest: EVIDENCE_DIGEST_2 }],
      },
    }),
  ];
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

/** One lineage-edge content builder (loose JSON). */
export function lineageEdgeContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.actualization.lineage-edge',
    schemaVersion: 1,
    edgeId: 'lineage:pit-prediction-baseline',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    realizationVariant: 'construction-build',
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    from: { kind: 'prediction', recordId: 'prediction:pit-volume', contentDigest: '1'.repeat(64) },
    to: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: '2'.repeat(64) },
    recordedAt: T1,
    recordedBy: PRINCIPAL,
    note: 'the approved baseline grounds the pit-volume prediction',
    ...overrides,
  };
}

void openDelivery;
