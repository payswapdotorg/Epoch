/**
 * The advance-on-event plan execution driver (W020): the PURE core of the
 * runtime service. `applyLifecycleEvent` folds one W010 `action:lifecycle`
 * fact into a session's step states (typed transitions, retry re-queue,
 * cascade skips, settlement); `dispatchReadySteps` emits the typed
 * proposal handoffs for every step whose dependencies have all executed.
 *
 * The orchestration layer SCHEDULES, it never authorizes: lifecycle facts
 * are recorded by the event log (W010), authorization decisions belong to
 * @epoch/authorization and the future Action Gateway (W022). This driver
 * consumes facts and advances tracking state — it never executes,
 * interprets action semantics, or contacts external systems.
 *
 * Determinism: identical (session, event, at) inputs produce identical
 * outputs — dispatch order follows the compiled plan order, cascade skips
 * follow compiled order, ZERO wall-clock reads and ZERO randomness.
 */
import type { Timestamp } from '@epoch/agent-protocol';
import {
  ACTION_LIFECYCLE_EVENT_KIND,
  parseActionLifecycleEventData,
  parseEventRecord,
} from '@epoch/event-log';
import type { EventRecord } from '@epoch/event-log';
import {
  STEP_LIFECYCLE_TRANSITIONS,
  computeProposalHandoffDigest,
  evaluateSessionOutcome,
} from '@epoch/agent-orchestration';
import type {
  OrchestrationError,
  OrchestrationResult,
  OrchestrationSession,
  ProposalHandoff,
  StepState,
  StepTransition,
} from '@epoch/agent-orchestration';
import type { EventLogError } from '@epoch/event-log';
import type { AdvanceOutcome } from './types';

/** The result of a pure dispatch pass. */
export interface DispatchOutcome {
  readonly session: OrchestrationSession;
  readonly handoffs: readonly ProposalHandoff[];
}

/**
 * Dispatch every READY step of a RUNNING session: a step is ready when it
 * is `pending` and every dependency has reached `executed`. Dispatch
 * consumes an attempt, records a `dependency-satisfied` transition, and
 * emits a typed {@link ProposalHandoff} toward the Action Gateway
 * boundary. Steps dispatch in compiled-plan order (deterministic). A
 * non-running session dispatches nothing.
 */
export function dispatchReadySteps(
  session: OrchestrationSession,
  at: Timestamp,
): DispatchOutcome {
  if (session.status !== 'running') {
    return { session, handoffs: [] };
  }
  const executed = new Set(
    session.steps.filter((step) => step.status === 'executed').map((step) => step.stepId),
  );
  const planStep = new Map(session.plan.steps.map((step) => [step.stepId, step]));

  const steps: StepState[] = [];
  const transitions: StepTransition[] = [];
  const handoffs: ProposalHandoff[] = [];
  for (const step of session.steps) {
    const compiled = planStep.get(step.stepId)!;
    const ready =
      step.status === 'pending' && compiled.dependsOn.every((dep) => executed.has(dep));
    if (!ready) {
      steps.push(step);
      continue;
    }
    const attempt = step.attempt + 1;
    steps.push({
      ...step,
      status: 'dispatched',
      attempt,
      dispatchedAt: at,
      settledAt: undefined,
    });
    transitions.push({
      stepId: step.stepId,
      from: 'pending',
      to: 'dispatched',
      cause: 'dependency-satisfied',
      attempt,
      at,
    });
    const handoff: Omit<ProposalHandoff, 'handoffDigest'> = {
      schemaVersion: session.schemaVersion,
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      stepId: step.stepId,
      agentId: compiled.agentId,
      proposal: compiled.proposal,
      attempt,
      handedOffAt: at,
    };
    handoffs.push({ ...handoff, handoffDigest: computeProposalHandoffDigest(handoff) });
  }
  if (transitions.length === 0) {
    return { session, handoffs: [] };
  }
  return {
    session: {
      ...session,
      steps,
      stepTransitions: [...session.stepTransitions, ...transitions],
      updatedAt: at,
    },
    handoffs,
  };
}

/** The pure event-application result. */
export interface ApplyEventOutcome {
  readonly session: OrchestrationSession;
  /** false when the fact was recorded without a status transition. */
  readonly applied: boolean;
}

/**
 * Fold one W010 event into a session (the advance-on-event core). Total,
 * never throws; fixed precedence:
 *
 * 1. shape gate — the input must be a valid W010 `EventRecord`
 *    (`validation`, path `event.*`);
 * 2. tenant gate — the event's tenant must equal the session's
 *    (`cross-tenant-denied`, R12);
 * 3. payload gate — the payload must be an `action:lifecycle` fact
 *    (`validation`, path `event.payload.discriminator`);
 * 4. correlation gate — the fact's exact-revision proposal reference must
 *    match a step of this session (`unknown-action-reference`);
 * 5. phase gate — the phase must be legal for the step's current status
 *    (`lifecycle-conflict` on contradiction with settled history);
 * 6. application — the step transitions (settlement, retry re-queue),
 *    terminal failures cascade `skipped` over pending dependents (compiled
 *    order), and a fully-settled session settles its status
 *    (`completed` when every step executed, else `failed`).
 */
