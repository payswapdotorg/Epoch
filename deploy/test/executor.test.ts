/**
 * W033 evidence — the REFERENCE EXECUTOR: typed outcomes + receipts,
 * health-check failure -> typed outcome + atomic rollback
 * (`rollback-restores-prior-revision`), replay determinism.
 */
import { describe, expect, it } from 'vitest';
import {
  admitDeployRun,
  deserializeDeployRun,
  environmentStateFromTopology,
  executeDeployPlan,
  planDeployment,
  renderDeployReceipt,
  serializeDeployReceipt,
  serializeDeployRun,
  verifyDeployRun,
  withoutPlacement,
  withPlacement,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import type { DeployPlan, DeployRun } from '@epoch/deploy-model';
import {
  DEPLOYER,
  EXECUTOR,
  REV_B,
  TENANT_LABS,
  T2,
  T5,
  deployToProd,
  greenBattery,
  healthyProbes,
  probesWithFailure,
  prodState,
  provenanceOf,
  referenceGatePolicy,
  referenceTopology,
} from './helpers';

const WEB_APP_SET = ['cmp:web-app'] as const;
const CLOSURE_SIZE = 6;

/** Re-execute a plan against a custom fixture state (skew tests). */
function rerun(plan: DeployPlan, fixtureState: ReturnType<typeof prodState>, healthProbes = healthyProbes(plan)) {
  const policy = referenceGatePolicy();
  return executeDeployPlan({
    plan,
    gatePolicy: policy,
    gateReports: greenBattery(policy),
    fixtureState,
    healthProbes,
    instants: { executedAt: T5 },
    provenance: provenanceOf(EXECUTOR, 'execute-deploy-plan', T5),
  });
}

describe('the happy path', () => {
  it('deploy-run-typed-receipts: an all-green run seals 30 outcomes and a verified receipt', () => {
    const { plan, run } = deployToProd({ componentIds: WEB_APP_SET });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const value: DeployRun = run.value;
    expect(value.status).toBe('deployed');
    expect(value.planStepCount).toBe(CLOSURE_SIZE * 5);
    expect(value.executedStepCount).toBe(CLOSURE_SIZE * 5);
    expect(value.outcomes.every((outcome) => outcome.status === 'succeeded')).toBe(true);
    expect(value.rollback).toBeNull();
    expect(value.finalStateDigest).not.toBe(value.initialStateDigest);
    const receipt = renderDeployReceipt(value);
    expect(receipt.status).toBe('deployed');
    expect(receipt.planDigest).toBe(plan.digest);
    expect(receipt.stepOutcomes).toHaveLength(CLOSURE_SIZE * 5);
    expect(unwrapOrThrow(verifyDeployRun(value)).runId).toBe(value.runId);
  });

  it('deploy-promotes-to-the-plan-revision: every closure placement lands on the deployment revision', () => {
    const { plan, run } = deployToProd({ componentIds: WEB_APP_SET });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(plan.deploymentRevision).toMatch(/^rev:[0-9a-f]{16}$/);
    const final = unwrapOrThrow(deserializeDeployRun(serializeDeployRun(run.value)));
    expect(final.deploymentRevision).toBe(plan.deploymentRevision);
  });

  it('degraded-probe-passes-with-note: a degraded observation is a passing (noted) health check', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const degraded = healthyProbes(plan).map((probe) =>
      probe.componentId === 'cmp:web-app' ? { ...probe, result: 'degraded' as const, detail: 'serving with elevated latency' } : probe,
    );
    const run = rerun(plan, prodState(), degraded);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.status).toBe('deployed');
    const webCheck = run.value.outcomes.find((outcome) => outcome.kind === 'health-check' && outcome.componentId === 'cmp:web-app');
    expect(webCheck).toBeDefined();
    expect(webCheck?.status).toBe('succeeded');
    if (webCheck?.kind === 'health-check') expect(webCheck.probeResult).toBe('degraded');
  });
});

