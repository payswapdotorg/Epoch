/**
 * Agent task-specific projections (the W041 dispatch pin): a
 * TaskProjectionContext narrows a projection to the task's object scope —
 * the work-package/activity ids a task references — and every task row is
 * NARROWER than the role baseline, never wider
 * (`task-escalation-rejected`).
 *
 * The narrowing check is a pure function over two policy rows (the W004
 * policy-entitlement discipline applied to projection data): a task row
 * must not add actions, fields, evidence digests or section visibility
 * beyond what the agent's role row already grants.
 */
import { z } from 'zod';
import { WorkPackageIdSchema } from '@epoch/solution-delivery';
import { ActivityIdMirrorSchema, AgentTaskClassSchema } from './primitives';
import type { PolicyBinding } from './policy';
import type { AccessProjectionError } from './errors';

/**
 * One task projection context: the task class (whose policy row applies)
 * plus the task's object scope (which work packages/activities the task
 * references). Entries outside the scope become `task-scoped` redaction
 * markers; an EMPTY scope list means no narrowing on that dimension
 * (work packages or activities).
 */
export const TaskProjectionContextSchema = z
  .strictObject({
    taskClass: AgentTaskClassSchema,
    workPackageIds: z.array(WorkPackageIdSchema).max(256),
    activityIds: z.array(ActivityIdMirrorSchema).max(256),
  })
  .readonly()
  .superRefine((context, ctx) => {
    for (let i = 1; i < context.workPackageIds.length; i += 1) {
      if (context.workPackageIds[i]! < context.workPackageIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'workPackageIds must be sorted ascending (deterministic serialization)',
          path: ['workPackageIds'],
        });
        break;
      }
      if (context.workPackageIds[i]! === context.workPackageIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'workPackageIds must be duplicate-free',
          path: ['workPackageIds'],
        });
        break;
      }
    }
    for (let i = 1; i < context.activityIds.length; i += 1) {
      if (context.activityIds[i]! < context.activityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'activityIds must be sorted ascending (deterministic serialization)',
          path: ['activityIds'],
        });
        break;
      }
      if (context.activityIds[i]! === context.activityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'activityIds must be duplicate-free',
          path: ['activityIds'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'TaskProjectionContext',
    title: 'TaskProjectionContext',
    description:
      'Agent task projection context: the task class whose policy row applies plus the task object scope (sorted work-package/activity ids the task references).',
  });

/** One task projection context. */
export type TaskProjectionContext = z.infer<typeof TaskProjectionContextSchema>;

/** Whether one evidence scope is at most as permissive as another. */
function evidenceNarrowerOrEqual(
  task: PolicyBinding['scopeFilters']['evidence'],
  role: PolicyBinding['scopeFilters']['evidence'],
): boolean {
  if (role.mode === 'all') return true;
  if (role.mode === 'none') return task.mode === 'none';
  // role.mode === 'listed': the task scope must be 'none' or a
  // digest-subset 'listed'.
  if (task.mode === 'none') return true;
  if (task.mode !== 'listed') return false;
  const granted = new Set(role.allowedDigests);
  return task.allowedDigests.every((digest) => granted.has(digest));
}

/** Whether one visibility is at most as permissive as another. */
function visibilityNarrowerOrEqual(
  task: 'visible' | 'hidden',
  role: 'visible' | 'hidden',
): boolean {
  if (role === 'visible') return true;
  return task === 'hidden';
}

/**
 * The task-narrowing check (the dispatch pin: "narrower than the role
 * baseline, never wider"). Returns the typed
 * `task-escalation-rejected` error when the task row breaches the role
 * baseline, or null when the task row is entailed by it.
 */
export function taskEscalationError(
  roleBinding: PolicyBinding,
  taskBinding: PolicyBinding,
  taskClass: string,
  role: string | undefined,
): AccessProjectionError | null {
  const breaches: string[] = [];
  for (const action of taskBinding.allowedActions) {
    if (!roleBinding.allowedActions.includes(action)) {
      breaches.push(`allowedActions+${action}`);
    }
  }
  for (const template of taskBinding.fieldAllowlist) {
    if (!roleBinding.fieldAllowlist.includes(template)) {
      breaches.push(`fieldAllowlist+${template}`);
    }
  }
  if (
    !evidenceNarrowerOrEqual(
      taskBinding.scopeFilters.evidence,
      roleBinding.scopeFilters.evidence,
    )
  ) {
    breaches.push('scopeFilters.evidence');
  }
  if (
    !visibilityNarrowerOrEqual(
      taskBinding.scopeFilters.commercial,
      roleBinding.scopeFilters.commercial,
    )
  ) {
    breaches.push('scopeFilters.commercial');
  }
  if (
    !visibilityNarrowerOrEqual(
      taskBinding.scopeFilters.supplier,
      roleBinding.scopeFilters.supplier,
    )
  ) {
    breaches.push('scopeFilters.supplier');
  }
  if (breaches.length === 0) return null;
  return {
    code: 'task-escalation-rejected',
    message:
      `the task-class row "${taskClass}" is WIDER than the role baseline${role === undefined ? '' : ` "${role}"`} ` +
      `for the same object class — a task projection may only narrow (breaches: ${breaches.sort().join(', ')})`,
    taskClass,
    ...(role !== undefined ? { role } : {}),
    breaches: breaches.sort(),
  };
}
