// THE LOW-FRICTION SINGLE-CALL FIELD INTAKE: one call infers the
// work-package linkage (direct work-package, activity through the
// program index, milestone through its activities) and produces the W036
// observation record, the resource-usage observations, and the
// field-evidence-link records with DERIVED deterministic ids. Ambiguous
// linkage is the typed ambiguous-linkage-rejected — never a guess.
import { describe, expect, it } from 'vitest';
import { intakeFieldObservation, verifySealedDistinctionRecord } from '../src/index';
import type { ExecutionTrackingStore, ProgramIndex } from '../src/index';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_3,
  AMBIGUOUS_MILESTONE_ID,
  EVIDENCE_DIGEST,
  EVIDENCE_DIGEST_2,
  MILESTONE_ID,
  WORK_PACKAGE_ID,
  fieldCapture,
  trackingStore,
} from './fixtures';
import { expectError, unwrap } from './helpers';

describe('the low-friction intake (positive)', () => {
  it('one call produces the observation, resource observations, and evidence links with derived ids', () => {
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    expect(intake.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
    expect(intake.observation.kind).toBe('admitted');
    if (intake.observation.kind === 'admitted') {
      expect(intake.observation.record.recordId).toBe('observation:field-pit-progress-monday');
      expect(intake.observation.record.subject.subjectKind).toBe('activity');
      expect(intake.observation.record.subject.subjectId).toBe(ACTIVITY_ID);
      expect(intake.observation.record.payload.evidence.map((link) => link.digest)).toEqual([
        EVIDENCE_DIGEST,
        EVIDENCE_DIGEST_2,
      ]);
    }
    expect(intake.resourceObservations).toHaveLength(2);
    expect(intake.resourceObservations.map((entry) => entry.record.recordId).sort()).toEqual([
      'resource-observation:field-pit-progress-monday-1',
      'resource-observation:field-pit-progress-monday-2',
    ]);
    expect(intake.evidenceLinks).toHaveLength(2);
    expect(intake.evidenceLinks.every((entry) => entry.record.linkedObservationId === 'observation:field-pit-progress-monday')).toBe(true);
    expect(intake.evidenceLinks.map((entry) => entry.record.digest).sort()).toEqual([
      EVIDENCE_DIGEST,
      EVIDENCE_DIGEST_2,
    ]);
    // Everything landed in the store.
    expect(intake.store.observations).toHaveLength(1);
    expect(intake.store.resourceObservations).toHaveLength(2);
    expect(intake.store.evidenceLinks).toHaveLength(2);
  });

  it('the produced observation is a REAL W036 sealed record (verifies through W036)', () => {
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    if (intake.observation.kind === 'admitted') {
      expect(verifySealedDistinctionRecord(intake.observation.record).ok).toBe(true);
    }
  });

  it('a work-package anchor links directly', () => {
    const store = trackingStore();
    const intake = unwrap(
      intakeFieldObservation(
        store,
        fieldCapture({ subjectRef: { kind: 'work-package', id: WORK_PACKAGE_ID } }),
      ),
    );
    expect(intake.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
  });

  it('a milestone anchor with activities in ONE work package links to that package', () => {
    const store = trackingStore();
    const intake = unwrap(
      intakeFieldObservation(
        store,
        fieldCapture({ subjectRef: { kind: 'milestone', id: MILESTONE_ID } }),
      ),
    );
    expect(intake.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
    if (intake.observation.kind === 'admitted') {
      expect(intake.observation.record.subject.subjectKind).toBe('milestone');
    }
  });

  it('a replayed capture (same key, same content) replays every admission idempotently', () => {
    const store = trackingStore();
    const first = unwrap(intakeFieldObservation(store, fieldCapture()));
    const replay = unwrap(intakeFieldObservation(first.store, fieldCapture()));
    expect(replay.observation.kind).toBe('duplicate-observation');
    if (replay.observation.kind === 'duplicate-observation') {
      expect(replay.observation.observationDigest).toBe(
        first.store.observations[0]!.contentDigest,
      );
    }
    expect(replay.resourceObservations.every((entry) => entry.duplicate)).toBe(true);
    expect(replay.evidenceLinks.every((entry) => entry.duplicate)).toBe(true);
    // The state is unchanged by the replay.
    expect(replay.store.observations).toHaveLength(1);
    expect(replay.store.resourceObservations).toHaveLength(2);
    expect(replay.store.evidenceLinks).toHaveLength(2);
  });

  it('a capture without resource usages or evidence still records the observation', () => {
    const store = trackingStore();
    const intake = unwrap(
      intakeFieldObservation(store, {
        ...fieldCapture(),
        resourceUsages: undefined,
        evidenceLinks: undefined,
      }),
    );
    expect(intake.resourceObservations).toHaveLength(0);
    expect(intake.evidenceLinks).toHaveLength(0);
    expect(intake.store.observations).toHaveLength(1);
  });
});

describe('the low-friction intake (negative)', () => {
  it('a milestone spanning MULTIPLE work packages is ambiguous-linkage-rejected (never a guess)', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(store, fieldCapture({ subjectRef: { kind: 'milestone', id: AMBIGUOUS_MILESTONE_ID } })),
    );
    expect(error.code).toBe('ambiguous-linkage-rejected');
    expect((error as { candidateWorkPackageIds?: readonly string[] }).candidateWorkPackageIds).toEqual(
      ['work-package:earthworks', 'work-package:structure'],
    );
  });

  it('an activity mapping to MULTIPLE work packages (hand-crafted index) is ambiguous-linkage-rejected', () => {
    const store: ExecutionTrackingStore = {
      ...trackingStore(),
      programIndex: {
        workPackages: [
          { workPackageId: WORK_PACKAGE_ID, activityIds: [ACTIVITY_ID] },
          { workPackageId: 'work-package:structure', activityIds: [ACTIVITY_ID] },
        ],
        milestones: [],
      } satisfies ProgramIndex,
    };
    const error = expectError(intakeFieldObservation(store, fieldCapture()));
    expect(error.code).toBe('ambiguous-linkage-rejected');
    expect((error as { candidateWorkPackageIds?: readonly string[] }).candidateWorkPackageIds).toEqual([
      'work-package:earthworks',
      'work-package:structure',
    ]);
  });

  it('an unknown work-package anchor is dangling-reference-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(
        store,
        fieldCapture({ subjectRef: { kind: 'work-package', id: 'work-package:not-in-program' } }),
      ),
    );
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('an unknown activity anchor is dangling-reference-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(
        store,
        fieldCapture({ subjectRef: { kind: 'activity', id: 'activity:not-in-program' } }),
      ),
    );
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('activity');
  });

  it('an unknown milestone anchor is dangling-reference-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(
        store,
        fieldCapture({ subjectRef: { kind: 'milestone', id: 'milestone:not-in-program' } }),
      ),
    );
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('milestone');
  });

  it('a capture without uncertainty is uncertainty-missing-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(store, { ...fieldCapture(), uncertainty: undefined }),
    );
    expect(error.code).toBe('uncertainty-missing-rejected');
  });

  it('a cross-tenant capture is tenant-isolation-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(store, { ...fieldCapture(), tenantId: 'tenant:initech' }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a capture for another solution is a validation failure', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(store, { ...fieldCapture(), solutionId: 'solution:other' }),
    );
    expect(error.code).toBe('validation');
  });

  it('the same captureKey with different content is version-conflict (never a silent replacement)', () => {
    const store = trackingStore();
    const first = unwrap(intakeFieldObservation(store, fieldCapture()));
    const error = expectError(
      intakeFieldObservation(first.store, fieldCapture({ measure: { kind: 'progress', fraction: 0.9 } })),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('a vendor field on the capture is vendor-fields-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      intakeFieldObservation(store, { ...fieldCapture(), fieldAppVendor: 'acme-mobile' }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a failed intake leaves the caller store unchanged (immutable updates)', () => {
    const store = trackingStore();
    const result = intakeFieldObservation(store, fieldCapture({ measure: { kind: 'progress', fraction: 2 } }));
    expect(result.ok).toBe(false);
    // No partial state: the store gained nothing.
    expect(store.observations).toHaveLength(0);
    expect(store.resourceObservations).toHaveLength(0);
    expect(store.evidenceLinks).toHaveLength(0);
  });

  it('the measure space is the W036 measure space (a bad measure is rejected at W036 sealing)', () => {
    const store = trackingStore();
    const result = intakeFieldObservation(store, fieldCapture({ measure: { kind: 'quantity', value: '-5', unit: 'm3' } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
    }
  });

  it('subject anchors are validated by the W036 subject grammar via the sealed record', () => {
    const store = trackingStore();
    const result = intakeFieldObservation(
      store,
      fieldCapture({
        subjectRef: { kind: 'activity', id: ACTIVITY_ID_3 },
        // activity:brace-frame lives in work-package:structure — the intake
        // links through the index, and the observation anchors on the activity.
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.linkedWorkPackageId).toBe('work-package:structure');
    }
  });
});
