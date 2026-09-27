/**
 * @epoch/adapter-github — the action surface: typed change proposals
 * routed EXCLUSIVELY through the W022 action-authority seam.
 *
 * The adapter NEVER executes (architecture lock rule 3: actions execute
 * only through the Action Gateway): it builds DETERMINISTIC W003 action
 * proposals (content-derived ids; identical inputs derive identical
 * proposals and digests) and routes them through the
 * {@link ActionAuthorityPort} seam. Outcomes are the authority's typed
 * records (decision + outcome), recorded verbatim in the dispatch
 * record. A request for DIRECT execution is the typed
 * `gateway-bypass-rejected` — there is no bypass path, by construction
 * and by test.
 *
 * The reference wiring over the REAL W022 gateway
 * (services/action-gateway) is exercised by the parity tests as a
 * devDependency — never a runtime edge (the frozen runtime dependency
 * policy).
 */
import { canonicalDigest, type JsonValue, type Timestamp } from '@epoch/agent-protocol';
import type { ActionProposal, ProposalReference } from '@epoch/action-protocol';
import { parseActionProposal } from '@epoch/action-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { ActionAuthorityPort } from './types';
import type {
  AuthorityOutcomeRecord,
  ChangeDispatchRecord,
  ChangeProposalPlan,
} from './types';
import type { GithubAdapterResult } from './errors';
import {
  CHANGE_DISPATCH_DISPOSITIONS,
  GITHUB_ADAPTER_RECORD_VERSION,
  PROPOSING_AGENT_ID,
  SOFTWARE_ACTION_TYPE_IDS,
  SOFTWARE_ACTION_TYPE_VERSION,
  SOFTWARE_AUTHORITY_SCOPES,
} from './version';
import type { ChangeDispatchDisposition } from './version';

/** Input of {@link buildChangeProposal} (pure, deterministic). */
export interface BuildChangeProposalInput {
  readonly tenantId: TenantId;
  readonly workspaceId: string;
  readonly changeKind: 'revision' | 'integration';
  readonly actionId: string;
  readonly summary: string;
  readonly subjectRevision?: string | undefined;
  readonly baseRevision?: string | undefined;
  readonly proposedAt: Timestamp;
}

/**
 * Build the deterministic W003 change proposal. The proposal carries the
 * FULL safety-relevant metadata the protocol requires: predicted
 * effects (deterministic — the proposal routes a typed record, the
 * provider effect is recorded by the authority), side effects,
 * reversibility classification, and authority requirements (a hosted
 * software-workspace write ALWAYS requires human approval — the
 * reference pin).
 *
 * Identical inputs derive identical proposals: ids are content-derived
 * (`chg-<digest16>` / `msg-<digest16>`), so replays propose byte-
 * identical documents.
 */
export function buildChangeProposal(input: BuildChangeProposalInput): ChangeProposalPlan {
  const actionTypeId =
    input.changeKind === 'revision'
      ? (SOFTWARE_ACTION_TYPE_IDS[0] as (typeof SOFTWARE_ACTION_TYPE_IDS)[number])
      : (SOFTWARE_ACTION_TYPE_IDS[1] as (typeof SOFTWARE_ACTION_TYPE_IDS)[number]);

  const seed: JsonValue = {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    changeKind: input.changeKind,
    summary: input.summary,
    subjectRevision: input.subjectRevision ?? null,
    baseRevision: input.baseRevision ?? null,
    proposedAt: input.proposedAt,
  };
  const contentSeed = canonicalDigest(seed).slice(0, 16);

  const parameters: Record<string, JsonValue> = {
    workspace: input.workspaceId,
    summary: input.summary,
    ...(input.subjectRevision !== undefined ? { subjectRevision: input.subjectRevision } : {}),
    ...(input.baseRevision !== undefined ? { baseRevision: input.baseRevision } : {}),
  };

  const proposalDocument: ActionProposal = {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: `msg-${contentSeed}`,
    createdAt: input.proposedAt,
    proposalId: `chg-${contentSeed}`,
    proposedBy: PROPOSING_AGENT_ID,
    actionType: { id: actionTypeId, version: SOFTWARE_ACTION_TYPE_VERSION },
    target: { kind: 'external-resource', ref: input.workspaceId },
    parameters,
    preconditions: [
      {
        description:
          'The target workspace holds a sealed snapshot at the referenced revision before the change is proposed.',
        targetRef: { kind: 'external-resource', ref: input.workspaceId },
      },
    ],
    predictedEffects: [
      {
        description:
          input.changeKind === 'revision'
            ? 'A new revision containing the summarized change exists on the target workspace after the authority-authorized execution.'
            : 'The target workspace contains an integration of the subject revision into the base revision after the authority-authorized execution.',
        targetRef: { kind: 'external-resource', ref: input.workspaceId },
        confidence: { kind: 'deterministic' },
      },
    ],
    sideEffects: [
      {
        description: 'The hosted workspace history advances; dependent work items may re-target the new revision.',
        reversible: false,
      },
    ],
    reversibility: {
      kind: 'partially-reversible',
      notes: 'A proposed change can be superseded by a later revision, but the published history entry is immutable.',
    },
    authorityRequirements: {
      requiredScopes: [...SOFTWARE_AUTHORITY_SCOPES],
      requiresHumanApproval: true,
      approvalQuorum: {
        approvals: 1,
        roles: ['workspace-maintainer'],
      },
    },
    rationale: `Routed by the hosted software-workspace adapter for tenant ${input.tenantId}: ${input.summary}`,
    evidenceRefs: [`snapshot:${input.workspaceId}`],
  };

  // Round-trip through the REAL W003 admission pipeline: the proposal a
  // caller receives is exactly the document the gateway will admit.
  const outcome = parseActionProposal(proposalDocument);
  if (!outcome.ok) {
    // Structurally impossible (all fields are protocol-valid by
    // construction); fail loudly in development rather than shipping a
    // proposal the authority would reject.
    throw new Error(`internal: adapter-built proposal failed W003 admission (${outcome.error.message})`);
  }
  const proposal = outcome.value;
  const proposalRef: ProposalReference = {
    proposalId: proposal.proposalId,
    canonicalDigest: outcome.digest,
  };
  const planContent = {
    schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    changeKind: input.changeKind,
    actionId: input.actionId,
    proposal,
    proposalRef,
  };
  return {
    ...planContent,
    planDigest: canonicalDigest(planContent as unknown as JsonValue),
  };
}

