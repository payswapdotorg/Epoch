/**
 * The pure policy EVALUATION layer (W022): decides whether a proposed
 * action may execute by consuming W003 action proposals and W004 policy
 * sets THROUGH their published kernels — precedence, scope and composition
 * semantics are @epoch/policy-contracts' authority, reused verbatim, never
 * re-implemented here.
 *
 * Deterministic mapping contract (checked in this exact order):
 *
 * 1. the proposal is admitted through the W003 pipeline (version gate,
 *    kind gate, schema) and content-addressed — the decision references
 *    the EXACT proposal revision by digest;
 * 2. the policy set is validated through the W004 document schema and
 *    CANONICALLY ORDERED (W004 precedence key: tier, rank, id) before
 *    digesting — input order never leaks into the policy-set digest or the
 *    decision identity;
 * 3. expiry — a proposal whose `expiresAt` instant is strictly BEFORE the
 *    decision instant is DENIED `proposal-expired` (the expiry instant is
 *    the LAST VALID instant — the same inclusive-boundary convention as
 *    the approval deadline; the full policy provenance is still carried);
 * 4. the W004 composite decision over the effective bindings:
 *    `block` → DENY (`unresolved-constraint` when any binding failed to
 *    resolve — W004 fail-closed — otherwise `constraint-blocked`);
 *    `not-applicable` → DENY `no-applicable-policy` (the Action Gateway
 *    executes only what an applicable policy set explicitly allows — an
 *    out-of-policy action is never fail-open);
 * 5. the proposal's authority requirements (W003): a proposal that
 *    requires human approval yields `requires-approval` carrying the
 *    approval directive (quorum verbatim from the proposal, W009-shaped
 *    approver scope, caller-supplied deadline + delegation bound);
 * 6. otherwise ALLOW.
 *
 * Zero wall-clock, zero randomness: every instant is caller-supplied. The
 * same inputs always produce the same decision content (hence the same
 * decision identity once sealed).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex, TimestampSchema } from '@epoch/agent-protocol';
import type { Timestamp } from '@epoch/agent-protocol';
import { parseActionProposal } from '@epoch/action-protocol';
import type { ActionProposal, ProposalReference } from '@epoch/action-protocol';
import {
  evaluatePolicySet,
  policyDocumentSchema,
  POLICY_PRECEDENCE_TIER_ORDER,
} from '@epoch/policy-contracts';
import type { CompositeDecision, PolicyDocument } from '@epoch/policy-contracts';
import { TenantIdSchema, WorkspaceIdSchema, ProjectIdSchema } from '@epoch/tenancy';
import { z } from 'zod';
import { rePathedIssues, validationError, validationIssues } from './issues';
import { PolicyDecisionContentSchema } from './schema';
import type {
  ActionPolicyResult,
  PolicyDecisionContent,
  PolicyEvaluationInput,
  PolicySetEntry,
} from './types';
import { MAX_DELEGATION_DEPTH } from './version';

/** The evaluation-input scope schema (W009 shapes via @epoch/tenancy). */
const evaluationScopeSchema = z
  .strictObject({
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly();

/** The approval-directive input schema. */
const approvalInputSchema = z
  .strictObject({
    deadline: TimestampSchema,
    maxDelegationDepth: z.number().int().min(0).max(MAX_DELEGATION_DEPTH),
  })
  .readonly();

/** The W004 policy-target projection of an evaluated action. */
export interface ActionPolicyTarget {
  tenantId: string;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  actionKind: string;
  resourceType: string;
  tags?: string[] | undefined;
}

/**
 * Project an admitted proposal + tenant scope onto the W004 policy-target
 * shape: `actionKind` is the proposal's action-type id, `resourceType` is
 * the target kind (the target's structural type), and the tenancy scope
 * fields carry the W009 container references.
 */
export function toActionPolicyTarget(
  proposal: ActionProposal,
  tenantId: string,
  scope: { workspaceId?: string | undefined; projectId?: string | undefined } | undefined,
): ActionPolicyTarget {
  return {
    tenantId,
    workspaceId: scope?.workspaceId,
    projectId: scope?.projectId,
    actionKind: proposal.actionType.id,
    resourceType: proposal.target.kind,
    tags: undefined,
  };
}

/** The canonicalized policy set: validated documents + digest + entries. */
export interface CanonicalPolicySet {
  /** Validated documents in canonical precedence order (tier, rank, id). */
  readonly documents: readonly PolicyDocument[];
  /** SHA-256 of the canonical JSON of the canonically ordered documents. */
  readonly digest: Sha256Hex;
  /** The contributing entries (policyId + version), sorted by policyId. */
  readonly entries: readonly PolicySetEntry[];
}

/** The W004 precedence key: (tier order, rank, id) — ascending. */
function precedenceKey(document: PolicyDocument): [number, number, string] {
  return [
    POLICY_PRECEDENCE_TIER_ORDER.get(document.precedence.tier) ?? 0,
    document.precedence.rank,
    document.id,
  ];
}

/**
 * Validate and canonically order a policy set (W004 document schema; W004
 * precedence ordering). Two policy sets that differ only in INPUT ORDER
 * canonicalize identically (input order never leaks). Total: invalid
 * documents yield typed `validation` errors with re-pathed issue paths.
 */
export function canonicalizePolicySet(policies: readonly unknown[]): ActionPolicyResult<CanonicalPolicySet> {
  if (!Array.isArray(policies)) {
    return {
      ok: false,
      error: validationIssues('the policy set must be an array of policy documents', [
        { path: '$.policies', message: 'expected an array of policy documents' },
      ]),
    };
  }
  const documents: PolicyDocument[] = [];
  for (const [index, candidate] of policies.entries()) {
    const parsed = policyDocumentSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: validationIssues(
          `policy document ${index} failed schema validation`,
          rePathedIssues(parsed.error, `$.policies[${index}]`),
        ),
      };
    }
    documents.push(parsed.data);
  }
  documents.sort((a, b) => {
    const [tierA, rankA, idA] = precedenceKey(a);
    const [tierB, rankB, idB] = precedenceKey(b);
    if (tierA !== tierB) return tierA - tierB;
    if (rankA !== rankB) return rankA - rankB;
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
  const entries: PolicySetEntry[] = documents
    .map((document) => ({ policyId: document.id, version: document.version }))
    .sort((a, b) => (a.policyId < b.policyId ? -1 : a.policyId > b.policyId ? 1 : 0));
  return {
    ok: true,
    value: {
      documents,
      digest: canonicalDigest(documents as unknown as JsonValue),
      entries,
    },
  };
}

/** The result of one pure policy evaluation. */
export interface PolicyEvaluation {
  /** The sealable decision content (the registry assigns the chain link). */
  readonly content: PolicyDecisionContent;
  /** The exact-revision proposal reference (W003 grammar). */
  readonly proposalRef: ProposalReference;
  /** The canonicalized policy set the decision was evaluated under. */
  readonly policySet: CanonicalPolicySet;
  /** The W004 composite decision carried in the provenance. */
  readonly composite: CompositeDecision;
}

/**
 * Evaluate one action proposal against one policy set (pure, total,
 * deterministic, fail-closed). Malformed inputs yield typed `validation`
 * errors — NEVER an implicit decision. See the module docs for the exact
 * mapping order.
 */
export function evaluateActionPolicy(input: PolicyEvaluationInput): ActionPolicyResult<PolicyEvaluation> {
  // Input shape validation (tenant grammar, scope shape, approval input).
  const tenant = TenantIdSchema.safeParse(input.tenantId);
  if (!tenant.success) {
    return { ok: false, error: validationError(tenant.error) };
  }
  let scope: { workspaceId?: string | undefined; projectId?: string | undefined } | undefined;
  if (input.scope !== undefined) {
    const parsedScope = evaluationScopeSchema.safeParse(input.scope);
    if (!parsedScope.success) {
      return { ok: false, error: validationError(parsedScope.error) };
    }
    scope = parsedScope.data;
  }
  let approvalInput: { deadline: string; maxDelegationDepth: number } | undefined;
  if (input.approval !== undefined) {
    const parsedApproval = approvalInputSchema.safeParse(input.approval);
    if (!parsedApproval.success) {
      return { ok: false, error: validationError(parsedApproval.error) };
    }
    approvalInput = parsedApproval.data;
  }

  // 1. Admit the proposal through the W003 pipeline.
  const proposalOutcome = parseActionProposal(input.proposal);
  if (!proposalOutcome.ok) {
    const failure = proposalOutcome.error;
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `action proposal failed admission (${failure.kind}): ${failure.message}`,
        issues:
          failure.kind === 'schema-violation'
            ? failure.issues.map((issue) => ({
                path: issue.path === '' ? '$.proposal' : `$.proposal.${issue.path}`,
                message: issue.message,
              }))
            : [
                {
                  path: '$.proposal',
                  message: `${failure.kind}: ${failure.message}`,
                },
              ],
      },
    };
  }
  const proposal: ActionProposal = proposalOutcome.value;
  const proposalRef: ProposalReference = {
    proposalId: proposal.proposalId,
    canonicalDigest: proposalOutcome.digest,
  };

  // 2. Canonicalize the policy set (input order never leaks).
  const policySet = canonicalizePolicySet(input.policies);
  if (!policySet.ok) {
    return policySet;
  }

  // 3. The W004 evaluation over the effective bindings (verbatim reuse).
  const target = toActionPolicyTarget(proposal, input.tenantId, scope);
  const evaluation = evaluatePolicySet(
    policySet.value.documents,
    target,
    input.evaluationContext ?? { inputs: {} },
    input.resolveConstraint,
  );
  if (!evaluation.ok) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'policy-set evaluation failed validation (W004 issues)',
        issues: evaluation.issues.map((issue) => ({
          path: issue.path === '$' ? '$.policies' : issue.path,
          message: `[${issue.code}] ${issue.message}`,
        })),
      },
    };
  }
  const composite = evaluation.evaluation.decision;

  // 4-6. The deterministic outcome mapping.
  const requiresApproval = proposal.authorityRequirements.requiresHumanApproval;
  let outcome: PolicyDecisionContent['outcome'];
  let denial: PolicyDecisionContent['denial'];
  let approval: PolicyDecisionContent['approval'];

  const expired =
    proposal.expiresAt !== undefined && stringInstantLt(proposal.expiresAt, input.decidedAt);
  if (expired) {
    outcome = 'deny';
    denial = {
      code: 'proposal-expired',
      reason: `the proposal expired at ${proposal.expiresAt} (decision instant ${input.decidedAt}) — an expired proposal is never executed`,
    };
  } else if (composite.decision === 'block') {
    const unresolved = composite.reasons.some((reason) => reason.startsWith('unresolved-constraint:'));
    outcome = 'deny';
    denial = unresolved
      ? {
          code: 'unresolved-constraint',
          reason:
            'an effective policy binding could not resolve its compiled constraint — the policy boundary is fail-closed (W004)',
        }
      : {
          code: 'constraint-blocked',
          reason:
            composite.blocking.length > 0
              ? `the applicable policy set blocks the proposal: ${composite.blocking
                  .map((entry) => `${entry.constraintId} (${entry.message})`)
                  .join('; ')}`
              : 'the applicable policy set blocks the proposal',
        };
  } else if (composite.decision === 'not-applicable') {
    outcome = 'deny';
    denial = {
      code: 'no-applicable-policy',
      reason:
        'no enabled policy matched the action target — the Action Gateway executes only what an applicable policy set explicitly allows (fail-closed)',
    };
  } else if (requiresApproval) {
    const quorum = proposal.authorityRequirements.approvalQuorum;
    if (quorum === undefined) {
      return {
        ok: false,
        error: validationIssues(
          'the proposal requires human approval but carries no approval quorum (W003 authority-requirements refinement)',
          [{ path: '$.proposal.authorityRequirements.approvalQuorum', message: 'approval quorum required' }],
        ),
      };
    }
    if (approvalInput === undefined) {
      return {
        ok: false,
        error: validationIssues(
          'the proposal requires human approval — supply the approval directive (deadline + maxDelegationDepth)',
          [
            {
              path: '$.approval',
              message: 'approval directive (deadline, maxDelegationDepth) is required for proposals that require human approval',
            },
          ],
        ),
      };
    }
    if (stringInstantLt(approvalInput.deadline, input.decidedAt)) {
      return {
        ok: false,
        error: validationIssues(
          'the approval deadline must not be before the decision instant',
          [
            {
              path: '$.approval.deadline',
              message: `deadline ${approvalInput.deadline} is before the decision instant ${input.decidedAt}`,
            },
          ],
        ),
      };
    }
    outcome = 'requires-approval';
    approval = {
      quorum,
      approverScope: {
        tenantId: input.tenantId,
        workspaceId: scope?.workspaceId,
        projectId: scope?.projectId,
      },
      deadline: approvalInput.deadline,
      maxDelegationDepth: approvalInput.maxDelegationDepth,
    };
  } else {
    outcome = 'allow';
  }

  const content: PolicyDecisionContent = {
    schemaVersion: 1,
    tenantId: input.tenantId,
    proposalRef,
    actionType: proposal.actionType,
    policySetDigest: policySet.value.digest,
    outcome,
    denial,
    approval,
    provenance: {
      resolution: evaluation.evaluation.resolution,
      composite,
      policies: policySet.value.entries,
    },
    decidedAt: input.decidedAt,
  };

  // Final structural self-check (the published content schema is the
  // authority on the record shape).
  const contentCheck = contentShapeCheck(content);
  if (!contentCheck.ok) {
    return contentCheck;
  }

  return {
    ok: true,
    value: { content, proposalRef, policySet: policySet.value, composite },
  };
}

/** Structural self-check of the composed decision content. */
function contentShapeCheck(content: PolicyDecisionContent): ActionPolicyResult<true> {
  const parsed = PolicyDecisionContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: true };
}

/**
 * Lexicographic instant comparison for the canonical UTC timestamp form
 * (`YYYY-MM-DDTHH:MM:SS.mmmZ` sorts chronologically as a string). Boundary
 * semantics: an expiry instant is the LAST VALID instant (a proposal is
 * expired only strictly after it — matching the approval deadline, which
 * is inclusive). Total: malformed instants fail the schema gates before
 * reaching here.
 */
function stringInstantLt(a: Timestamp, b: Timestamp): boolean {
  return a < b;
}
