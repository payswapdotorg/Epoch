/**
 * The reference Action Gateway host (W022): the EXECUTION AUTHORITY over
 * the @epoch/action-policy kernel (architecture.md, binding: "Agents
 * propose; the Action Gateway authorizes execution."; lock rule 3:
 * "Actions execute only through the Action Gateway.").
 *
 * Owns (and only owns): tenant-scoped intake with the W009 authorization
 * gate FIRST (unauthenticated/unauthorized intake is the typed
 * `authorization-rejected` BEFORE any policy evaluation), the human
 * approval flow (quorum, deadlines, delegation bounds, supersession),
 * execution dispatch through the ActionExecutionPort ADAPTER SEAM
 * (record-shaped outcomes ONLY — the gateway never implements side
 * effects), the action:* event vocabulary over the W010 shapes (one action
 * = one stream), and health/snapshots as typed data.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant is
 * caller-supplied; every listing/snapshot is sorted (no insertion-order
 * leaks); two gateways fed the same intake/approval/execution history hold
 * byte-identical state (snapshots pin this).
 *
 * Tenant isolation (R12): actions are tenant-scoped; the host may pin one
 * tenant (`expectedTenantId`); cross-tenant reads and cross-tenant proposal
 * references are typed `tenant-isolation-rejected` rejections (the kernel
 * enforces the decision-level isolation; the host enforces the entry
 * level).
 */
import type {
  ActionProposal,
  ActionTypeReference,
  ProposalReference,
} from '@epoch/action-protocol';
import { parseActionProposal } from '@epoch/action-protocol';
import {
  ActionPolicyRegistry,
  type JsonValue,
  type SealedPolicyDecision,
  type Timestamp,
} from '@epoch/action-policy';
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
  PrincipalIdSchema,
} from '@epoch/authorization';
import { TenantIdSchema, type TenantId } from '@epoch/tenancy';
import { InMemoryExecutionPort } from './adapters';
import {
  ACTION_EVENT_ACTOR_PATTERN,
  actionIdIssue,
  actionStreamIdOf,
  authorizationEventDetail,
  intakeEventDetail,
  outcomeEventDetail,
  rejectionEventDetail,
  sealActionEvent,
  verifySealedActionEvent,
  type ActionEventPhase,
  type SealedActionEvent,
} from './events';
import { sealActionOutcome, verifySealedActionOutcome } from './outcomes';
import { ActionEntrySchema, parseActionEntry, parseGatewaySnapshot } from './schema';
import { gatewayValidationError, zodIssuesToGatewayIssues } from './issues';
import { GATEWAY_RECORD_VERSION, type ActionStatus } from './version';
import type {
  ActionEntry,
  ActionGatewayOptions,
  ActionScope,
  ApprovalFlowOptions,
  ApprovalOutcome,
  AuthorizationGateInput,
  ExecuteActionOptions,
  ExecutionOutcome,
  ExpiredApproval,
  GatewayHealth,
  GatewayResult,
  GatewaySnapshot,
  IntakeOutcome,
  ListActionsOptions,
  ActionReadOptions,
  RejectionOutcome,
  SubmitActionOptions,
} from './types';

/** Deterministic composite key: `<tenantId>#<actionId>` (grammars exclude `#`). */
function actionKey(tenantId: string, actionId: string): string {
  return `${tenantId}#${actionId}`;
}

/** The synthetic system principal that performs host sweeps (the W009 grammar). */
const GATEWAY_ACTOR = 'principal:action-gateway';

/** Deterministic evidence-ref merge (deduplicated, sorted). */
function mergeEvidenceRefs(
  ...groups: readonly (readonly string[] | undefined)[]
): readonly string[] {
  const all = groups.flatMap((group) => (group === undefined ? [] : [...group]));
  return [...new Set(all)].sort();
}

/** The pure status derivation from a decision + its live approval-request state. */
function statusFromRegistry(
  decision: SealedPolicyDecision,
  request: { status: string } | undefined,
): ActionStatus {
  if (decision.outcome === 'allow') {
    return 'authorized';
  }
  if (decision.outcome === 'deny') {
    return 'denied';
  }
  switch (request?.status) {
    case 'approved':
      return 'authorized';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'approval-expired';
    default:
      return 'awaiting-approval';
  }
}

/** One event emission request (the derived fields are the host's business). */
interface EmitEventRequest {
  readonly streamId: string;
  readonly tenantId: TenantId;
  readonly actor: string;
  readonly proposalRef: ProposalReference;
  readonly actionType: ActionTypeReference;
  readonly phase: ActionEventPhase;
  readonly detail: Record<string, JsonValue>;
  readonly occurredAt: Timestamp;
}

