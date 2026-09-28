/**
 * @epoch/deploy-model — the REFERENCE EXECUTOR (in-memory, deterministic).
 *
 * Executes a sealed plan against a FIXTURE environment model, emitting
 * typed STEP OUTCOMES and a sealed RECEIPT. No real infrastructure is ever
 * touched: builds produce content-addressed artifact digests, verifies
 * consume the gate reports the caller supplies as fixture data, promotes
 * transition the in-memory tenant-scoped state, and health-checks consume
 * fixture probe observations.
 *
 * Refusal semantics (admission, before ANY step runs):
 *   - tampered plan/policy/state -> `digest-mismatch`;
 *   - state derived from a different topology -> `topology-skew`;
 *   - policy/gate mismatch with the plan -> `plan-gate-skew`;
 *   - a required battery command without a green report -> `gate-skip-rejected`;
 *   - a report with the wrong exit code -> `gate-failed-rejected`;
 *   - state not matching the plan's declared rollback points -> `fixture-state-skew`;
 *   - missing/foreign health probes -> `validation`.
 *
 * Execution semantics:
 *   - steps run in ordinal order; every outcome is sealed (content-addressed)
 *     and carries provenance;
 *   - a `health-check` step observing `failed` emits the TYPED
 *     `health-check-failed` outcome and triggers ATOMIC ROLLBACK: every
 *     promote of the run is reverted in reverse order to its recorded
 *     rollback point (a null prior revision = un-place), and the run ends
 *     `rolled-back` with a sealed rollback receipt (`rollback-restores-
 *     prior-revision` is pinned byte-exactly by deploy/test/executor.test.ts:
 *     the final state digest equals the initial state digest);
 *   - zero wall-clock (the single `executedAt` instant is caller-supplied),
 *     zero randomness, zero network: two runs over identical inputs
 *     produce byte-identical run digests + receipts.
 */
import { z } from 'zod';
import { canonicalJsonStringify, type JsonValue, type Timestamp } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ComponentIdSchema,
  DeployRecordVersionSchema,
  EnvironmentIdSchema,
  RevisionSchema,
  RunIdSchema,
  Sha256DigestSchema,
  digestOf,
  digestPrefix,
  fail,
  validationError,
  type DeployResult,
  type Revision,
  type Sha256Digest,
} from '../primitives';
import type { DeployProvenance } from '../provenance';
import { DeployProvenanceSchema } from '../provenance';
import { evaluateGateReports, verifyGatePolicyDigest } from '../gates/gates';
import type { DeployGatePolicy, GateReport } from '../gates/gates';
import { verifyPlanDigest } from '../plan/planner';
import type { DeployPlan, PlanStep } from '../plan/schema';
import {
  verifyEnvironmentStateDigest,
  withPlacement,
  withoutPlacement,
  type EnvironmentState,
  type HealthProbeObservation,
  type PlacementState,
} from './fixtures';
import { OUTCOME_STATUSES, RUN_STATUSES } from '../version';

// --------------------------------------------------------------------------------
// Step outcomes (sealed, typed per kind).
// --------------------------------------------------------------------------------

const outcomeCommon = {
  recordVersion: DeployRecordVersionSchema,
  stepId: z.string().min(1).max(128),
  ordinal: z.number().int().min(1),
  kind: z.enum(['build', 'verify', 'rollback-point', 'promote', 'health-check']),
  componentId: ComponentIdSchema,
  environmentId: EnvironmentIdSchema,
  status: z.enum(OUTCOME_STATUSES),
  provenance: DeployProvenanceSchema,
};

const buildOutcomeShape = z.strictObject({
  ...outcomeCommon,
  kind: z.literal('build'),
  artifactDigest: Sha256DigestSchema,
});

const verifyOutcomeShape = z.strictObject({
  ...outcomeCommon,
  kind: z.literal('verify'),
  gateId: z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/),
  commandCount: z.number().int().min(1),
});

const rollbackPointOutcomeShape = z.strictObject({
  ...outcomeCommon,
  kind: z.literal('rollback-point'),
  priorRevision: RevisionSchema.nullable(),
  priorStateDigest: Sha256DigestSchema,
});

const promoteOutcomeShape = z.strictObject({
  ...outcomeCommon,
  kind: z.literal('promote'),
  fromRevision: RevisionSchema.nullable(),
  toRevision: RevisionSchema,
  stateDigestAfter: Sha256DigestSchema,
});