export function applyLifecycleEvent(
  session: OrchestrationSession,
  event: unknown,
  at: Timestamp,
): OrchestrationResult<ApplyEventOutcome> {
  // Precedence 1: shape gate (the FULL W010 record admission pipeline —
  // shape, content digest, and kernel payload contract; a tampered
  // digest is rejected here).
  const parsedEvent = parseEventRecord(event);
  if (!parsedEvent.ok) {
    return {
      ok: false,
      error: rePathOrWrap(parsedEvent.error, 'event'),
    };
  }
  const record: EventRecord = parsedEvent.value;

  // Precedence 2: tenant gate (R12).
  if (record.event.tenantId !== session.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `event of tenant "${record.event.tenantId}" cannot advance a session of tenant "${session.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: session.tenantId,
        encounteredTenantId: record.event.tenantId,
        sessionId: session.sessionId,
      },
    };
  }

  // Precedence 3: payload gate (the driver consumes action-lifecycle facts).
  if (record.event.payload.discriminator !== ACTION_LIFECYCLE_EVENT_KIND) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the orchestration driver consumes "${ACTION_LIFECYCLE_EVENT_KIND}" facts only (encountered "${record.event.payload.discriminator}")`,
        issues: [
          {
            path: 'event.payload.discriminator',
            message: `must be "${ACTION_LIFECYCLE_EVENT_KIND}"`,
          },
        ],
      },
    };
  }
  const payload = parseActionLifecycleEventData(record.event.payload);
  if (!payload.ok) {
    const issues =
      payload.error.code === 'validation'
        ? payload.error.issues.map((issue) => ({
            path: issue.path === '' ? 'event.payload.data' : `event.payload.${issue.path}`,
            message: issue.message,
          }))
        : [{ path: 'event.payload.data', message: payload.error.message }];
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'action-lifecycle payload data failed the W010 kernel contract',
        issues,
      },
    };
  }
  const fact = payload.value;

  // Precedence 4: correlation gate (exact-revision proposal match).
  const stepIndex = session.steps.findIndex(
    (step) =>
      session.plan.steps.find((compiled) => compiled.stepId === step.stepId)!.proposal
        .proposalId === fact.action.proposalId &&
      session.plan.steps.find((compiled) => compiled.stepId === step.stepId)!.proposal
        .canonicalDigest === fact.action.canonicalDigest,
  );
  if (stepIndex === -1) {
    return {
      ok: false,
      error: {
        code: 'unknown-action-reference',
        message: `no step of session "${session.sessionId}" references proposal "${fact.action.proposalId}" at revision ${fact.action.canonicalDigest} — the event does not correlate to this session`,
        proposalId: fact.action.proposalId,
      },
    };
  }
  const step = session.steps[stepIndex]!;
  const compiled = session.plan.steps.find((entry) => entry.stepId === step.stepId)!;

  const recordFact = (current: StepState): StepState => ({
    ...current,
    lastPhase: fact.phase,
    lastEventDigest: record.contentDigest,
  });

  // Terminal steps: only effects-recorded refinements of an executed step.
  if (
    step.status === 'executed' ||
    step.status === 'failed' ||
    step.status === 'rejected' ||
    step.status === 'skipped'
  ) {
    if (step.status === 'executed' && fact.phase === 'effects-recorded') {
      return { ok: true, value: { session: withStep(session, stepIndex, recordFact(step), at), applied: true } };
    }
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `step "${step.stepId}" is settled in status "${step.status}" — a "${fact.phase}" fact contradicts settled history`,
        from: step.status,
        to: step.status,
      },
    };
  }

  // Pending steps: only a `proposed` fact is recordable (pre-dispatch echo).
  if (step.status === 'pending') {
    if (fact.phase === 'proposed') {
      return { ok: true, value: { session: withStep(session, stepIndex, recordFact(step), at), applied: true } };
    }
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `step "${step.stepId}" is pending (not dispatched in this attempt) — a "${fact.phase}" fact cannot apply before dispatch`,
        from: 'pending',
        to: 'dispatched',
      },
    };
  }

  // Dispatched/authorized steps: recorded echoes (facts that do not
  // change the step's status).
  const recordOnly =
    fact.phase === 'proposed' ||
    fact.phase === 'effects-recorded' ||
    (fact.phase === 'authorized' && step.status === 'authorized');
  if (recordOnly) {
    return { ok: true, value: { session: withStep(session, stepIndex, recordFact(step), at), applied: true } };
  }

  const retryable =
    (fact.phase === 'failed' || fact.phase === 'rejected') &&
    step.attempt < compiled.retryPolicy.maxAttempts &&
    compiled.retryPolicy.retryOn.includes(fact.phase);

  const nextStatus: StepState['status'] =
    fact.phase === 'authorized'
      ? 'authorized'
      : fact.phase === 'executed'
        ? 'executed'
        : retryable
          ? 'pending'
          : fact.phase === 'failed'
            ? 'failed'
            : 'rejected';

  if (!STEP_LIFECYCLE_TRANSITIONS[step.status].includes(nextStatus)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `step "${step.stepId}" in status "${step.status}" cannot transition to "${nextStatus}" on a "${fact.phase}" fact`,
        from: step.status,
        to: nextStatus,
      },
    };
  }

  const steps = [...session.steps];
  steps[stepIndex] = {
    ...recordFact(step),
    status: nextStatus,
    settledAt:
      nextStatus === 'executed' || nextStatus === 'failed' || nextStatus === 'rejected'
        ? at
        : undefined,
  };
  const stepTransitions: StepTransition[] = [
    ...session.stepTransitions,
    {
      stepId: step.stepId,
      from: step.status,
      to: nextStatus,
      cause: retryable ? 'retry' : 'event',
      phase: fact.phase,
      eventDigest: record.contentDigest,
      attempt: step.attempt,
      at,
    },
  ];

  // Cascade: a terminal failure skips every still-pending dependent
  // (transitively), in compiled-plan order (deterministic).
  if (nextStatus === 'failed' || nextStatus === 'rejected') {
    const failed = new Set<string>([step.stepId]);
    // Iterate to a fixed point: a skipped step's own dependents skip too.
    let changed = true;
    while (changed) {
      changed = false;
      for (const compiledStep of session.plan.steps) {
        const idx = steps.findIndex((entry) => entry.stepId === compiledStep.stepId);
        const current = steps[idx]!;
        if (current.status !== 'pending') continue;
        const blocked = compiledStep.dependsOn.some((dep) => failed.has(dep));
        if (!blocked) continue;
        steps[idx] = { ...current, status: 'skipped', settledAt: at };
        stepTransitions.push({
          stepId: compiledStep.stepId,
          from: 'pending',
          to: 'skipped',
          cause: 'cascade',
          attempt: current.attempt,
          at,
        });
        failed.add(compiledStep.stepId);
        changed = true;
      }
    }
  }

  // Settlement: a fully-settled session settles its status (completed
  // only when every step executed; any failed/rejected/skipped step
  // settles the session as failed).
  const settled = evaluateSessionOutcome(steps);
  let status = session.status;
  let sessionTransitions = session.sessionTransitions;
  if (settled !== undefined && session.status === 'running') {
    status = settled;
    sessionTransitions = [
      ...sessionTransitions,
      {
        from: session.status,
        to: settled,
        cause: settled === 'completed' ? ('all-steps-executed' as const) : ('step-settled-unexecuted' as const),
        at,
      },
    ];
  }

  return {
    ok: true,
    value: {
      session: {
        ...session,
        steps,
        stepTransitions,
        sessionTransitions,
        status,
        updatedAt: at,
      },
      applied: true,
    },
  };
}

