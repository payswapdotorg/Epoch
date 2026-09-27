// TYPED VALIDATION STATES — the negative battery: bypass attempts,
// malformed observations, tampered digests, tenant isolation, replay
// conflicts, stale resolutions.
import { describe, expect, it } from 'vitest';
import {
  admitConflictResolution,
  intakeObservation,
  openActualizationStore,
  sealConflictResolution,
  currentAssessments,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2,
  DELIVERY_ID,
  OTHER_TENANT,
  SOLUTION_ID,
  TENANT,
  T5,
  comparisonFactContent,
  conflictingObservations,
  corroboratingObservations,
  observationContent,
  sealedActualRecord,
  sealedObservation,
  uncertainty,
} from './fixtures';
import { admitComparisonFact, sealComparisonFact } from '../src/index';

describe('the actualization-bypass guard (actuals flow through the W036 authority path only)', () => {
  it('actualization-bypass-rejected: an ACTUAL record cannot enter the observation intake', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const error = expectError(intakeObservation(store, sealedActualRecord()));
    expect(error.code).toBe('actualization-bypass-rejected');
  });

  it('actualization-bypass-rejected: a non-distinction payload claiming a non-observation kind is pre-classified', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const bogus = { kind: 'actual', recordId: 'actual:rogue', contentDigest: '0'.repeat(64) };
    const error = expectError(intakeObservation(store, bogus));
    expect(error.code).toBe('actualization-bypass-rejected');
  });
});

describe('malformed and tampered observation intake', () => {
  it('a malformed observation payload is a typed validation rejection', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const error = expectError(intakeObservation(store, { schema: 'nope' }));
    expect(error.code).toBe('validation');
  });

  it('a tampered observation digest is a typed validation rejection (W036 verification)', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const observation = sealedObservation();
    const tampered = { ...observation, measure: { kind: 'quantity', value: '1', unit: 'm3' } };
    const error = expectError(intakeObservation(store, tampered));
    expect(error.code).toBe('validation');
  });

  it('a vendor field on the observation is a typed vendor-fields rejection', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const vendor = observationContent({ procoreJobId: 'job-123' });
    const error = expectError(intakeObservation(store, vendor));
    expect(error.code).toBe('validation');
  });
});

describe('tenant isolation (R12)', () => {
  it('tenant-isolation-rejected: a cross-tenant observation cannot enter the store', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const foreign = sealedObservation({
        tenantId: OTHER_TENANT,
        payload: { deliveryId: DELIVERY_ID, observedAt: '2026-04-06T08:00:03.000Z', observedBy: 'principal:field-engineer', evidence: [] },
        uncertainty: uncertainty(),
      });
    const error = expectError(intakeObservation(store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('tenant-isolation-rejected: a cross-tenant comparison fact cannot enter the store', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const foreign = unwrap(sealComparisonFact(comparisonFactContent({ tenantId: OTHER_TENANT })));
    const error = expectError(admitComparisonFact(store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});

describe('replay conflicts (same key, different payload)', () => {
  it('version-conflict: the same observation id with different content', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, sealedObservation())).store;
    const different = sealedObservation({ measure: { kind: 'quantity', value: '200', unit: 'm3' } });
    const error = expectError(intakeObservation(current, different));
    expect(error.code).toBe('version-conflict');
  });

  it('the exact duplicate observation is the idempotent duplicate-observation admission', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, sealedObservation())).store;
    const replay = unwrap(intakeObservation(current, sealedObservation()));
    expect(replay.admission.kind).toBe('duplicate-observation');
    expect(replay.store.observations.length).toBe(1);
  });

  it('version-conflict: the same resolution id with different content', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of conflictingObservations()) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    const build = (rationale: string) =>
      unwrap(
        sealConflictResolution({
          schema: 'epoch.actualization.conflict-resolution',
          schemaVersion: 1,
          resolutionId: 'resolution:pit-volume-tuesday-wins',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          deliveryId: DELIVERY_ID,
          assessmentRef: { assessmentId: assessment.assessmentId, contentDigest: assessment.contentDigest },
          selectedObservationRefs: [
            {
              recordId: 'observation:pit-volume-tuesday',
              contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-tuesday')!
                .contentDigest,
            },
          ],
          excludedObservationRefs: [
            {
              recordId: 'observation:pit-volume-monday',
              contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-monday')!
                .contentDigest,
            },
          ],
          resolvedBy: 'principal:delivery-lead',
          resolvedAt: T5,
          rationale,
        }),
      );
    const first = unwrap(admitConflictResolution(current, build('first'), { mode: 'exact', foldMode: 'snapshot' }));
    const error = expectError(admitConflictResolution(first, build('second'), { mode: 'exact', foldMode: 'snapshot' }));
    expect(error.code).toBe('version-conflict');
  });
});

