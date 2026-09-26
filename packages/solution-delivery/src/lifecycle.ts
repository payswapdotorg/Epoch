/**
 * The universal lifecycle state model (USL1.0, binding): typed STAGE
 * RECORDS plus typed TRANSITION relations over the canonical semantic
 * model — never a strict linear FSM.
 *
 * - The eleven universal stages (Understand -> Decide -> Plan -> Acquire
 *   -> Realize -> Observe -> Actualize -> Verify -> Forecast -> Close ->
 *   Learn) are PROJECTIONS: stage records may be entered in any order,
 *   and the six typed relations connect them —
 *   `precedes` (forward flow), `branch` (alternative path), `overlap`
 *   (concurrent stages), `loop` (backward/same re-entry), `pause` /
 *   `resume` (self-relations parking and resuming a stage).
 * - Stage records are append-only and immutable; pause/resume NEVER edit
 *   them — the projected status is DERIVED from the transition history
 *   (`stageStatusOf`).
 * - A pack-style record that redefines stage semantics (a non-universal
 *   stage, or a DP1.0-forbidden authority-claim field) is a typed
 *   `authority-violation-rejected` (pre-classified before schema
 *   validation): domain packs TEACH the lifecycle; they never create a
 *   second lifecycle authority.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  QualifiedNameSchema,
  SemverCoreSchema,
  SolutionIdSchema,
  StageRecordIdSchema,
  TransitionRecordIdSchema,
} from './primitives';
import {
  FORBIDDEN_AUTHORITY_FIELDS,
  LIFECYCLE_STAGE_SCHEMA_NAME,
  LIFECYCLE_TRANSITION_SCHEMA_NAME,
  LIFECYCLE_TRANSITION_RELATIONS,
  NAVIGATOR_PROJECTION_KINDS,
  PACK_PROFILE_SCHEMA_NAME,
  SOLUTION_DELIVERY_RECORD_VERSION,
  SOLUTION_DELIVERY_USL_VERSION,
  UNIVERSAL_LIFECYCLE_STAGES,
  stageOrdinal,
  type LifecycleTransitionRelation,
  type UniversalLifecycleStage,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryError, DeliveryResult } from './errors';

// --------------------------------------------------------------------------------
// Lifecycle subjects.
// --------------------------------------------------------------------------------

/** The lifecycle subject kinds: the solution package or the delivery record. */
export const LIFECYCLE_SUBJECT_KINDS = ['solution-package', 'delivery-record'] as const;

/** One lifecycle subject kind. */
export type LifecycleSubjectKind = (typeof LIFECYCLE_SUBJECT_KINDS)[number];

/** The subject whose lifecycle the stage records trace. */
export const LifecycleSubjectSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    subjectKind: z.enum(LIFECYCLE_SUBJECT_KINDS),
    subjectId: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'LifecycleSubject',
    title: 'LifecycleSubject',
    description:
      'The lifecycle subject: the owning solution plus the tracked object (solution package or delivery record).',
  });

/** One lifecycle subject. */
export type LifecycleSubject = z.infer<typeof LifecycleSubjectSchema>;

// --------------------------------------------------------------------------------
// Stage records and transitions.
// --------------------------------------------------------------------------------

/** The projected status of one stage record (derived from transitions). */
export const STAGE_PROJECTED_STATUSES = ['active', 'paused'] as const;

/** One projected stage status. */
export type StageProjectedStatus = (typeof STAGE_PROJECTED_STATUSES)[number];

