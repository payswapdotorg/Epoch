/**
 * W033 evidence — DEPLOY PLANS: determinism (byte-compare), dependency
 * ordering, topology-as-data, tenant isolation, tamper detection.
 */
import { describe, expect, it } from 'vitest';
import {
  admitDeployPlan,
  deserializeDeployPlan,
  planDeployment,
  serializeDeployPlan,
  verifyPlanDigest,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import {
  PLANNER,
  REFERENCE_COMPONENTS,
  RELEASE_MANAGER,
  TENANT_FOREIGN,
  T3,
  provenanceOf,
  referenceGatePolicy,
  referenceTopology,
} from './helpers';

const WEB_APP_SET = ['cmp:web-app'] as const;

const planFor = (
  componentIds: readonly string[],
  environmentId = 'env:prod',
  tenantId = 'tenant:epoch-labs',
  order: 'forward' | 'reverse' = 'forward',
) =>
  planDeployment({
    topology: referenceTopology(),
    environmentId,
    componentIds: order === 'forward' ? [...componentIds] : [...componentIds].reverse(),
    tenantId,
    gatePolicy: referenceGatePolicy(),
    instants: { plannedAt: T3 },
    provenance: provenanceOf(PLANNER, 'plan-deployment', T3),
  });

describe('plan determinism', () => {
  it('plan-digest-deterministic: identical topology+components+environment -> identical plan digest (byte-compare)', () => {
    const a = unwrapOrThrow(planFor(WEB_APP_SET));
    const b = unwrapOrThrow(planFor(WEB_APP_SET));
    expect(b.digest).toBe(a.digest);
    expect(b.planId).toBe(a.planId);
    expect(serializeDeployPlan(b)).toBe(serializeDeployPlan(a));
  });

  it('plan-request-order-irrelevant: the request component ORDER never reaches the digest', () => {
    const set = ['cmp:web-app', 'cmp:adapter-github'];
    const forward = unwrapOrThrow(planFor(set));
    const reverse = unwrapOrThrow(planFor(set, 'env:prod', 'tenant:epoch-labs', 'reverse'));
    expect(reverse.digest).toBe(forward.digest);
  });

  it('plan-dependency-sorted: steps run dependencies-first with contiguous ordinals and the fixed micro-sequence', () => {
    const plan = unwrapOrThrow(planFor(WEB_APP_SET));
    // closure: agent-protocol, tenancy, action-protocol, event-log, action-gateway, web-app
    expect(plan.componentSet).toEqual([
      'cmp:action-gateway',
      'cmp:action-protocol',
      'cmp:agent-protocol',
      'cmp:event-log',
      'cmp:tenancy',
      'cmp:web-app',
    ]);
    expect(plan.steps).toHaveLength(6 * 5);
    expect(plan.steps.map((step) => step.ordinal)).toEqual(plan.steps.map((_, index) => index + 1));
    // Every component contributes build -> verify -> rollback-point -> promote -> health-check.
    for (const componentId of plan.componentSet) {
      const kinds = plan.steps
        .filter((step) => step.componentId === componentId)
        .map((step) => step.kind);
      expect(kinds).toEqual(['build', 'verify', 'rollback-point', 'promote', 'health-check']);
    }
    // Dependencies are placed before dependents by promote order.
    const promoteOrder = plan.steps
      .filter((step) => step.kind === 'promote')
      .map((step) => step.componentId);
    expect(promoteOrder.indexOf('cmp:agent-protocol')).toBeLessThan(promoteOrder.indexOf('cmp:tenancy'));
    expect(promoteOrder.indexOf('cmp:action-protocol')).toBeLessThan(promoteOrder.indexOf('cmp:action-gateway'));
    expect(promoteOrder.indexOf('cmp:action-gateway')).toBeLessThan(promoteOrder.indexOf('cmp:web-app'));
    // Verify steps gate on the reference policy; rollback points carry the placed priors.
    const policy = referenceGatePolicy();
    for (const step of plan.steps) {
      if (step.kind === 'verify') expect(step.gateDigest).toBe(policy.digest);
      if (step.kind === 'rollback-point') expect(step.priorRevision).toMatch(/^rev:[0-9a-f]{16}$/);
    }
  });

  it('plan-topology-is-data: swapping environments changes the PLAN, never the code path', () => {
    const prod = unwrapOrThrow(planFor(WEB_APP_SET, 'env:prod'));
    const staging = unwrapOrThrow(planFor(['cmp:agent-protocol'], 'env:staging'));
    const dev = unwrapOrThrow(planFor(['cmp:agent-protocol'], 'env:dev'));
    expect(prod.environmentId).toBe('env:prod');
    expect(staging.tier).toBe('staging');
    expect(dev.tier).toBe('dev');
    // dev carries no placements: its rollback points are null (fresh deploys).
    expect(dev.steps.every((step) => step.kind !== 'rollback-point' || step.priorRevision === null)).toBe(true);
    // staging carries agent-protocol at a placed revision: non-null prior.
    const stagingRollback = staging.steps.find((step) => step.kind === 'rollback-point');
    expect(stagingRollback?.priorRevision).toMatch(/^rev:[0-9a-f]{16}$/);
  });

  it('plan-round-trip-digest-verified: serialize -> deserialize verifies the plan and every step digest', () => {
    const plan = unwrapOrThrow(planFor(WEB_APP_SET));
    const text = serializeDeployPlan(plan);
    const restored = unwrapOrThrow(deserializeDeployPlan(text));
    expect(restored.digest).toBe(plan.digest);
    expect(serializeDeployPlan(restored)).toBe(text);
    expect(unwrapOrThrow(verifyPlanDigest(restored)).planId).toBe(plan.planId);
  });
});

describe('plan admission refusals (typed)', () => {
  it('plan-cross-tenant-rejected: a tenant outside the environment scope may not plan', () => {
    const result = planFor(WEB_APP_SET, 'env:prod', TENANT_FOREIGN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-plan-rejected');
      expect(result.error.message).toContain(TENANT_FOREIGN);
    }
  });

  it('plan-unknown-component-rejected', () => {
    const result = planFor(['cmp:nonexistent']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-component');
  });

  it('plan-unknown-environment-rejected', () => {
    const result = planFor(WEB_APP_SET, 'env:nonexistent');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-environment');
  });

  it('plan-empty-component-set-rejected', () => {
    const result = planFor([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('tampered-plan-digest-rejected: a mutated plan fails admission', () => {
    const plan = unwrapOrThrow(planFor(WEB_APP_SET));
    const tampered = { ...plan, deploymentRevision: 'rev:ffffffffffffffff' };
    const result = admitDeployPlan(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });

  it('tampered-step-digest-rejected: a mutated step fails the plan digest chain', () => {
    const plan = unwrapOrThrow(planFor(WEB_APP_SET));
    const tampered = {
      ...plan,
      steps: plan.steps.map((step, index) => (index === 0 ? { ...step, kind: 'promote' as const } : step)),
    };
    const result = admitDeployPlan(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('plan provenance', () => {
  it('plan-provenance-on-every-step: the plan + every step carry sealed provenance', () => {
    const plan = unwrapOrThrow(planFor(WEB_APP_SET));
    expect(plan.provenance.method).toBe('plan-deployment');
    expect(plan.provenance.actor.actorId).toBe(PLANNER.actorId);
    for (const step of plan.steps) {
      expect(step.provenance.method).toMatch(/^plan-step:/);
      expect(step.provenance.derivedFrom).toContain(plan.topology.digest);
    }
    const verifySteps = plan.steps.filter((step) => step.kind === 'verify');
    for (const step of verifySteps) {
      expect(step.provenance.derivedFrom).toContain(referenceGatePolicy().digest);
    }
    void RELEASE_MANAGER;
    void REFERENCE_COMPONENTS;
  });
});
