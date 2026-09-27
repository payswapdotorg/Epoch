/**
 * @epoch/adapter-mcp — the action surface: typed tool invocations
 * routed EXCLUSIVELY through the W022 action-authority seam.
 *
 * The adapter executes NOTHING itself and NEVER bypasses the gateway
 * (architecture lock rule 3): it builds DETERMINISTIC W003 action
 * proposals from the neutral invocation parameters (content-derived
 * ids; identical inputs derive identical proposals and digests), gates
 * credential-shaped parameters OUT (the adapter holds no credentials —
 * `credential-rejected` before any proposal exists), and routes the
 * proposal through the {@link ActionAuthorityPort} seam. Outcomes are
 * the authority's typed records (decision + outcome), recorded verbatim
 * in the invocation record. A request for DIRECT execution is the typed
 * `gateway-bypass-rejected` — there is no bypass path, by construction
 * and by test.
 */
import { canonicalDigest, type JsonValue, type Timestamp } from '@epoch/agent-protocol';
import type { ActionProposal, ProposalReference } from '@epoch/action-protocol';
import { parseActionProposal } from '@epoch/action-protocol';
import type { TenantId } from '@epoch/tenancy';
import type {
  ActionAuthorityPort,
  AuthorityOutcomeRecord,
  InvocationPlan,
  ToolInvocationRecord,
  ToolInvocationSurface,
} from './types';
import type { McpAdapterResult } from './errors';
import {
  CREDENTIAL_PARAMETER_KEYS,
  INVOCATION_DISPOSITIONS,
  MCP_ADAPTER_RECORD_VERSION,
  PROPOSING_AGENT_ID,
  TOOL_ACTION_TYPE_IDS,
  TOOL_ACTION_TYPE_VERSION,
  TOOL_AUTHORITY_SCOPES,
} from './version';
import type { InvocationDisposition } from './version';

/** Input of {@link buildInvocationProposal} (pure, deterministic). */
export interface BuildInvocationProposalInput {
  readonly tenantId: TenantId;
  readonly toolRef: string;
  readonly actionId: string;
  readonly arguments: Readonly<Record<string, JsonValue>>;
  readonly proposedAt: Timestamp;
}

/**
 * Build the deterministic W003 tool-invocation proposal. The proposal
 * carries the FULL safety-relevant metadata the protocol requires; the
 * tool arguments ride as parameters (neutral keys; credential-shaped
 * keys were already rejected). Identical inputs derive identical
 * proposals: ids are content-derived (`inv-<digest16>`).
 */
export function buildInvocationProposal(input: BuildInvocationProposalInput): InvocationPlan {
  const seed: JsonValue = {
    tenantId: input.tenantId,
    toolRef: input.toolRef,
    arguments: input.arguments,
    proposedAt: input.proposedAt,
  };
  const contentSeed = canonicalDigest(seed).slice(0, 16);

  const proposalDocument: ActionProposal = {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: `msg-${contentSeed}`,
    createdAt: input.proposedAt,
    proposalId: `inv-${contentSeed}`,
    proposedBy: PROPOSING_AGENT_ID,
    actionType: { id: TOOL_ACTION_TYPE_IDS[0], version: TOOL_ACTION_TYPE_VERSION },
    target: { kind: 'external-resource', ref: input.toolRef },
    parameters: {
      tool: input.toolRef,
      ...(input.arguments as Record<string, JsonValue>),
    },
    preconditions: [
      {
        description: 'The target tool was discovered and its invocation surface is registered before the invocation is proposed.',
        targetRef: { kind: 'external-resource', ref: input.toolRef },
      },
    ],
    predictedEffects: [
      {
        description: `The external tool computes its declared output after the authority-authorized invocation (${input.toolRef}).`,
        targetRef: { kind: 'external-resource', ref: input.toolRef },
        confidence: { kind: 'deterministic' },
      },
    ],
    sideEffects: [
      {
        description: 'The external tool may consume quota or rate budget in its provider system.',
        reversible: true,
      },
    ],
    reversibility: {
      kind: 'reversible',
      via: 'automatic',
      notes: 'A tool invocation consumes no durable state; retrying with identical arguments is side-effect-free in the reference set.',
    },
    authorityRequirements: {
      requiredScopes: [...TOOL_AUTHORITY_SCOPES],
      requiresHumanApproval: true,
      approvalQuorum: {
        approvals: 1,
        roles: ['tool-operator'],
      },
    },
    rationale: `Routed by the external-tool adapter for tenant ${input.tenantId}: invoke ${input.toolRef}.`,
    evidenceRefs: [`surface:${input.toolRef}`],
  };

  // Round-trip through the REAL W003 admission pipeline: the proposal a
  // caller receives is exactly the document the gateway will admit.
  const outcome = parseActionProposal(proposalDocument);
  if (!outcome.ok) {
    throw new Error(`internal: adapter-built proposal failed W003 admission (${outcome.error.message})`);
  }
  const proposalRef: ProposalReference = {
    proposalId: outcome.value.proposalId,
    canonicalDigest: outcome.digest,
  };
  const planContent = {
    schemaVersion: MCP_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    toolRef: input.toolRef,
    actionId: input.actionId,
    proposal: outcome.value,
    proposalRef,
  };
  return {
    ...planContent,
    planDigest: canonicalDigest(planContent as unknown as JsonValue),
  };
}

