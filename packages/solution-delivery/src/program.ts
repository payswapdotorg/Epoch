/**
 * The ProgramOfWork — the AUTHORITATIVE SCHEDULE DIMENSION inside the
 * solution/delivery domain (USL1.0, binding): a dependency-aware
 * realization graph of work packages and activities with milestones,
 * resources, constraints, approvals, verification gates, actual progress,
 * blockers, evidence, confidence and forecast finish.
 *
 * - `buildProgramOfWork` is the total admission: schema validation, then
 *   cross-package/dependency integrity (dangling activity references are
 *   typed `dangling-reference-rejected`), predecessor/successor MIRROR
 *   consistency (`schedule-integrity-rejected`), and CYCLE detection over
 *   the dependency graph (`schedule-cycle-rejected`, with the cycle path).
 *   The admitted program is sealed (content + SHA-256 digest).
 * - A domain pack can RENAME or REGROUP the presentation (BOQ, BOM,
 *   roadmap, commissioning plan — DP1.0 projection rule), but a pack
 *   schedule must be a ProgramOfWork projection, never a competing
 *   schedule authority.
 * - Determinism: work packages, activities, milestones, resources,
 *   constraint references, evidence, gates and blockers are canonically
 *   ordered (sorted, duplicate-free); the quantity/cost/resource schedule
 *   folds are deterministic folds with exact decimal arithmetic — input
 *   order never leaks into a fold result.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ActivityIdSchema,
  BlockerIdSchema,
  GateIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from './primitives';
import { ConstraintReferenceSchema, EvidenceReferenceSchema } from './solution';
import { ConfidenceStateSchema } from './uncertainty';
import {
  PROGRAM_OF_WORK_SCHEMA_NAME,
  REALIZATION_VARIANTS,
  SOLUTION_DELIVERY_RECORD_VERSION,
  type RealizationVariant,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import { addNonNegativeDecimals } from './decimal';
import type { DeliveryError, DeliveryIssue, DeliveryResult } from './errors';

// --------------------------------------------------------------------------------
// Work-package and activity sub-models.
// --------------------------------------------------------------------------------

/** One resource assignment: an opaque resource reference with quantity+unit. */
export const ResourceAssignmentSchema = z
  .strictObject({
    resourceId: OpaqueReferenceSchema,
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
  })
  .readonly()
  .meta({
    id: 'ResourceAssignment',
    title: 'ResourceAssignment',
    description:
      'One resource assignment: an opaque resource reference with a canonical decimal quantity and unit.',
  });

/** One resource assignment. */
export type ResourceAssignment = z.infer<typeof ResourceAssignmentSchema>;

/** One work-package approval: a distinct authority act on the package. */
export const WorkApprovalSchema = z
  .strictObject({
    approvedBy: PrincipalIdSchema,
    approvedAt: TimestampSchema,
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'WorkApproval',
    title: 'WorkApproval',
    description: 'One work-package approval: the approving principal, the instant, and an optional note.',
  });

/** One work approval. */
export type WorkApproval = z.infer<typeof WorkApprovalSchema>;

/**
 * One verification gate on an activity (USL1.0 Verify: tests, inspection,
 * measurement, review, certification, telemetry or other
 * evidence-producing methods — carried as an opaque method reference plus
 * evidence).
 */
export const VerificationGateSchema = z
  .strictObject({
    gateId: GateIdSchema,
    activityId: ActivityIdSchema,
    title: z.string().min(1).max(256),
    method: OpaqueReferenceSchema,
    criteria: z.string().max(2048).optional(),
    evidence: z.array(EvidenceReferenceSchema).max(64),
    passedAt: TimestampSchema.optional(),
    passedBy: PrincipalIdSchema.optional(),
  })
  .readonly()
  .superRefine((gate, ctx) => {
    if (gate.passedBy !== undefined && gate.passedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'passedBy requires passedAt (a passed gate records when it passed)',
        path: ['passedBy'],
      });
    }
  })
  .meta({
    id: 'VerificationGate',
    title: 'VerificationGate',
    description:
      'One verification gate: the gated activity, an opaque evidence-producing method, criteria, sorted evidence references, and optional pass provenance.',
  });

