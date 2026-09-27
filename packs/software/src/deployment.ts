/**
 * The deployment projection (W027, the DP1.0 projection rule + the W003
 * authority seam): typed data and PURE PROJECTION FUNCTIONS for software
 * deployment.
 *
 * - The DEPLOYMENT-ENVIRONMENT vocabulary: provider-neutral tiers
 *   (development/integration/staging/production) as typed descriptors.
 * - The DEPLOYMENT-PLAN view: a pure fold over the W036
 *   `SealedProgramOfWork` realization strategy — rollout steps
 *   identity-mapped to canonical activity ids, grouped into environments
 *   through a caller-supplied assignment index (typed data referencing
 *   canonical ids — never a parallel tracker).
 * - The DEPLOY-PROPOSAL TEMPLATES: versioned, content-addressed W003
 *   action-proposal templates (safety metadata REQUIRED, W003 shapes).
 *   `renderDeployProposal` binds caller parameters into a typed
 *   `ActionProposal` validated through the W003 admission pipeline — the
 *   ONLY way a deployment action leaves this pack. The pack NEVER
 *   executes: authorization and execution belong to the W022 Action
 *   Gateway (`gateway-bypass-rejected` classifies any execution attempt
 *   at the pack admission surfaces).
 */
import { z } from 'zod';
import {
  ActionProposalSchema,
  parseActionProposal,
  PreconditionSchema,
  PredictedEffectSchema,
  ReversibilityClassificationSchema,
  SideEffectSchema,
  AuthorityRequirementsSchema,
  ActionTypeReferenceSchema,
  type ActionProposal,
} from '@epoch/action-protocol';
import {
  AgentIdSchema,
  JsonValueSchema,
  MessageIdSchema,
  TimestampSchema,
} from '@epoch/agent-protocol';
import {
  ACTIVITY_DISPLAY_STATES,
  DEPLOYMENT_ENVIRONMENT_ROW_TIERS,
  DEPLOYMENT_ENVIRONMENT_TIERS,
  DEPLOYMENT_PLAN_VIEW_SCHEMA_NAME,
  DEPLOYMENT_STEP_STATE_TERMS,
  DEPLOY_PROPOSAL_TEMPLATE_SCHEMA_NAME,
  ENVIRONMENT_SCHEMA_NAME,
  PARAMETER_NAME_PATTERN,
  REALIZATION_VARIANT_TERMS,
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
  UNASSIGNED_ENVIRONMENT_ID,
  UNASSIGNED_ENVIRONMENT_TIER,
} from './version';
import {
  classifyPackRecord,
  digestOf,
  parsePackRecord,
  refineSortedUnique,
} from './util';
import type { PackError, PackResult } from './errors';
import { SOFTWARE_STAGE_VOCABULARY } from './profile';
import { activityDisplayStateOf } from './workitem';
import {
  verifySealedProgramOfWork,
  type SealedProgramOfWork,
} from '@epoch/solution-delivery';

// --------------------------------------------------------------------------------
// The deployment-environment vocabulary (typed data, provider-neutral).
// --------------------------------------------------------------------------------

