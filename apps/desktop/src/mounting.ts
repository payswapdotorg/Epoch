/**
 * The experience-mounting surface (W017): the ONLY path by which an
 * Experience Graph projection enters a desktop window.
 *
 * The pipeline, end to end, consumes upstream contracts and adds no
 * authority of its own:
 *
 * 1. OFFER ADMISSION (W011 + the digest chain): the offered graph is
 *    admitted through the W011 total admission surface (tenant-gated to
 *    the session's tenant); the offered plan document is projected onto
 *    the shell's strict artifact subset (src/plan.ts) and its own digest
 *    is verified against the full document; the chain gate requires the
 *    plan's `sourceEnvelopeDigest` to equal the graph's sealed digest and
 *    the plan's `sourceGraphId` to equal the graph's id (a plan that
 *    compiled from a different revision is a typed `digest-mismatch`);
 *    the tenant gate requires the plan's scope to match the session's
 *    tenant; the device gate requires the plan's target to be a desktop
 *    descriptor (the fidelity ladder rung this shell hosts).
 * 2. INVOCATION (W013, admitInvocation-enforced — NEVER bypassed): the
 *    mount builds a typed `mount-graph` invocation envelope (with the
 *    declared usage the plan projected) and passes it through the W013
 *    enforcement boundary, which re-admits the graph, verifies the
 *    claimed digest, enforces capabilities and budgets, and returns the
 *    next sealed binding revision plus the sealed execution receipt.
 *    Frame advances and intent submissions flow through the same
 *    boundary (`advance-frame`, `submit-intent`).
 * 3. BYPASS GUARD: {@link rejectAdmissionBypass} is the typed negative
 *    surface — every attempt to reach renderer state without an admitted
 *    invocation (direct binding writes, unadmitted mounts, receipt
 *    forgery) is a typed `authority-violation`. The shell's state itself
 *    offers no such path: bindings advance ONLY through
 *    {@link admitInvocation} outcomes, and receipts enter the log ONLY
 *    from admitted invocations.
 */
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import {
  parseExperienceGraph,
  type ExperienceGraph,
} from '@epoch/experience-protocol';
import {
  RENDERER_INVOCATION_SCHEMA_NAME,
  RENDERER_PROTOCOL_VERSION,
  admitInvocation,
  type InvocationEnvelope,
  type InteractionModality,
  type RendererBinding,
  type RendererReceipt,
  type RendererRuntimeError,
} from '@epoch/renderer-runtime';
import {
  authorityViolationError,
  crossTenantDeniedError,
  desktopOk,
  invocationRejectedError,
  type DesktopResult,
} from './errors';
import {
  projectPlanArtifact,
  verifyPlanDocument,
  type PlanArtifact,
} from './plan';
import type { AdmissionBypassAttempt } from './version';

/** One admitted, mountable experience (a verified offer). */
export interface MountableExperience {
  /** The admitted, sealed W011 Experience Graph. */
  readonly graph: ExperienceGraph;
  /** The projected W012 plan artifact (strict subset). */
  readonly plan: PlanArtifact;
  /** The verbatim full plan document (content-addressed by plan.digest). */
  readonly planDocument: JsonValue;
  /** The envelope that offered the experience (provenance). */
  readonly offeredByEnvelopeId: string;
  /** The virtual time the offer was admitted. */
  readonly offeredAtMs: number;
}

/** The session facts an offer is admitted against. */
export interface OfferAdmissionContext {
  /** The tenant the session is scoped to (R12 gate). */
  readonly tenantId: string;
}

/**
 * Admit one experience offer (graph + compiled plan). Total and typed;
 * see the module docs for the fixed gate order: W011 graph admission
 * (tenant-gated) -> plan projection -> plan-document digest verification
 * -> chain gate -> plan tenant gate -> plan device gate.
 */
