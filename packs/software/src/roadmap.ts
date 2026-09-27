/**
 * The roadmap projection (W027, the DP1.0 projection rule): a typed view
 * model of the software roadmap as a PURE FOLD over the W036
 * `SealedProgramOfWork` — milestones and dependencies identity-mapped to
 * their canonical milestone/activity ids (the SAME ids, NEVER minted),
 * grouped into tracks by the canonical solution-line streams (falling back
 * to the canonical work-package id when a package carries no line link).
 *
 * The universal ProgramOfWork stays the authoritative schedule dimension;
 * the pack NEVER creates a competing schedule authority. Partial data
 * follows SN1.0: missing line links group under package-level tracks,
 * never as blockers.
 */
import { z } from 'zod';
import {
  MILESTONE_STATUSES,
  Sha256HexSchema,
  verifySealedProgramOfWork,
  type SealedProgramOfWork,
} from '@epoch/solution-delivery';
import {
  MILESTONE_STATUS_TERMS,
  ROADMAP_VIEW_SCHEMA_NAME,
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
} from './version';
import { classifyPackRecord, digestOf } from './util';
import type { PackResult } from './errors';
import { SOFTWARE_STAGE_VOCABULARY } from './profile';

// --------------------------------------------------------------------------------
// The roadmap view model.
// --------------------------------------------------------------------------------

/** The canonical anchor a roadmap track groups by. */
export const ROADMAP_TRACK_KINDS = ['solution-line', 'work-package'] as const;

/** One roadmap track kind. */
export type RoadmapTrackKind = (typeof ROADMAP_TRACK_KINDS)[number];

/**
 * One roadmap track: a realization stream grouped by its CANONICAL anchor
 * id — the solution line the work packages realize, or the work-package id
 * itself when the package carries no line link (never a minted id).
 */
