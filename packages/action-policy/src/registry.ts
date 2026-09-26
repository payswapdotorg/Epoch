/**
 * The reference action-policy registry (W022): the append-only, per-proposal
 * hash-chained home of sealed policy decisions and the human-approval flow.
 *
 * Invariants enforced here (every entry point is total — errors are values,
 * never exceptions):
 *
 * - APPEND-ONLY: decisions, approvals, rejections and expiries are sealed
 *   records; there is no mutation or deletion API. A changed situation
 *   (changed proposal revision or changed policy set) produces a NEW
 *   decision record whose `previousDecisionDigest` links at its predecessor
 *   (W023 version-chain style); the chain is verifiable
 *   (`verifyDecisionChain`) and tamper-evident (the digest covers the
 *   link).
 * - IDEMPOTENT REPLAY: the same proposal digest under the same policy-set
 *   digest is the typed `duplicate-decision` negative ECHOING the existing
 *   sealed decision (state unchanged); an approval replayed by the same
 *   approver is the typed `duplicate-approval` negative echoing the sealed
 *   approval (state unchanged).
 * - TENANT ISOLATION (R12): decisions are tenant-scoped; the same exact
 *   proposal revision (digest) grounds decisions in exactly ONE tenant — a
 *   second tenant referencing it is the typed `tenant-isolation-rejected`
 *   rejection, as is any approval/rejection naming another tenant's
 *   decision. The registry may itself be pinned to one tenant
 *   (`expectedTenantId`, the event-log single-tenant guard precedent).
 * - APPROVAL SEMANTICS: approval authorizes execution of EXACTLY the
 *   referenced decision + proposal revision — drift is
 *   `proposal-drift-rejected`, late approvals are `approval-deadline-expired`,
 *   deep/circular delegation is `delegation-depth-exceeded` /
 *   `delegation-cycle`, non-quorum approvers are `approver-role-rejected`,
 *   and a request settles at most once (`approval-request-settled`).
 * - SUPERSESSION: recording a NEW decision for a proposal supersedes that
 *   proposal's open approval requests — pending AND approved (approvals
 *   never transfer across decisions: an approval binds to exactly one
 *   decision digest). Rejected/expired requests are terminal facts and
 *   stay as recorded.
 * - DETERMINISM: zero wall-clock, zero randomness — every instant is
 *   caller-supplied; snapshots are deterministically ordered (no
 *   insertion-order leaks); two registries fed the same admission history
 *   emit byte-identical snapshots.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex, type Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import { TenantIdSchema } from '@epoch/tenancy';
import { evaluateActionPolicy } from './evaluate';
import type { PolicyEvaluationInput } from './types';
import {
  sealApproval,
  sealDecision,
  sealExpiry,
  sealRejection,
  verifySealedApproval,
  verifySealedDecision,
  verifySealedExpiry,
  verifySealedRejection,
} from './digest';
import { ActionPolicySnapshotSchema } from './schema';
import { validationError, validationIssues } from './issues';
import type {
  ActionPolicyError,
  ActionPolicyRegistryOptions,
  ActionPolicyResult,
  ActionPolicySnapshot,
  ApprovalRequestState,
  ApprovalSubmission,
  RejectionSubmission,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
} from './types';
import { MAX_DELEGATION_DEPTH, type ApprovalRequestStatus } from './version';

/** Deterministic composite key: `<tenantId>#<proposalId>` (grammars exclude `#`). */
function proposalChainKey(tenantId: string, proposalId: string): string {
  return `${tenantId}#${proposalId}`;
}

/** Deterministic composite key: `<tenantId>#<proposalDigest>#<policySetDigest>`. */
function decisionIdempotencyKey(
  tenantId: string,
  proposalDigest: string,
  policySetDigest: string,
): string {
  return `${tenantId}#${proposalDigest}#${policySetDigest}`;
}

/** Deterministic composite key: `<decisionDigest>#<approverId>`. */
function approvalIdempotencyKey(decisionDigest: string, approverId: string): string {
  return `${decisionDigest}#${approverId}`;
}

/** Canonical deep-equality over JSON-shaped values (digest comparison). */
function canonicallyEqual(a: unknown, b: unknown): boolean {
  return canonicalDigest(a as JsonValue) === canonicalDigest(b as JsonValue);
}

/**
 * The reference in-memory registry. Construct directly (`new
 * ActionPolicyRegistry()` or `new ActionPolicyRegistry({ expectedTenantId })`),
 * or restore deterministically from a snapshot
 * (`ActionPolicyRegistry.fromSnapshot`). No persistence, no network, no
 * clocks.
 */
