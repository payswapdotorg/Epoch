/**
 * Software work-item vocabulary (DP1.0 "terminology"): epics / issues /
 * tasks / changes as DISPLAY terms bound onto canonical work-package and
 * activity lines — plus the CANONICAL ACTIVITY DISPLAY-STATE derivation.
 *
 * - The issue-tracker view is a PROJECTION of ProgramOfWork lines: the
 *   pack exposes NO stored issue state (`parallel-tracker-rejected`
 *   classifies any stored-tracker attempt at the pack admission surfaces).
 * - Display states are DERIVED from the canonical lifecycle states on a
 *   W036 Activity (actualFinish / actualStart / actualProgress /
 *   blockers) — the canonical DeliveryRecord state is the ONLY truth; a
 *   display state is recomputed on every projection, never stored.
 * - The work-item classification index is CALLER-SUPPLIED typed data
 *   referencing canonical activity ids (the rate-library-shaped record
 *   pattern) — it references canonical ids and stores nothing.
 */
import { z } from 'zod';
import { QualifiedNameSchema, type Activity } from '@epoch/solution-delivery';
import {
  ACTIVITY_DISPLAY_STATES,
  SOFTWARE_PACK_RECORD_VERSION,
  WORK_ITEM_KINDS,
  WORK_ITEM_TERMS,
  type ActivityDisplayState,
  type WorkItemKind,
} from './version';
import { refineSortedUnique } from './util';

// --------------------------------------------------------------------------------
// The work-item descriptors (vocabulary data).
// --------------------------------------------------------------------------------