export function admitExperienceOffer(
  context: OfferAdmissionContext,
  offer: {
    readonly graph: unknown;
    readonly plan: unknown;
  },
  provenance: { readonly envelopeId: string; readonly atMs: number },
): DesktopResult<MountableExperience> {
  // 1. W011 admission of the graph, tenant-gated to the session.
  const graphAdmitted = parseExperienceGraph(offer.graph, {
    expectedTenantId: context.tenantId,
  });
  if (!graphAdmitted.ok) {
    if (graphAdmitted.error.code === 'cross-tenant-denied') {
      return {
        ok: false,
        error: crossTenantDeniedError(
          'graph.tenantScope.tenantId',
          graphAdmitted.error.expectedTenantId,
          graphAdmitted.error.encounteredTenantId,
        ),
      };
    }
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `the offered Experience Graph failed W011 admission (${graphAdmitted.error.code})`,
        issues: [{ path: 'graph', message: graphAdmitted.error.message }],
      },
    };
  }
  const graph = graphAdmitted.value;

  // 2. Plan projection (strict structural subset).
  const planProjected = projectPlanArtifact(offer.plan);
  if (!planProjected.ok) {
    return planProjected;
  }
  const plan = planProjected.value;

  // 3. Full-document digest verification (tamper detection).
  const planVerified = verifyPlanDocument(offer.plan);
  if (!planVerified.ok) {
    return planVerified;
  }
  if (planVerified.value !== plan.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the projected plan digest does not match the verified document digest',
        path: 'plan.digest',
        expected: planVerified.value,
        encountered: plan.digest,
      },
    };
  }

  // 4. Chain gate: the plan compiled from THIS graph revision.
  if (plan.sourceEnvelopeDigest !== graph.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'the compiled plan chains from a different graph revision than the offered graph — the offer is rejected',
        path: 'plan.sourceEnvelopeDigest',
        expected: graph.digest,
        encountered: plan.sourceEnvelopeDigest,
      },
    };
  }
  if (plan.sourceGraphId !== graph.graphId) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the compiled plan names a different source graph id than the offered graph',
        path: 'plan.sourceGraphId',
        expected: graph.graphId,
        encountered: plan.sourceGraphId,
      },
    };
  }

  // 5. Plan tenant gate (R12).
  if (plan.tenantScope.tenantId !== context.tenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        'plan.tenantScope.tenantId',
        context.tenantId,
        plan.tenantScope.tenantId,
      ),
    };
  }

  // 6. Device gate: the plan targets a desktop surface (the ladder rung).
  if (plan.target.deviceClass !== 'desktop') {
    return {
      ok: false,
      error: {
        code: 'device-mismatch',
        message:
          `the compiled plan targets a "${plan.target.deviceClass}" device; ` +
          'this shell hosts "desktop" surfaces',
        expected: 'desktop',
        encountered: plan.target.deviceClass,
      },
    };
  }

  return desktopOk({
    graph,
    plan,
    planDocument: offer.plan as JsonValue,
    offeredByEnvelopeId: provenance.envelopeId,
    offeredAtMs: provenance.atMs,
  });
}

/** The verified digest of a mountable experience's graph (its address). */
export function experienceGraphAddress(experience: MountableExperience): Sha256Hex {
  return experience.graph.digest;
}

// ---------------------------------------------------------------------------
// W013 invocation drivers (the only paths to renderer state).
// ---------------------------------------------------------------------------

/** Mount one admitted experience into a bound window (W013-enforced). */
export function mountExperience(input: {
  readonly binding: RendererBinding;
  readonly experience: MountableExperience;
  readonly invocationId: string;
  readonly atMs: number;
}): DesktopResult<{ readonly binding: RendererBinding; readonly receipt: RendererReceipt }> {
  const envelope: InvocationEnvelope = {
    schema: RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    kind: 'mount-graph',
    invocationId: input.invocationId,
    rendererSessionId: input.binding.rendererSessionId,
    graphDigest: input.experience.graph.digest,
    atMs: input.atMs,
    declaredTriangles: input.experience.plan.usage.estimatedTriangles,
    declaredTextureBytes: input.experience.plan.usage.assetBytes,
  };
  return driveInvocation(input.binding, envelope, {
    graph: input.experience.graph,
    expectedTenantId: input.experience.graph.tenantScope.tenantId,
  });
}

