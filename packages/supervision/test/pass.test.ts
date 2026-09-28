// The supervision PASS: total admission, determinism, the derived
// projection, and the negative battery (re-schedule-rejected,
// tenant-isolation-rejected, malformed inputs, tampered digests,
// dangling references, vendor fields).
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUPERVISION_THRESHOLDS,
  evaluateSupervisionPass,
  projectSupervisionState,
  verifySealedSupervisionPass,
  admitExecutionIssueSummary,
  admitLeadTimeRiskInput,
} from '../src/index';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2 as ACTIVITY_ID_B,
  ACTIVITY_ID_3 as ACTIVITY_ID_C,
  EVAL_IN_WINDOW,
  EVAL_PAST_FINISH,
  ISSUE_DIGEST,
  LEAD_TIME_DIGEST,
  OTHER_TENANT,
  PRINCIPAL,
  REQUIRED_BY,
  SOLUTION_ID,
  TENANT,
  T3,
  uncertainty,
  expectError,
  openedDelivery,
  sealedProgram,
  unwrap,
} from './fixtures';

/** The total evaluation input fixture (loose JSON). */
function evaluationInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    passId: 'pass:week-1',
    tenantId: TENANT,
    evaluatedAt: EVAL_IN_WINDOW,
    evaluatedBy: PRINCIPAL,
    program: sealedProgram(),
    delivery: openedDelivery(),
    thresholds: DEFAULT_SUPERVISION_THRESHOLDS,
    executionIssues: [],
    leadTimeInputs: [],
    infoRequests: [],
    ...overrides,
  };
}

