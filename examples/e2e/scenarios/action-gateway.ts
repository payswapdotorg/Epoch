// W031 Reference E2E slice 4 — the ACTION GATEWAY scenario definition.
//
// The action path: a typed action proposal from an agent-runtime work
// item, decided by the REAL W022 policy kernel, executed only through the
// authority seam, and recorded as execution events:
//
//   W029 GithubAdapterHost (fixture snapshot ingested, tenant-gated)
//     -> W029 buildChangeProposal (a REAL W003 proposal — round-tripped
//        through parseActionProposal, content-addressed)
//     -> W020 agent-orchestration: a capability-scoped agent binding (the
//        adapter's OWN declared capabilities), an authored plan whose
//        step IS the work item referencing the exact proposal revision,
//        deterministic compilation, a running session, and the proposal
//        handoff toward the W022 boundary (the kernel's published
//        handoff contract, digested + parsed)
//     -> W022 @epoch/action-policy: the REAL ActionPolicyRegistry decides
//        (requires-approval -> human approval -> authorized), with the
//        full decision vocabulary exercised across sibling proposals:
//        allow / deny (no-applicable-policy, proposal-expired,
//        constraint-blocked) / requires-approval
//     -> W029 routeChange through the authority port (the adapter's only
//        execution path): decision -> outcome record -> disposition
//        'executed'
//     -> W038 execution event (the realized tracking record) + W010
//        action:lifecycle events (proposed -> authorized -> executed,
//        each carrying the EXACT proposal reference)
//
// NEGATIVE PATH (the Work Order's named assertion): an envelope asking
// the adapter to `mode: "execute-direct"` is the typed
// `gateway-bypass-rejected` — the authority port is NEVER CALLED (the
// test pins this with a throwing port).
//
// DEPENDENCY NOTE (documented deviation, see docs/e2e/README.md): the
// W022 decision vocabulary requires at least one SATISFIED compiled ECL
// constraint (the W004 composite is fail-closed; an empty composition is
// `not-applicable` -> deny). Compilation is @epoch/policy-contracts'
// authority — an existing workspace package, a runtime dependency of
// @epoch/action-policy itself. It is declared here as ONE additional
// devDependency beyond the Work Order's frozen enumeration; without it,
// slice 4's mandated positive path (decision -> outcome record ->
// execution event) is unreachable.
import {
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  GithubActionAdapter,
  GithubAdapterHost,
  buildChangeProposal,
  deriveCapabilityRegistrations,
  parseProviderSnapshot,
  projectSnapshot,
  referenceSnapshot,
  snapshotDigestOf,
  type ActionAuthorityExecutionRequest,
  type ActionAuthorityPort,
  type ActionAuthoritySubmission,
  type AuthorityDecisionRecord,
  type AuthorityOutcomeRecord,
  type ChangeDispatchRecord,
  type ChangeProposalPlan,
} from '@epoch/adapter-github';
import {
  compilePlan,
  computeAgentBindingDigest,
  computeProposalHandoffDigest,
  createSessionRecord,
  parseAgentBinding,
  parseProposalHandoff,
  transitionSessionStatus,
  type AgentBinding,
  type CompiledPlan,
  type OrchestrationSession,
  type ProposalHandoff,
} from '@epoch/agent-orchestration';
import { parseActionProposal, type ActionProposal, type ProposalReference } from '@epoch/action-protocol';
import {
  ActionPolicyRegistry,
  type ApprovalRequestState,
  type SealedPolicyDecision,
} from '@epoch/action-policy';
import { compileConstraint, type CompiledConstraint, type ConstraintResolver } from '@epoch/policy-contracts';
import {
  admitSolutionVersion,
  approveSolutionBaseline,
  buildProgramOfWork,
  sealSolutionVersion,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  admitTrackingState,
  buildProgramIndex,
  openExecutionTrackingStore,
  sealExecutionEvent,
  sealTrackingStateRecord,
  verifySealedExecutionEvent,
  type SealedExecutionEvent,
} from '@epoch/execution-tracking';
import {
  canonicalDigest,
  type JsonValue,
} from '@epoch/action-policy';
import { EventLog, parseActionLifecycleEventData, sealEvent, type EventContent, type EventRecord } from '@epoch/event-log';
import { APPROVER, PLATFORM_ENGINEER, PRINCIPAL, T, TENANT, uncertainty } from './shared';

// --------------------------------------------------------------------------------
// Scenario vocabulary.
// --------------------------------------------------------------------------------

