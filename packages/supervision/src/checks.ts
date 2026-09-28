/**
 * THE SIX CHECK FAMILIES (the W043 "must provide" list) — every one a
 * PURE function of sealed inputs to typed findings. Supervision is
 * READ-ONLY over delivery state: no check mutates the program, the
 * delivery, a gate or an issue; schedule authority stays in W036.
 *
 * 1. `checkPlannedVsActual` — planned dates/progress vs actual state:
 *    due (in the plan window), drifted (forecast/late-start deviation),
 *    late (plan finish passed without completion), blocked (impediment),
 *    plus missed milestones (W036 milestone status).
 * 2. `checkCriticalPath` — a typed CPM traversal (forward/backward pass
 *    over planned durations, zero-float criticality): critical-path
 *    drift findings carry the transitive downstream impact; prerequisite
 *    checks flag started-without-completed-predecessor (blocked) and
 *    threatened in-window starts (due).
 * 3. `checkLeadTimeRisk` — W037-shaped lead-time observations vs the
 *    prerequisite need instant: a realistic lead time that cannot reach
 *    `requiredBy` is a typed risk finding with the exact shortfall.
 * 4. `checkConsumptionAnomalies` — typed threshold rules over the W036
 *    foldDeliveryActuals shapes against the planned folds: breach class
 *    + magnitude (planned/actual/threshold values, signed variance).
 * 5. `checkVerificationFailures` — W036 VerificationGate + W038 issue
 *    summaries surface as findings (overdue unpassed gates; open
 *    defects) — never mutations of the gate.
 * 6. `checkUnresolvedUnknowns` — W036 DecisionImpact-material
 *    info-requests unresolved past their freshness requirements.
 *
 * Determinism: every family iterates canonically sorted subjects,
 * derives finding ids from (class, subject), and emits findings in
 * (findingClass, findingId) order. Identical inputs produce identical
 * findings, hence identical digests (replay-safe).
 */
import type { SealedDeliveryRecord, SealedProgramOfWork, Activity } from '@epoch/solution-delivery';
import {
  foldCostSchedule,
  foldDeliveryActuals,
  foldQuantitySchedule,
} from '@epoch/solution-delivery';
import type { InformationAcquisitionRequest } from '@epoch/solution-delivery';
import type { ExecutionIssueSummary, LeadTimeRiskInput, SupervisionThresholds } from './inputs';
import type {
  FindingMeasures,
  FindingSubject,
  SupervisionFindingContent,
} from './findings';
import { deriveFindingId } from './findings';
import { SUPERVISION_CONTRACT_VERSION } from './version';
import type { FindingClass, FindingStatus, ProvenanceReferenceKind } from './version';
import {
  compareNonNegativeDecimals,
  multiplyNonNegativeDecimals,
  signedDecimalSubtraction,
  subtractNonNegativeDecimals,
} from './decimal';
import { dayDifference, instantToEpochMs } from './instant';

/** The shared context every check family folds over. */
export interface SupervisionCheckContext {
  readonly program: SealedProgramOfWork;
  readonly delivery: SealedDeliveryRecord;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly programId: string;
  readonly deliveryId: string;
  readonly evaluatedAt: string;
  readonly evaluatedBy: string;
  readonly thresholds: SupervisionThresholds;
  readonly executionIssues: readonly ExecutionIssueSummary[];
  readonly leadTimeInputs: readonly LeadTimeRiskInput[];
  readonly infoRequests: readonly InformationAcquisitionRequest[];
}

/** One flattened activity with its owning work package (canonically sorted). */
export interface IndexedActivity {
  readonly activity: Activity;
  readonly workPackageId: string;
}

/** The flattened, canonically-sorted activity index of a program. */
export function indexActivities(program: SealedProgramOfWork): readonly IndexedActivity[] {
  const indexed: IndexedActivity[] = [];
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      indexed.push({ activity, workPackageId: workPackage.workPackageId });
    }
  }
  indexed.sort((a, b) => (a.activity.activityId < b.activity.activityId ? -1 : 1));
  return indexed;
}

