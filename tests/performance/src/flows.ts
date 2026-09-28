// W034 — the INSTRUMENTED SUBJECT FLOWS: deterministic compositions over
// the REAL measurement subjects' public kernel APIs, wrapped with
// operation counters (test-only compositions — never kernel edits).
//
// COUNTING CONVENTIONS (docs/performance/counter-methodology.md):
// - `kernel-admission`   +1 per state-extending kernel API invocation
//   (admit / build / open / record / intake / apply);
// - `kernel-fold`        +N per fold invocation, N = records iterated
//   (the fold's documented input record count);
// - `projection-compute` +N per projection invocation, N = view rows
//   emitted (one computed output row per unit);
// - `digest-compute`     +N per digest-bearing invocation, N = sealed
//   records produced or verified (output-observable);
// - `harness-scenario`   +1 per harness driver-seam invocation
//   (begin / runStep / stateDigest — the runner's double-run replay
//   doubles these BY DESIGN).
//
// Every unit is observable at the composition seam (public API inputs
// and outputs); the counts are therefore deterministic functions of the
// workload — never time.
import {
  type CounterHub,
  type SealedWorkloadRecord,
  verifySealedWorkload,
} from '@epoch/performance';
import {
  admitDistinctionRecord,
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  foldCostSchedule,
  foldDeliveryActuals,
  foldDistinctionRecords,
  foldMilestoneSchedule,
  foldQuantitySchedule,
  foldRealizationVariants,
  foldResourceSchedule,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  verifySolutionVersionChain,
  projectNavigator,
  type BaselineApproval,
  type DistinctionLedger,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  applyActualization,
  currentAssessments,
  intakeObservation,
  openActualizationStore,
  type ActualizationStore,
  type SealedValidationAssessment,
} from '@epoch/actualization';
import {
  admitVarianceRecord,
  computeVariance,
  foldVarianceRecords,
  foldVarianceSummary,
  openVarianceLedger,
} from '@epoch/variance';
import { projectBoq, projectConstructionProgramme } from '@epoch/pack-construction';
import { projectBacklog, projectDeploymentPlan, projectRoadmap } from '@epoch/pack-software';
import { runScenario } from '@epoch/test-harness';
import {
  APPROVER,
  DELIVERY_ID,
  OBSERVER,
  PRINCIPAL,
  SOLUTION_ID,
  activityIdOf,
  applicationInstantOf,
  deliveryContentOf,
  need,
  observationContentOf,
  programContentOf,
  scenarioDefinitionOf,
  solutionContentOf,
  varianceInputOf,
  WORLD_ENTITIES,
} from './materialize';
import { createCountingDriver } from './harness-driver';

/** The deterministic summary of one flow run (sanity artifacts for tests). */
export interface FlowSummary {
  readonly subject: string;
  readonly solutionDigest: string | null;
  readonly programDigest: string | null;
  readonly deliveryDigest: string | null;
  readonly actualCount: number;
  readonly varianceCount: number;
  readonly navigatorRows: number;
}

// --------------------------------------------------------------------------------
// Subject 1: solution-admission (planLines N; CONSTANT counts — one
// admission path regardless of line count; catches per-line re-admission
// regressions).
// --------------------------------------------------------------------------------

export function runSolutionAdmissionFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  // The workload record itself verifies first (exact-revision check).
  need(verifySealedWorkload(workload), 'verify workload record');
  hub.tally('digest-compute', 1);

  const sealed = need(sealSolutionVersion(solutionContentOf(workload)), 'seal solution version');
  hub.tally('digest-compute', 1);
  const chain = need(admitSolutionVersion([], sealed), 'admit solution version');
  hub.tally('kernel-admission', 1);
  need(verifySolutionVersionChain(chain), 'verify solution version chain');
  hub.tally('digest-compute', chain.length);
  need(approveSolutionBaseline(sealed, baselineApprovalOf(sealed)), 'approve solution baseline');
  hub.tally('digest-compute', 1);
  return {
    subject: 'solution-admission',
    solutionDigest: sealed.contentDigest,
    programDigest: null,
    deliveryDigest: null,
    actualCount: 0,
    varianceCount: 0,
    navigatorRows: 0,
  };
}