export const ACTION_WORKSPACE_ID = 'sw:epoch-reference-app';
export const ACTION_TENANT = TENANT;
export const ACTION_ID = 'action:workspace-change-1';
export const ACTION_STREAM_ID = 'stream:action-workspace-change-1';
export const ACTION_EXECUTION_STREAM_ID = 'stream:action-workspace-change-realization';
export const ORCHESTRATION_AGENT_ID = 'agent:software-workspace-adapter';
export const SESSION_ID = 'session:workspace-change-1';
export const PLAN_ID = 'plan:workspace-change-1';
export const APPROVER_ID = 'principal:workspace-lead';
export const WORKSPACE_ENGINEER = 'principal:workspace-engineer';
export const APPROVAL_DEADLINE = T[12];

export const INTEGRATION_SOLUTION_ID = 'solution:workspace-integration';
export const INTEGRATION_PROGRAM_ID = 'program:workspace-integration-v1';
export const INTEGRATION_WORK_PACKAGE = 'work-package:workspace-integration';
export const INTEGRATION_ACTIVITY = 'activity:apply-workspace-change';

/** Unwrap helper: scenario builders fail LOUDLY on impossible admissions. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`action-gateway scenario: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// --------------------------------------------------------------------------------
// The W022 authority port: the REAL ActionPolicyRegistry behind the W029
// adapter's ActionAuthorityPort seam (the production implementation is
// the Action Gateway service; this port composes the same W022 KERNEL —
// every decision, approval and chain verification below is the kernel's).
// --------------------------------------------------------------------------------

export interface AuthorityPortOptions {
  readonly policies: readonly unknown[];
  readonly resolveConstraint: ConstraintResolver;
  readonly evaluationContext?: unknown;
}

export class PolicyRegistryAuthorityPort implements ActionAuthorityPort {
  private readonly registry = new ActionPolicyRegistry();
  private readonly options: AuthorityPortOptions;
  /** actionId -> the in-force decision (the port's dispatch state). */
  private readonly decisions = new Map<string, SealedPolicyDecision>();
  /** How many times the authority was called (bypass evidence). */
  calls = 0;

  constructor(options: AuthorityPortOptions) {
    this.options = options;
  }

  /** The underlying REAL registry (for chain verification in tests). */
  get policyRegistry(): ActionPolicyRegistry {
    return this.registry;
  }

  private actionStatusOf(decision: SealedPolicyDecision): string {
    if (decision.outcome === 'deny') return 'denied';
    if (decision.outcome === 'allow') return 'authorized';
    const request = this.registry.approvalRequest(decision.contentDigest);
    return request.ok && request.value.status === 'approved' ? 'authorized' : 'awaiting-approval';
  }

  private mirror(decision: SealedPolicyDecision): AuthorityDecisionRecord {
    return {
      schemaVersion: 1,
      tenantId: decision.tenantId,
      actionId: decision.tenantId === ACTION_TENANT ? this.actionIdOf(decision) : decision.proposalRef.proposalId,
      outcome: decision.outcome,
      decisionDigest: decision.contentDigest,
      ...(decision.denial !== undefined
        ? { denialCode: decision.denial.code, denialReason: decision.denial.reason }
        : {}),
      actionStatus: this.actionStatusOf(decision),
      decidedAt: decision.decidedAt,
    };
  }

  private actionIdOf(decision: SealedPolicyDecision): string {
    for (const [actionId, candidate] of this.decisions.entries()) {
      if (candidate.contentDigest === decision.contentDigest) return actionId;
    }
    return decision.proposalRef.proposalId;
  }

  submitAction(request: ActionAuthoritySubmission) {
    this.calls += 1;
    const decision = this.registry.recordDecision({
      tenantId: request.tenantId,
      proposal: request.proposal,
      policies: this.options.policies,
      resolveConstraint: this.options.resolveConstraint,
      evaluationContext: this.options.evaluationContext,
      decidedAt: request.decidedAt,
      ...(request.approval !== undefined ? { approval: request.approval } : {}),
    });
    if (decision.ok) {
      this.decisions.set(request.actionId, decision.value);
      return { ok: true as const, decision: this.mirror(decision.value) };
    }
    if (decision.error.code === 'duplicate-decision') {
      // Idempotent replay: the EXISTING sealed decision stands.
      const existing = (decision.error as { existingDecision: SealedPolicyDecision }).existingDecision;
      this.decisions.set(request.actionId, existing);
      return { ok: true as const, decision: this.mirror(existing) };
    }
    return { ok: false as const, error: { code: decision.error.code, message: decision.error.message } };
  }

  executeAction(request: ActionAuthorityExecutionRequest) {
    this.calls += 1;
    const decision = this.decisions.get(request.actionId);
    if (decision === undefined) {
      return {
        ok: false as const,
        error: { code: 'unknown-action', message: `no decision is recorded for action "${request.actionId}"` },
      };
    }
    const authorized =
      decision.outcome === 'allow' ||
      (() => {
        const request_ = this.registry.approvalRequest(decision.contentDigest);
        return request_.ok && request_.value.status === 'approved';
      })();
    if (!authorized) {
      return {
        ok: false as const,
        error: {
          code: 'approval-required',
          message: `decision ${decision.contentDigest.slice(0, 8)}… is not authorized for execution`,
        },
      };
    }
    const content = {
      schemaVersion: 1 as const,
      tenantId: request.tenantId,
      actionId: request.actionId,
      kind: 'succeeded' as const,
      evidenceRefs: [...(request.evidenceRefs ?? [])].sort(),
      executedAt: request.at,
    };
    const outcome: AuthorityOutcomeRecord = {
      ...content,
      outcomeDigest: canonicalDigest(content as unknown as JsonValue),
    };
    return { ok: true as const, outcome };
  }
}