/** Construct the provenance source list of a finding (sorted, duplicate-free). */
function provenanceSources(
  context: SupervisionCheckContext,
  sources: readonly {
    referenceKind: ProvenanceReferenceKind;
    referenceId: string;
    contentDigest: string;
  }[],
): {
  evaluatedAt: string;
  evaluatedBy: string;
  checkVersion: typeof SUPERVISION_CONTRACT_VERSION;
  sources: { referenceKind: ProvenanceReferenceKind; referenceId: string; contentDigest: string }[];
} {
  const programSource = {
    referenceKind: 'program' as const,
    referenceId: context.program.programId,
    contentDigest: context.program.contentDigest,
  };
  const deliverySource = {
    referenceKind: 'delivery' as const,
    referenceId: context.delivery.deliveryId,
    contentDigest: context.delivery.contentDigest,
  };
  const merged = [programSource, deliverySource, ...sources];
  const seen = new Set<string>();
  const unique = merged.filter((source) => {
    const key = `${source.referenceKind}\u0000${source.referenceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => {
    if (a.referenceKind !== b.referenceKind) return a.referenceKind < b.referenceKind ? -1 : 1;
    return a.referenceId < b.referenceId ? -1 : 1;
  });
  return {
    evaluatedAt: context.evaluatedAt,
    evaluatedBy: context.evaluatedBy,
    checkVersion: SUPERVISION_CONTRACT_VERSION,
    sources: unique.slice(0, 64),
  };
}

/** Build one finding content (the shared constructor). */
function buildFinding(
  context: SupervisionCheckContext,
  findingClass: FindingClass,
  status: FindingStatus,
  subject: FindingSubject,
  title: string,
  detail: string,
  measures: FindingMeasures,
  sources: readonly {
    referenceKind: ProvenanceReferenceKind;
    referenceId: string;
    contentDigest: string;
  }[],
  milestoneId?: string,
): SupervisionFindingContent {
  return {
    schema: 'epoch.supervision.finding',
    schemaVersion: 1,
    findingId: deriveFindingId(findingClass, subject),
    tenantId: context.tenantId,
    solutionId: context.solutionId,
    programId: context.programId,
    deliveryId: context.deliveryId,
    findingClass,
    status,
    subject,
    title,
    detail,
    measures,
    provenance: provenanceSources(context, sources),
    ...(milestoneId !== undefined ? { milestoneId } : {}),
  };
}

/** The open W038 blocker-issue summaries impacting one activity. */
function openBlockerIssuesFor(
  context: SupervisionCheckContext,
  activityId: string,
): readonly ExecutionIssueSummary[] {
  return context.executionIssues
    .filter(
      (issue) =>
        issue.issueKind === 'blocker' &&
        issue.resolutionState === 'open' &&
        issue.impact.activityIds.includes(activityId),
    )
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}

/** Whether an activity is complete (W036 actualFinish present). */
function isComplete(activity: Activity): boolean {
  return activity.actualFinish !== undefined;
}

/** Whether an activity has started (actualStart or recorded progress). */
function hasStarted(activity: Activity): boolean {
  return activity.actualStart !== undefined || (activity.actualProgress ?? 0) > 0;
}

// --------------------------------------------------------------------------------
// 1. Planned-vs-actual monitoring.
// --------------------------------------------------------------------------------

/**
 * PLANNED-VS-ACTUAL: every incomplete dated activity (plus every
 * undated-but-impeded activity) yields one finding with the closed
 * status precedence blocked > late > drifted > due; missed W036
 * milestones surface as late milestone findings.
 */
export function checkPlannedVsActual(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const indexed = indexActivities(context.program);
  for (const { activity } of indexed) {
    if (isComplete(activity)) {
      continue;
    }
    const blockers = [...activity.blockers].sort((a, b) =>
      a.blockerId < b.blockerId ? -1 : 1,
    );
    const blockerIssues = openBlockerIssuesFor(context, activity.activityId);
    const hasImpediment = blockers.length > 0 || blockerIssues.length > 0;

    const inWindow =
      activity.plannedStart !== undefined &&
      instantToEpochMs(context.evaluatedAt) >= instantToEpochMs(activity.plannedStart);
    const isLate =
      activity.plannedFinish !== undefined &&
      instantToEpochMs(context.evaluatedAt) > instantToEpochMs(activity.plannedFinish);
    const forecastDrift =
      activity.forecastFinish !== undefined &&
      activity.plannedFinish !== undefined &&
      instantToEpochMs(activity.forecastFinish) > instantToEpochMs(activity.plannedFinish);
    const lateStart =
      activity.actualStart !== undefined &&
      activity.plannedStart !== undefined &&
      instantToEpochMs(activity.actualStart) > instantToEpochMs(activity.plannedStart);

    if (!hasImpediment && !isLate && !forecastDrift && !lateStart && !inWindow) {
      continue; // pre-window and healthy: no finding yet
    }

    let status: FindingStatus;
    if (hasImpediment) {
      status = 'blocked';
    } else if (isLate) {
      status = 'late';
    } else if (forecastDrift || lateStart) {
      status = 'drifted';
    } else {
      status = 'due';
    }

    const measures: FindingMeasures = {
      ...(activity.plannedStart !== undefined ? { plannedStart: activity.plannedStart } : {}),
      ...(activity.plannedFinish !== undefined ? { plannedFinish: activity.plannedFinish } : {}),
      ...(activity.actualStart !== undefined ? { actualStart: activity.actualStart } : {}),
      ...(activity.actualFinish !== undefined ? { actualFinish: activity.actualFinish } : {}),
      ...(activity.forecastFinish !== undefined ? { forecastFinish: activity.forecastFinish } : {}),
      ...(activity.actualProgress !== undefined ? { actualProgress: activity.actualProgress } : {}),
      ...(status === 'late' && activity.plannedFinish !== undefined
        ? { daysLate: dayDifference(context.evaluatedAt, activity.plannedFinish) }
        : {}),
      ...(forecastDrift && activity.plannedFinish !== undefined
        ? { driftDays: dayDifference(activity.forecastFinish!, activity.plannedFinish) }
        : {}),
      ...(blockers.length > 0
        ? { blockerRefs: blockers.map((blocker) => blocker.blockerId) }
        : {}),
      ...(blockerIssues.length > 0
        ? { issueRecordIds: blockerIssues.map((issue) => issue.recordId) }
        : {}),
    };

    findings.push(
      buildFinding(
        context,
        'planned-vs-actual',
        status,
        { subjectKind: 'activity', subjectId: activity.activityId },
        `Activity ${activity.activityId} is ${status}`,
        hasImpediment
          ? `the activity carries ${blockers.length + blockerIssues.length} open impediment(s) and is not complete`
          : status === 'late'
            ? `planned finish ${activity.plannedFinish} has passed without completion (evaluated at ${context.evaluatedAt})`
            : status === 'drifted'
              ? 'a schedule deviation is observed while the plan window is still open'
              : 'the activity is inside its plan window and not yet complete',
        measures,
        [
          ...blockerIssues.map((issue) => ({
            referenceKind: 'execution-issue' as const,
            referenceId: issue.recordId,
            contentDigest: issue.contentDigest,
          })),
        ],
      ),
    );
  }

  for (const milestone of [...context.program.milestones].sort((a, b) =>
    a.milestoneId < b.milestoneId ? -1 : 1,
  )) {
    if (milestone.status !== 'missed') {
      continue;
    }
    findings.push(
      buildFinding(
        context,
        'planned-vs-actual',
        'late',
        { subjectKind: 'milestone', subjectId: milestone.milestoneId },
        `Milestone ${milestone.milestoneId} was missed`,
        'the W036 milestone record carries status "missed" (target date passed without the achievement point)',
        {
          ...(milestone.targetDate !== undefined ? { targetDate: milestone.targetDate } : {}),
          ...(milestone.targetDate !== undefined
            ? { daysLate: dayDifference(context.evaluatedAt, milestone.targetDate) }
            : {}),
        },
        [
          {
            referenceKind: 'milestone' as const,
            referenceId: milestone.milestoneId,
            contentDigest: context.program.contentDigest,
          },
        ],
        milestone.milestoneId,
      ),
    );
  }

  return findings;
}

// --------------------------------------------------------------------------------
// 2. Critical-path and prerequisite checks (the typed CPM traversal).
// --------------------------------------------------------------------------------

/** One CPM computation over the program's dependency graph. */
export interface CriticalPathAnalysis {
  /** Activity ids on the critical path (zero float), canonically sorted. */
  readonly criticalActivityIds: readonly string[];
  /** Transitive downstream successors per activity (the drift impact set). */
  readonly downstreamOf: ReadonlyMap<string, readonly string[]>;
}

/**
 * The typed CPM traversal: forward/backward passes over PLANNED
 * durations (integer-ms arithmetic; undated activities contribute zero
 * duration), zero-float criticality. The graph authority STAYS in W036 —
 * this reads predecessors/successors and never re-schedules.
 */
export function analyzeCriticalPath(program: SealedProgramOfWork): CriticalPathAnalysis {
  const indexed = indexActivities(program);
  const byId = new Map<string, Activity>(indexed.map(({ activity }) => [activity.activityId, activity]));
  const ids = [...byId.keys()].sort();

  const durationOf = (activity: Activity): number =>
    activity.plannedStart !== undefined && activity.plannedFinish !== undefined
      ? Math.max(0, instantToEpochMs(activity.plannedFinish) - instantToEpochMs(activity.plannedStart))
      : 0;

  // Forward pass: earliest start/finish (predecessor edges).
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  const remaining = new Map<string, number>();
  for (const id of ids) {
    remaining.set(id, byId.get(id)!.predecessors.length);
  }
  const queue = ids.filter((id) => remaining.get(id) === 0);
  for (const id of queue) {
    earliestStart.set(id, 0);
  }
  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    const activity = byId.get(current)!;
    const finish = (earliestStart.get(current) ?? 0) + durationOf(activity);
    earliestFinish.set(current, finish);
    for (const successorId of activity.successors) {
      const candidate = finish;
      const existing = earliestStart.get(successorId);
      if (existing === undefined || candidate > existing) {
        earliestStart.set(successorId, candidate);
      }
      const left = (remaining.get(successorId) ?? 0) - 1;
      remaining.set(successorId, left);
      if (left === 0) {
        queue.push(successorId);
      }
    }
  }
  // Defensive completion (the W036 admission guarantees a DAG, so every
  // node settles; unvisited nodes default to zero).
  for (const id of ids) {
    if (!earliestStart.has(id)) earliestStart.set(id, 0);
    if (!earliestFinish.has(id)) earliestFinish.set(id, durationOf(byId.get(id)!));
  }

  let projectFinish = 0;
  for (const id of ids) {
    projectFinish = Math.max(projectFinish, earliestFinish.get(id) ?? 0);
  }

  // Backward pass: latest start/finish (successor edges).
  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();
  const remainingBack = new Map<string, number>();
  for (const id of ids) {
    remainingBack.set(id, byId.get(id)!.successors.length);
  }
  const backQueue = ids.filter((id) => remainingBack.get(id) === 0);
  for (const id of backQueue) {
    latestFinish.set(id, projectFinish);
  }
  head = 0;
  while (head < backQueue.length) {
    const current = backQueue[head]!;
    head += 1;
    const activity = byId.get(current)!;
    latestStart.set(current, (latestFinish.get(current) ?? projectFinish) - durationOf(activity));
    for (const predecessorId of activity.predecessors) {
      const candidate = latestStart.get(current) ?? projectFinish;
      const existing = latestFinish.get(predecessorId);
      if (existing === undefined || candidate < existing) {
        latestFinish.set(predecessorId, candidate);
      }
      const left = (remainingBack.get(predecessorId) ?? 0) - 1;
      remainingBack.set(predecessorId, left);
      if (left === 0) {
        backQueue.push(predecessorId);
      }
    }
  }
  for (const id of ids) {
    if (!latestFinish.has(id)) latestFinish.set(id, projectFinish);
    if (!latestStart.has(id))
      latestStart.set(id, (latestFinish.get(id) ?? projectFinish) - durationOf(byId.get(id)!));
  }

  const critical = ids.filter(
    (id) => (latestStart.get(id) ?? 0) - (earliestStart.get(id) ?? 0) <= 0,
  );

  // Transitive downstream successors (deterministic BFS per node).
  const downstreamOf = new Map<string, readonly string[]>();
  for (const id of ids) {
    const visited = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const successorId of byId.get(current)!.successors) {
        if (!visited.has(successorId)) {
          visited.add(successorId);
          stack.push(successorId);
        }
      }
    }
    downstreamOf.set(id, [...visited].sort());
  }

  return { criticalActivityIds: critical, downstreamOf };
}

/**
 * CRITICAL-PATH DRIFT + MISSING PREREQUISITES: critical activities that
 * are late/blocked/drifted carry their transitive downstream impact;
 * started activities with incomplete predecessors are blocked findings;
 * in-window starts threatened by an overdue predecessor are due
 * findings.
 */
export function checkCriticalPath(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const analysis = analyzeCriticalPath(context.program);
  const indexed = indexActivities(context.program);
  const byId = new Map<string, Activity>(indexed.map(({ activity }) => [activity.activityId, activity]));

  for (const id of analysis.criticalActivityIds) {
    const activity = byId.get(id)!;
    if (isComplete(activity)) {
      continue;
    }
    const blockerIssues = openBlockerIssuesFor(context, id);
    const isLate =
      activity.plannedFinish !== undefined &&
      instantToEpochMs(context.evaluatedAt) > instantToEpochMs(activity.plannedFinish);
    const forecastDrift =
      activity.forecastFinish !== undefined &&
      activity.plannedFinish !== undefined &&
      instantToEpochMs(activity.forecastFinish) > instantToEpochMs(activity.plannedFinish);
    if (!isLate && !forecastDrift && blockerIssues.length === 0 && activity.blockers.length === 0) {
      continue;
    }
    const status: FindingStatus =
      blockerIssues.length > 0 || activity.blockers.length > 0 ? 'blocked' : 'late';
    findings.push(
      buildFinding(
        context,
        'critical-path-drift',
        status,
        { subjectKind: 'activity', subjectId: id },
        `Critical-path activity ${id} is ${status}`,
        'the activity sits on the critical path (zero float) and is not complete while its plan has deviated or is impeded',
        {
          ...(activity.plannedFinish !== undefined ? { plannedFinish: activity.plannedFinish } : {}),
          ...(activity.forecastFinish !== undefined ? { forecastFinish: activity.forecastFinish } : {}),
          ...(isLate && activity.plannedFinish !== undefined
            ? { daysLate: dayDifference(context.evaluatedAt, activity.plannedFinish) }
            : {}),
          ...(forecastDrift && activity.plannedFinish !== undefined
            ? { driftDays: dayDifference(activity.forecastFinish!, activity.plannedFinish) }
            : {}),
          impactedActivityIds: [...(analysis.downstreamOf.get(id) ?? [])],
          ...(blockerIssues.length > 0
            ? { issueRecordIds: blockerIssues.map((issue) => issue.recordId) }
            : {}),
        },
        blockerIssues.map((issue) => ({
          referenceKind: 'execution-issue' as const,
          referenceId: issue.recordId,
          contentDigest: issue.contentDigest,
        })),
      ),
    );
  }

  // Prerequisite checks over the SAME graph (no re-scheduling — read-only).
  for (const { activity } of indexed) {
    if (isComplete(activity)) {
      continue;
    }
    const incompletePredecessors = activity.predecessors
      .filter((predecessorId) => {
        const predecessor = byId.get(predecessorId);
        return predecessor === undefined || !isComplete(predecessor);
      })
      .sort();
    if (incompletePredecessors.length === 0) {
      continue;
    }

    if (hasStarted(activity)) {
      // Hard violation: the successor started without completed prerequisites.
      findings.push(
        buildFinding(
          context,
          'missing-prerequisite',
          'blocked',
          { subjectKind: 'activity', subjectId: activity.activityId },
          `Activity ${activity.activityId} started with incomplete prerequisites`,
          'the activity has started (actual start or recorded progress) while prerequisite activities are not complete — supervision observes the violation; the graph authority stays in ProgramOfWork',
          {
            missingPrerequisiteIds: incompletePredecessors,
            ...(activity.actualStart !== undefined ? { actualStart: activity.actualStart } : {}),
            ...(activity.actualProgress !== undefined
              ? { actualProgress: activity.actualProgress }
              : {}),
          },
          incompletePredecessors.map((predecessorId) => ({
            referenceKind: 'activity' as const,
            referenceId: predecessorId,
            contentDigest: context.program.contentDigest,
          })),
        ),
      );
      continue;
    }

    // Threatened start: in-window, unstarted, and an overdue predecessor.
    const inWindow =
      activity.plannedStart !== undefined &&
      instantToEpochMs(context.evaluatedAt) >= instantToEpochMs(activity.plannedStart);
    const overduePredecessor = incompletePredecessors.some((predecessorId) => {
      const predecessor = byId.get(predecessorId);
      return (
        predecessor !== undefined &&
        predecessor.plannedFinish !== undefined &&
        instantToEpochMs(predecessor.plannedFinish) <= instantToEpochMs(context.evaluatedAt)
      );
    });
    if (inWindow && overduePredecessor) {
      findings.push(
        buildFinding(
          context,
          'missing-prerequisite',
          'due',
          { subjectKind: 'activity', subjectId: activity.activityId },
          `Activity ${activity.activityId} is due with an overdue prerequisite`,
          'the activity is inside its plan window, has not started, and a prerequisite activity is past its planned finish',
          {
            missingPrerequisiteIds: incompletePredecessors,
            ...(activity.plannedStart !== undefined ? { plannedStart: activity.plannedStart } : {}),
          },
          incompletePredecessors.map((predecessorId) => ({
            referenceKind: 'activity' as const,
            referenceId: predecessorId,
            contentDigest: context.program.contentDigest,
          })),
        ),
      );
    }
  }

  return findings;
}

// --------------------------------------------------------------------------------
// 3. Acquisition/lead-time risk checks.
// --------------------------------------------------------------------------------

/**
 * LEAD-TIME RISK: a required acquisition whose realistic lead time
 * cannot reach the prerequisite need instant is a typed risk finding
 * with the exact shortfall; the source record reference and uncertainty
 * ride along as provenance/measures (the W037 shapes, mirrored).
 */
export function checkLeadTimeRisk(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const sorted = [...context.leadTimeInputs].sort((a, b) =>
    a.leadTimeInputId < b.leadTimeInputId ? -1 : 1,
  );
  for (const input of sorted) {
    const daysUntilRequired = dayDifference(input.requiredBy, context.evaluatedAt);
    const shortfall = subtractNonNegativeDecimals(input.realisticLeadTimeDays, daysUntilRequired);
    if (compareNonNegativeDecimals(shortfall, '0') <= 0) {
      continue; // the realistic lead time still fits the need window
    }
    const requiredByPassed = instantToEpochMs(input.requiredBy) <= instantToEpochMs(context.evaluatedAt);
    findings.push(
      buildFinding(
        context,
        'lead-time-risk',
        requiredByPassed ? 'late' : 'drifted',
        { subjectKind: 'acquisition', subjectId: input.acquisitionRef },
        `Acquisition ${input.acquisitionRef} lead time threatens its prerequisite`,
        requiredByPassed
          ? `the prerequisite need instant ${input.requiredBy} has passed while the realistic lead time is ${input.realisticLeadTimeDays} days`
          : `only ${daysUntilRequired} day(s) remain until the prerequisite need instant ${input.requiredBy}, but the realistic lead time is ${input.realisticLeadTimeDays} days`,
        {
          acquisitionRef: input.acquisitionRef,
          requiredBy: input.requiredBy,
          realisticLeadTimeDays: input.realisticLeadTimeDays,
          shortfallDays: shortfall,
          impactedActivityIds: [...input.impactedActivityIds],
        },
        [
          {
            referenceKind: 'lead-time-record' as const,
            referenceId: input.sourceRecord.recordId,
            contentDigest: input.sourceRecord.contentDigest,
          },
        ],
      ),
    );
  }
  return findings;
}

// --------------------------------------------------------------------------------
// 4. Consumption/cost anomaly checks.
// --------------------------------------------------------------------------------

/**
 * CONSUMPTION/COST ANOMALIES: typed threshold rules over the W036
 * foldDeliveryActuals shapes matched against the planned quantity/cost
 * folds (per activity, unit/currency). Every anomaly carries its breach
 * class and magnitude (planned, actual, threshold, signed variance).
 */
export function checkConsumptionAnomalies(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const plannedQuantities = new Map<string, string>();
  for (const row of foldQuantitySchedule(context.program).rows) {
    plannedQuantities.set(`${row.activityId}\u0000${row.unit}`, row.plannedValue);
  }
  const plannedCosts = new Map<string, string>();
  for (const row of foldCostSchedule(context.program).rows) {
    plannedCosts.set(`${row.activityId}\u0000${row.currency}`, row.plannedAmount);
  }
  const actuals = foldDeliveryActuals(context.delivery);
  const rows = [...actuals.totals].sort((a, b) => {
    if (a.subjectId !== b.subjectId) return a.subjectId < b.subjectId ? -1 : 1;
    if (a.measureKind !== b.measureKind) return a.measureKind < b.measureKind ? -1 : 1;
    return (a.unit ?? a.currency ?? '') < (b.unit ?? b.currency ?? '') ? -1 : 1;
  });
  for (const row of rows) {
    if (row.subjectKind !== 'activity') {
      continue; // planned folds are per-activity; other subjects have no plan basis
    }
    if (row.measureKind === 'quantity') {
      const planned = plannedQuantities.get(`${row.subjectId}\u0000${row.unit ?? ''}`);
      if (planned === undefined || row.unit === undefined) {
        continue;
      }
      const overrunThreshold = multiplyNonNegativeDecimals(planned, context.thresholds.quantityOverrunRatio);
      const underrunThreshold = multiplyNonNegativeDecimals(planned, context.thresholds.quantityUnderrunRatio);
      const breachClass =
        compareNonNegativeDecimals(row.total, overrunThreshold) > 0
          ? ('quantity-overrun' as const)
          : compareNonNegativeDecimals(row.total, underrunThreshold) < 0
            ? ('quantity-underrun' as const)
            : null;
      if (breachClass === null) {
        continue;
      }
      findings.push(
        buildFinding(
          context,
          'consumption-anomaly',
          'drifted',
          { subjectKind: 'activity', subjectId: row.subjectId },
          `Consumption anomaly on ${row.subjectId} (${row.unit})`,
          `actualized quantity ${row.total} ${row.unit} breaches the ${breachClass} threshold against the planned ${planned} ${row.unit}`,
          {
            plannedValue: planned,
            actualValue: row.total,
            thresholdValue:
              breachClass === 'quantity-overrun' ? overrunThreshold : underrunThreshold,
            varianceValue: signedDecimalSubtraction(row.total, planned),
            unit: row.unit,
            breachClass,
          },
          [],
        ),
      );
      continue;
    }
    if (row.measureKind === 'cost') {
      const planned = plannedCosts.get(`${row.subjectId}\u0000${row.currency ?? ''}`);
      if (planned === undefined || row.currency === undefined) {
        continue;
      }
      const overrunThreshold = multiplyNonNegativeDecimals(planned, context.thresholds.costOverrunRatio);
      const underrunThreshold = multiplyNonNegativeDecimals(planned, context.thresholds.costUnderrunRatio);
      const breachClass =
        compareNonNegativeDecimals(row.total, overrunThreshold) > 0
          ? ('cost-overrun' as const)
          : compareNonNegativeDecimals(row.total, underrunThreshold) < 0
            ? ('cost-underrun' as const)
            : null;
      if (breachClass === null) {
        continue;
      }
      findings.push(
        buildFinding(
          context,
          'consumption-anomaly',
          'drifted',
          { subjectKind: 'activity', subjectId: row.subjectId },
          `Cost anomaly on ${row.subjectId} (${row.currency})`,
          `actualized cost ${row.total} ${row.currency} breaches the ${breachClass} threshold against the planned ${planned} ${row.currency}`,
          {
            plannedValue: planned,
            actualValue: row.total,
            thresholdValue: breachClass === 'cost-overrun' ? overrunThreshold : underrunThreshold,
            varianceValue: signedDecimalSubtraction(row.total, planned),
            currency: row.currency,
            breachClass,
          },
          [],
        ),
      );
    }
  }
  return findings;
}

// --------------------------------------------------------------------------------
// 5. Verification failures.
// --------------------------------------------------------------------------------

/**
 * VERIFICATION FAILURES: W036 VerificationGate + W038 issue records
 * surface as typed findings — an unpassed gate on an activity whose
 * planned finish has passed (overdue gate), and open W038 defects.
 * Never a mutation of the gate.
 */
export function checkVerificationFailures(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const indexed = indexActivities(context.program);
  const byId = new Map<string, Activity>(indexed.map(({ activity }) => [activity.activityId, activity]));

  for (const workPackage of [...context.program.workPackages].sort((a, b) =>
    a.workPackageId < b.workPackageId ? -1 : 1,
  )) {
    for (const gate of [...workPackage.verificationGates].sort((a, b) =>
      a.gateId < b.gateId ? -1 : 1,
    )) {
      if (gate.passedAt !== undefined) {
        continue;
      }
      const activity = byId.get(gate.activityId);
      const plannedFinish = activity?.plannedFinish;
      const overdue =
        plannedFinish !== undefined &&
        (activity === undefined || !isComplete(activity)) &&
        instantToEpochMs(plannedFinish) <= instantToEpochMs(context.evaluatedAt);
      if (!overdue) {
        continue;
      }
      findings.push(
        buildFinding(
          context,
          'verification-failure',
          'late',
          { subjectKind: 'gate', subjectId: gate.gateId },
          `Verification gate ${gate.gateId} is overdue`,
          `the gate on activity ${gate.activityId} has not passed while the activity's planned finish ${plannedFinish} has been reached — supervision observes; the gate itself is never mutated`,
          {
            gateId: gate.gateId,
            gatePassed: false,
            plannedFinish,
            daysLate: dayDifference(context.evaluatedAt, plannedFinish),
          },
          [
            {
              referenceKind: 'gate' as const,
              referenceId: gate.gateId,
              contentDigest: context.program.contentDigest,
            },
          ],
        ),
      );
    }
  }

  for (const issue of [...context.executionIssues].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  )) {
    if (issue.issueKind !== 'defect' || issue.resolutionState !== 'open') {
      continue;
    }
    findings.push(
      buildFinding(
        context,
        'verification-failure',
        'drifted',
        { subjectKind: 'execution-issue', subjectId: issue.recordId },
        `Open defect ${issue.recordId} (${issue.severity})`,
        `an open W038 defect of severity ${issue.severity} impacts the referenced schedule items — a verification deviation is observed`,
        {
          issueRecordIds: [issue.recordId],
          ...(issue.impact.activityIds.length > 0
            ? { impactedActivityIds: [...issue.impact.activityIds] }
            : {}),
        },
        [
          {
            referenceKind: 'execution-issue' as const,
            referenceId: issue.recordId,
            contentDigest: issue.contentDigest,
          },
        ],
      ),
    );
  }

  return findings;
}

