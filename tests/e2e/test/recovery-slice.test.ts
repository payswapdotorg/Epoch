// W031 Reference E2E slice 5 — RECOVERY.
//
// The named E2E test for the Work Order's recovery acceptance (scenario
// definition: examples/e2e/scenarios/recovery.ts). Named invariants:
//
//   1. REPLAY DETERMINISM: the event stream from slice 1 re-folded from
//      scratch produces byte-identical derived-state digests — twice
//      in-process, and again from a RESTORED EventLog snapshot
//   2. LIVE CROSS-CHECK: the replayed derived state EQUALS the live
//      kernel state (observation ids + digests, actual ids, delivery
//      head digest)
//   3. TAMPER DETECTION: a mid-stream tampered record fails
//      verifyEventDigest with the TYPED digest-mismatch, and the
//      EventLog refuses its append
//   4. VERIFIED-PREFIX CONTINUATION: the fold halts at the first
//      integrity failure and its state is byte-identical to folding
//      the untampered records up to the same point
//   5. determinism + round-trip
import { describe, expect, it } from 'vitest';
import { EventLog, verifyEventDigest } from '@epoch/event-log';
import {
  FIELD_ACTUAL_ID,
  FIELD_OBSERVATION_ID,
  RECEIPT_OBSERVATION_ID,
  RECEIPT_ACTUAL_ID,
} from '../../../examples/e2e/scenarios/construction-delivery';
import {
  deliveryLifecycleStateDigest,
  recoveryDigestProjection,
  runRecoveryScenario,
} from '../../../examples/e2e/scenarios/recovery';
import {
  expectError,
  expectRoundTrip,
  expectScenarioDeterministic,
  unwrap,
} from './helpers';

describe('recovery-slice', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runRecoveryScenario,
    recoveryDigestProjection,
    'recovery',
  );

  it('REPLAY DETERMINISM: the stream re-folded from scratch yields identical derived-state digests', () => {
    // Twice in-process (the scenario folds twice)...
    expect(scenario.secondReplayDigest).toBe(scenario.replayedStateDigest);
    // ...and again from a RESTORED EventLog snapshot (log-level recovery).
    expect(scenario.restoredReplayDigest).toBe(scenario.replayedStateDigest);
    expect(scenario.replayedStateDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('LIVE CROSS-CHECK: the replayed derived state EQUALS the live kernel state', () => {
    const state = scenario.replayedState;
    const base = scenario.base;
    // The replayed observation ids + digests equal the delivery's.
    const liveObservations = [...base.delivery.observations].sort((a, b) =>
      a.recordId < b.recordId ? -1 : 1,
    );
    expect(Object.keys(state.observations).sort()).toEqual(liveObservations.map((observation) => observation.recordId));
    for (const observation of liveObservations) {
      expect(state.observations[observation.recordId]).toBe(observation.contentDigest);
    }
    expect(Object.keys(state.observations).sort()).toEqual([FIELD_OBSERVATION_ID, RECEIPT_OBSERVATION_ID].sort());
    // The replayed actual ids equal the delivery's.
    expect(state.actualIds).toEqual(base.delivery.actuals.map((actual) => actual.recordId).sort());
    expect(state.actualIds).toEqual([FIELD_ACTUAL_ID, RECEIPT_ACTUAL_ID].sort());
    // The replayed delivery head digest equals the authoritative record's.
    expect(state.deliveryDigest).toBe(base.delivery.contentDigest);
    // The replayed variance + attribution pin the exact kernel digests.
    expect(state.variance?.varianceId).toBe(base.variance.varianceId);
    expect(state.variance?.contentDigest).toBe(base.variance.contentDigest);
    expect(state.attribution?.attributionId).toBe(base.attribution.attributionId);
    expect(state.attribution?.contentDigest).toBe(base.attribution.contentDigest);
    // The replayed solution/program digests pin the kernel records.
    expect(state.solutionDigest).toBe(base.solution.contentDigest);
    expect(state.programDigest).toBe(base.program.contentDigest);
  });

  it('TAMPER DETECTION: a mid-stream tampered record is the TYPED digest-mismatch', () => {
    const tampered = scenario.tamperedRecords[scenario.tamperIndex]!;
    // The claimed digest no longer matches the (mutated) content.
    const verification = verifyEventDigest({ event: tampered.event, digest: tampered.contentDigest });
    expectError(verification, 'digest-mismatch', 'tampered record verification');
    // The EventLog refuses the tampered append (history is append-only
    // and tamper-evident).
    const log = new EventLog({ expectedTenantId: scenario.base.delivery.tenantId });
    expectError(
      log.appendEvent({ event: tampered.event, digest: tampered.contentDigest }),
      'digest-mismatch',
      'tampered append admission',
    );
  });

  it('VERIFIED-PREFIX CONTINUATION: the fold halts at the failure and continues from the verified prefix', () => {
    const fold = scenario.tamperedFold;
    // The fold halted EXACTLY at the tampered record...
    expect(fold.verifiedCount).toBe(scenario.tamperIndex);
    expect(fold.failure).not.toBeNull();
    expect(fold.failure?.code).toBe('digest-mismatch');
    // ...and its state is byte-identical to folding the UNTAMPERED
    // records up to the same point (the verified prefix).
    expect(deliveryLifecycleStateDigest(fold.state)).toBe(scenario.prefixDigest);
    // The prefix is a STRICT prefix of the full state: fewer facts
    // folded, same shape.
    expect(fold.verifiedCount).toBeLessThan(scenario.records.length);
  });

  it('the untampered stream still verifies end-to-end (every record, every digest)', () => {
    for (const [index, record] of scenario.records.entries()) {
      const verified = verifyEventDigest({ event: record.event, digest: record.contentDigest });
      expect(verified.ok, `record ${index + 1} verifies`).toBe(true);
    }
    // The restored log re-seals identically: snapshot -> log -> snapshot.
    const restored = unwrap(EventLog.fromSnapshot(scenario.base.log.snapshot()), 'log restore');
    expect(restored.size).toBe(scenario.base.log.size);
    expect(unwrap(restored.readStream(scenario.records[0]!.event.streamId), 'restored stream read').length).toBe(
      scenario.records.length,
    );
  });

  it('the scenario projection round-trips (serializes + digest-verifies)', () => {
    const projection = recoveryDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'recovery projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
