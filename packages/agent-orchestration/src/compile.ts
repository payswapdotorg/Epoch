/**
 * Deterministic plan compilation (the W020 pin): "schedules and runbooks
 * are typed data compiled/validated deterministically; identical inputs
 * produce identical orchestration plans (sorted, content-addressed)".
 *
 * The compiler consumes an AUTHORED plan (steps as typed action-proposal
 * references), the ADMITTED PROPOSAL SET (parsed through the real
 * @epoch/action-protocol admission pipeline), and the session's AGENT
 * BINDINGS — and produces the content-addressed {@link CompiledPlan}:
 *
 * 1. version gate — `schemaVersion` skew is `version-unsupported`;
 * 2. schema gate — strict-object validation with precise dotted paths
 *    (`validation`); the proposal set parses through the W003 pipeline
 *    (malformed proposals are `validation` errors at `proposals[i]`);
 * 3. plan semantics — duplicate step ids, self-dependencies, unknown
 *    dependencies, unassigned agents, and duplicate proposal references
 *    are `invalid-plan` errors with precise dotted paths;
 * 4. proposal resolution — every step's proposal reference resolves to an
 *    admitted proposal (`unknown-action-reference`) at the EXACT claimed
 *    revision (`digest-mismatch` — tamper detection);
 * 5. normalization — dependsOn sorted + de-duplicated, retry policies
 *    defaulted, steps ordered by deterministic topological sort (Kahn's
 *    algorithm with the ready queue always admitting the smallest stepId
 *    first); cyclic graphs are `invalid-plan`;
 * 6. content addressing — the plan digest is the SHA-256 of the canonical
 *    JSON of the normalized plan (src/digest.ts).
 *
 * The result is a pure function of the inputs: any authoring order of the
 * same semantic content produces the SAME compiled plan (byte-identical
 * steps and digest). ZERO wall-clock reads and ZERO randomness.
 */
import { parseActionProposal } from '@epoch/action-protocol';
import type { ActionProposal } from '@epoch/action-protocol';
import type { ProtocolError } from '@epoch/agent-protocol';
import { computePlanDigest } from './digest';
import { invalidPlanError } from './issues';
import { parseAgentBinding, parseOrchestrationPlan } from './parse';
import type {
  AgentBinding,
  CompiledPlan,
  CompiledPlanStep,
  OrchestrationError,
  OrchestrationIssue,
  OrchestrationResult,
  PlanStep,
  RetryPolicy,
} from './types';

/** Options of {@link compilePlan}. */
export interface CompilePlanOptions {
  /** The authored orchestration plan (validated, strict object). */
  readonly plan: unknown;
  /** The admitted proposal set (each parsed through the W003 pipeline). */
  readonly proposals: readonly unknown[];
  /** The session's agent bindings (from `bindOrchestratedAgent`). */
  readonly agents: readonly AgentBinding[];
}

/** The default retry policy: one attempt, no retries. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 1, retryOn: [] };

/**
 * Compile an authored plan into its deterministic, content-addressed form.
 * Total, never throws; see the module docs for the fixed precedence of
 * typed errors.
 */