const healthCheckOutcomeShape = z.strictObject({
  ...outcomeCommon,
  kind: z.literal('health-check'),
  probeResult: z.enum(['healthy', 'degraded', 'failed']),
  probeDetail: z.string().max(512).optional(),
  /** Present exactly when status is `failed` (the typed failure payload). */
  error: z
    .strictObject({
      code: z.literal('health-check-failed'),
      message: z.string().min(1).max(512),
    })
    .readonly()
    .nullable(),
});

export const StepOutcomeSchema = z
  .discriminatedUnion('kind', [
    buildOutcomeShape.readonly(),
    verifyOutcomeShape.readonly(),
    rollbackPointOutcomeShape.readonly(),
    promoteOutcomeShape.readonly(),
    healthCheckOutcomeShape.readonly(),
  ])
  .and(z.strictObject({ digest: Sha256DigestSchema }).readonly());
export type StepOutcome = z.infer<typeof StepOutcomeSchema>;
export type StepOutcomeContent = Omit<StepOutcome, 'digest'>;

/** The content half of a sealed outcome. */
export function stepOutcomeContent(outcome: StepOutcome): Omit<StepOutcome, 'digest'> {
  const { digest: _digest, ...rest } = outcome;
  void _digest;
  return rest as Omit<StepOutcome, 'digest'>;
}

/** Verify one sealed outcome's digest (typed `digest-mismatch`). */
export function verifyStepOutcomeDigest(outcome: StepOutcome): DeployResult<StepOutcome> {
  const expected = digestOf(stepOutcomeContent(outcome) as unknown as JsonValue);
  return expected === outcome.digest
    ? { ok: true, value: outcome }
    : { ok: false, error: fail('digest-mismatch', `outcome of step "${outcome.stepId}": digest does not match content (tampered outcome)`, ['digest']) };
}

// --------------------------------------------------------------------------------
// Rollback receipt (sealed).
// --------------------------------------------------------------------------------

const restoredPlacementShape = z.strictObject({
  componentId: ComponentIdSchema,
  /** The revision the run promoted to (being reverted). */
  fromRevision: RevisionSchema,
  /** The restored prior revision (null = the placement was removed). */
  toRevision: RevisionSchema.nullable(),
});

const rollbackReceiptShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  planId: z.string().regex(/^plan:[0-9a-f]{16}$/),
  environmentId: EnvironmentIdSchema,
  triggeredByStepId: z.string().min(1).max(128),
  triggeredByComponentId: ComponentIdSchema,
  /** Reverse promote order (LIFO). */
  restoredPlacements: z.array(restoredPlacementShape).readonly(),
  initialStateDigest: Sha256DigestSchema,
  stateDigestAfter: Sha256DigestSchema,
  provenance: DeployProvenanceSchema,
});

export const RollbackReceiptContentSchema = rollbackReceiptShape.readonly();
export type RollbackReceiptContent = z.infer<typeof RollbackReceiptContentSchema>;

export const RollbackReceiptSchema = rollbackReceiptShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type RollbackReceipt = z.infer<typeof RollbackReceiptSchema>;

export function rollbackReceiptContent(receipt: RollbackReceipt): Omit<RollbackReceipt, 'digest'> {
  const { digest: _digest, ...rest } = receipt;
  void _digest;
  return rest;
}

export function verifyRollbackReceiptDigest(receipt: RollbackReceipt): DeployResult<RollbackReceipt> {
  const expected = digestOf(rollbackReceiptContent(receipt) as unknown as JsonValue);
  return expected === receipt.digest
    ? { ok: true, value: receipt }
    : { ok: false, error: fail('digest-mismatch', 'rollback receipt digest does not match content (tampered receipt)', ['digest']) };
}

// --------------------------------------------------------------------------------
// The deploy run + receipt (sealed; ids content-derived).
// --------------------------------------------------------------------------------

const deployRunShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  planId: z.string().regex(/^plan:[0-9a-f]{16}$/),
  planDigest: Sha256DigestSchema,
  gateId: z.string().regex(/^gate:[a-z0-9][a-z0-9-]{0,62}$/),
  environmentId: EnvironmentIdSchema,
  tenantId: TenantIdSchema,
  deploymentRevision: RevisionSchema,
  status: z.enum(RUN_STATUSES),
  planStepCount: z.number().int().min(1),
  executedStepCount: z.number().int().min(1),
  outcomes: z.array(StepOutcomeSchema).readonly(),
  rollback: RollbackReceiptSchema.nullable(),
  initialStateDigest: Sha256DigestSchema,
  finalStateDigest: Sha256DigestSchema,
  provenance: DeployProvenanceSchema,
});