function baselineApprovalOf(sealed: SealedSolutionVersion): BaselineApproval {
  return {
    schema: 'epoch.solution-delivery.baseline-approval',
    schemaVersion: 1,
    approvalId: 'approval:perf-scale-v1',
    solutionId: sealed.solutionId,
    tenantId: sealed.tenantId,
    version: sealed.version,
    baselineDigest: sealed.contentDigest,
    approvedBy: APPROVER,
    approvedAt: '2026-07-01T09:00:00.000Z',
    decisionNote: 'approved for performance scale measurement',
  };
}

// --------------------------------------------------------------------------------
// Subject 2: program-fold (planLines N; LINEAR kernel-fold — the five
// synchronized schedule folds iterate records proportional to N).
// --------------------------------------------------------------------------------

export function runProgramFoldFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  const sealed = need(sealSolutionVersion(solutionContentOf(workload)), 'seal solution version');
  hub.tally('digest-compute', 1);
  const program = need(buildProgramOfWork(programContentOf(workload, sealed)), 'build program of work');
  hub.tally('kernel-admission', 1);
  need(verifySealedProgramOfWork(program), 'verify sealed program of work');
  hub.tally('digest-compute', 1);

  // The five synchronized schedule folds (one fold invocation each; units
  // = the records the fold iterates — its documented input count).
  const activityCount = program.workPackages.reduce((total, wp) => total + wp.activities.length, 0);
  const resourceCount = program.workPackages.reduce(
    (total, wp) => total + wp.activities.reduce((inner, activity) => inner + activity.resources.length, 0),
    0,
  );
  foldQuantitySchedule(program);
  hub.tally('kernel-fold', activityCount);
  foldCostSchedule(program);
  hub.tally('kernel-fold', activityCount);
  foldResourceSchedule(program);
  hub.tally('kernel-fold', resourceCount);
  foldMilestoneSchedule(program);
  hub.tally('kernel-fold', program.milestones.length);
  foldRealizationVariants(program);
  hub.tally('kernel-fold', program.workPackages.length);

  return {
    subject: 'program-fold',
    solutionDigest: sealed.contentDigest,
    programDigest: program.contentDigest,
    deliveryDigest: null,
    actualCount: 0,
    varianceCount: 0,
    navigatorRows: 0,
  };
}

// --------------------------------------------------------------------------------
// Subject 3: pack-projection (packProjections P; LINEAR projection-compute
// — P projection computations over the same program, units = emitted
// view rows; the workload grammar pins planLines for this subject).
// --------------------------------------------------------------------------------

export function runPackProjectionFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  const sealed = need(sealSolutionVersion(solutionContentOf(workload)), 'seal solution version');
  hub.tally('digest-compute', 1);
  const program = need(buildProgramOfWork(programContentOf(workload, sealed)), 'build program of work');
  hub.tally('kernel-admission', 1);
  const delivery = need(openDeliveryRecord(deliveryContentOf(workload, sealed)), 'open delivery record');
  hub.tally('kernel-admission', 1);

  for (const request of workload.packProjections) {
    switch (request.surface) {
      case 'boq': {
        const boq = need(
          projectBoq({ solution: sealed, program, worldEntities: [...WORLD_ENTITIES] }),
          'project BOQ',
        );
        hub.tally('projection-compute', boq.lineItems.length);
        break;
      }
      case 'construction-programme': {
        const programme = need(projectConstructionProgramme(program), 'project construction programme');
        hub.tally('projection-compute', programme.activities.length + programme.milestones.length);
        break;
      }
      case 'roadmap': {
        const roadmap = need(projectRoadmap(program), 'project roadmap');
        hub.tally('projection-compute', roadmap.releases.length);
        break;
      }
      case 'backlog': {
        const backlog = need(projectBacklog({ program, delivery }), 'project backlog');
        hub.tally('projection-compute', backlog.issues.length + backlog.epics.length);
        break;
      }
      case 'deployment-plan': {
        const plan = need(projectDeploymentPlan({ program }), 'project deployment plan');
        hub.tally('projection-compute', plan.rolloutSteps.length);
        break;
      }
    }
  }

  return {
    subject: 'pack-projection',
    solutionDigest: sealed.contentDigest,
    programDigest: program.contentDigest,
    deliveryDigest: delivery.contentDigest,
    actualCount: 0,
    varianceCount: 0,
    navigatorRows: 0,
  };
}

