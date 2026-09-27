// NAMED POSITIVE: the deployment-plan projection — environments and
// rollout steps identity-mapped to canonical activity ids (NEVER minted),
// grouped through the caller-supplied environment assignment index,
// display states DERIVED from canonical lifecycle states.
import { describe, expect, it } from 'vitest';
import {
  EnvironmentAssignmentIndexSchema,
  projectDeploymentPlan,
  verifyDeploymentPlanView,
  UNASSIGNED_ENVIRONMENT_ID,
} from '../src/index';
import {
  checkoutChain,
  environmentAssignments,
  sealedProgram,
  sealedSolution,
  OTHER_TENANT,
} from './fixtures';

describe('NAMED POSITIVE: the deployment-plan view projects the realization strategy', () => {
  const chain = checkoutChain();
  const plan = projectDeploymentPlan({
    program: chain.program,
    assignments: environmentAssignments(),
  });
  if (!plan.ok) {
    throw new Error('fixture deployment plan failed to project');
  }
  const view = plan.value;

  it('the view carries the canonical identity', () => {
    expect(view.tenantId).toBe('tenant:globex');
    expect(view.solutionId).toBe('solution:checkout-service');
    expect(view.programId).toBe('program:checkout-service-v1');
    expect(view.title).toBe('Deployment plan');
    expect(view.stageVocabulary['realize']).toBe('Build & Deploy');
  });

  it('every rollout step is identity-mapped to its canonical activity id', () => {
    const activityIds = new Set(
      chain.program.workPackages.flatMap((wp) => wp.activities.map((a) => a.activityId)),
    );
    expect(view.rolloutSteps).toHaveLength(13);
    for (const step of view.rolloutSteps) {
      expect(activityIds.has(step.activityId)).toBe(true);
    }
  });

  it('the steps group into the assigned environments', () => {
    const byId = new Map(view.environments.map((row) => [row.environmentId, row]));
    expect(byId.get('software.environment.staging')?.tier).toBe('staging');
    expect(byId.get('software.environment.staging')?.stepIds).toEqual([
      'activity:deploy-staging',
      'activity:provision-staging',
    ]);
    expect(byId.get('software.environment.production')?.tier).toBe('production');
    expect(byId.get('software.environment.production')?.stepIds).toEqual([
      'activity:deploy-production',
      'activity:observability-setup',
      'activity:provision-production',
      'activity:rollback-plan',
    ]);
    // Unassigned steps (engineering work) fold into the deterministic
    // unassigned bucket (SN1.0 partial data — never a blocker).
    expect(byId.get(UNASSIGNED_ENVIRONMENT_ID)?.tier).toBe('unassigned');
    expect(byId.get(UNASSIGNED_ENVIRONMENT_ID)?.stepIds).toHaveLength(7);
    expect(view.environments.map((row) => row.environmentId)).toEqual([
      'software.environment.production',
      'software.environment.staging',
      UNASSIGNED_ENVIRONMENT_ID,
    ]);
  });

  it('the step terms carry the software realization vocabulary', () => {
    const byId = new Map(view.rolloutSteps.map((step) => [step.activityId, step]));
    expect(byId.get('activity:deploy-staging')?.realizationVariant).toBe(
      'software-implementation-deployment',
    );
    expect(byId.get('activity:deploy-staging')?.stepTerm).toBe('Build & deploy');
    expect(byId.get('activity:provision-staging')?.realizationVariant).toBe(
      'infrastructure-provisioning',
    );
    expect(byId.get('activity:provision-staging')?.stepTerm).toBe('Infrastructure provisioning');
  });

  it('the step display states derive from the canonical lifecycle states', () => {
    const byId = new Map(view.rolloutSteps.map((step) => [step.activityId, step]));
    expect(byId.get('activity:deploy-staging')?.displayState).toBe('complete');
    expect(byId.get('activity:deploy-staging')?.displayStateTerm).toBe('Complete');
    expect(byId.get('activity:deploy-production')?.displayState).toBe('impeded');
    expect(byId.get('activity:deploy-production')?.displayStateTerm).toBe('Impeded');
    expect(byId.get('activity:api-implement')?.displayState).toBe('in-progress');
    expect(byId.get('activity:api-implement')?.displayStateTerm).toBe('Running');
    expect(byId.get('activity:api-design')?.displayState).toBe('not-started');
    expect(byId.get('activity:api-design')?.displayStateTerm).toBe('Pending');
    expect(view.summary.stateCounts).toEqual({
      'not-started': 6,
      'in-progress': 1,
      impeded: 1,
      complete: 5,
    });
  });

  it('the steps carry their gates, blockers and milestones (canonical ids)', () => {
    const byId = new Map(view.rolloutSteps.map((step) => [step.activityId, step]));
    expect(byId.get('activity:deploy-staging')?.gateIds).toEqual(['gate:staging-slo-check']);
    expect(byId.get('activity:deploy-production')?.gateIds).toEqual(['gate:production-slo-check']);
    expect(byId.get('activity:deploy-production')?.blockerIds).toEqual(['blocker:change-freeze']);
    expect(byId.get('activity:deploy-staging')?.milestoneIds).toEqual(['milestone:staging-release']);
  });

  it('the dependencies are deduplicated canonical edges', () => {
    const keys = view.dependencies.map(
      (dependency) => `${dependency.predecessorActivityId}->${dependency.successorActivityId}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(view.summary.dependencyCount).toBe(view.dependencies.length);
  });

  it('the summary counts the environments, steps and gates', () => {
    expect(view.summary.environmentCount).toBe(3);
    expect(view.summary.stepCount).toBe(13);
    expect(view.summary.gateCount).toBe(8);
    expect(view.summary.blockerCount).toBe(1);
  });

  it('the view round-trips through verification', () => {
    const verified = verifyDeploymentPlanView(JSON.parse(JSON.stringify(view)));
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(view);
    }
  });
});

describe('NAMED POSITIVE: the deployment plan under partial data (SN1.0)', () => {
  it('without assignments every step folds into the unassigned bucket (never a blocker)', () => {
    const program = sealedProgram(sealedSolution());
    const plan = projectDeploymentPlan({ program });
    if (!plan.ok) {
      throw new Error('partial deployment plan failed to project');
    }
    expect(plan.value.environments).toHaveLength(1);
    expect(plan.value.environments[0]!.environmentId).toBe(UNASSIGNED_ENVIRONMENT_ID);
    expect(plan.value.environments[0]!.stepIds).toHaveLength(13);
    expect(plan.value.rolloutSteps).toHaveLength(13);
  });

  it('the assignment index schema rejects unsorted assignments', () => {
    const parsed = EnvironmentAssignmentIndexSchema.safeParse({
      schema: 'epoch.pack-software.environment-assignment-index',
      schemaVersion: 1,
      assignments: [
        { activityId: 'activity:zzz-late', environmentId: 'software.environment.staging' },
        { activityId: 'activity:aaa-early', environmentId: 'software.environment.staging' },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('NAMED NEGATIVE: the deployment-plan projection rejects malformed inputs', () => {
  it('an assignment naming an unknown environment is dangling-reference-rejected', () => {
    const program = sealedProgram(sealedSolution());
    const plan = projectDeploymentPlan({
      program,
      assignments: {
        schema: 'epoch.pack-software.environment-assignment-index',
        schemaVersion: 1,
        assignments: [
          { activityId: 'activity:deploy-staging', environmentId: 'software.environment.unknown-env' },
        ],
      },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.error.code).toBe('dangling-reference-rejected');
    }
  });

  it('a tampered program seal is rejected (digest-mismatch)', () => {
    const program = sealedProgram(sealedSolution());
    const tampered = { ...program, title: 'Tampered programme' };
    const plan = projectDeploymentPlan({ program: tampered });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.error.code).toBe('digest-mismatch');
    }
  });

  it('a program from a foreign tenant is carried as the input tenant (no cross-tenant view)', () => {
    const solution = sealedSolution();
    const foreignProgram = sealedProgram({ ...solution, tenantId: OTHER_TENANT });
    const plan = projectDeploymentPlan({ program: foreignProgram });
    if (!plan.ok) {
      throw new Error('foreign-tenant plan failed to project');
    }
    expect(plan.value.tenantId).toBe(OTHER_TENANT);
  });
});
