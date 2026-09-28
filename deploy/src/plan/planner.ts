/**
 * @epoch/deploy-model — the DETERMINISTIC PLANNER.
 *
 * planDeployment(topology revision + component set + environment + gate
 * policy + caller instants) -> an ordered, dependency-sorted plan of typed
 * steps. The function is PURE over its inputs:
 *
 *   - the component set closes over `dependsOn` (no component deploys
 *     without its dependencies);
 *   - components are ordered topologically (dependencies first) with a
 *     lexicographic tiebreak, so the order is total and stable;
 *   - each component contributes the fixed micro-sequence
 *     build -> verify(gate) -> rollback-point -> promote -> health-check;
 *   - every step is sealed (content-addressed) and the plan digest covers
 *     the sealed steps, so identical inputs -> IDENTICAL plan digest
 *     (byte-compare pinned by deploy/test/plan.test.ts);
 *   - the request's component order is IRRELEVANT (the closure + order are
 *     derived); the plan carries the sorted component set.
 *
 * Tenant isolation (R12): the request's tenant must be within the target
 * environment's tenant scope, else the typed
 * `cross-tenant-plan-rejected` refusal.
 */
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  componentDependencyClosure,
  deploymentRevisionOf,
  environmentById,
  verifyTopologyDigest,
} from '../topology/topology';
import type { ComponentId, EnvironmentId, TenantId } from '../primitives';
import type { TopologyRevision } from '../topology/schema';
import type { DeployProvenance } from '../provenance';
import {
  digestOf,
  digestPrefix,
  fail,
  validationError,
  type DeployResult,
  type Revision,
} from '../primitives';
import type { Timestamp } from '@epoch/agent-protocol';
import type { DeployGatePolicy } from '../gates/gates';
import {
  DeployPlanContentSchema,
  DeployPlanSchema,
  PlanStepContentSchema,
  type DeployPlan,
  type PlanStep,
} from './schema';

/** Input of {@link planDeployment}. */
export interface PlanDeploymentInput {
  readonly topology: TopologyRevision;
  readonly environmentId: EnvironmentId;
  /** Requested components (order irrelevant; the closure is derived). */
  readonly componentIds: readonly ComponentId[];
  readonly tenantId: TenantId;
  readonly gatePolicy: DeployGatePolicy;
  readonly instants: { readonly plannedAt: Timestamp };
  readonly provenance: DeployProvenance;
}

/** Validate + seal one step content (deterministic digest). */
function sealStep(content: Omit<PlanStep, 'digest'>): DeployResult<PlanStep> {
  const parsed = PlanStepContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: validationError('plan step', parsed.error) };
  return { ok: true, value: { ...parsed.data, digest: digestOf(parsed.data as unknown as JsonValue) } };
}

/** The content half of a sealed plan. */
export function planContent(plan: DeployPlan): Omit<DeployPlan, 'digest' | 'planId'> {
  const { digest: _digest, planId: _planId, ...rest } = plan;
  void _digest;
  void _planId;
  return rest;
}

/** The content half of a sealed step. */
export function stepContent(step: PlanStep): Omit<PlanStep, 'digest'> {
  const { digest: _digest, ...rest } = step;
  void _digest;
  return rest;
}

/** Verify one sealed step's digest (typed `digest-mismatch`). */
export function verifyStepDigest(step: PlanStep): DeployResult<PlanStep> {
  const expected = digestOf(stepContent(step) as unknown as JsonValue);
  return expected === step.digest
    ? { ok: true, value: step }
    : { ok: false, error: fail('digest-mismatch', `step "${step.stepId}": digest does not match content (tampered step)`, ['digest']) };
}

/** Verify a sealed plan's digest AND derived planId (total). */
export function verifyPlanDigest(plan: DeployPlan): DeployResult<DeployPlan> {
  for (const step of plan.steps) {
    const verified = verifyStepDigest(step);
    if (!verified.ok) return verified;
  }
  const expected = digestOf(planContent(plan) as unknown as JsonValue);
  if (expected !== plan.digest) {
    return { ok: false, error: fail('digest-mismatch', `plan "${plan.planId}": digest does not match content (tampered plan)`, ['digest']) };
  }
  const derivedId = `plan:${digestPrefix(expected, 16)}`;
  if (derivedId !== plan.planId) {
    return { ok: false, error: fail('digest-mismatch', `plan id "${plan.planId}" does not match its content digest (expected "${derivedId}")`, ['planId']) };
  }
  return { ok: true, value: plan };
}

/** Parse + verify a foreign plan (total). */
export function admitDeployPlan(value: unknown): DeployResult<DeployPlan> {
  const parsed = DeployPlanSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: validationError('deploy plan', parsed.error) };
  return verifyPlanDigest(parsed.data);
}

/** Canonical JSON serialization (byte-stable). */
export function serializeDeployPlan(plan: DeployPlan): string {
  return canonicalJsonStringify(plan as unknown as JsonValue);
}

