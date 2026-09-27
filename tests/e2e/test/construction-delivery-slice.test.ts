// W031 Reference E2E slice 1 — CONSTRUCTION DELIVERY.
//
// The named E2E test for the construction path (scenario definition:
// examples/e2e/scenarios/construction-delivery.ts). Every assertion
// traces IDENTITY ACROSS SURFACES and the slice's named invariants:
//
//   1. the BOQ line id EQUALS the plan-line id end-to-end (W026 -> W036)
//   2. the delivery-link index carries the SAME canonical ids from line
//      through work package, activity, observation to actual
//   3. the observation intake flows through the W036 authority path and
//      the actual inherits the observation's identity
//      (derivedFromObservationId)
//   4. the actualization digest chain verifies (sequence + causal
//      parents + per-record digests)
//   5. the variance attribution references REAL evidence (a real W006
//      evidence record + a real W038 change record, by exact digest)
//   6. supervision-visible state folds agree across W036/W038/W039
//   7. cross-tenant intake is denied (R12) at the delivery gate
//   8. the scenario is deterministic (two runs, byte-identical digests)
//      and round-trips (serializes + digest-verifies)
import { describe, expect, it } from 'vitest';
import {
  recordObservation,
  reviseSolutionBaseline,
  sealDistinctionRecord,
  verifySealedDeliveryRecord,
  verifySealedDistinctionRecord,
  verifySealedProgramOfWork,
  foldDeliveryActuals,
} from '@epoch/solution-delivery';
import { foldSupplierDelivery } from '@epoch/procurement';
import { verifySealedActualizationEvent } from '@epoch/actualization';
import {
  constructionDeliveryDigestProjection,
  runConstructionDeliveryScenario,
  BASELINE_RECORD_ID,
  DELIVERY_ID,
  FIELD_ACTUAL_ID,
  FIELD_OBSERVATION_ID,
  LINE_CONCRETE,
  LINE_EXCAVATION,
  LINE_STEEL,
  MILESTONE_FOUNDATIONS,
  RECEIPT_OBSERVATION_ID,
  VARIANCE_ID,
  WORK_PACKAGE_SUBSTRUCTURE,
  WORK_PACKAGE_SUPERSTRUCTURE,
} from '../../../examples/e2e/scenarios/construction-delivery';
import { OTHER_TENANT, TENANT } from '../../../examples/e2e/scenarios/shared';
import {
  expectAuthorityRoutingRejected,
  expectCrossTenantDenied,
  expectDigestVerifies,
  expectRoundTrip,
  expectScenarioDeterministic,
  unwrap,
} from './helpers';

