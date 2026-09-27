// W031 Reference E2E slice 2 — the SOFTWARE DELIVERY scenario definition.
//
// The software path, traversed end-to-end through REAL kernels:
//
//   W027 pack profile
//     -> W036 solution version -> baseline approval
//     -> W036 program of work
//     -> W027 roadmap projection (milestone-identity releases)
//     -> W027 backlog projection (work-package/issue identity)
//     -> W038 execution events (the realization stream)
//     -> W036 observation intake (the delivery authority path)
//     -> W039 actualization fold
//     -> W039 forecast revisions (APPEND-ONLY: each revision refines the
//        exact digest of its predecessor; prior digests never change)
//
// DETERMINISM: same discipline as slice 1 — fixed instants, explicit ids,
// pure kernels. Running twice yields byte-identical digests (asserted by
// the slice test via softwareDeliveryDigestProjection).
import {
  admitSoftwarePackProfile,
  digestPackProfile,
  projectBacklog,
  projectRoadmap,
  softwarePackProfile,
  verifyRoadmapView,
  type BacklogView,
  type RoadmapView,
} from '@epoch/pack-software';
import {
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  openDeliveryRecord,
  recordObservation,
  sealSolutionVersion,
  verifySealedDeliveryRecord,
  type DistinctionLedger,
  type SealedDeliveryRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  admitTrackingState,
  buildProgramIndex,
  intakeFieldObservation,
  openExecutionTrackingStore,
  projectExecutionState,
  sealExecutionEvent,
  sealTrackingStateRecord,
  verifySealedExecutionEvent,
  type ExecutionStateProjection,
  type ExecutionTrackingStore,
  type SealedExecutionEvent,
} from '@epoch/execution-tracking';
import {
  admitForecastRevision,
  applyActualization,
  currentAssessments,
  intakeObservation,
  openActualizationStore,
  rollForecast,
  type ActualizationStore,
  type RollingForecastDetail,
  type SealedValidationAssessment,
} from '@epoch/actualization';
import { type JsonValue } from '@epoch/action-policy';
import { EventLog, sealEvent, type EventContent } from '@epoch/event-log';
import {
  APPROVER,
  CHIEF_ARCHITECT,
  PLATFORM_ENGINEER,
  PRINCIPAL,
  T,
  TENANT,
  derivedUncertainty,
  uncertainty,
} from './shared';

// --------------------------------------------------------------------------------
// Scenario vocabulary.
// --------------------------------------------------------------------------------

export const SOFTWARE_SOLUTION_ID = 'solution:checkout-service';
export const SOFTWARE_PROGRAM_ID = 'program:checkout-service-v1';
export const SOFTWARE_DELIVERY_ID = 'delivery:checkout-service-v1';
export const SOFTWARE_STREAM_ID = 'stream:delivery-checkout-v1';

export const LINE_CHECKOUT_UI = 'line:checkout-ui';
export const LINE_DATA_MIGRATION = 'line:data-migration';

export const WORK_PACKAGE_RELEASE = 'work-package:release-rollout';
export const WORK_PACKAGE_MIGRATION = 'work-package:data-migration';
export const ACTIVITY_DEPLOY_STAGING = 'activity:deploy-staging';
export const ACTIVITY_MIGRATE_ORDERS = 'activity:migrate-orders';
export const MILESTONE_STAGING = 'milestone:staging-release';
export const MILESTONE_PRODUCTION = 'milestone:production-release';

export const SOFTWARE_CAPTURE_KEY = 'staging-deploy-monday';
export const SOFTWARE_OBSERVATION_ID = `observation:field-${SOFTWARE_CAPTURE_KEY}`;
export const SOFTWARE_ACTUAL_ID = `actual:field-${SOFTWARE_CAPTURE_KEY}`;
export const FORECAST_R1_ID = 'forecast:checkout-release-r1';
export const FORECAST_R2_ID = 'forecast:checkout-release-r2';

