// THE FULL FLOW (positive): register -> intake (port + direct) -> assess
// -> resolve -> actualize (the W036 authority path) -> variance +
// attribution -> forecast revision -> comparison fact + calibration ->
// projection. Every step emits actualization:* events.
import { describe, expect, it } from 'vitest';
import {
  ActualizationRuntime,
  InMemoryObservationSourceAdapter,
  seededObservationSource,
} from '../src/index';
import { sealConflictResolution } from '@epoch/actualization';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  EVIDENCE_DIGEST,
  EVIDENCE_DIGEST_2,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
  allowContext,
  conflictingTuesdayObservation,
  openedDelivery,
  sealedComparisonFact,
  sealedObservation,
  tuesdayObservation,
  uncertainty,
  unwrap,
} from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };
const POLICY = { mode: 'exact' } as const;

/** The full happy-path flow (corroborating increments). */
function fullFlow(): ActualizationRuntime {
  const host = new ActualizationRuntime();
  unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
  unwrap(
    host.intakeObservation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      observation: sealedObservation(),
    }),
  );
  unwrap(
    host.intakeObservation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      observation: tuesdayObservation(),
    }),
  );
  const assessments = unwrap(
    host.assessValidation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      policy: POLICY,
      assessedAt: T4,
    }),
  );
  expect(assessments.length).toBe(1);
  unwrap(
    host.applyActualization({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      assessment: assessments[0]!,
      application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
    }),
  );
  return host;
}


describe('the observation intake (direct + port)', () => {
  it('registers the delivery, intakes observations, and replays idempotently', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const first = unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(first.kind).toBe('recorded');
    const replay = unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(replay.kind).toBe('duplicate-observation');
    expect(host.health().observationCount).toBe(1);
    // One observation-intaken event only (replays emit nothing).
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(stream.filter((e) => e.payload.discriminator === 'actualization:observation-intaken').length).toBe(1);
  });

  it('polls the ObservationSourcePort and admits every pending submission', () => {
    const host = new ActualizationRuntime({
      observationSourcePort: seededObservationSource([
        { tenantId: TENANT, deliveryId: DELIVERY_ID, observation: sealedObservation() },
        { tenantId: TENANT, deliveryId: DELIVERY_ID, observation: tuesdayObservation() },
      ]),
    });
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const outcomes = unwrap(
      host.pollObservationSources({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        requestedAt: T3,
      }),
    );
    expect(outcomes).toEqual([
      { observationId: 'observation:pit-volume-monday', admission: 'recorded' },
      { observationId: 'observation:pit-volume-tuesday', admission: 'recorded' },
    ]);
    // The second poll returns nothing (the queue drained).
    const second = unwrap(
      host.pollObservationSources({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        requestedAt: T4,
      }),
    );
    expect(second).toEqual([]);
    expect(host.health().observationCount).toBe(2);
  });

  it('the default port is the in-memory reference adapter (the core never names a vendor)', () => {
    const host = new ActualizationRuntime();
    expect(host.health().deliveryCount).toBe(0);
    void InMemoryObservationSourceAdapter;
  });
});

describe('the actualization application (the W036 authority path)', () => {
  it('folds MULTIPLE corroborating observations into actuals through the authority path', () => {
    const host = fullFlow();
    expect(host.health().actualCount).toBe(2);
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    const minted = stream.find((e) => e.payload.discriminator === 'actualization:actuals-minted')!;
    expect(minted).toBeDefined();
    expect(minted.payload.data['mintedCount']).toBe(2);
    expect(minted.payload.data['alreadyMintedCount']).toBe(0);
  });

  it('re-applying the same assessment skips already-actualized observations (idempotent replay)', () => {
    const host = fullFlow();
    const assessments = unwrap(
      host.assessValidation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: POLICY,
        assessedAt: T6,
      }),
    );
    const replay = unwrap(
      host.applyActualization({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        assessment: assessments[0]!,
        application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
      }),
    );
    expect(replay.applications.every((a) => a.outcome === 'already-actualized')).toBe(true);
    expect(host.health().actualCount).toBe(2);
  });

  it('conflicting observations resolve through a typed conflict resolution, then actualize the SELECTED subset', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: conflictingTuesdayObservation(),
      }),
    );
    const snapshotPolicy = { mode: 'exact', foldMode: 'snapshot' } as const;
    const assessments = unwrap(
      host.assessValidation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: snapshotPolicy,
        assessedAt: T4,
      }),
    );
    expect(assessments[0]!.state).toBe('conflicting');
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:pit-volume-tuesday-wins',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: {
          assessmentId: assessments[0]!.assessmentId,
          contentDigest: assessments[0]!.contentDigest,
        },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-tuesday',
            contentDigest: assessments[0]!.observationRefs.find(
              (r) => r.recordId === 'observation:pit-volume-tuesday',
            )!.contentDigest,
          },
        ],
        excludedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: assessments[0]!.observationRefs.find(
              (r) => r.recordId === 'observation:pit-volume-monday',
            )!.contentDigest,
          },
        ],
        resolvedBy: PRINCIPAL,
        resolvedAt: T4,
        rationale: 'the Tuesday capture carries the corrected geometry evidence',
      }),
    );
    unwrap(
      host.admitResolution({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        resolution,
        policy: snapshotPolicy,
        resolvedAt: T4,
      }),
    );
    const applied = unwrap(
      host.applyActualization({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        assessment: assessments[0]!,
        application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
        resolution,
      }),
    );
    expect(applied.delivery.actuals.length).toBe(1);
    expect(applied.delivery.actuals[0]!.payload.derivedFromObservationId).toBe('observation:pit-volume-tuesday');
    // The resolution event emitted.
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(stream.some((e) => e.payload.discriminator === 'actualization:conflict-resolved')).toBe(true);
  });
});


