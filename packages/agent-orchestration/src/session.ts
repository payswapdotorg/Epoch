/**
 * Orchestration session records (the W020 pin): sessions are tenant-scoped,
 * replayable typed documents — one compiled plan, its bound agents, and the
 * step execution-tracking states. This module owns the PURE record
 * machinery (creation, typed lifecycle transitions, outcome evaluation);
 * the long-running HOST MODEL (event intake, advance-on-event driving) is
 * the runtime service's responsibility (services/agent-runtime).
 *
 * The orchestration layer SCHEDULES: a session dispatches typed proposal
 * handoff records toward the Action Gateway boundary (W022, future) and
 * tracks lifecycle facts recorded by W010 events — it never authorizes,
 * executes, or interprets action semantics.
 */
import { SESSION_LIFECYCLE_TRANSITIONS } from './version';
import type { SessionStatus, SessionTransitionCause } from './version';
import type {
  AgentBinding,
  CompiledPlan,
  OrchestrationError,
  OrchestrationResult,
  OrchestrationSession,
  SessionStatusTransition,
  StepState,
} from './types';
import { parseAgentBinding, parseCompiledPlan } from './parse';
import { invalidPlanError } from './issues';

/** Options of {@link createSessionRecord}. */
export interface CreateSessionRecordOptions {
  readonly sessionId: string;
  readonly plan: unknown;
  readonly agents: readonly unknown[];
  readonly createdAt: string;
}

/**
 * Create a session record from a compiled plan and its agent bindings.
 * Total, never throws; precedence:
 *
 * 1. version/schema/digest gates on the compiled plan (parseCompiledPlan —
 *    a tampered plan digest is `digest-mismatch`);
 * 2. schema gates on the agent bindings (path `agents[i]` on failure);
 * 3. coverage gate — every step's assigned agent has a binding
 *    (`invalid-plan`);
 * 4. the record is built in the session's canonical form: agents sorted by
 *    agentId, steps in compiled-plan order, all steps `pending` at attempt
 *    0, empty transition logs.
 */
export function createSessionRecord(
  options: CreateSessionRecordOptions,
): OrchestrationResult<OrchestrationSession> {
  const parsedPlan = parseCompiledPlan(options.plan);
  if (!parsedPlan.ok) {
    return parsedPlan;
  }
  const plan: CompiledPlan = parsedPlan.value;

  const bindings: AgentBinding[] = [];
  for (const [index, binding] of options.agents.entries()) {
    const parsed = parseAgentBinding(binding);
    if (!parsed.ok) {
      return { ok: false, error: rePath(parsed.error, `agents[${index}]`) };
    }
    bindings.push(parsed.value);
  }
  bindings.sort((a, b) =>
    a.agent.agentId === b.agent.agentId ? 0 : a.agent.agentId < b.agent.agentId ? -1 : 1,
  );

  const bound = new Set(bindings.map((binding) => binding.agent.agentId));
  const unassigned = plan.steps.find((step) => !bound.has(step.agentId));
  if (unassigned !== undefined) {
    return {
      ok: false,
      error: invalidPlanError(
        `step "${unassigned.stepId}" is assigned to agent "${unassigned.agentId}" which has no binding in the session's agent set`,
        [
          {
            path: `plan.steps`,
            message: `agent "${unassigned.agentId}" is not bound in this session`,
          },
        ],
      ),
    };
  }

  const steps: StepState[] = plan.steps.map((step) => ({
    stepId: step.stepId,
    status: 'pending',
    attempt: 0,
  }));

  return {
    ok: true,
    value: {
      schemaVersion: plan.schemaVersion,
      sessionId: options.sessionId,
      tenantId: plan.tenantId,
      plan,
      agents: bindings,
      status: 'pending',
      steps,
      sessionTransitions: [],
      stepTransitions: [],
      createdAt: options.createdAt,
      updatedAt: options.createdAt,
    },
  };
}

/**
 * Apply one session-status transition (typed; the runtime service owns
 * WHEN transitions happen, this owns THAT they are legal). Illegal
 * transitions (including any transition out of a terminal status) are
 * `lifecycle-conflict`. Pure: returns the next session document.
 */
export function transitionSessionStatus(
  session: OrchestrationSession,
  to: SessionStatus,
  cause: SessionTransitionCause,
  at: string,
): OrchestrationResult<OrchestrationSession> {
  const from = session.status;
  if (!SESSION_LIFECYCLE_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `illegal session lifecycle transition ${from} -> ${to} (legal transitions from "${from}": ${describeSessionTransitions(from)})`,
        from,
        to,
      },
    };
  }
  const transition: SessionStatusTransition = { from, to, cause, at };
  return {
    ok: true,
    value: {
      ...session,
      status: to,
      sessionTransitions: [...session.sessionTransitions, transition],
      updatedAt: at,
    },
  };
}

/** Terminal session statuses (no further transitions). */
export function isTerminalSessionStatus(status: SessionStatus): boolean {
  return SESSION_LIFECYCLE_TRANSITIONS[status].length === 0;
}

/**
 * Evaluate the settlement outcome of a session's steps (pure):
 * `completed` when every step reached `executed`; `failed` when any step
 * settled without executing (`failed`, `rejected`, or `skipped`); undefined
 * while steps remain in flight.
 */
export function evaluateSessionOutcome(
  steps: readonly StepState[],
): 'completed' | 'failed' | undefined {
  const settled = steps.every(
    (step) => step.status === 'executed' || step.status === 'failed' || step.status === 'rejected' || step.status === 'skipped',
  );
  if (!settled) {
    return undefined;
  }
  return steps.every((step) => step.status === 'executed') ? 'completed' : 'failed';
}

/** Legal-transition description for lifecycle-conflict messages. */
function describeSessionTransitions(status: SessionStatus): string {
  const next = SESSION_LIFECYCLE_TRANSITIONS[status];
  return next.length === 0 ? 'none (terminal status)' : next.map((s) => `${status} -> ${s}`).join(', ');
}

/** Re-path an orchestration validation error under a prefix. */
function rePath(error: OrchestrationError, prefix: string): OrchestrationError {
  if (error.code !== 'validation') {
    return { ...error, message: `${prefix}: ${error.message}` };
  }
  return {
    code: 'validation',
    message: `${prefix}: ${error.message}`,
    issues: error.issues.map((issue) => ({
      path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
      message: issue.message,
    })),
  };
}