// --------------------------------------------------------------------------------
// 6. Unresolved high-impact unknown detection.
// --------------------------------------------------------------------------------

/**
 * UNRESOLVED HIGH-IMPACT UNKNOWNS: W036 DecisionImpact-material
 * information-acquisition requests still open past their freshness
 * requirements (aging -> due, stale -> late). An immaterial unknown is
 * preserved as uncertainty by W036 — it never becomes a finding.
 */
export function checkUnresolvedUnknowns(
  context: SupervisionCheckContext,
): readonly SupervisionFindingContent[] {
  const findings: SupervisionFindingContent[] = [];
  const sorted = [...context.infoRequests].sort((a, b) =>
    a.requestId < b.requestId ? -1 : 1,
  );
  for (const request of sorted) {
    if (request.status !== 'open' || request.decisionImpact.materiality !== 'material') {
      continue;
    }
    const freshness = request.freshnessRequirement?.state;
    if (freshness !== 'aging' && freshness !== 'stale') {
      continue; // still within freshness (or no requirement): not yet a finding
    }
    findings.push(
      buildFinding(
        context,
        'unresolved-unknown',
        freshness === 'stale' ? 'late' : 'due',
        { subjectKind: 'info-request', subjectId: request.requestId },
        `Unresolved high-impact unknown ${request.requestId}`,
        `the material ${request.decisionImpact.decisionKind} unknown is still open while its freshness requirement is ${freshness} (decision impact: ${request.decisionImpact.rationale})`,
        {
          infoRequestId: request.requestId,
          freshnessState: freshness,
        },
        [
          {
            referenceKind: 'info-request' as const,
            referenceId: request.requestId,
            contentDigest: context.program.contentDigest,
          },
        ],
      ),
    );
  }
  return findings;
}

/** Run every check family, merged and canonically ordered by (findingClass, findingId). */
export function runAllChecks(context: SupervisionCheckContext): readonly SupervisionFindingContent[] {
  const merged = [
    ...checkPlannedVsActual(context),
    ...checkCriticalPath(context),
    ...checkLeadTimeRisk(context),
    ...checkConsumptionAnomalies(context),
    ...checkVerificationFailures(context),
    ...checkUnresolvedUnknowns(context),
  ];
  merged.sort((a, b) => {
    if (a.findingClass !== b.findingClass) return a.findingClass < b.findingClass ? -1 : 1;
    if (a.findingId !== b.findingId) return a.findingId < b.findingId ? -1 : 1;
    return a.subject.subjectId < b.subject.subjectId ? -1 : 1;
  });
  return merged;
}
