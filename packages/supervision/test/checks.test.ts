// The six check families (the W043 "must provide" list): every family
// is a pure function of sealed inputs; synthetic schedules drive the
// due / drifted / late / blocked statuses. Zero clock reads.
import { describe, expect, it } from 'vitest';
import {
  acceptObservation,
  actualizeObservation,
  recordObservation,
  sealDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  analyzeCriticalPath,
  checkConsumptionAnomalies,
  checkCriticalPath,
  checkLeadTimeRisk,
  checkPlannedVsActual,
  checkUnresolvedUnknowns,
  checkVerificationFailures,
  runAllChecks,
  DEFAULT_SUPERVISION_THRESHOLDS,
  type SupervisionCheckContext,
} from '../src/index';
import type { ExecutionIssueSummary, LeadTimeRiskInput } from '../src/index';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2,
  ACTIVITY_ID_3,
  DELIVERY_ID,
  EVAL_BEFORE_WINDOW,
  EVAL_IN_WINDOW,
  EVAL_LEAD_TIME_TIGHT,
  EVAL_PAST_FINISH,
  GATE_ID,
  ISSUE_DIGEST,
  LEAD_TIME_DIGEST,
  OBSERVER,
  PLAN_FINISH,
  PLAN_MID,
  PLAN_START,
  PRINCIPAL,
  PROGRAM_ID,
  REQUIRED_BY,
  SOLUTION_ID,
  TENANT,
  T3,
  T5,
  uncertainty,
  unwrap,
  activity,
  observationContent,
  openedDelivery,
  sealedProgram,
} from './fixtures';

/** Build a check context over the synthetic fixtures. */
function context(overrides: Partial<SupervisionCheckContext> = {}): SupervisionCheckContext {
  return {
    program: sealedProgram(),
    delivery: openedDelivery(),
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    programId: PROGRAM_ID,
    deliveryId: DELIVERY_ID,
    evaluatedAt: EVAL_IN_WINDOW,
    evaluatedBy: PRINCIPAL,
    thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
    executionIssues: [],
    leadTimeInputs: [],
    infoRequests: [],
    ...overrides,
  };
}

/** One execution-issue summary fixture. */
function issueSummary(overrides: Partial<ExecutionIssueSummary> = {}): ExecutionIssueSummary {
  return {
    schema: 'epoch.supervision.execution-issue-summary',
    schemaVersion: 1,
    recordId: 'blocker:awaiting-survey',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    issueKind: 'blocker',
    severity: 'major',
    resolutionState: 'open',
    impact: { workPackageIds: [], activityIds: [ACTIVITY_ID], milestoneIds: [] },
    raisedAt: T3,
    contentDigest: ISSUE_DIGEST,
    ...overrides,
  };
}

/** One lead-time risk input fixture. */
function leadTimeInput(overrides: Partial<LeadTimeRiskInput> = {}): LeadTimeRiskInput {
  return {
    schema: 'epoch.supervision.lead-time-risk-input',
    schemaVersion: 1,
    leadTimeInputId: 'lead-time:cement-delivery',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionRef: 'acquisition:bulk-cement',
    requiredBy: REQUIRED_BY,
    realisticLeadTimeDays: '5',
    observedAt: T3,
    sourceRecord: { recordId: 'estimate:cement-lead', contentDigest: LEAD_TIME_DIGEST },
    uncertainty: uncertainty(),
    impactedActivityIds: [ACTIVITY_ID_3],
    ...overrides,
  };
}