/** Parse + verify a serialized plan (total). */
export function deserializeDeployPlan(text: string): DeployResult<DeployPlan> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized plan is not valid JSON: ${(err as Error).message}`) };
  }
  return admitDeployPlan(parsed);
}

/**
 * The deterministic planner (the ONLY way a plan comes into existence).
 * Refusals (typed): unknown environment/component, cross-tenant request,
 * dependency cycle, gate-policy skew, malformed inputs.
 */
export function planDeployment(input: PlanDeploymentInput): DeployResult<DeployPlan> {
  // 0. The topology revision must verify (defense in depth).
  const verifiedTopology = verifyTopologyDigest(input.topology);
  if (!verifiedTopology.ok) return verifiedTopology;

  // 1. Environment + tenant scope.
  const environment = environmentById(input.topology, input.environmentId);
  if (environment === null) {
    return { ok: false, error: fail('unknown-environment', `unknown environment "${input.environmentId}"`) };
  }
  if (!environment.tenantIds.includes(input.tenantId)) {
    return {
      ok: false,
      error: fail(
        'cross-tenant-plan-rejected',
        `tenant "${input.tenantId}" is outside the tenant scope of environment "${input.environmentId}" [${environment.tenantIds.join(', ')}]`,
        ['tenantId'],
      ),
    };
  }

  // 2. Dependency closure in deterministic topological order.
  if (input.componentIds.length === 0) {
    return { ok: false, error: fail('validation', 'deploy request carries no components', ['componentIds']) };
  }
  const uniqueRequested = [...new Set(input.componentIds)];
  const closure = componentDependencyClosure(input.topology.components, uniqueRequested);
  if (!closure.ok) return closure;

  // 3. Deployability: every dependency must be deployable in this
  //    environment — present in the closure (deployed by this plan) or
  //    already placed in the environment (a prior revision serves it).
  const placed = new Set(
    input.topology.placements
      .filter((placement) => placement.environmentId === input.environmentId)
      .map((placement) => placement.componentId),
  );
  const placementRevisionBy = new Map(
    input.topology.placements
      .filter((placement) => placement.environmentId === input.environmentId)
      .map((placement) => [placement.componentId, placement.revision] as const),
  );
  for (const componentId of closure.value) {
    const component = input.topology.components.find((entry) => entry.componentId === componentId)!;
    for (const dependency of component.dependsOn) {
      if (!closure.value.includes(dependency) && !placed.has(dependency)) {
        return {
          ok: false,
          error: fail(
            'dependency-not-deployable',
            `component "${componentId}" depends on "${dependency}" which is neither in the deploy set nor placed in "${input.environmentId}"`,
            ['componentIds'],
          ),
        };
      }
    }
  }

  // 4. Step generation (fixed micro-sequence per component, in order).
  const deploymentRevision: Revision = deploymentRevisionOf(input.topology);
  const steps: PlanStep[] = [];
  let ordinal = 0;
  for (const componentId of closure.value) {
    const priorRevision = placementRevisionBy.get(componentId) ?? null;
    const stepSpecs: readonly { kind: PlanStep['kind']; gateDigest: string | null; prior: Revision | null }[] = [
      { kind: 'build', gateDigest: null, prior: null },
      { kind: 'verify', gateDigest: input.gatePolicy.digest, prior: null },
      { kind: 'rollback-point', gateDigest: null, prior: priorRevision },
      { kind: 'promote', gateDigest: null, prior: null },
      { kind: 'health-check', gateDigest: null, prior: null },
    ];
    for (const spec of stepSpecs) {
      ordinal += 1;
      const stepProvenance: DeployProvenance = {
        actor: input.provenance.actor,
        method: `plan-step:${spec.kind}`,
        instant: input.instants.plannedAt,
        derivedFrom:
          spec.kind === 'verify'
            ? [input.topology.digest, input.gatePolicy.digest]
            : [input.topology.digest],
      };
      const sealed = sealStep({
        recordVersion: 1,
        stepId: `${ordinal}:${spec.kind}:${componentId}`,
        ordinal,
        kind: spec.kind,
        componentId,
        environmentId: input.environmentId,
        gateDigest: spec.gateDigest,
        priorRevision: spec.prior,
        provenance: stepProvenance,
      });
      if (!sealed.ok) return sealed;
      steps.push(sealed.value);
    }
  }

  // 5. Seal the plan (planId + digest content-derived).
  const content = {
    recordVersion: 1,
    topology: {
      topologyId: input.topology.topologyId,
      sequence: input.topology.sequence,
      digest: input.topology.digest,
    },
    environmentId: input.environmentId,
    tenantId: input.tenantId,
    tier: environment.tier,
    deploymentRevision,
    componentSet: [...closure.value].sort(),
    gate: {
      gateId: input.gatePolicy.gateId,
      digest: input.gatePolicy.digest,
      commandCount: input.gatePolicy.battery.length,
    },
    steps,
    provenance: input.provenance,
  };
  const parsedContent = DeployPlanContentSchema.safeParse(content);
  if (!parsedContent.success) return { ok: false, error: validationError('deploy plan', parsedContent.error) };
  const digest = digestOf(parsedContent.data as unknown as JsonValue);
  const planId = `plan:${digestPrefix(digest, 16)}`;
  return { ok: true, value: { ...parsedContent.data, planId, digest } as DeployPlan };
}