/** Execute one frame of the mounted state (W013-enforced, monotonic). */
export function advanceFrame(input: {
  readonly binding: RendererBinding;
  readonly frameIndex: number;
  readonly invocationId: string;
  readonly atMs: number;
}): DesktopResult<{ readonly binding: RendererBinding; readonly receipt: RendererReceipt }> {
  const envelope: InvocationEnvelope = {
    schema: RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    kind: 'advance-frame',
    invocationId: input.invocationId,
    rendererSessionId: input.binding.rendererSessionId,
    frameIndex: input.frameIndex,
    atMs: input.atMs,
  };
  return driveInvocation(input.binding, envelope, {});
}

/** Admit one typed control intent from a declared modality (W013-enforced). */
export function submitIntent(input: {
  readonly binding: RendererBinding;
  readonly modality: InteractionModality;
  readonly intent: { readonly id: string; readonly version: string };
  readonly invocationId: string;
}): DesktopResult<{ readonly binding: RendererBinding; readonly receipt: RendererReceipt }> {
  const envelope: InvocationEnvelope = {
    schema: RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: RENDERER_PROTOCOL_VERSION,
    kind: 'submit-intent',
    invocationId: input.invocationId,
    rendererSessionId: input.binding.rendererSessionId,
    modality: input.modality,
    intent: input.intent,
  };
  return driveInvocation(input.binding, envelope, {});
}

/** Drive one invocation through the W013 boundary (the single choke point). */
function driveInvocation(
  binding: RendererBinding,
  envelope: InvocationEnvelope,
  input: { graph?: unknown; expectedTenantId?: string },
): DesktopResult<{ readonly binding: RendererBinding; readonly receipt: RendererReceipt }> {
  const outcome = admitInvocation(binding, envelope, input);
  if (!outcome.ok) {
    return { ok: false, error: invocationRejectedError(outcome.error) };
  }
  return desktopOk(outcome.value);
}

// ---------------------------------------------------------------------------
// The bypass guard (typed negative surface).
// ---------------------------------------------------------------------------

/** One admission-bypass attempt (always rejected). */
export interface AdmissionBypassAttemptInput {
  readonly kind: AdmissionBypassAttempt;
  /** What the attempt targeted (free-form, for the typed record). */
  readonly detail?: string | undefined;
}

/**
 * The admission-bypass guard: EVERY attempt to reach renderer state
 * without an admitted W013 invocation is a typed `authority-violation`.
 * This function exists so the negative surface is explicit and testable —
 * the shell's own state offers no such path (bindings advance only
 * through {@link driveInvocation}, receipts enter logs only from admitted
 * invocations).
 */
export function rejectAdmissionBypass(
  attempt: AdmissionBypassAttemptInput,
): DesktopResult<never> {
  const detail = attempt.detail ?? 'no detail provided';
  return {
    ok: false,
    error: authorityViolationError(
      `renderer admission cannot be bypassed (attempt: ${attempt.kind}) — every mount, frame, and intent must pass through the W013 invocation boundary (${detail})`,
      [{ path: 'renderer', attempt: attempt.kind }],
    ),
  };
}

/** Digest helper for receipt-log addressing (the sealed receipt's own digest). */
export function receiptDigest(receipt: RendererReceipt): Sha256Hex {
  return receipt.digest;
}

/** The typed pass-through of a W013 error (for tests + callers). */
export function asRendererRuntimeError(error: unknown): RendererRuntimeError | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const candidate = error as { code?: unknown };
    if (
      candidate.code === 'budget-exceeded' ||
      candidate.code === 'capability-denied' ||
      candidate.code === 'cross-tenant-denied' ||
      candidate.code === 'digest-mismatch' ||
      candidate.code === 'invalid-invocation' ||
      candidate.code === 'malformed-invocation' ||
      candidate.code === 'malformed-record' ||
      candidate.code === 'session-closed' ||
      candidate.code === 'unknown-session' ||
      candidate.code === 'version-unsupported'
    ) {
      return error as RendererRuntimeError;
    }
  }
  return null;
}