describe('checkPlannedVsActual (synthetic schedules: due / drifted / late / blocked)', () => {
  it('an in-window incomplete activity is DUE', () => {
    const findings = checkPlannedVsActual(context());
    const due = findings.filter((f) => f.findingClass === 'planned-vs-actual' && f.status === 'due');
    expect(due.length).toBeGreaterThanOrEqual(1);
    const excavate = due.find((f) => f.subject.subjectId === ACTIVITY_ID);
    expect(excavate).toBeDefined();
    expect(excavate!.findingId).toBe('finding:planned-vs-actual-activity-activity-excavate');
    expect(excavate!.measures.plannedStart).toBe(PLAN_START);
  });

  it('a pre-window healthy schedule yields NO findings', () => {
    const findings = checkPlannedVsActual(context({ evaluatedAt: EVAL_BEFORE_WINDOW }));
    expect(findings).toHaveLength(0);
  });

  it('an activity past its planned finish without completion is LATE with day magnitude', () => {
    const findings = checkPlannedVsActual(context({ evaluatedAt: EVAL_PAST_FINISH }));
    const late = findings.find(
      (f) => f.findingClass === 'planned-vs-actual' && f.subject.subjectId === ACTIVITY_ID && f.status === 'late',
    );
    expect(late).toBeDefined();
    expect(late!.measures.daysLate).toBe('3');
    expect(late!.measures.plannedFinish).toBe(PLAN_MID);
  });

  it('a forecast beyond the plan window is DRIFTED while the window is open', () => {
    const program = sealedProgram({
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [
            activity(ACTIVITY_ID, 'work-package:earthworks', {
              plannedStart: PLAN_START,
              plannedFinish: PLAN_FINISH,
              forecastFinish: '2026-03-07T08:00:00.000Z',
            }),
          ],
        },
        {
          workPackageId: 'work-package:structure',
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [],
        },
      ],
    });
    const findings = checkPlannedVsActual(context({ program }));
    const drifted = findings.find((f) => f.subject.subjectId === ACTIVITY_ID && f.status === 'drifted');
    expect(drifted).toBeDefined();
    expect(drifted!.measures.driftDays).toBe('2');
  });

  it('an activity carrying a W036 blocker record is BLOCKED', () => {
    const program = sealedProgram({
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [
            activity(ACTIVITY_ID, 'work-package:earthworks', {
              plannedStart: PLAN_START,
              plannedFinish: PLAN_FINISH,
              blockers: [
                {
                  blockerId: 'blocker:utility-strike',
                  description: 'unmapped utility struck',
                  raisedAt: T3,
                  raisedBy: OBSERVER,
                },
              ],
            }),
          ],
        },
        {
          workPackageId: 'work-package:structure',
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [],
        },
      ],
    });
    const findings = checkPlannedVsActual(context({ program }));
    const blocked = findings.find((f) => f.subject.subjectId === ACTIVITY_ID && f.status === 'blocked');
    expect(blocked).toBeDefined();
    expect(blocked!.measures.blockerRefs).toEqual(['blocker:utility-strike']);
  });

  it('an open W038 blocker issue impacting the activity is BLOCKED with the issue provenance', () => {
    const findings = checkPlannedVsActual(context({ executionIssues: [issueSummary()] }));
    const blocked = findings.find((f) => f.subject.subjectId === ACTIVITY_ID && f.status === 'blocked');
    expect(blocked).toBeDefined();
    expect(blocked!.measures.issueRecordIds).toEqual(['blocker:awaiting-survey']);
    const source = blocked!.provenance.sources.find((s) => s.referenceId === 'blocker:awaiting-survey');
    expect(source?.contentDigest).toBe(ISSUE_DIGEST);
  });

  it('a missed W036 milestone surfaces as a LATE milestone finding', () => {
    const program = sealedProgram({
      milestones: [
        {
          milestoneId: 'milestone:earthworks-complete',
          title: 'Earthworks complete',
          activityIds: [ACTIVITY_ID],
          status: 'missed',
          evidence: [],
        },
      ],
    });
    const findings = checkPlannedVsActual(context({ program }));
    const missed = findings.find((f) => f.subject.subjectKind === 'milestone');
    expect(missed).toBeDefined();
    expect(missed!.status).toBe('late');
    expect(missed!.milestoneId).toBe('milestone:earthworks-complete');
  });

  it('a completed activity yields no planned-vs-actual finding', () => {
    const program = sealedProgram({
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [
            activity(ACTIVITY_ID, 'work-package:earthworks', {
              plannedStart: PLAN_START,
              plannedFinish: PLAN_MID,
              successors: [ACTIVITY_ID_2],
              actualFinish: '2026-03-03T07:00:00.000Z',
            }),
            activity(ACTIVITY_ID_2, 'work-package:earthworks', {
              plannedStart: PLAN_MID,
              plannedFinish: PLAN_FINISH,
              predecessors: [ACTIVITY_ID],
              successors: [],
              actualFinish: '2026-03-04T07:00:00.000Z',
            }),
          ],
        },
        {
          workPackageId: 'work-package:structure',
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [],
        },
      ],
    });
    const findings = checkPlannedVsActual(context({ program, evaluatedAt: EVAL_PAST_FINISH }));
    expect(findings.filter((f) => f.subject.subjectKind === 'activity')).toHaveLength(0);
  });
});