/** One deployment environment descriptor: a provider-neutral tier. */
export const DeploymentEnvironmentSchema = z
  .strictObject({
    schema: z.literal(ENVIRONMENT_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    environmentId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    tier: z.enum(DEPLOYMENT_ENVIRONMENT_TIERS),
    title: z.string().min(1).max(256),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'DeploymentEnvironment',
    title: 'DeploymentEnvironment',
    description:
      'One deployment environment descriptor: a provider-neutral tier (development/integration/staging/production) — vocabulary data for the deployment-plan projection, never a second authority.',
  });

/** One deployment environment. */
export type DeploymentEnvironment = z.infer<typeof DeploymentEnvironmentSchema>;

/**
 * The software deployment environments: typed vocabulary data over the
 * provider-neutral tiers, sorted by environmentId ascending,
 * duplicate-free.
 */
export const SOFTWARE_DEPLOYMENT_ENVIRONMENTS: readonly DeploymentEnvironment[] = [
  {
    schema: 'epoch.pack-software.environment',
    schemaVersion: 1,
    environmentId: 'software.environment.development',
    tier: 'development',
    title: 'Development',
    description:
      'Development environments — isolated per-team environments for ongoing implementation work; never customer-facing.',
  },
  {
    schema: 'epoch.pack-software.environment',
    schemaVersion: 1,
    environmentId: 'software.environment.integration',
    tier: 'integration',
    title: 'Integration',
    description:
      'Integration environments — shared environments where component changes integrate and integration suites run before release qualification.',
  },
  {
    schema: 'epoch.pack-software.environment',
    schemaVersion: 1,
    environmentId: 'software.environment.production',
    tier: 'production',
    title: 'Production',
    description:
      'Production environments — the live environments serving real traffic; rollouts carry the strictest gates and change-freeze constraints.',
  },
  {
    schema: 'epoch.pack-software.environment',
    schemaVersion: 1,
    environmentId: 'software.environment.staging',
    tier: 'staging',
    title: 'Staging',
    description:
      'Staging environments — production-shaped rehearsal environments where release candidates are qualified before rollout.',
  },
];

/**
 * The environment-assignment index: activity ids of the ProgramOfWork
 * mapped to deployment-environment ids. Sorted by activityId ascending,
 * duplicate-free — typed data that REFERENCES canonical activity ids and
 * stores nothing (never a parallel tracker).
 */
export const EnvironmentAssignmentIndexSchema = z
  .strictObject({
    schema: z.literal('epoch.pack-software.environment-assignment-index'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    assignments: z
      .array(
        z
          .strictObject({
            activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
            environmentId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
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
    id: 'EnvironmentAssignmentIndex',
    title: 'EnvironmentAssignmentIndex',
    description:
      'The environment-assignment index: activity ids mapped to deployment-environment ids (sorted, duplicate-free; references canonical ProgramOfWork activity ids — never a parallel tracker).',
  });

/** One environment-assignment index. */
export type EnvironmentAssignmentIndex = z.infer<typeof EnvironmentAssignmentIndexSchema>;

// --------------------------------------------------------------------------------
// The deployment-plan view model.
// --------------------------------------------------------------------------------

/** One rollout step: the canonical activity with deployment vocabulary. */
export const RolloutStepSchema = z
  .strictObject({
    /** The canonical activity id — the SAME id, never minted. */
    activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The canonical work-package id owning the activity. */
    workPackageId: z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The deployment environment of the step (vocabulary id; the unassigned bucket for unclassified steps). */
    environmentId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    /** The universal realization variant of the underlying activity (unchanged). */
    realizationVariant: z.string().min(1).max(64),
    /** The software display term of the realization variant. */
    stepTerm: z.string().min(1).max(64),
    /** The derived display state (from the canonical lifecycle states). */
    displayState: z.enum(ACTIVITY_DISPLAY_STATES),
    /** The deployment display term of the state (Pending/Running/Impeded/Complete). */
    displayStateTerm: z.string().min(1).max(64),
    plannedStart: z.string().min(1).optional(),
    plannedFinish: z.string().min(1).optional(),
    actualStart: z.string().min(1).optional(),
    actualFinish: z.string().min(1).optional(),
    actualProgress: z.number().min(0).max(1).optional(),
    predecessors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    successors: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    /** The canonical verification-gate ids gating this step (deploy/SLO gates). */
    gateIds: z.array(z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
    /** The canonical blocker ids raised against this step. */
    blockerIds: z.array(z.string().regex(/^blocker:[a-z0-9][a-z0-9-]{0,62}$/)).max(64),
    /** The canonical milestone ids carrying this step. */
    milestoneIds: z.array(z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
  })
  .readonly()
  .meta({
    id: 'RolloutStep',
    title: 'RolloutStep',
    description:
      'One deployment-plan rollout step: the canonical activity (identity-mapped id) with its environment, realization-variant term, derived display state, dependencies, gates, blockers and milestones.',
  });

/** One rollout step. */
export type RolloutStep = z.infer<typeof RolloutStepSchema>;

/** One environment row of the deployment plan: the steps grouped into it. */
export const DeploymentEnvironmentRowSchema = z
  .strictObject({
    /** The deployment-environment id (vocabulary id; the unassigned bucket for unclassified steps). */
    environmentId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    tier: z.enum(DEPLOYMENT_ENVIRONMENT_ROW_TIERS),
    title: z.string().min(1).max(256),
    /** The canonical activity ids rolling out in this environment. */
    stepIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
    /** The verification gates gating those steps. */
    gateCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'DeploymentEnvironmentRow',
    title: 'DeploymentEnvironmentRow',
    description:
      'One environment row of the deployment plan: the deployment-environment vocabulary row with the canonical rollout-step ids grouped into it and its gate count.',
  });

/** One environment row. */
export type DeploymentEnvironmentRow = z.infer<typeof DeploymentEnvironmentRowSchema>;

/** One unique dependency edge of the deployment plan. */
export const DeploymentDependencySchema = z
  .strictObject({
    predecessorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
    successorActivityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly()
  .meta({
    id: 'DeploymentDependency',
    title: 'DeploymentDependency',
    description: 'One unique dependency edge of the deployment plan (canonical activity ids).',
  });

/** One deployment-plan dependency edge. */
export type DeploymentDependency = z.infer<typeof DeploymentDependencySchema>;

/** The deployment-plan view over one sealed program of work. */
export const DeploymentPlanViewSchema = z
  .strictObject({
    schema: z.literal(DEPLOYMENT_PLAN_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    packId: z.literal(SOFTWARE_PACK_ID),
    packVersion: z.literal(SOFTWARE_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    programId: z.string().regex(/^program:[a-z0-9][a-z0-9-]{0,62}$/),
    title: z.string().min(1).max(256),
    /** The software display vocabulary for the universal lifecycle stages. */
    stageVocabulary: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    environments: z.array(DeploymentEnvironmentRowSchema).max(64),
    rolloutSteps: z.array(RolloutStepSchema).max(2048),
    dependencies: z.array(DeploymentDependencySchema).max(4096),
    summary: z
      .strictObject({
        environmentCount: z.number().int().min(0),
        stepCount: z.number().int().min(0),
        dependencyCount: z.number().int().min(0),
        gateCount: z.number().int().min(0),
        blockerCount: z.number().int().min(0),
        stateCounts: z.record(z.string().min(1).max(64), z.number().int().min(0)),
      })
      .readonly(),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .superRefine((view, ctx) => {
    for (let i = 1; i < view.environments.length; i += 1) {
      if (view.environments[i]!.environmentId < view.environments[i - 1]!.environmentId) {
        ctx.addIssue({
          code: 'custom',
          message: 'environments must be sorted by environmentId ascending (deterministic serialization)',
          path: ['environments'],
        });
        break;
      }
    }
    for (let i = 1; i < view.rolloutSteps.length; i += 1) {
      if (view.rolloutSteps[i]!.activityId < view.rolloutSteps[i - 1]!.activityId) {
        ctx.addIssue({
          code: 'custom',
          message: 'rolloutSteps must be sorted by activityId ascending (deterministic serialization)',
          path: ['rolloutSteps'],
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
    id: 'DeploymentPlanView',
    title: 'DeploymentPlanView',
    description:
      'The deployment-plan view: environments and rollout steps identity-mapped to the canonical activity ids of one sealed ProgramOfWork realization strategy — a synchronized projection, never an execution authority.',
  });

/** One deployment-plan view. */
export type DeploymentPlanView = z.infer<typeof DeploymentPlanViewSchema>;

/** The inputs of the deployment-plan projection. */
export interface DeploymentPlanInputs {
  readonly program: SealedProgramOfWork;
  /** The caller-supplied environment assignments (defaults: every step is unassigned). */
  readonly assignments?: EnvironmentAssignmentIndex | undefined;
  /** The environment vocabulary (defaults to the pack environments). */
  readonly environments?: readonly DeploymentEnvironment[] | undefined;
}

/** The deployment display term of one derived display state. */
export function deploymentStepStateTermOf(state: (typeof ACTIVITY_DISPLAY_STATES)[number]): string {
  return DEPLOYMENT_STEP_STATE_TERMS[state];
}

/**
 * Project the deployment-plan view over one sealed program of work's
 * realization strategy:
 *
 * - the program must verify (`digest-mismatch` on a tampered seal);
 * - every rollout step is IDENTITY-MAPPED to its canonical activity id —
 *   the pack never mints deployment identities;
 * - steps group into environments through the caller-supplied assignment
 *   index; an assignment naming an environment outside the vocabulary is
 *   a typed `dangling-reference-rejected`; unassigned steps fold into the
 *   deterministic unassigned bucket (SN1.0 partial data — never a
 *   blocker);
 * - step display states DERIVE from the canonical lifecycle states on
 *   each activity (the shared display-state fold);
 * - dependencies are the DEDUPLICATED union of the predecessor edges.
 *
 * Deterministic: identical inputs yield identical digests; input order
 * never leaks.
 */
export function projectDeploymentPlan(inputs: DeploymentPlanInputs): PackResult<DeploymentPlanView> {
  const verifiedProgram = verifySealedProgramOfWork(inputs.program);
  if (!verifiedProgram.ok) {
    return verifiedProgram;
  }
  const program = verifiedProgram.value;

  const environments = [...(inputs.environments ?? SOFTWARE_DEPLOYMENT_ENVIRONMENTS)].sort((a, b) =>
    a.environmentId < b.environmentId ? -1 : 1,
  );
  const environmentById = new Map(
    environments.map((environment) => [environment.environmentId, environment]),
  );

  const assignments = inputs.assignments;
  if (assignments !== undefined) {
    for (const assignment of assignments.assignments) {
      if (!environmentById.has(assignment.environmentId)) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message:
              `environment assignment for activity "${assignment.activityId}" names unknown environment ` +
              `"${assignment.environmentId}" (not in the deployment-environment vocabulary)`,
            referenceKind: 'environment',
            referenceId: assignment.environmentId,
          } satisfies PackError,
        };
      }
    }
  }
  const environmentOfActivity = new Map<string, string>();
  for (const assignment of assignments?.assignments ?? []) {
    environmentOfActivity.set(assignment.activityId, assignment.environmentId);
  }

  const gatesOfActivity = new Map<string, string[]>();
  for (const workPackage of program.workPackages) {
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

  const stepTermOf = (variant: string): string =>
    REALIZATION_VARIANT_TERMS[variant as keyof typeof REALIZATION_VARIANT_TERMS] ?? variant;

  const rolloutSteps: RolloutStep[] = [];
  for (const workPackage of program.workPackages) {
    for (const activity of workPackage.activities) {
      const environmentId =
        environmentOfActivity.get(activity.activityId) ?? UNASSIGNED_ENVIRONMENT_ID;
      const displayState = activityDisplayStateOf(activity);
      rolloutSteps.push({
        activityId: activity.activityId,
        workPackageId: workPackage.workPackageId,
        title: activity.title,
        environmentId,
        realizationVariant: activity.realizationVariant ?? workPackage.realizationVariant,
        stepTerm: stepTermOf(activity.realizationVariant ?? workPackage.realizationVariant),
        displayState,
        displayStateTerm: deploymentStepStateTermOf(displayState),
        plannedStart: activity.plannedStart,
        plannedFinish: activity.plannedFinish,
        // Absent optionals are OMITTED (never explicit undefined) so every
        // view is a strict JSON value.
        ...(activity.actualStart !== undefined ? { actualStart: activity.actualStart } : {}),
        ...(activity.actualFinish !== undefined ? { actualFinish: activity.actualFinish } : {}),
        ...(activity.actualProgress !== undefined ? { actualProgress: activity.actualProgress } : {}),
        predecessors: [...activity.predecessors].sort(),
        successors: [...activity.successors].sort(),
        gateIds: [...(gatesOfActivity.get(activity.activityId) ?? [])].sort(),
        blockerIds: activity.blockers.map((blocker) => blocker.blockerId).sort(),
        milestoneIds: [...(milestonesOfActivity.get(activity.activityId) ?? [])].sort(),
      });
    }
  }
  rolloutSteps.sort((a, b) => (a.activityId < b.activityId ? -1 : 1));

  // Environment rows: only environments carrying >= 1 step, plus the
  // unassigned bucket when it has steps.
  const stepsPerEnvironment = new Map<string, RolloutStep[]>();
  for (const step of rolloutSteps) {
    const existing = stepsPerEnvironment.get(step.environmentId) ?? [];
    existing.push(step);
    stepsPerEnvironment.set(step.environmentId, existing);
  }
  const environmentRows: DeploymentEnvironmentRow[] = [];
  for (const [environmentId, steps] of [...stepsPerEnvironment.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  )) {
    const descriptor = environmentById.get(environmentId);
    environmentRows.push({
      environmentId,
      tier: descriptor?.tier ?? UNASSIGNED_ENVIRONMENT_TIER,
      title: descriptor?.title ?? 'Unassigned environments',
      stepIds: steps.map((step) => step.activityId).sort(),
      gateCount: steps.reduce((count, step) => count + step.gateIds.length, 0),
    });
  }

  const dependencySet = new Set<string>();
  const dependencies: DeploymentDependency[] = [];
  for (const step of rolloutSteps) {
    for (const predecessorId of step.predecessors) {
      const key = `${predecessorId}\u0000${step.activityId}`;
      if (dependencySet.has(key)) {
        continue;
      }
      dependencySet.add(key);
      dependencies.push({
        predecessorActivityId: predecessorId,
        successorActivityId: step.activityId,
      });
    }
  }
  dependencies.sort((a, b) => {
    if (a.predecessorActivityId !== b.predecessorActivityId) {
      return a.predecessorActivityId < b.predecessorActivityId ? -1 : 1;
    }
    return a.successorActivityId < b.successorActivityId ? -1 : 1;
  });

  const stateCounts: Record<string, number> = {};
  for (const state of ACTIVITY_DISPLAY_STATES) {
    stateCounts[state] = 0;
  }
  for (const step of rolloutSteps) {
    stateCounts[step.displayState] = (stateCounts[step.displayState] ?? 0) + 1;
  }

  const content = {
    schema: DEPLOYMENT_PLAN_VIEW_SCHEMA_NAME,
    schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
    packId: SOFTWARE_PACK_ID,
    packVersion: SOFTWARE_PACK_VERSION,
    tenantId: program.tenantId,
    solutionId: program.solutionId,
    programId: program.programId,
    title: 'Deployment plan',
    stageVocabulary: { ...SOFTWARE_STAGE_VOCABULARY },
    environments: environmentRows,
    rolloutSteps,
    dependencies,
    summary: {
      environmentCount: environmentRows.length,
      stepCount: rolloutSteps.length,
      dependencyCount: dependencies.length,
      gateCount: rolloutSteps.reduce((count, step) => count + step.gateIds.length, 0),
      blockerCount: rolloutSteps.reduce((count, step) => count + step.blockerIds.length, 0),
      stateCounts,
    },
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/**
 * Verify a deployment-plan view envelope: write-intent pre-classification,
 * schema validation + digest recomputation (`digest-mismatch` on tamper).
 * The view is a PROJECTION — verification proves the envelope is intact,
 * never that it is canonical state.
 */
export function verifyDeploymentPlanView(sealed: unknown): PackResult<DeploymentPlanView> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = DeploymentPlanViewSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'deployment plan view failed schema validation',
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
          'deployment plan view digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The deploy-proposal templates (W003 action proposals; NEVER executed).
// --------------------------------------------------------------------------------

/** Refine a plain string array to sorted + duplicate-free. */
function refineSortedUniqueStrings(
  values: readonly string[],
  ctx: z.RefinementCtx,
  path: string,
): void {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! < values[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (values[i]! === values[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free`,
        path: [path],
      });
      break;
    }
  }
}

/** The immutable content of one deploy-proposal template (W003 shapes). */
const DEPLOY_PROPOSAL_TEMPLATE_BASE = z.strictObject({
  schema: z.literal(DEPLOY_PROPOSAL_TEMPLATE_SCHEMA_NAME),
  schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
  templateId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
  templateVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().min(1).max(256),
  description: z.string().max(4096).optional(),
  /** The W003 action type this template proposes. */
  actionType: ActionTypeReferenceSchema,
  /** The declared parameter names (the exact set a render must supply). */
  parameterNames: z.array(z.string().regex(PARAMETER_NAME_PATTERN)).max(32),
  /** The W003 preconditions (REQUIRED safety metadata). */
  preconditions: z.array(PreconditionSchema),
  /** The W003 predicted effects (REQUIRED, at least one). */
  predictedEffects: z.array(PredictedEffectSchema).min(1),
  /** The W003 side effects (REQUIRED). */
  sideEffects: z.array(SideEffectSchema),
  /** The W003 reversibility classification (REQUIRED). */
  reversibility: ReversibilityClassificationSchema,
  /** The W003 authority requirements (REQUIRED — the W022 gateway evaluates them). */
  authorityRequirements: AuthorityRequirementsSchema,
});

/** The immutable content of one deploy-proposal template (validated). */
export const DeployProposalTemplateContentSchema = DEPLOY_PROPOSAL_TEMPLATE_BASE.readonly()
  .superRefine((template, ctx) => {
    refineSortedUniqueStrings(template.parameterNames, ctx, 'parameterNames');
  })
  .meta({
    id: 'DeployProposalTemplateContent',
    title: 'DeployProposalTemplateContent',
    description:
      'The immutable content of one deploy-proposal template: the W003 action type, the declared parameter names, and the REQUIRED W003 safety metadata (preconditions, predicted effects, side effects, reversibility, authority requirements).',
  });

/** One deploy-proposal template content. */
export type DeployProposalTemplateContent = z.infer<typeof DeployProposalTemplateContentSchema>;

/** The SEALED deploy-proposal template: content plus its SHA-256 digest. */
export const SealedDeployProposalTemplateSchema = z
  .strictObject({
    ...DEPLOY_PROPOSAL_TEMPLATE_BASE.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedDeployProposalTemplate',
    title: 'SealedDeployProposalTemplate',
    description:
      'The sealed deploy-proposal template: canonically ordered immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed deploy-proposal template. */
export type SealedDeployProposalTemplate = z.infer<typeof SealedDeployProposalTemplateSchema>;

/**
 * Seal a deploy-proposal template: write-intent pre-classification
 * (`gateway-bypass-rejected` / `parallel-tracker-rejected`), schema
 * validation, then the SHA-256 content digest. Total — errors are values.
 */
export function sealDeployProposalTemplate(
  content: unknown,
): PackResult<SealedDeployProposalTemplate> {
  const writeIntent = classifyPackRecord(content);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(DeployProposalTemplateContentSchema, content);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, value: { ...parsed.value, contentDigest: digestOf(parsed.value) } };
}

/**
 * Verify a sealed deploy-proposal template: write-intent
 * pre-classification, schema validation + digest recomputation
 * (`digest-mismatch` on tamper).
 */
export function verifyDeployProposalTemplate(
  sealed: unknown,
): PackResult<SealedDeployProposalTemplate> {
  const writeIntent = classifyPackRecord(sealed);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(SealedDeployProposalTemplateSchema, sealed);
  if (!parsed.ok) {
    return parsed;
  }
  const { contentDigest, ...content } = parsed.value;
  const expected = digestOf(content);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed deploy-proposal template digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      } satisfies PackError,
    };
  }
  return { ok: true, value: parsed.value };
}

/** The release-rollout deploy-proposal template content (loose JSON data). */
const RELEASE_ROLLOUT_TEMPLATE: DeployProposalTemplateContent = {
  schema: 'epoch.pack-software.deploy-proposal-template',
  schemaVersion: 1,
  templateId: 'software.deploy.template.release-rollout',
  templateVersion: '1.0.0',
  title: 'Release rollout proposal',
  description:
    'Propose rolling one release unit out to one target environment through one canonical rollout step. A typed W003 action proposal — the W022 Action Gateway authorizes and executes it.',
  actionType: { id: 'software.deploy.release-rollout', version: '1.0.0' },
  parameterNames: ['environment', 'release_unit', 'rollout_step'],
  preconditions: [
    {
      description:
        'The release unit passed its deploy gate for the target environment (verification evidence referenced by digest).',
    },
    {
      description:
        'The rollout step is planned in the sealed ProgramOfWork and not impeded by an open blocker.',
    },
  ],
  predictedEffects: [
    {
      description: 'The release unit serves the target environment at the proposed version.',
      confidence: { kind: 'deterministic' },
    },
  ],
  sideEffects: [
    {
      description:
        'Traffic in the target environment shifts to the new release version of the release unit.',
      reversible: true,
    },
  ],
  reversibility: {
    kind: 'partially-reversible',
    notes: 'A rollback restores the previous release version; rollout audit and telemetry artifacts persist.',
  },
  authorityRequirements: {
    requiredScopes: ['external:deployment:write'],
    requiresHumanApproval: true,
    approvalQuorum: { approvals: 1, roles: ['release-manager'] },
  },
};

/** The infrastructure-change deploy-proposal template content (loose JSON data). */
const INFRASTRUCTURE_CHANGE_PROPOSAL_TEMPLATE: DeployProposalTemplateContent = {
  schema: 'epoch.pack-software.deploy-proposal-template',
  schemaVersion: 1,
  templateId: 'software.deploy.template.infrastructure-change',
  templateVersion: '1.0.0',
  title: 'Infrastructure change proposal',
  description:
    'Propose applying one planned infrastructure change to one environment through one canonical rollout step. A typed W003 action proposal — the W022 Action Gateway authorizes and executes it.',
  actionType: { id: 'software.infrastructure.change', version: '1.0.0' },
  parameterNames: ['change_step', 'environment', 'resource_ref'],
  preconditions: [
    {
      description: 'The change plan and its rollback path are prepared and referenced by digest.',
    },
    {
      description:
        'The change step is planned in the sealed ProgramOfWork and not inside a change-freeze window.',
    },
  ],
  predictedEffects: [
    {
      description:
        'The environment infrastructure reaches the planned state for the referenced resource.',
      confidence: { kind: 'deterministic' },
    },
  ],
  sideEffects: [
    {
      description:
        'Capacity in the environment is reprovisioned; running workloads may restart during the change.',
      reversible: true,
    },
  ],
  reversibility: {
    kind: 'partially-reversible',
    notes:
      'The previous infrastructure state is restorable from the change plan; destroyed transient resources are not.',
  },
  authorityRequirements: {
    requiredScopes: ['external:infrastructure:write'],
    requiresHumanApproval: true,
    approvalQuorum: { approvals: 1, roles: ['platform-engineer'] },
  },
};

/** The rollback deploy-proposal template content (loose JSON data). */
const ROLLBACK_TEMPLATE: DeployProposalTemplateContent = {
  schema: 'epoch.pack-software.deploy-proposal-template',
  schemaVersion: 1,
  templateId: 'software.deploy.template.rollback',
  templateVersion: '1.0.0',
  title: 'Rollback proposal',
  description:
    'Propose rolling one environment back to the previous release version of one release unit. A typed W003 action proposal — the W022 Action Gateway authorizes and executes it.',
  actionType: { id: 'software.deploy.rollback', version: '1.0.0' },
  parameterNames: ['environment', 'release_unit', 'target_step'],
  preconditions: [
    {
      description:
        'A previously deployed release version of the release unit exists in the target environment.',
    },
    {
      description: 'The rollback steps are prepared for the release unit and referenced by digest.',
    },
  ],
  predictedEffects: [
    {
      description: 'The target environment serves the previous release version of the release unit.',
      confidence: { kind: 'deterministic' },
    },
  ],
  sideEffects: [
    {
      description: 'Features shipped in the rolled-back release become unavailable until redeployed.',
      reversible: false,
    },
  ],
  reversibility: {
    kind: 'reversible',
    via: 'compensating-action',
    notes: 'A compensating redeploy of the rolled-back release restores it.',
  },
  authorityRequirements: {
    requiredScopes: ['external:deployment:write'],
    requiresHumanApproval: true,
    approvalQuorum: { approvals: 2, roles: ['release-manager', 'service-owner'] },
  },
};

/**
 * The software deploy-proposal template catalog, sealed and sorted by
 * templateId ascending. Deterministic: the same catalog content yields
 * the same digests on every call.
 */
export function softwareDeployProposalTemplates(): readonly SealedDeployProposalTemplate[] {
  const contents = [
    INFRASTRUCTURE_CHANGE_PROPOSAL_TEMPLATE,
    RELEASE_ROLLOUT_TEMPLATE,
    ROLLBACK_TEMPLATE,
  ].sort((a, b) => (a.templateId < b.templateId ? -1 : 1));
  const sealed: SealedDeployProposalTemplate[] = [];
  for (const content of contents) {
    const result = sealDeployProposalTemplate(content);
    if (!result.ok) {
      throw new Error(
        `deploy proposal template "${content.templateId}" failed to seal (pack data invariant broken): ${JSON.stringify(result.error)}`,
      );
    }
    sealed.push(result.value);
  }
  return sealed;
}

// --------------------------------------------------------------------------------
// Proposal rendering (the W003/W022 authority seam — the ONLY exit path).
// --------------------------------------------------------------------------------

/** The caller-supplied render parameters of one deploy proposal. */
export const DeployProposalRenderParamsSchema = z
  .strictObject({
    /** The W003 proposal id (message-id grammar — no colons). */
    proposalId: MessageIdSchema,
    /** An explicit message id (defaults to the proposal id). */
    messageId: MessageIdSchema.optional(),
    /** The proposing agent (`agent:<slug>`). */
    proposedBy: AgentIdSchema,
    /** The proposal creation instant (producer-supplied — this pack reads no clock). */
    createdAt: TimestampSchema,
    /** The opaque external-resource target reference of the deployment. */
    targetRef: z.string().min(1).max(256),
    /** The parameter values — EXACTLY the template's declared parameter names. */
    parameters: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema),
    rationale: z.string().max(10000).optional(),
    /** Opaque evidence identifiers; evidence semantics are owned by W006. */
    evidenceRefs: z.array(z.string().min(1).max(256)).min(1).optional(),
    expiresAt: TimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'DeployProposalRenderParams',
    title: 'DeployProposalRenderParams',
    description:
      "The caller-supplied render parameters of one deploy proposal: proposal/agent identities, the producer-supplied instant, the opaque deployment target, the parameter values (exactly the template's declared set), and optional rationale/evidence/expiry.",
  });

/** One render parameter set. */
export type DeployProposalRenderParams = z.infer<typeof DeployProposalRenderParamsSchema>;

/**
 * Render one sealed deploy-proposal template into a typed W003
 * `ActionProposal`, validated through the W003 admission pipeline
 * (`parseActionProposal` — version gate, kind gate, schema). This is the
 * ONLY way a deployment action leaves this pack: the returned proposal is
 * DATA addressed to the W022 Action Gateway — the pack NEVER executes
 * (`gateway-bypass-rejected` classifies any execution attempt).
 *
 * Total: the parameters must carry EXACTLY the template's declared
 * parameter names (missing or unknown names are typed `validation`
 * errors); W003 admission failures surface as typed `validation` errors
 * carrying the pipeline issues.
 */
export function renderDeployProposal(
  template: SealedDeployProposalTemplate,
  params: unknown,
): PackResult<ActionProposal> {
  const writeIntent = classifyPackRecord(params);
  if (writeIntent !== null) {
    return { ok: false, error: writeIntent };
  }
  const parsed = parsePackRecord(DeployProposalRenderParamsSchema, params);
  if (!parsed.ok) {
    return parsed;
  }
  const render = parsed.value;
  const declared = new Set(template.parameterNames);
  for (const name of Object.keys(render.parameters)) {
    if (!declared.has(name)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `parameters carry "${name}" which the template does not declare`,
          issues: [{ path: 'parameters', message: `unknown parameter "${name}"` }],
        } satisfies PackError,
      };
    }
  }
  for (const name of template.parameterNames) {
    if (render.parameters[name] === undefined) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `parameters do not carry declared parameter "${name}"`,
          issues: [{ path: 'parameters', message: `missing parameter "${name}"` }],
        } satisfies PackError,
      };
    }
  }
  const message: Record<string, unknown> = {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: render.messageId ?? render.proposalId,
    createdAt: render.createdAt,
    proposalId: render.proposalId,
    proposedBy: render.proposedBy,
    actionType: template.actionType,
    target: { kind: 'external-resource', ref: render.targetRef },
    parameters: render.parameters,
    preconditions: template.preconditions,
    predictedEffects: template.predictedEffects,
    sideEffects: template.sideEffects,
    reversibility: template.reversibility,
    authorityRequirements: template.authorityRequirements,
    rationale: render.rationale ?? template.title,
    expiresAt: render.expiresAt,
  };
  if (render.evidenceRefs !== undefined) {
    message.evidenceRefs = render.evidenceRefs;
  }
  const admitted = parseActionProposal(message);
  if (!admitted.ok) {
    const error = admitted.error;
    const issues =
      error.kind === 'schema-violation'
        ? error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          }))
        : [{ path: 'protocolVersion', message: error.message }];
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `rendered deploy proposal failed W003 admission (${error.kind}): ${error.message}`,
        issues,
      } satisfies PackError,
    };
  }
  return { ok: true, value: admitted.value };
}

/** The W003 action-proposal schema, re-exported for round-trip evidence. */
export { ActionProposalSchema };