export function compilePlan(options: CompilePlanOptions): OrchestrationResult<CompiledPlan> {
  // Precedence 1-2 (plan): version gate -> schema gate.
  const parsedPlan = parseOrchestrationPlan(options.plan);
  if (!parsedPlan.ok) {
    return parsedPlan;
  }
  const plan = parsedPlan.value;

  // Precedence 2 (proposals): the admitted proposal set parses through the
  // real W003 admission pipeline; malformed entries are typed rejections.
  const admitted = new Map<string, { proposal: ActionProposal; digest: string }>();
  for (const [index, entry] of options.proposals.entries()) {
    const parsed = parseActionProposal(entry);
    if (!parsed.ok) {
      return {
        ok: false,
        error: rePathProtocolError(parsed.error, `proposals[${index}]`),
      };
    }
    admitted.set(parsed.value.proposalId, { proposal: parsed.value, digest: parsed.digest });
  }

  // Precedence 2 (agents): bindings re-validate (serialized bindings may
  // be tampered; the session document is only as trustworthy as its input).
  const agents = new Map<string, AgentBinding>();
  for (const [index, binding] of options.agents.entries()) {
    const parsed = parseAgentBinding(binding);
    if (!parsed.ok) {
      return {
        ok: false,
        error: rePathOrchestrationError(parsed.error, `agents[${index}]`),
      };
    }
    agents.set(parsed.value.agent.agentId, parsed.value);
  }

  // Precedence 3: plan semantics, in a fixed order so consumers branch
  // deterministically.
  const semantics = planSemantics(plan.steps, agents);
  if (semantics !== null) {
    return { ok: false, error: semantics };
  }

  // Precedence 4: proposal resolution (existence, then exact revision).
  for (const step of plan.steps) {
    const found = admitted.get(step.proposal.proposalId);
    if (found === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-action-reference',
          message: `step "${step.stepId}" references proposal "${step.proposal.proposalId}" which is not in the admitted proposal set`,
          proposalId: step.proposal.proposalId,
          stepId: step.stepId,
        },
      };
    }
    if (found.digest !== step.proposal.canonicalDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `step "${step.stepId}" pins proposal "${step.proposal.proposalId}" at a revision that does not match the admitted proposal (tampered or stale reference)`,
          expected: found.digest,
          encountered: step.proposal.canonicalDigest,
        },
      };
    }
  }

  // Precedence 5: normalization — canonical dependsOn, defaulted retry
  // policies, deterministic topological order.
  const ordered = topologicalOrder(plan.steps);
  if (ordered === null) {
    return { ok: false, error: cycleError(plan.steps) };
  }
  const compiledSteps: CompiledPlanStep[] = ordered.map((step) => ({
    stepId: step.stepId,
    agentId: step.agentId,
    proposal: step.proposal,
    dependsOn: canonicalDependencies(step),
    retryPolicy: canonicalRetryPolicy(step),
  }));

  // Precedence 6: content addressing over the normalized plan.
  const planDigest = computePlanDigest({
    schemaVersion: plan.schemaVersion,
    tenantId: plan.tenantId,
    planId: plan.planId,
    displayName: plan.displayName,
    createdBy: plan.createdBy,
    steps: compiledSteps,
  });
  return {
    ok: true,
    value: {
      schemaVersion: plan.schemaVersion,
      tenantId: plan.tenantId,
      planId: plan.planId,
      displayName: plan.displayName,
      createdBy: plan.createdBy,
      planDigest,
      steps: compiledSteps,
      stepCount: compiledSteps.length,
    },
  };
}

/** Plan-semantic checks (precedence 3); null = clean. */
function planSemantics(
  steps: readonly PlanStep[],
  agents: ReadonlyMap<string, AgentBinding>,
): OrchestrationError | null {
  // Duplicate step ids.
  const seenStepIds = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (seenStepIds.has(step.stepId)) {
      return invalidPlanError(
        `duplicate step id "${step.stepId}" — step ids are unique within a plan`,
        [{ path: `steps[${index}].stepId`, message: `step id "${step.stepId}" already declared` }],
      );
    }
    seenStepIds.add(step.stepId);
  }

  // Self-dependencies.
  for (const [index, step] of steps.entries()) {
    if (step.dependsOn.includes(step.stepId)) {
      return invalidPlanError(
        `step "${step.stepId}" depends on itself`,
        [
          {
            path: `steps[${index}].dependsOn`,
            message: `step "${step.stepId}" cannot depend on itself`,
          },
        ],
      );
    }
  }

  // Unknown dependencies.
  for (const [index, step] of steps.entries()) {
    for (const [depIndex, dependency] of step.dependsOn.entries()) {
      if (!seenStepIds.has(dependency)) {
        return invalidPlanError(
          `step "${step.stepId}" depends on unknown step "${dependency}"`,
          [
            {
              path: `steps[${index}].dependsOn[${depIndex}]`,
              message: `unknown dependency "${dependency}" — not a step of this plan`,
            },
          ],
        );
      }
    }
  }

  // Unassigned agents.
  for (const [index, step] of steps.entries()) {
    if (!agents.has(step.agentId)) {
      return invalidPlanError(
        `step "${step.stepId}" is assigned to agent "${step.agentId}" which has no binding in the session's agent set`,
        [
          {
            path: `steps[${index}].agentId`,
            message: `agent "${step.agentId}" is not bound (bind it via bindOrchestratedAgent first)`,
          },
        ],
      );
    }
  }

  // Duplicate proposal references (a proposal is a unique intervention —
  // two steps dispatching the same exact revision would double-execute).
  const seenProposals = new Map<string, string>();
  for (const [index, step] of steps.entries()) {
    const key = `${step.proposal.proposalId}@${step.proposal.canonicalDigest}`;
    const firstStepId = seenProposals.get(key);
    if (firstStepId !== undefined) {
      return invalidPlanError(
        `steps "${firstStepId}" and "${step.stepId}" reference the same proposal revision "${step.proposal.proposalId}" — each proposal is scheduled by at most one step`,
        [
          {
            path: `steps[${index}].proposal.proposalId`,
            message: `proposal "${step.proposal.proposalId}" already referenced by step "${firstStepId}"`,
          },
        ],
      );
    }
    seenProposals.set(key, step.stepId);
  }

  return null;
}