export class ActionPolicyRegistry {
  /** contentDigest -> sealed decision. */
  private readonly decisions = new Map<Sha256Hex, SealedPolicyDecision>();

  /** `<tenantId>#<proposalId>` -> content digests in recording order. */
  private readonly chains = new Map<string, Sha256Hex[]>();

  /** `<tenantId>#<proposalDigest>#<policySetDigest>` -> decision digest. */
  private readonly decisionIndex = new Map<string, Sha256Hex>();

  /** proposalDigest -> the tenant that grounded it (isolation boundary). */
  private readonly proposalTenant = new Map<Sha256Hex, TenantId>();

  /** decisionDigest -> the approval request of a requires-approval decision. */
  private readonly requests = new Map<Sha256Hex, ApprovalRequestState>();

  /** `<decisionDigest>#<approverId>` -> the sealed approval (idempotency). */
  private readonly approvalsByApprover = new Map<string, SealedApprovalRecord>();

  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: ActionPolicyRegistryOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /**
   * Evaluate and record one policy decision: the pure evaluation runs
   * first (typed `validation` errors surface verbatim), then the tenant
   * gates, then the idempotency gate, then the seal with the registry's
   * chain link. A `requires-approval` outcome opens the approval request.
   */
  recordDecision(input: PolicyEvaluationInput): ActionPolicyResult<SealedPolicyDecision> {
    const guard = this.tenantGuard(input.tenantId);
    if (guard !== null) {
      return guard;
    }
    const evaluation = evaluateActionPolicy(input);
    if (!evaluation.ok) {
      return evaluation;
    }
    const { content } = evaluation.value;
    const proposalDigest = content.proposalRef.canonicalDigest;

    // Tenant isolation (R12): an exact proposal revision grounds in ONE tenant.
    const groundingTenant = this.proposalTenant.get(proposalDigest);
    if (groundingTenant !== undefined && groundingTenant !== input.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `proposal revision ${proposalDigest} is grounded in tenant "${groundingTenant}" — tenant "${input.tenantId}" cannot reference it (R12 tenant isolation)`,
          proposalDigest,
          expectedTenantId: groundingTenant,
          encounteredTenantId: input.tenantId,
        },
      };
    }

    // Idempotent replay: same proposal digest + same policy-set digest.
    const chainKey = proposalChainKey(input.tenantId, content.proposalRef.proposalId);
    const idempotencyKey = decisionIdempotencyKey(
      input.tenantId,
      proposalDigest,
      content.policySetDigest,
    );
    const existingDigest = this.decisionIndex.get(idempotencyKey);
    if (existingDigest !== undefined) {
      const existing = this.decisions.get(existingDigest)!;
      return {
        ok: false,
        error: {
          code: 'duplicate-decision',
          message: `proposal revision ${proposalDigest} was already decided under policy set ${content.policySetDigest} — the existing decision stands (idempotent replay)`,
          existingDecisionDigest: existing.contentDigest,
          existingDecision: existing,
        },
      };
    }

    // Chain link: the current head for this proposal (null on the first).
    const chain = this.chains.get(chainKey) ?? [];
    const previousDecisionDigest = chain.length === 0 ? null : chain[chain.length - 1]!;

    const sealed = sealDecision(content, previousDecisionDigest);
    if (!sealed.ok) {
      return sealed;
    }
    const decision = sealed.value;

    // Supersession: a new decision voids this proposal's OPEN requests
    // (pending or approved — approvals never transfer across decisions).
    for (const priorDigest of chain) {
      const priorRequest = this.requests.get(priorDigest);
      if (
        priorRequest !== undefined &&
        (priorRequest.status === 'pending' || priorRequest.status === 'approved')
      ) {
        this.requests.set(priorDigest, {
          ...priorRequest,
          status: 'superseded',
          supersededBy: decision.contentDigest,
        });
      }
    }

    // Append (append-only: one write per record, no mutation afterwards).
    this.decisions.set(decision.contentDigest, decision);
    this.chains.set(chainKey, [...chain, decision.contentDigest]);
    this.decisionIndex.set(idempotencyKey, decision.contentDigest);
    this.proposalTenant.set(proposalDigest, input.tenantId);

    if (decision.outcome === 'requires-approval' && decision.approval !== undefined) {
      this.requests.set(decision.contentDigest, {
        decisionDigest: decision.contentDigest,
        tenantId: decision.tenantId,
        proposalRef: decision.proposalRef,
        directive: decision.approval,
        status: 'pending',
        approvals: [],
      });
    }

    return { ok: true, value: decision };
  }

  /** One sealed decision by content digest (digest-addressed read). */
  getDecision(decisionDigest: Sha256Hex): ActionPolicyResult<SealedPolicyDecision> {
    const decision = this.decisions.get(decisionDigest);
    if (decision === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-decision',
          message: `no decision is recorded at digest ${decisionDigest}`,
          decisionDigest,
        },
      };
    }
    return { ok: true, value: decision };
  }

  /**
   * The decision chain of one proposal (tenant-scoped read; cross-tenant
   * chain access is the typed `tenant-isolation-rejected` rejection).
   * Records are in recording order — the last element is the in-force
   * decision.
   */
  decisionChainFor(
    tenantId: string,
    proposalId: string,
  ): ActionPolicyResult<readonly SealedPolicyDecision[]> {
    const guard = this.tenantGuard(tenantId);
    if (guard !== null) {
      return guard;
    }
    const chain = this.chains.get(proposalChainKey(tenantId, proposalId));
    if (chain === undefined) {
      const foreign = this.findForeignChain(tenantId, proposalId);
      if (foreign !== null) {
        return {
          ok: false,
          error: {
            code: 'tenant-isolation-rejected',
            message: `proposal "${proposalId}" is decided under tenant "${foreign}" — tenant "${tenantId}" cannot read its chain (R12 tenant isolation)`,
            expectedTenantId: tenantId,
            encounteredTenantId: foreign,
          },
        };
      }
      return { ok: true, value: [] };
    }
    return {
      ok: true,
      value: chain.map((digest) => this.decisions.get(digest)!),
    };
  }

  /**
   * Verify one proposal's decision chain: every record's content digest is
   * recomputed (tamper detection — `digest-mismatch`) and every chain link
   * must line up with the prior record's content digest (`chain-broken`).
   */
  verifyDecisionChain(
    tenantId: string,
    proposalId: string,
  ): ActionPolicyResult<readonly SealedPolicyDecision[]> {
    const chain = this.decisionChainFor(tenantId, proposalId);
    if (!chain.ok) {
      return chain;
    }
    let previous: Sha256Hex | null = null;
    for (const record of chain.value) {
      const verified = verifySealedDecision(record);
      if (!verified.ok) {
        return verified;
      }
      if (verified.value.previousDecisionDigest !== previous) {
        return {
          ok: false,
          error: {
            code: 'chain-broken',
            message: `the decision chain of proposal "${proposalId}" has a broken link at digest ${verified.value.contentDigest}`,
            tenantId,
            proposalId,
            expected: previous,
            encountered: verified.value.previousDecisionDigest,
          },
        };
      }
      previous = verified.value.contentDigest;
    }
    return chain;
  }

  /**
   * Record one human approval against the ORIGINAL requires-approval
   * decision. Fixed gate precedence: tenant -> decision lookup -> decision
   * kind -> proposal drift -> DUPLICATE replay (the idempotent negative
   * echoes the sealed approval whatever the current status) -> request
   * status -> deadline -> approver role -> delegation (cycle before depth)
   * -> seal + append (quorum tracked; the request settles as `approved`
   * when distinct approvals reach the quorum). Approval NEVER re-evaluates
   * policy.
   */
  recordApproval(submission: ApprovalSubmission): ActionPolicyResult<SealedApprovalRecord> {
    const context = this.approvalGate(submission, 'approval');
    if (!context.ok) {
      return context;
    }
    const { decision, request } = context.value;

    // Idempotent replay FIRST (before the settled/deadline/role gates): an
    // approval replayed by the same approver is the typed
    // `duplicate-approval` negative echoing the sealed record — whatever
    // the request's current status (the replay is recorded history).
    const approvalKey = approvalIdempotencyKey(submission.decisionDigest, submission.decidedBy.id);
    const existingApproval = this.approvalsByApprover.get(approvalKey);
    if (existingApproval !== undefined) {
      return {
        ok: false,
        error: {
          code: 'duplicate-approval',
          message: `approver "${submission.decidedBy.id}" already approved decision ${submission.decisionDigest} — the existing sealed approval stands (idempotent replay)`,
          approverId: submission.decidedBy.id,
          existingApproval,
        },
      };
    }

    // The request must still be open for a NEW approval.
    if (request.status !== 'pending') {
      return this.settledError(submission.decisionDigest, request.status, 'approval');
    }
    // Deadline: expiry is typed, never implicit.
    if (submission.at > request.directive.deadline) {
      return {
        ok: false,
        error: {
          code: 'approval-deadline-expired',
          message: `the approval arrived at ${submission.at} but the request deadline is ${request.directive.deadline}`,
          decisionDigest: submission.decisionDigest,
          deadline: request.directive.deadline,
          encounteredAt: submission.at,
        },
      };
    }
    // Approver role: a human approver acting in one of the quorum roles.
    const roleError = approverRoleGate(submission, request, decision, 'approval');
    if (roleError !== null) {
      return { ok: false, error: roleError };
    }

    // Delegation: bounded, acyclic, ending at the acting approver. The
    // CYCLE is detected before the depth bound (the more specific abuse
    // signal wins).
    const path =
      submission.delegationPath === undefined
        ? [submission.decidedBy.id]
        : [...submission.delegationPath];
    if (path.length === 0) {
      return {
        ok: false,
        error: validationIssues('the delegation path must name at least the acting approver', [
          { path: '$.delegationPath', message: 'at least one approver id is required' },
        ]),
      };
    }
    const actingApprover = path[path.length - 1]!;
    if (actingApprover !== submission.decidedBy.id) {
      return {
        ok: false,
        error: validationIssues('the delegation path must end at the acting approver', [
          {
            path: '$.delegationPath',
            message: `the path ends at "${actingApprover}" but the acting approver is "${submission.decidedBy.id}"`,
          },
        ]),
      };
    }
    const seen = new Set<string>();
    for (const approver of path) {
      if (seen.has(approver)) {
        return {
          ok: false,
          error: {
            code: 'delegation-cycle',
            message: `the delegation path revisits approver "${approver}" — circular delegation is abuse`,
            decisionDigest: submission.decisionDigest,
            path,
          },
        };
      }
      seen.add(approver);
    }
    const depth = path.length - 1;
    const maxDepth = Math.min(request.directive.maxDelegationDepth, MAX_DELEGATION_DEPTH);
    if (depth > maxDepth) {
      return {
        ok: false,
        error: {
          code: 'delegation-depth-exceeded',
          message: `the delegation depth ${depth} exceeds the request's maximum ${maxDepth}`,
          decisionDigest: submission.decisionDigest,
          maxDelegationDepth: maxDepth,
          encounteredDepth: depth,
        },
      };
    }

    const sealed = sealApproval({
      schemaVersion: 1,
      tenantId: submission.tenantId,
      decisionDigest: submission.decisionDigest,
      proposalRef: submission.proposalRef,
      decidedBy: submission.decidedBy,
      asRole: submission.asRole,
      delegation: { depth, path },
      note: submission.note,
      decidedAt: submission.at,
    });
    if (!sealed.ok) {
      return sealed;
    }

    this.approvalsByApprover.set(approvalKey, sealed.value);
    const approvals = [...request.approvals, sealed.value];
    const status: ApprovalRequestState['status'] =
      approvals.length >= request.directive.quorum.approvals ? 'approved' : 'pending';
    this.requests.set(submission.decisionDigest, { ...request, approvals, status });
    return sealed;
  }

  /**
   * Record one human rejection against the ORIGINAL requires-approval
   * decision: a fail-closed veto that settles the request as `rejected`
   * immediately. The shared gates (tenant, lookup, kind, drift) plus the
   * status/deadline/role gates precede the seal.
   */
  recordRejection(submission: RejectionSubmission): ActionPolicyResult<SealedRejectionRecord> {
    const context = this.approvalGate(submission, 'rejection');
    if (!context.ok) {
      return context;
    }
    const { decision, request } = context.value;
    if (request.status !== 'pending') {
      return this.settledError(submission.decisionDigest, request.status, 'rejection');
    }
    if (submission.at > request.directive.deadline) {
      return {
        ok: false,
        error: {
          code: 'approval-deadline-expired',
          message: `the rejection arrived at ${submission.at} but the request deadline is ${request.directive.deadline}`,
          decisionDigest: submission.decisionDigest,
          deadline: request.directive.deadline,
          encounteredAt: submission.at,
        },
      };
    }
    const roleError = approverRoleGate(submission, request, decision, 'rejection');
    if (roleError !== null) {
      return { ok: false, error: roleError };
    }
    const sealed = sealRejection({
      schemaVersion: 1,
      tenantId: submission.tenantId,
      decisionDigest: submission.decisionDigest,
      proposalRef: submission.proposalRef,
      decidedBy: submission.decidedBy,
      asRole: submission.asRole,
      reason: submission.reason,
      decidedAt: submission.at,
    });
    if (!sealed.ok) {
      return sealed;
    }
    this.requests.set(submission.decisionDigest, {
      ...request,
      status: 'rejected',
      rejection: sealed.value,
    });
    return sealed;
  }

  /**
   * Sweep the pending requests whose deadline has passed (caller-supplied
   * instant; zero wall-clock): each settles as `expired` with a sealed
   * expiry record (the typed approval-timeout outcome). Idempotent:
   * already-settled requests are skipped.
   */
  expireApprovals(at: Timestamp): readonly SealedExpiryRecord[] {
    const expired: SealedExpiryRecord[] = [];
    const entries = [...this.requests.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [decisionDigest, request] of entries) {
      if (request.status !== 'pending' || request.directive.deadline >= at) {
        continue;
      }
      const sealed = sealExpiry({
        schemaVersion: 1,
        tenantId: request.tenantId,
        decisionDigest,
        proposalRef: request.proposalRef,
        deadline: request.directive.deadline,
        expiredAt: at,
      });
      if (!sealed.ok) {
        continue; // unreachable: the record composes from admitted records
      }
      this.requests.set(decisionDigest, { ...request, status: 'expired', expiry: sealed.value });
      expired.push(sealed.value);
    }
    return expired;
  }

  /** The live approval request of one decision (digest-addressed read). */
  approvalRequest(decisionDigest: Sha256Hex): ActionPolicyResult<ApprovalRequestState> {
    const request = this.requests.get(decisionDigest);
    if (request === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-decision',
          message: `no approval request hangs off decision ${decisionDigest}`,
          decisionDigest,
        },
      };
    }
    return { ok: true, value: request };
  }

  /** A deterministic whole-registry snapshot (records + request states, sorted). */
  snapshot(): ActionPolicySnapshot {
    const decisions = [...this.decisions.values()]
      .sort((a, b) =>
        a.tenantId === b.tenantId
          ? a.proposalRef.proposalId === b.proposalRef.proposalId
            ? a.contentDigest < b.contentDigest
              ? -1
              : 1
            : a.proposalRef.proposalId < b.proposalRef.proposalId
              ? -1
              : 1
          : a.tenantId < b.tenantId
            ? -1
            : 1,
      )
      .map((decision) => this.decisions.get(decision.contentDigest)!);
    const requests = [...this.requests.values()].sort((a, b) =>
      a.decisionDigest < b.decisionDigest ? -1 : a.decisionDigest > b.decisionDigest ? 1 : 0,
    );
    return { schemaVersion: 1, decisions, requests };
  }

  /**
   * Restore a registry from a snapshot. Total; every sealed record
   * re-verifies through its digest discipline (tampered snapshots are
   * typed rejections, never silent corruption), chains are rebuilt in link
   * order with integrity checks, and the approval-request states are
   * validated against the sealed records (decision kind, tenant, proposal
   * revision, quorum counts, settlement records, supersession links).
   */
  static fromSnapshot(
    input: unknown,
    options: ActionPolicyRegistryOptions = {},
  ): ActionPolicyResult<ActionPolicyRegistry> {
    const parsed = ActionPolicySnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: validationError(parsed.error) };
    }
    const snapshot = parsed.data;
    const registry = new ActionPolicyRegistry(options);

    // Decisions: verify digests, rebuild indices, group per proposal chain.
    const chains = new Map<string, SealedPolicyDecision[]>();
    for (const candidate of snapshot.decisions) {
      const verified = verifySealedDecision(candidate);
      if (!verified.ok) {
        return verified;
      }
      const decision = verified.value;
      if (registry.decisions.has(decision.contentDigest)) {
        return {
          ok: false,
          error: validationIssues('snapshot carries a duplicate decision record', [
            { path: '$.decisions', message: `duplicate decision digest ${decision.contentDigest}` },
          ]),
        };
      }
      const groundingTenant = registry.proposalTenant.get(decision.proposalRef.canonicalDigest);
      if (groundingTenant !== undefined && groundingTenant !== decision.tenantId) {
        return {
          ok: false,
          error: {
            code: 'tenant-isolation-rejected',
            message: `snapshot grounds proposal revision ${decision.proposalRef.canonicalDigest} in two tenants ("${groundingTenant}", "${decision.tenantId}") — the snapshot is rejected (R12)`,
            proposalDigest: decision.proposalRef.canonicalDigest,
            expectedTenantId: groundingTenant,
            encounteredTenantId: decision.tenantId,
          },
        };
      }
      registry.decisions.set(decision.contentDigest, decision);
      registry.proposalTenant.set(decision.proposalRef.canonicalDigest, decision.tenantId);
      const chainKey = proposalChainKey(decision.tenantId, decision.proposalRef.proposalId);
      const chain = chains.get(chainKey) ?? [];
      chain.push(decision);
      chains.set(chainKey, chain);
    }

    // Chains: order by links (root = null link; each next links at the
    // prior's content digest), verify walkability, rebuild the indices.
    const chainPositions = new Map<Sha256Hex, number>();
    for (const [chainKey, records] of chains) {
      const ordered: SealedPolicyDecision[] = [];
      const byLink = new Map<string, SealedPolicyDecision>();
      let head: SealedPolicyDecision | undefined;
      for (const record of records) {
        if (record.previousDecisionDigest === null) {
          if (head !== undefined) {
            return {
              ok: false,
              error: {
                code: 'chain-broken',
                message: `the decision chain "${chainKey}" carries more than one root record`,
                tenantId: record.tenantId,
                proposalId: record.proposalRef.proposalId,
                expected: null,
                encountered: record.previousDecisionDigest,
              },
            };
          }
          head = record;
        } else {
          const existing = byLink.get(record.previousDecisionDigest);
          if (existing !== undefined) {
            return {
              ok: false,
              error: validationIssues('snapshot decision chain forks at one link', [
                {
                  path: '$.decisions',
                  message: `two records claim the same previousDecisionDigest ${record.previousDecisionDigest}`,
                },
              ]),
            };
          }
          byLink.set(record.previousDecisionDigest, record);
        }
      }
      let current = head;
      let guardCount = 0;
      while (current !== undefined && guardCount <= records.length) {
        ordered.push(current);
        current = byLink.get(current.contentDigest);
        guardCount += 1;
      }
      if (head === undefined || ordered.length !== records.length) {
        return {
          ok: false,
          error: {
            code: 'chain-broken',
            message: `the decision chain "${chainKey}" cannot be walked root-to-head (dangling or cyclic links)`,
            tenantId: chainKey.slice(0, chainKey.indexOf('#')),
            proposalId: chainKey.slice(chainKey.indexOf('#') + 1),
            expected: null,
            encountered: null,
          },
        };
      }
      registry.chains.set(chainKey, ordered.map((record) => record.contentDigest));
      ordered.forEach((record, index) => {
        chainPositions.set(record.contentDigest, index);
        registry.decisionIndex.set(
          decisionIdempotencyKey(
            record.tenantId,
            record.proposalRef.canonicalDigest,
            record.policySetDigest,
          ),
          record.contentDigest,
        );
      });
    }

    // Requests: validate against the sealed records, then adopt.
    const seenRequests = new Set<Sha256Hex>();
    for (const request of snapshot.requests) {
      if (seenRequests.has(request.decisionDigest)) {
        return {
          ok: false,
          error: validationIssues('snapshot carries a duplicate approval request', [
            {
              path: '$.requests',
              message: `duplicate request for decision ${request.decisionDigest}`,
            },
          ]),
        };
      }
      seenRequests.add(request.decisionDigest);
      const decision = registry.decisions.get(request.decisionDigest);
      if (decision === undefined || decision.outcome !== 'requires-approval' || decision.approval === undefined) {
        return {
          ok: false,
          error: validationIssues('snapshot request references a missing or non-approval decision', [
            {
              path: '$.requests',
              message: `decision ${request.decisionDigest} is not a requires-approval decision`,
            },
          ]),
        };
      }
      const consistency = validateRequestState(request, decision, chainPositions);
      if (!consistency.ok) {
        return consistency;
      }
      registry.requests.set(request.decisionDigest, request);
      for (const approval of request.approvals) {
        registry.approvalsByApprover.set(
          approvalIdempotencyKey(approval.decisionDigest, approval.decidedBy.id),
          approval,
        );
      }
    }

    // Every requires-approval decision carries exactly one request.
    for (const decision of registry.decisions.values()) {
      if (decision.outcome === 'requires-approval' && !seenRequests.has(decision.contentDigest)) {
        return {
          ok: false,
          error: validationIssues('snapshot is missing an approval request', [
            {
              path: '$.requests',
              message: `requires-approval decision ${decision.contentDigest} carries no request`,
            },
          ]),
        };
      }
    }

    return { ok: true, value: registry };
  }

  /** The tenant guard (R12): rejects foreign tenants on a pinned registry. */
  private tenantGuard(tenantId: string): ActionPolicyResult<never> | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this action-policy registry is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    return null;
  }

  /**
   * The shared approval/rejection admission gates: tenant guard + grammar,
   * decision lookup, tenant match, decision kind, request status, proposal
   * drift, deadline, and approver role (human-approver acting in a quorum
   * role).
   */
  private approvalGate(
    submission: ApprovalSubmission | RejectionSubmission,
    kind: 'approval' | 'rejection',
  ): ActionPolicyResult<{ decision: SealedPolicyDecision; request: ApprovalRequestState }> {
    const guard = this.tenantGuard(submission.tenantId);
    if (guard !== null) {
      return guard;
    }
    const tenant = TenantIdSchema.safeParse(submission.tenantId);
    if (!tenant.success) {
      return { ok: false, error: validationError(tenant.error) };
    }
    const decision = this.decisions.get(submission.decisionDigest);
    if (decision === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-decision',
          message: `no decision is recorded at digest ${submission.decisionDigest}`,
          decisionDigest: submission.decisionDigest,
        },
      };
    }
    if (decision.tenantId !== submission.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `decision ${submission.decisionDigest} belongs to tenant "${decision.tenantId}" — tenant "${submission.tenantId}" cannot ${kind === 'approval' ? 'approve' : 'reject'} it (R12 tenant isolation)`,
          expectedTenantId: decision.tenantId,
          encounteredTenantId: submission.tenantId,
        },
      };
    }
    if (decision.outcome !== 'requires-approval' || decision.approval === undefined) {
      return {
        ok: false,
        error: {
          code: 'decision-not-awaiting-approval',
          message: `decision ${submission.decisionDigest} is an "${decision.outcome}" decision — only a requires-approval decision opens an approval request`,
          decisionDigest: submission.decisionDigest,
          outcome: decision.outcome,
        },
      };
    }
    const request = this.requests.get(submission.decisionDigest);
    if (request === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-decision',
          message: `decision ${submission.decisionDigest} carries no approval request`,
          decisionDigest: submission.decisionDigest,
        },
      };
    }
    // Drift: the approval/rejection concerns EXACTLY the decision's
    // proposal revision.
    if (
      submission.proposalRef.proposalId !== decision.proposalRef.proposalId ||
      submission.proposalRef.canonicalDigest !== decision.proposalRef.canonicalDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'proposal-drift-rejected',
          message: `the ${kind} references proposal revision ${submission.proposalRef.canonicalDigest} but the decision concerns ${decision.proposalRef.canonicalDigest} — it authorizes exactly the referenced revision`,
          decisionDigest: submission.decisionDigest,
          expectedProposalDigest: decision.proposalRef.canonicalDigest,
          encounteredProposalDigest: submission.proposalRef.canonicalDigest,
        },
      };
    }
    return { ok: true, value: { decision, request } };
  }

  /** The typed settled-request negative. */
  private settledError(
    decisionDigest: Sha256Hex,
    status: ApprovalRequestStatus,
    kind: 'approval' | 'rejection',
  ): ActionPolicyResult<never> {
    return {
      ok: false,
      error: {
        code: 'approval-request-settled',
        message: `the approval request of decision ${decisionDigest} is already ${status} — it cannot receive a further ${kind}`,
        decisionDigest,
        status,
      },
    };
  }

  /** Whether the proposal id is chained under a DIFFERENT tenant (if any). */
  private findForeignChain(tenantId: string, proposalId: string): TenantId | null {
    for (const chainKey of this.chains.keys()) {
      if (chainKey.endsWith(`#${proposalId}`) && !chainKey.startsWith(`${tenantId}#`)) {
        return chainKey.slice(0, chainKey.indexOf('#'));
      }
    }
    return null;
  }
}