describe('health-check failure -> typed outcome + rollback', () => {
  it('health-check-failure-typed-outcome: the failing step seals a failed outcome with the typed error payload', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    // Fail a MIDDLE component so later steps exist to be skipped.
    const probes = probesWithFailure(plan, 'cmp:tenancy', 'readiness probe timeout after 5000ms');
    const run = rerun(plan, prodState(), probes);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.status).toBe('rolled-back');
    const failure = run.value.outcomes.find((outcome) => outcome.status === 'failed');
    expect(failure).toBeDefined();
    expect(failure?.kind).toBe('health-check');
    expect(failure?.componentId).toBe('cmp:tenancy');
    if (failure?.kind === 'health-check') {
      expect(failure.error?.code).toBe('health-check-failed');
      expect(failure.probeResult).toBe('failed');
    }
    // Execution stopped at the failure: later steps never ran.
    const failingOrdinal = plan.steps.find(
      (step) => step.kind === 'health-check' && step.componentId === 'cmp:tenancy',
    )?.ordinal;
    expect(failingOrdinal).toBeDefined();
    expect(run.value.executedStepCount).toBe(failingOrdinal!);
    expect(run.value.planStepCount).toBe(CLOSURE_SIZE * 5);
    expect(run.value.executedStepCount).toBeLessThan(run.value.planStepCount);
  });

  it('rollback-restores-prior-revision: rollback reverts EVERY promote to its recorded prior revision (byte-exact state)', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const probes = probesWithFailure(plan, 'cmp:web-app', 'readiness probe timeout after 5000ms');
    const run = rerun(plan, prodState(), probes);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const value = run.value;
    // 1. A sealed rollback receipt exists, triggered by the failing component.
    expect(value.rollback).not.toBeNull();
    expect(value.rollback?.triggeredByComponentId).toBe('cmp:web-app');
    // 2. Every promoted component is restored in REVERSE promote order.
    const restored = value.rollback?.restoredPlacements ?? [];
    expect(restored).toHaveLength(CLOSURE_SIZE);
    const promoteOrder = value.outcomes
      .filter((outcome) => outcome.kind === 'promote')
      .map((outcome) => outcome.componentId);
    expect(restored.map((entry) => entry.componentId)).toEqual([...promoteOrder].reverse());
    // 3. Restored revisions are exactly the pre-deploy placements of the topology.
    const priorBy = new Map(
      referenceTopology()
        .placements.filter((placement) => placement.environmentId === 'env:prod' && placement.tenantId === TENANT_LABS)
        .map((placement) => [placement.componentId, placement.revision] as const),
    );
    for (const entry of restored) {
      expect(entry.toRevision).toBe(priorBy.get(entry.componentId));
      expect(entry.fromRevision).toBe(plan.deploymentRevision);
    }
    // 4. THE invariant: the post-rollback state digest EQUALS the pre-deploy state digest.
    expect(value.finalStateDigest).toBe(value.initialStateDigest);
    expect(value.rollback?.stateDigestAfter).toBe(value.rollback?.initialStateDigest);
  });

  it('rollback-fresh-deploy-un-places: a fresh (un-placed) deploy reverts by REMOVING the placement', () => {
    // Build the DEV fixture: nothing is placed there; plan the same component
    // set for env:dev (fresh deploy) and fail its health check.
    const topology = referenceTopology();
    const devPlan = unwrapOrThrow(
      planDeployment({
        topology,
        environmentId: 'env:dev',
        componentIds: [...WEB_APP_SET],
        tenantId: TENANT_LABS,
        gatePolicy: referenceGatePolicy(),
        instants: { plannedAt: T2 },
        provenance: provenanceOf(EXECUTOR, 'plan-deployment', T2),
      }),
    );
    const devState = unwrapOrThrow(environmentStateFromTopology(topology, 'env:dev', TENANT_LABS, { baselineAt: T2 }));
    expect(devState.placements).toHaveLength(0);
    const probes = probesWithFailure(devPlan, 'cmp:web-app', 'cold-start probe failure');
    const run = rerun(devPlan, devState, probes);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.status).toBe('rolled-back');
    expect(run.value.finalStateDigest).toBe(devState.digest);
    const restored = run.value.rollback?.restoredPlacements ?? [];
    expect(restored.every((entry) => entry.toRevision === null)).toBe(true);
  });
});