/** One lifecycle stage record: entering a universal stage. */
export const LifecycleStageRecordSchema = z
  .strictObject({
    schema: z.literal(LIFECYCLE_STAGE_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    recordId: StageRecordIdSchema,
    tenantId: TenantIdSchema,
    subject: LifecycleSubjectSchema,
    stage: z.enum(UNIVERSAL_LIFECYCLE_STAGES),
    enteredAt: TimestampSchema,
    enteredBy: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'LifecycleStageRecord',
    title: 'LifecycleStageRecord',
    description:
      'One lifecycle stage record: entering one of the eleven universal stages for one subject, with entry provenance.',
  });

/** One lifecycle stage record. */
export type LifecycleStageRecord = z.infer<typeof LifecycleStageRecordSchema>;

/** One lifecycle transition record: a typed relation between stage records. */
export const LifecycleTransitionRecordSchema = z
  .strictObject({
    schema: z.literal(LIFECYCLE_TRANSITION_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    recordId: TransitionRecordIdSchema,
    tenantId: TenantIdSchema,
    subject: LifecycleSubjectSchema,
    relation: z.enum(LIFECYCLE_TRANSITION_RELATIONS),
    fromStageRecordId: StageRecordIdSchema,
    toStageRecordId: StageRecordIdSchema,
    recordedAt: TimestampSchema,
    recordedBy: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'LifecycleTransitionRecord',
    title: 'LifecycleTransitionRecord',
    description:
      'One lifecycle transition record: a typed relation (precedes/branch/overlap/loop/pause/resume) between two stage records (self-relation for pause/resume).',
  });

/** One lifecycle transition record. */
export type LifecycleTransitionRecord = z.infer<typeof LifecycleTransitionRecordSchema>;

// --------------------------------------------------------------------------------
// Authority pre-classification (the W023 pricing pre-classification
// pattern): pack-style records that redefine stage semantics or claim a
// second authority are typed authority violations BEFORE schema
// validation surfaces them as generic rejections.
// --------------------------------------------------------------------------------

/** Whether a stage-shaped value names a non-universal lifecycle stage. */
function isNonUniversalStage(value: unknown): value is string {
  return typeof value === 'string' && !(UNIVERSAL_LIFECYCLE_STAGES as readonly string[]).includes(value);
}

/**
 * Pre-classify pack-style authority violations:
 * - any DP1.0-forbidden authority-claim field present on the record;
 * - a `stage`, `stages`, `universalStages`, or `lifecycleStages` field
 *   naming non-universal stages (redefining stage semantics);
 * - a `stageVocabulary` carrying non-universal stage keys.
 */
export function classifyLifecycleAuthority(value: unknown): DeliveryError | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in record) {
      return {
        code: 'authority-violation-rejected',
        message:
          `record declares "${field}" — a domain pack cannot claim a second lifecycle/baseline/schedule/delivery ` +
          'authority (DP1.0 forbidden list; the universal contracts are the authority)',
        field,
      };
    }
  }
  for (const key of ['stage', 'stages', 'universalStages', 'lifecycleStages']) {
    const stages = record[key];
    const values = Array.isArray(stages) ? stages : [stages];
    for (const candidate of values) {
      if (isNonUniversalStage(candidate)) {
        return {
          code: 'authority-violation-rejected',
          message:
            `record declares ${key} "${candidate}" — the eleven universal stages are the lifecycle authority ` +
            '(USL1.0); a pack-style record cannot redefine stage semantics',
          encounteredStage: candidate,
        };
      }
    }
  }
  const vocabulary = record['stageVocabulary'];
  if (vocabulary !== undefined && typeof vocabulary === 'object' && vocabulary !== null) {
    for (const key of Object.keys(vocabulary as Record<string, unknown>)) {
      if (isNonUniversalStage(key)) {
        return {
          code: 'authority-violation-rejected',
          message:
            `stageVocabulary binds "${key}" — the eleven universal stages are the lifecycle authority ` +
            '(USL1.0); a pack binds display vocabulary onto the universal stages, it never invents stages',
          encounteredStage: key,
        };
      }
    }
  }
  return null;
}

// --------------------------------------------------------------------------------
// The lifecycle graph (reference in-memory machinery).
// --------------------------------------------------------------------------------

/** The lifecycle graph state: stages + transitions, canonically ordered. */
export interface LifecycleGraph {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly stages: readonly LifecycleStageRecord[];
  readonly transitions: readonly LifecycleTransitionRecord[];
}

/** Projected stage status: derived from the pause/resume transition history. */
export function stageStatusOf(graph: LifecycleGraph, stageRecordId: string): StageProjectedStatus {
  const selfTransitions = graph.transitions
    .filter(
      (transition) =>
        transition.fromStageRecordId === stageRecordId && transition.toStageRecordId === stageRecordId,
    )
    .filter((transition) => transition.relation === 'pause' || transition.relation === 'resume')
    .sort((a, b) => {
      if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
      return a.recordId < b.recordId ? -1 : 1;
    });
  const last = selfTransitions[selfTransitions.length - 1];
  return last !== undefined && last.relation === 'pause' ? 'paused' : 'active';
}