/** One verification gate. */
export type VerificationGate = z.infer<typeof VerificationGateSchema>;

/** One blocker on an activity: a raised impediment with provenance. */
export const BlockerRecordSchema = z
  .strictObject({
    blockerId: BlockerIdSchema,
    description: z.string().min(1).max(2048),
    raisedAt: TimestampSchema,
    raisedBy: PrincipalIdSchema,
    impact: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'BlockerRecord',
    title: 'BlockerRecord',
    description:
      'One blocker record: description, the raising principal and instant, and an optional impact note.',
  });

/** One blocker record. */
export type BlockerRecord = z.infer<typeof BlockerRecordSchema>;

/** One activity (the dependency-graph node). */
export const ActivitySchema = z
  .strictObject({
    activityId: ActivityIdSchema,
    workPackageId: WorkPackageIdSchema,
    title: z.string().min(1).max(256),
    realizationVariant: z.enum(REALIZATION_VARIANTS).optional(),
    plannedQuantity: z
      .strictObject({
        value: NonNegativeDecimalSchema,
        unit: UnitLabelSchema,
      })
      .readonly()
      .optional(),
    plannedCost: z
      .strictObject({
        amount: NonNegativeDecimalSchema,
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .readonly()
      .optional(),
    plannedStart: TimestampSchema.optional(),
    plannedFinish: TimestampSchema.optional(),
    predecessors: z.array(ActivityIdSchema).max(256),
    successors: z.array(ActivityIdSchema).max(256),
    resources: z.array(ResourceAssignmentSchema).max(64),
    responsibleActor: PrincipalIdSchema.optional(),
    constraintReferences: z.array(ConstraintReferenceSchema).max(64),
    actualProgress: ProgressFractionSchema.optional(),
    actualStart: TimestampSchema.optional(),
    actualFinish: TimestampSchema.optional(),
    blockers: z.array(BlockerRecordSchema).max(64),
    evidence: z.array(EvidenceReferenceSchema).max(64),
    confidence: ConfidenceStateSchema.optional(),
    forecastFinish: TimestampSchema.optional(),
  })
  .readonly()
  .superRefine((activity, ctx) => {
    for (let i = 1; i < activity.predecessors.length; i += 1) {
      if (activity.predecessors[i]! < activity.predecessors[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'predecessors must be sorted ascending (deterministic serialization)',
          path: ['predecessors'],
        });
        break;
      }
      if (activity.predecessors[i]! === activity.predecessors[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'predecessors must be duplicate-free',
          path: ['predecessors'],
        });
        break;
      }
    }
    for (let i = 1; i < activity.successors.length; i += 1) {
      if (activity.successors[i]! < activity.successors[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'successors must be sorted ascending (deterministic serialization)',
          path: ['successors'],
        });
        break;
      }
      if (activity.successors[i]! === activity.successors[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'successors must be duplicate-free',
          path: ['successors'],
        });
        break;
      }
    }
    if (activity.plannedStart !== undefined && activity.plannedFinish !== undefined) {
      if (activity.plannedFinish < activity.plannedStart) {
        ctx.addIssue({
          code: 'custom',
          message: 'plannedFinish must not precede plannedStart',
          path: ['plannedFinish'],
        });
      }
    }
    for (let i = 1; i < activity.resources.length; i += 1) {
      if (activity.resources[i]!.resourceId < activity.resources[i - 1]!.resourceId) {
        ctx.addIssue({
          code: 'custom',
          message: 'resources must be sorted by resourceId ascending (deterministic serialization)',
          path: ['resources'],
        });
        break;
      }
    }
    for (let i = 1; i < activity.blockers.length; i += 1) {
      if (activity.blockers[i]!.blockerId < activity.blockers[i - 1]!.blockerId) {
        ctx.addIssue({
          code: 'custom',
          message: 'blockers must be sorted by blockerId ascending (deterministic serialization)',
          path: ['blockers'],
        });
        break;
      }
    }
    for (let i = 1; i < activity.evidence.length; i += 1) {
      if (activity.evidence[i]!.digest < activity.evidence[i - 1]!.digest) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be sorted by digest ascending (deterministic serialization)',
          path: ['evidence'],
        });
        break;
      }
    }
    for (let i = 1; i < activity.constraintReferences.length; i += 1) {
      if (
        activity.constraintReferences[i]!.constraintId <
        activity.constraintReferences[i - 1]!.constraintId
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'constraintReferences must be sorted by constraintId ascending (deterministic serialization)',
          path: ['constraintReferences'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'Activity',
    title: 'Activity',
    description:
      'One activity of the realization graph: planned quantity/cost/dates, sorted predecessors/successors, resources, responsible actor, constraints, actual progress/dates, blockers, evidence, confidence, and forecast finish.',
  });

/** One activity. */
export type Activity = z.infer<typeof ActivitySchema>;

/** One work package (groups activities; carries the realization variant). */
export const WorkPackageSchema = z
  .strictObject({
    workPackageId: WorkPackageIdSchema,
    title: z.string().min(1).max(256),
    description: z.string().max(4096).optional(),
    solutionLineId: SolutionLineIdSchema.optional(),
    worldEntityId: z.string().min(1).max(256).optional(),
    realizationVariant: z.enum(REALIZATION_VARIANTS),
    plannedStart: TimestampSchema.optional(),
    plannedFinish: TimestampSchema.optional(),
    responsibleActor: PrincipalIdSchema.optional(),
    resources: z.array(ResourceAssignmentSchema).max(64),
    constraintReferences: z.array(ConstraintReferenceSchema).max(64),
    approvals: z.array(WorkApprovalSchema).max(16),
    verificationGates: z.array(VerificationGateSchema).max(64),
    activities: z.array(ActivitySchema).max(256),
  })
  .readonly()
  .superRefine((workPackage, ctx) => {
    for (let i = 1; i < workPackage.activities.length; i += 1) {
      if (workPackage.activities[i]!.activityId < workPackage.activities[i - 1]!.activityId) {
        ctx.addIssue({
          code: 'custom',
          message: 'activities must be sorted by activityId ascending (deterministic serialization)',
          path: ['activities'],
        });
        break;
      }
      if (workPackage.activities[i]!.activityId === workPackage.activities[i - 1]!.activityId) {
        ctx.addIssue({
          code: 'custom',
          message: 'activities must be duplicate-free by activityId within the work package',
          path: ['activities'],
        });
        break;
      }
    }
    for (let i = 1; i < workPackage.resources.length; i += 1) {
      if (workPackage.resources[i]!.resourceId < workPackage.resources[i - 1]!.resourceId) {
        ctx.addIssue({
          code: 'custom',
          message: 'resources must be sorted by resourceId ascending (deterministic serialization)',
          path: ['resources'],
        });
        break;
      }
    }
    for (let i = 1; i < workPackage.approvals.length; i += 1) {
      const a = workPackage.approvals[i]!;
      const b = workPackage.approvals[i - 1]!;
      if (a.approvedAt < b.approvedAt || (a.approvedAt === b.approvedAt && a.approvedBy < b.approvedBy)) {
        ctx.addIssue({
          code: 'custom',
          message: 'approvals must be sorted by (approvedAt, approvedBy) ascending',
          path: ['approvals'],
        });
        break;
      }
    }
    for (let i = 1; i < workPackage.verificationGates.length; i += 1) {
      if (
        workPackage.verificationGates[i]!.gateId < workPackage.verificationGates[i - 1]!.gateId
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'verificationGates must be sorted by gateId ascending (deterministic serialization)',
          path: ['verificationGates'],
        });
        break;
      }
    }
    for (let i = 1; i < workPackage.constraintReferences.length; i += 1) {
      if (
        workPackage.constraintReferences[i]!.constraintId <
        workPackage.constraintReferences[i - 1]!.constraintId
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'constraintReferences must be sorted by constraintId ascending (deterministic serialization)',
          path: ['constraintReferences'],
        });
        break;
      }
    }
    if (workPackage.plannedStart !== undefined && workPackage.plannedFinish !== undefined) {
      if (workPackage.plannedFinish < workPackage.plannedStart) {
        ctx.addIssue({
          code: 'custom',
          message: 'plannedFinish must not precede plannedStart',
          path: ['plannedFinish'],
        });
      }
    }
  })
  .meta({
    id: 'WorkPackage',
    title: 'WorkPackage',
    description:
      'One work package of the realization graph: a realization variant, sorted activities, optional solution-line/world-entity links (Navigator identity preservation), resources, constraints, approvals, and verification gates.',
  });