/** The throwing port: ANY call fails the test (bypass evidence). */
export const NEVER_CALLED_PORT: ActionAuthorityPort = {
  submitAction(request: ActionAuthoritySubmission) {
    void request;
    throw new Error('the authority must never be called in the bypass path');
  },
  executeAction(request: ActionAuthorityExecutionRequest) {
    void request;
    throw new Error('the authority must never be called in the bypass path');
  },
};

// --------------------------------------------------------------------------------
// The scenario result.
// --------------------------------------------------------------------------------

export interface ActionGatewayScenario {
  /** The W029 ingestion record's snapshot digest. */
  readonly snapshotDigest: string;
  /** The W029-built change proposal plan (the REAL W003 proposal). */
  readonly plan: ChangeProposalPlan;
  /** The proposal's exact revision reference (digest-pinned). */
  readonly proposalRef: ProposalReference;
  /** The W020 compiled plan (the work item's schedule). */
  readonly compiledPlan: CompiledPlan;
  /** The W020 orchestration session (running). */
  readonly session: OrchestrationSession;
  /** The W020 proposal handoff toward the W022 boundary. */
  readonly handoff: ProposalHandoff;
  /** The authority port (over the REAL W022 registry). */
  readonly authority: PolicyRegistryAuthorityPort;
  /** The first routing: requires-approval (pending). */
  readonly pendingDispatch: ChangeDispatchRecord;
  /** The approval request state after the human approval. */
  readonly approvalRequest: ApprovalRequestState;
  /** The second routing: executed, with the authority's outcome record. */
  readonly executedDispatch: ChangeDispatchRecord;
  /** The allow-vocabulary decision (a sibling proposal, no human approval). */
  readonly allowDecision: SealedPolicyDecision;
  /** The allow path's decision mirror + outcome (through the authority port). */
  readonly allowExecution: { readonly decision: AuthorityDecisionRecord; readonly outcome: AuthorityOutcomeRecord };
  /** The no-applicable-policy denial (empty policy set, fail-closed). */
  readonly noPolicyDenial: SealedPolicyDecision;
  /** The proposal-expired denial. */
  readonly expiredDenial: SealedPolicyDecision;
  /** The constraint-blocked denial (violated hard constraint). */
  readonly blockedDenial: SealedPolicyDecision;
  /** The W038 execution event (the realized tracking record). */
  readonly executionEvent: SealedExecutionEvent;
  /** The W010 action:lifecycle event records (proposed/authorized/executed). */
  readonly actionEvents: readonly EventRecord[];
  /** The action event log. */
  readonly log: EventLog;
  /** The integration solution (the W038 subject). */
  readonly integrationSolution: SealedSolutionVersion;
  /** The integration program. */
  readonly integrationProgram: SealedProgramOfWork;
}

// --------------------------------------------------------------------------------
// Content builders.
// --------------------------------------------------------------------------------

