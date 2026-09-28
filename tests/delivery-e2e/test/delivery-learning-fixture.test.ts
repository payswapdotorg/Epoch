// W044 — the DELIVERY-TO-LEARNING end-to-end fixture test.
//
// The named acceptance test over the scenario definition
// (examples/delivery-e2e/scenarios/delivery-learning.ts). Every
// assertion traces IDENTITY, AUTHORIZATION or LINEAGE ACROSS SURFACES —
// the Work Order's "must prove" / "must demonstrate" clauses, one test
// per clause:
//
//   A. semantic identity remains continuous end-to-end (solution -> BOQ
//      -> program -> delivery -> supervision -> learning)
//   B. BOQ row <-> Program activity <-> spatial binding stay
//      synchronized (the W026 projection discipline)
//   C. procurement/execution are projections of the universal
//      Acquire/Realize concepts (the lifecycle graph carries ONE
//      acquire and ONE realize stage)
//   D. baseline, commitment, actual and forecast remain distinct
//      (four separate immutable distinction records)
//   E. incomplete information and confidence remain explicit (the open
//      supervisor request, the uncertainty states, the residual)
//   F. the complete universal lifecycle traverses all eleven stages
//      with typed precedes transitions
//   G. the optional Aurum/event-bridge path supplies observations AND
//      the supervisor's returned answer (W042 + W036 authority)
//   H. missed milestone -> supervisor request -> returned status ->
//      automatic update (the W043 supervision story)
//   I. alert propagation (raise -> notify -> escalate -> notify ->
//      resolve + the outbound bridge alert)
//   J. procurement actuals fold into the delivery actuals + the
//      supplier delivery fold
//   K. predicted-vs-actual variance (baseline vs actual + forecast vs
//      actual) with real evidence attribution
//   L. learning only consumes validated outcome lineage (the typed
//      eligibility + exclusions + lineage-bound model revision)
//   M. role-specific authorized views are enforced (W041 + real W009
//      decisions + the audited denial)
//   N. cross-tenant intake is denied (R12) at every gate crossed
//   O. the scenario is deterministic (two runs, byte-identical
//      digests), round-trips, and the evidence chain replays
import { describe, expect, it } from 'vitest';
import {
  closeDeliveryRecord,
  foldDeliveryActuals,
  recordObservation,
  reviseSolutionBaseline,
  sealDistinctionRecord,
  verifySealedDeliveryRecord,
  verifySealedDistinctionRecord,
  verifySealedProgramOfWork,
} from '@epoch/solution-delivery';
import { foldSupplierDelivery } from '@epoch/procurement';
import { verifySealedActualizationEvent } from '@epoch/actualization';
import { verifySealedVarianceRecord } from '@epoch/variance';
import { verifySealedLearningDataset, verifySealedModelRevision } from '@epoch/learning-calibration';
import { releasedPathsOf, releasedValueOf } from '@epoch/access-projection';
import {
  deliveryLearningDigestProjection,
  runDeliveryLearningScenario,
  AURUM_OBSERVATION_ID,
  AURUM_RECEIPT_ACTUAL_ID,
  BASELINE_RECORD_ID,
  COMMITMENT_RECORD_ID,
  DELIVERY_ID,
  FIELD_ACTUAL_ID,
  FIELD_OBSERVATION_ID,
  FORECAST_R1_ID,
  FORECAST_R2_ID,
  ISSUE_ID,
  LINE_CONCRETE,
  LINE_EXCAVATION,
  LINE_STEEL,
  MILESTONE_FOUNDATIONS,
  OUTCOME_ID,
  OUTCOME_RESIDUAL_ID,
  SOLUTION_ID,
  WORK_PACKAGE_SUBSTRUCTURE,
  WORK_PACKAGE_SUPERSTRUCTURE,
  ALERT_MILESTONE_ID,
  type DeliveryLearningScenario,
} from '../../../examples/delivery-e2e/scenarios/delivery-learning';
import { OTHER_TENANT, TENANT } from '../../../examples/delivery-e2e/scenarios/shared';
import {
  expectAuthorityRoutingRejected,
  expectCrossTenantDenied,
  expectDigestVerifies,
  expectNoProviderVocabulary,
  expectRoundTrip,
  expectScenarioDeterministic,
  unwrap,
} from './helpers';