/**
 * Deterministic topological order (Kahn's algorithm): repeatedly admit the
 * lexicographically SMALLEST ready step. Returns null when the graph is
 * cyclic.
 */
function topologicalOrder(steps: readonly PlanStep[]): readonly PlanStep[] | null {
  const byId = new Map<string, PlanStep>(steps.map((step) => [step.stepId, step]));
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, string[]>();
  for (const step of steps) {
    dependencies.set(
      step.stepId,
      new Set(canonicalDependencies(step)),
    );
  }
  for (const step of steps) {
    for (const dependency of dependencies.get(step.stepId)!) {
      const list = dependents.get(dependency) ?? [];
      list.push(step.stepId);
      dependents.set(dependency, list);
    }
  }

  // Ready heap replaced by a sorted array: step counts are small and the
  // sort keeps the algorithm simple and deterministic.
  let ready = [...dependencies.entries()]
    .filter(([, deps]) => deps.size === 0)
    .map(([id]) => id)
    .sort();
  const ordered: PlanStep[] = [];
  const done = new Set<string>();
  while (ready.length > 0) {
    const current = ready.shift()!;
    ordered.push(byId.get(current)!);
    done.add(current);
    for (const dependent of (dependents.get(current) ?? []).sort()) {
      const deps = dependencies.get(dependent)!;
      deps.delete(current);
      if (deps.size === 0) {
        ready.push(dependent);
      }
    }
    ready = ready.sort();
  }
  return done.size === steps.length ? ordered : null;
}

/** The cycle error: names the first authored step trapped in (or downstream of) a cycle. */
function cycleError(steps: readonly PlanStep[]) {
  const ordered = topologicalOrder(steps) ?? [];
  const done = new Set(ordered.map((step) => step.stepId));
  const trapped = steps.filter((step) => !done.has(step.stepId));
  const names = trapped.map((step) => step.stepId).sort();
  const index = steps.findIndex((step) => !done.has(step.stepId));
  return invalidPlanError(
    `dependency cycle detected among steps: ${names.join(', ')}`,
    [
      {
        path: `steps[${index === -1 ? 0 : index}].dependsOn`,
        message: `steps ${names.join(', ')} form (or depend on) a dependency cycle`,
      },
    ],
  );
}

/** Canonical dependencies: sorted ascending, de-duplicated. */
function canonicalDependencies(step: PlanStep): readonly string[] {
  return [...new Set(step.dependsOn)].sort();
}

/** Canonical retry policy: defaulted, retryOn sorted + de-duplicated. */
function canonicalRetryPolicy(step: PlanStep): RetryPolicy {
  const policy = step.retryPolicy ?? DEFAULT_RETRY_POLICY;
  return {
    maxAttempts: policy.maxAttempts,
    retryOn: [...new Set(policy.retryOn)].sort(),
  };
}

/** Re-path a W003 protocol admission failure under a proposals[i] prefix. */
function rePathProtocolError(error: ProtocolError, prefix: string): OrchestrationError {
  const issues: OrchestrationIssue[] =
    error.kind === 'schema-violation'
      ? error.issues.map((issue) => ({
          path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
          message: issue.message,
        }))
      : [{ path: prefix, message: error.message }];
  return validationErrorFromIssues(issues);
}

function validationErrorFromIssues(issues: readonly OrchestrationIssue[]): OrchestrationError {
  return {
    code: 'validation',
    message: `orchestration document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Re-path an orchestration validation error under an agents[i] prefix. */
function rePathOrchestrationError(error: OrchestrationError, prefix: string): OrchestrationError {
  if (error.code !== 'validation') {
    return { ...error, message: `${prefix}: ${error.message}` };
  }
  return validationErrorFromIssues(
    error.issues.map((issue) => ({
      path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
      message: issue.message,
    })),
  );
}
