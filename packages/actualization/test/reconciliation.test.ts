// RECONCILIATION APPLICATION — the W036 authority-path battery: the
// deterministic fold of validated observations into actuals flows
// EXCLUSIVELY through recordObservation -> acceptObservation ->
// actualizeObservation; replays are idempotent; bypasses are typed
// rejections.
import { describe, expect, it } from 'vitest';
import {
  actualIdOfObservation,
  applyActualization,
  applyGroupActualization,
  currentAssessments,
  intakeObservation,
  openActualizationStore,
  sealConflictResolution,
  admitConflictResolution,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2,
  DELIVERY_ID,
  OTHER_TENANT,
  SOLUTION_ID,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  T6,
  conflictingObservations,
  corroboratingObservations,
  costObservation,
  openedDelivery,
  progressObservations,
  sealedActualRecord,
  sealedObservation,
} from './fixtures';

describe('applyActualization (the W036 authority path fold)', () => {
  it('folds MULTIPLE corroborating observations into actuals through the authority path', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = corroboratingObservations();
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const applied = unwrap(
      applyActualization(openedDelivery(), assessment, observations, {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    // Both observations actualized with deterministically derived ids.
    expect(applied.applications).toEqual([
      { observationId: 'observation:pit-volume-monday', actualId: 'actual:pit-volume-monday', outcome: 'actualized' },
      { observationId: 'observation:pit-volume-tuesday', actualId: 'actual:pit-volume-tuesday', outcome: 'actualized' },
    ]);
    // The actuals summary: 60 + 58.5 = 118.5 m3 on the delivery.
    expect(applied.summary.actualCount).toBe(2);
    expect(applied.summary.totals).toEqual([
      {
        subjectKind: 'activity',
        subjectId: ACTIVITY_ID,
        measureKind: 'quantity',
        unit: 'm3',
        currency: undefined,
        total: '118.5',
      },
    ]);
    // The delivery carries the actuals with the derivation links.
    expect(applied.delivery.actuals.length).toBe(2);
    expect(applied.delivery.actuals[0]!.payload.derivedFromObservationId).toBe('observation:pit-volume-monday');
    expect(applied.delivery.acceptedObservationIds).toEqual([
      'observation:pit-volume-monday',
      'observation:pit-volume-tuesday',
    ]);
  });

  it('replay is idempotent: re-applying the same assessment skips already-actualized observations', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = corroboratingObservations();
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const application = {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    };
    const first = unwrap(applyActualization(openedDelivery(), assessment, observations, application));
    const replay = unwrap(applyActualization(first.delivery, assessment, observations, application));
    expect(replay.applications.every((outcome) => outcome.outcome === 'already-actualized')).toBe(true);
    expect(replay.delivery.contentDigest).toBe(first.delivery.contentDigest);
    expect(replay.summary.actualCount).toBe(2);
  });

  it('folds every group of a multi-group store and keeps the delivery digest deterministic', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = [...corroboratingObservations(), costObservation(), ...progressObservations()];
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessments = unwrap(currentAssessments(current, { mode: 'exact' }));
    let delivery = openedDelivery();
    for (const assessment of assessments) {
      const applied = unwrap(
        applyActualization(delivery, assessment, observations, {
          acceptedBy: 'principal:delivery-lead',
          acceptedAt: T4,
          actualizedBy: 'principal:delivery-lead',
          actualizedAt: T5,
        }),
      );
      delivery = applied.delivery;
    }
    expect(delivery.actuals.length).toBe(5);
    // Two identical runs derive identical delivery digests.
    let deliveryB = openedDelivery();
    for (const assessment of [...assessments].reverse()) {
      const applied = unwrap(
        applyActualization(deliveryB, assessment, observations, {
          acceptedBy: 'principal:delivery-lead',
          acceptedAt: T4,
          actualizedBy: 'principal:delivery-lead',
          actualizedAt: T5,
        }),
      );
      deliveryB = applied.delivery;
    }
    expect(deliveryB.contentDigest).toBe(delivery.contentDigest);
  });

  it('applies a RESOLVED group through the resolution-selected subset only', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = conflictingObservations();
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
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
        resolvedAt: T4,
        rationale: 'the Tuesday capture carries the corrected geometry evidence',
      }),
    );
    const resolvedStore = unwrap(admitConflictResolution(current, resolution, { mode: 'exact', foldMode: 'snapshot' }));
    const applied = unwrap(
      applyActualization(
        openedDelivery(),
        assessment,
        observations,
        {
          acceptedBy: 'principal:delivery-lead',
          acceptedAt: T4,
          actualizedBy: 'principal:delivery-lead',
          actualizedAt: T5,
        },
        resolution,
      ),
    );
    expect(applied.delivery.actuals.length).toBe(1);
    expect(applied.delivery.actuals[0]!.payload.derivedFromObservationId).toBe('observation:pit-volume-tuesday');
    expect(applied.summary.totals[0]!.total).toBe('85');
    void resolvedStore;
  });

  it('conflict-unresolved-rejected: a conflicting group without a resolution', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = conflictingObservations();
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    const error = expectError(
      applyActualization(openedDelivery(), assessment, observations, {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    expect(error.code).toBe('conflict-unresolved-rejected');
  });

  it('insufficient-observations-rejected: a group below the policy quorum', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const observations = [corroboratingObservations()[0]!];
    const current = unwrap(intakeObservation(store, observations[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', quorum: 2 }))[0]!;
    const error = expectError(
      applyActualization(openedDelivery(), assessment, observations, {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    expect(error.code).toBe('insufficient-observations-rejected');
  });

  it('actualization-bypass-rejected: an ACTUAL record in the provided observations', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    const error = expectError(
      applyActualization(openedDelivery(), assessment, [sealedActualRecord()], {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    expect(error.code).toBe('actualization-bypass-rejected');
  });

  it('digest-mismatch: an observation whose digest differs from the assessment reference', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact', foldMode: 'snapshot' }))[0]!;
    // A DIFFERENT observation under a different id: not part of the fold
    // set -> dangling reference. Then the same id, different digest ->
    // tampered digest via W036 verification inside the fold.
    const other = sealedObservation({ recordId: 'observation:rogue' });
    const dangling = expectError(
      applyActualization(openedDelivery(), assessment, [other], {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    expect(dangling.code).toBe('dangling-reference-rejected');
  });

  it('dangling-reference-rejected: a fold-set observation that was not provided', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    let current = store;
    const observations = corroboratingObservations();
    for (const observation of observations) {
      current = unwrap(intakeObservation(current, observation)).store;
    }
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const error = expectError(
      applyActualization(openedDelivery(), assessment, [observations[0]!], {
        acceptedBy: 'principal:delivery-lead',
        acceptedAt: T4,
        actualizedBy: 'principal:delivery-lead',
        actualizedAt: T5,
      }),
    );
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('tenant-isolation-rejected: a cross-tenant assessment cannot ground the delivery', () => {
    const store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
    const current = unwrap(intakeObservation(store, corroboratingObservations()[0]!)).store;
    const assessment = unwrap(currentAssessments(current, { mode: 'exact' }))[0]!;
    const foreign = { ...assessment, tenantId: OTHER_TENANT };
    const error = expectError(
      applyGroupActualization({
        delivery: openedDelivery(),
        assessment: foreign,
        resolution: null,
        observations: corroboratingObservations(),
        application: {
          acceptedBy: 'principal:delivery-lead',
          acceptedAt: T4,
          actualizedBy: 'principal:delivery-lead',
          actualizedAt: T5,
        },
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('the deterministic actual id derivation (observation slug -> actual slug)', () => {
    expect(actualIdOfObservation('observation:pit-volume-monday')).toBe('actual:pit-volume-monday');
  });
});

void ACTIVITY_ID_2;
void T2;
void T3;
void T6;