describe('delivery-to-learning-fixture', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runDeliveryLearningScenario,
    deliveryLearningDigestProjection,
    'delivery-learning',
  );

  // == A. semantic identity continuity ======================================
  it('semantic identity remains continuous: one solution id across every surface', () => {
    expect(scenario.solution.solutionId).toBe(SOLUTION_ID);
    expect(scenario.program.solutionId).toBe(SOLUTION_ID);
    expect(scenario.delivery.solutionId).toBe(SOLUTION_ID);
    expect(scenario.pass1.solutionId).toBe(SOLUTION_ID);
    expect(scenario.comparisonFact.solutionId).toBe(SOLUTION_ID);
    expect(scenario.candidate.solutionId).toBe(SOLUTION_ID);
    expect(scenario.dataset.solutionId).toBe(SOLUTION_ID);
    // The BOQ line ids ARE the solution plan-line ids (identity-mapped).
    const planLineIds = scenario.solution.solutionLines.map((line) => line.lineId).sort();
    const boqLineIds = scenario.boq.lineItems.map((item) => item.lineId).sort();
    expect(boqLineIds).toEqual(planLineIds);
    expect(boqLineIds).toEqual([LINE_EXCAVATION, LINE_CONCRETE, LINE_STEEL]);
    // The delivery-link index carries the SAME canonical ids from line
    // through work package, observation to actual.
    const excavationRow = scenario.deliveryLinks.rows.find((row) => row.solutionLineId === LINE_EXCAVATION);
    expect(excavationRow?.workPackageIds).toEqual([WORK_PACKAGE_SUBSTRUCTURE]);
    expect(excavationRow?.observationIds).toEqual([FIELD_OBSERVATION_ID]);
    expect(excavationRow?.actualIds).toEqual([FIELD_ACTUAL_ID]);
    const steelRow = scenario.deliveryLinks.rows.find((row) => row.solutionLineId === LINE_STEEL);
    expect(steelRow?.workPackageIds).toEqual([WORK_PACKAGE_SUPERSTRUCTURE]);
    expect(steelRow?.observationIds).toEqual([AURUM_OBSERVATION_ID]);
  });

  // == B. BOQ <-> Program <-> spatial binding ==============================
  it('BOQ row <-> program activity <-> spatial binding stay synchronized', () => {
    // The BOQ projection is sealed: its content digest verifies.
    const { contentDigest: boqClaimedDigest, ...boqContent } = scenario.boq;
    expectDigestVerifies(boqContent, boqClaimedDigest, 'BOQ view');
    // Every BOQ line carries the SAME work-package/activity links as the
    // baseline program (the synchronized schedule projection).
    const programActivities = new Map(
      scenario.program.workPackages.flatMap((workPackage) =>
        workPackage.activities.map((activity) => [activity.activityId, workPackage.workPackageId]),
      ),
    );
    for (const item of scenario.boq.lineItems) {
      for (const activityId of item.links.activityIds) {
        expect(programActivities.get(activityId), `BOQ line ${item.lineId} activity link`).toBe(
          item.links.workPackageIds[0],
        );
      }
    }
    // Every world-entity-bound BOQ section groups EXACTLY the solution
    // lines bound to the same entity (the spatial binding).
    const lineBindings = new Map(scenario.solution.solutionLines.map((line) => [line.lineId, line.worldEntityId]));
    for (const section of scenario.boq.sections) {
      if (section.worldEntityId === undefined) continue;
      for (const lineId of section.lineIds) {
        expect(lineBindings.get(lineId), `BOQ section ${section.sectionCode} spatial binding`).toBe(
          section.worldEntityId,
        );
      }
    }
    // Both world entities carry at least one bound BOQ section.
    const boundSections = scenario.boq.sections.filter((section) => section.worldEntityId !== undefined);
    expect(boundSections.map((section) => section.worldEntityId).sort()).toEqual([
      'element-foundations',
      'element-frame',
    ]);
    // The programme projection agrees with the live schedule state.
    const foundations = scenario.programme.milestones.find((milestone) => milestone.milestoneId === MILESTONE_FOUNDATIONS);
    expect(foundations?.status).toBe('reached');
    unwrap(verifySealedProgramOfWork(scenario.program), 'baseline program verification');
    unwrap(verifySealedProgramOfWork(scenario.programLive1), 'live program 1 verification');
    unwrap(verifySealedProgramOfWork(scenario.programLive2), 'live program 2 verification');
  });

  // == C. procurement/execution are Acquire/Realize projections ============
  it('procurement and execution are projections of the universal Acquire/Realize concepts', () => {
    const stages = scenario.lifecycle.stages.map((stage) => stage.stage);
    expect(stages).toContain('acquire');
    expect(stages).toContain('realize');
    // ONE acquire stage record, ONE realize stage record — the domain
    // records (procurement chain, execution store) hang below them and
    // never add parallel lifecycle stages of their own.
    expect(scenario.lifecycle.stages.filter((stage) => stage.stage === 'acquire')).toHaveLength(1);
    expect(scenario.lifecycle.stages.filter((stage) => stage.stage === 'realize')).toHaveLength(1);
    // The procurement chain grounds the SAME solution + delivery.
    expect(scenario.acquisitionRequest.solutionId).toBe(SOLUTION_ID);
    expect(scenario.acquisitionRequest.deliveryId).toBe(DELIVERY_ID);
    expect(scenario.acquisitionFulfillments[0]?.acquisitionId).toBe(scenario.acquisitionRequest.acquisitionId);
    // The execution tracking store grounds the SAME solution + program.
    expect(scenario.tracking.solutionId).toBe(SOLUTION_ID);
    // The execution projection shows the substructure in progress.
    const substructure = scenario.executionState.workPackages.find(
      (workPackage) => workPackage.workPackageId === WORK_PACKAGE_SUBSTRUCTURE,
    );
    expect(substructure?.workPackageState).toBe('in-progress');
  });

  // == D. baseline/commitment/actual/forecast stay distinct =================
  it('baseline, commitment, actual and forecast remain distinct records', () => {
    const byId = new Map(scenario.ledger.records.map((record) => [record.recordId, record]));
    const baseline = byId.get(BASELINE_RECORD_ID);
    const commitment = byId.get(COMMITMENT_RECORD_ID);
    const forecast = byId.get(FORECAST_R2_ID);
    const forecastR1 = byId.get(FORECAST_R1_ID);
    expect(baseline?.kind).toBe('baseline');
    expect(commitment?.kind).toBe('commitment');
    expect(forecast?.kind).toBe('forecast');
    // The actual lives in the delivery record (its own authority).
    const actual = scenario.delivery.actuals.find((a) => a.recordId === FIELD_ACTUAL_ID);
    expect(actual?.kind).toBe('actual');
    // FOUR distinct ids, FOUR distinct content digests, FOUR kinds —
    // never one mutable value.
    const four = [baseline, commitment, forecast, actual];
    expect(new Set(four.map((record) => record?.recordId)).size).toBe(4);
    expect(new Set(four.map((record) => record?.contentDigest)).size).toBe(4);
    expect(new Set(four.map((record) => record?.kind)).size).toBe(4);
    // The forecast REFINES the earlier forecast (append-only lineage) and
    // the commitment carries its procurement measure.
    if (forecastR1?.kind === 'forecast' && forecast?.kind === 'forecast') {
      expect(forecastR1.payload.refines).toBeNull();
      expect(forecast.payload.refines).toBe(FORECAST_R1_ID);
      expect(forecast.measure).toEqual({ kind: 'quantity', value: '119', unit: 'm3' });
    } else {
      throw new Error('unreachable: both forecasts carry the forecast kind');
    }
    if (commitment?.kind === 'commitment') {
      expect(commitment.measure).toEqual({ kind: 'quantity', value: '4', unit: 'tonne' });
      expect(commitment.payload.acquisitionId).toBe(scenario.acquisitionRequest.acquisitionId);
    }
    // The baseline pins the EXACT approved solution digest.
    if (baseline?.kind === 'baseline') {
      expect(baseline.payload.solutionVersionDigest).toBe(scenario.solution.contentDigest);
    }
  });

  // == E. incomplete information + explicit confidence ======================
  it('incomplete information and confidence remain explicit', () => {
    // The supervisor request was OPEN with an explicit freshness
    // requirement while the milestone was missed…
    expect(scenario.infoRequestOpen.status).toBe('open');
    expect(scenario.infoRequestOpen.freshnessRequirement?.state).toBe('aging');
    expect(scenario.infoRequestOpen.decisionImpact.materiality).toBe('material');
    // …and the residual outcome stays an explicit unresolved record.
    expect(scenario.outcomeResidual.recordId).toBe(OUTCOME_RESIDUAL_ID);
    if (scenario.outcomeResidual.kind !== 'outcome') {
      throw new Error('unreachable: the residual record is an outcome');
    }
    expect(scenario.outcomeResidual.payload.outcomeKind).toBe('residual');
    expect(scenario.outcomeResidual.uncertainty.confidence.value).toBeLessThan(0.5);
    // Every distinction record in the ledger carries a full uncertainty
    // state (provenance + freshness + confidence).
    for (const record of scenario.ledger.records) {
      expect(record.uncertainty.provenance.kind).toBeTruthy();
      expect(record.uncertainty.freshness.state).toBeTruthy();
      expect(record.uncertainty.confidence.method).toBeTruthy();
    }
  });

  // == F. the complete universal lifecycle ==================================
  it('the lifecycle graph carries all eleven universal stages with precedes transitions', () => {
    expect([...scenario.lifecycle.stages.map((stage) => stage.stage)].sort()).toEqual([
      'acquire', 'actualize', 'close', 'decide', 'forecast', 'learn',
      'observe', 'plan', 'realize', 'understand', 'verify',
    ]);
    expect(scenario.lifecycle.transitions).toHaveLength(10);
    expect(scenario.lifecycle.transitions.every((transition) => transition.relation === 'precedes')).toBe(true);
    // The transitions form ONE connected spine in lifecycle order:
    // understand -> … -> learn (follow the edges, never array order).
    const spine = [
      'understand', 'decide', 'plan', 'acquire', 'realize', 'observe',
      'actualize', 'verify', 'forecast', 'close', 'learn',
    ];
    const edges = new Map(
      scenario.lifecycle.transitions.map((transition) => [transition.fromStageRecordId, transition.toStageRecordId]),
    );
    expect(edges.size).toBe(10);
    let current = 'stage:lifecycle-understand';
    for (const stage of spine.slice(1)) {
      const next = edges.get(current);
      expect(next, `the spine continues from ${current}`).toBe(`stage:lifecycle-${stage}`);
      current = `stage:lifecycle-${stage}`;
    }
    // The decision leg is real: two alternatives evaluated, one approved.
    expect(scenario.evaluation.winnerId).toBe(SOLUTION_ID);
    expect(scenario.evaluation.primaryTotal).toBe('29670');
    expect(scenario.evaluation.alternativeTotal).toBe('32470');
    expect(scenario.approval.baselineDigest).toBe(scenario.solution.contentDigest);
    // The Understand leg is real: the existing-conditions estimate.
    expect(scenario.existingConditions.kind).toBe('estimate');
    if (scenario.existingConditions.kind !== 'estimate') {
      throw new Error('unreachable: the existing-conditions record is an estimate');
    }
    expect(scenario.existingConditions.measure).toEqual({ kind: 'quantity', value: '121', unit: 'm3' });
    // The delivery CLOSED (the close stage is backed by the record).
    expect(scenario.closedDelivery.status).toBe('closed');
    expect(scenario.closedDelivery.closedAt).toBeTruthy();
    unwrap(verifySealedDeliveryRecord(scenario.closedDelivery), 'closed delivery verification');
  });

  // == G. the Aurum bridge legs =============================================
  it('the mocked Aurum bridge supplies the observation AND the returned answer (authority preserved)', () => {
    // OUTBOUND: the information request was delivered to the provider.
    expect(scenario.bridge.infoDispatch.kind).toBe('delivered');
    expect(scenario.bridge.infoRequest.requestClass).toBe('information');
    // The least-privilege projection cites the REAL W041 policy digest.
    expect(scenario.bridge.infoRequest.projectionDigest).toBe(scenario.accessPolicyDigest);
    // The commercial note was filtered out of the released payload.
    const released = scenario.bridge.infoRequest.payload.released.map((entry) => entry.path);
    expect(released).toEqual(['requestRef', 'statusSummary']);
    const redacted = scenario.bridge.infoRequest.payload.redacted.map((entry) => entry.path);
    expect(redacted).toEqual(['internalCommercialNote']);
    // INBOUND: the observation event became a W036-shaped proposal…
    expect(scenario.bridge.observationEvent.eventClass).toBe('observation-report');
    expect(scenario.bridge.observationIntake.kind).toBe('intake-admitted');
    expect(scenario.bridge.observationProposal.observation.recordId).toBe(AURUM_OBSERVATION_ID);
    expect(scenario.bridge.observationProposal.sourceEventId).toBe(scenario.bridge.observationEvent.eventId);
    // …sealed through the REAL W036 authority and recorded in delivery.
    const aurumObservation = scenario.delivery.observations.find((o) => o.recordId === AURUM_OBSERVATION_ID);
    expect(aurumObservation).toBeDefined();
    unwrap(verifySealedDistinctionRecord(aurumObservation!), 'Aurum observation verification');
    expect(aurumObservation?.uncertainty.provenance.kind).toBe('reported');
    // The returned ANSWER is a correlated information-response event.
    expect(scenario.bridge.answerEvent.eventClass).toBe('information-response');
    expect(scenario.bridge.answerEvent.correlationId).toBe(scenario.bridge.infoRequest.correlationId);
    expect(scenario.bridge.answerIntake.kind).toBe('intake-admitted');
    // The supervisor request is now FULFILLED with the answer's
    // provider payload digest as evidence.
    expect(scenario.infoRequestFulfilled.status).toBe('fulfilled');
    expect(scenario.infoRequestFulfilled.fulfillment?.evidence[0]?.digest).toBe(
      scenario.bridge.answerEvent.source.providerPayloadDigest,
    );
    // The bridge recorded the full exchange (registration, two outbound
    // dispatches with their receipts, two inbound intakes, one proposal);
    // the provider saw exactly the delivered requests.
    expect(scenario.bridge.eventDiscriminators).toEqual([
      'bridge:provider-registered',
      'bridge:receipt-recorded',
      'bridge:request-dispatched',
      'bridge:event-received',
      'bridge:intake-proposed',
      'bridge:receipt-recorded',
      'bridge:request-dispatched',
      'bridge:event-received',
    ]);
    expect(scenario.bridge.deliveredRequestCount).toBe(2);
    // No provider vocabulary leaks past the neutral seam records.
    expectNoProviderVocabulary(scenario.bridge.observationProposal, 'observation intake proposal');
    expectNoProviderVocabulary(scenario.infoRequestFulfilled, 'fulfilled info request');
  });

  // == H. missed milestone -> returned status -> automatic update ===========
  it('the missed milestone drives a supervisor request whose returned status updates supervision automatically', () => {
    // Pass 1 (missed milestone, open request): five findings — the late
    // foundations activity appears BOTH as planned-vs-actual and as
    // critical-path drift (it is on the critical path).
    const findingIds = scenario.pass1.findings.map((finding) => finding.findingId);
    expect(findingIds).toEqual([
      'finding:critical-path-drift-activity-activity-foundation-concrete',
      'finding:planned-vs-actual-activity-activity-foundation-concrete',
      'finding:planned-vs-actual-milestone-milestone-foundations',
      'finding:unresolved-unknown-info-request-info-request-foundations',
      'finding:verification-failure-gate-gate-formation-inspection',
    ]);
    const milestoneFinding = scenario.pass1.findings.find(
      (finding) => finding.subject.subjectKind === 'milestone',
    );
    expect(milestoneFinding?.findingClass).toBe('planned-vs-actual');
    expect(milestoneFinding?.status).toBe('late');
    expect(milestoneFinding?.milestoneId).toBe(MILESTONE_FOUNDATIONS);
    // Pass 2 (returned status + foundations complete): ZERO findings —
    // the projection recomputed from the new inputs with no manual
    // state write anywhere.
    expect(scenario.pass2.findings).toHaveLength(0);
    // The supervision state projection flips every finding row to
    // presentInLatestPass: false (the automatic update).
    expect(scenario.supervisionState.counts.presentInLatestPass).toBe(0);
    expect(scenario.supervisionState.findings.every((row) => !row.presentInLatestPass)).toBe(true);
    expect(scenario.supervisionState.counts.byClass['planned-vs-actual']).toBe(2);
    expect(scenario.supervisionState.counts.byClass['critical-path-drift']).toBe(1);
    expect(scenario.supervisionState.counts.byStatus.late).toBe(4);
    // The milestone event flow in the delivery stream: missed (implicit
    // in pass 1) -> reached (recorded at T10).
    const milestoneEvent = scenario.events.find(
      (event) => event.payload.discriminator === 'delivery:milestone-reached',
    );
    expect(milestoneEvent?.payload.data).toMatchObject({ milestoneId: MILESTONE_FOUNDATIONS });
  });

  // == I. alert propagation ==================================================
  it('alerts propagate: raise -> notify -> escalate -> notify -> resolve (+ the outbound bridge alert)', () => {
    // Five chains, one per pass-1 finding.
    expect(scenario.alertChains).toHaveLength(5);
    // Every chain ENDS resolved.
    expect(scenario.alertChains.every((chain) => chain[chain.length - 1]!.status === 'resolved')).toBe(true);
    // The fold counts chains by their CURRENT head status: all five
    // ended resolved. The lifecycle totals (5 raises, 1 escalation) live
    // in the revision histories + the supervision event stream below.
    expect(scenario.alertFold.counts).toMatchObject({ raised: 0, escalated: 0, resolved: 5 });
    expect(scenario.alertChains.filter((chain) => chain.some((revision) => revision.status === 'escalated'))).toHaveLength(1);
    // The milestone alert's chain: raised -> escalated -> resolved (3 revisions).
    const milestoneChain = scenario.alertChains.find((chain) => chain[0]!.alertId === ALERT_MILESTONE_ID);
    expect(milestoneChain?.map((revision) => revision.status)).toEqual(['raised', 'escalated', 'resolved']);
    // The severity came from the policy rule (planned-vs-actual/late -> major).
    expect(milestoneChain?.[0]?.severity).toBe('major');
    // The escalation ran through the REAL W003 pipeline: the proposal
    // digest bound into the gateway decision, the outcome dispatched.
    expect(scenario.escalationOutcome.outcomeKind).toBe('dispatched');
    expect(scenario.escalationOutcome.proposalDigest).toBeTruthy();
    expect(scenario.escalationOutcome.escalationLevel).toBe(1);
    expect(scenario.escalatedAlert.escalationLevel).toBe(1);
    // Notifications: 5 raise notifications to the supervisor role + 1
    // escalation notification to the program-manager role.
    expect(scenario.notifications).toHaveLength(6);
    expect(scenario.notifications.filter((notification) => notification.dispatchedAt.endsWith('T17:00:00.000Z'))).toHaveLength(5);
    expect(scenario.notifications[5]?.targets).toEqual([{ targetKind: 'role', targetRef: 'role:program-manager' }]);
    // Every notification was dispatched exactly once (the in-memory
    // adapter receipts).
    expect(scenario.notificationReceipts).toHaveLength(6);
    expect(scenario.notificationReceipts.every((receipt) => !receipt.duplicate)).toBe(true);
    // The OUTBOUND bridge alert reached the mocked provider.
    expect(scenario.bridge.alertDispatch.kind).toBe('delivered');
    expect(scenario.bridge.alertRequest.requestClass).toBe('alert');
    expect(scenario.bridge.alertRequest.projectionDigest).toBe(scenario.accessPolicyDigest);
    // The supervision event stream carries the full propagation.
    const discriminators = scenario.supervisionEvents.map((event) => event.payload.discriminator);
    expect(discriminators).toEqual([
      'supervision:program-registered',
      'supervision:delivery-registered',
      'supervision:policy-registered',
      'supervision:pass-evaluated',
      'supervision:finding-produced',
      'supervision:finding-produced',
      'supervision:finding-produced',
      'supervision:finding-produced',
      'supervision:finding-produced',
      'supervision:alert-raised',
      'supervision:alert-raised',
      'supervision:alert-raised',
      'supervision:alert-raised',
      'supervision:alert-raised',
      'supervision:notification-dispatched',
      'supervision:notification-dispatched',
      'supervision:notification-dispatched',
      'supervision:notification-dispatched',
      'supervision:notification-dispatched',
      'supervision:alert-escalated',
      'supervision:notification-dispatched',
      'supervision:projection-updated',
      'supervision:pass-evaluated',
      'supervision:alert-resolved',
      'supervision:alert-resolved',
      'supervision:alert-resolved',
      'supervision:alert-resolved',
      'supervision:alert-resolved',
      'supervision:projection-updated',
    ]);
  });

  // == J. procurement actuals ================================================
  it('procurement actuals fold into the delivery actuals and the supplier delivery state', () => {
    // The supplier delivery fold: received, one receipt line.
    const supplierState = foldSupplierDelivery(scenario.supplierDelivery);
    expect(supplierState.state).toBe('received');
    expect(supplierState.receiptCount).toBe(1);
    expect(supplierState.receivedLines).toEqual([
      { description: 'Structural steel sections grade S355', quantity: '4', unit: 'tonne' },
    ]);
    // The goods receipt (the bridged observation) became an ACTUAL.
    const steelActual = scenario.delivery.actuals.find((actual) => actual.recordId === AURUM_RECEIPT_ACTUAL_ID);
    expect(steelActual).toBeDefined();
    expect(steelActual?.measure).toEqual({ kind: 'quantity', value: '4', unit: 'tonne' });
    // The actuals fold totals both actuals.
    const totals = foldDeliveryActuals(scenario.delivery).totals;
    const excavationTotal = totals.find(
      (total) => total.subjectId === 'activity:excavation-bulk' && total.measureKind === 'quantity',
    );
    expect(excavationTotal?.total).toBe('118.5');
    const steelTotal = totals.find(
      (total) => total.subjectId === WORK_PACKAGE_SUPERSTRUCTURE && total.measureKind === 'quantity',
    );
    expect(steelTotal?.total).toBe('4');
  });

  // == K. predicted-vs-actual variance =======================================
  it('predicted-vs-actual variance: baseline vs actual AND forecast vs actual, with real evidence', () => {
    // Baseline vs actual (the variance record): 120 vs 118.5.
    expect(scenario.variance.baselineRef.recordId).toBe(BASELINE_RECORD_ID);
    expect(scenario.variance.baselineRef.contentDigest).toBe(scenario.baselineRecord.contentDigest);
    expect(scenario.variance.actualRef.recordId).toBe(FIELD_ACTUAL_ID);
    const fieldActual = scenario.delivery.actuals.find((actual) => actual.recordId === FIELD_ACTUAL_ID)!;
    expect(scenario.variance.actualRef.contentDigest).toBe(fieldActual.contentDigest);
    expect(scenario.variance.magnitude).toBe('1.5');
    expect(scenario.variance.direction).toBe('adverse');
    expect(scenario.variance.band).toBe('minor');
    unwrap(verifySealedVarianceRecord(scenario.variance), 'variance verification');
    // The attribution's cause is the REAL W038 change record…
    expect(scenario.attribution.cause.recordId).toBe(ISSUE_ID);
    expect(scenario.attribution.cause.contentDigest).toBe(scenario.issue.contentDigest);
    expect(scenario.causes).toHaveLength(1);
    // …and its evidence digests resolve in the REAL W006 evidence store.
    for (const digest of scenario.attribution.evidence) {
      expect(scenario.evidence.has(digest), `attribution evidence ${digest.slice(0, 8)} exists in the evidence store`).toBe(true);
    }
    // The variance summary folds one adverse minor quantity variance.
    expect(scenario.varianceSummary).toEqual([
      { varianceClass: 'quantity', direction: 'adverse', band: 'minor', count: 1, totalMagnitude: '1.5' },
    ]);
    // Forecast vs actual (the learning comparison fact): 119 vs 118.5.
    expect(scenario.comparisonFact.forecastRef.recordId).toBe(FORECAST_R2_ID);
    expect(scenario.comparisonFact.forecastRef.contentDigest).toBe(scenario.forecastR2.contentDigest);
    expect(scenario.comparisonFact.actualRef.recordId).toBe(FIELD_ACTUAL_ID);
    expect(scenario.comparisonFact.actualRef.contentDigest).toBe(fieldActual.contentDigest);
    expect(scenario.comparisonFact.deviation).toBe('0.5');
    expect(scenario.comparisonFact.bias).toBe('over-forecast');
    // The actualization digest chain verifies (the fold's evidence).
    const events = scenario.actualizationEvents;
    expect(events.length).toBeGreaterThanOrEqual(6);
    for (const [index, event] of events.entries()) {
      expect(event.sequence).toBe(index + 1);
      unwrap(verifySealedActualizationEvent(event), 'actualization event verification');
    }
    expect(scenario.deliveryDigestChain[scenario.deliveryDigestChain.length - 1]).toBe(
      scenario.delivery.contentDigest,
    );
    // The actualization projection agrees with the final delivery.
    expect(scenario.actualizationState.deliveryDigest).toBe(scenario.closedDelivery.contentDigest);
    expect(scenario.actualizationState.observationCounts.total).toBe(2);
  });

  // == L. learning only consumes validated outcome lineage ==================
  it('learning consumes ONLY validated outcome lineage: typed exclusions, lineage-bound revision', () => {
    // The governed store dataset: 1 eligible row + 1 typed exclusion.
    expect(datasetShape(scenario)).toEqual({ eligible: 1, excluded: 1 });
    unwrap(verifySealedLearningDataset(scenario.dataset), 'dataset verification');
    // The eligible row's lineage binds the REAL records by exact digest.
    const row = scenario.dataset.rows[0]!;
    expect(row.predictionRef.recordId).toBe(FORECAST_R2_ID);
    expect(row.outcomeRef.recordId).toBe(OUTCOME_ID);
    expect(row.actualRef.recordId).toBe(FIELD_ACTUAL_ID);
    expect(row.provenance.comparisonFact.contentDigest).toBe(scenario.comparisonFact.contentDigest);
    expect(row.provenance.outcomeRecord.contentDigest).toBe(scenario.outcome.contentDigest);
    // The features are derived deterministically (0.5 over-forecast,
    // quantity class, adverse direction, minor band, issue-record cause).
    expect(row.features).toMatchObject({
      deviationMagnitude: '0.5',
      bias: 'over-forecast',
      varianceClass: 'quantity',
      direction: 'adverse',
      magnitudeBand: 'minor',
      attributionCauseKind: 'issue-record',
    });
    // The residual candidate was EXCLUDED with a typed record (never a
    // silent drop).
    const exclusion = scenario.dataset.exclusions[0]!;
    expect(exclusion.state).toBe('excluded-unresolved');
    expect(exclusion.reasons).toEqual(['outcome-kind-residual']);
    expect(exclusion.candidateRef.recordId).toBe(scenario.candidateResidual.candidateId);
    // The foreign-tenant candidate is excluded on the pure path.
    expect(scenario.foreignEvaluation.state).toBe('excluded-foreign-tenant');
    expect(scenario.foreignEvaluation.reasons).toEqual(['tenant-mismatch']);
    expect(scenario.foreignDataset.rows).toHaveLength(0);
    expect(scenario.foreignDataset.exclusions[0]?.state).toBe('excluded-foreign-tenant');
    // The model revision's lineage resolves to the dataset + the exact
    // changing observations (the mandatory lineage).
    unwrap(verifySealedModelRevision(scenario.revision), 'model revision verification');
    expect(scenario.revision.lineage.datasets).toEqual([
      { datasetId: scenario.dataset.datasetId, contentDigest: scenario.dataset.contentDigest },
    ]);
    expect(scenario.revision.lineage.changingObservations).toEqual([
      { recordId: 'comparison-fact:excavation-r2-actual', contentDigest: scenario.comparisonFact.contentDigest },
      { recordId: OUTCOME_ID, contentDigest: scenario.outcome.contentDigest },
    ]);
    // The metric fold selected EXACTLY the eligible row.
    expect(scenario.metricSet.selectedRowCount).toBe(1);
    expect(scenario.metricSet.foldDefinition.datasetRef.datasetId).toBe(scenario.dataset.datasetId);
    // The pack-scoped view is a pure projection over the same dataset.
    expect(scenario.packView.rows).toHaveLength(1);
    expect(scenario.packView.rows.every((r) => r.packRef.packId === 'construction.core')).toBe(true);
    // The learning state projection counts the governed history.
    expect(scenario.learningState).toMatchObject({
      candidateCount: 2,
      datasetCount: 1,
      revisionCount: 1,
      metricSetCount: 1,
      modelCount: 1,
    });
    // The learning event stream carries the full governed flow.
    expect(scenario.learningEvents.map((event) => event.payload.discriminator)).toEqual([
      'learning:record-intaken',
      'learning:record-intaken',
      'learning:dataset-assembled',
      'learning:revision-proposed',
      'learning:revision-admitted',
      'learning:metrics-folded',
      'learning:pack-view-projected',
      'learning:state-projected',
    ]);
  });

  // == M. role-specific authorized views =====================================
  it('role-specific authorized views are enforced (client vs engineer, with an audited denial)', () => {
    const [clientView, engineerView, clientDenied, engineerExport] = scenario.accessEvaluations;
    // Both program views released with the SAME canonical identity.
    expect(clientView?.outcome).toBe('released');
    expect(engineerView?.outcome).toBe('released');
    if (clientView?.outcome !== 'released' || engineerView?.outcome !== 'released') {
      throw new Error('unreachable: both program views are released');
    }
    expect(clientView.projection.objectId).toBe(engineerView.projection.objectId);
    expect(clientView.projection.objectDigest).toBe(engineerView.projection.objectDigest);
    // The engineer sees a strict superset of the client's released paths.
    const clientPaths = new Set(releasedPathsOf(clientView.projection));
    const engineerPaths = new Set(releasedPathsOf(engineerView.projection));
    expect(engineerPaths.size).toBeGreaterThan(clientPaths.size);
    for (const path of clientPaths) {
      expect(engineerPaths.has(path), `engineer superset contains ${path}`).toBe(true);
    }
    // The client's cost fields are REDACTED (commercial-sensitive)…
    const clientCostEntry = clientView.projection.entries.find(
      (entry) => entry.path === 'workPackages[0].activities[1].plannedCost.amount',
    );
    if (clientCostEntry?.kind !== 'redacted') {
      throw new Error(`unreachable: the client cost entry is redacted (got ${clientCostEntry?.kind})`);
    }
    expect(clientCostEntry.redactionClass).toBe('commercial-sensitive');
    // …and the engineer's are released with the real value.
    const engineerCostEntry = engineerView.projection.entries.find(
      (entry) => entry.path === 'workPackages[0].activities[1].plannedCost.amount',
    );
    if (engineerCostEntry?.kind !== 'released') {
      throw new Error(`unreachable: the engineer cost entry is released (got ${engineerCostEntry?.kind})`);
    }
    expect(engineerCostEntry.value).toBe('17850.00');
    // The denied values NEVER appear in the client's serialized view.
    expect(JSON.stringify(clientView.projection)).not.toContain('17850.00');
    // The client view projects the IMMUTABLE BASELINE program (the
    // milestone is 'planned' there) while the live programme projection
    // shows 'reached' — baseline vs live through authorized views.
    expect(releasedValueOf(clientView.projection, 'milestones[0].status')).toBe('planned');
    // The client has NO binding on the delivery-record: an AUDITED
    // fail-closed denial.
    expect(clientDenied?.outcome).toBe('denied');
    if (clientDenied?.outcome !== 'denied') {
      throw new Error('unreachable: the client delivery view is denied');
    }
    expect(clientDenied.denial.code).toBe('policy-binding-missing');
    expect(clientDenied.audit.outcome).toBe('denied');
    expect(clientDenied.audit.denialCode).toBe('policy-binding-missing');
    expect(clientDenied.audit.fieldsReleased).toEqual([]);
    // The engineer CAN export the closed delivery record.
    expect(engineerExport?.outcome).toBe('released');
    if (engineerExport?.outcome !== 'released') {
      throw new Error('unreachable: the engineer export is released');
    }
    expect(engineerExport.projection.objectClass).toBe('delivery-record');
    expect(engineerExport.projection.action).toBe('export');
    expect(releasedValueOf(engineerExport.projection, 'status')).toBe('closed');
    // The audit trail: 4 audits (3 released + 1 denied), all admitted.
    expect(scenario.accessAudits).toHaveLength(4);
    expect(scenario.accessAudits.filter((audit) => audit.outcome === 'released')).toHaveLength(3);
    expect(scenario.accessState).toMatchObject({
      policyCount: 1,
      recordCount: 2,
      projectionCount: 3,
      auditCount: 4,
      releasedAuditCount: 3,
      deniedAuditCount: 1,
    });
    expect(scenario.accessState.denialCounts).toEqual([{ code: 'policy-binding-missing', count: 1 }]);
    // Every audit cites the W009 decision digest (attributable + traceable).
    for (const audit of scenario.accessAudits) {
      expect(audit.decisionDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(audit.policyRef.policyDigest).toBe(scenario.accessPolicyDigest);
    }
    // The access event stream carries the full projection flow.
    expect(scenario.accessEvents.map((event) => event.payload.discriminator)).toEqual([
      'access-projection:policy-registered',
      'access-projection:record-admitted',
      'access-projection:record-admitted',
      'access-projection:projection-released',
      'access-projection:audit-recorded',
      'access-projection:projection-released',
      'access-projection:audit-recorded',
      'access-projection:projection-denied',
      'access-projection:audit-recorded',
      'access-projection:projection-released',
      'access-projection:audit-recorded',
      'access-projection:state-projected',
    ]);
  });

  // == N. cross-tenant denial (R12) ==========================================
  it('a cross-tenant observation is DENIED at the delivery intake (R12)', () => {
    const foreignObservation = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: 'observation:foreign-pit-volume',
        tenantId: OTHER_TENANT,
        subject: {
          solutionId: SOLUTION_ID,
          subjectKind: 'activity',
          subjectId: 'activity:excavation-bulk',
        },
        measure: { kind: 'quantity', value: '1', unit: 'm3' },
        payload: {
          deliveryId: DELIVERY_ID,
          observedAt: '2026-06-01T14:00:00.000Z',
          observedBy: 'principal:field-engineer',
          evidence: [],
        },
        recordedAt: '2026-06-01T14:00:00.000Z',
        recordedBy: 'principal:field-engineer',
        uncertainty: scenario.delivery.observations[0]?.uncertainty,
      } as unknown as Record<string, unknown>),
      'seal foreign observation',
    );
    expectCrossTenantDenied(
      recordObservation(scenario.delivery, foreignObservation),
      TENANT,
      OTHER_TENANT,
      'delivery observation intake',
    );
  });

  // == O. immutability + determinism + replay ================================
  it('the baseline is IMMUTABLE and the closed delivery cannot close again', () => {
    expectAuthorityRoutingRejected(
      reviseSolutionBaseline(scenario.approval, { note: 'attempted scope edit' }),
      'baseline-mutation-rejected',
      'baseline revision gate',
    );
    expectAuthorityRoutingRejected(
      closeDeliveryRecord(scenario.closedDelivery, { closedBy: 'principal:delivery-lead', closedAt: '2026-06-02T08:00:00.000Z' }),
      'lifecycle-conflict',
      'delivery close gate',
    );
  });

  it('the digest projection round-trips and the evidence chain replays from the W010 log', () => {
    const projection = deliveryLearningDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'delivery-learning projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // The W010 log holds the full delivery lifecycle stream and every
    // event verifies on read (the replayable evidence chain).
    const records = unwrap(scenario.log.readStream('stream:delivery-warehouse-extension-v1'), 'log readStream');
    expect(records).toHaveLength(scenario.events.length);
    expect(scenario.log.size).toBe(scenario.events.length);
    // The stage-entered events cover the eleven universal stages.
    const stageEvents = scenario.events.filter((event) => event.payload.discriminator === 'delivery:stage-entered');
    expect(stageEvents.map((event) => (event.payload.data as { stage: string }).stage)).toEqual([
      'understand', 'decide', 'plan', 'acquire', 'realize', 'observe',
      'actualize', 'verify', 'forecast', 'close', 'learn',
    ]);
    // The causal chain links every event to its predecessor.
    for (const [index, event] of scenario.events.entries()) {
      expect(event.sequence).toBe(index + 1);
      expect(event.causalParent?.sequence ?? null).toBe(index === 0 ? null : index);
    }
    // The supervision and learning streams keep their own contiguous
    // sequences (per-stream causality).
    for (const [index, event] of scenario.supervisionEvents.entries()) {
      expect(event.sequence).toBe(index + 1);
    }
    for (const [index, event] of scenario.learningEvents.entries()) {
      expect(event.sequence).toBe(index + 1);
    }
    for (const [index, event] of scenario.accessEvents.entries()) {
      expect(event.sequence).toBe(index + 1);
    }
  });
});

/** The eligible/excluded shape of a dataset (assertion helper). */
function datasetShape(scenario: DeliveryLearningScenario): { eligible: number; excluded: number } {
  return { eligible: scenario.dataset.rows.length, excluded: scenario.dataset.exclusions.length };
}