// --------------------------------------------------------------------------------
// Subject 4: observation-stack (observations M; LINEAR — the full W036
// authority path: seal -> record -> intake -> assess -> apply, plus the
// distinction ledger and the delivery-actuals fold).
// --------------------------------------------------------------------------------

export function runObservationStackFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  const sealed = need(sealSolutionVersion(solutionContentOf(workload)), 'seal solution version');
  hub.tally('digest-compute', 1);
  let current = need(openDeliveryRecord(deliveryContentOf(workload, sealed)), 'open delivery record');
  hub.tally('kernel-admission', 1);

  // The observation authority path: seal each observation, record it into
  // the delivery (the immutable append path), admit it into the
  // distinction ledger.
  let ledger: DistinctionLedger = { tenantId: workload.tenantId, solutionId: SOLUTION_ID, records: [] };
  const observations = [];
  for (let index = 0; index < workload.observations.length; index += 1) {
    const observation = need(sealDistinctionRecord(observationContentOf(workload, index)), `seal observation ${index}`);
    hub.tally('digest-compute', 1);
    current = need(recordObservation(current, observation), `record observation ${index}`);
    hub.tally('kernel-admission', 1);
    ledger = need(admitDistinctionRecord(ledger, observation), `admit distinction ${index}`);
    hub.tally('kernel-admission', 1);
    observations.push(observation);
  }

  // The W039 actualization fold: intake -> assess -> apply per assessment.
  let store: ActualizationStore = openActualizationStore({
    tenantId: workload.tenantId,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
  });
  for (const observation of observations) {
    const intaken = need(intakeObservation(store, observation), `intake ${observation.recordId}`);
    hub.tally('kernel-admission', 1);
    store = intaken.store;
  }
  const assessments = need(currentAssessments(store, { mode: 'exact' }), 'current assessments');
  hub.tally('digest-compute', assessments.length);
  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    const applied = need(
      applyActualization(current, assessment, observations, {
        acceptedBy: APPROVER,
        acceptedAt: applicationInstantOf(workload),
        actualizedBy: PRINCIPAL,
        actualizedAt: applicationInstantOf(workload),
      }),
      `apply actualization ${assessment.assessmentId}`,
    );
    hub.tally('kernel-admission', 1);
    current = applied.delivery;
  }

  // The folds: the distinction ledger fold + the authoritative delivery
  // actuals fold (observations + actuals iterated).
  foldDistinctionRecords(ledger);
  hub.tally('kernel-fold', ledger.records.length);
  const actualsSummary = foldDeliveryActuals(current);
  hub.tally('kernel-fold', current.observations.length + current.actuals.length);
  need(verifySealedDeliveryRecord(current), 'verify final sealed delivery record');
  hub.tally('digest-compute', 1);

  return {
    subject: 'observation-stack',
    solutionDigest: sealed.contentDigest,
    programDigest: null,
    deliveryDigest: current.contentDigest,
    actualCount: actualsSummary.actualCount,
    varianceCount: 0,
    navigatorRows: 0,
  };
}