describe('checkCriticalPath (typed CPM traversal; the graph authority stays in W036)', () => {
  it('the synthetic chain excavate -> grade -> pour is analyzed with the expected critical set', () => {
    const analysis = analyzeCriticalPath(sealedProgram());
    // All three activities are on one chain with back-to-back dates: the
    // whole chain is critical (zero float at every node).
    expect(analysis.criticalActivityIds).toEqual([ACTIVITY_ID, ACTIVITY_ID_2, ACTIVITY_ID_3]);
    expect(analysis.downstreamOf.get(ACTIVITY_ID)).toEqual([ACTIVITY_ID_2, ACTIVITY_ID_3]);
    expect(analysis.downstreamOf.get(ACTIVITY_ID_3)).toEqual([]);
  });

  it('a late critical activity yields a critical-path-drift finding with downstream impact', () => {
    const findings = checkCriticalPath(context({ evaluatedAt: EVAL_PAST_FINISH }));
    const drift = findings.find(
      (f) => f.findingClass === 'critical-path-drift' && f.subject.subjectId === ACTIVITY_ID,
    );
    expect(drift).toBeDefined();
    expect(drift!.status).toBe('late');
    expect(drift!.measures.impactedActivityIds).toEqual([ACTIVITY_ID_2, ACTIVITY_ID_3]);
  });

  it('a started activity with an incomplete predecessor is a BLOCKED missing-prerequisite finding', () => {
    const program = sealedProgram({
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [
            activity(ACTIVITY_ID, 'work-package:earthworks', {
              plannedStart: PLAN_START,
              plannedFinish: PLAN_MID,
              successors: [ACTIVITY_ID_2],
            }),
            activity(ACTIVITY_ID_2, 'work-package:earthworks', {
              plannedStart: PLAN_MID,
              plannedFinish: PLAN_FINISH,
              predecessors: [ACTIVITY_ID],
              successors: [],
              actualStart: '2026-03-02T10:00:00.000Z',
            }),
          ],
        },
        {
          workPackageId: 'work-package:structure',
          title: 'Structure package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [],
          activities: [],
        },
      ],
    });
    const findings = checkCriticalPath(context({ program }));
    const missing = findings.find(
      (f) => f.findingClass === 'missing-prerequisite' && f.subject.subjectId === ACTIVITY_ID_2,
    );
    expect(missing).toBeDefined();
    expect(missing!.status).toBe('blocked');
    expect(missing!.measures.missingPrerequisiteIds).toEqual([ACTIVITY_ID]);
  });

  it('an in-window unstarted activity with an overdue prerequisite is a DUE missing-prerequisite finding', () => {
    // grade (ACTIVITY_ID_2) is in-window at EVAL_PAST_FINISH; its
    // predecessor excavate is past PLAN_MID and incomplete.
    const findings = checkCriticalPath(context({ evaluatedAt: EVAL_PAST_FINISH }));
    const threatened = findings.find(
      (f) => f.findingClass === 'missing-prerequisite' && f.subject.subjectId === ACTIVITY_ID_2,
    );
    expect(threatened).toBeDefined();
    expect(threatened!.measures.missingPrerequisiteIds).toEqual([ACTIVITY_ID]);
  });
});