/** The tenant-scoped policy set applying the change budget to the adapter's action kinds. */
export function applicablePolicySet(): unknown[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'tenant-change-budget-policy',
      version: '1.0.0',
      name: 'Tenant change budget policy',
      enabled: true,
      applicability: {
        tenantId: ACTION_TENANT,
        actionKinds: ['software.change.propose', 'software.integration.propose'],
      },
      bindings: [{ constraintId: 'change-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
}

/** Compile the change-budget hard constraint (violated iff changeCount >= 10). */
export function compiledChangeBudget(): CompiledConstraint {
  const outcome = compileConstraint({
    languageVersion: '1.0.0',
    id: 'change-budget',
    version: '1.0.0',
    inputs: [{ name: 'changeCount', type: 'number' }],
    class: 'hard',
    predicate: {
      node: 'lt',
      left: { node: 'input', name: 'changeCount' },
      right: { node: 'lit', type: 'number', value: 10 },
    },
  });
  if (!outcome.ok) {
    throw new Error(`action-gateway scenario: change-budget failed to compile: ${JSON.stringify(outcome.errors)}`);
  }
  return outcome.compiled;
}

/** The resolver over the compiled constraint. */
export function changeBudgetResolver(): ConstraintResolver {
  const compiled = compiledChangeBudget();
  return (binding: { constraintId: string }) => (binding.constraintId === 'change-budget' ? compiled : undefined);
}

function integrationSolutionContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    solutionId: INTEGRATION_SOLUTION_ID,
    version: '1.0.0',
    tenantId: ACTION_TENANT,
    title: 'Workspace integration',
    description: 'Applying authority-authorized changes to the hosted workspace',
    objective: 'Integrate authority-authorized workspace changes into the realization plan',
    solutionLines: [
      {
        lineId: 'line:workspace-changes',
        title: 'Workspace change applications',
        quantity: { value: '1', unit: 'sum' },
        unitCost: { amount: '0.00', currency: 'EUR' },
        acquisitionVariant: 'internal-allocation',
      },
    ],
    worldReferences: [],
    constraintReferences: [],
    previousVersionDigest: null,
    createdAt: T[0],
    createdBy: PRINCIPAL,
  };
}

function integrationProgramContent(sealed: SealedSolutionVersion): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.program-of-work',
    schemaVersion: 1,
    programId: INTEGRATION_PROGRAM_ID,
    tenantId: sealed.tenantId,
    solutionId: sealed.solutionId,
    solutionVersion: sealed.version,
    solutionVersionDigest: sealed.contentDigest,
    title: 'Workspace integration programme',
    workPackages: [
      {
        workPackageId: INTEGRATION_WORK_PACKAGE,
        title: 'Apply workspace changes',
        description: 'Apply authority-authorized changes to the hosted workspace',
        solutionLineId: 'line:workspace-changes',
        realizationVariant: 'software-implementation-deployment',
        plannedStart: T[10],
        plannedFinish: T[11],
        responsibleActor: PLATFORM_ENGINEER,
        resources: [],
        constraintReferences: [],
        approvals: [],
        verificationGates: [],
        activities: [
          {
            activityId: INTEGRATION_ACTIVITY,
            workPackageId: INTEGRATION_WORK_PACKAGE,
            title: 'Apply the authorized change',
            realizationVariant: 'software-implementation-deployment',
            plannedQuantity: { value: '1', unit: 'sum' },
            plannedCost: { amount: '0.00', currency: 'EUR' },
            plannedStart: T[10],
            plannedFinish: T[11],
            predecessors: [],
            successors: [],
            resources: [],
            responsibleActor: PLATFORM_ENGINEER,
            constraintReferences: [],
            blockers: [],
            evidence: [],
          },
        ],
      },
    ],
    milestones: [],
    createdAt: T[1],
    createdBy: PRINCIPAL,
  };
}

// --------------------------------------------------------------------------------
// The scenario runner.
// --------------------------------------------------------------------------------

