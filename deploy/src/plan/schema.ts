/**
 * @epoch/deploy-model — DEPLOY PLAN validators.
 *
 * A plan is a DETERMINISTIC FUNCTION of (topology revision + component set
 * + environment + gate policy + caller instants): an ordered,
 * dependency-sorted sequence of typed steps — build, verify (gate),
 * rollback-point, promote, health-check — each content-addressed, with the
 * whole plan sealed by a replay-stable digest. The plan is immutable
 * INTENT; effects belong to the executor's run records.
 */
import { z } from 'zod';
import { DeployRecordVersionSchema, ComponentIdSchema, EnvironmentIdSchema, GateIdSchema, PlanIdSchema, RevisionSchema, Sha256DigestSchema } from '../primitives';
import { DeployProvenanceSchema } from '../provenance';
import { STEP_KINDS } from '../version';

/** Reference to the exact topology revision a plan was planned against. */
export const TopologyRevisionRefSchema = z
  .strictObject({
    topologyId: z.string().regex(/^topo:[a-z0-9][a-z0-9-]{0,62}$/),
    sequence: z.number().int().min(1),
    digest: Sha256DigestSchema,
  })
  .readonly();
export type TopologyRevisionRef = z.infer<typeof TopologyRevisionRefSchema>;

/** Reference to the gate policy every verify step of the plan gates on. */
export const GateRefSchema = z
  .strictObject({
    gateId: GateIdSchema,
    digest: Sha256DigestSchema,
    commandCount: z.number().int().min(1),
  })
  .readonly();
export type GateRef = z.infer<typeof GateRefSchema>;

const stepShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  /** Deterministic step id: `<ordinal>:<kind>:<componentId>`. */
  stepId: z
    .string()
    .regex(/^[1-9][0-9]*:(?:build|verify|promote|health-check|rollback-point):cmp:[a-z0-9][a-z0-9-]{0,62}$/),
  ordinal: z.number().int().min(1),
  kind: z.enum(STEP_KINDS),
  componentId: ComponentIdSchema,
  environmentId: EnvironmentIdSchema,
  /** The gate digest a `verify` step gates on (null otherwise). */
  gateDigest: Sha256DigestSchema.nullable(),
  /**
   * The prior revision a `rollback-point` records (null = not previously
   * placed — a fresh deploy whose rollback un-places). Null otherwise.
   */
  priorRevision: RevisionSchema.nullable(),
  provenance: DeployProvenanceSchema,
});

/** One plan step (content half). */
export const PlanStepContentSchema = stepShape.readonly();
export type PlanStepContent = z.infer<typeof PlanStepContentSchema>;

/** One sealed, content-addressed plan step. */
export const PlanStepSchema = stepShape.extend({ digest: Sha256DigestSchema }).readonly();
export type PlanStep = z.infer<typeof PlanStepSchema>;

const planShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  topology: TopologyRevisionRefSchema,
  environmentId: EnvironmentIdSchema,
  /** Owning tenant (must be within the environment's tenant scope). */
  tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
  tier: z.enum(['dev', 'staging', 'prod']),
  /** The deployment unit every promote of this plan installs. */
  deploymentRevision: RevisionSchema,
  /** The dependency-closed component set, canonically sorted. */
  componentSet: z.array(ComponentIdSchema).min(1).readonly(),
  gate: GateRefSchema,
  /** The ordered, dependency-sorted steps (ordinals 1..n, contiguous). */
  steps: z.array(PlanStepSchema).min(1).readonly(),
  provenance: DeployProvenanceSchema,
});

/** A deploy plan (content half; planId + digest are derived at seal time). */
export const DeployPlanContentSchema = planShape.readonly();
export type DeployPlanContent = z.infer<typeof DeployPlanContentSchema>;

/** A sealed deploy plan (planId + digest content-derived, replay-stable). */
export const DeployPlanSchema = planShape
  .extend({
    planId: PlanIdSchema,
    digest: Sha256DigestSchema,
  })
  .readonly();
export type DeployPlan = z.infer<typeof DeployPlanSchema>;