/**
 * Admit a lifecycle stage record into the graph (append-only):
 * - pack-style authority violations pre-classify as
 *   `authority-violation-rejected`;
 * - schema validation (strict objects; vendor fields classify);
 * - tenant/solution scope must match (`cross-tenant-denied` /
 *   `validation`);
 * - the record id must be new (an exact re-admission is idempotent;
 *   different content under the same id is `version-conflict`).
 */
export function admitLifecycleStage(
  graph: LifecycleGraph,
  record: unknown,
): DeliveryResult<LifecycleGraph> {
  const authority = classifyLifecycleAuthority(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const parsed = LifecycleStageRecordSchema.safeParse(record);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const admitted = parsed.data;
  if (admitted.tenantId !== graph.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `stage record "${admitted.recordId}" belongs to tenant "${admitted.tenantId}" but the graph is scoped to "${graph.tenantId}" (R12)`,
        expectedTenantId: graph.tenantId,
        encounteredTenantId: admitted.tenantId,
      },
    };
  }
  if (admitted.subject.solutionId !== graph.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `stage record "${admitted.recordId}" subjects solution "${admitted.subject.solutionId}" but the graph is scoped to "${graph.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'graph input mixes solutions' }],
      },
    };
  }
  const existing = graph.stages.find((stage) => stage.recordId === admitted.recordId);
  if (existing !== undefined) {
    if (JSON.stringify(existing) === JSON.stringify(admitted)) {
      return { ok: true, value: graph };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `stage record "${admitted.recordId}" already exists with different content — stage records are immutable`,
        solutionId: graph.solutionId,
        version: admitted.recordId,
      },
    };
  }
  const stages = [...graph.stages, admitted].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  return { ok: true, value: { ...graph, stages } };
}

/**
 * Admit a lifecycle transition record into the graph (append-only) —
 * the TYPED relation rules (projections, NOT an FSM arc table):
 *
 * - `precedes`: different records, different stages (forward flow; a
 *   same-stage sequence is a `loop`);
 * - `branch`: different records (an alternative path — any stages);
 * - `overlap`: different records, both currently ACTIVE (concurrent
 *   stages — any stages, including the same one);
 * - `loop`: different records, re-entry — the target stage ordinal is
 *   backward or equal (forward flow is `precedes`);
 * - `pause`: SELF-relation on an ACTIVE stage (parks it);
 * - `resume`: SELF-relation on a PAUSED stage (resumes it).
 *
 * Unknown stage-record references are typed
 * `dangling-reference-rejected`; illegal relation shapes are typed
 * `lifecycle-conflict`.
 */
export function admitLifecycleTransition(
  graph: LifecycleGraph,
  record: unknown,
): DeliveryResult<LifecycleGraph> {
  const authority = classifyLifecycleAuthority(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const parsed = LifecycleTransitionRecordSchema.safeParse(record);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const admitted = parsed.data;
  if (admitted.tenantId !== graph.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `transition record "${admitted.recordId}" belongs to tenant "${admitted.tenantId}" but the graph is scoped to "${graph.tenantId}" (R12)`,
        expectedTenantId: graph.tenantId,
        encounteredTenantId: admitted.tenantId,
      },
    };
  }
  if (admitted.subject.solutionId !== graph.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `transition record "${admitted.recordId}" subjects solution "${admitted.subject.solutionId}" but the graph is scoped to "${graph.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'graph input mixes solutions' }],
      },
    };
  }
  const existingTransition = graph.transitions.find(
    (transition) => transition.recordId === admitted.recordId,
  );
  if (existingTransition !== undefined) {
    if (JSON.stringify(existingTransition) === JSON.stringify(admitted)) {
      return { ok: true, value: graph };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `transition record "${admitted.recordId}" already exists with different content — transition records are immutable`,
        solutionId: graph.solutionId,
        version: admitted.recordId,
      },
    };
  }
  const from = graph.stages.find((stage) => stage.recordId === admitted.fromStageRecordId);
  if (from === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `transition "${admitted.recordId}" references unknown stage record "${admitted.fromStageRecordId}"`,
        referenceKind: 'stage-record',
        referenceId: admitted.fromStageRecordId,
      },
    };
  }
  const to = graph.stages.find((stage) => stage.recordId === admitted.toStageRecordId);
  if (to === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `transition "${admitted.recordId}" references unknown stage record "${admitted.toStageRecordId}"`,
        referenceKind: 'stage-record',
        referenceId: admitted.toStageRecordId,
      },
    };
  }
  if (from.subject.subjectId !== admitted.subject.subjectId || to.subject.subjectId !== admitted.subject.subjectId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'transition endpoints must share the transition subject',
        issues: [{ path: 'subject', message: 'endpoint subject mismatch' }],
      },
    };
  }
  const conflict = (message: string): DeliveryError => ({
    code: 'lifecycle-conflict',
    message,
    subjectId: admitted.subject.subjectId,
    relation: admitted.relation,
  });
  switch (admitted.relation) {
    case 'precedes': {
      if (admitted.fromStageRecordId === admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('precedes connects two different stage records (a self-relation is pause/resume)'),
        };
      }
      if (from.stage === to.stage) {
        return {
          ok: false,
          error: conflict(
            `precedes connects different stages (encountered ${from.stage} -> ${to.stage}; same-stage re-entry is a loop)`,
          ),
        };
      }
      break;
    }
    case 'branch': {
      if (admitted.fromStageRecordId === admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('branch connects two different stage records (an alternative path)'),
        };
      }
      break;
    }
    case 'overlap': {
      if (admitted.fromStageRecordId === admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('overlap connects two different stage records (concurrent stages)'),
        };
      }
      const fromStatus = stageStatusOf(graph, admitted.fromStageRecordId);
      const toStatus = stageStatusOf(graph, admitted.toStageRecordId);
      if (fromStatus !== 'active' || toStatus !== 'active') {
        return {
          ok: false,
          error: conflict(
            `overlap requires both stages active (encountered from=${fromStatus}, to=${toStatus})`,
          ),
        };
      }
      break;
    }
    case 'loop': {
      if (admitted.fromStageRecordId === admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('loop re-enters a stage through a different stage record'),
        };
      }
      if (stageOrdinal(to.stage) > stageOrdinal(from.stage)) {
        return {
          ok: false,
          error: conflict(
            `loop re-enters backward or same stages (encountered ${from.stage} -> ${to.stage}; forward flow is precedes)`,
          ),
        };
      }
      break;
    }
    case 'pause': {
      if (admitted.fromStageRecordId !== admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('pause is a self-relation on the stage record being parked'),
        };
      }
      const status = stageStatusOf(graph, admitted.fromStageRecordId);
      if (status !== 'active') {
        return {
          ok: false,
          error: conflict(`pause requires an active stage (encountered ${status})`),
        };
      }
      break;
    }
    case 'resume': {
      if (admitted.fromStageRecordId !== admitted.toStageRecordId) {
        return {
          ok: false,
          error: conflict('resume is a self-relation on the paused stage record'),
        };
      }
      const status = stageStatusOf(graph, admitted.fromStageRecordId);
      if (status !== 'paused') {
        return {
          ok: false,
          error: conflict(`resume requires a paused stage (encountered ${status})`),
        };
      }
      break;
    }
  }
  const transitions = [...graph.transitions, admitted].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  );
  return { ok: true, value: { ...graph, transitions } };
}