describe('checkLeadTimeRisk (W037-shaped inputs vs the prerequisite need instant)', () => {
  it('a realistic lead time that cannot reach requiredBy is a risk finding with the exact shortfall', () => {
    // EVAL_LEAD_TIME_TIGHT is 2 days before REQUIRED_BY; the lead time is 5 days.
    const findings = checkLeadTimeRisk(context({ evaluatedAt: EVAL_LEAD_TIME_TIGHT, leadTimeInputs: [leadTimeInput()] }));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.findingClass).toBe('lead-time-risk');
    expect(findings[0]!.status).toBe('drifted');
    expect(findings[0]!.measures.shortfallDays).toBe('3');
    expect(findings[0]!.measures.impactedActivityIds).toEqual([ACTIVITY_ID_3]);
    expect(findings[0]!.subject).toEqual({ subjectKind: 'acquisition', subjectId: 'acquisition:bulk-cement' });
  });

  it('a lead time that fits the window yields no finding', () => {
    const findings = checkLeadTimeRisk(
      context({ evaluatedAt: EVAL_BEFORE_WINDOW, leadTimeInputs: [leadTimeInput()] }),
    );
    expect(findings).toHaveLength(0);
  });

  it('a need instant already passed upgrades the finding to LATE', () => {
    const findings = checkLeadTimeRisk(
      context({
        evaluatedAt: '2026-03-09T08:00:00.000Z',
        leadTimeInputs: [leadTimeInput()],
      }),
    );
    expect(findings[0]!.status).toBe('late');
  });
});

describe('checkConsumptionAnomalies (typed thresholds over foldDeliveryActuals)', () => {
  /** A delivery with one ACTUALIZED quantity observation of `value` on excavate. */
  function deliveryWithActualQuantity(value: string) {
    let delivery = openedDelivery();
    const observation = unwrap(sealDistinctionRecord(observationContent({ measure: { kind: 'quantity', value, unit: 'm3' } })));
    delivery = unwrap(recordObservation(delivery, observation));
    delivery = unwrap(acceptObservation(delivery, 'observation:pit-quantity-monday', { acceptedBy: PRINCIPAL, acceptedAt: T5 }));
    return unwrap(
      actualizeObservation(delivery, 'observation:pit-quantity-monday', {
        actualId: 'actual:pit-quantity-monday',
        actualizedBy: PRINCIPAL,
        actualizedAt: T5,
      }),
    );
  }

  it('a 30% quantity overrun against the 10% threshold is a quantity-overrun anomaly with magnitude', () => {
    const delivery = deliveryWithActualQuantity('130'); // planned 100
    const findings = checkConsumptionAnomalies(context({ delivery }));
    expect(findings).toHaveLength(1);
    const anomaly = findings[0]!;
    expect(anomaly.findingClass).toBe('consumption-anomaly');
    expect(anomaly.status).toBe('drifted');
    expect(anomaly.measures.breachClass).toBe('quantity-overrun');
    expect(anomaly.measures.plannedValue).toBe('100');
    expect(anomaly.measures.actualValue).toBe('130');
    expect(anomaly.measures.thresholdValue).toBe('110');
    expect(anomaly.measures.varianceValue).toBe('30');
    expect(anomaly.measures.unit).toBe('m3');
  });

  it('a quantity inside the threshold band yields no anomaly', () => {
    const delivery = deliveryWithActualQuantity('105'); // planned 100, threshold 110
    const findings = checkConsumptionAnomalies(context({ delivery }));
    expect(findings).toHaveLength(0);
  });

  it('a quantity underrun breaches the underrun threshold', () => {
    const delivery = deliveryWithActualQuantity('80'); // planned 100, underrun threshold 90
    const findings = checkConsumptionAnomalies(context({ delivery }));
    expect(findings[0]!.measures.breachClass).toBe('quantity-underrun');
    expect(findings[0]!.measures.thresholdValue).toBe('90');
    expect(findings[0]!.measures.varianceValue).toBe('-20');
  });

  it('swapping the threshold rules changes which findings fire (rules are data)', () => {
    const delivery = deliveryWithActualQuantity('105');
    const lenient = checkConsumptionAnomalies(context({ delivery }));
    const strict = checkConsumptionAnomalies(
      context({ delivery, thresholds: { quantityOverrunRatio: '1.04', costOverrunRatio: '1.10', quantityUnderrunRatio: '0.90', costUnderrunRatio: '0.90' } }),
    );
    expect(lenient).toHaveLength(0);
    expect(strict[0]!.measures.breachClass).toBe('quantity-overrun');
    expect(strict[0]!.measures.thresholdValue).toBe('104');
  });

  it('a cost overrun is a cost-overrun anomaly with currency and variance', () => {
    let delivery = openedDelivery();
    const observation = unwrap(
      sealDistinctionRecord(observationContent({ measure: { kind: 'cost', amount: '1500', currency: 'EUR' } })),
    );
    delivery = unwrap(recordObservation(delivery, observation));
    delivery = unwrap(acceptObservation(delivery, 'observation:pit-quantity-monday', { acceptedBy: PRINCIPAL, acceptedAt: T5 }));
    delivery = unwrap(
      actualizeObservation(delivery, 'observation:pit-quantity-monday', {
        actualId: 'actual:pit-cost-monday',
        actualizedBy: PRINCIPAL,
        actualizedAt: T5,
      }),
    );
    const findings = checkConsumptionAnomalies(context({ delivery }));
    expect(findings[0]!.measures.breachClass).toBe('cost-overrun');
    expect(findings[0]!.measures.currency).toBe('EUR');
    expect(findings[0]!.measures.varianceValue).toBe('500');
  });
});