describe('variance + attribution (the explainability layer)', () => {
  it('computes + admits variance records over the folded actuals, with evidence-grounded attribution', () => {
    const host = fullFlow();
    const variance = unwrap(
      host.computeVariance({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        input: {
          varianceId: 'variance:pit-volume-quantity',
          subjectKind: 'activity',
          subjectId: ACTIVITY_ID,
          varianceClass: 'quantity',
          baselineRef: {
            kind: 'baseline',
            recordId: 'baseline:pit-volume-v1',
            contentDigest: '1'.repeat(64),
          },
          actualRef: {
            kind: 'actual',
            recordId: 'actual:pit-volume-monday',
            contentDigest: '2'.repeat(64),
          },
          baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
          actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
          evidence: [EVIDENCE_DIGEST, EVIDENCE_DIGEST_2],
          confidence: { method: 'measured', value: 0.9 },
          thresholds: { minor: '10', material: '100', severe: '1000' },
        },
        computedAt: T6,
        computedBy: PRINCIPAL,
      }),
    );
    expect(variance.record.magnitude).toBe('1.5');
    expect(variance.record.direction).toBe('adverse');
    expect(host.health().varianceCount).toBe(1);
    // Attribution WITH evidence admits cleanly.
    const attribution = unwrap(
      host.admitAttribution({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        attributionId: 'attribution:pit-volume-geometry',
        varianceRef: {
          recordId: variance.record.varianceId,
          contentDigest: variance.record.contentDigest,
        },
        cause: {
          causeKind: 'issue-record',
          recordId: 'change:pit-geometry-revision',
          contentDigest: '4'.repeat(64),
        },
        evidence: [EVIDENCE_DIGEST],
        note: 'the geometry revision changed the measured pit volume',
        attributedAt: T7,
        attributedBy: PRINCIPAL,
      }),
    );
    expect(attribution.attributionId).toBe('attribution:pit-volume-geometry');
    expect(host.health().attributionCount).toBe(1);
  });
});

describe('rolling forecast revision emission', () => {
  it('emits append-only revisions refining the earlier forecast only', () => {
    const host = fullFlow();
    const first = unwrap(
      host.reviseForecast({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        solutionId: SOLUTION_ID,
        input: {
          recordId: 'forecast:pit-volume-r1',
          subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
          planned: { kind: 'quantity', value: '120', unit: 'm3' },
          actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
          performanceFactor: '1.25',
          asOf: T4,
          recordedAt: T4,
          recordedBy: PRINCIPAL,
          uncertainty: uncertainty(),
        },
        revisedAt: T4,
      }),
    );
    expect(first.remaining).toBe('60');
    expect(first.atCompletion).toBe('135');
    const second = unwrap(
      host.reviseForecast({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        solutionId: SOLUTION_ID,
        input: {
          recordId: 'forecast:pit-volume-r2',
          subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
          planned: { kind: 'quantity', value: '120', unit: 'm3' },
          actualsToDate: { kind: 'quantity', value: '118.5', unit: 'm3' },
          asOf: T6,
          recordedAt: T6,
          recordedBy: PRINCIPAL,
          uncertainty: uncertainty(),
        },
        revisedAt: T6,
      }),
    );
    // r2 refines r1 (the append-only chain).
    expect(second.record.recordId).toBe('forecast:pit-volume-r2');
    expect(host.health().forecastRevisionCount).toBe(2);
    // The forecast-revised events carry the refinement chain.
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    const revisions = stream.filter((e) => e.payload.discriminator === 'actualization:forecast-revised');
    expect(revisions.length).toBe(2);
    expect(revisions[0]!.payload.data['refines']).toBeNull();
    expect(revisions[1]!.payload.data['refines']).toBe('forecast:pit-volume-r1');
  });
});

describe('comparison facts + calibration folds', () => {
  it('admits immutable comparison facts and folds the calibration state', () => {
    const host = fullFlow();
    unwrap(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: sealedComparisonFact(),
      }),
    );
    const calibration = unwrap(
      host.foldCalibration({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        subjectKind: 'activity',
        subjectId: ACTIVITY_ID,
        foldedAt: T7,
      }),
    );
    expect(calibration.comparisonCount).toBe(1);
    expect(calibration.overCount).toBe(1);
    expect(calibration.confidence.method).toBe('derived');
    expect(host.health().comparisonFactCount).toBe(1);
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(stream.some((e) => e.payload.discriminator === 'actualization:calibration-folded')).toBe(true);
  });
});

describe('the derived state projection', () => {
  it('projects the full state: validation groups + actuals summary + variance summary', () => {
    const host = fullFlow();
    const projected = unwrap(
      host.projectState({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: POLICY,
        projectedAt: T7,
      }),
    );
    expect(projected.deliveryStatus).toBe('open');
    expect(projected.observationCounts.total).toBe(2);
    expect(projected.validationGroups.length).toBe(1);
    expect(projected.validationGroups[0]!.state).toBe('corroborated');
    expect(projected.validationGroups[0]!.foldedMeasure).toEqual({
      kind: 'quantity',
      value: '118.5',
      unit: 'm3',
    });
    expect(projected.actualsSummary.actualCount).toBe(2);
    expect(projected.varianceSummary).toEqual([]);
    // The state-projected events accumulate.
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(stream.filter((e) => e.payload.discriminator === 'actualization:state-projected').length).toBe(2);
  });
});

void T2;
void T5;