/** One work-item descriptor: a display kind bound onto a canonical anchor kind. */
export const WorkItemDescriptorSchema = z
  .strictObject({
    schema: z.literal('epoch.pack-software.work-item'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    workItemId: QualifiedNameSchema,
    kind: z.enum(WORK_ITEM_KINDS),
    /** The canonical ProgramOfWork anchor this display kind binds onto. */
    anchorKind: z.enum(['work-package', 'activity']),
    title: z.string().min(1).max(256),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'WorkItemDescriptor',
    title: 'WorkItemDescriptor',
    description:
      'One software work-item descriptor: a display kind (epic/issue/task/change) bound onto a canonical ProgramOfWork anchor kind (work-package/activity) — display vocabulary, never a parallel tracker.',
  });

/** One work-item descriptor. */
export type WorkItemDescriptor = z.infer<typeof WorkItemDescriptorSchema>;

/**
 * The software work items: typed vocabulary data binding epics onto work
 * packages and issues/tasks/changes onto activities, sorted by workItemId
 * ascending, duplicate-free.
 */
export const SOFTWARE_WORK_ITEMS: readonly WorkItemDescriptor[] = [
  {
    schema: 'epoch.pack-software.work-item',
    schemaVersion: 1,
    workItemId: 'software.work-item.change',
    kind: 'change',
    anchorKind: 'activity',
    title: 'Change',
    description:
      'Changes — the display term for canonical activities raised as change requests (scope or operational changes realized through the same activity spine).',
  },
  {
    schema: 'epoch.pack-software.work-item',
    schemaVersion: 1,
    workItemId: 'software.work-item.epic',
    kind: 'epic',
    anchorKind: 'work-package',
    title: 'Epic',
    description:
      'Epics — the display term for canonical work packages: a shippable slice of the solution realized through its activity issues.',
  },
  {
    schema: 'epoch.pack-software.work-item',
    schemaVersion: 1,
    workItemId: 'software.work-item.issue',
    kind: 'issue',
    anchorKind: 'activity',
    title: 'Issue',
    description:
      'Issues — the default display term for canonical activities: trackable units of realization work inside their epic work package.',
  },
  {
    schema: 'epoch.pack-software.work-item',
    schemaVersion: 1,
    workItemId: 'software.work-item.task',
    kind: 'task',
    anchorKind: 'activity',
    title: 'Task',
    description:
      'Tasks — the display term for canonical activities classified as routine, low-ceremony units of work (the classification is caller-supplied typed data).',
  },
];

// --------------------------------------------------------------------------------
// The work-item classification index (caller-supplied typed data).
// --------------------------------------------------------------------------------

/**
 * The work-item classification index: activity ids of the ProgramOfWork
 * mapped to the issue/task/change display kinds. Sorted by activityId
 * ascending, duplicate-free — typed data that REFERENCES canonical
 * activity ids and stores nothing (never a parallel tracker).
 */
export const WorkItemIndexSchema = z
  .strictObject({
    schema: z.literal('epoch.pack-software.work-item-index'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    assignments: z
      .array(
        z
          .strictObject({
            activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
            workItemKind: z.enum(['issue', 'task', 'change']),
          })
          .readonly(),
      )
      .max(1024),
  })
  .readonly()
  .superRefine((index, ctx) => {
    refineSortedUnique(index.assignments, ctx, 'assignments', 'activityId');
  })
  .meta({
    id: 'WorkItemIndex',
    title: 'WorkItemIndex',
    description:
      'The work-item classification index: activity ids mapped to the issue/task/change display kinds (sorted, duplicate-free; references canonical ProgramOfWork activity ids — never a parallel tracker).',
  });

/** One work-item classification index. */
export type WorkItemIndex = z.infer<typeof WorkItemIndexSchema>;

/** The activity-anchored work-item kinds (epics bind onto work packages). */
export type ActivityWorkItemKind = Exclude<WorkItemKind, 'epic'>;

/**
 * Resolve the display kind of one activity through the classification
 * index: the caller's assignment when present, otherwise the deterministic
 * `issue` default. Pure and total — an empty index classifies every
 * activity as an issue.
 */
export function workItemKindOf(
  index: WorkItemIndex | undefined,
  activityId: string,
): ActivityWorkItemKind {
  const assignment = index?.assignments.find((candidate) => candidate.activityId === activityId);
  return assignment?.workItemKind ?? 'issue';
}

/** The display term of one work-item kind (presentation vocabulary only). */
export function workItemTermOf(kind: WorkItemKind): string {
  return WORK_ITEM_TERMS[kind];
}

// --------------------------------------------------------------------------------
// The canonical activity display-state derivation (pure fold; never stored).
// --------------------------------------------------------------------------------

/**
 * Derive the display state of one canonical activity from its canonical
 * lifecycle states:
 * - `complete` — the activity records an actualFinish, or full actual
 *   progress (1) after starting;
 * - `impeded` — the activity carries unresolved blockers (an impediment is
 *   the actionable state, so it wins over in-progress);
 * - `in-progress` — the activity has actually started;
 * - `not-started` — none of the above (planned work).
 *
 * The result is a PROJECTION: the canonical W036 Activity/DeliveryRecord
 * state is the ONLY truth; this fold is recomputed on every call and never
 * stored anywhere.
 */
export function activityDisplayStateOf(activity: Activity): ActivityDisplayState {
  if (
    activity.actualFinish !== undefined ||
    (activity.actualStart !== undefined && activity.actualProgress === 1)
  ) {
    return 'complete';
  }
  if (activity.blockers.length > 0) {
    return 'impeded';
  }
  if (activity.actualStart !== undefined) {
    return 'in-progress';
  }
  return 'not-started';
}

/** The zod validator of the canonical activity display-state vocabulary. */
export const ActivityDisplayStateSchema = z.enum(ACTIVITY_DISPLAY_STATES);

/**
 * Derive the display state of one work package from its activities: all
 * complete -> complete; any impeded -> impeded; any in-progress, or any
 * complete without the rest (partially delivered), -> in-progress (the
 * work has begun but is not finished); otherwise not-started. An
 * activity-less package is not-started. Deterministic fold — input order
 * never leaks.
 */
export function workPackageDisplayStateOf(activities: readonly Activity[]): ActivityDisplayState {
  if (activities.length === 0) {
    return 'not-started';
  }
  const states = activities.map((activity) => activityDisplayStateOf(activity));
  if (states.every((state) => state === 'complete')) {
    return 'complete';
  }
  if (states.includes('impeded')) {
    return 'impeded';
  }
  if (states.includes('in-progress') || states.includes('complete')) {
    return 'in-progress';
  }
  return 'not-started';
}
