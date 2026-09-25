/**
 * Digest discipline for orchestration documents: content addressing over
 * the runtime-neutral canonical machinery from @epoch/agent-protocol
 * (SHA-256 over canonical JSON). Every digest function is PURE — identical
 * inputs produce identical digests, regardless of key order — and the
 * compiled-plan digest additionally ignores authoring order (the plan is
 * normalized before hashing), so semantically identical plans are
 * content-addressed identically.
 *
 * Tamper detection: `verifyCompiledPlanDigest` recomputes the digest of a
 * compiled plan's content and rejects a claimed mismatch
 * (`digest-mismatch`) — a serialized plan whose content was altered after
 * compilation never re-enters a session.
 */
import { canonicalDigest, canonicalJsonStringify, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type {
  AgentBinding,
  CompiledPlan,
  CompiledPlanStep,
  OrchestrationResult,
  OrchestrationSession,
  ProposalHandoff,
} from './types';

/**
 * The canonical normalized plan content over which the plan digest is
 * computed: schemaVersion, tenant, ids, and the steps in their CANONICAL
 * form (dependsOn sorted + de-duplicated, retry policy defaulted) — in
 * their compiled (deterministic topological) order.
 */
export function normalizedPlanContent(steps: readonly CompiledPlanStep[]) {
  return {
    steps: steps.map((step) => ({
      stepId: step.stepId,
      agentId: step.agentId,
      proposal: {
        proposalId: step.proposal.proposalId,
        canonicalDigest: step.proposal.canonicalDigest,
      },
      dependsOn: [...step.dependsOn],
      retryPolicy: {
        maxAttempts: step.retryPolicy.maxAttempts,
        retryOn: [...step.retryPolicy.retryOn],
      },
    })),
  };
}

/**
 * Content-addressed identity of a compiled plan: SHA-256 over the canonical
 * JSON of the normalized plan content (tenant, plan id, display/author
 * metadata, and the canonically-ordered steps). Semantically identical
 * authored plans (any step authoring order, any dependsOn order) produce
 * the same digest; any semantic difference produces a different one.
 */
export function computePlanDigest(plan: Omit<CompiledPlan, 'planDigest' | 'stepCount'>): Sha256Hex {
  const content: JsonValue = {
    schemaVersion: plan.schemaVersion,
    tenantId: plan.tenantId,
    planId: plan.planId,
    ...(plan.displayName === undefined ? {} : { displayName: plan.displayName }),
    ...(plan.createdBy === undefined ? {} : { createdBy: plan.createdBy }),
    ...normalizedPlanContent(plan.steps),
  };
  return canonicalDigest(content);
}

/**
 * Verify a compiled plan's claimed digest against the recomputed digest of
 * its content (tamper detection). Total.
 */
export function verifyCompiledPlanDigest(plan: CompiledPlan): OrchestrationResult<CompiledPlan> {
  const { planDigest, ...content } = plan;
  const expected = computePlanDigest(content);
  if (expected !== planDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'compiled plan digest does not match its content (tampered or mismatched document) — the plan is rejected',
        expected,
        encountered: planDigest,
      },
    };
  }
  return { ok: true, value: plan };
}

/**
 * Content-addressed identity of an agent binding: SHA-256 over the
 * canonical JSON of the binding content (the agent descriptor plus the
 * resolved capability pins, sorted canonically at binding time).
 */
export function computeAgentBindingDigest(binding: Omit<AgentBinding, 'bindingDigest'>): Sha256Hex {
  const content: JsonValue = {
    schemaVersion: binding.schemaVersion,
    agent: {
      schemaVersion: binding.agent.schemaVersion,
      agentId: binding.agent.agentId,
      ...(binding.agent.displayName === undefined
        ? {}
        : { displayName: binding.agent.displayName }),
      capabilities: binding.agent.capabilities.map((pin) => ({
        capabilityId: pin.capabilityId,
        version: pin.version,
      })),
    },
    capabilities: binding.capabilities.map((pin) => ({
      capabilityId: pin.capabilityId,
      version: pin.version,
      category: pin.category,
      lifecycleAtBinding: pin.lifecycleAtBinding,
    })),
  };
  return canonicalDigest(content);
}

/**
 * Content-addressed identity of a proposal handoff record: SHA-256 over
 * the canonical JSON of the handoff content (everything except the digest
 * itself).
 */
export function computeProposalHandoffDigest(
  handoff: Omit<ProposalHandoff, 'handoffDigest'>,
): Sha256Hex {
  const content: JsonValue = {
    schemaVersion: handoff.schemaVersion,
    sessionId: handoff.sessionId,
    tenantId: handoff.tenantId,
    stepId: handoff.stepId,
    agentId: handoff.agentId,
    proposal: {
      proposalId: handoff.proposal.proposalId,
      canonicalDigest: handoff.proposal.canonicalDigest,
    },
    attempt: handoff.attempt,
    handedOffAt: handoff.handedOffAt,
  };
  return canonicalDigest(content);
}

/**
 * Content-addressed identity of a whole session state: SHA-256 over the
 * canonical JSON of the session document. Two runtimes that executed the
 * same plan over the same event history hold byte-identical session states
 * and therefore identical digests — the replay/idempotency evidence.
 */
export function computeSessionStateDigest(session: OrchestrationSession): Sha256Hex {
  return canonicalDigest(session as unknown as JsonValue);
}

/** Canonical JSON serialization of a session (stable key order). */
export function canonicalSessionJson(session: OrchestrationSession): string {
  return canonicalJsonStringify(session as unknown as JsonValue);
}
