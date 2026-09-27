// TYPED VALIDATION STATES — the positive battery: multiple observations
// folding into validated actuals under every state (the W039 acceptance
// core), including conflicting observations resolved by the typed
// validation states.
import { describe, expect, it } from 'vitest';
import {
  admitComparisonFact,
  admitConflictResolution,
  currentAssessments,
  effectiveValidationStates,
  intakeObservation,
  openActualizationStore,
  sealComparisonFact,
  sealConflictResolution,
  sealValidationAssessment,
  verifySealedValidationAssessment,
  type ActualizationStore,
} from '../src/index';
import { unwrap } from './helpers';
import {
  ACTIVITY_ID_2,
  DELIVERY_ID,
  SOLUTION_ID,
  TENANT,
  T5,
  comparisonFactContent,
  conflictingObservations,
  corroboratingObservations,
  costObservation,
  progressObservations,
} from './fixtures';

describe('the deterministic validation fold (multiple observations -> validated actuals)', () => {
  it('folds MULTIPLE corroborating observations into one validated actual group (the W039 acceptance)', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of corroboratingObservations()) {
      const intake = unwrap(intakeObservation(current, observation));
      expect(intake.admission.kind).toBe('recorded');
      current = intake.store;
    }
    const assessments = unwrap(currentAssessments(current, { mode: 'exact' }));
    expect(assessments.length).toBe(1);
    const assessment = assessments[0]!;
    // The accumulating fold: 60 + 58.5 = 118.5 m3 (exact decimal sum).
    expect(assessment.state).toBe('corroborated');
    expect(assessment.measureKind).toBe('quantity');
    expect(assessment.unit).toBe('m3');
    expect(assessment.observationRefs.length).toBe(2);
    expect(assessment.foldedMeasure).toEqual({ kind: 'quantity', value: '118.5', unit: 'm3' });
    expect(assessment.deviationMagnitude).toBe('0');
    expect(assessment.policy.foldMode ?? 'accumulate').toBe('accumulate');
  });

  it('folds distinct (subject, measure) groups independently and deterministically', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of [
      ...corroboratingObservations(),
      costObservation(),
      ...progressObservations(),
    ]) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessments = unwrap(currentAssessments(current, { mode: 'exact' }));
    expect(assessments.length).toBe(3);
    // Sorted by assessmentId, deterministic.
    const kinds = assessments.map((assessment) => assessment.measureKind);
    expect([...kinds].sort()).toEqual(['cost', 'progress', 'quantity']);
    // The progress group folds the LATEST observation (0.6, not the sum);
    // progression across instants never conflicts (deviation '0').
    const progress = assessments.find((assessment) => assessment.measureKind === 'progress')!;
    expect(progress.foldedMeasure).toEqual({ kind: 'progress', fraction: 0.6 });
    expect(progress.deviationMagnitude).toBe('0');
    expect(progress.subject.subjectId).toBe(ACTIVITY_ID_2);
    // The cost group folds its single observation.
    const cost = assessments.find((assessment) => assessment.measureKind === 'cost')!;
    expect(cost.foldedMeasure).toEqual({ kind: 'cost', amount: '1107.75', currency: 'EUR' });
  });

  it('marks a CONFLICTING group under the exact snapshot policy and resolves it through a typed conflict resolution', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of conflictingObservations()) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const conflicting = unwrap(
      currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }),
    )[0]!;
    expect(conflicting.state).toBe('conflicting');
    expect(conflicting.deviationMagnitude).toBe('25');

    // The typed resolution selects the authoritative subset (the later,
    // better-evidenced capture) and excludes the other.
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:pit-volume-tuesday-wins',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: {
          assessmentId: conflicting.assessmentId,
          contentDigest: conflicting.contentDigest,
        },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-tuesday',
            contentDigest: conflicting.observationRefs.find(
              (ref) => ref.recordId === 'observation:pit-volume-tuesday',
            )!.contentDigest,
          },
        ],
        excludedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: conflicting.observationRefs.find(
              (ref) => ref.recordId === 'observation:pit-volume-monday',
            )!.contentDigest,
          },
        ],
        resolvedBy: 'principal:delivery-lead',
        resolvedAt: T5,
        rationale: 'the Tuesday capture carries the corrected geometry evidence',
      }),
    );
    const resolved = unwrap(admitConflictResolution(current, resolution, { mode: 'exact', foldMode: 'snapshot' }));
    const states = unwrap(effectiveValidationStates(resolved, { mode: 'exact', foldMode: 'snapshot' }));
    expect(states[0]![1]).toBe('resolved');
    // The resolved group's fold is now the SELECTED subset only.
    expect(states[0]![0].foldedMeasure).toEqual({ kind: 'quantity', value: '85', unit: 'm3' });
  });

  it('marks an INSUFFICIENT group below the policy quorum', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const [monday] = corroboratingObservations();
    const current = unwrap(intakeObservation(store, monday!)).store;
    const assessments = unwrap(currentAssessments(current, { mode: 'exact', quorum: 2 }));
    expect(assessments[0]!.state).toBe('insufficient');
    // A single observation still folds (the validated-actual candidate).
    expect(assessments[0]!.foldedMeasure).toEqual({ kind: 'quantity', value: '60', unit: 'm3' });
  });

  it('corroborates within a tolerance policy and conflicts beyond it', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    for (const observation of conflictingObservations()) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const withinTolerance = unwrap(
      currentAssessments(current, { mode: 'tolerance', tolerance: '30', foldMode: 'snapshot' }),
    );
    expect(withinTolerance[0]!.state).toBe('corroborated');
    expect(withinTolerance[0]!.deviationMagnitude).toBe('25');
    const beyondTolerance = unwrap(
      currentAssessments(current, { mode: 'tolerance', tolerance: '10', foldMode: 'snapshot' }),
    );
    expect(beyondTolerance[0]!.state).toBe('conflicting');
  });

  it('identical store states derive identical assessment ids and digests (replay idempotence)', () => {
    const build = (): ActualizationStore => {
      let current = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
      for (const observation of [...corroboratingObservations(), costObservation()]) {
        current = unwrap(intakeObservation(current, observation)).store;
      }
      return current;
    };
    const first = unwrap(currentAssessments(build(), { mode: 'exact' }));
    const second = unwrap(currentAssessments(build(), { mode: 'exact' }));
    expect(first.map((a) => [a.assessmentId, a.contentDigest])).toEqual(
      second.map((a) => [a.assessmentId, a.contentDigest]),
    );
  });

  it('intake order never leaks: shuffled intake derives identical assessments', () => {
    const forward = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const backward = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const observations = [...corroboratingObservations(), costObservation(), ...progressObservations()];
    let a = forward;
    for (const observation of observations) {
      a = unwrap(intakeObservation(a, observation)).store;
    }
    let b = backward;
    for (const observation of [...observations].reverse()) {
      b = unwrap(intakeObservation(b, observation)).store;
    }
    const assessmentsA = unwrap(currentAssessments(a, { mode: 'exact' }));
    const assessmentsB = unwrap(currentAssessments(b, { mode: 'exact' }));
    expect(assessmentsA.map((x) => x.contentDigest)).toEqual(assessmentsB.map((x) => x.contentDigest));
  });
});