/**
 * The credential gate: invocation parameters carrying credential-shaped
 * keys are rejected BEFORE any proposal is constructed (the adapter
 * holds NO credentials — tool credentials belong to the authority-side
 * execution port).
 */
export function credentialGate(
  parameters: Readonly<Record<string, unknown>>,
): McpAdapterResult<true> {
  const offending = Object.keys(parameters).filter((key) =>
    (CREDENTIAL_PARAMETER_KEYS as readonly string[]).includes(key.toLowerCase()),
  );
  if (offending.length > 0) {
    return {
      ok: false,
      error: {
        code: 'credential-rejected',
        message: `invocation parameters carry credential-shaped keys (${offending.join(', ')}) — this adapter holds no credentials; tool credentials belong to the authority-side execution port`,
        offendingKeys: offending.sort(),
      },
    };
  }
  return { ok: true, value: true };
}

/**
 * The tool-argument gate: invocation parameters must conform to the
 * discovered tool's declared argument surface (names, value kinds,
 * requiredness).
 */
export function toolArgumentGate(
  surface: ToolInvocationSurface,
  parameters: Readonly<Record<string, JsonValue>>,
): McpAdapterResult<true> {
  const issues: { path: string; message: string }[] = [];
  for (const argument of surface.inputArguments) {
    const value = parameters[argument.name];
    if (value === undefined) {
      if (argument.required) {
        issues.push({ path: `$.arguments.${argument.name}`, message: 'required argument is missing' });
      }
      continue;
    }
    const actual = typeof value;
    if (actual !== argument.valueKind) {
      issues.push({
        path: `$.arguments.${argument.name}`,
        message: `argument value kind "${actual}" does not match the declared kind "${argument.valueKind}"`,
      });
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'tool-argument-rejected',
        message: 'the invocation parameters do not conform to the discovered tool argument surface',
        issues,
      },
    };
  }
  return { ok: true, value: true };
}

/** Input of {@link routeInvocation} (the one-shot routing driver). */
export interface RouteInvocationInput {
  readonly plan: InvocationPlan;
  readonly arguments: Readonly<Record<string, JsonValue>>;
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

/** Map an authority error to the invocation-side typed error. */
function authorityError(message: string): McpAdapterResult<never> {
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
): InvocationDisposition {
  if (decision.outcome === 'deny' || decision.actionStatus === 'denied' || decision.actionStatus === 'rejected') {
    return 'authority-denied';
  }
  const authorized = decision.outcome === 'allow' || decision.actionStatus === 'authorized';
  if (!authorized) return 'authority-pending-approval';
  return outcome !== undefined && outcome.kind === 'succeeded' ? 'executed' : 'execution-failed';
}

/**
 * Route one tool invocation through the authority seam end-to-end:
 * submit (typed decision), and — iff authorized — request dispatch (the
 * authority's typed outcome record). The returned invocation record is
 * content-addressed and carries the authority's records verbatim.
 */
export function routeInvocation(input: RouteInvocationInput): McpAdapterResult<ToolInvocationRecord> {
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
  if (!(INVOCATION_DISPOSITIONS as readonly string[]).includes(disposition)) {
    return authorityError('unreachable disposition mapping');
  }
  const content = {
    schemaVersion: MCP_ADAPTER_RECORD_VERSION,
    tenantId: input.plan.tenantId,
    toolRef: input.plan.toolRef,
    actionId: input.plan.actionId,
    arguments: input.arguments,
    planDigest: input.plan.planDigest,
    decision,
    ...(outcome !== undefined ? { outcome } : {}),
    disposition,
  };
  const contentDigest = canonicalDigest(content as unknown as JsonValue);
  return {
    ok: true,
    value: {
      ...content,
      invocationId: `invocation-${contentDigest.slice(0, 12)}`,
      contentDigest,
    },
  };
}

/** Re-verify an invocation record's digest (tamper detection; total). */
export function verifyInvocationRecord(record: ToolInvocationRecord): boolean {
  const { contentDigest, invocationId, ...content } = record;
  void invocationId;
  return canonicalDigest(content as unknown as JsonValue) === contentDigest;
}