// --------------------------------------------------------------------------------
// Subject 5: variance-stack (observations M; LINEAR — M variance
// computations + admissions + the two folds).
// --------------------------------------------------------------------------------

export function runVarianceStackFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  let ledger = openVarianceLedger({ tenantId: workload.tenantId, solutionId: SOLUTION_ID });
  for (let index = 0; index < workload.observations.length; index += 1) {
    const variance = need(computeVariance(varianceInputOf(workload, index) as never), `compute variance ${index}`);
    hub.tally('digest-compute', 1);
    ledger = need(admitVarianceRecord(ledger, variance), `admit variance ${index}`);
    hub.tally('kernel-admission', 1);
  }
  const records = foldVarianceRecords(ledger);
  hub.tally('kernel-fold', ledger.records.length);
  const summary = foldVarianceSummary(ledger);
  hub.tally('kernel-fold', ledger.records.length);

  return {
    subject: 'variance-stack',
    solutionDigest: null,
    programDigest: null,
    deliveryDigest: null,
    actualCount: 0,
    varianceCount: records.length,
    navigatorRows: summary.length,
  };
}

// --------------------------------------------------------------------------------
// Subject 6: harness-scenario (scenarioSteps S; LINEAR harness-scenario —
// 2 runs x (begin + initial state digest + S x (runStep + state digest))).
// --------------------------------------------------------------------------------

export function runHarnessScenarioFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  const driver = createCountingDriver(hub);
  const outcome = runScenario(scenarioDefinitionOf(workload), driver);
  if (!outcome.ok) {
    throw new Error(`performance flow: harness scenario failed: ${JSON.stringify(outcome.error)}`);
  }
  if (!outcome.value.result.passed) {
    throw new Error(
      `performance flow: harness scenario did not pass its invariants: ${JSON.stringify(
        outcome.value.result.invariantResults.filter((finding) => !finding.satisfied),
      )}`,
    );
  }
  return {
    subject: 'harness-scenario',
    solutionDigest: null,
    programDigest: null,
    deliveryDigest: null,
    actualCount: 0,
    varianceCount: 0,
    navigatorRows: outcome.value.result.stepCount,
  };
}

// --------------------------------------------------------------------------------
// Subject 7 (composite): delivery-stack-composition (planLines N; the
// FULL stack at size — both packs' projections + the delivery spine +
// actualization + variance + the navigator + the harness scenario).
// Grammar: observations = ceil(N/8), packProjections = 5 (one full
// surface cycle), scenarioSteps = 16.
// --------------------------------------------------------------------------------