/** One work package. */
export type WorkPackage = z.infer<typeof WorkPackageSchema>;

/** Milestone status vocabulary. */
export const MILESTONE_STATUSES = ['planned', 'reached', 'missed'] as const;

/** One milestone status. */
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** One milestone record (a dated achievement point over activities). */
export const MilestoneRecordSchema = z
  .strictObject({
    milestoneId: MilestoneIdSchema,
    title: z.string().min(1).max(256),
    targetDate: TimestampSchema.optional(),
    activityIds: z.array(ActivityIdSchema).max(256),
    status: z.enum(MILESTONE_STATUSES),
    reachedAt: TimestampSchema.optional(),
    evidence: z.array(EvidenceReferenceSchema).max(64),
  })
  .readonly()
  .superRefine((milestone, ctx) => {
    for (let i = 1; i < milestone.activityIds.length; i += 1) {
      if (milestone.activityIds[i]! < milestone.activityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'activityIds must be sorted ascending (deterministic serialization)',
          path: ['activityIds'],
        });
        break;
      }
      if (milestone.activityIds[i]! === milestone.activityIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'activityIds must be duplicate-free',
          path: ['activityIds'],
        });
        break;
      }
    }
    if (milestone.status === 'reached' && milestone.reachedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a reached milestone must carry reachedAt',
        path: ['reachedAt'],
      });
    }
    for (let i = 1; i < milestone.evidence.length; i += 1) {
      if (milestone.evidence[i]!.digest < milestone.evidence[i - 1]!.digest) {
        ctx.addIssue({
          code: 'custom',
          message: 'evidence must be sorted by digest ascending (deterministic serialization)',
          path: ['evidence'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'MilestoneRecord',
    title: 'MilestoneRecord',
    description:
      'One milestone record: a dated achievement point over sorted activity ids, with status, optional reached instant and sorted evidence.',
  });

/** One milestone record. */
export type MilestoneRecord = z.infer<typeof MilestoneRecordSchema>;

// --------------------------------------------------------------------------------
// The ProgramOfWork envelope.
// --------------------------------------------------------------------------------

/** The immutable content of one program of work (everything except the digest). */
export const ProgramOfWorkContentSchema = z
  .strictObject({
    schema: z.literal(PROGRAM_OF_WORK_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    title: z.string().min(1).max(256),
    workPackages: z.array(WorkPackageSchema).max(256),
    milestones: z.array(MilestoneRecordSchema).max(256),
    createdAt: TimestampSchema,
    createdBy: PrincipalIdSchema,
  })
  .readonly()
  .superRefine((program, ctx) => {
    for (let i = 1; i < program.workPackages.length; i += 1) {
      if (program.workPackages[i]!.workPackageId < program.workPackages[i - 1]!.workPackageId) {
        ctx.addIssue({
          code: 'custom',
          message: 'workPackages must be sorted by workPackageId ascending (deterministic serialization)',
          path: ['workPackages'],
        });
        break;
      }
      if (program.workPackages[i]!.workPackageId === program.workPackages[i - 1]!.workPackageId) {
        ctx.addIssue({
          code: 'custom',
          message: 'workPackages must be duplicate-free by workPackageId',
          path: ['workPackages'],
        });
        break;
      }
    }
    for (let i = 1; i < program.milestones.length; i += 1) {
      if (program.milestones[i]!.milestoneId < program.milestones[i - 1]!.milestoneId) {
        ctx.addIssue({
          code: 'custom',
          message: 'milestones must be sorted by milestoneId ascending (deterministic serialization)',
          path: ['milestones'],
        });
        break;
      }
      if (program.milestones[i]!.milestoneId === program.milestones[i - 1]!.milestoneId) {
        ctx.addIssue({
          code: 'custom',
          message: 'milestones must be duplicate-free by milestoneId',
          path: ['milestones'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ProgramOfWorkContent',
    title: 'ProgramOfWorkContent',
    description:
      'The immutable content of one program of work: the planned solution version (exact digest), sorted work packages with their activities, sorted milestones, and creation provenance.',
  });

/** One program of work content. */
export type ProgramOfWorkContent = z.infer<typeof ProgramOfWorkContentSchema>;

/** The SEALED program of work: content plus its SHA-256 content digest. */
export const SealedProgramOfWorkSchema = z
  .strictObject({
    schema: z.literal(PROGRAM_OF_WORK_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    title: z.string().min(1).max(256),
    workPackages: z.array(WorkPackageSchema).max(256),
    milestones: z.array(MilestoneRecordSchema).max(256),
    createdAt: TimestampSchema,
    createdBy: PrincipalIdSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedProgramOfWork',
    title: 'SealedProgramOfWork',
    description:
      'The sealed program of work: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed program of work. */
export type SealedProgramOfWork = z.infer<typeof SealedProgramOfWorkSchema>;

// --------------------------------------------------------------------------------
// Total admission: dependency integrity, mirror consistency, cycles.
// --------------------------------------------------------------------------------

/** Collect the flattened activity map of a program (id -> activity + owner). */
function activityIndex(program: ProgramOfWorkContent): Map<string, { activity: Activity; workPackageId: string }> {
  const index = new Map<string, { activity: Activity; workPackageId: string }>();
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      index.set(activity.activityId, { activity, workPackageId: workPackage.workPackageId });
    }
  }
  return index;
}

/** Cross-program duplicate activity ids are validation errors. */
function checkUniqueActivityIds(
  program: ProgramOfWorkContent,
): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  const seen = new Map<string, number>();
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      const count = seen.get(activity.activityId) ?? 0;
      seen.set(activity.activityId, count + 1);
      if (count === 1) {
        issues.push({
          path: 'workPackages',
          message: `activity id "${activity.activityId}" appears in more than one place`,
        });
      }
    }
  }
  return issues;
}

/** Check predecessor/successor mirror consistency across the graph. */
function checkDependencyMirrors(
  program: ProgramOfWorkContent,
  index: Map<string, { activity: Activity; workPackageId: string }>,
): DeliveryError | null {
  for (const [, entry] of [...index.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const { activity } = entry;
    for (const predecessorId of activity.predecessors) {
      if (predecessorId === activity.activityId) {
        continue; // self-loops are handled by cycle detection
      }
      const predecessor = index.get(predecessorId);
      if (predecessor === undefined) {
        return {
          code: 'dangling-reference-rejected',
          message: `activity "${activity.activityId}" lists unknown predecessor "${predecessorId}" — dangling dependency references are typed rejections`,
          referenceKind: 'activity',
          referenceId: predecessorId,
        };
      }
      if (!predecessor.activity.successors.includes(activity.activityId)) {
        return {
          code: 'schedule-integrity-rejected',
          message:
            `dependency mirror is inconsistent: "${predecessorId}" lists "${activity.activityId}" as a predecessor, ` +
            `but "${activity.activityId}" does not list "${predecessorId}" as a successor`,
          issues: [{ path: 'successors', message: `missing successor "${predecessorId}"` }],
        };
      }
    }
    for (const successorId of activity.successors) {
      if (successorId === activity.activityId) {
        continue;
      }
      const successor = index.get(successorId);
      if (successor === undefined) {
        return {
          code: 'dangling-reference-rejected',
          message: `activity "${activity.activityId}" lists unknown successor "${successorId}" — dangling dependency references are typed rejections`,
          referenceKind: 'activity',
          referenceId: successorId,
        };
      }
      if (!successor.activity.predecessors.includes(activity.activityId)) {
        return {
          code: 'schedule-integrity-rejected',
          message:
            `dependency mirror is inconsistent: "${activity.activityId}" lists "${successorId}" as a successor, ` +
            `but "${successorId}" does not list "${activity.activityId}" as a predecessor`,
          issues: [{ path: 'predecessors', message: `missing predecessor "${activity.activityId}"` }],
        };
      }
    }
  }
  return null;
}

/**
 * CYCLE detection over the dependency graph (predecessor edges): iterative
 * depth-first coloring; a back edge onto a gray node yields the cycle path
 * and a typed `schedule-cycle-rejected`.
 */
function checkDependencyCycles(
  program: ProgramOfWorkContent,
  index: Map<string, { activity: Activity; workPackageId: string }>,
): DeliveryError | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of index.keys()) {
    color.set(id, WHITE);
  }
  const ids = [...index.keys()].sort();
  for (const root of ids) {
    if (color.get(root) !== WHITE) {
      continue;
    }
    const stack: Array<{ id: string; nextIndex: number; path: string[] }> = [
      { id: root, nextIndex: 0, path: [root] },
    ];
    color.set(root, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const activity = index.get(frame.id)!.activity;
      const edges = activity.predecessors;
      if (frame.nextIndex >= edges.length) {
        color.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const nextId = edges[frame.nextIndex]!;
      frame.nextIndex += 1;
      const nextColor = color.get(nextId) ?? WHITE;
      if (nextColor === BLACK) {
        continue;
      }
      if (nextColor === GRAY) {
        const cycleStart = frame.path.indexOf(nextId);
        const cycle =
          cycleStart === -1
            ? [nextId, ...frame.path, nextId]
            : [...frame.path.slice(cycleStart), nextId];
        return {
          code: 'schedule-cycle-rejected',
          message:
            `the realization graph contains a dependency cycle: ${cycle.join(' -> ')} — ` +
            'the ProgramOfWork is a DAG; cyclic dependencies are typed rejections',
          cycle,
        };
      }
      color.set(nextId, GRAY);
      stack.push({ id: nextId, nextIndex: 0, path: [...frame.path, nextId] });
    }
  }
  return null;
}

/**
 * Build (validate + seal) a program of work. Total:
 * - schema validation (strict objects; vendor fields classify as
 *   `vendor-fields-rejected`);
 * - cross-package activity ownership and uniqueness;
 * - dangling work-package/activity/milestone/gate references are typed
 *   `dangling-reference-rejected`;
 * - predecessor/successor mirror consistency
 *   (`schedule-integrity-rejected`);
 * - dependency CYCLES (`schedule-cycle-rejected`, with the cycle path);
 * - the admitted program is sealed with its SHA-256 content digest.
 */
export function buildProgramOfWork(program: unknown): DeliveryResult<SealedProgramOfWork> {
  const parsed = ProgramOfWorkContentSchema.safeParse(program);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const content = parsed.data;
  const duplicates = checkUniqueActivityIds(content);
  if (duplicates.length > 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'activity ids must be unique across the whole program',
        issues: duplicates,
      },
    };
  }
  const index = activityIndex(content);
  for (const workPackage of content.workPackages) {
    for (const activity of workPackage.activities) {
      if (activity.workPackageId !== workPackage.workPackageId) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message: `activity "${activity.activityId}" declares work package "${activity.workPackageId}" but lives in "${workPackage.workPackageId}"`,
            referenceKind: 'work-package',
            referenceId: activity.workPackageId,
          },
        };
      }
    }
    for (const gate of workPackage.verificationGates) {
      if (!index.has(gate.activityId)) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message: `verification gate "${gate.gateId}" references unknown activity "${gate.activityId}"`,
            referenceKind: 'activity',
            referenceId: gate.activityId,
          },
        };
      }
    }
  }
  for (const milestone of content.milestones) {
    for (const activityId of milestone.activityIds) {
      if (!index.has(activityId)) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message: `milestone "${milestone.milestoneId}" references unknown activity "${activityId}"`,
            referenceKind: 'activity',
            referenceId: activityId,
          },
        };
      }
    }
  }
  const mirrorError = checkDependencyMirrors(content, index);
  if (mirrorError !== null) {
    return { ok: false, error: mirrorError };
  }
  const cycleError = checkDependencyCycles(content, index);
  if (cycleError !== null) {
    return { ok: false, error: cycleError };
  }
  const contentDigest = canonicalDigest(content as unknown as JsonValue);
  return { ok: true, value: { ...content, contentDigest } };
}