describe('checkVerificationFailures (W036 gates + W038 issues surface as findings)', () => {
  it('an unpassed gate on an activity past its planned finish is a LATE verification failure', () => {
    const findings = checkVerificationFailures(context({ evaluatedAt: EVAL_PAST_FINISH }));
    const gate = findings.find((f) => f.subject.subjectKind === 'gate');
    expect(gate).toBeDefined();
    expect(gate!.subject.subjectId).toBe(GATE_ID);
    expect(gate!.status).toBe('late');
    expect(gate!.measures.gatePassed).toBe(false);
    expect(gate!.measures.plannedFinish).toBe(PLAN_MID);
  });

  it('a gate on an in-window activity yields no finding yet', () => {
    const findings = checkVerificationFailures(context({ evaluatedAt: EVAL_IN_WINDOW }));
    expect(findings.filter((f) => f.subject.subjectKind === 'gate')).toHaveLength(0);
  });

  it('an open W038 defect is a DRIFTED verification failure referencing the issue digest', () => {
    const defect = issueSummary({
      recordId: 'defect:cracked-plate',
      issueKind: 'defect',
      impact: { workPackageIds: [], activityIds: [ACTIVITY_ID_3], milestoneIds: [] },
    });
    const findings = checkVerificationFailures(context({ executionIssues: [defect] }));
    const finding = findings.find((f) => f.subject.subjectKind === 'execution-issue');
    expect(finding).toBeDefined();
    expect(finding!.status).toBe('drifted');
    expect(finding!.measures.issueRecordIds).toEqual(['defect:cracked-plate']);
    expect(finding!.provenance.sources.some((s) => s.referenceId === 'defect:cracked-plate')).toBe(true);
  });

  it('a resolved defect yields no finding', () => {
    const defect = issueSummary({
      recordId: 'defect:cracked-plate',
      issueKind: 'defect',
      resolutionState: 'resolved',
    });
    const findings = checkVerificationFailures(context({ executionIssues: [defect] }));
    expect(findings).toHaveLength(0);
  });
});