export function runDeliveryStackCompositionFlow(hub: CounterHub, workload: SealedWorkloadRecord): FlowSummary {
  // The W036 spine.
  const sealed = need(sealSolutionVersion(solutionContentOf(workload)), 'seal solution version');
  hub.tally('digest-compute', 1);
  const chain = need(admitSolutionVersion([], sealed), 'admit solution version');
  hub.tally('kernel-admission', 1);
  const approval = need(approveSolutionBaseline(sealed, baselineApprovalOf(sealed)), 'approve baseline').approval;
  const program = need(buildProgramOfWork(programContentOf(workload, sealed)), 'build program');
  hub.tally('kernel-admission', 1);
  let delivery = need(openDeliveryRecord(deliveryContentOf(workload, sealed)), 'open delivery');
  hub.tally('kernel-admission', 1);

  // BOTH packs' projections (one full surface cycle) + the navigator.
  let projectionRows = 0;
  for (const request of workload.packProjections) {
    switch (request.surface) {
      case 'boq': {
        const boq = need(projectBoq({ solution: sealed, program, worldEntities: [...WORLD_ENTITIES] }), 'project BOQ');
        hub.tally('projection-compute', boq.lineItems.length);
        projectionRows += boq.lineItems.length;
        break;
      }
      case 'construction-programme': {
        const programme = need(projectConstructionProgramme(program), 'project programme');
        hub.tally('projection-compute', programme.activities.length + programme.milestones.length);
        projectionRows += programme.activities.length + programme.milestones.length;
        break;
      }
      case 'roadmap': {
        const roadmap = need(projectRoadmap(program), 'project roadmap');
        hub.tally('projection-compute', roadmap.releases.length);
        projectionRows += roadmap.releases.length;
        break;
      }
      case 'backlog': {
        const backlog = need(projectBacklog({ program, delivery }), 'project backlog');
        hub.tally('projection-compute', backlog.issues.length + backlog.epics.length);
        projectionRows += backlog.issues.length + backlog.epics.length;
        break;
      }
      case 'deployment-plan': {
        const plan = need(projectDeploymentPlan({ program }), 'project deployment plan');
        hub.tally('projection-compute', plan.rolloutSteps.length);
        projectionRows += plan.rolloutSteps.length;
        break;
      }
    }
  }

  // The observation authority path + actualization.
  const observations = [];
  for (let index = 0; index < workload.observations.length; index += 1) {
    const observation = need(sealDistinctionRecord(observationContentOf(workload, index)), `seal observation ${index}`);
    hub.tally('digest-compute', 1);
    delivery = need(recordObservation(delivery, observation), `record observation ${index}`);
    hub.tally('kernel-admission', 1);
    observations.push(observation);
  }
  let store: ActualizationStore = openActualizationStore({
    tenantId: workload.tenantId,
    solutionId: SOLUTION_ID,
    deliveryId: DELIVERY_ID,
  });
  for (const observation of observations) {
    const intaken = need(intakeObservation(store, observation), `intake ${observation.recordId}`);
    hub.tally('kernel-admission', 1);
    store = intaken.store;
  }
  const assessments: readonly SealedValidationAssessment[] = need(
    currentAssessments(store, { mode: 'exact' }),
    'current assessments',
  );
  hub.tally('digest-compute', assessments.length);
  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    const applied = need(
      applyActualization(delivery, assessment, observations, {
        acceptedBy: APPROVER,
        acceptedAt: applicationInstantOf(workload),
        actualizedBy: PRINCIPAL,
        actualizedAt: applicationInstantOf(workload),
      }),
      `apply actualization ${assessment.assessmentId}`,
    );
    hub.tally('kernel-admission', 1);
    delivery = applied.delivery;
  }

  // The variance layer.
  let varianceLedger = openVarianceLedger({ tenantId: workload.tenantId, solutionId: SOLUTION_ID });
  for (let index = 0; index < workload.observations.length; index += 1) {
    const variance = need(computeVariance(varianceInputOf(workload, index) as never), `compute variance ${index}`);
    hub.tally('digest-compute', 1);
    varianceLedger = need(admitVarianceRecord(varianceLedger, variance), `admit variance ${index}`);
    hub.tally('kernel-admission', 1);
  }

  // The folds + the navigator projection over the full stack.
  const activityCount = program.workPackages.reduce((total, wp) => total + wp.activities.length, 0);
  const resourceCount = program.workPackages.reduce(
    (total, wp) => total + wp.activities.reduce((inner, activity) => inner + activity.resources.length, 0),
    0,
  );
  foldQuantitySchedule(program);
  hub.tally('kernel-fold', activityCount);
  foldCostSchedule(program);
  hub.tally('kernel-fold', activityCount);
  foldResourceSchedule(program);
  hub.tally('kernel-fold', resourceCount);
  foldMilestoneSchedule(program);
  hub.tally('kernel-fold', program.milestones.length);
  foldRealizationVariants(program);
  hub.tally('kernel-fold', program.workPackages.length);
  foldVarianceRecords(varianceLedger);
  hub.tally('kernel-fold', varianceLedger.records.length);
  foldVarianceSummary(varianceLedger);
  hub.tally('kernel-fold', varianceLedger.records.length);
  const actualsSummary = foldDeliveryActuals(delivery);
  hub.tally('kernel-fold', delivery.observations.length + delivery.actuals.length);

  const navigator = need(
    projectNavigator({ solutionChain: chain, approvals: [approval], program, delivery }),
    'project navigator',
  );
  const navigatorRows =
    navigator.solution.length +
    navigator.worldView.length +
    navigator.programOfWork.length +
    navigator.schedule.quantity.rows.length +
    navigator.schedule.cost.rows.length +
    navigator.schedule.resource.rows.length +
    navigator.schedule.milestone.rows.length +
    navigator.observations.length +
    navigator.actuals.length;
  hub.tally('projection-compute', navigatorRows);

  // The harness scenario (fixed 16 steps in the composition grammar).
  const driver = createCountingDriver(hub);
  const outcome = runScenario(scenarioDefinitionOf(workload), driver);
  if (!outcome.ok || !outcome.value.result.passed) {
    throw new Error('performance flow: composition harness scenario failed');
  }

  need(verifySealedDeliveryRecord(delivery), 'verify final delivery');
  hub.tally('digest-compute', 1);

  return {
    subject: 'delivery-stack-composition',
    solutionDigest: sealed.contentDigest,
    programDigest: program.contentDigest,
    deliveryDigest: delivery.contentDigest,
    actualCount: actualsSummary.actualCount,
    varianceCount: varianceLedger.records.length,
    navigatorRows: projectionRows + navigatorRows,
  };
}