/**
 * Verify a sealed program of work: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedProgramOfWork(sealed: unknown): DeliveryResult<SealedProgramOfWork> {
  const parsed = SealedProgramOfWorkSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed program of work digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic schedule folds (synchronized quantity/cost/resource
// schedules — the schedule projections of SN1.0).
// --------------------------------------------------------------------------------

/** One quantity-schedule row. */
export interface QuantityScheduleRow {
  readonly workPackageId: string;
  readonly activityId: string;
  readonly unit: string;
  readonly plannedValue: string;
}

/** One quantity total per unit. */
export interface QuantityTotal {
  readonly unit: string;
  readonly totalValue: string;
}

/** The deterministic quantity schedule of a program. */
export interface QuantitySchedule {
  readonly rows: readonly QuantityScheduleRow[];
  readonly totals: readonly QuantityTotal[];
}

/**
 * Fold the synchronized QUANTITY schedule: one row per activity carrying
 * a planned quantity, plus exact per-unit totals. Rows sort by
 * (workPackageId, activityId, unit); totals sort by unit.
 */
export function foldQuantitySchedule(program: SealedProgramOfWork): QuantitySchedule {
  const rows: QuantityScheduleRow[] = [];
  const totals = new Map<string, string>();
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      if (activity.plannedQuantity === undefined) {
        continue;
      }
      rows.push({
        workPackageId: workPackage.workPackageId,
        activityId: activity.activityId,
        unit: activity.plannedQuantity.unit,
        plannedValue: activity.plannedQuantity.value,
      });
      const unit = activity.plannedQuantity.unit;
      totals.set(unit, addNonNegativeDecimals(totals.get(unit) ?? '0', activity.plannedQuantity.value));
    }
  }
  rows.sort((a, b) => {
    if (a.workPackageId !== b.workPackageId) return a.workPackageId < b.workPackageId ? -1 : 1;
    if (a.activityId !== b.activityId) return a.activityId < b.activityId ? -1 : 1;
    return a.unit < b.unit ? -1 : 1;
  });
  const totalRows = [...totals.entries()]
    .map(([unit, totalValue]) => ({ unit, totalValue }))
    .sort((a, b) => (a.unit < b.unit ? -1 : 1));
  return { rows, totals: totalRows };
}