/**
 * Deterministic lifecycle projection: the stage records sorted by id with
 * their DERIVED statuses and their in/out relations. Input order never
 * leaks.
 */
export interface LifecycleStageProjection {
  readonly recordId: string;
  readonly stage: UniversalLifecycleStage;
  readonly subjectId: string;
  readonly enteredAt: string;
  readonly status: StageProjectedStatus;
  readonly relationsOut: readonly { readonly relation: LifecycleTransitionRelation; readonly toStageRecordId: string }[];
  readonly relationsIn: readonly { readonly relation: LifecycleTransitionRelation; readonly fromStageRecordId: string }[];
}

/** Fold the lifecycle graph into the deterministic stage projection. */
export function foldLifecycleStages(graph: LifecycleGraph): readonly LifecycleStageProjection[] {
  return graph.stages
    .map((stage) => ({
      recordId: stage.recordId,
      stage: stage.stage,
      subjectId: stage.subject.subjectId,
      enteredAt: stage.enteredAt,
      status: stageStatusOf(graph, stage.recordId),
      relationsOut: graph.transitions
        .filter((transition) => transition.fromStageRecordId === stage.recordId)
        .map((transition) => ({
          relation: transition.relation,
          toStageRecordId: transition.toStageRecordId,
        }))
        .sort((a, b) => (a.toStageRecordId < b.toStageRecordId ? -1 : 1)),
      relationsIn: graph.transitions
        .filter((transition) => transition.toStageRecordId === stage.recordId)
        .map((transition) => ({
          relation: transition.relation,
          fromStageRecordId: transition.fromStageRecordId,
        }))
        .sort((a, b) => (a.fromStageRecordId < b.fromStageRecordId ? -1 : 1)),
    }))
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}

