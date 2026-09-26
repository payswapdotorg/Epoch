// THE ACCEPTANCE FIXTURE (W038, verbatim): "Fixtures prove partial
// observations can be recorded without destructive overwrites and can be
// reconciled into delivery state without bypassing authority or
// verification boundaries."
//
// Scenario: two PARTIAL progress observations record into the W036
// DeliveryRecord through the low-friction intake (still PROPOSED — the
// accepted set is empty, nothing is overwritten, nothing is actual); a
// typed reconciliation proposal is recorded; applying it flows ONLY
// through the REAL W036 recordObservation -> acceptObservation ->
// actualizeObservation path (the authority); the actuals inherit the
// observations' measures and uncertainties and derive from ACCEPTED
// observations only; re-application is idempotent; rejected observations
// never actualize; ACTUAL records never enter the observation path.
import { describe, expect, it } from 'vitest';
import {
  admitReconciliationProposal,
  applyReconciliationProposal,
  intakeFieldObservation,
  rejectObservation,
  sealReconciliationProposal,
  verifySealedDeliveryRecord,
  recordObservation,
} from '../src/index';
import {
  DELIVERY_ID,
  PRINCIPAL,
  SOLUTION_ID,
  T5,
  T6,
  TENANT,
  fieldCapture,
  openedDelivery,
  sealedActualRecord,
  sealedObservation,
  sealedSolution,
  trackingStore,
} from './fixtures';

import { expectError, unwrap } from './helpers';

// (The fixture is built inline in the tests below — a helper per step.)

describe('the acceptance fixture: partial observations -> reconciliation (verbatim)', () => {
  it('partial observations record WITHOUT destructive overwrites, then reconcile WITHOUT bypassing authority or verification boundaries', () => {
    const solution = sealedSolution();
    let delivery = openedDelivery(solution);
    const store = trackingStore();

    // --- Step 1: two PARTIAL observations record through the low-friction intake.
    const first = unwrap(intakeFieldObservation(store, fieldCapture()));
    const second = unwrap(
      intakeFieldObservation(
        first.store,
        fieldCapture({
          captureKey: 'pit-progress-tuesday',
          measure: { kind: 'progress', fraction: 0.35 },
        }),
      ),
    );

    // The observations are recorded into the DELIVERY (append-only), still
    // PROPOSED: the accepted set and the actuals stay empty.
    for (const observation of second.store.observations) {
      delivery = unwrap(recordObservation(delivery, observation));
    }
    expect(delivery.observations).toHaveLength(2);
    expect(delivery.acceptedObservationIds).toHaveLength(0);
    expect(delivery.rejectedObservationIds).toHaveLength(0);
    expect(delivery.actuals).toHaveLength(0);
    const firstSnapshot = JSON.stringify(delivery.observations);

    // Recording them AGAIN (replay) changes nothing destructively: the
    // immutable append-only observations array is byte-identical.
    const reRecorded = recordObservation(delivery, delivery.observations[0]!);
    expect(reRecorded.ok).toBe(false); // W036: append-only, already recorded
    if (!reRecorded.ok) {
      expect(reRecorded.error.code).toBe('version-conflict');
    }
    expect(JSON.stringify(delivery.observations)).toBe(firstSnapshot);

    // --- Step 2: the typed, recorded reconciliation proposal.
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:pit-progress-w1',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [
          { observationId: 'observation:field-pit-progress-monday', proposedActualId: 'actual:pit-progress-w1-monday' },
          { observationId: 'observation:field-pit-progress-tuesday', proposedActualId: 'actual:pit-progress-w1-tuesday' },
        ],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
        rationale: 'both captures verified against the survey evidence',
      }),
    );
    const admitted = unwrap(admitReconciliationProposal(second.store, proposal));
    expect(admitted.store.proposals).toHaveLength(1);

    // --- Step 3: apply through the W036 authority path ONLY.
    const applied = unwrap(
      applyReconciliationProposal(
        delivery,
        proposal,
        [second.store.observations[0]!, second.store.observations[1]!],
        {
          acceptedBy: PRINCIPAL,
          acceptedAt: T5,
          actualizedBy: PRINCIPAL,
          actualizedAt: T6,
        },
      ),
    );
    expect(applied.delivery.actuals).toHaveLength(2);
    expect(applied.delivery.acceptedObservationIds).toEqual([
      'observation:field-pit-progress-monday',
      'observation:field-pit-progress-tuesday',
    ]);
    for (const application of applied.applications) {
      expect(application.outcome).toBe('actualized');
    }

    // WITHOUT bypassing authority: every actual DERIVES from an observation
    // in the ACCEPTED set (the W036 invariant, recomputed here as evidence).
    for (const actual of applied.delivery.actuals) {
      expect(applied.delivery.acceptedObservationIds).toContain(actual.payload.derivedFromObservationId);
      expect(applied.delivery.observations.some((o) => o.recordId === actual.payload.derivedFromObservationId)).toBe(true);
    }

    // WITHOUT bypassing verification boundaries: the actuals INHERIT the
    // observations' measures and uncertainties (never restated by this package).
    const monday = applied.delivery.observations.find(
      (o) => o.recordId === 'observation:field-pit-progress-monday',
    )!;
    const mondayActual = applied.delivery.actuals.find(
      (a) => a.payload.derivedFromObservationId === 'observation:field-pit-progress-monday',
    )!;
    expect(mondayActual.measure).toEqual(monday.measure);
    expect(mondayActual.uncertainty).toEqual(monday.uncertainty);

    // The observations history is preserved (no destructive overwrite):
    // the original observation array is a prefix of the final state's.
    expect(applied.delivery.observations.slice(0, 2)).toEqual(delivery.observations);
    expect(verifySealedDeliveryRecord(applied.delivery).ok).toBe(true);

    // --- Step 4: re-application is idempotent (already-actualized skips).
    const reapplied = unwrap(
      applyReconciliationProposal(
        applied.delivery,
        proposal,
        [second.store.observations[0]!, second.store.observations[1]!],
        {
          acceptedBy: PRINCIPAL,
          acceptedAt: T5,
          actualizedBy: PRINCIPAL,
          actualizedAt: T6,
        },
      ),
    );
    expect(reapplied.delivery.actuals).toHaveLength(2);
    expect(reapplied.applications.every((entry) => entry.outcome === 'already-actualized')).toBe(true);
  });
});