/** Input of {@link routeChange} (the one-shot routing driver). */
export interface RouteChangeInput {
  readonly plan: ChangeProposalPlan;
  readonly authority: ActionAuthorityPort;
  readonly authorization: {
    readonly principalId: string;
    readonly context: unknown;
    readonly justification?: string | undefined;
  };
  readonly approval?: { readonly deadline: Timestamp; readonly maxDelegationDepth: number } | undefined;
  readonly decidedAt: Timestamp;
  readonly executedAt: Timestamp;
}

/** Map an authority error to the dispatch-side typed error. */
function authorityError(message: string): GithubAdapterResult<never> {
  return {
    ok: false,
    error: {
      code: 'authority-unavailable',
      message: `the action authority rejected the routing: ${message}`,
    },
  };
}

/** Map the authority records to the W007-neutral failure disposition. */
function dispositionOf(
  decision: { readonly outcome: 'allow' | 'deny' | 'requires-approval'; readonly actionStatus: string },
  outcome: AuthorityOutcomeRecord | undefined,
): ChangeDispatchDisposition {
  if (decision.outcome === 'deny' || decision.actionStatus === 'denied' || decision.actionStatus === 'rejected') {
    return 'authority-denied';
  }
  // An approval-requiring decision reaches authorization ONLY through the
  // authority's own approval flow (actionStatus "authorized"); until then
  // the routing stays pending — the adapter never executes early.
  const authorized = decision.outcome === 'allow' || decision.actionStatus === 'authorized';
  if (!authorized) return 'authority-pending-approval';
  return outcome !== undefined && outcome.kind === 'succeeded' ? 'executed' : 'execution-failed';
}

/**
 * Route one change proposal through the authority seam end-to-end:
 * submit (typed decision), and — iff allowed — request dispatch (the
 * authority's typed outcome record). The returned dispatch record is
 * content-addressed and carries the authority's records verbatim.
 */
export function routeChange(input: RouteChangeInput): GithubAdapterResult<ChangeDispatchRecord> {
  const submission = input.authority.submitAction({
    tenantId: input.plan.tenantId,
    actionId: input.plan.actionId,
    proposal: input.plan.proposal,
    authorization: input.authorization,
    decidedAt: input.decidedAt,
    ...(input.approval !== undefined ? { approval: input.approval } : {}),
  });
  if (!submission.ok) {
    return authorityError(submission.error.message);
  }
  const decision = submission.decision;

  // Request dispatch iff the authority has AUTHORIZED the action (either
  // the decision allowed it outright, or its approval flow completed —
  // the authority's own action status is the authorization signal).
  const authorized = decision.outcome === 'allow' || decision.actionStatus === 'authorized';
  let outcome: AuthorityOutcomeRecord | undefined;
  if (authorized) {
    const dispatch = input.authority.executeAction({
      tenantId: input.plan.tenantId,
      actionId: input.plan.actionId,
      authorization: input.authorization,
      evidenceRefs: [`plan:${input.plan.planDigest}`],
      at: input.executedAt,
    });
    if (!dispatch.ok) {
      return authorityError(dispatch.error.message);
    }
    outcome = dispatch.outcome;
  }

  const disposition = dispositionOf(decision, outcome);
  if (!(CHANGE_DISPATCH_DISPOSITIONS as readonly string[]).includes(disposition)) {
    return authorityError('unreachable disposition mapping');
  }
  const content = {
    schemaVersion: GITHUB_ADAPTER_RECORD_VERSION,
    tenantId: input.plan.tenantId,
    workspaceId: input.plan.workspaceId,
    changeKind: input.plan.changeKind,
    actionId: input.plan.actionId,
    planDigest: input.plan.planDigest,
    decision,
    ...(outcome !== undefined ? { outcome } : {}),
    disposition,
  };
  return {
    ok: true,
    value: { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) },
  };
}