/**
 * The reference Action Gateway host. Construct directly (`new
 * ActionGateway()` or `new ActionGateway({ expectedTenantId, executionPort
 * })`), or restore deterministically from a snapshot
 * (`ActionGateway.fromSnapshot`). In-memory only: no persistence, no
 * network, no side effects (the execution port is the seam — the reference
 * adapter performs none).
 */
export class ActionGateway {
  private registry: ActionPolicyRegistry;

  /** tenantId#actionId -> entry. Maps iterate in insertion order; every read path sorts. */
  private readonly actions = new Map<string, ActionEntry>();

  /** streamId -> sealed events (one action = one stream). */
  private readonly streams = new Map<string, SealedActionEvent[]>();

  private readonly executionPort;

  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: ActionGatewayOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.executionPort = options.executionPort ?? new InMemoryExecutionPort();
    this.registry = new ActionPolicyRegistry({ expectedTenantId: options.expectedTenantId });
  }

  // --------------------------------------------------------------------------------
  // Intake: authorization gate FIRST, then the policy decision.
  // --------------------------------------------------------------------------------

  /**
   * Intake: admit an action — W009 authorization gate, then the typed
   * policy decision (via the kernel). One action id grounds exactly one
   * proposal revision (`action-conflict` otherwise); a re-evaluation of the
   * SAME revision under a CHANGED policy set records a NEW chained decision
   * (the kernel's version-chain semantics) and the action runs under the
   * new decision; the same revision under the same policy set is the typed
   * `duplicate-decision` (idempotent). Dispatched actions (executed /
   * failed) never re-decide (`action-settled`).
   */
  submitAction(options: SubmitActionOptions): GatewayResult<IntakeOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return guard;
    }
    const actionIdProblem = actionIdIssue(options.actionId);
    if (actionIdProblem !== null) {
      return {
        ok: false,
        error: gatewayValidationError([{ path: '$.actionId', message: actionIdProblem }]),
      };
    }
    const tenant = TenantIdSchema.safeParse(options.tenantId);
    if (!tenant.success) {
      return { ok: false, error: gatewayValidationError(zodIssuesToGatewayIssues(tenant.error)) };
    }
    const proposalOutcome = parseActionProposal(options.proposal);
    if (!proposalOutcome.ok) {
      const failure = proposalOutcome.error;
      return {
        ok: false,
        error: gatewayValidationError(
          failure.kind === 'schema-violation'
            ? failure.issues.map((issue) => ({
                path: issue.path === '' ? '$.proposal' : `$.proposal.${issue.path}`,
                message: issue.message,
              }))
            : [{ path: '$.proposal', message: `${failure.kind}: ${failure.message}` }],
        ),
      };
    }
    const proposal: ActionProposal = proposalOutcome.value;
    const proposalRef: ProposalReference = {
      proposalId: proposal.proposalId,
      canonicalDigest: proposalOutcome.digest,
    };

    const key = actionKey(options.tenantId, options.actionId);
    const existing = this.actions.get(key);
    if (existing !== undefined) {
      if (existing.proposalRef.canonicalDigest !== proposalRef.canonicalDigest) {
        return {
          ok: false,
          error: {
            code: 'action-conflict',
            message: `action "${options.actionId}" already grounds proposal revision ${existing.proposalRef.canonicalDigest} — one action id grounds exactly one proposal revision (use a new action id)`,
            actionId: options.actionId,
            expectedProposalDigest: existing.proposalRef.canonicalDigest,
            encounteredProposalDigest: proposalRef.canonicalDigest,
          },
        };
      }
      if (existing.status === 'executed' || existing.status === 'failed') {
        return {
          ok: false,
          error: {
            code: 'action-settled',
            message: `action "${options.actionId}" is already ${existing.status} — a dispatched action never re-decides`,
            actionId: options.actionId,
            status: existing.status,
          },
        };
      }
    }

    // The W009 authorization gate — BEFORE policy evaluation.
    const gate = this.authorizationGate(options, proposal);
    if (!gate.ok) {
      return gate;
    }
    const actor = gate.value.principalId;

    // The policy decision (the kernel owns evaluation + admission).
    const decisionOutcome = this.registry.recordDecision({
      tenantId: options.tenantId,
      scope: options.scope,
      proposal: options.proposal,
      policies: options.policies,
      resolveConstraint: options.resolveConstraint,
      evaluationContext: options.evaluationContext,
      decidedAt: options.decidedAt,
      approval: options.approval,
    });
    let decision: SealedPolicyDecision;
    if (decisionOutcome.ok) {
      decision = decisionOutcome.value;
    } else if (decisionOutcome.error.code === 'duplicate-decision') {
      // Idempotent replay: the existing decision stands. An action entry
      // not yet grounding it adopts it (its status derives from the
      // decision + the live approval-request state); an existing entry
      // keeps its state unchanged (the typed negative passthrough).
      decision = decisionOutcome.error.existingDecision;
      if (existing !== undefined) {
        return { ok: false, error: decisionOutcome.error };
      }
    } else {
      return { ok: false, error: decisionOutcome.error };
    }

    const streamId = actionStreamIdOf(options.actionId);
    const events: SealedActionEvent[] = [];
    const status = this.deriveStatus(decision);

    const intakeEvent = this.emitEvent({
      streamId,
      tenantId: options.tenantId,
      actor,
      proposalRef,
      actionType: proposal.actionType,
      phase: 'proposed',
      detail: intakeEventDetail(decision),
      occurredAt: options.decidedAt,
    });
    if (!intakeEvent.ok) {
      return intakeEvent;
    }
    events.push(intakeEvent.value);
    if (status === 'authorized') {
      const authorizedEvent = this.emitEvent({
        streamId,
        tenantId: options.tenantId,
        actor,
        proposalRef,
        actionType: proposal.actionType,
        phase: 'authorized',
        detail: authorizationEventDetail(decision, 'policy-allow'),
        occurredAt: options.decidedAt,
      });
      if (!authorizedEvent.ok) {
        return authorizedEvent;
      }
      events.push(authorizedEvent.value);
    } else if (status === 'denied' && decision.denial !== undefined) {
      const rejectedEvent = this.emitEvent({
        streamId,
        tenantId: options.tenantId,
        actor,
        proposalRef,
        actionType: proposal.actionType,
        phase: 'rejected',
        detail: rejectionEventDetail(decision, 'policy-deny', decision.denial.code),
        occurredAt: options.decidedAt,
      });
      if (!rejectedEvent.ok) {
        return rejectedEvent;
      }
      events.push(rejectedEvent.value);
    }

    const entry: ActionEntry = {
      schemaVersion: GATEWAY_RECORD_VERSION,
      actionId: options.actionId,
      tenantId: options.tenantId,
      actionType: proposal.actionType,
      proposal,
      proposalRef,
      decisionDigest: decision.contentDigest,
      status,
      streamId,
      createdAt: existing?.createdAt ?? options.decidedAt,
      updatedAt: options.decidedAt,
      ...(existing?.outcome !== undefined ? { outcome: existing.outcome } : {}),
    };
    this.actions.set(key, entry);

    return { ok: true, value: { action: entry, decision, events } };
  }

  // --------------------------------------------------------------------------------
  // The human-approval flow.
  // --------------------------------------------------------------------------------

  /**
   * Record one human approval against the action's in-force
   * requires-approval decision. The kernel owns the gates (drift,
   * deadline, roles, delegation, duplicate replay, settlement); when the
   * quorum is met the action becomes `authorized` and the stream records
   * the `authorized` fact (sub-quorum approvals are sealed kernel records;
   * the stream records lifecycle milestones).
   */
  approveAction(options: ApprovalFlowOptions): GatewayResult<ApprovalOutcome> {
    const entryOutcome = this.actionEntry(options.tenantId, options.actionId);
    if (!entryOutcome.ok) {
      return entryOutcome;
    }
    const entry = entryOutcome.value;
    const actorProblem = this.actorProblem(options.decidedBy.id);
    if (actorProblem !== null) {
      return {
        ok: false,
        error: gatewayValidationError([{ path: '$.decidedBy.id', message: actorProblem }]),
      };
    }
    const approval = this.registry.recordApproval({
      tenantId: options.tenantId,
      decisionDigest: entry.decisionDigest,
      proposalRef: entry.proposalRef,
      decidedBy: options.decidedBy,
      asRole: options.asRole,
      delegationPath: options.delegationPath,
      note: options.note,
      at: options.at,
    });
    if (!approval.ok) {
      return approval;
    }
    const events: SealedActionEvent[] = [];
    let status = entry.status;
    const requestOutcome = this.registry.approvalRequest(entry.decisionDigest);
    if (requestOutcome.ok && requestOutcome.value.status === 'approved') {
      status = 'authorized';
      const authorizedEvent = this.emitEvent({
        streamId: entry.streamId,
        tenantId: entry.tenantId,
        actor: options.decidedBy.id,
        proposalRef: entry.proposalRef,
        actionType: entry.actionType,
        phase: 'authorized',
        detail: authorizationEventDetail(
          { contentDigest: entry.decisionDigest, policySetDigest: '', outcome: 'requires-approval' },
          'human-approval',
          requestOutcome.value.approvals.length,
        ),
        occurredAt: options.at,
      });
      if (!authorizedEvent.ok) {
        return authorizedEvent;
      }
      events.push(authorizedEvent.value);
    }
    const updated: ActionEntry = { ...entry, status, updatedAt: options.at };
    this.actions.set(actionKey(entry.tenantId, entry.actionId), updated);
    return { ok: true, value: { action: updated, approval: approval.value, events } };
  }

  /**
   * Record one human rejection: a fail-closed veto — the action settles
   * `rejected` and the stream records the `rejected` fact.
   */
  rejectAction(options: ApprovalFlowOptions): GatewayResult<RejectionOutcome> {
    const entryOutcome = this.actionEntry(options.tenantId, options.actionId);
    if (!entryOutcome.ok) {
      return entryOutcome;
    }
    const entry = entryOutcome.value;
    const actorProblem = this.actorProblem(options.decidedBy.id);
    if (actorProblem !== null) {
      return {
        ok: false,
        error: gatewayValidationError([{ path: '$.decidedBy.id', message: actorProblem }]),
      };
    }
    const rejection = this.registry.recordRejection({
      tenantId: options.tenantId,
      decisionDigest: entry.decisionDigest,
      proposalRef: entry.proposalRef,
      decidedBy: options.decidedBy,
      asRole: options.asRole,
      reason: options.note ?? 'Rejected by a human approver.',
      at: options.at,
    });
    if (!rejection.ok) {
      return rejection;
    }
    const rejectedEvent = this.emitEvent({
      streamId: entry.streamId,
      tenantId: entry.tenantId,
      actor: options.decidedBy.id,
      proposalRef: entry.proposalRef,
      actionType: entry.actionType,
      phase: 'rejected',
      detail: rejectionEventDetail(
        { contentDigest: entry.decisionDigest, policySetDigest: '', outcome: 'requires-approval' },
        'human-rejection',
      ),
      occurredAt: options.at,
    });
    if (!rejectedEvent.ok) {
      return rejectedEvent;
    }
    const updated: ActionEntry = { ...entry, status: 'rejected', updatedAt: options.at };
    this.actions.set(actionKey(entry.tenantId, entry.actionId), updated);
    return { ok: true, value: { action: updated, rejection: rejection.value, events: [rejectedEvent.value] } };
  }

  /**
   * Sweep the pending approval deadlines (caller-supplied instant): each
   * expiry settles the action `approval-expired` and the stream records
   * the `rejected` fact with the `approval-timeout` detail. Idempotent.
   */
  expireApprovals(at: Timestamp): GatewayResult<readonly ExpiredApproval[]> {
    const expired: ExpiredApproval[] = [];
    for (const expiry of this.registry.expireApprovals(at)) {
      const entry = [...this.actions.values()].find(
        (candidate) =>
          candidate.decisionDigest === expiry.decisionDigest &&
          candidate.status === 'awaiting-approval',
      );
      if (entry === undefined) {
        continue;
      }
      const event = this.emitEvent({
        streamId: entry.streamId,
        tenantId: entry.tenantId,
        actor: GATEWAY_ACTOR,
        proposalRef: entry.proposalRef,
        actionType: entry.actionType,
        phase: 'rejected',
        detail: rejectionEventDetail(
          { contentDigest: entry.decisionDigest, policySetDigest: '', outcome: 'requires-approval' },
          'approval-timeout',
        ),
        occurredAt: at,
      });
      if (!event.ok) {
        return event;
      }
      const updated: ActionEntry = { ...entry, status: 'approval-expired', updatedAt: at };
      this.actions.set(actionKey(entry.tenantId, entry.actionId), updated);
      expired.push({ action: updated, expiry, event: event.value });
    }
    return {
      ok: true,
      value: expired.sort((a, b) => (a.action.actionId < b.action.actionId ? -1 : 1)),
    };
  }

  // --------------------------------------------------------------------------------
  // Execution dispatch: the adapter seam + outcome recording.
  // --------------------------------------------------------------------------------

  /**
   * Execute one authorized action: the W009 authorization context rides
   * every execution; drift from the in-force proposal revision is the
   * typed `proposal-drift-rejected`; the dispatch goes through the
   * ActionExecutionPort seam and the gateway RECORDS the record-shaped
   * outcome (typed success/failure with evidence references) — it never
   * implements the effect.
   */
  executeAction(options: ExecuteActionOptions): GatewayResult<ExecutionOutcome> {
    const entryOutcome = this.actionEntry(options.tenantId, options.actionId);
    if (!entryOutcome.ok) {
      return entryOutcome;
    }
    const entry = entryOutcome.value;
    switch (entry.status) {
      case 'awaiting-approval':
        return {
          ok: false,
          error: {
            code: 'approval-required',
            message: `action "${entry.actionId}" awaits its approval quorum — execution is not authorized yet`,
            actionId: entry.actionId,
            decisionDigest: entry.decisionDigest,
          },
        };
      case 'approval-expired':
        return {
          ok: false,
          error: {
            code: 'approval-timeout',
            message: `action "${entry.actionId}" expired awaiting approval — the approval deadline passed with the quorum unmet`,
            actionId: entry.actionId,
            decisionDigest: entry.decisionDigest,
            deadline: this.deadlineOf(entry),
          },
        };
      case 'denied':
        return {
          ok: false,
          error: {
            code: 'action-denied',
            message: `action "${entry.actionId}" was denied by policy — it never executes`,
            actionId: entry.actionId,
            denialCode: this.denialCodeOf(entry),
            decisionDigest: entry.decisionDigest,
          },
        };
      case 'rejected':
        return {
          ok: false,
          error: {
            code: 'action-rejected',
            message: `action "${entry.actionId}" was rejected by a human approver — it never executes`,
            actionId: entry.actionId,
            decisionDigest: entry.decisionDigest,
          },
        };
      case 'executed':
      case 'failed':
        return {
          ok: false,
          error: {
            code: 'action-settled',
            message: `action "${entry.actionId}" is already ${entry.status} — a dispatched action never re-dispatches`,
            actionId: entry.actionId,
            status: entry.status,
          },
        };
      case 'authorized':
        break;
      default: {
        const exhaustive: never = entry.status;
        throw new Error(`unhandled action status: ${String(exhaustive)}`);
      }
    }
    // Drift: execution authorizes EXACTLY the in-force proposal revision.
    if (
      options.expectedProposalDigest !== undefined &&
      options.expectedProposalDigest !== entry.proposalRef.canonicalDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'proposal-drift-rejected',
          message: `execution references proposal revision ${options.expectedProposalDigest} but the action runs under ${entry.proposalRef.canonicalDigest} — execution authorizes exactly the referenced revision`,
          decisionDigest: entry.decisionDigest,
          expectedProposalDigest: entry.proposalRef.canonicalDigest,
          encounteredProposalDigest: options.expectedProposalDigest,
        },
      };
    }
    // The W009 authorization context rides EVERY execution.
    const gate = this.authorizationGate(options, entry.proposal, entry.actionId);
    if (!gate.ok) {
      return gate;
    }

    const decisionOutcome = this.registry.getDecision(entry.decisionDigest);
    if (!decisionOutcome.ok) {
      return decisionOutcome;
    }
    const dispatch = this.executionPort.execute({
      tenantId: entry.tenantId,
      actionId: entry.actionId,
      proposal: entry.proposal,
      decision: decisionOutcome.value,
      executedAt: options.at,
    });
    if (!dispatch.ok) {
      return {
        ok: false,
        error: {
          code: 'execution-unsupported',
          message: dispatch.error.message,
          actionTypeId: dispatch.error.actionTypeId,
          actionId: entry.actionId,
        },
      };
    }
    const effect = dispatch.effect;
    const evidenceRefs = mergeEvidenceRefs(options.evidenceRefs, effect.evidenceRefs);
    const sealedOutcome = sealActionOutcome({
      schemaVersion: GATEWAY_RECORD_VERSION,
      tenantId: entry.tenantId,
      actionId: entry.actionId,
      proposalRef: entry.proposalRef,
      decisionDigest: entry.decisionDigest,
      kind: effect.kind,
      ...(effect.kind === 'failed'
        ? { failure: { code: effect.failureCode, reason: effect.reason } }
        : {}),
      evidenceRefs,
      executedAt: options.at,
    });
    if (!sealedOutcome.ok) {
      return sealedOutcome;
    }
    const outcome = sealedOutcome.value;

    const events: SealedActionEvent[] = [];
    if (outcome.kind === 'succeeded') {
      const executedEvent = this.emitEvent({
        streamId: entry.streamId,
        tenantId: entry.tenantId,
        actor: gate.value.principalId,
        proposalRef: entry.proposalRef,
        actionType: entry.actionType,
        phase: 'executed',
        detail: outcomeEventDetail(outcome),
        occurredAt: options.at,
      });
      if (!executedEvent.ok) {
        return executedEvent;
      }
      const effectsEvent = this.emitEvent({
        streamId: entry.streamId,
        tenantId: entry.tenantId,
        actor: gate.value.principalId,
        proposalRef: entry.proposalRef,
        actionType: entry.actionType,
        phase: 'effects-recorded',
        detail: outcomeEventDetail(outcome),
        occurredAt: options.at,
      });
      if (!effectsEvent.ok) {
        return effectsEvent;
      }
      events.push(executedEvent.value, effectsEvent.value);
    } else {
      const failedEvent = this.emitEvent({
        streamId: entry.streamId,
        tenantId: entry.tenantId,
        actor: gate.value.principalId,
        proposalRef: entry.proposalRef,
        actionType: entry.actionType,
        phase: 'failed',
        detail: outcomeEventDetail(outcome),
        occurredAt: options.at,
      });
      if (!failedEvent.ok) {
        return failedEvent;
      }
      events.push(failedEvent.value);
    }

    const updated: ActionEntry = {
      ...entry,
      status: outcome.kind === 'succeeded' ? 'executed' : 'failed',
      outcome,
      updatedAt: options.at,
    };
    this.actions.set(actionKey(entry.tenantId, entry.actionId), updated);
    return { ok: true, value: { action: updated, outcome, events } };
  }

  // --------------------------------------------------------------------------------
  // Reads, health, snapshots.
  // --------------------------------------------------------------------------------

  /** One hosted action (tenant-scoped read; cross-tenant access is denied). */
  getAction(options: ActionReadOptions): GatewayResult<ActionEntry> {
    const entryOutcome = this.actionEntry(options.tenantId, options.actionId);
    if (!entryOutcome.ok) {
      return entryOutcome;
    }
    return { ok: true, value: entryOutcome.value };
  }

  /** The action's full ordered event stream (the W010-shaped audit trail). */
  actionStream(options: ActionReadOptions): GatewayResult<readonly SealedActionEvent[]> {
    const entryOutcome = this.actionEntry(options.tenantId, options.actionId);
    if (!entryOutcome.ok) {
      return entryOutcome;
    }
    return { ok: true, value: [...(this.streams.get(entryOutcome.value.streamId) ?? [])] };
  }

  /** The tenant's actions, sorted by actionId (deterministic). */
  listActions(options: ListActionsOptions): GatewayResult<readonly ActionEntry[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return guard;
    }
    return {
      ok: true,
      value: [...this.actions.values()]
        .filter((entry) => entry.tenantId === options.tenantId)
        .sort((a, b) => (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0)),
    };
  }

  /**
   * Health/liveness as typed data (deterministic derivation, no clocks):
   * `degraded` exactly when at least one hosted action settled `failed`.
   */
  health(): GatewayHealth {
    const byStatus: Record<ActionStatus, number> = {
      'awaiting-approval': 0,
      authorized: 0,
      denied: 0,
      rejected: 0,
      'approval-expired': 0,
      executed: 0,
      failed: 0,
    };
    let undispatched = 0;
    const degraded: string[] = [];
    for (const [key, entry] of this.actions.entries()) {
      byStatus[entry.status] += 1;
      if (entry.status === 'awaiting-approval' || entry.status === 'authorized') {
        undispatched += 1;
      }
      if (entry.status === 'failed') {
        degraded.push(key);
      }
    }
    degraded.sort();
    return {
      schemaVersion: GATEWAY_RECORD_VERSION,
      status: degraded.length === 0 ? 'healthy' : 'degraded',
      actionCount: this.actions.size,
      actionsByStatus: byStatus,
      undispatchedActionCount: undispatched,
      degradedActions: degraded,
    };
  }

  /** A deterministic whole-host snapshot (registry + actions + events, sorted). */
  snapshot(): GatewaySnapshot {
    // Entries normalize through the host schema so live-built and restored
    // snapshots serialize byte-identically (canonical key order).
    const actions = [...this.actions.values()]
      .sort((a, b) =>
        a.tenantId === b.tenantId
          ? a.actionId < b.actionId
            ? -1
            : 1
          : a.tenantId < b.tenantId
            ? -1
            : 1,
      )
      .map((entry) => ActionEntrySchema.parse(this.actions.get(actionKey(entry.tenantId, entry.actionId))!));
    const events = [...this.streams.values()]
      .flat()
      .sort((a, b) =>
        a.streamId === b.streamId
          ? a.sequence - b.sequence
          : a.streamId < b.streamId
            ? -1
            : 1,
      );
    return {
      schemaVersion: GATEWAY_RECORD_VERSION,
      registry: this.registry.snapshot(),
      actions,
      events,
    };
  }

  /**
   * Restore a gateway from a snapshot. Total; the embedded registry
   * restores through the kernel's tamper-checked path, every action entry
   * re-validates through the host schema (including the proposal/decision
   * referential integrity and the derived stream id), and every event
   * re-verifies through the digest discipline with per-stream sequence
   * contiguity checks.
   */
  static fromSnapshot(input: unknown, options: ActionGatewayOptions = {}): GatewayResult<ActionGateway> {
    const parsed = parseGatewaySnapshot(input);
    if (!parsed.ok) {
      return parsed;
    }
    const snapshot = parsed.value;
    const registry = ActionPolicyRegistry.fromSnapshot(snapshot.registry, {
      expectedTenantId: options.expectedTenantId,
    });
    if (!registry.ok) {
      return registry;
    }
    const gateway = new ActionGateway(options);
    gateway.registry = registry.value;

    for (const [index, candidate] of snapshot.actions.entries()) {
      const entryOutcome = parseActionEntry(candidate, `$.actions[${index}]`);
      if (!entryOutcome.ok) {
        return entryOutcome;
      }
      const entry = entryOutcome.value;
      // Referential integrity: the in-force decision exists and concerns
      // the same proposal revision; the embedded proposal digests to the
      // claimed reference (host-level tamper detection).
      const decisionOutcome = registry.value.getDecision(entry.decisionDigest);
      if (
        !decisionOutcome.ok ||
        decisionOutcome.value.proposalRef.proposalId !== entry.proposalRef.proposalId ||
        decisionOutcome.value.proposalRef.canonicalDigest !== entry.proposalRef.canonicalDigest
      ) {
        return {
          ok: false,
          error: gatewayValidationError([
            {
              path: `$.actions[${index}].decisionDigest`,
              message: 'the referenced decision does not exist or concerns a different proposal revision',
            },
          ]),
        };
      }
      const canonicalProposal = parseActionProposal(entry.proposal);
      if (!canonicalProposal.ok || canonicalProposal.digest !== entry.proposalRef.canonicalDigest) {
        return {
          ok: false,
          error: gatewayValidationError([
            {
              path: `$.actions[${index}].proposal`,
              message: 'the embedded proposal does not digest to the claimed proposal reference',
            },
          ]),
        };
      }
      if (entry.outcome !== undefined) {
        const verified = verifySealedActionOutcome(entry.outcome);
        if (!verified.ok) {
          return verified;
        }
      }
      // Entry-status consistency with the restored registry: a dispatched
      // entry carries its outcome; an undispatched entry's status must
      // match the decision outcome + the live approval-request state.
      const request = registry.value.approvalRequest(entry.decisionDigest);
      const expectedStatus =
        entry.outcome !== undefined
          ? entry.outcome.kind === 'succeeded'
            ? 'executed'
            : 'failed'
          : statusFromRegistry(
              decisionOutcome.value,
              request.ok ? request.value : undefined,
            );
      if (entry.status !== expectedStatus) {
        return {
          ok: false,
          error: gatewayValidationError([
            {
              path: `$.actions[${index}].status`,
              message: `the entry status "${entry.status}" is inconsistent with the registry state ("${expectedStatus}")`,
            },
          ]),
        };
      }
      gateway.actions.set(actionKey(entry.tenantId, entry.actionId), entry);
    }

    for (const candidate of snapshot.events) {
      const verified = verifySealedActionEvent(candidate);
      if (!verified.ok) {
        return verified;
      }
      const event = verified.value;
      const stream = gateway.streams.get(event.streamId) ?? [];
      if (event.sequence !== stream.length + 1) {
        return {
          ok: false,
          error: gatewayValidationError([
            {
              path: '$.events',
              message: `stream ${event.streamId} is not contiguous at sequence ${event.sequence}`,
            },
          ]),
        };
      }
      gateway.streams.set(event.streamId, [...stream, event]);
    }

    // Every stream belongs to exactly one action entry of the same tenant.
    for (const [streamId, events] of gateway.streams.entries()) {
      const owner = [...gateway.actions.values()].find((entry) => entry.streamId === streamId);
      if (owner === undefined || owner.tenantId !== events[0]!.tenantId) {
        return {
          ok: false,
          error: gatewayValidationError([
            {
              path: '$.events',
              message: `stream ${streamId} does not belong to a hosted action of the same tenant`,
            },
          ]),
        };
      }
    }

    return { ok: true, value: gateway };
  }

  // --------------------------------------------------------------------------------
  // Internals.
  // --------------------------------------------------------------------------------

  /** The tenant guard (R12): rejects foreign tenants on a pinned host. */
  private tenantGuard(tenantId: string): GatewayResult<never> | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this action-gateway host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    return null;
  }

  /** Fetch an action entry with the tenant + existence gates. */
  private actionEntry(tenantId: string, actionId: string): GatewayResult<ActionEntry> {
    const guard = this.tenantGuard(tenantId);
    if (guard !== null) {
      return guard;
    }
    const entry = this.actions.get(actionKey(tenantId, actionId));
    if (entry !== undefined) {
      return { ok: true, value: entry };
    }
    const foreign = [...this.actions.values()].find((candidate) => candidate.actionId === actionId);
    if (foreign !== undefined) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `action "${actionId}" belongs to tenant "${foreign.tenantId}" — tenant "${tenantId}" cannot access it (R12 tenant isolation)`,
          expectedTenantId: tenantId,
          encounteredTenantId: foreign.tenantId,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'unknown-action',
        message: `no action "${actionId}" is hosted for tenant "${tenantId}"`,
        tenantId,
        actionId,
      },
    };
  }

  /**
   * The W009 authorization gate: the caller-supplied decision context is
   * parsed through the REAL W009 total parse surface, the request projects
   * the action (actionKind = the action type id; resource = the proposal
   * target in the action's tenancy scope), and the decision point runs.
   * Denials and not-applicables are the typed `authorization-rejected`
   * (fail-closed) — NEVER an implicit allow.
   */
  private authorizationGate(
    options: { tenantId: string; scope?: ActionScope | undefined; authorization: AuthorizationGateInput },
    proposal: ActionProposal,
    actionId?: string,
  ): GatewayResult<{ principalId: string }> {
    const principal = PrincipalIdSchema.safeParse(options.authorization.principalId);
    if (!principal.success) {
      return {
        ok: false,
        error: gatewayValidationError(
          principal.error.issues.map((issue) => ({
            path:
              issue.path.length === 0
                ? '$.authorization.principalId'
                : `$.authorization.principalId.${issue.path.map(String).join('.')}`,
            message: issue.message,
          })),
        ),
      };
    }
    const context = parseAuthorizationContext(options.authorization.context);
    if (!context.ok) {
      if (context.error.code === 'validation') {
        return {
          ok: false,
          error: gatewayValidationError(
            context.error.issues.map((issue) => ({
              path: issue.path === '' ? '$.authorization.context' : `$.authorization.context.${issue.path}`,
              message: issue.message,
            })),
          ),
        };
      }
      return { ok: false, error: context.error };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: principal.data,
      actionKind: proposal.actionType.id,
      resource: {
        resourceType: proposal.target.kind,
        resourceId: proposal.target.ref,
        tenantId: options.tenantId,
        ...(options.scope?.workspaceId !== undefined ? { workspaceId: options.scope.workspaceId } : {}),
        ...(options.scope?.projectId !== undefined ? { projectId: options.scope.projectId } : {}),
      },
      ...(options.authorization.justification !== undefined
        ? { justification: options.authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      if (decision.error.code === 'validation') {
        return {
          ok: false,
          error: gatewayValidationError(
            decision.error.issues.map((issue) => ({
              path: issue.path === '' ? '$.authorization' : `$.authorization.${issue.path}`,
              message: issue.message,
            })),
          ),
        };
      }
      return { ok: false, error: decision.error };
    }
    const value = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${principal.data}" is not authorized (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: principal.data,
          ...(actionId !== undefined ? { actionId } : {}),
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `the authorization decision point is not applicable to this request (${value.reason}) — intake is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: principal.data,
          ...(actionId !== undefined ? { actionId } : {}),
        },
      };
    }
    return { ok: true, value: { principalId: principal.data } };
  }

  /** Emit one sealed event onto an action stream (sequence + causal link derived). */
  private emitEvent(request: EmitEventRequest): GatewayResult<SealedActionEvent> {
    const stream = this.streams.get(request.streamId) ?? [];
    const sequence = stream.length + 1;
    const causalParent =
      stream.length === 0
        ? null
        : { streamId: request.streamId, sequence: stream[stream.length - 1]!.sequence };
    const sealed = sealActionEvent({
      schemaVersion: GATEWAY_RECORD_VERSION,
      streamId: request.streamId,
      sequence,
      tenantId: request.tenantId,
      actor: request.actor,
      causalParent,
      payload: {
        discriminator: 'action:lifecycle',
        data: {
          action: request.proposalRef,
          actionType: request.actionType,
          phase: request.phase,
          ...(Object.keys(request.detail).length > 0 ? { detail: request.detail } : {}),
        },
      },
      occurredAt: request.occurredAt,
    });
    if (!sealed.ok) {
      return sealed;
    }
    this.streams.set(request.streamId, [...stream, sealed.value]);
    return sealed;
  }

  /** The action-status derivation from a decision + the live request state. */
  private deriveStatus(decision: SealedPolicyDecision): ActionStatus {
    const request = this.registry.approvalRequest(decision.contentDigest);
    return statusFromRegistry(decision, request.ok ? request.value : undefined);
  }

  /** The actor-grammar check for approver ids (events carry principal actors). */
  private actorProblem(approverId: string): string | null {
    return ACTION_EVENT_ACTOR_PATTERN.test(approverId)
      ? null
      : `approver ids must match ${ACTION_EVENT_ACTOR_PATTERN.toString()} (events carry principal actors)`;
  }

  /** The deadline of the in-force approval request (reads, typed errors). */
  private deadlineOf(entry: ActionEntry): Timestamp {
    const request = this.registry.approvalRequest(entry.decisionDigest);
    return request.ok ? request.value.directive.deadline : entry.updatedAt;
  }

  /** The denial code of the in-force decision (reads, typed errors). */
  private denialCodeOf(entry: ActionEntry): string {
    const decision = this.registry.getDecision(entry.decisionDigest);
    return decision.ok && decision.value.denial !== undefined
      ? decision.value.denial.code
      : 'unknown';
  }
}