describe('resolution binding discipline', () => {
  it('dangling-reference-rejected: a resolution binding a stale assessment revision', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of conflictingObservations()) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    // New evidence arrives: the assessment revision changes.
    const lateArrival = sealedObservation({
        recordId: 'observation:pit-volume-wednesday',
        measure: { kind: 'quantity', value: '61', unit: 'm3' },
        payload: { deliveryId: DELIVERY_ID, observedAt: '2026-04-06T08:00:04.000Z', observedBy: 'principal:field-engineer', evidence: [] },
        uncertainty: uncertainty(),
      });
    const evolved = unwrap(intakeObservation(current, lateArrival)).store;
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:pit-volume-tuesday-wins',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: { assessmentId: assessment.assessmentId, contentDigest: assessment.contentDigest },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-tuesday',
            contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-tuesday')!
              .contentDigest,
          },
        ],
        excludedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-monday')!
              .contentDigest,
          },
        ],
        resolvedBy: 'principal:delivery-lead',
        resolvedAt: T5,
      }),
    );
    const error = expectError(admitConflictResolution(evolved, resolution, { mode: 'exact', foldMode: 'snapshot' }));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('validation: a resolution binding a CORROBORATED assessment is rejected', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:rogue',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: { assessmentId: assessment.assessmentId, contentDigest: assessment.contentDigest },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: assessment.observationRefs[0]!.contentDigest,
          },
        ],
        excludedObservationRefs: [],
        resolvedBy: 'principal:delivery-lead',
        resolvedAt: T5,
      }),
    );
    const error = expectError(admitConflictResolution(current, resolution, { mode: 'exact', foldMode: 'snapshot' }));
    expect(error.code).toBe('validation');
  });

  it('validation: a resolution that does not partition the observation set exactly', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of conflictingObservations()) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:partial-partition',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: { assessmentId: assessment.assessmentId, contentDigest: assessment.contentDigest },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-monday')!
              .contentDigest,
          },
        ],
        // Tuesday is neither selected nor excluded.
        excludedObservationRefs: [],
        resolvedBy: 'principal:delivery-lead',
        resolvedAt: T5,
      }),
    );
    const error = expectError(admitConflictResolution(current, resolution, { mode: 'exact', foldMode: 'snapshot' }));
    expect(error.code).toBe('validation');
  });
});

describe('history immutability of comparison facts', () => {
  it('history-immutable: the same fact id with different content', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const first = unwrap(sealComparisonFact(comparisonFactContent()));
    const admitted = unwrap(admitComparisonFact(store, first));
    const mutated = unwrap(
      sealComparisonFact(comparisonFactContent({ deviation: '1', bias: 'exact' })),
    );
    const error = expectError(admitComparisonFact(admitted, mutated));
    expect(error.code).toBe('history-immutable');
  });

  it('history-immutable: a different fact for the SAME (forecast, actual) pair', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const first = unwrap(sealComparisonFact(comparisonFactContent()));
    const admitted = unwrap(admitComparisonFact(store, first));
    const different = unwrap(
      sealComparisonFact(
        comparisonFactContent({
          factId: 'comparison-fact:pit-volume-f1-a1-replacement',
          deviation: '1',
          bias: 'exact',
        }),
      ),
    );
    const error = expectError(admitComparisonFact(admitted, different));
    expect(error.code).toBe('history-immutable');
  });
});

void ACTIVITY_ID;
void ACTIVITY_ID_2;