/** One cost-schedule row. */
export interface CostScheduleRow {
  readonly workPackageId: string;
  readonly activityId: string;
  readonly currency: string;
  readonly plannedAmount: string;
}

/** One cost total per currency. */
export interface CostTotal {
  readonly currency: string;
  readonly totalAmount: string;
}

/** The deterministic cost schedule of a program. */
export interface CostSchedule {
  readonly rows: readonly CostScheduleRow[];
  readonly totals: readonly CostTotal[];
}

/**
 * Fold the synchronized COST schedule: one row per activity carrying a
 * planned cost, plus exact per-currency totals. Rows sort by
 * (workPackageId, activityId, currency); totals sort by currency.
 */
export function foldCostSchedule(program: SealedProgramOfWork): CostSchedule {
  const rows: CostScheduleRow[] = [];
  const totals = new Map<string, string>();
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      if (activity.plannedCost === undefined) {
        continue;
      }
      rows.push({
        workPackageId: workPackage.workPackageId,
        activityId: activity.activityId,
        currency: activity.plannedCost.currency,
        plannedAmount: activity.plannedCost.amount,
      });
      const currency = activity.plannedCost.currency;
      totals.set(
        currency,
        addNonNegativeDecimals(totals.get(currency) ?? '0', activity.plannedCost.amount),
      );
    }
  }
  rows.sort((a, b) => {
    if (a.workPackageId !== b.workPackageId) return a.workPackageId < b.workPackageId ? -1 : 1;
    if (a.activityId !== b.activityId) return a.activityId < b.activityId ? -1 : 1;
    return a.currency < b.currency ? -1 : 1;
  });
  const totalRows = [...totals.entries()]
    .map(([currency, totalAmount]) => ({ currency, totalAmount }))
    .sort((a, b) => (a.currency < b.currency ? -1 : 1));
  return { rows, totals: totalRows };
}

