/**
 * The construction programme projection (W026, DP1.0 projection rule): a
 * typed view model of the construction programme as a PURE FOLD over the
 * W036 `SealedProgramOfWork` — the Navigator ProgramOfWork/Schedule/
 * Milestone projections carrying the construction vocabulary (the pack's
 * stage display terms, realization-variant terms and milestone status
 * terms). The universal ProgramOfWork stays the authoritative schedule
 * dimension; the pack NEVER creates a competing schedule authority.
 */
import { z } from 'zod';
import {
  MILESTONE_STATUSES,
  Sha256HexSchema,
  verifySealedProgramOfWork,
  type SealedProgramOfWork,
} from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
  MILESTONE_STATUS_TERMS,
  PROGRAMME_VIEW_SCHEMA_NAME,
  REALIZATION_VARIANT_TERMS,
} from './version';
import { classifyPackRecord, digestOf } from './util';
import type { PackResult } from './errors';
import { CONSTRUCTION_STAGE_VOCABULARY } from './profile';

// --------------------------------------------------------------------------------
// The programme view model.
// --------------------------------------------------------------------------------

/** One programme activity: the canonical activity plus construction vocabulary. */
export const ProgrammeActivitySchema = z
  .strictObject({
    /** The canonical activity id — the SAME id, never minted. */
    activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The canonical work-package id owning the activity. */
    workPackageId: z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The construction display term of the realization variant. */
    realizationTerm: z.string().min(1).max(64),
    plannedQuantity: z
      .strictObject({
        value: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
        unit: z.string().min(1).max(32),
      })
      .readonly()
      .optional(),
    plannedStart: z.string().min(1).optional(),
    plannedFinish: z.string().min(1).optional(),
    predecessors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    successors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    actualProgress: z.number().min(0).max(1).optional(),
    actualStart: z.string().min(1).optional(),
    actualFinish: z.string().min(1).optional(),
    responsibleActor: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    forecastFinish: z.string().min(1).optional(),
    /** The verification gates gating this activity (canonical gate ids). */
    gateIds: z.array(z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
  })
  .readonly()
  .meta({
    id: 'ProgrammeActivity',
    title: 'ProgrammeActivity',
    description:
      'One construction-programme activity: the canonical activity (identity-mapped ids) with its construction realization display term, planned/actual dates, dependencies, responsible actor and verification gates.',
  });

/** One programme activity. */
export type ProgrammeActivity = z.infer<typeof ProgrammeActivitySchema>;

/** One programme milestone: the canonical milestone plus construction vocabulary. */
export const ProgrammeMilestoneSchema = z
  .strictObject({
    /** The canonical milestone id — the SAME id, never minted. */
    milestoneId: z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The universal milestone status (unchanged). */
    status: z.enum(MILESTONE_STATUSES),
    /** The construction display term of the status. */
    statusTerm: z.string().min(1).max(64),
    targetDate: z.string().min(1).optional(),
    reachedAt: z.string().min(1).optional(),
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
  })
  .readonly()
  .meta({
    id: 'ProgrammeMilestone',
    title: 'ProgrammeMilestone',
    description:
      'One construction-programme milestone: the canonical milestone with its universal status and the construction status display term (Programmed/Achieved/Missed).',
  });

/** One programme milestone. */
export type ProgrammeMilestone = z.infer<typeof ProgrammeMilestoneSchema>;

/** One unique dependency edge of the programme. */
export const ProgrammeDependencySchema = z
  .strictObject({
    predecessorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    successorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly()
  .meta({
    id: 'ProgrammeDependency',
    title: 'ProgrammeDependency',
    description: 'One unique dependency edge of the construction programme (canonical activity ids).',
  });

/** One programme dependency edge. */
export type ProgrammeDependency = z.infer<typeof ProgrammeDependencySchema>;

/** The construction programme view over one sealed program of work. */
export const ConstructionProgrammeViewSchema = z
  .strictObject({
    schema: z.literal(PROGRAMME_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    packId: z.literal(CONSTRUCTION_PACK_ID),
    packVersion: z.literal(CONSTRUCTION_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The construction display vocabulary for the universal lifecycle stages. */
    stageVocabulary: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    /** The construction display terms for the realization variants rendered. */
    realizationTerms: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    activities: z.array(ProgrammeActivitySchema).max(2048),
    milestones: z.array(ProgrammeMilestoneSchema).max(256),
    dependencies: z.array(ProgrammeDependencySchema).max(4096),
    summary: z
      .strictObject({
        workPackageCount: z.number().int().min(0),
        activityCount: z.number().int().min(0),
        milestoneCount: z.number().int().min(0),
        dependencyCount: z.number().int().min(0),
        milestoneStatusCounts: z.record(z.string().min(1).max(64), z.number().int().min(0)),
      })
      .readonly(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((view, ctx) => {
    for (let i = 1; i < view.activities.length; i += 1) {
      if (view.activities[i]!.activityId < view.activities[i - 1]!.activityId) {
        ctx.addIssue({
          code: 'custom',
          message: 'activities must be sorted by activityId ascending (deterministic serialization)',
          path: ['activities'],
        });
        break;
      }
    }
    for (let i = 1; i < view.milestones.length; i += 1) {
      if (view.milestones[i]!.milestoneId < view.milestones[i - 1]!.milestoneId) {
        ctx.addIssue({
          code: 'custom',
          message: 'milestones must be sorted by milestoneId ascending (deterministic serialization)',
          path: ['milestones'],
        });
        break;
      }
    }
    for (let i = 1; i < view.dependencies.length; i += 1) {
      const a = view.dependencies[i]!;
      const b = view.dependencies[i - 1]!;
      if (
        a.predecessorActivityId < b.predecessorActivityId ||
        (a.predecessorActivityId === b.predecessorActivityId &&
          a.successorActivityId < b.successorActivityId)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'dependencies must be sorted by (predecessor, successor) ascending',
          path: ['dependencies'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ConstructionProgrammeView',
    title: 'ConstructionProgrammeView',
    description:
      'The construction programme view: the construction vocabulary plus the canonically ordered activities, milestones and unique dependency edges of one sealed ProgramOfWork — a synchronized projection, never a competing schedule authority.',
  });

/** One construction programme view. */
export type ConstructionProgrammeView = z.infer<typeof ConstructionProgrammeViewSchema>;

// --------------------------------------------------------------------------------
// The projection fold.
// --------------------------------------------------------------------------------

/**
 * Project the construction programme view over one sealed program of work:
 * activities, milestones and dependencies fold with the construction
 * vocabulary (stage display terms, realization-variant terms, milestone
 * status terms), identity-mapped to the canonical activity/milestone ids.
 *
 * Total: the program must verify (`digest-mismatch` on a tampered seal).
 * Deterministic: identical inputs yield identical digests; input order
 * never leaks. The dependency edges are the DEDUPLICATED union of the
 * predecessor lists (the W036 mirror guarantees each edge appears in both
 * endpoints; the projection emits it exactly once).
 */
export function projectConstructionProgramme(
  program: SealedProgramOfWork,
): PackResult<ConstructionProgrammeView> {
  const verified = verifySealedProgramOfWork(program);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;

  const realizationTermOf = (variant: string): string =>
    REALIZATION_VARIANT_TERMS[variant as keyof typeof REALIZATION_VARIANT_TERMS] ?? variant;

  const activities: ProgrammeActivity[] = [];
  for (const workPackage of sealed.workPackages) {
    const gatesByActivity = new Map<string, string[]>();
    for (const gate of workPackage.verificationGates) {
      const existing = gatesByActivity.get(gate.activityId) ?? [];
      existing.push(gate.gateId);
      gatesByActivity.set(gate.activityId, existing);
    }
    for (const activity of workPackage.activities) {
      activities.push({
        activityId: activity.activityId,
        workPackageId: workPackage.workPackageId,
        title: activity.title,
        realizationTerm: realizationTermOf(
          activity.realizationVariant ?? workPackage.realizationVariant,
        ),
        plannedQuantity: activity.plannedQuantity,
        plannedStart: activity.plannedStart,
        plannedFinish: activity.plannedFinish,
        predecessors: [...activity.predecessors].sort(),
        successors: [...activity.successors].sort(),
        actualProgress: activity.actualProgress,
        actualStart: activity.actualStart,
        actualFinish: activity.actualFinish,
        responsibleActor: activity.responsibleActor,
        forecastFinish: activity.forecastFinish,
        gateIds: (gatesByActivity.get(activity.activityId) ?? []).sort(),
      });
    }
  }
  activities.sort((a, b) => (a.activityId < b.activityId ? -1 : 1));

  const milestones: ProgrammeMilestone[] = sealed.milestones.map((milestone) => ({
    milestoneId: milestone.milestoneId,
    title: milestone.title,
    status: milestone.status,
    statusTerm:
      MILESTONE_STATUS_TERMS[milestone.status as keyof typeof MILESTONE_STATUS_TERMS] ??
      milestone.status,
    targetDate: milestone.targetDate,
    reachedAt: milestone.reachedAt,
    activityIds: [...milestone.activityIds].sort(),
  }));
  milestones.sort((a, b) => (a.milestoneId < b.milestoneId ? -1 : 1));

  const dependencySet = new Set<string>();
  const dependencies: ProgrammeDependency[] = [];
  for (const activity of activities) {
    for (const predecessorId of activity.predecessors) {
      const key = `${predecessorId}\u0000${activity.activityId}`;
      if (dependencySet.has(key)) {
        continue;
      }
      dependencySet.add(key);
      dependencies.push({
        predecessorActivityId: predecessorId,
        successorActivityId: activity.activityId,
      });
    }
  }
  dependencies.sort((a, b) => {
    if (a.predecessorActivityId !== b.predecessorActivityId) {
      return a.predecessorActivityId < b.predecessorActivityId ? -1 : 1;
    }
    return a.successorActivityId < b.successorActivityId ? -1 : 1;
  });

  const milestoneStatusCounts: Record<string, number> = {};
  for (const status of MILESTONE_STATUSES) {
    milestoneStatusCounts[status] = 0;
  }
  for (const milestone of milestones) {
    milestoneStatusCounts[milestone.status] = (milestoneStatusCounts[milestone.status] ?? 0) + 1;
  }

  const realizationTerms: Record<string, string> = {};
  for (const workPackage of sealed.workPackages) {
    realizationTerms[workPackage.realizationVariant] = realizationTermOf(
      workPackage.realizationVariant,
    );
  }

  const content = {
    schema: PROGRAMME_VIEW_SCHEMA_NAME,
    schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
    packId: CONSTRUCTION_PACK_ID,
    packVersion: CONSTRUCTION_PACK_VERSION,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    programId: sealed.programId,
    title: 'Construction programme',
    stageVocabulary: { ...CONSTRUCTION_STAGE_VOCABULARY },
    realizationTerms,
    activities,
    milestones,
    dependencies,
    summary: {
      workPackageCount: sealed.workPackages.length,
      activityCount: activities.length,
      milestoneCount: milestones.length,
      dependencyCount: dependencies.length,
      milestoneStatusCounts,
    },
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/**
 * Verify a construction programme view envelope: write-intent
 * pre-classification, schema validation + digest recomputation
 * (`digest-mismatch` on tamper). The view is a PROJECTION — verification
 * proves the envelope is intact, never that it is canonical state.
 */
export function verifyConstructionProgrammeView(
  sealed: unknown,
): PackResult<ConstructionProgrammeView> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = ConstructionProgrammeViewSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'construction programme view failed schema validation',
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
        message:
          'construction programme view digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