describe('evaluateSupervisionPass (total admission)', () => {
  it('admits a synthetic in-window pass with deterministic findings and counts', () => {
    const result = evaluateSupervisionPass(evaluationInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pass = result.value;
    expect(pass.passId).toBe('pass:week-1');
    expect(pass.programDigest).toBe(pass.programDigest);
    expect(pass.findingCounts.byStatus['due']).toBeGreaterThanOrEqual(1);
    expect(pass.findingCounts.byClass['planned-vs-actual']).toBeGreaterThanOrEqual(1);
    for (const finding of pass.findings) {
      expect(finding.tenantId).toBe(TENANT);
      expect(finding.provenance.sources.length).toBeGreaterThanOrEqual(2);
      expect(finding.provenance.sources[0]!.referenceKind).toBe('delivery');
    }
  });

  it('DETERMINISM: identical inputs produce identical digests (replay-safe)', () => {
    const first = unwrap(evaluateSupervisionPass(evaluationInput()));
    const second = unwrap(evaluateSupervisionPass(evaluationInput()));
    expect(second.contentDigest).toBe(first.contentDigest);
    expect(second.findings.map((f) => f.contentDigest)).toEqual(
      first.findings.map((f) => f.contentDigest),
    );
  });

  it('DETERMINISM: a different evaluation instant changes the digest', () => {
    const first = unwrap(evaluateSupervisionPass(evaluationInput()));
    const second = unwrap(evaluateSupervisionPass(evaluationInput({ evaluatedAt: EVAL_PAST_FINISH, passId: 'pass:week-2' })));
    expect(second.contentDigest).not.toBe(first.contentDigest);
  });

  it('an input object carrying schedule-mutation vocabulary is RE-SCHEDULE-REJECTED before validation', () => {
    const error = expectError(evaluateSupervisionPass(evaluationInput({ reschedule: { plannedFinish: '2026-04-01T08:00:00.000Z' } })));
    expect(error.code).toBe('re-schedule-rejected');
  });

  it('an execution-issue summary carrying a proposed reschedule is RE-SCHEDULE-REJECTED', () => {
    const error = expectError(
      admitExecutionIssueSummary({
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
        proposedReschedule: { plannedFinish: '2026-04-01T08:00:00.000Z' },
      }),
    );
    expect(error.code).toBe('re-schedule-rejected');
  });

  it('a lead-time input carrying a revised planned finish is RE-SCHEDULE-REJECTED', () => {
    const error = expectError(
      admitLeadTimeRiskInput({
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
        impactedActivityIds: [ACTIVITY_ID],
        revisedPlannedFinish: '2026-04-01T08:00:00.000Z',
      }),
    );
    expect(error.code).toBe('re-schedule-rejected');
  });

  it('a program scoped to ANOTHER tenant is TENANT-ISOLATION-REJECTED (R12)', () => {
    const foreign = sealedProgram();
    const error = expectError(
      evaluateSupervisionPass(evaluationInput({ tenantId: OTHER_TENANT, program: foreign, delivery: openedDelivery({ tenantId: OTHER_TENANT }) })),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('an issue summary scoped to ANOTHER tenant is TENANT-ISOLATION-REJECTED at pass admission', () => {
    const error = expectError(
      evaluateSupervisionPass(
        evaluationInput({
          executionIssues: [
            {
              schema: 'epoch.supervision.execution-issue-summary',
              schemaVersion: 1,
              recordId: 'blocker:awaiting-survey',
              tenantId: OTHER_TENANT,
              solutionId: SOLUTION_ID,
              issueKind: 'blocker',
              severity: 'major',
              resolutionState: 'open',
              impact: { workPackageIds: [], activityIds: [ACTIVITY_ID], milestoneIds: [] },
              raisedAt: T3,
              contentDigest: ISSUE_DIGEST,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a delivery grounding a DIFFERENT baseline is DANGLING-REFERENCE-REJECTED', () => {
    const otherSolutionDelivery = openedDelivery({
      solutionId: 'solution:other-solution',
      solutionVersionDigest: 'e'.repeat(64),
    });
    const error = expectError(evaluateSupervisionPass(evaluationInput({ delivery: otherSolutionDelivery })));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('a malformed finding envelope is rejected (validation)', () => {
    const error = expectError(
      evaluateSupervisionPass(evaluationInput({ passId: 'not-a-pass-id' })),
    );
    expect(error.code).toBe('validation');
  });

  it('vendor fields on the input are VENDOR-FIELDS-REJECTED', () => {
    const error = expectError(evaluateSupervisionPass(evaluationInput({ vendorChannel: 'acme' })));
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a tampered program digest fails the W036 verification (tamper detection)', () => {
    const program = sealedProgram() as unknown as Record<string, unknown>;
    const tampered = { ...program, contentDigest: 'f'.repeat(64) };
    const error = expectError(evaluateSupervisionPass(evaluationInput({ program: tampered })));
    expect(error.code).toBe('validation');
    expect(error.message).toContain('W036');
  });
});

describe('verifySealedSupervisionPass (tamper detection)', () => {
  it('a sealed pass verifies and round-trips', () => {
    const pass = unwrap(evaluateSupervisionPass(evaluationInput()));
    const verified = unwrap(verifySealedSupervisionPass(JSON.parse(JSON.stringify(pass))));
    expect(verified.contentDigest).toBe(pass.contentDigest);
  });

  it('a TAMPERED digest is rejected (digest-mismatch)', () => {
    const pass = unwrap(evaluateSupervisionPass(evaluationInput()));
    const tampered = { ...pass, contentDigest: '0'.repeat(64) };
    const error = expectError(verifySealedSupervisionPass(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a tampered finding INSIDE a sealed pass is rejected (digest-mismatch)', () => {
    const pass = unwrap(evaluateSupervisionPass(evaluationInput()));
    const tampered = {
      ...pass,
      findings: pass.findings.map((finding, index) =>
        index === 0 ? { ...finding, status: 'blocked' } : finding,
      ),
    };
    const error = expectError(verifySealedSupervisionPass(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('projectSupervisionState (the derived supervision-state projection)', () => {
  it('folds the latest observed status per finding across passes (input order never leaks)', () => {
    const pass1 = unwrap(evaluateSupervisionPass(evaluationInput()));
    const pass2 = unwrap(
      evaluateSupervisionPass(evaluationInput({ passId: 'pass:week-2', evaluatedAt: EVAL_PAST_FINISH })),
    );
    const forward = projectSupervisionState([pass1, pass2]);
    const backward = projectSupervisionState([pass2, pass1]);
    expect(JSON.stringify(forward)).toBe(JSON.stringify(backward));

    expect(forward.passCount).toBe(2);
    expect(forward.latestPassDigest).toBe(pass2.contentDigest);
    const excavate = forward.findings.find(
      (row) => row.findingId === 'finding:planned-vs-actual-activity-activity-excavate',
    );
    expect(excavate).toBeDefined();
    expect(excavate!.status).toBe('late'); // upgraded from due by pass 2
    expect(excavate!.firstSeenPassDigest).toBe(pass1.contentDigest);
    expect(excavate!.presentInLatestPass).toBe(true);
  });

  it('a finding absent from the latest pass keeps its last status with presentInLatestPass=false', () => {
    const pass1 = unwrap(evaluateSupervisionPass(evaluationInput()));
    // pass 2 evaluates LATER with every activity completed and the gate
    // passed: the finding set is empty, so pass-1 findings keep their
    // last observed status but are absent from the latest pass.
    const completed = sealedProgram({
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks package',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [{ approvedBy: PRINCIPAL, approvedAt: T3 }],
          verificationGates: [
            {
              gateId: 'gate:excavation-inspection',
              activityId: ACTIVITY_ID,
              title: 'Excavation inspection',
              method: 'method:visual-inspection',
              evidence: [],
              passedAt: '2026-03-03T09:00:00.000Z',
              passedBy: PRINCIPAL,
            },
          ],
          activities: [
            {
              activityId: ACTIVITY_ID,
              workPackageId: 'work-package:earthworks',
              title: 'Activity excavate',
              plannedStart: '2026-03-01T08:00:00.000Z',
              plannedFinish: '2026-03-03T08:00:00.000Z',
              plannedQuantity: { value: '100', unit: 'm3' },
              plannedCost: { amount: '1000', currency: 'EUR' },
              predecessors: [],
              successors: [ACTIVITY_ID_B],
              resources: [],
              blockers: [],
              evidence: [],
              constraintReferences: [],
              actualFinish: '2026-03-03T07:00:00.000Z',
            },
            {
              activityId: ACTIVITY_ID_B,
              workPackageId: 'work-package:earthworks',
              title: 'Activity grade',
              plannedStart: '2026-03-03T08:00:00.000Z',
              plannedFinish: '2026-03-05T08:00:00.000Z',
              plannedQuantity: { value: '50', unit: 'm3' },
              plannedCost: { amount: '500', currency: 'EUR' },
              predecessors: [ACTIVITY_ID],
              successors: [ACTIVITY_ID_C],
              resources: [],
              blockers: [],
              evidence: [],
              constraintReferences: [],
              actualFinish: '2026-03-04T07:00:00.000Z',
            },
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
          activities: [
            {
              activityId: ACTIVITY_ID_C,
              workPackageId: 'work-package:structure',
              title: 'Activity pour',
              plannedStart: '2026-03-05T08:00:00.000Z',
              plannedFinish: '2026-03-10T08:00:00.000Z',
              predecessors: [ACTIVITY_ID_B],
              successors: [],
              resources: [],
              blockers: [],
              evidence: [],
              constraintReferences: [],
              actualFinish: '2026-03-09T07:00:00.000Z',
            },
          ],
        },
      ],
      milestones: [
        {
          milestoneId: 'milestone:earthworks-complete',
          title: 'Earthworks complete',
          activityIds: [ACTIVITY_ID],
          status: 'reached',
          reachedAt: '2026-03-03T07:30:00.000Z',
          evidence: [],
        },
      ],
    });
    const pass2 = unwrap(
      evaluateSupervisionPass(
        evaluationInput({
          passId: 'pass:week-final',
          evaluatedAt: '2026-03-12T12:00:00.000Z',
          program: completed,
        }),
      ),
    );
    expect(pass2.findings).toHaveLength(0);
    const projection = projectSupervisionState([pass1, pass2]);
    const excavate = projection.findings.find(
      (row) => row.findingId === 'finding:planned-vs-actual-activity-activity-excavate',
    );
    expect(excavate).toBeDefined();
    expect(excavate!.presentInLatestPass).toBe(false);
    expect(projection.counts.presentInLatestPass).toBe(0);
  });
});