describe('replay determinism (rerun = identical receipts)', () => {
  it('run-replay-determinism-identical-receipts: two executions produce byte-identical runs + receipts', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const probes = probesWithFailure(plan, 'cmp:web-app', 'readiness probe timeout after 5000ms');
    const first = rerun(plan, prodState(), probes);
    const second = rerun(plan, prodState(), probes);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.digest).toBe(first.value.digest);
    expect(second.value.runId).toBe(first.value.runId);
    expect(serializeDeployRun(second.value)).toBe(serializeDeployRun(first.value));
    const receiptA = renderDeployReceipt(first.value);
    const receiptB = renderDeployReceipt(second.value);
    expect(receiptB.digest).toBe(receiptA.digest);
    expect(serializeDeployReceipt(receiptB)).toBe(serializeDeployReceipt(receiptA));
  });

  it('run-round-trip-digest-verified: serialize -> deserialize verifies the run, outcomes and rollback receipt', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const probes = probesWithFailure(plan, 'cmp:event-log', 'readiness probe timeout after 5000ms');
    const run = rerun(plan, prodState(), probes);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const text = serializeDeployRun(run.value);
    const restored = unwrapOrThrow(deserializeDeployRun(text));
    expect(restored.digest).toBe(run.value.digest);
    expect(serializeDeployRun(restored)).toBe(text);
    expect(unwrapOrThrow(verifyDeployRun(restored)).status).toBe('rolled-back');
  });

  it('tampered-run-digest-rejected: a mutated run fails admission', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const run = rerun(plan, prodState());
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const tampered = { ...run.value, status: 'rolled-back' as const };
    const result = admitDeployRun(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('fixture-state integrity (skew detection)', () => {
  it('fixture-state-skew-rejected: a state that disagrees with the plan rollback points refuses execution', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    // Drift one placement to a different revision than the topology declares.
    const drifted = unwrapOrThrow(withoutPlacement(prodState(), 'cmp:web-app'));
    const run = rerun(plan, drifted);
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.code).toBe('fixture-state-skew');
  });

  it('fixture-state-skew-rejected: an added placement the plan does not declare also refuses', () => {
    const { plan } = deployToProd({ componentIds: ['cmp:agent-protocol'] });
    const withExtra = unwrapOrThrow(
      withPlacement(prodState(), 'cmp:agent-protocol', REV_B, T5),
    );
    const run = rerun(plan, withExtra);
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.code).toBe('fixture-state-skew');
  });

  it('topology-skew-rejected: a state derived from another topology revision refuses execution', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const otherTopology = referenceTopology(2);
    const otherState = unwrapOrThrow(environmentStateFromTopology(otherTopology, 'env:prod', TENANT_LABS, { baselineAt: T2 }));
    const run = rerun(plan, otherState);
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.code).toBe('topology-skew');
  });

  it('missing-health-probe-rejected: a health-check step without its fixture probe refuses execution', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const probes = healthyProbes(plan).filter((probe) => probe.componentId !== 'cmp:web-app');
    const run = rerun(plan, prodState(), probes);
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error.code).toBe('validation');
      expect(run.error.message).toContain('cmp:web-app');
    }
  });

  it('foreign-health-probe-rejected: a probe for a component outside the plan refuses execution', () => {
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const probes = [
      ...healthyProbes(plan),
      {
        componentId: 'cmp:pack-construction',
        environmentId: 'env:prod',
        result: 'healthy' as const,
        observedAt: T5,
      },
    ];
    const run = rerun(plan, prodState(), probes);
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error.code).toBe('validation');
      expect(run.error.message).toContain('cmp:pack-construction');
    }
  });

  it('state-transitions-are-sealed: withPlacement/withoutPlacement produce digest-verified states', () => {
    const state = prodState();
    const next = unwrapOrThrow(withPlacement(state, 'cmp:adapter-github', 'rev:0000000000000abc', T5));
    expect(next.digest).not.toBe(state.digest);
    expect(next.placements.map((placement) => placement.componentId)).toContain('cmp:adapter-github');
    const removed = unwrapOrThrow(withoutPlacement(next, 'cmp:adapter-github'));
    expect(removed.digest).toBe(state.digest);
    void DEPLOYER;
  });
});