// --------------------------------------------------------------------------------
// Subject 8: distinction-refold — the fold-discipline subject. The
// BATCHED mode (fold once after all admissions) is the correct
// composition; the INFLATED mode (re-fold after EVERY admission) is the
// deliberate composition regression — the quadratic signature the
// regression gate must catch. Both modes measure the same subject; the
// budget declares the expected (linear) composition.
// --------------------------------------------------------------------------------

export type RefoldMode = 'batched' | 'inflated';

export function runRefoldFlow(hub: CounterHub, workload: SealedWorkloadRecord, mode: RefoldMode): FlowSummary {
  let ledger: DistinctionLedger = { tenantId: workload.tenantId, solutionId: SOLUTION_ID, records: [] };
  for (let index = 0; index < workload.observations.length; index += 1) {
    const observation = need(sealDistinctionRecord(observationContentOf(workload, index)), `seal observation ${index}`);
    hub.tally('digest-compute', 1);
    ledger = need(admitDistinctionRecord(ledger, observation), `admit distinction ${index}`);
    hub.tally('kernel-admission', 1);
    if (mode === 'inflated') {
      // The regression: re-fold the ENTIRE ledger after every admission.
      foldDistinctionRecords(ledger);
      hub.tally('kernel-fold', ledger.records.length);
    }
  }
  if (mode === 'batched') {
    // The correct discipline: one fold over the completed ledger.
    foldDistinctionRecords(ledger);
    hub.tally('kernel-fold', ledger.records.length);
  }
  return {
    subject: 'distinction-refold',
    solutionDigest: null,
    programDigest: null,
    deliveryDigest: null,
    actualCount: 0,
    varianceCount: 0,
    navigatorRows: 0,
  };
}

/** The subject-flow registry (the named measurement subjects). */
export const SUBJECT_FLOWS = {
  'solution-admission': runSolutionAdmissionFlow,
  'program-fold': runProgramFoldFlow,
  'pack-projection': runPackProjectionFlow,
  'observation-stack': runObservationStackFlow,
  'variance-stack': runVarianceStackFlow,
  'harness-scenario': runHarnessScenarioFlow,
  'delivery-stack-composition': runDeliveryStackCompositionFlow,
} as const;

export type SubjectFlowName = keyof typeof SUBJECT_FLOWS;

/** The observer principal (exported for the driver parity note). */
export const FLOW_OBSERVER = OBSERVER;

/** The activity id helper re-export (flow-parity note). */
export const FLOW_ACTIVITY_ID_OF = activityIdOf;