/** One advance pass: apply the event, then dispatch newly-ready steps. */
export function advanceSession(
  session: OrchestrationSession,
  event: unknown,
  at: Timestamp,
): OrchestrationResult<AdvanceOutcome> {
  const applied = applyLifecycleEvent(session, event, at);
  if (!applied.ok) {
    return applied;
  }
  const dispatched = dispatchReadySteps(applied.value.session, at);
  return {
    ok: true,
    value: {
      session: dispatched.session,
      handoffs: dispatched.handoffs,
      applied: applied.value.applied,
    },
  };
}

/** Map a W010 record-admission failure into the orchestration taxonomy. */
function rePathOrWrap(error: EventLogError, prefix: string): OrchestrationError {
  if (error.code === 'validation') {
    return {
      code: 'validation',
      message: `ingested event is not a valid W010 event record: ${error.message}`,
      issues: error.issues.map((issue) => ({
        path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
        message: issue.message,
      })),
    };
  }
  if (error.code === 'version-unsupported' || error.code === 'digest-mismatch') {
    return { ...error, message: `${prefix}: ${error.message}` };
  }
  // parseEventRecord produces only the three codes above; anything else is
  // surfaced as a typed validation failure (never thrown, never silent).
  return {
    code: 'validation',
    message: `${prefix}: ${error.message}`,
    issues: [{ path: prefix, message: error.message }],
  };
}

/** Replace one step (optionally appending transitions). */
function withStep(
  session: OrchestrationSession,
  index: number,
  step: StepState,
  at: Timestamp,
  extraTransitions: readonly StepTransition[] = [],
): OrchestrationSession {
  const steps = [...session.steps];
  steps[index] = step;
  return {
    ...session,
    steps,
    stepTransitions: [...session.stepTransitions, ...extraTransitions],
    updatedAt: at,
  };
}
