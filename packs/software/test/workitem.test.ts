// NAMED POSITIVE: the work-item vocabulary + THE DISPLAY-STATE MAPPING —
// issue-tracker states DERIVE from canonical lifecycle states on the W036
// Activity (actualFinish / actualStart / actualProgress / blockers); the
// canonical DeliveryRecord state is the ONLY truth.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Activity } from '@epoch/solution-delivery';
import {
  ACTIVITY_DISPLAY_STATES,
  ISSUE_DISPLAY_STATE_TERMS,
  activityDisplayStateOf,
  workItemKindOf,
  workItemTermOf,
  workPackageDisplayStateOf,
  WorkItemIndexSchema,
} from '../src/index';
import { T1, T2, workItemIndex } from './fixtures';

// A local validator mirroring the W036 activity requirements for fixture
// construction (avoids importing non-exported internals).
const WorkItemActivitySchema = z.object({
  activityId: z.string(),
  workPackageId: z.string(),
  title: z.string(),
  predecessors: z.array(z.string()),
  successors: z.array(z.string()),
  resources: z.array(z.unknown()),
  constraintReferences: z.array(z.unknown()),
  blockers: z.array(z.unknown()),
  evidence: z.array(z.unknown()),
  actualStart: z.string().optional(),
  actualFinish: z.string().optional(),
  actualProgress: z.number().min(0).max(1).optional(),
}) as unknown as z.ZodType<Activity>;

/** Build a minimal canonical activity with overrides. */
function activity(overrides: Partial<Activity> = {}): Activity {
  return WorkItemActivitySchema.parse({
    activityId: 'activity:test-item',
    workPackageId: 'work-package:test-package',
    title: 'Test activity',
    predecessors: [],
    successors: [],
    resources: [],
    constraintReferences: [],
    blockers: [],
    evidence: [],
    ...overrides,
  });
}

describe('NAMED: display-state mapping (canonical lifecycle states -> display states)', () => {
  it('an activity with NO actuals projects not-started (Backlog)', () => {
    const state = activityDisplayStateOf(activity());
    expect(state).toBe('not-started');
    expect(ISSUE_DISPLAY_STATE_TERMS[state]).toBe('Backlog');
  });

  it('an activity with an actualStart but unfinished projects in-progress (In Progress)', () => {
    const state = activityDisplayStateOf(activity({ actualStart: T1, actualProgress: 0.4 }));
    expect(state).toBe('in-progress');
    expect(ISSUE_DISPLAY_STATE_TERMS[state]).toBe('In Progress');
  });

  it('an activity with an actualFinish projects complete (Done)', () => {
    const state = activityDisplayStateOf(activity({ actualStart: T1, actualFinish: T2, actualProgress: 1 }));
    expect(state).toBe('complete');
    expect(ISSUE_DISPLAY_STATE_TERMS[state]).toBe('Done');
  });

  it('an activity with FULL actual progress after starting projects complete (Done)', () => {
    const state = activityDisplayStateOf(activity({ actualStart: T1, actualProgress: 1 }));
    expect(state).toBe('complete');
  });

  it('an activity carrying blockers projects impeded (Blocked) — the actionable state wins', () => {
    const state = activityDisplayStateOf(
      activity({
        actualStart: T1,
        actualProgress: 0.2,
        blockers: [
          {
            blockerId: 'blocker:test-blocker',
            description: 'Impeded by an unresolved dependency',
            raisedAt: T2,
            raisedBy: 'principal:delivery-lead',
          },
        ],
      }),
    );
    expect(state).toBe('impeded');
    expect(ISSUE_DISPLAY_STATE_TERMS[state]).toBe('Blocked');
  });

  it('a COMPLETED activity with residual blockers stays complete (the fact is finished)', () => {
    const state = activityDisplayStateOf(
      activity({
        actualStart: T1,
        actualFinish: T2,
        actualProgress: 1,
        blockers: [
          {
            blockerId: 'blocker:test-blocker',
            description: 'A recorded residual impediment',
            raisedAt: T2,
            raisedBy: 'principal:delivery-lead',
          },
        ],
      }),
    );
    expect(state).toBe('complete');
  });

  it('the display-state vocabulary is closed: exactly the four derived states', () => {
    expect(ACTIVITY_DISPLAY_STATES).toEqual(['not-started', 'in-progress', 'impeded', 'complete']);
  });
});

describe('NAMED: work-package display-state fold (derived from its activities)', () => {
  it('an activity-less work package is not-started', () => {
    expect(workPackageDisplayStateOf([])).toBe('not-started');
  });

  it('all activities complete -> complete', () => {
    expect(
      workPackageDisplayStateOf([
        activity({ actualStart: T1, actualFinish: T2, actualProgress: 1 }),
        activity({ actualStart: T1, actualFinish: T2, actualProgress: 1 }),
      ]),
    ).toBe('complete');
  });

  it('any impeded activity -> impeded (over in-progress)', () => {
    expect(
      workPackageDisplayStateOf([
        activity({ actualStart: T1, actualProgress: 0.3 }),
        activity({
          blockers: [
            {
              blockerId: 'blocker:test-blocker',
              description: 'Impeded',
              raisedAt: T2,
              raisedBy: 'principal:delivery-lead',
            },
          ],
        }),
      ]),
    ).toBe('impeded');
  });

  it('any in-progress activity -> in-progress (when none impeded/complete)', () => {
    expect(
      workPackageDisplayStateOf([activity({ actualStart: T1, actualProgress: 0.3 }), activity()]),
    ).toBe('in-progress');
  });

  it('partially delivered (some complete, rest planned) -> in-progress (the work has begun)', () => {
    expect(
      workPackageDisplayStateOf([
        activity({ actualStart: T1, actualFinish: T2, actualProgress: 1 }),
        activity(),
        activity(),
      ]),
    ).toBe('in-progress');
  });

  it('only planned activities -> not-started', () => {
    expect(workPackageDisplayStateOf([activity(), activity()])).toBe('not-started');
  });
});

describe('NAMED POSITIVE: the work-item classification index', () => {
  it('the fixture index parses through the schema', () => {
    expect(WorkItemIndexSchema.safeParse(workItemIndex()).success).toBe(true);
  });

  it('classified activities resolve to their display kind; others default to issue', () => {
    const index = workItemIndex();
    expect(workItemKindOf(index, 'activity:migration-run')).toBe('task');
    expect(workItemKindOf(index, 'activity:observability-setup')).toBe('change');
    expect(workItemKindOf(index, 'activity:api-implement')).toBe('issue');
  });

  it('an empty/missing index classifies every activity as an issue', () => {
    expect(workItemKindOf(undefined, 'activity:api-implement')).toBe('issue');
    expect(
      workItemKindOf({ schema: 'epoch.pack-software.work-item-index', schemaVersion: 1, assignments: [] }, 'activity:any'),
    ).toBe('issue');
  });

  it('the display terms are the pack vocabulary', () => {
    expect(workItemTermOf('epic')).toBe('Epic');
    expect(workItemTermOf('issue')).toBe('Issue');
    expect(workItemTermOf('task')).toBe('Task');
    expect(workItemTermOf('change')).toBe('Change');
  });

  it('an unsorted index is rejected (deterministic serialization)', () => {
    const parsed = WorkItemIndexSchema.safeParse({
      schema: 'epoch.pack-software.work-item-index',
      schemaVersion: 1,
      assignments: [
        { activityId: 'activity:zzz-late', workItemKind: 'task' },
        { activityId: 'activity:aaa-early', workItemKind: 'task' },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