describe('checkUnresolvedUnknowns (DecisionImpact-material info-requests past freshness)', () => {
  function infoRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schema: 'epoch.solution-delivery.info-request',
      schemaVersion: 1,
      requestId: 'info-request:soil-bearing-capacity',
      tenantId: TENANT,
      solutionId: SOLUTION_ID,
      requestedInformation: 'the verified soil bearing capacity at foundation depth',
      decisionImpact: {
        stage: 'realize',
        decisionKind: 'verification-result',
        materiality: 'material',
        rationale: 'the foundation design verification depends on the bearing capacity',
      },
      issuedAt: T3,
      issuedBy: PRINCIPAL,
      status: 'open',
      ...overrides,
    };
  }

  it('a material open request with STALE freshness is a LATE unresolved-unknown finding', () => {
    const findings = checkUnresolvedUnknowns(
      context({ infoRequests: [infoRequest({ freshnessRequirement: { state: 'stale', assessedAt: T3 } })] as never[] }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.findingClass).toBe('unresolved-unknown');
    expect(findings[0]!.status).toBe('late');
    expect(findings[0]!.measures.freshnessState).toBe('stale');
    expect(findings[0]!.subject).toEqual({ subjectKind: 'info-request', subjectId: 'info-request:soil-bearing-capacity' });
  });

  it('an AGING material request is a DUE finding', () => {
    const findings = checkUnresolvedUnknowns(
      context({ infoRequests: [infoRequest({ freshnessRequirement: { state: 'aging', assessedAt: T3 } })] as never[] }),
    );
    expect(findings[0]!.status).toBe('due');
  });

  it('a FRESH material request yields no finding (still within freshness)', () => {
    const findings = checkUnresolvedUnknowns(
      context({ infoRequests: [infoRequest({ freshnessRequirement: { state: 'fresh', assessedAt: T3 } })] as never[] }),
    );
    expect(findings).toHaveLength(0);
  });

  it('an IMMATERIAL unknown never becomes a finding (W036 preserves it as uncertainty)', () => {
    const findings = checkUnresolvedUnknowns(
      context({
        infoRequests: [
          infoRequest({
            decisionImpact: {
              stage: 'realize',
              decisionKind: 'verification-result',
              materiality: 'immaterial',
              rationale: 'cosmetic note only',
            },
            freshnessRequirement: { state: 'stale', assessedAt: T3 },
          }),
        ] as never[],
      }),
    );
    expect(findings).toHaveLength(0);
  });

  it('a FULFILLED material request yields no finding', () => {
    const findings = checkUnresolvedUnknowns(
      context({
        infoRequests: [
          infoRequest({
            status: 'fulfilled',
            freshnessRequirement: { state: 'stale', assessedAt: T3 },
            fulfillment: {
              evidence: [{ digest: LEAD_TIME_DIGEST, capturedAt: T5, capturedBy: OBSERVER }],
              fulfilledAt: T5,
              fulfilledBy: PRINCIPAL,
              uncertainty: uncertainty(),
            },
          }),
        ] as never[],
      }),
    );
    expect(findings).toHaveLength(0);
  });
});

describe('runAllChecks (canonical ordering + full coverage)', () => {
  it('every family contributes and findings order canonically by (class, id)', () => {
    const ctx = context({
      evaluatedAt: EVAL_PAST_FINISH,
      executionIssues: [
        issueSummary(),
        issueSummary({
          recordId: 'defect:cracked-plate',
          issueKind: 'defect',
          impact: { workPackageIds: [], activityIds: [ACTIVITY_ID_3], milestoneIds: [] },
        }),
      ],
      leadTimeInputs: [leadTimeInput()],
    });
    const findings = runAllChecks(ctx);
    const classes = [...new Set(findings.map((f) => f.findingClass))];
    expect(classes).toEqual([
      'critical-path-drift',
      'lead-time-risk',
      'missing-prerequisite',
      'planned-vs-actual',
      'verification-failure',
    ]);
    for (let i = 1; i < findings.length; i += 1) {
      const previous = findings[i - 1]!;
      const current = findings[i]!;
      expect(
        previous.findingClass < current.findingClass ||
          (previous.findingClass === current.findingClass && previous.findingId < current.findingId),
      ).toBe(true);
    }
  });
});