export const RoadmapTrackSchema = z
  .strictObject({
    /** The canonical anchor id (solutionLineId or workPackageId) — the SAME id, never minted. */
    trackId: z.string().min(1).max(256),
    trackKind: z.enum(ROADMAP_TRACK_KINDS),
    title: z.string().min(1).max(256),
    /** The canonical work-package ids realizing this track. */
    workPackageIds: z.array(z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The canonical activity ids inside those packages. */
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
    /** The canonical milestone ids whose activities fall inside this track. */
    milestoneIds: z.array(z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
  })
  .readonly()
  .meta({
    id: 'RoadmapTrack',
    title: 'RoadmapTrack',
    description:
      'One roadmap track: a realization stream grouped by its canonical anchor id (solution line, or work package when unlinked) — canonical ids only, never minted.',
  });

/** One roadmap track. */
export type RoadmapTrack = z.infer<typeof RoadmapTrackSchema>;

/**
 * One roadmap release: the release-lens view of one canonical milestone —
 * `releaseId` IS the canonical milestone id (the SAME id, never minted).
 */
export const RoadmapReleaseSchema = z
  .strictObject({
    /** The release id — IDENTICAL to the canonical milestone id, never minted. */
    releaseId: z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The canonical milestone id this release projects. */
    milestoneId: z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The universal milestone status (unchanged). */
    status: z.enum(MILESTONE_STATUSES),
    /** The software display term of the status (Planned/Shipped/Missed). */
    statusTerm: z.string().min(1).max(64),
    targetDate: z.string().min(1).optional(),
    reachedAt: z.string().min(1).optional(),
    /** The canonical activity ids the milestone carries. */
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The canonical work-package ids owning those activities. */
    workPackageIds: z.array(z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
  })
  .readonly()
  .meta({
    id: 'RoadmapRelease',
    title: 'RoadmapRelease',
    description:
      'One roadmap release: the release-lens view of one canonical milestone (releaseId IS the canonical milestone id — the SAME id, never minted) with its software status term and linked packages.',
  });

/** One roadmap release. */
export type RoadmapRelease = z.infer<typeof RoadmapReleaseSchema>;

/** One roadmap milestone: the canonical milestone row, identity-mapped. */
export const RoadmapMilestoneSchema = z
  .strictObject({
    /** The canonical milestone id — the SAME id, never minted. */
    milestoneId: z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The universal milestone status (unchanged). */
    status: z.enum(MILESTONE_STATUSES),
    /** The software display term of the status (Planned/Shipped/Missed). */
    statusTerm: z.string().min(1).max(64),
    targetDate: z.string().min(1).optional(),
    reachedAt: z.string().min(1).optional(),
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
  })
  .readonly()
  .meta({
    id: 'RoadmapMilestone',
    title: 'RoadmapMilestone',
    description:
      'One roadmap milestone: the canonical milestone with its universal status and the software status display term (Planned/Shipped/Missed).',
  });

/** One roadmap milestone. */
export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>;

/** One unique dependency edge of the roadmap. */
export const RoadmapDependencySchema = z
  .strictObject({
    predecessorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    successorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly()
  .meta({
    id: 'RoadmapDependency',
    title: 'RoadmapDependency',
    description: 'One unique dependency edge of the software roadmap (canonical activity ids).',
  });

/** One roadmap dependency edge. */
export type RoadmapDependency = z.infer<typeof RoadmapDependencySchema>;

/** The software roadmap view over one sealed program of work. */
export const RoadmapViewSchema = z
  .strictObject({
    schema: z.literal(ROADMAP_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    packId: z.literal(SOFTWARE_PACK_ID),
    packVersion: z.literal(SOFTWARE_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The software display vocabulary for the universal lifecycle stages. */
    stageVocabulary: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    tracks: z.array(RoadmapTrackSchema).max(256),
    releases: z.array(RoadmapReleaseSchema).max(256),
    milestones: z.array(RoadmapMilestoneSchema).max(256),
    dependencies: z.array(RoadmapDependencySchema).max(4096),
    summary: z
      .strictObject({
        workPackageCount: z.number().int().min(0),
        activityCount: z.number().int().min(0),
        milestoneCount: z.number().int().min(0),
        releaseCount: z.number().int().min(0),
        trackCount: z.number().int().min(0),
        dependencyCount: z.number().int().min(0),
        milestoneStatusCounts: z.record(z.string().min(1).max(64), z.number().int().min(0)),
      })
      .readonly(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((view, ctx) => {
    for (let i = 1; i < view.tracks.length; i += 1) {
      if (view.tracks[i]!.trackId < view.tracks[i - 1]!.trackId) {
        ctx.addIssue({
          code: 'custom',
          message: 'tracks must be sorted by trackId ascending (deterministic serialization)',
          path: ['tracks'],
        });
        break;
      }
    }
    for (let i = 1; i < view.releases.length; i += 1) {
      if (view.releases[i]!.releaseId < view.releases[i - 1]!.releaseId) {
        ctx.addIssue({
          code: 'custom',
          message: 'releases must be sorted by releaseId ascending (deterministic serialization)',
          path: ['releases'],
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
    id: 'RoadmapView',
    title: 'RoadmapView',
    description:
      'The software roadmap view: tracks grouped by canonical anchors, releases and milestones identity-mapped to the canonical milestone ids, and the deduplicated dependency edges of one sealed ProgramOfWork — a synchronized projection, never a competing schedule authority.',
  });

/** One roadmap view. */
export type RoadmapView = z.infer<typeof RoadmapViewSchema>;

// --------------------------------------------------------------------------------
// The projection fold.
// --------------------------------------------------------------------------------

/**
 * Project the software roadmap view over one sealed program of work:
 * tracks group the work packages by their canonical solution-line anchor
 * (falling back to the work-package id when unlinked); releases are the
 * release-lens view of the milestones (releaseId IS the canonical
 * milestoneId — never minted); dependencies are the DEDUPLICATED union of
 * the predecessor edges (the W036 mirror guarantees each edge appears in
 * both endpoints; the projection emits it exactly once).
 *
 * Total: the program must verify (`digest-mismatch` on a tampered seal).
 * Deterministic: identical inputs yield identical digests; input order
 * never leaks.
 */
export function projectRoadmap(program: SealedProgramOfWork): PackResult<RoadmapView> {
  const verified = verifySealedProgramOfWork(program);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;

  // Activity -> owning work package (canonical index).
  const packageOfActivity = new Map<string, string>();
  for (const workPackage of sealed.workPackages) {
    for (const activity of workPackage.activities) {
      packageOfActivity.set(activity.activityId, workPackage.workPackageId);
    }
  }

  // Tracks: group work packages by solution line (canonical anchor),
  // falling back to the work-package id itself when unlinked.
  const trackIndex = new Map<
    string,
    {
      trackKind: RoadmapTrackKind;
      workPackages: Set<string>;
      activities: Set<string>;
      solutionLineId?: string;
    }
  >();
  for (const workPackage of sealed.workPackages) {
    const anchor =
      workPackage.solutionLineId !== undefined
        ? { trackId: workPackage.solutionLineId, trackKind: 'solution-line' as const, solutionLineId: workPackage.solutionLineId }
        : { trackId: workPackage.workPackageId, trackKind: 'work-package' as const, solutionLineId: undefined };
    const entry =
      trackIndex.get(anchor.trackId) ??
      {
        trackKind: anchor.trackKind,
        workPackages: new Set<string>(),
        activities: new Set<string>(),
        solutionLineId: anchor.solutionLineId,
      };
    entry.workPackages.add(workPackage.workPackageId);
    for (const activity of workPackage.activities) {
      entry.activities.add(activity.activityId);
    }
    trackIndex.set(anchor.trackId, entry);
  }

  const statusTermOf = (status: string): string =>
    MILESTONE_STATUS_TERMS[status as keyof typeof MILESTONE_STATUS_TERMS] ?? status;

  const milestones: RoadmapMilestone[] = sealed.milestones
    .map((milestone) => ({
      milestoneId: milestone.milestoneId,
      title: milestone.title,
      status: milestone.status,
      statusTerm: statusTermOf(milestone.status),
      targetDate: milestone.targetDate,
      // Absent optionals are OMITTED (never explicit undefined) so every
      // view is a strict JSON value.
      ...(milestone.reachedAt !== undefined ? { reachedAt: milestone.reachedAt } : {}),
      activityIds: [...milestone.activityIds].sort(),
    }))
    .sort((a, b) => (a.milestoneId < b.milestoneId ? -1 : 1));

  // Releases: the release-lens view of the SAME milestones (identity-mapped).
  const releases: RoadmapRelease[] = sealed.milestones
    .map((milestone) => ({
      releaseId: milestone.milestoneId,
      milestoneId: milestone.milestoneId,
      title: milestone.title,
      status: milestone.status,
      statusTerm: statusTermOf(milestone.status),
      targetDate: milestone.targetDate,
      ...(milestone.reachedAt !== undefined ? { reachedAt: milestone.reachedAt } : {}),
      activityIds: [...milestone.activityIds].sort(),
      workPackageIds: [...new Set(milestone.activityIds.map((id) => packageOfActivity.get(id)).filter((id) => id !== undefined))].sort(),
    }))
    .sort((a, b) => (a.releaseId < b.releaseId ? -1 : 1));

  // Tracks with the milestones whose activities fall inside them.
  const activityToMilestones = new Map<string, Set<string>>();
  for (const milestone of sealed.milestones) {
    for (const activityId of milestone.activityIds) {
      const set = activityToMilestones.get(activityId) ?? new Set<string>();
      set.add(milestone.milestoneId);
      activityToMilestones.set(activityId, set);
    }
  }
  const tracks: RoadmapTrack[] = [...trackIndex.entries()]
    .map(([trackId, entry]) => {
      const milestoneIds = new Set<string>();
      for (const activityId of entry.activities) {
        for (const milestoneId of activityToMilestones.get(activityId) ?? []) {
          milestoneIds.add(milestoneId);
        }
      }
      return {
        trackId,
        trackKind: entry.trackKind,
        title:
          entry.trackKind === 'solution-line'
            ? `Track: ${entry.solutionLineId}`
            : `Package track: ${trackId}`,
        workPackageIds: [...entry.workPackages].sort(),
        activityIds: [...entry.activities].sort(),
        milestoneIds: [...milestoneIds].sort(),
      };
    })
    .sort((a, b) => (a.trackId < b.trackId ? -1 : 1));

  // Dependencies: the deduplicated predecessor edges, canonical ids.
  const dependencySet = new Set<string>();
  const dependencies: RoadmapDependency[] = [];
  for (const workPackage of sealed.workPackages) {
    for (const activity of workPackage.activities) {
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

  const content = {
    schema: ROADMAP_VIEW_SCHEMA_NAME,
    schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
    packId: SOFTWARE_PACK_ID,
    packVersion: SOFTWARE_PACK_VERSION,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    programId: sealed.programId,
    title: 'Software roadmap',
    stageVocabulary: { ...SOFTWARE_STAGE_VOCABULARY },
    tracks,
    releases,
    milestones,
    dependencies,
    summary: {
      workPackageCount: sealed.workPackages.length,
      activityCount: packageOfActivity.size,
      milestoneCount: milestones.length,
      releaseCount: releases.length,
      trackCount: tracks.length,
      dependencyCount: dependencies.length,
      milestoneStatusCounts,
    },
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/**
 * Verify a roadmap view envelope: write-intent pre-classification, schema
 * validation + digest recomputation (`digest-mismatch` on tamper). The
 * view is a PROJECTION — verification proves the envelope is intact,
 * never that it is canonical state.
 */
export function verifyRoadmapView(sealed: unknown): PackResult<RoadmapView> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = RoadmapViewSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'roadmap view failed schema validation',
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
        message: 'roadmap view digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