export const DeployRunContentSchema = deployRunShape.readonly();
export type DeployRunContent = z.infer<typeof DeployRunContentSchema>;

export const DeployRunSchema = deployRunShape
  .extend({
    runId: RunIdSchema,
    digest: Sha256DigestSchema,
  })
  .readonly();
export type DeployRun = z.infer<typeof DeployRunSchema>;

/** The content half of a sealed run. */
export function deployRunContent(run: DeployRun): Omit<DeployRun, 'digest' | 'runId'> {
  const { digest: _digest, runId: _runId, ...rest } = run;
  void _digest;
  void _runId;
  return rest;
}

/** Verify a sealed run: every outcome digest, the rollback receipt digest,
 *  the run digest and the derived run id (total). */
export function verifyDeployRun(run: DeployRun): DeployResult<DeployRun> {
  for (const outcome of run.outcomes) {
    const verified = verifyStepOutcomeDigest(outcome);
    if (!verified.ok) return verified;
  }
  if (run.rollback !== null) {
    const verified = verifyRollbackReceiptDigest(run.rollback);
    if (!verified.ok) return verified;
  }
  const expected = digestOf(deployRunContent(run) as unknown as JsonValue);
  if (expected !== run.digest) {
    return { ok: false, error: fail('digest-mismatch', `run "${run.runId}": digest does not match content (tampered run)`, ['digest']) };
  }
  if (`run:${digestPrefix(expected, 16)}` !== run.runId) {
    return { ok: false, error: fail('digest-mismatch', `run id "${run.runId}" does not match its content digest`, ['runId']) };
  }
  return { ok: true, value: run };
}

/** Parse + verify a foreign run (total). */
export function admitDeployRun(value: unknown): DeployResult<DeployRun> {
  const parsed = DeployRunSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: validationError('deploy run', parsed.error) };
  return verifyDeployRun(parsed.data);
}

// --------------------------------------------------------------------------------
// The compact receipt (operator-facing projection of a run).
// --------------------------------------------------------------------------------

const receiptEntryShape = z.strictObject({
  stepId: z.string().min(1).max(128),
  kind: z.string().min(1).max(32),
  componentId: ComponentIdSchema,
  status: z.enum(OUTCOME_STATUSES),
  outcomeDigest: Sha256DigestSchema,
});

const deployReceiptShape = z.strictObject({
  recordVersion: DeployRecordVersionSchema,
  runId: RunIdSchema,
  planId: z.string().regex(/^plan:[0-9a-f]{16}$/),
  planDigest: Sha256DigestSchema,
  environmentId: EnvironmentIdSchema,
  tenantId: TenantIdSchema,
  deploymentRevision: RevisionSchema,
  status: z.enum(RUN_STATUSES),
  stepOutcomes: z.array(receiptEntryShape).readonly(),
  rollbackDigest: Sha256DigestSchema.nullable(),
  initialStateDigest: Sha256DigestSchema,
  finalStateDigest: Sha256DigestSchema,
  provenance: DeployProvenanceSchema,
});

export const DeployReceiptContentSchema = deployReceiptShape.readonly();
export type DeployReceiptContent = z.infer<typeof DeployReceiptContentSchema>;
export const DeployReceiptSchema = deployReceiptShape
  .extend({ digest: Sha256DigestSchema })
  .readonly();
export type DeployReceipt = z.infer<typeof DeployReceiptSchema>;

/** Project a run into its compact sealed receipt. */
export function renderDeployReceipt(run: DeployRun): DeployReceipt {
  const content: DeployReceiptContent = {
    recordVersion: 1,
    runId: run.runId,
    planId: run.planId,
    planDigest: run.planDigest,
    environmentId: run.environmentId,
    tenantId: run.tenantId,
    deploymentRevision: run.deploymentRevision,
    status: run.status,
    stepOutcomes: run.outcomes.map((outcome) => ({
      stepId: outcome.stepId,
      kind: outcome.kind,
      componentId: outcome.componentId,
      status: outcome.status,
      outcomeDigest: outcome.digest,
    })),
    rollbackDigest: run.rollback === null ? null : run.rollback.digest,
    initialStateDigest: run.initialStateDigest,
    finalStateDigest: run.finalStateDigest,
    provenance: run.provenance,
  };
  return { ...content, digest: digestOf(content as unknown as JsonValue) };
}

