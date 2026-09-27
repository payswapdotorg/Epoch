/**
 * The issue/backlog projection (W027, the DP1.0 projection rule): a typed
 * issue-tracker VIEW MODEL as a PURE FOLD over the W036 sealed state — the
 * work packages and activities of the `SealedProgramOfWork` (identity-
 * mapped to their canonical ids — the SAME ids, never minted), the work-
 * item display vocabulary (epics/issues/tasks/changes), and the
 * observations/actuals of the optional `SealedDeliveryRecord` linked by
 * canonical subject ids.
 *
 * - The issue-tracker view is a PROJECTION of ProgramOfWork lines: the
 *   pack exposes NO stored issue state (`parallel-tracker-rejected`
 *   classifies any stored-tracker attempt at the pack admission surfaces).
 * - Issue display states are DERIVED from the canonical lifecycle states
 *   on each activity (actualFinish / actualStart / actualProgress /
 *   blockers) through the shared display-state fold; the canonical
 *   DeliveryRecord state is the ONLY truth.
 * - Partial data follows SN1.0: a missing delivery record links no
 *   observations/actuals; a missing work-item index classifies every
 *   activity as an issue — never blockers.
 */
import { z } from 'zod';
import {
  Sha256HexSchema,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  type SealedDeliveryRecord,
  type SealedProgramOfWork,
} from '@epoch/solution-delivery';
import {
  ACTIVITY_DISPLAY_STATES,
  BACKLOG_VIEW_SCHEMA_NAME,
  ISSUE_DISPLAY_STATE_TERMS,
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
  WORK_ITEM_TERMS,
  type ActivityDisplayState,
} from './version';
import { classifyPackRecord, digestOf } from './util';
import type { PackResult } from './errors';
import { SOFTWARE_STAGE_VOCABULARY } from './profile';
import {
  activityDisplayStateOf,
  workPackageDisplayStateOf,
  workItemKindOf,
  workItemTermOf,
  type WorkItemIndex,
} from './workitem';

// --------------------------------------------------------------------------------
// The backlog view model.
// --------------------------------------------------------------------------------