// --------------------------------------------------------------------------------
// Domain pack profiles (DP1.0): how a pack binds onto these contracts.
// --------------------------------------------------------------------------------

/** One projection rule of a pack: a Navigator projection + presentation. */
export const ProjectionRuleSchema = z
  .strictObject({
    projection: z.enum(NAVIGATOR_PROJECTION_KINDS),
    presentation: z.string().min(1).max(256),
  })
  .readonly()
  .meta({
    id: 'ProjectionRule',
    title: 'ProjectionRule',
    description:
      'One pack projection rule: a Navigator projection kind (world-view, solution, decision, program-of-work, schedule, acquisition, realization, verification, forecast, outcomes, learning) plus its presentation.',
  });

/** One projection rule. */
export type ProjectionRule = z.infer<typeof ProjectionRuleSchema>;

/**
 * The machine-readable domain-pack profile (DP1.0): the pack's identity,
 * the universal lifecycle version it targets, its display vocabulary for
 * the universal stages, and its projection rules. A pack TEACHES the
 * lifecycle — it never claims lifecycle, baseline, schedule or delivery
 * authority (`authority-violation-rejected`).
 */
export const SolutionPackProfileSchema = z
  .strictObject({
    schema: z.literal(PACK_PROFILE_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    packId: QualifiedNameSchema,
    packVersion: SemverCoreSchema,
    tenantId: TenantIdSchema,
    supportedLifecycleVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    stageVocabulary: z.record(z.enum(UNIVERSAL_LIFECYCLE_STAGES), z.string().min(1).max(64)),
    projectionRules: z.array(ProjectionRuleSchema).max(32),
    measurementNote: z.string().max(2048).optional(),
    capabilityDependencies: z.array(QualifiedNameSchema).max(64).optional(),
    migrationNote: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((profile, ctx) => {
    for (let i = 1; i < profile.projectionRules.length; i += 1) {
      if (
        profile.projectionRules[i]!.projection < profile.projectionRules[i - 1]!.projection
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'projectionRules must be sorted by projection ascending (deterministic serialization)',
          path: ['projectionRules'],
        });
        break;
      }
      if (
        profile.projectionRules[i]!.projection === profile.projectionRules[i - 1]!.projection
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'projectionRules must be duplicate-free by projection',
          path: ['projectionRules'],
        });
        break;
      }
    }
    for (let i = 1; i < (profile.capabilityDependencies?.length ?? 0); i += 1) {
      if (
        profile.capabilityDependencies![i]! < profile.capabilityDependencies![i - 1]!
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'capabilityDependencies must be sorted ascending (deterministic serialization)',
          path: ['capabilityDependencies'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'SolutionPackProfile',
    title: 'SolutionPackProfile',
    description:
      'The machine-readable domain-pack profile (DP1.0): pack identity, targeted universal lifecycle version, stage display vocabulary, and projection rules over the eleven Navigator projections.',
  });

/** One solution pack profile. */
export type SolutionPackProfile = z.infer<typeof SolutionPackProfileSchema>;

/**
 * Admit a domain-pack profile (DP1.0 acceptance):
 * - authority-claim fields and non-universal stage bindings pre-classify
 *   as `authority-violation-rejected`;
 * - the profile must declare EXACTLY the universal lifecycle version this
 *   kernel teaches (`validation` at the precise path otherwise);
 * - strict-object vendor fields classify as `vendor-fields-rejected`.
 */
export function admitPackProfile(profile: unknown): DeliveryResult<SolutionPackProfile> {
  const authority = classifyLifecycleAuthority(profile);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const parsed = SolutionPackProfileSchema.safeParse(profile);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  if (parsed.data.supportedLifecycleVersion !== SOLUTION_DELIVERY_USL_VERSION) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `pack targets lifecycle version "${parsed.data.supportedLifecycleVersion}" but this kernel teaches "${SOLUTION_DELIVERY_USL_VERSION}" (DP1.0 acceptance: declare the universal lifecycle version)`,
        issues: [
          {
            path: 'supportedLifecycleVersion',
            message: `expected "${SOLUTION_DELIVERY_USL_VERSION}"`,
          },
        ],
      },
    };
  }
  return { ok: true, value: parsed.data };
}