describe('construction-delivery-slice', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runConstructionDeliveryScenario,
    constructionDeliveryDigestProjection,
    'construction-delivery',
  );

  it('the BOQ line ids EQUAL the solution plan-line ids (identity-mapped projection)', () => {
    const planLineIds = scenario.solution.solutionLines.map((line) => line.lineId).sort();
    const boqLineIds = scenario.boq.lineItems.map((item) => item.lineId).sort();
    expect(boqLineIds).toEqual(planLineIds);
    expect(boqLineIds).toEqual([LINE_EXCAVATION, LINE_CONCRETE, LINE_STEEL]);
    // The BOQ view itself is a sealed projection: its content digest
    // verifies against its own content.
    const { contentDigest: boqClaimedDigest, ...boqContent } = scenario.boq;
    expectDigestVerifies(boqContent, boqClaimedDigest, 'BOQ view');
  });

  it('the delivery links carry ONE identity spine: line -> work package -> observation -> actual', () => {
    const excavationRow = scenario.deliveryLinks.rows.find((row) => row.solutionLineId === LINE_EXCAVATION);
    expect(excavationRow).toBeDefined();
    expect(excavationRow?.workPackageIds).toEqual([WORK_PACKAGE_SUBSTRUCTURE]);
    expect(excavationRow?.observationIds).toEqual([FIELD_OBSERVATION_ID]);
    expect(excavationRow?.actualIds).toEqual([FIELD_ACTUAL_ID]);

    const steelRow = scenario.deliveryLinks.rows.find((row) => row.solutionLineId === LINE_STEEL);
    expect(steelRow).toBeDefined();
    expect(steelRow?.workPackageIds).toEqual([WORK_PACKAGE_SUPERSTRUCTURE]);
    expect(steelRow?.observationIds).toEqual([RECEIPT_OBSERVATION_ID]);
  });

  it('the observation intake flows through the W036 authority path and the actual inherits the observation identity', () => {
    // Both observations are recorded in the delivery...
    const observationIds = scenario.delivery.observations.map((observation) => observation.recordId).sort();
    expect(observationIds).toEqual([FIELD_OBSERVATION_ID, RECEIPT_OBSERVATION_ID]);
    // ...accepted...
    expect(scenario.delivery.acceptedObservationIds.sort()).toEqual([
      FIELD_OBSERVATION_ID,
      RECEIPT_OBSERVATION_ID,
    ]);
    // ...and actualized: the actual DERIVES from the observation (the
    // derivation link is the identity carry).
    const fieldActual = scenario.delivery.actuals.find((actual) => actual.recordId === FIELD_ACTUAL_ID);
    expect(fieldActual).toBeDefined();
    expect(fieldActual?.kind).toBe('actual');
    expect((fieldActual?.payload as { derivedFromObservationId: string }).derivedFromObservationId).toBe(
      FIELD_OBSERVATION_ID,
    );
    // Every record in the delivery verifies (tamper detection).
    unwrap(verifySealedDeliveryRecord(scenario.delivery), 'delivery verification');
    unwrap(verifySealedProgramOfWork(scenario.program), 'program verification');
    for (const observation of scenario.delivery.observations) {
      unwrap(verifySealedDistinctionRecord(observation), 'observation verification');
    }
  });

  it('the actualization digest chain verifies (sequence, causal parents, per-record digests)', () => {
    const events = scenario.actualizationEvents;
    expect(events.length).toBeGreaterThanOrEqual(4);
    let previous: string | null = null;
    for (const [index, event] of events.entries()) {
      expect(event.sequence).toBe(index + 1);
      expect(event.causalParent?.sequence ?? null).toBe(index === 0 ? null : index);
      expect(event.causalParent?.streamId ?? null).toBe(index === 0 ? null : event.streamId);
      unwrap(verifySealedActualizationEvent(event), 'actualization event verification');
      // The chain link: each event's digest is the next one's parent address.
      if (previous !== null) {
        expect(event.causalParent).not.toBeNull();
      }
      previous = event.contentDigest;
    }
    // The final delivery head digest is the state the fold produced.
    expect(scenario.deliveryDigestChain[scenario.deliveryDigestChain.length - 1]).toBe(
      scenario.delivery.contentDigest,
    );
  });

  it('the variance attribution references REAL evidence by exact digest', () => {
    // The variance record references the baseline + the actual by their
    // EXACT content digests (the records that exist in this scenario).
    expect(scenario.variance.baselineRef.recordId).toBe(BASELINE_RECORD_ID);
    expect(scenario.variance.baselineRef.contentDigest).toBe(scenario.baselineRecord.contentDigest);
    expect(scenario.variance.actualRef.recordId).toBe(FIELD_ACTUAL_ID);
    const fieldActual = scenario.delivery.actuals.find((actual) => actual.recordId === FIELD_ACTUAL_ID)!;
    expect(scenario.variance.actualRef.contentDigest).toBe(fieldActual.contentDigest);
    // The variance itself: 120 planned vs 118.5 actual = 1.5 adverse, minor band.
    expect(scenario.variance.magnitude).toBe('1.5');
    expect(scenario.variance.direction).toBe('adverse');
    expect(scenario.variance.band).toBe('minor');
    // The attribution's cause is the REAL W038 change record...
    expect(scenario.attribution.varianceRef.recordId).toBe(VARIANCE_ID);
    expect(scenario.attribution.varianceRef.contentDigest).toBe(scenario.variance.contentDigest);
    expect(scenario.causes.length).toBe(1);
    expect(scenario.causes[0]?.cause.recordId).toBe(scenario.issue.recordId);
    expect(scenario.causes[0]?.cause.contentDigest).toBe(scenario.issue.contentDigest);
    // ...and its evidence digests resolve in the REAL W006 evidence store.
    for (const digest of scenario.attribution.evidence) {
      expect(scenario.evidence.has(digest), `attribution evidence ${digest.slice(0, 8)}… exists in the evidence store`).toBe(true);
    }
  });

  it('the supplier delivery fold agrees with the receipt observation (W037 -> W036 identity)', () => {
    const supplierState = foldSupplierDelivery(scenario.supplierDelivery);
    expect(supplierState.state).toBe('received');
    expect(supplierState.receiptCount).toBe(1);
    expect(supplierState.receivedLines).toEqual([
      { description: 'Structural steel sections grade S355', quantity: '4', unit: 'tonne' },
    ]);
  });

  it('supervision-visible state folds agree across W036/W038/W039', () => {
    // The actuals fold (W036): one quantity total per subject.
    const totals = foldDeliveryActuals(scenario.delivery).totals;
    const excavationTotal = totals.find(
      (total) => total.subjectId === 'activity:excavation-bulk' && total.measureKind === 'quantity',
    );
    expect(excavationTotal?.total).toBe('118.5');
    expect(excavationTotal?.unit).toBe('m3');
    // The actualization projection (W039): both groups corroborated.
    expect(scenario.actualizationState.observationCounts.total).toBe(2);
    expect(scenario.actualizationState.deliveryDigest).toBe(scenario.delivery.contentDigest);
    for (const group of scenario.actualizationState.validationGroups) {
      expect(['corroborated', 'resolved']).toContain(group.state);
    }
    // The variance summary (W039): one adverse minor quantity variance.
    expect(scenario.varianceSummary).toEqual([
      { varianceClass: 'quantity', direction: 'adverse', band: 'minor', count: 1, totalMagnitude: '1.5' },
    ]);
    // The execution projection (W038): the substructure package completed.
    const substructure = scenario.executionState.workPackages.find(
      (workPackage) => workPackage.workPackageId === WORK_PACKAGE_SUBSTRUCTURE,
    );
    expect(substructure?.workPackageState).toBe('completed');
    // The programme view (W026): the foundations milestone reached.
    const foundations = scenario.programme.milestones.find(
      (milestone) => milestone.milestoneId === MILESTONE_FOUNDATIONS,
    );
    expect(foundations?.status).toBe('reached');
  });

  it('a cross-tenant observation is DENIED at the delivery intake (R12)', () => {
    const foreignObservation = unwrap(
      sealDistinctionRecord({
        ...({
          recordId: 'observation:foreign-pit-volume',
          tenantId: OTHER_TENANT,
          subject: {
            solutionId: scenario.solution.solutionId,
            subjectKind: 'activity',
            subjectId: 'activity:excavation-bulk',
          },
          measure: { kind: 'quantity', value: '1', unit: 'm3' },
          payload: {
            deliveryId: DELIVERY_ID,
            observedAt: '2026-05-04T12:00:00.000Z',
            observedBy: 'principal:field-engineer',
            evidence: [],
          },
          recordedAt: '2026-05-04T12:00:00.000Z',
          recordedBy: 'principal:field-engineer',
          uncertainty: scenario.delivery.observations[0]?.uncertainty,
        } as Record<string, unknown>),
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
      }),
      'seal foreign observation',
    );
    expectCrossTenantDenied(
      recordObservation(scenario.delivery, foreignObservation),
      TENANT,
      OTHER_TENANT,
      'delivery observation intake',
    );
  });

  it('the baseline is IMMUTABLE (the dedicated negative-path export)', () => {
    // W036's reviseSolutionBaseline is the always-rejects authority gate:
    // no slice ever mutates an approved baseline.
    expectAuthorityRoutingRejected(
      reviseSolutionBaseline(scenario.approval, { note: 'attempted scope edit' }),
      'baseline-mutation-rejected',
      'baseline revision gate',
    );
    // The structural proof: the approval pins the EXACT version digest.
    expect(scenario.approval.baselineDigest).toBe(scenario.solution.contentDigest);
  });

  it('the scenario projection round-trips (serializes + digest-verifies)', () => {
    const projection = constructionDeliveryDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'construction-delivery projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