describe('sealed assessment round-trip + digest verification', () => {
  it('a sealed assessment round-trips through JSON and verifies', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const roundTrip = verifySealedValidationAssessment(JSON.parse(JSON.stringify(assessment)));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.ok && roundTrip.value.contentDigest).toBe(assessment.contentDigest);
  });

  it('a tampered assessment digest is a typed digest-mismatch', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const tampered = { ...assessment, deviationMagnitude: '999' };
    const verified = verifySealedValidationAssessment(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('a malformed assessment content is a typed validation rejection', () => {
    const bad = sealValidationAssessment({ schema: 'nope' });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error.code).toBe('validation');
  });
});

describe('comparison-fact admission (immutable history)', () => {
  it('admits a valid comparison fact and folds it into calibration history', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const fact = unwrap(sealComparisonFact(comparisonFactContent()));
    const admitted = unwrap(admitComparisonFact(store, fact));
    expect(admitted.comparisonFacts.length).toBe(1);
    // Exact re-admission is idempotent.
    const again = unwrap(admitComparisonFact(admitted, fact));
    expect(again.comparisonFacts.length).toBe(1);
  });

  it('an honest-history check rejects a fact whose deviation does not match its measures (at the calibration fold)', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const fact = unwrap(sealComparisonFact(comparisonFactContent({ deviation: '99' })));
    // Admission succeeds (the fact is sealed history); the CALIBRATION
    // fold is where the honest-history check fires (calibration.test.ts
    // pins the typed rejection).
    const admitted = admitComparisonFact(store, fact);
    expect(admitted.ok).toBe(true);
  });
});