/** Validate one snapshot request state against its sealed decision. */
function validateRequestState(
  request: ApprovalRequestState,
  decision: SealedPolicyDecision,
  chainPositions: Map<Sha256Hex, number>,
): ActionPolicyResult<true> {
  const directive = decision.approval!;
  const fail = (message: string): ActionPolicyResult<true> => ({
    ok: false,
    error: validationIssues(`snapshot request state is inconsistent: ${message}`, [
      { path: '$.requests', message },
    ]),
  });

  if (request.tenantId !== decision.tenantId) {
    return fail(`request tenant "${request.tenantId}" differs from decision tenant "${decision.tenantId}"`);
  }
  if (
    request.proposalRef.proposalId !== decision.proposalRef.proposalId ||
    request.proposalRef.canonicalDigest !== decision.proposalRef.canonicalDigest
  ) {
    return fail('request proposal reference differs from the decision proposal reference');
  }
  if (!canonicallyEqual(request.directive, directive)) {
    return fail('request directive differs from the decision approval directive');
  }

  const quorum = directive.quorum.approvals;
  const seenApprovers = new Set<string>();
  for (const approval of request.approvals) {
    const verified = verifySealedApproval(approval);
    if (!verified.ok) {
      return verified;
    }
    if (approval.decisionDigest !== request.decisionDigest) {
      return fail('an approval names a different decision');
    }
    if (approval.tenantId !== decision.tenantId) {
      return fail('an approval crosses tenants');
    }
    if (
      approval.proposalRef.proposalId !== decision.proposalRef.proposalId ||
      approval.proposalRef.canonicalDigest !== decision.proposalRef.canonicalDigest
    ) {
      return fail('an approval references a drifted proposal revision');
    }
    if (!directive.quorum.roles.includes(approval.asRole)) {
      return fail(`an approval acts in non-quorum role "${approval.asRole}"`);
    }
    if (seenApprovers.has(approval.decidedBy.id)) {
      return fail(`approver "${approval.decidedBy.id}" approved twice`);
    }
    seenApprovers.add(approval.decidedBy.id);
  }

  switch (request.status) {
    case 'pending': {
      if (request.approvals.length >= quorum) {
        return fail('a pending request already meets its quorum');
      }
      if (request.rejection !== undefined || request.expiry !== undefined || request.supersededBy !== undefined) {
        return fail('a pending request carries settlement records');
      }
      break;
    }
    case 'approved': {
      if (request.approvals.length !== quorum) {
        return fail('an approved request does not meet its quorum exactly');
      }
      if (request.rejection !== undefined || request.expiry !== undefined || request.supersededBy !== undefined) {
        return fail('an approved request carries settlement records');
      }
      break;
    }
    case 'rejected': {
      if (request.rejection === undefined) {
        return fail('a rejected request carries no rejection record');
      }
      const verifiedRejection = verifySealedRejection(request.rejection);
      if (!verifiedRejection.ok) {
        return verifiedRejection;
      }
      if (
        request.rejection.decisionDigest !== request.decisionDigest ||
        request.rejection.tenantId !== decision.tenantId
      ) {
        return fail('the rejection record does not match the request');
      }
      if (request.approvals.length >= quorum) {
        return fail('a rejected request already meets its quorum');
      }
      if (request.expiry !== undefined || request.supersededBy !== undefined) {
        return fail('a rejected request carries other settlement records');
      }
      break;
    }
    case 'expired': {
      if (request.expiry === undefined) {
        return fail('an expired request carries no expiry record');
      }
      const verifiedExpiry = verifySealedExpiry(request.expiry);
      if (!verifiedExpiry.ok) {
        return verifiedExpiry;
      }
      if (
        request.expiry.decisionDigest !== request.decisionDigest ||
        request.expiry.tenantId !== decision.tenantId
      ) {
        return fail('the expiry record does not match the request');
      }
      if (request.expiry.expiredAt <= request.expiry.deadline) {
        return fail('the expiry record does not postdate its deadline');
      }
      if (request.approvals.length >= quorum) {
        return fail('an expired request already meets its quorum');
      }
      if (request.rejection !== undefined || request.supersededBy !== undefined) {
        return fail('an expired request carries other settlement records');
      }
      break;
    }
    case 'superseded': {
      if (request.supersededBy === undefined) {
        return fail('a superseded request names no superseding decision');
      }
      const supersedingPosition = chainPositions.get(request.supersededBy);
      const ownPosition = chainPositions.get(request.decisionDigest);
      if (supersedingPosition === undefined || ownPosition === undefined || supersedingPosition <= ownPosition) {
        return fail('the superseding decision is not a later decision of the same chain');
      }
      if (request.rejection !== undefined || request.expiry !== undefined) {
        return fail('a superseded request carries settlement records');
      }
      break;
    }
    default: {
      return exhaustiveStatus(request.status);
    }
  }

  return { ok: true, value: true };
}

/** The shared approver-role gate: a human approver acting in a quorum role. */
function approverRoleGate(
  submission: ApprovalSubmission | RejectionSubmission,
  request: ApprovalRequestState,
  decision: SealedPolicyDecision,
  kind: 'approval' | 'rejection',
): ActionPolicyError | null {
  if (submission.decidedBy.role !== 'human-approver') {
    return {
      code: 'approver-role-rejected',
      message: `authorizer role "${submission.decidedBy.role}" cannot ${kind === 'approval' ? 'approve' : 'reject'} a human-approval request — only a human approver can`,
      decisionDigest: decision.contentDigest,
      encounteredRole: submission.decidedBy.role,
    };
  }
  if (!request.directive.quorum.roles.includes(submission.asRole)) {
    return {
      code: 'approver-role-rejected',
      message: `quorum role "${submission.asRole}" is not among the request's quorum roles (${request.directive.quorum.roles.join(', ')})`,
      decisionDigest: decision.contentDigest,
      encounteredRole: submission.asRole,
    };
  }
  return null;
}

/** Exhaustiveness guard over the approval-request status vocabulary. */
function exhaustiveStatus(status: never): never {
  throw new Error(`unhandled approval-request status: ${String(status)}`);
}
