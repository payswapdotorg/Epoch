/**
 * W033 evidence — DEPLOY GATES: the verification battery as data and the
 * refusal points (`gate-skip-rejected`, `gate-failed-rejected`).
 */
import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BATTERY_COMMANDS,
  deserializeGatePolicy,
  evaluateGateReports,
  executeDeployPlan,
  greenGateReports,
  referenceVerificationGatePolicy,
  sealGatePolicy,
  serializeGatePolicy,
  verifyGatePolicyDigest,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import {
  EXECUTOR,
  RELEASE_MANAGER,
  T2,
  T3,
  T5,
  deployToProd,
  failingBattery,
  greenBattery,
  healthyProbes,
  prodState,
  provenanceOf,
  referenceGatePolicy,
  skippedBattery,
} from './helpers';

const WEB_APP_SET = ['cmp:web-app'] as const;

describe('the battery is data', () => {
  it('gate-battery-is-data: the reference policy carries the Work Order battery VERBATIM', () => {
    expect(REFERENCE_BATTERY_COMMANDS.map((entry) => entry.command)).toEqual([
      'pnpm install',
      'pnpm check',
      'pnpm exec turbo run typecheck lint test build --concurrency=1 --force',
    ]);
    expect(REFERENCE_BATTERY_COMMANDS.every((entry) => entry.expectExitCode === 0)).toBe(true);
    const policy = referenceGatePolicy();
    expect(policy.gateId).toBe('gate:verification-battery');
    expect(policy.required).toBe(true);
    expect(policy.battery).toHaveLength(3);
  });

  it('gate-policy-deterministic: the same provenance seals the same policy digest (twice)', () => {
    const a = referenceGatePolicy();
    const b = unwrapOrThrow(referenceVerificationGatePolicy(provenanceOf(RELEASE_MANAGER, 'catalog-gate', T2)));
    expect(b.digest).toBe(a.digest);
    expect(serializeGatePolicy(b)).toBe(serializeGatePolicy(a));
  });

  it('gate-policy-round-trip-digest-verified', () => {
    const policy = referenceGatePolicy();
    const restored = unwrapOrThrow(deserializeGatePolicy(serializeGatePolicy(policy)));
    expect(restored.digest).toBe(policy.digest);
    expect(unwrapOrThrow(verifyGatePolicyDigest(restored)).gateId).toBe(policy.gateId);
  });

  it('tampered-gate-policy-rejected: a mutated policy fails its digest', () => {
    const policy = referenceGatePolicy();
    const tampered = { ...policy, description: 'mutated after sealing' };
    const result = verifyGatePolicyDigest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('gate evaluation (refusal points)', () => {
  it('gate-green-admits: every command with its expected exit code is green', () => {
    const policy = referenceGatePolicy();
    const result = evaluateGateReports(policy, greenBattery(policy));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.commandCount).toBe(3);
  });

  it('gate-skip-rejected: a battery command without a report refuses execution', () => {
    const policy = referenceGatePolicy();
    const result = evaluateGateReports(policy, skippedBattery(policy));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('gate-skip-rejected');
      expect(result.error.message).toContain('pnpm exec turbo run typecheck lint test build');
    }
  });

  it('gate-failed-rejected: a report with the wrong exit code refuses execution', () => {
    const policy = referenceGatePolicy();
    const result = evaluateGateReports(policy, failingBattery(policy));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('gate-failed-rejected');
      expect(result.error.message).toContain('exited 1');
    }
  });

  it('gate-unknown-command-rejected: a report for a foreign command refuses execution', () => {
    const policy = referenceGatePolicy();
    const foreign = [
      ...greenBattery(policy).slice(0, -1),
      {
        gateId: policy.gateId,
        command: 'pnpm deploy --force',
        exitCode: 0,
        completedAt: T3,
        provenance: provenanceOf(EXECUTOR, 'battery:foreign', T3),
      },
    ];
    const result = evaluateGateReports(policy, foreign);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-gate');
  });

  it('gate-foreign-gate-rejected: a report from another gate id is refused', () => {
    const policy = referenceGatePolicy();
    const reports = greenGateReports(policy, T3, (command) =>
      provenanceOf(EXECUTOR, `battery:${command}`, T3),
    ).map((report) => ({ ...report, gateId: 'gate:other-gate' }));
    const result = evaluateGateReports(policy, reports);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-gate');
  });

  it('gate-seal-refuses-optional-gates: required must be literal true', () => {
    const result = sealGatePolicy({
      recordVersion: 1,
      gateId: 'gate:optional-battery',
      description: 'An optional gate is not a refusal point and is rejected by the model.',
      required: false as unknown as true,
      battery: REFERENCE_BATTERY_COMMANDS,
      provenance: provenanceOf(RELEASE_MANAGER, 'tamper', T2),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });
});

describe('gate enforcement at the executor (no step runs without green gates)', () => {
  it('gate-skip-rejected-at-executor: the executor refuses a plan BEFORE any step runs', () => {
    const { plan, run } = deployToProd({ componentIds: WEB_APP_SET, gateReports: skippedBattery(referenceGatePolicy()) });
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error.code).toBe('gate-skip-rejected');
    }
    void plan;
  });

  it('gate-failed-rejected-at-executor: a red battery report refuses execution', () => {
    const { run } = deployToProd({ componentIds: WEB_APP_SET, gateReports: failingBattery(referenceGatePolicy()) });
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.code).toBe('gate-failed-rejected');
  });

  it('gate-green-executes: with green reports the same plan runs to deployed', () => {
    const { run } = deployToProd({ componentIds: WEB_APP_SET });
    expect(run.ok).toBe(true);
    if (run.ok) expect(run.value.status).toBe('deployed');
  });

  it('gate-plan-gate-skew-rejected: a policy different from the plan gate refuses execution', () => {
    const policy = referenceGatePolicy();
    const { plan } = deployToProd({ componentIds: WEB_APP_SET });
    const other = unwrapOrThrow(
      sealGatePolicy({
        recordVersion: 1,
        gateId: 'gate:verification-battery-v2',
        description: 'A different battery the plan was not planned against.',
        required: true,
        battery: REFERENCE_BATTERY_COMMANDS,
        provenance: provenanceOf(RELEASE_MANAGER, 'tamper', T2),
      }),
    );
    const result = executeDeployPlan({
      plan,
      gatePolicy: other,
      gateReports: greenBattery(policy),
      fixtureState: prodState(),
      healthProbes: healthyProbes(plan),
      instants: { executedAt: T5 },
      provenance: provenanceOf(EXECUTOR, 'execute-deploy-plan', T5),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('plan-gate-skew');
  });
});