/** One epic view row: the canonical work package with issue-tracker vocabulary. */
export const BacklogEpicSchema = z
  .strictObject({
    /** The canonical work-package id — the SAME id, never minted. */
    workPackageId: z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The display kind of this row (always `epic` — work packages bind the epic term). */
    workItemKind: z.literal('epic'),
    /** The display term of the work-item kind. */
    workItemTerm: z.string().min(1).max(64),
    /** The derived display state (a fold over the canonical activity states). */
    displayState: z.enum(ACTIVITY_DISPLAY_STATES),
    /** The issue-tracker display term of the state. */
    displayStateTerm: z.string().min(1).max(64),
    /** The canonical solution line this epic realizes (when linked). */
    solutionLineId: z.string().regex(/^line:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    /** The canonical activity ids inside this epic. */
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The canonical milestone ids touching this epic's activities. */
    milestoneIds: z.array(z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The observation ids recorded against this work package (canonical). */
    observationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
    /** The actual ids derived from those observations (canonical). */
    actualIds: z.array(z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
  })
  .readonly()
  .meta({
    id: 'BacklogEpic',
    title: 'BacklogEpic',
    description:
      'One epic view row: the canonical work package (identity-mapped id) with the epic display term, its DERIVED display state, and the canonical activity/milestone/observation/actual links.',
  });

/** One epic view row. */
export type BacklogEpic = z.infer<typeof BacklogEpicSchema>;

/** One issue view row: the canonical activity with issue-tracker vocabulary. */
export const BacklogIssueSchema = z
  .strictObject({
    /** The canonical activity id — the SAME id, never minted. */
    activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The canonical work-package (epic) id owning the activity. */
    workPackageId: z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The display kind: issue (default), task or change (from the classification index). */
    workItemKind: z.enum(['issue', 'task', 'change']),
    /** The display term of the work-item kind. */
    workItemTerm: z.string().min(1).max(64),
    /** The derived display state (from the canonical lifecycle states). */
    displayState: z.enum(ACTIVITY_DISPLAY_STATES),
    /** The issue-tracker display term of the state (Backlog/In Progress/Blocked/Done). */
    displayStateTerm: z.string().min(1).max(64),
    /** The canonical responsible actor (the issue assignee), when set. */
    assignee: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    /** The planned effort/quantity of the underlying activity. */
    plannedQuantity: z
      .strictObject({
        value: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        unit: z.string().min(1).max(32),
      })
      .readonly()
      .optional(),
    predecessors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    successors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The canonical verification-gate ids gating this issue. */
    gateIds: z.array(z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
    /** The canonical blocker ids raised against this issue. */
    blockerIds: z.array(z.string().regex(/^blocker:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
    /** The canonical milestone ids carrying this issue. */
    milestoneIds: z.array(z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The observation ids recorded against this activity (canonical). */
    observationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
    /** The actual ids derived from those observations (canonical). */
    actualIds: z.array(z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
  })
  .readonly()
  .meta({
    id: 'BacklogIssue',
    title: 'BacklogIssue',
    description:
      'One issue view row: the canonical activity (identity-mapped id) with its work-item display kind, DERIVED display state, assignee, dependencies, gates, blockers, milestones and observation/actual links.',
  });

/** One issue view row. */
export type BacklogIssue = z.infer<typeof BacklogIssueSchema>;

/** The issue-tracker view over one sealed program of work (+ optional delivery). */
export const BacklogViewSchema = z
  .strictObject({
    schema: z.literal(BACKLOG_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    packId: z.literal(SOFTWARE_PACK_ID),
    packVersion: z.literal(SOFTWARE_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The canonical delivery-record id whose observations/actuals are linked (when supplied). */
    deliveryId: z.string().regex(/^delivery:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    title: z.string().min(1).max(256),
    /** The software display vocabulary for the universal lifecycle stages. */
    stageVocabulary: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    epics: z.array(BacklogEpicSchema).max(256),
    issues: z.array(BacklogIssueSchema).max(2048),
    summary: z
      .strictObject({
        epicCount: z.number().int().min(0),
        issueCount: z.number().int().min(0),
        displayStateCounts: z.record(z.string().min(1).max(64), z.number().int().min(0)),
        workItemKindCounts: z.record(z.string().min(1).max(64), z.number().int().min(0)),
      })
      .readonly(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((view, ctx) => {
    for (let i = 1; i < view.epics.length; i += 1) {
      if (view.epics[i]!.workPackageId < view.epics[i - 1]!.workPackageId) {
        ctx.addIssue({
          code: 'custom',
          message: 'epics must be sorted by workPackageId ascending (deterministic serialization)',
          path: ['epics'],
        });
        break;
      }
    }
    for (let i = 1; i < view.issues.length; i += 1) {
      if (view.issues[i]!.activityId < view.issues[i - 1]!.activityId) {
        ctx.addIssue({
          code: 'custom',
          message: 'issues must be sorted by activityId ascending (deterministic serialization)',
          path: ['issues'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'BacklogView',
    title: 'BacklogView',
    description:
      'The issue-tracker view model: epic rows over the canonical work packages and issue rows over the canonical activities (identity-mapped ids, derived display states, linked observations/actuals) — a synchronized projection recomputed on every call, never a stored tracker.',
  });

/** One backlog view. */
export type BacklogView = z.infer<typeof BacklogViewSchema>;

// --------------------------------------------------------------------------------
// The projection inputs and fold.
// --------------------------------------------------------------------------------

/** The inputs of the issue-tracker projection (all optional except the program). */
export interface BacklogProjectionInputs {
  readonly program: SealedProgramOfWork;
  /** The delivery record whose observations/actuals link into the rows. */
  readonly delivery?: SealedDeliveryRecord | undefined;
  /** The caller-supplied work-item classification index (defaults: every activity is an issue). */
  readonly workItemIndex?: WorkItemIndex | undefined;
}

/** The issue-tracker display term of one derived display state. */
export function issueDisplayStateTermOf(state: ActivityDisplayState): string {
  return ISSUE_DISPLAY_STATE_TERMS[state];
}

/**
 * Project the issue-tracker view over the sealed solution-delivery state:
 *
 * - the program must verify (`digest-mismatch` on a tampered seal);
 * - the delivery record must verify and belong to the same solution and
 *   tenant (`cross-tenant-denied` — tenant isolation on every record the
 *   pack produces);
 * - work packages project as EPIC rows identity-mapped to their canonical
 *   work-package ids; activities project as ISSUE/TASK/CHANGE rows
 *   identity-mapped to their canonical activity ids — the pack never
 *   mints tracker identities;
 * - display states DERIVE from the canonical lifecycle states on each
 *   activity (the shared display-state fold); the canonical DeliveryRecord
 *   state is the ONLY truth;
 * - observations/actuals link by their canonical subject ids
 *   (activity/work-package subjects).
 *
 * Deterministic: epics, issues and every id list are canonically ordered;
 * identical inputs yield identical digests. Partial data follows SN1.0 —
 * a missing delivery/index projects empty links/defaults, never blockers.
 */
export function projectBacklog(inputs: BacklogProjectionInputs): PackResult<BacklogView> {
  const verifiedProgram = verifySealedProgramOfWork(inputs.program);
  if (!verifiedProgram.ok) {
    return verifiedProgram;
  }
  const program = verifiedProgram.value;

  let delivery: SealedDeliveryRecord | undefined;
  if (inputs.delivery !== undefined) {
    const verifiedDelivery = verifySealedDeliveryRecord(inputs.delivery);
    if (!verifiedDelivery.ok) {
      return verifiedDelivery;
    }
    if (
      verifiedDelivery.value.tenantId !== program.tenantId ||
      verifiedDelivery.value.solutionId !== program.solutionId
    ) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: 'delivery record does not belong to the projected solution/tenant',
          expectedTenantId: program.tenantId,
          encounteredTenantId: verifiedDelivery.value.tenantId,
        },
      };
    }
    delivery = verifiedDelivery.value;
  }

  // Canonical indexes: activity -> epic, gates per activity, milestones per activity.
  const packageOfActivity = new Map<string, string>();
  const gatesOfActivity = new Map<string, string[]>();
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      packageOfActivity.set(activity.activityId, workPackage.workPackageId);
    }
    for (const gate of workPackage.verificationGates) {
      const existing = gatesOfActivity.get(gate.activityId) ?? [];
      existing.push(gate.gateId);
      gatesOfActivity.set(gate.activityId, existing);
    }
  }
  const milestonesOfActivity = new Map<string, Set<string>>();
  for (const milestone of program.milestones) {
    for (const activityId of milestone.activityIds) {
      const set = milestonesOfActivity.get(activityId) ?? new Set<string>();
      set.add(milestone.milestoneId);
      milestonesOfActivity.set(activityId, set);
    }
  }

  // Observation/actual links by canonical subject id.
  const observationsOfSubject = new Map<string, string[]>();
  const actualsOfSubject = new Map<string, string[]>();
  if (delivery !== undefined) {
    for (const observation of delivery.observations) {
      const key = `${observation.subject.subjectKind}\u0000${observation.subject.subjectId}`;
      const existing = observationsOfSubject.get(key) ?? [];
      existing.push(observation.recordId);
      observationsOfSubject.set(key, existing);
    }
    for (const actual of delivery.actuals) {
      const key = `${actual.subject.subjectKind}\u0000${actual.subject.subjectId}`;
      const existing = actualsOfSubject.get(key) ?? [];
      existing.push(actual.recordId);
      actualsOfSubject.set(key, existing);
    }
  }
  const linksOf = (subjectKind: string, subjectId: string): { observations: string[]; actuals: string[] } => ({
    observations: [...(observationsOfSubject.get(`${subjectKind}\u0000${subjectId}`) ?? [])].sort(),
    actuals: [...(actualsOfSubject.get(`${subjectKind}\u0000${subjectId}`) ?? [])].sort(),
  });

  const issues: BacklogIssue[] = [];
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      const kind = workItemKindOf(inputs.workItemIndex, activity.activityId);
      const displayState = activityDisplayStateOf(activity);
      const activityLinks = linksOf('activity', activity.activityId);
      issues.push({
        activityId: activity.activityId,
        workPackageId: workPackage.workPackageId,
        title: activity.title,
        workItemKind: kind,
        workItemTerm: workItemTermOf(kind),
        displayState,
        displayStateTerm: issueDisplayStateTermOf(displayState),
        assignee: activity.responsibleActor,
        plannedQuantity: activity.plannedQuantity,
        predecessors: [...activity.predecessors].sort(),
        successors: [...activity.successors].sort(),
        gateIds: [...(gatesOfActivity.get(activity.activityId) ?? [])].sort(),
        blockerIds: activity.blockers.map((blocker) => blocker.blockerId).sort(),
        milestoneIds: [...(milestonesOfActivity.get(activity.activityId) ?? [])].sort(),
        observationIds: activityLinks.observations,
        actualIds: activityLinks.actuals,
      });
    }
  }
  issues.sort((a, b) => (a.activityId < b.activityId ? -1 : 1));

  const epics: BacklogEpic[] = program.workPackages.map((workPackage) => {
    const displayState = workPackageDisplayStateOf(workPackage.activities);
    const packageLinks = linksOf('work-package', workPackage.workPackageId);
    const milestoneIds = new Set<string>();
    for (const activity of workPackage.activities) {
      for (const milestoneId of milestonesOfActivity.get(activity.activityId) ?? []) {
        milestoneIds.add(milestoneId);
      }
    }
    return {
      workPackageId: workPackage.workPackageId,
      title: workPackage.title,
      workItemKind: 'epic',
      workItemTerm: WORK_ITEM_TERMS.epic,
      displayState,
      displayStateTerm: issueDisplayStateTermOf(displayState),
      solutionLineId: workPackage.solutionLineId,
      activityIds: workPackage.activities.map((activity) => activity.activityId).sort(),
      milestoneIds: [...milestoneIds].sort(),
      observationIds: packageLinks.observations,
      actualIds: packageLinks.actuals,
    };
  });
  epics.sort((a, b) => (a.workPackageId < b.workPackageId ? -1 : 1));

  const displayStateCounts: Record<string, number> = {};
  for (const state of ACTIVITY_DISPLAY_STATES) {
    displayStateCounts[state] = 0;
  }
  for (const issue of issues) {
    displayStateCounts[issue.displayState] = (displayStateCounts[issue.displayState] ?? 0) + 1;
  }
  const workItemKindCounts: Record<string, number> = {};
  for (const kind of ['issue', 'task', 'change'] as const) {
    workItemKindCounts[kind] = 0;
  }
  for (const issue of issues) {
    workItemKindCounts[issue.workItemKind] = (workItemKindCounts[issue.workItemKind] ?? 0) + 1;
  }

  const content = {
    schema: BACKLOG_VIEW_SCHEMA_NAME,
    schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
    packId: SOFTWARE_PACK_ID,
    packVersion: SOFTWARE_PACK_VERSION,
    tenantId: program.tenantId,
    solutionId: program.solutionId,
    programId: program.programId,
    deliveryId: delivery?.deliveryId,
    title: 'Issue tracker (backlog)',
    stageVocabulary: { ...SOFTWARE_STAGE_VOCABULARY },
    epics,
    issues,
    summary: {
      epicCount: epics.length,
      issueCount: issues.length,
      displayStateCounts,
      workItemKindCounts,
    },
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/**
 * Verify a backlog view envelope: write-intent pre-classification, schema
 * validation + digest recomputation (`digest-mismatch` on tamper). The
 * view is a PROJECTION — verification proves the envelope is intact,
 * never that it is canonical state.
 */
export function verifyBacklogView(sealed: unknown): PackResult<BacklogView> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = BacklogViewSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'backlog view failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'backlog view digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