export function runActionGatewayScenario(): ActionGatewayScenario {
  // -- W029: ingest the provider snapshot + the neutral projection.
  const host = new GithubAdapterHost({ expectedTenantId: ACTION_TENANT });
  const ingestion = need(
    host.ingestSnapshot({ tenantId: ACTION_TENANT, payload: referenceSnapshot(), ingestedAt: T[3] }),
    'ingest provider snapshot',
  );
  const parsedSnapshot = parseProviderSnapshot(referenceSnapshot());
  if (!parsedSnapshot.success) {
    throw new Error(`action-gateway scenario: reference snapshot failed to parse: ${parsedSnapshot.error.message}`);
  }
  const snapshot = parsedSnapshot.data;
  const projection = projectSnapshot({ tenantId: ACTION_TENANT, snapshot, observedAt: T[3] });
  const snapshotDigest = snapshotDigestOf(snapshot);
  if (ingestion.snapshotDigest !== snapshotDigest || projection.source.digest !== snapshotDigest) {
    throw new Error('action-gateway scenario: snapshot digest identity drifted across surfaces');
  }

  // -- W029: the deterministic W003 change proposal (REAL admission
  //    round-trip inside buildChangeProposal).
  const plan = buildChangeProposal({
    tenantId: ACTION_TENANT,
    workspaceId: ACTION_WORKSPACE_ID,
    changeKind: 'revision',
    actionId: ACTION_ID,
    summary: 'Apply the stabilized projection ordering to the hosted workspace',
    proposedAt: T[10],
  });
  const proposalRef = plan.proposalRef;

  // -- W020: the agent binding (the adapter's OWN declared capabilities),
  //    the authored plan (the work item), compilation, session, handoff.
  const bindingContent = {
    schemaVersion: 1 as const,
    agent: {
      schemaVersion: 1 as const,
      agentId: ORCHESTRATION_AGENT_ID,
      displayName: 'Hosted software-workspace adapter (reference)',
      capabilities: [{ capabilityId: 'software.change-routing', version: '1.0.0' }],
    },
    capabilities: [
      {
        capabilityId: 'software.change-routing',
        version: '1.0.0',
        category: 'action' as const,
        lifecycleAtBinding: 'registered' as const,
      },
    ],
  };
  const binding: AgentBinding = {
    ...bindingContent,
    bindingDigest: computeAgentBindingDigest(bindingContent as never),
  };
  need(parseAgentBinding(binding), 'parse agent binding');

  const authoredPlan = {
    schemaVersion: 1,
    tenantId: ACTION_TENANT,
    planId: PLAN_ID,
    displayName: 'Route the workspace change through the authority',
    createdBy: PRINCIPAL,
    steps: [
      {
        stepId: 'route-workspace-change',
        agentId: ORCHESTRATION_AGENT_ID,
        proposal: proposalRef,
        dependsOn: [],
      },
    ],
  };
  const compiledPlan = need(
    compilePlan({ plan: authoredPlan, proposals: [plan.proposal], agents: [binding] }),
    'compile orchestration plan',
  );
  const sessionCreated = need(
    createSessionRecord({ sessionId: SESSION_ID, plan: compiledPlan, agents: [binding], createdAt: T[10] }),
    'create orchestration session',
  );
  const session = need(
    transitionSessionStatus(sessionCreated, 'running', 'start', T[10]),
    'start orchestration session',
  );
  const step = compiledPlan.steps[0]!;
  const handoffContent = {
    schemaVersion: 1 as const,
    sessionId: SESSION_ID,
    tenantId: ACTION_TENANT,
    stepId: step.stepId,
    agentId: step.agentId,
    proposal: step.proposal,
    attempt: 1,
    handedOffAt: T[10],
  };
  const handoff: ProposalHandoff = {
    ...handoffContent,
    handoffDigest: computeProposalHandoffDigest(handoffContent as never),
  };
  need(parseProposalHandoff(handoff), 'parse proposal handoff');

  // -- W022 + W029: route the proposal through the authority seam.
  const authority = new PolicyRegistryAuthorityPort({
    policies: applicablePolicySet(),
    resolveConstraint: changeBudgetResolver(),
    evaluationContext: { inputs: { changeCount: 1 } },
  });
  const authorization = {
    principalId: WORKSPACE_ENGINEER,
    context: {
      schemaVersion: 1,
      principals: [{ principalId: WORKSPACE_ENGINEER, status: 'active', authenticated: true }],
      memberships: [{ principalId: WORKSPACE_ENGINEER, tenantId: ACTION_TENANT }],
      knownTenants: [ACTION_TENANT],
    },
    justification: 'routing the adapter-built change proposal through the authority seam',
  };

  // Routing 1: requires-approval (the adapter's reference pin — every
  // hosted software-workspace write requires human approval).
  const pendingDispatch = need(
    new GithubActionAdapter({ host, authority, expectedTenantId: ACTION_TENANT }).route({
      tenant: ACTION_TENANT,
      workspace: ACTION_WORKSPACE_ID,
      changeKind: 'revision',
      summary: 'Apply the stabilized projection ordering to the hosted workspace',
      actionId: ACTION_ID,
      authority: authorization,
      approval: { deadline: APPROVAL_DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T[10],
      executedAt: T[11],
    }),
    'route change (pending approval)',
  );

  // The human approval through the REAL registry (quorum role gate,
  // deadline gate, idempotency — all the kernel's).
  need(
    authority.policyRegistry.recordApproval({
      tenantId: ACTION_TENANT,
      decisionDigest: pendingDispatch.decision.decisionDigest,
      proposalRef,
      decidedBy: { id: APPROVER_ID, role: 'human-approver' },
      asRole: 'workspace-maintainer',
      at: T[10],
    }),
    'record human approval',
  );
  const approvalRequest = need(
    authority.policyRegistry.approvalRequest(pendingDispatch.decision.decisionDigest),
    'read approval request',
  );

  // Routing 2: the same proposal re-routed — the registry's idempotent
  // decision echo now carries the approval; the adapter dispatches.
  const executedDispatch = need(
    new GithubActionAdapter({ host, authority, expectedTenantId: ACTION_TENANT }).route({
      tenant: ACTION_TENANT,
      workspace: ACTION_WORKSPACE_ID,
      changeKind: 'revision',
      summary: 'Apply the stabilized projection ordering to the hosted workspace',
      actionId: ACTION_ID,
      authority: authorization,
      approval: { deadline: APPROVAL_DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T[10],
      executedAt: T[11],
    }),
    'route change (executed)',
  );

  // The ALLOW vocabulary: a sibling proposal that does NOT require human
  // approval, under the same satisfied policy — outcome 'allow', executed
  // through the authority port (the seam the adapter itself uses; the
  // adapter's own proposals ALWAYS require human approval — the reference
  // pin — so the allow path is exercised at the authority seam).
  const allowProposal: ActionProposal = {
    ...plan.proposal,
    proposalId: 'chg-workspace-allow',
    messageId: 'msg-workspace-allow',
    authorityRequirements: {
      requiredScopes: [...plan.proposal.authorityRequirements.requiredScopes],
      requiresHumanApproval: false,
    },
  };
  const allowAdmission = parseActionProposal(allowProposal);
  if (!allowAdmission.ok) {
    throw new Error(`action-gateway scenario: allow proposal failed admission: ${allowAdmission.error.message}`);
  }
  const allowDecision = need(
    authority.policyRegistry.recordDecision({
      tenantId: ACTION_TENANT,
      proposal: allowProposal,
      policies: applicablePolicySet(),
      resolveConstraint: changeBudgetResolver(),
      evaluationContext: { inputs: { changeCount: 1 } },
      decidedAt: T[10],
    }),
    'record allow decision',
  );
  if (allowDecision.outcome !== 'allow') {
    throw new Error(`action-gateway scenario: expected allow, encountered ${allowDecision.outcome}`);
  }
  const allowSubmission = authority.submitAction({
    tenantId: ACTION_TENANT,
    actionId: 'action:workspace-change-allow',
    proposal: allowProposal,
    authorization,
    decidedAt: T[10],
  });
  if (!allowSubmission.ok) {
    throw new Error(`action-gateway scenario: allow submission failed: ${allowSubmission.error.message}`);
  }
  const allowExecutionOutcome = authority.executeAction({
    tenantId: ACTION_TENANT,
    actionId: 'action:workspace-change-allow',
    authorization,
    evidenceRefs: [`proposal:${allowAdmission.digest}`],
    at: T[11],
  });
  if (!allowExecutionOutcome.ok) {
    throw new Error(`action-gateway scenario: allow execution failed: ${allowExecutionOutcome.error.message}`);
  }

  // The DENY vocabulary (three codes, all through the REAL kernel):
  //
  // 1. no-applicable-policy — the same proposal under an EMPTY policy set
  //    (the W004 composite is fail-closed: nothing applicable -> deny).
  const noPolicyDenial = need(
    authority.policyRegistry.recordDecision({
      tenantId: ACTION_TENANT,
      proposal: plan.proposal,
      policies: [],
      resolveConstraint: changeBudgetResolver(),
      decidedAt: T[10],
    }),
    'record no-applicable-policy denial',
  );
  //
  // 2. proposal-expired — an expired proposal is never executed.
  const expiredProposal: ActionProposal = {
    ...plan.proposal,
    proposalId: 'chg-workspace-expired',
    messageId: 'msg-workspace-expired',
    expiresAt: T[9],
  };
  need(parseActionProposal(expiredProposal), 'parse expired proposal');
  const expiredDenial = need(
    authority.policyRegistry.recordDecision({
      tenantId: ACTION_TENANT,
      proposal: expiredProposal,
      policies: applicablePolicySet(),
      resolveConstraint: changeBudgetResolver(),
      evaluationContext: { inputs: { changeCount: 1 } },
      decidedAt: T[10],
    }),
    'record proposal-expired denial',
  );
  //
  // 3. constraint-blocked — a violated hard constraint (changeCount 99).
  const blockedProposal: ActionProposal = {
    ...plan.proposal,
    proposalId: 'chg-workspace-blocked',
    messageId: 'msg-workspace-blocked',
  };
  need(parseActionProposal(blockedProposal), 'parse blocked proposal');
  const blockedDenial = need(
    authority.policyRegistry.recordDecision({
      tenantId: ACTION_TENANT,
      proposal: blockedProposal,
      policies: applicablePolicySet(),
      resolveConstraint: changeBudgetResolver(),
      evaluationContext: { inputs: { changeCount: 99 } },
      decidedAt: T[10],
    }),
    'record constraint-blocked denial',
  );

  // -- W036: the integration solution + program (the W038 subject).
  const integrationSolution = need(sealSolutionVersion(integrationSolutionContent()), 'seal integration solution');
  need(admitSolutionVersion([], integrationSolution), 'admit integration solution');
  need(
    approveSolutionBaseline(integrationSolution, {
      schema: 'epoch.solution-delivery.baseline-approval',
      schemaVersion: 1,
      approvalId: 'approval:workspace-integration-v1',
      solutionId: INTEGRATION_SOLUTION_ID,
      tenantId: ACTION_TENANT,
      version: integrationSolution.version,
      baselineDigest: integrationSolution.contentDigest,
      approvedBy: APPROVER,
      approvedAt: T[2],
      decisionNote: 'approved for the reference action path',
    }),
    'approve integration baseline',
  );
  const integrationProgram = need(
    buildProgramOfWork(integrationProgramContent(integrationSolution)),
    'build integration program',
  );

  // -- W038: the realized tracking record + the execution event (the
  //    action's effect on the realization plan).
  const programIndex = need(buildProgramIndex(integrationProgram), 'build program index');
  const tracking = need(
    openExecutionTrackingStore({ tenantId: ACTION_TENANT, solutionId: INTEGRATION_SOLUTION_ID, programIndex }),
    'open execution tracking store',
  );
  const trackingAdmission = need(
    admitTrackingState(
      tracking,
      need(sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:workspace-change-applied',
        tenantId: ACTION_TENANT,
        solutionId: INTEGRATION_SOLUTION_ID,
        subject: { workPackageId: INTEGRATION_WORK_PACKAGE },
        fromState: 'not-started',
        toState: 'in-progress',
        cause: 'authority-authorized change executed',
        note: 'The action-gateway-authorized change was applied to the hosted workspace',
        observedAt: T[11],
        recordedAt: T[11],
        recordedBy: PLATFORM_ENGINEER,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }), 'seal tracking state record'),
    ),
    'admit tracking state',
  );
  const executionEvent = need(
    sealExecutionEvent({
      schemaVersion: 1,
      streamId: ACTION_EXECUTION_STREAM_ID,
      sequence: 1,
      tenantId: ACTION_TENANT,
      actor: PLATFORM_ENGINEER,
      causalParent: null,
      payload: {
        discriminator: 'execution:tracking-recorded',
        data: {
          workPackageId: INTEGRATION_WORK_PACKAGE,
          trackingRecordId: trackingAdmission.record.recordId,
          fromState: 'not-started',
          toState: 'in-progress',
          observedAt: T[11],
        },
      },
      occurredAt: T[11],
    }),
    'seal execution event',
  );
  need(verifySealedExecutionEvent(executionEvent), 'verify execution event');

  // -- W010: the action lifecycle events (proposed -> authorized ->
  //    executed), each carrying the EXACT proposal reference.
  const actionEvents: EventRecord[] = [];
  const log = new EventLog({ expectedTenantId: ACTION_TENANT });
  const phases = ['proposed', 'authorized', 'executed'] as const;
  for (const [index, phase] of phases.entries()) {
    const detail: Record<string, string> = {
      decisionDigest: executedDispatch.decision.decisionDigest,
    };
    const outcomeDigest = executedDispatch.outcome?.outcomeDigest;
    if (outcomeDigest !== undefined) {
      detail.outcomeDigest = outcomeDigest;
    }
    const event: EventContent = {
      schemaVersion: 1,
      streamId: ACTION_STREAM_ID,
      sequence: index + 1,
      tenantId: ACTION_TENANT,
      actor: PLATFORM_ENGINEER,
      causalParent: index === 0 ? null : { streamId: ACTION_STREAM_ID, sequence: index },
      payload: {
        discriminator: 'action:lifecycle',
        data: {
          action: proposalRef,
          actionType: plan.proposal.actionType,
          phase,
          ...(phase === 'executed' ? { detail } : {}),
        },
      },
      occurredAt: phase === 'proposed' ? T[10] : phase === 'authorized' ? T[10] : T[11],
    };
    const sealed = need(sealEvent(event), `seal action lifecycle event (${phase})`);
    need(parseActionLifecycleEventData(sealed.event.payload), `parse action lifecycle data (${phase})`);
    need(log.appendEvent(sealed), `append action lifecycle event (${phase})`);
    actionEvents.push({ event: sealed.event, contentDigest: sealed.digest });
  }

  return {
    snapshotDigest,
    plan,
    proposalRef,
    compiledPlan,
    session,
    handoff,
    authority,
    pendingDispatch,
    approvalRequest,
    executedDispatch,
    allowDecision,
    allowExecution: { decision: allowSubmission.decision, outcome: allowExecutionOutcome.outcome },
    noPolicyDenial,
    expiredDenial,
    blockedDenial,
    executionEvent,
    actionEvents,
    log,
    integrationSolution,
    integrationProgram,
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence).
// --------------------------------------------------------------------------------

export function actionGatewayDigestProjection(
  scenario: ActionGatewayScenario,
): Record<string, string | readonly string[]> {
  return {
    snapshotDigest: scenario.snapshotDigest,
    planDigest: scenario.plan.planDigest,
    proposalDigest: scenario.proposalRef.canonicalDigest,
    planCompileDigest: scenario.compiledPlan.planDigest,
    sessionStateDigest: scenario.session.steps.map((step) => `${step.stepId}:${step.status}:${step.attempt}`).join('|'),
    handoffDigest: scenario.handoff.handoffDigest,
    pendingDecisionDigest: scenario.pendingDispatch.decision.decisionDigest,
    executedDecisionDigest: scenario.executedDispatch.decision.decisionDigest,
    executedOutcomeDigest: scenario.executedDispatch.outcome?.outcomeDigest ?? 'none',
    executedDispatchDigest: scenario.executedDispatch.contentDigest,
    allowDecisionDigest: scenario.allowDecision.contentDigest,
    allowOutcomeDigest: scenario.allowExecution.outcome.outcomeDigest,
    noPolicyDenialDigest: scenario.noPolicyDenial.contentDigest,
    expiredDenialDigest: scenario.expiredDenial.contentDigest,
    blockedDenialDigest: scenario.blockedDenial.contentDigest,
    executionEventDigest: scenario.executionEvent.contentDigest,
    actionEventDigests: scenario.actionEvents.map((record) => record.contentDigest),
  };
}

// --------------------------------------------------------------------------------
// The bypass envelope (the negative-path input, exported for the test).
// --------------------------------------------------------------------------------

/** The W007 binding pin for the action adapter (its REAL descriptor identity). */
export function actionAdapterPin(): {
  capabilityId: string;
  capabilityVersion: string;
  manifestDigest: string;
  adapterId: string;
  adapterDescriptorDigest: string;
} {
  const registrations = deriveCapabilityRegistrations();
  const action = registrations.find((registration) => registration.manifest.capabilityId === 'software.change-routing');
  if (action === undefined) {
    throw new Error('action-gateway scenario: action capability registration missing');
  }
  return {
    capabilityId: 'software.change-routing',
    capabilityVersion: '1.0.0',
    manifestDigest: action.digest,
    adapterId: 'adapter:software-workspace-action',
    adapterDescriptorDigest: ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  };
}

/** The execute-direct envelope: the typed bypass attempt. */
export function bypassEnvelope(): {
  schemaVersion: 1;
  category: 'action';
  binding: ReturnType<typeof actionAdapterPin>;
  payload: {
    target: { kind: 'external-resource'; ref: string };
    parameters: Record<string, JsonValue>;
  };
} {
  return {
    schemaVersion: 1 as const,
    category: 'action' as const,
    binding: actionAdapterPin(),
    payload: {
      target: { kind: 'external-resource', ref: ACTION_WORKSPACE_ID },
      parameters: {
        tenant: ACTION_TENANT,
        workspace: ACTION_WORKSPACE_ID,
        'change-kind': 'revision',
        summary: 'direct push attempt',
        mode: 'execute-direct',
        authority: {
          principalId: WORKSPACE_ENGINEER,
          context: {
            schemaVersion: 1,
            principals: [{ principalId: WORKSPACE_ENGINEER, status: 'active', authenticated: true }],
            memberships: [{ principalId: WORKSPACE_ENGINEER, tenantId: ACTION_TENANT }],
            knownTenants: [ACTION_TENANT],
          },
        },
        'decided-at': T[10],
      },
    },
  };
}