/** One resource-schedule row: aggregated quantity per (resource, unit). */
export interface ResourceScheduleRow {
  readonly resourceId: string;
  readonly unit: string;
  readonly totalQuantity: string;
  readonly workPackageIds: readonly string[];
}

/** The deterministic resource schedule of a program. */
export interface ResourceSchedule {
  readonly rows: readonly ResourceScheduleRow[];
}

/**
 * Fold the synchronized RESOURCE schedule: resource quantities aggregated
 * across work-package and activity assignments per (resourceId, unit).
 * Rows sort by (resourceId, unit); the work-package id list is sorted and
 * duplicate-free. Input order never leaks into the fold.
 */
export function foldResourceSchedule(program: SealedProgramOfWork): ResourceSchedule {
  const aggregates = new Map<string, { resourceId: string; unit: string; totalQuantity: string; workPackages: Set<string> }>();
  for (const workPackage of program.workPackages) {
    for (const assignment of [
      ...workPackage.resources.map((resource) => ({ resource, owner: 'package' as const })),
      ...workPackage.activities.flatMap((activity) =>
        activity.resources.map((resource) => ({ resource, owner: 'activity' as const })),
      ),
    ]) {
      const key = `${assignment.resource.resourceId}\u0000${assignment.resource.unit}`;
      const entry = aggregates.get(key) ?? {
        resourceId: assignment.resource.resourceId,
        unit: assignment.resource.unit,
        totalQuantity: '0',
        workPackages: new Set<string>(),
      };
      entry.totalQuantity = addNonNegativeDecimals(
        entry.totalQuantity,
        assignment.resource.quantity,
      );
      entry.workPackages.add(workPackage.workPackageId);
      aggregates.set(key, entry);
    }
  }
  const rows = [...aggregates.values()]
    .map((entry) => ({
      resourceId: entry.resourceId,
      unit: entry.unit,
      totalQuantity: entry.totalQuantity,
      workPackageIds: [...entry.workPackages].sort(),
    }))
    .sort((a, b) => {
      if (a.resourceId !== b.resourceId) return a.resourceId < b.resourceId ? -1 : 1;
      return a.unit < b.unit ? -1 : 1;
    });
  return { rows };
}