describe('reconciliation (negative)', () => {
  it('a REJECTED observation never actualizes (the verification boundary is the W036 accepted set)', () => {
    const solution = sealedSolution();
    let delivery = openedDelivery(solution);
    const observation = sealedObservation();
    delivery = unwrap(recordObservation(delivery, observation));
    delivery = unwrap(
      rejectObservation(delivery, observation.recordId, { rejectedBy: PRINCIPAL, rejectedAt: T5, reason: 'sensor out of calibration' }),
    );
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:rejected-obs',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: observation.recordId, proposedActualId: 'actual:rejected-obs' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [observation], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
    expect(error.message).toContain('rejected');
  });

  it('an ACTUAL record in the reconciliation observations is actualization-bypass-rejected', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:bypass-attempt',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: 'observation:pit-volume', proposedActualId: 'actual:pit-volume' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [sealedActualRecord()], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('actualization-bypass-rejected');
    expect((error as { recordKind?: string }).recordKind).toBe('actual');
  });

  it('the same observation id recorded with different content is version-conflict (never an overwrite)', () => {
    const solution = sealedSolution();
    let delivery = openedDelivery(solution);
    const observation = sealedObservation();
    delivery = unwrap(recordObservation(delivery, observation));
    const conflicting = sealedObservation({ measure: { kind: 'quantity', value: '999', unit: 'm3' } });
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:conflicting',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: 'observation:pit-volume', proposedActualId: 'actual:pit-volume' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [conflicting], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('a proposal referencing an unrecorded observation is dangling-reference-rejected', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:dangling',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: 'observation:not-recorded', proposedActualId: 'actual:ghost' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('observation-record');
  });

  it('a proposal targeting a different delivery is dangling-reference-rejected', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:other-delivery',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: 'delivery:other-delivery',
        entries: [
          { observationId: 'observation:field-pit-progress-monday', proposedActualId: 'actual:monday' },
        ],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [intake.store.observations[0]!], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('delivery-record');
  });

  it('a tampered delivery record is digest-mismatch (the authority state is tamper-evident)', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    const tampered = { ...delivery, status: 'closed' as const };
    const error = expectError(
      applyReconciliationProposal(tampered, unwrap(
        sealReconciliationProposal({
          schema: 'epoch.execution-tracking.reconciliation-proposal',
          schemaVersion: 1,
          recordId: 'reconciliation:tampered',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          deliveryId: DELIVERY_ID,
          entries: [{ observationId: 'observation:pit-volume', proposedActualId: 'actual:pit-volume' }],
          proposedAt: T5,
          proposedBy: PRINCIPAL,
        }),
      ), [sealedObservation()], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a cross-tenant proposal is tenant-isolation-rejected', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    const proposal = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:foreign',
        tenantId: 'tenant:initech',
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: 'observation:pit-volume', proposedActualId: 'actual:pit-volume' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      applyReconciliationProposal(delivery, proposal, [sealedObservation()], {
        acceptedBy: PRINCIPAL,
        acceptedAt: T5,
        actualizedBy: PRINCIPAL,
        actualizedAt: T6,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});
