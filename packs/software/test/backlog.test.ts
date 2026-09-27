// NAMED POSITIVE: the issue/backlog projection — epics over canonical
// work packages, issues over canonical activities (identity-mapped ids,
// NEVER minted), display states DERIVED from canonical lifecycle states,
// observation/actual links from the canonical DeliveryRecord. The pack
// exposes NO stored issue state (parallel-tracker-rejected covers the
// admission surfaces; see negative.test.ts).
import { describe, expect, it } from 'vitest';
import {
  projectBacklog,
  verifyBacklogView,
} from '../src/index';
import {
  checkoutChain,
  sealedProgram,
  sealedSolution,
  workItemIndex,
} from './fixtures';

describe('NAMED POSITIVE: the backlog view projects the sealed state', () => {
  const chain = checkoutChain();
  const backlog = projectBacklog({
    program: chain.program,
    delivery: chain.delivery,
    workItemIndex: workItemIndex(),
  });
  if (!backlog.ok) {
    throw new Error('fixture backlog failed to project');
  }
  const view = backlog.value;

  it('the view carries the canonical identity + the delivery anchor', () => {
    expect(view.tenantId).toBe('tenant:globex');
    expect(view.solutionId).toBe('solution:checkout-service');
    expect(view.programId).toBe('program:checkout-service-v1');
    expect(view.deliveryId).toBe('delivery:checkout-service-v1');
    expect(view.title).toBe('Issue tracker (backlog)');
  });

  it('every epic row is identity-mapped to its canonical work-package id', () => {
    const packageIds = new Set(chain.program.workPackages.map((wp) => wp.workPackageId));
    expect(view.epics).toHaveLength(5);
    for (const epic of view.epics) {
      expect(packageIds.has(epic.workPackageId)).toBe(true);
      expect(epic.workItemKind).toBe('epic');
      expect(epic.workItemTerm).toBe('Epic');
    }
  });

  it('every issue row is identity-mapped to its canonical activity id', () => {
    const activityIds = new Set(
      chain.program.workPackages.flatMap((wp) => wp.activities.map((a) => a.activityId)),
    );
    expect(view.issues).toHaveLength(13);
    for (const issue of view.issues) {
      expect(activityIds.has(issue.activityId)).toBe(true);
    }
  });

  it('the work-item kinds derive from the classification index (task/change/issue)', () => {
    const byId = new Map(view.issues.map((issue) => [issue.activityId, issue]));
    expect(byId.get('activity:migration-run')?.workItemKind).toBe('task');
    expect(byId.get('activity:migration-run')?.workItemTerm).toBe('Task');
    expect(byId.get('activity:observability-setup')?.workItemKind).toBe('change');
    expect(byId.get('activity:observability-setup')?.workItemTerm).toBe('Change');
    expect(byId.get('activity:api-implement')?.workItemKind).toBe('issue');
    expect(byId.get('activity:api-implement')?.workItemTerm).toBe('Issue');
    expect(view.summary.workItemKindCounts).toEqual({ issue: 10, task: 2, change: 1 });
  });

  it('the issue display states derive from the canonical lifecycle states', () => {
    const byId = new Map(view.issues.map((issue) => [issue.activityId, issue]));
    // not-started (Backlog)
    expect(byId.get('activity:api-design')?.displayState).toBe('not-started');
    expect(byId.get('activity:api-design')?.displayStateTerm).toBe('Backlog');
    // in-progress (In Progress)
    expect(byId.get('activity:api-implement')?.displayState).toBe('in-progress');
    expect(byId.get('activity:api-implement')?.displayStateTerm).toBe('In Progress');
    // complete (Done)
    expect(byId.get('activity:deploy-staging')?.displayState).toBe('complete');
    expect(byId.get('activity:deploy-staging')?.displayStateTerm).toBe('Done');
    // impeded (Blocked)
    expect(byId.get('activity:deploy-production')?.displayState).toBe('impeded');
    expect(byId.get('activity:deploy-production')?.displayStateTerm).toBe('Blocked');
    expect(byId.get('activity:deploy-production')?.blockerIds).toEqual(['blocker:change-freeze']);
    expect(view.summary.displayStateCounts).toEqual({
      'not-started': 6,
      'in-progress': 1,
      impeded: 1,
      complete: 5,
    });
  });

  it('the epic display states fold over their activities', () => {
    const byId = new Map(view.epics.map((epic) => [epic.workPackageId, epic]));
    expect(byId.get('work-package:environments')?.displayState).toBe('in-progress');
    expect(byId.get('work-package:release-rollout')?.displayState).toBe('impeded');
    expect(byId.get('work-package:api-build')?.displayState).toBe('in-progress');
  });

  it('observations/actuals link by canonical subject ids', () => {
    const byId = new Map(view.issues.map((issue) => [issue.activityId, issue]));
    expect(byId.get('activity:api-implement')?.observationIds).toEqual(['observation:api-progress']);
    expect(byId.get('activity:api-implement')?.actualIds).toEqual(['actual:api-effort']);
    expect(byId.get('activity:deploy-staging')?.observationIds).toEqual([
      'observation:staging-deployment',
    ]);
    const epic = view.epics.find((epic) => epic.workPackageId === 'work-package:release-rollout');
    expect(epic?.observationIds).toEqual(['observation:rollout-package']);
    expect(epic?.actualIds).toEqual([]);
  });

  it('issue rows carry assignees, gates and milestones from the canonical state', () => {
    const byId = new Map(view.issues.map((issue) => [issue.activityId, issue]));
    expect(byId.get('activity:api-implement')?.assignee).toBe('principal:backend-lead');
    expect(byId.get('activity:api-implement')?.gateIds).toEqual(['gate:api-review']);
    expect(byId.get('activity:deploy-staging')?.gateIds).toEqual(['gate:staging-slo-check']);
    expect(byId.get('activity:deploy-staging')?.milestoneIds).toEqual(['milestone:staging-release']);
  });

  it('the view round-trips through verification', () => {
    const verified = verifyBacklogView(JSON.parse(JSON.stringify(view)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(view);
    }
  });
});

describe('NAMED POSITIVE: the backlog projection under partial data (SN1.0)', () => {
  it('without a delivery record the view projects with empty links (never a blocker)', () => {
    const program = sealedProgram(sealedSolution());
    const backlog = projectBacklog({ program });
    if (!backlog.ok) {
      throw new Error('partial backlog failed to project');
    }
    expect(backlog.value.deliveryId).toBeUndefined();
    for (const issue of backlog.value.issues) {
      expect(issue.observationIds).toEqual([]);
      expect(issue.actualIds).toEqual([]);
    }
    expect(backlog.value.issues).toHaveLength(13);
  });

  it('without a work-item index every activity classifies as an issue', () => {
    const program = sealedProgram(sealedSolution());
    const backlog = projectBacklog({ program });
    if (!backlog.ok) {
      throw new Error('partial backlog failed to project');
    }
    expect(backlog.value.summary.workItemKindCounts).toEqual({ issue: 13, task: 0, change: 0 });
  });
});

describe('NAMED NEGATIVE: the backlog projection rejects malformed inputs', () => {
  it('a tampered program seal is rejected (digest-mismatch)', () => {
    const program = sealedProgram(sealedSolution());
    const tampered = { ...program, title: 'Tampered programme' };
    const backlog = projectBacklog({ program: tampered });
    expect(backlog.ok).toBe(false);
    if (!backlog.ok) {
      expect(backlog.error.code).toBe('digest-mismatch');
    }
  });

  it('a tampered delivery seal is rejected (digest-mismatch)', () => {
    const chain = checkoutChain();
    const tampered = { ...chain.delivery, openedBy: 'principal:attacker' };
    const backlog = projectBacklog({ program: chain.program, delivery: tampered });
    expect(backlog.ok).toBe(false);
    if (!backlog.ok) {
      expect(backlog.error.code).toBe('digest-mismatch');
    }
  });

  it('a non-object input is a validation error, never a crash', () => {
    const backlog = projectBacklog({ program: 'not-a-program' as never });
    expect(backlog.ok).toBe(false);
  });
});