/** Unwrap helper: scenario builders fail LOUDLY on impossible admissions. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`software-delivery scenario: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// --------------------------------------------------------------------------------
// The scenario result.
// --------------------------------------------------------------------------------

export interface SoftwareDeliveryScenario {
  /** The admitted W027 software pack profile digest. */
  readonly packProfileDigest: string;
  /** The sealed solution version. */
  readonly solution: SealedSolutionVersion;
  /** The sealed program of work. */
  readonly program: SealedProgramOfWork;
  /** The W027 roadmap projection (milestone-identity releases). */
  readonly roadmap: RoadmapView;
  /** The W027 backlog projection (work-package/issue identity). */
  readonly backlog: BacklogView;
  /** The final sealed delivery record (after actualization). */
  readonly delivery: SealedDeliveryRecord;
  /** The W038 execution tracking store. */
  readonly tracking: ExecutionTrackingStore;
  /** The sealed W038 execution events (the realization stream). */
  readonly executionEvents: readonly SealedExecutionEvent[];
  /** The supervision-visible execution state projection. */
  readonly executionState: ExecutionStateProjection;
  /** The W039 actualization store. */
  readonly actualization: ActualizationStore;
  /** The W039 validation assessments. */
  readonly assessments: readonly SealedValidationAssessment[];
  /** The first rolling-forecast revision (append-only lineage root). */
  readonly forecastR1: RollingForecastDetail;
  /** The forecast ledger (both revisions, append-only). */
  readonly forecastLedger: DistinctionLedger;
  /** The second rolling-forecast revision (refines r1's exact digest). */
  readonly forecastR2: RollingForecastDetail;
  /** The W010 event stream of the software delivery lifecycle. */
  readonly events: readonly EventContent[];
  /** The event log holding the stream. */
  readonly log: EventLog;
}

// --------------------------------------------------------------------------------
// Content builders.
// --------------------------------------------------------------------------------

function softwareSolutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: SOFTWARE_SOLUTION_ID,
    version: '1.0.0',
    tenantId: TENANT,
    title: 'Checkout service',
    description: 'Checkout service release unit: web UI and order data migration',
    objective: 'Deliver the checkout service release unit to production',
    solutionLines: [
      {
        lineId: LINE_CHECKOUT_UI,
        title: 'Checkout web UI',
        description: 'The checkout user interface delivered as a deployable web frontend',
        quantity: { value: '24', unit: 'deliverable' },
        unitCost: { amount: '620.00', currency: 'EUR' },
        worldEntityId: 'service-checkout',
        acquisitionVariant: 'cloud-service-provisioning',
      },
      {
        lineId: LINE_DATA_MIGRATION,
        title: 'Order data migration',
        quantity: { value: '1', unit: 'deliverable' },
        unitCost: { amount: '12000.00', currency: 'EUR' },
        worldEntityId: 'repository-checkout',
        acquisitionVariant: 'specialist-capability-assignment',
      },
    ],
    worldReferences: [
      { entityId: 'repository-checkout' },
      { entityId: 'service-checkout' },
    ],
    constraintReferences: [],
    previousVersionDigest: null,
    createdAt: T[0],
    createdBy: PRINCIPAL,
  };
}