/** One milestone-schedule row. */
export interface MilestoneScheduleRow {
  readonly milestoneId: string;
  readonly title: string;
  readonly status: string;
  readonly targetDate?: string | undefined;
  readonly reachedAt?: string | undefined;
  readonly activityIds: readonly string[];
}

/** The deterministic milestone schedule of a program. */
export interface MilestoneSchedule {
  readonly rows: readonly MilestoneScheduleRow[];
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * Fold the synchronized MILESTONE schedule: milestones sorted by id with
 * their activity links, plus status counts. Deterministic: input order
 * never leaks.
 */
export function foldMilestoneSchedule(program: SealedProgramOfWork): MilestoneSchedule {
  const rows = program.milestones
    .map((milestone) => ({
      milestoneId: milestone.milestoneId,
      title: milestone.title,
      status: milestone.status,
      targetDate: milestone.targetDate,
      reachedAt: milestone.reachedAt,
      activityIds: [...milestone.activityIds].sort(),
    }))
    .sort((a, b) => (a.milestoneId < b.milestoneId ? -1 : 1));
  const counts: Record<string, number> = {};
  for (const status of MILESTONE_STATUSES) {
    counts[status] = 0;
  }
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return { rows, counts };
}

/** The realization-variant summary of a program (the Navigator realization projection input). */
export interface RealizationSummary {
  readonly counts: Readonly<Record<RealizationVariant, number>>;
}

/**
 * Fold the realization-variant summary: work-package counts per
 * realization variant (construction, software, mechanical, electrical,
 * manufacturing, infrastructure, field service).
 */
export function foldRealizationVariants(program: SealedProgramOfWork): RealizationSummary {
  const counts = {} as Record<RealizationVariant, number>;
  for (const variant of REALIZATION_VARIANTS) {
    counts[variant] = 0;
  }
  for (const workPackage of program.workPackages) {
    counts[workPackage.realizationVariant] += 1;
  }
  return { counts };
}