/** Verify a sealed receipt's digest (typed `digest-mismatch`). */
export function verifyDeployReceiptDigest(receipt: DeployReceipt): DeployResult<DeployReceipt> {
  const { digest: _digest, ...content } = receipt;
  void _digest;
  const expected = digestOf(content as unknown as JsonValue);
  return expected === receipt.digest
    ? { ok: true, value: receipt }
    : { ok: false, error: fail('digest-mismatch', `receipt of run "${receipt.runId}": digest does not match content (tampered receipt)`, ['digest']) };
}

// --------------------------------------------------------------------------------
// Serialization.
// --------------------------------------------------------------------------------

export function serializeDeployRun(run: DeployRun): string {
  return canonicalJsonStringify(run as unknown as JsonValue);
}

export function deserializeDeployRun(text: string): DeployResult<DeployRun> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized run is not valid JSON: ${(err as Error).message}`) };
  }
  return admitDeployRun(parsed);
}

export function serializeDeployReceipt(receipt: DeployReceipt): string {
  return canonicalJsonStringify(receipt as unknown as JsonValue);
}

export function deserializeDeployReceipt(text: string): DeployResult<DeployReceipt> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: fail('validation', `serialized receipt is not valid JSON: ${(err as Error).message}`) };
  }
  const typed = DeployReceiptSchema.safeParse(parsed);
  if (!typed.success) return { ok: false, error: validationError('deploy receipt', typed.error) };
  return verifyDeployReceiptDigest(typed.data);
}

// --------------------------------------------------------------------------------
// The executor.
// --------------------------------------------------------------------------------

/** Input of {@link executeDeployPlan}. */
export interface ExecuteDeployPlanInput {
  readonly plan: DeployPlan;
  readonly gatePolicy: DeployGatePolicy;
  readonly gateReports: readonly GateReport[];
  readonly fixtureState: EnvironmentState;
  readonly healthProbes: readonly HealthProbeObservation[];
  readonly instants: { readonly executedAt: Timestamp };
  readonly provenance: DeployProvenance;
}

/** Execute a plan against the fixture model (total, deterministic). */
export function executeDeployPlan(input: ExecuteDeployPlanInput): DeployResult<DeployRun> {
  // ---- Admission (before ANY step runs) -------------------------------------
  const plan = verifyPlanDigest(input.plan);
  if (!plan.ok) return plan;
  const policy = verifyGatePolicyDigest(input.gatePolicy);
  if (!policy.ok) return policy;
  const state = verifyEnvironmentStateDigest(input.fixtureState);
  if (!state.ok) return state;

  if (input.fixtureState.environmentId !== input.plan.environmentId) {
    return {
      ok: false,
      error: fail('validation', `fixture state is for environment "${input.fixtureState.environmentId}" but the plan targets "${input.plan.environmentId}"`, ['fixtureState']),
    };
  }
  if (input.fixtureState.tenantId !== input.plan.tenantId) {
    return {
      ok: false,
      error: fail('cross-tenant-plan-rejected', `fixture state is scoped to tenant "${input.fixtureState.tenantId}" but the plan is owned by tenant "${input.plan.tenantId}"`, ['fixtureState']),
    };
  }
  if (input.fixtureState.derivedFromTopologyDigest !== input.plan.topology.digest) {
    return {
      ok: false,
      error: fail('topology-skew', `fixture state derives from topology digest ${input.fixtureState.derivedFromTopologyDigest} but the plan was planned against ${input.plan.topology.digest}`, ['fixtureState']),
    };
  }
  if (input.gatePolicy.gateId !== input.plan.gate.gateId || input.gatePolicy.digest !== input.plan.gate.digest) {
    return {
      ok: false,
      error: fail('plan-gate-skew', `gate policy "${input.gatePolicy.gateId}" (${input.gatePolicy.digest}) does not match the plan's gate "${input.plan.gate.gateId}" (${input.plan.gate.digest})`, ['gatePolicy']),
    };
  }
  const gates = evaluateGateReports(input.gatePolicy, input.gateReports);
  if (!gates.ok) return gates;

  // Fixture-state skew: every rollback point must match the fixture state.
  const placementBy = new Map(
    input.fixtureState.placements.map((placement) => [placement.componentId, placement] as const),
  );
  for (const step of input.plan.steps) {
    if (step.kind !== 'rollback-point') continue;
    const actual = placementBy.get(step.componentId);
    const actualRevision = actual === undefined ? null : actual.revision;
    if (actualRevision !== step.priorRevision) {
      return {
        ok: false,
        error: fail(
          'fixture-state-skew',
          `rollback point of "${step.componentId}" declares prior revision ${step.priorRevision ?? 'null'} but the fixture state holds ${actualRevision ?? 'null'}`,
          ['fixtureState'],
        ),
      };
    }
  }

  // Health probe fixtures: every health-check step needs exactly its probe.
  const probeBy = new Map(
    input.healthProbes
      .filter((probe) => probe.environmentId === input.plan.environmentId)
      .map((probe) => [probe.componentId, probe] as const),
  );
  for (const probe of input.healthProbes) {
    if (!input.plan.componentSet.includes(probe.componentId)) {
      return {
        ok: false,
        error: fail('validation', `health probe fixture for "${probe.componentId}" references a component outside the plan's set`, ['healthProbes']),
      };
    }
  }
  for (const step of input.plan.steps) {
    if (step.kind !== 'health-check') continue;
    if (!probeBy.has(step.componentId)) {
      return {
        ok: false,
        error: fail('validation', `missing health probe fixture for "${step.componentId}" (health-check step "${step.stepId}")`, ['healthProbes']),
      };
    }
  }

  // ---- Execution ------------------------------------------------------------
  const initialPlacements = new Map(placementBy);
  let currentState = input.fixtureState;
  const outcomes: StepOutcome[] = [];
  const promoted: {
    readonly step: PlanStep;
    readonly fromRevision: Revision | null;
    readonly priorPlacement: PlacementState | null;
  }[] = [];
  let failure: { stepId: string; componentId: string; detail: string } | null = null;

  const outcomeProvenance = (method: string): DeployProvenance => ({
    actor: input.provenance.actor,
    method,
    instant: input.instants.executedAt,
    derivedFrom: [input.plan.digest],
  });

  // Deterministic seal of one outcome: the digest covers the exact content
  // (structural validation happens on every parse/admit path).
  const sealOutcome = (content: Record<string, unknown>): StepOutcome =>
    ({ ...content, digest: digestOf(content as unknown as JsonValue) }) as unknown as StepOutcome;

  for (const step of input.plan.steps) {
    if (failure !== null) break;
    const common = {
      recordVersion: 1 as const,
      stepId: step.stepId,
      ordinal: step.ordinal,
      componentId: step.componentId,
      environmentId: step.environmentId,
      status: 'succeeded' as const,
      provenance: outcomeProvenance(`execute:${step.kind}`),
    };
    if (step.kind === 'build') {
      const artifactDigest = digestOf({
        componentId: step.componentId,
        deploymentRevision: input.plan.deploymentRevision,
        planDigest: input.plan.digest,
      } as unknown as JsonValue);
      outcomes.push(sealOutcome({ ...common, kind: 'build', artifactDigest }));
      continue;
    }
    if (step.kind === 'verify') {
      outcomes.push(
        sealOutcome({
          ...common,
          kind: 'verify',
          gateId: input.gatePolicy.gateId,
          commandCount: input.gatePolicy.battery.length,
        }),
      );
      continue;
    }
    if (step.kind === 'rollback-point') {
      outcomes.push(
        sealOutcome({
          ...common,
          kind: 'rollback-point',
          priorRevision: step.priorRevision,
          priorStateDigest: currentState.digest,
        }),
      );
      continue;
    }
    if (step.kind === 'promote') {
      const prior = initialPlacements.get(step.componentId) ?? null;
      const fromRevision = prior === null ? null : prior.revision;
      const next = withPlacement(currentState, step.componentId, input.plan.deploymentRevision, input.instants.executedAt);
      if (!next.ok) return next;
      currentState = next.value;
      promoted.push({ step, fromRevision, priorPlacement: prior });
      outcomes.push(
        sealOutcome({
          ...common,
          kind: 'promote',
          fromRevision,
          toRevision: input.plan.deploymentRevision,
          stateDigestAfter: currentState.digest,
        }),
      );
      continue;
    }
    if (step.kind === 'health-check') {
      const probe = probeBy.get(step.componentId)!;
      if (probe.result === 'failed') {
        failure = { stepId: step.stepId, componentId: step.componentId, detail: probe.detail ?? 'probe observed failed' };
        outcomes.push(
          sealOutcome({
            ...common,
            status: 'failed',
            kind: 'health-check',
            probeResult: probe.result,
            probeDetail: probe.detail,
            error: {
              code: 'health-check-failed' as const,
              message: `health check of "${step.componentId}" in "${step.environmentId}" observed a failed probe${probe.detail === undefined ? '' : `: ${probe.detail}`}`,
            },
          }),
        );
      } else {
        outcomes.push(
          sealOutcome({
            ...common,
            kind: 'health-check',
            probeResult: probe.result,
            probeDetail: probe.detail,
            error: null,
          }),
        );
      }
      continue;
    }
  }

  // ---- Rollback (atomic, reverse promote order) ------------------------------
  let rollback: RollbackReceipt | null = null;
  if (failure !== null) {
    const restored: {
      readonly componentId: string;
      readonly fromRevision: string;
      readonly toRevision: string | null;
    }[] = [];
    let rollbackState = currentState;
    for (const entry of [...promoted].reverse()) {
      const componentId = entry.step.componentId;
      const next =
        entry.priorPlacement === null
          ? withoutPlacement(rollbackState, componentId)
          : withPlacement(rollbackState, componentId, entry.priorPlacement.revision, entry.priorPlacement.placedAt);
      if (!next.ok) return next;
      rollbackState = next.value;
      restored.push({
        componentId,
        fromRevision: input.plan.deploymentRevision,
        toRevision: entry.priorPlacement === null ? null : entry.priorPlacement.revision,
      });
    }
    const receiptContent: RollbackReceiptContent = {
      recordVersion: 1,
      planId: input.plan.planId,
      environmentId: input.plan.environmentId,
      triggeredByStepId: failure.stepId,
      triggeredByComponentId: failure.componentId,
      restoredPlacements: restored,
      initialStateDigest: input.fixtureState.digest,
      stateDigestAfter: rollbackState.digest,
      provenance: outcomeProvenance('execute:rollback'),
    };
    rollback = { ...receiptContent, digest: digestOf(receiptContent as unknown as JsonValue) };
    if (rollbackState.digest !== input.fixtureState.digest) {
      return {
        ok: false,
        error: fail(
          'rollback-mismatch',
          `rollback of plan "${input.plan.planId}" did not restore the initial state digest (${rollbackState.digest} != ${input.fixtureState.digest})`,
          ['rollback'],
        ),
      };
    }
    currentState = rollbackState;
  }

  const status: DeployRun['status'] = failure === null ? 'deployed' : 'rolled-back';
  const runContent: DeployRunContent = {
    recordVersion: 1,
    planId: input.plan.planId,
    planDigest: input.plan.digest,
    gateId: input.gatePolicy.gateId,
    environmentId: input.plan.environmentId,
    tenantId: input.plan.tenantId,
    deploymentRevision: input.plan.deploymentRevision,
    status,
    planStepCount: input.plan.steps.length,
    executedStepCount: outcomes.length,
    outcomes,
    rollback,
    initialStateDigest: input.fixtureState.digest,
    finalStateDigest: currentState.digest,
    provenance: input.provenance,
  };
  const runDigest = digestOf(runContent as unknown as JsonValue);
  return {
    ok: true,
    value: { ...runContent, runId: `run:${digestPrefix(runDigest, 16)}` as DeployRun['runId'], digest: runDigest as Sha256Digest },
  };
}

// --------------------------------------------------------------------------------
// Re-exports (fixture model types for API consumers).
// --------------------------------------------------------------------------------

export {
  EnvironmentStateSchema,
  HealthProbeObservationSchema,
  PlacementStateSchema,
  deserializeEnvironmentState,
  sealEnvironmentState,
  serializeEnvironmentState,
  verifyEnvironmentStateDigest,
} from './fixtures';
export type {
  EnvironmentStateContent,
  HealthProbeObservation as HealthProbeFixture,
} from './fixtures';