function softwareProgramContent(sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: SOFTWARE_PROGRAM_ID,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Checkout service programme',
    workPackages: [
      {
        workPackageId: WORK_PACKAGE_MIGRATION,
        title: 'Order data migration',
        description: 'Migrate historical orders onto the new schema',
        solutionLineId: LINE_DATA_MIGRATION,
        worldEntityId: 'repository-checkout',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[5],
        plannedFinish: T[8],
        responsibleActor: CHIEF_ARCHITECT,
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [],
        activities: [
          {
            activityId: ACTIVITY_MIGRATE_ORDERS,
            workPackageId: WORK_PACKAGE_MIGRATION,
            title: 'Migrate orders',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '1', unit: 'deliverable' },
            plannedCost: { amount: '12000.00', currency: 'EUR' },
            plannedStart: T[5],
            plannedFinish: T[8],
            predecessors: [],
            successors: [],
            resources: [],
            responsibleActor: CHIEF_ARCHITECT,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
        ],
      },
      {
        workPackageId: WORK_PACKAGE_RELEASE,
        title: 'Release rollout',
        description: 'Deploy the checkout service through staging to production',
        solutionLineId: LINE_CHECKOUT_UI,
        worldEntityId: 'service-checkout',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[3],
        plannedFinish: T[8],
        responsibleActor: PLATFORM_ENGINEER,
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [
          {
            gateId: 'gate:staging-smoke',
            activityId: ACTIVITY_DEPLOY_STAGING,
            title: 'Staging smoke test',
            method: 'software.verify.smoke-test',
            criteria: 'All checkout paths return success on staging',
            evidence: [],
          },
        ],
        activities: [
          {
            activityId: ACTIVITY_DEPLOY_STAGING,
            workPackageId: WORK_PACKAGE_RELEASE,
            title: 'Deploy to staging',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '24', unit: 'deliverable' },
            plannedCost: { amount: '14880.00', currency: 'EUR' },
            plannedStart: T[3],
            plannedFinish: T[5],
            predecessors: [],
            successors: [],
            resources: [],
            responsibleActor: PLATFORM_ENGINEER,
            constraintReferences: [],
            actualProgress: 0.75,
            actualStart: T[4],
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [
      {
        milestoneId: MILESTONE_PRODUCTION,
        title: 'Production release',
        targetDate: T[8],
        activityIds: [ACTIVITY_MIGRATE_ORDERS],
        status: 'planned',
        evidence: [],
      },
      {
        milestoneId: MILESTONE_STAGING,
        title: 'Staging release',
        targetDate: T[5],
        activityIds: [ACTIVITY_DEPLOY_STAGING],
        status: 'reached',
        reachedAt: T[5],
        evidence: [],
      },
    ],
    createdAt: T[1],
    createdBy: PRINCIPAL,
  };
}

function softwareFieldCapture(): Record<string, unknown> {
  return {
    captureKey: SOFTWARE_CAPTURE_KEY,
    tenantId: TENANT,
    solutionId: SOFTWARE_SOLUTION_ID,
    deliveryId: SOFTWARE_DELIVERY_ID,
    observedAt: T[6],
    observedBy: PLATFORM_ENGINEER,
    subjectRef: { kind: 'activity', id: ACTIVITY_DEPLOY_STAGING },
    measure: { kind: 'quantity', value: '18', unit: 'deliverable' },
    uncertainty: uncertainty({
      provenance: { kind: 'observed', sourceRef: 'source:delivery-pipeline', actor: PLATFORM_ENGINEER },
    }),
  };
}

// --------------------------------------------------------------------------------
// The scenario runner.
// --------------------------------------------------------------------------------

export function runSoftwareDeliveryScenario(): SoftwareDeliveryScenario {
  // -- W027: the software pack profile (admitted through the W036 gate).
  const profile = softwarePackProfile(TENANT);
  const admittedProfile = need(admitSoftwarePackProfile(profile), 'admit software pack profile');
  const packProfileDigest = digestPackProfile(admittedProfile);

  // -- W036: solution -> baseline -> program of work.
  const solution = need(sealSolutionVersion(softwareSolutionContent()), 'seal solution version');
  need(admitSolutionVersion([], solution), 'admit solution version');
  need(
    approveSolutionBaseline(solution, {
      schema: 'epoch.solution-delivery.baseline-approval',
      schemaVersion: 1,
      approvalId: 'approval:checkout-baseline-v1',
      solutionId: SOFTWARE_SOLUTION_ID,
      tenantId: TENANT,
      version: solution.version,
      baselineDigest: solution.contentDigest,
      approvedBy: APPROVER,
      approvedAt: T[2],
      decisionNote: 'approved after architecture review',
    }),
    'approve solution baseline',
  );
  const program = need(buildProgramOfWork(softwareProgramContent(solution)), 'build program of work');

  // -- W027: the roadmap projection (milestone-identity releases) + the
  //    backlog projection (work-package/issue identity).
  const roadmap = need(projectRoadmap(program), 'project roadmap');
  need(verifyRoadmapView(roadmap), 'verify roadmap view');

  // -- W036: the delivery record (opened before the observation intake).
  let delivery = need(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: SOFTWARE_DELIVERY_ID,
      tenantId: TENANT,
      solutionId: SOFTWARE_SOLUTION_ID,
      solutionVersion: solution.version,
      solutionVersionDigest: solution.contentDigest,
      openedAt: T[2],
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    }),
    'open delivery record',
  );

  // -- W038: the execution tracking store + the field intake + the
  //    execution-event stream (the realization record).
  const programIndex = need(buildProgramIndex(program), 'build program index');
  let tracking = need(
    openExecutionTrackingStore({ tenantId: TENANT, solutionId: SOFTWARE_SOLUTION_ID, programIndex }),
    'open execution tracking store',
  );
  const intake = need(intakeFieldObservation(tracking, softwareFieldCapture()), 'intake field observation');
  tracking = intake.store;
  const observation = intake.observation.record;

  const trackingAdmission = need(
    admitTrackingState(
      tracking,
      need(sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:release-rollout-started',
        tenantId: TENANT,
        solutionId: SOFTWARE_SOLUTION_ID,
        subject: { workPackageId: WORK_PACKAGE_RELEASE },
        fromState: 'not-started',
        toState: 'in-progress',
        cause: 'staging deployment authorized and running',
        observedAt: T[4],
        recordedAt: T[4],
        recordedBy: PLATFORM_ENGINEER,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }), 'seal tracking state record'),
    ),
    'admit tracking state',
  );
  tracking = trackingAdmission.store;

  // The W038 execution events: one tracking-recorded + one
  // observation-recorded, causally chained (the digest chain).
  const executionEvents: SealedExecutionEvent[] = [];
  const EXECUTION_STREAM = 'stream:execution-release-rollout';
  const sealExecution = (sequence: number, discriminator: string, data: Record<string, JsonValue>, occurredAt: string): void => {
    const sealed = need(
      sealExecutionEvent({
        schemaVersion: 1,
        streamId: EXECUTION_STREAM,
        sequence,
        tenantId: TENANT,
        actor: PLATFORM_ENGINEER,
        causalParent: sequence === 1 ? null : { streamId: EXECUTION_STREAM, sequence: sequence - 1 },
        payload: { discriminator, data },
        occurredAt,
      }),
      `seal execution event ${sequence}`,
    );
    need(verifySealedExecutionEvent(sealed), `verify execution event ${sequence}`);
    executionEvents.push(sealed);
  };
  sealExecution(
    1,
    'execution:tracking-recorded',
    {
      workPackageId: WORK_PACKAGE_RELEASE,
      trackingRecordId: trackingAdmission.record.recordId,
      fromState: 'not-started',
      toState: 'in-progress',
      observedAt: T[4],
    },
    T[4],
  );
  sealExecution(
    2,
    'execution:observation-recorded',
    {
      workPackageId: intake.linkedWorkPackageId,
      deliveryId: SOFTWARE_DELIVERY_ID,
      observationId: observation.recordId,
      subjectKind: observation.subject.subjectKind,
      measureKind: observation.measure.kind,
      observedAt: T[6],
    },
    T[6],
  );

  // -- W036: the observation intake through the delivery authority path.
  const recorded = need(recordObservation(delivery, observation), 'record observation');
  delivery = recorded;

  // -- W039: validation + the actualization fold (drives the REAL W036
  //    acceptance/actualization path internally).
  let actualization = openActualizationStore({
    tenantId: TENANT,
    solutionId: SOFTWARE_SOLUTION_ID,
    deliveryId: SOFTWARE_DELIVERY_ID,
  });
  const intaken = need(intakeObservation(actualization, observation), 'intake observation (actualization)');
  actualization = intaken.store;
  const policy = { mode: 'exact' as const };
  const assessments = need(currentAssessments(actualization, policy), 'current assessments');
  for (const assessment of [...assessments].sort((a, b) => (a.assessmentId < b.assessmentId ? -1 : 1))) {
    const observations = assessment.observationRefs.map((ref) =>
      actualization.observations.find((candidate) => candidate.recordId === ref.recordId)!,
    );
    const applied = need(
      applyActualization(delivery, assessment, observations, {
        acceptedBy: APPROVER,
        acceptedAt: T[7],
        actualizedBy: PRINCIPAL,
        actualizedAt: T[7],
      }),
      `apply actualization (${assessment.assessmentId})`,
    );
    delivery = applied.delivery;
  }
  need(verifySealedDeliveryRecord(delivery), 'verify final sealed delivery record');

  // -- W027: the backlog projection over the delivery (post-actualization:
  //    the issue rows link the observation + actual ids).
  const backlog = need(projectBacklog({ program, delivery }), 'project backlog');

  // -- W039: the rolling forecasts (APPEND-ONLY revisions).
  const forecastSubject = {
    solutionId: SOFTWARE_SOLUTION_ID,
    subjectKind: 'work-package' as const,
    subjectId: WORK_PACKAGE_RELEASE,
  };
  const forecastR1 = need(
    rollForecast({
      recordId: FORECAST_R1_ID,
      tenantId: TENANT,
      subject: forecastSubject,
      planned: { kind: 'quantity', value: '24', unit: 'deliverable' },
      actualsToDate: { kind: 'quantity', value: '18', unit: 'deliverable' },
      performanceFactor: '1',
      asOf: T[7],
      refines: null,
      recordedAt: T[7],
      recordedBy: PLATFORM_ENGINEER,
      uncertainty: derivedUncertainty(),
    }),
    'roll forecast r1',
  );
  let ledger: DistinctionLedger = need(
    admitForecastRevision(
      { tenantId: TENANT, solutionId: SOFTWARE_SOLUTION_ID, records: [] },
      forecastR1.record,
    ),
    'admit forecast r1',
  );
  const forecastR2 = need(
    rollForecast({
      recordId: FORECAST_R2_ID,
      tenantId: TENANT,
      subject: forecastSubject,
      planned: { kind: 'quantity', value: '24', unit: 'deliverable' },
      actualsToDate: { kind: 'quantity', value: '18', unit: 'deliverable' },
      performanceFactor: '1.5',
      asOf: T[8],
      refines: { recordId: FORECAST_R1_ID, contentDigest: forecastR1.record.contentDigest },
      recordedAt: T[8],
      recordedBy: PLATFORM_ENGINEER,
      uncertainty: derivedUncertainty(),
    }),
    'roll forecast r2',
  );
  ledger = need(admitForecastRevision(ledger, forecastR2.record), 'admit forecast r2');

  // -- The supervision-visible execution state.
  const executionState = projectExecutionState(tracking);

  // -- The W010 event stream of the software delivery lifecycle.
  const events: EventContent[] = [];
  let sequence = 0;
  const emit = (discriminator: string, data: Record<string, JsonValue>, occurredAt: string, actor: string): void => {
    sequence += 1;
    events.push({
      schemaVersion: 1,
      streamId: SOFTWARE_STREAM_ID,
      sequence,
      tenantId: TENANT,
      actor,
      causalParent: sequence === 1 ? null : { streamId: SOFTWARE_STREAM_ID, sequence: sequence - 1 },
      payload: { discriminator, data },
      occurredAt,
    });
  };
  emit('delivery:solution-sealed', { solutionId: SOFTWARE_SOLUTION_ID, version: solution.version, contentDigest: solution.contentDigest }, T[1], PRINCIPAL);
  emit('delivery:program-built', { programId: SOFTWARE_PROGRAM_ID, contentDigest: program.contentDigest }, T[2], PRINCIPAL);
  emit('delivery:milestone-reached', { milestoneId: MILESTONE_STAGING, releaseId: MILESTONE_STAGING }, T[5], PLATFORM_ENGINEER);
  emit('delivery:observation-recorded', { observationId: observation.recordId, contentDigest: observation.contentDigest }, T[6], PLATFORM_ENGINEER);
  emit('delivery:actualization-applied', { deliveryDigest: delivery.contentDigest, actualIds: delivery.actuals.map((actual) => actual.recordId).sort() }, T[7], PRINCIPAL);
  emit('delivery:forecast-revised', { forecastRecordId: FORECAST_R1_ID, contentDigest: forecastR1.record.contentDigest, refines: null }, T[7], PLATFORM_ENGINEER);
  emit('delivery:forecast-revised', { forecastRecordId: FORECAST_R2_ID, contentDigest: forecastR2.record.contentDigest, refines: FORECAST_R1_ID }, T[8], PLATFORM_ENGINEER);

  const log = new EventLog({ expectedTenantId: TENANT });
  for (const event of events) {
    const sealed = need(sealEvent(event), `seal lifecycle event ${event.sequence}`);
    need(log.appendEvent(sealed), `append lifecycle event ${event.sequence}`);
  }

  return {
    packProfileDigest,
    solution,
    program,
    roadmap,
    backlog,
    delivery,
    tracking,
    executionEvents,
    executionState,
    actualization,
    assessments,
    forecastR1,
    forecastR2,
    forecastLedger: ledger,
    events,
    log,
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence).
// --------------------------------------------------------------------------------

export function softwareDeliveryDigestProjection(
  scenario: SoftwareDeliveryScenario,
): Record<string, string | readonly string[]> {
  return {
    packProfileDigest: scenario.packProfileDigest,
    solutionDigest: scenario.solution.contentDigest,
    programDigest: scenario.program.contentDigest,
    roadmapDigest: scenario.roadmap.contentDigest,
    backlogDigest: scenario.backlog.contentDigest,
    observationDigests: [...scenario.delivery.observations]
      .map((observation) => observation.contentDigest)
      .sort(),
    deliveryDigest: scenario.delivery.contentDigest,
    actualDigests: [...scenario.delivery.actuals].map((actual) => actual.contentDigest).sort(),
    executionEventDigests: scenario.executionEvents.map((event) => event.contentDigest),
    forecastR1Digest: scenario.forecastR1.record.contentDigest,
    forecastR2Digest: scenario.forecastR2.record.contentDigest,
    forecastR2Refines: (scenario.forecastR2.record.payload as { refines: string | null }).refines ?? 'none',
  };
}
