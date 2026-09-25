/**
 * The invocation admission + enforcement pipeline — the renderer hosting
 * BOUNDARY (W013).
 *
 * `admitInvocation` is total: it takes the current sealed binding, an
 * invocation envelope (plus, for `mount-graph`, the graph document the
 * envelope references), and returns either the next sealed binding
 * revision together with the sealed receipt, or a typed
 * {@link RendererRuntimeError}. It NEVER mutates its inputs, NEVER reads
 * a wall clock, and NEVER interprets kernel semantics — the renderer
 * runtime EXECUTES plans, it does not author them.
 *
 * Admission precedence (fixed, so consumers branch deterministically):
 *
 * 1. root shape — a non-object envelope root is a `malformed-invocation`;
 * 2. version gate — a string `protocolVersion` that differs from `1.0.0`
 *    fails fast with `version-unsupported`;
 * 3. envelope schema gate — full zod validation; strict objects reject
 *    unknown (vendor/engine) fields; failures surface as
 *    `malformed-invocation` with precise dotted paths;
 * 4. session gate — the envelope's `rendererSessionId` must equal the
 *    binding's (`unknown-session`);
 * 5. closed gate — the binding must be `open` (`session-closed`);
 * 6. tenant gate — the optional caller-supplied expected tenant must
 *    match the binding's device-snapshot tenant (`cross-tenant-denied`,
 *    R12);
 * 7. per-kind enforcement:
 *    - `mount-graph`: graph document present; W011 admission of the graph
 *      (a typed W011 failure wraps as `malformed-invocation` with the
 *      verbatim typed `cause`; a cross-tenant graph failure promotes to
 *      the boundary's own `cross-tenant-denied`); the envelope's claimed
 *      digest must match the graph's sealed digest (`digest-mismatch`);
 *      the graph kind must be declared by the binding
 *      (`capability-denied`); node/edge counts and declared
 *      triangle/texture usage must fit the effective limits
 *      (`budget-exceeded`; a bounded spatial kind requires its usage
 *      declaration — `invalid-invocation`);
 *    - `advance-frame`: the frame index must be strictly greater than the
 *      binding's last admitted frame index (`invalid-invocation`);
 *    - `submit-intent`: the intent's modality must be declared by the
 *      binding's effective interaction set (`capability-denied`).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { parseExperienceGraph } from '@epoch/experience-protocol';
import { InvocationEnvelopeSchema, type InvocationEnvelope } from './invocation';
import {
  RendererBindingContentSchema,
  type RendererBinding,
} from './binding';
import {
  RendererReceiptContentSchema,
  type RendererReceipt,
  type RendererReceiptContent,
} from './receipt';
import { malformedInvocationError } from './issues';
import type { RendererRuntimeError, RendererRuntimeResult } from './errors';
import { RENDERER_PROTOCOL_VERSION } from './version';

/** The outcome of one admitted invocation. */
export interface InvocationOutcome {
  /** The next sealed binding revision (a new record; input unchanged). */
  readonly binding: RendererBinding;
  /** The sealed execution-evidence receipt of the admitted invocation. */
  readonly receipt: RendererReceipt;
}

/** The typed input accompanying an invocation envelope. */
export interface InvocationInput {
  /**
   * The graph document a `mount-graph` envelope references (required for
   * `mount-graph`; ignored otherwise). Admitted through the W011 total
   * admission surface before any renderer enforcement.
   */
  readonly graph?: unknown;
  /**
   * The tenant the caller is invoking FOR. When provided, a binding owned
   * by a different tenant is rejected with `cross-tenant-denied` (R12).
   */
  readonly expectedTenantId?: string;
}

function envelopeRootError(): RendererRuntimeError {
  return {
    code: 'malformed-invocation',
    message: 'invocation envelope root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the envelope root' }],
  };
}

function envelopeVersionGate(input: unknown): RendererRuntimeError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return envelopeRootError();
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== RENDERER_PROTOCOL_VERSION) {
    return {
      code: 'version-unsupported',
      message: `protocol version mismatch: expected ${RENDERER_PROTOCOL_VERSION}, encountered ${encountered}`,
      expected: RENDERER_PROTOCOL_VERSION,
      encountered,
    };
  }
  return null;
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): RendererRuntimeError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant invocation denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

function capabilityDenial(
  path: readonly (string | number)[],
  declared: readonly string[],
  encountered: string,
): RendererRuntimeError {
  return {
    code: 'capability-denied',
    message: `use of undeclared capability "${encountered}" is denied — the binding declares [${declared.join(', ')}]`,
    path: [...path],
    declared: [...declared],
    encountered,
  };
}

function budgetExceeded(
  path: readonly (string | number)[],
  resource: 'graph-edges' | 'graph-nodes' | 'texture-bytes' | 'triangles',
  limit: number,
  encountered: number,
): RendererRuntimeError {
  return {
    code: 'budget-exceeded',
    message: `usage of ${resource} (${encountered}) exceeds the binding's effective limit (${limit}) — the invocation is denied`,
    path: [...path],
    resource,
    limit,
    encountered,
  };
}

function sealReceipt(content: RendererReceiptContent): RendererReceipt {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  } as RendererReceipt;
}

/** Reseal the binding with the changed fields (pure: returns a new record). */
function resealed(
  binding: RendererBinding,
  changes: Partial<Omit<RendererBinding, 'digest'>>,
): RendererBinding {
  const { digest: _sealed, ...content } = binding;
  void _sealed;
  const next = RendererBindingContentSchema.parse({ ...content, ...changes });
  return { ...next, digest: canonicalDigest(next as unknown as JsonValue) };
}

/**
 * Admit (or deny) one invocation envelope against a sealed renderer
 * binding. Total; see the module docs for the fixed precedence of typed
 * errors.
 */
export function admitInvocation(
  binding: RendererBinding,
  envelope: unknown,
  input?: InvocationInput,
): RendererRuntimeResult<InvocationOutcome> {
  // Precedence 1-2: root shape + version gate.
  const versionFailure = envelopeVersionGate(envelope);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }

  // Precedence 3: envelope schema gate (structure, strictness).
  const schemaParsed = InvocationEnvelopeSchema.safeParse(envelope);
  if (!schemaParsed.success) {
    return { ok: false, error: malformedInvocationError(schemaParsed.error) };
  }
  const typed = schemaParsed.data;

  // Precedence 4: session gate.
  if (typed.rendererSessionId !== binding.rendererSessionId) {
    return {
      ok: false,
      error: {
        code: 'unknown-session',
        message: `invocation targets renderer session "${typed.rendererSessionId}", but the binding hosts "${binding.rendererSessionId}"`,
        expectedSessionId: binding.rendererSessionId,
        encounteredSessionId: typed.rendererSessionId,
      },
    };
  }

  // Precedence 5: closed gate.
  if (binding.state === 'closed') {
    return {
      ok: false,
      error: {
        code: 'session-closed',
        message: 'the renderer session is closed — invocations are rejected',
        rendererSessionId: binding.rendererSessionId,
      },
    };
  }

  // Precedence 6: tenant gate.
  const bindingTenant = binding.device.tenantScope.tenantId;
  if (input?.expectedTenantId !== undefined && input.expectedTenantId !== bindingTenant) {
    return {
      ok: false,
      error: tenantDenial(
        ['device', 'tenantScope', 'tenantId'],
        input.expectedTenantId,
        bindingTenant,
      ),
    };
  }

  // Precedence 7: per-kind enforcement.
  if (typed.kind === 'mount-graph') {
    return admitMountGraph(binding, typed, input);
  }
  if (typed.kind === 'advance-frame') {
    return admitAdvanceFrame(binding, typed);
  }
  return admitSubmitIntent(binding, typed);
}

// ---------------------------------------------------------------------------
// mount-graph enforcement.
// ---------------------------------------------------------------------------

function admitMountGraph(
  binding: RendererBinding,
  envelope: Extract<InvocationEnvelope, { readonly kind: 'mount-graph' }>,
  input: InvocationInput | undefined,
): RendererRuntimeResult<InvocationOutcome> {
  // 7a. The referenced graph document must be supplied.
  if (input?.graph === undefined) {
    return {
      ok: false,
      error: {
        code: 'malformed-invocation',
        message: 'a mount-graph invocation requires the graph document it references',
        issues: [{ path: 'graph', message: 'the referenced graph document is missing' }],
      },
    };
  }

  // 7b. W011 admission of the graph document (tenant-gated to the binding).
  const graphAdmitted = parseExperienceGraph(input.graph, {
    expectedTenantId: binding.device.tenantScope.tenantId,
  });
  if (!graphAdmitted.ok) {
    // Tenant isolation is THIS boundary's duty (R12): a graph owned by
    // another tenant surfaces as the renderer runtime's own typed
    // cross-tenant denial (the W011 cause chain stays attached via the
    // message); every other W011 admission failure wraps as
    // malformed-invocation with the verbatim typed cause.
    if (graphAdmitted.error.code === 'cross-tenant-denied') {
      return {
        ok: false,
        error: tenantDenial(
          ['graph', ...graphAdmitted.error.path],
          graphAdmitted.error.expectedTenantId,
          graphAdmitted.error.encounteredTenantId,
        ),
      };
    }
    return {
      ok: false,
      error: {
        code: 'malformed-invocation',
        message: `the mounted Experience Graph failed W011 admission (${graphAdmitted.error.code})`,
        issues: [
          {
            path: 'graph',
            message: `W011 admission rejected the graph: ${graphAdmitted.error.message}`,
          },
        ],
        cause: graphAdmitted.error,
      },
    };
  }
  const graph = graphAdmitted.value;

  // 7c. Digest gate: the envelope's claimed digest must match the sealed
  // graph's digest (tamper detection).
  if (envelope.graphDigest !== graph.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'the mount envelope claims a graph digest that does not match the supplied document — the invocation is rejected',
        path: ['graphDigest'],
        expected: envelope.graphDigest,
        encountered: graph.digest,
      },
    };
  }

  // 7d. Capability gate: the graph kind must be declared by the binding.
  if (!binding.effective.graphKinds.includes(graph.graphKind)) {
    return {
      ok: false,
      error: capabilityDenial(['graph', 'graphKind'], binding.effective.graphKinds, graph.graphKind),
    };
  }

  // 7e. Budget gates (fixed order: nodes, edges, triangles, texture bytes).
  // Triangle/texture declarations are required only for spatial kinds
  // ('3d', 'animation') on bounded bindings — the only kinds whose content
  // can consume those resources; declared usage is always checked when a
  // limit exists.
  if (graph.nodes.length > binding.effective.maxGraphNodes) {
    return {
      ok: false,
      error: budgetExceeded(
        ['graph', 'nodes'],
        'graph-nodes',
        binding.effective.maxGraphNodes,
        graph.nodes.length,
      ),
    };
  }
  if (graph.edges.length > binding.effective.maxGraphEdges) {
    return {
      ok: false,
      error: budgetExceeded(
        ['graph', 'edges'],
        'graph-edges',
        binding.effective.maxGraphEdges,
        graph.edges.length,
      ),
    };
  }
  const spatialKind = graph.graphKind === '3d' || graph.graphKind === 'animation';
  if (binding.effective.maxTriangles !== undefined) {
    if (spatialKind && envelope.declaredTriangles === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalid-invocation',
          message:
            'the binding bounds triangle usage and the graph kind is spatial, so the mount envelope must declare its triangle usage (declaredTriangles)',
          path: ['declaredTriangles'],
          expected: 'a non-negative declared triangle usage',
          encountered: 'absent',
        },
      };
    }
    if (
      envelope.declaredTriangles !== undefined &&
      envelope.declaredTriangles > binding.effective.maxTriangles
    ) {
      return {
        ok: false,
        error: budgetExceeded(
          ['declaredTriangles'],
          'triangles',
          binding.effective.maxTriangles,
          envelope.declaredTriangles,
        ),
      };
    }
  }
  if (binding.effective.maxTextureBytes !== undefined) {
    if (spatialKind && envelope.declaredTextureBytes === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalid-invocation',
          message:
            'the binding bounds texture-memory usage and the graph kind is spatial, so the mount envelope must declare its texture usage (declaredTextureBytes)',
          path: ['declaredTextureBytes'],
          expected: 'a non-negative declared texture-byte usage',
          encountered: 'absent',
        },
      };
    }
    if (
      envelope.declaredTextureBytes !== undefined &&
      envelope.declaredTextureBytes > binding.effective.maxTextureBytes
    ) {
      return {
        ok: false,
        error: budgetExceeded(
          ['declaredTextureBytes'],
          'texture-bytes',
          binding.effective.maxTextureBytes,
          envelope.declaredTextureBytes,
        ),
      };
    }
  }

  // Admitted: the next binding revision mounts the verified state.
  const nextBinding = resealed(binding, {
    mountedStateDigest: graph.digest,
    mountedAtMs: envelope.atMs,
    invocationCount: binding.invocationCount + 1,
  });
  const receipt = sealReceipt(
    RendererReceiptContentSchema.parse({
      schema: 'epoch.renderer-receipt',
      protocolVersion: RENDERER_PROTOCOL_VERSION,
      kind: 'mount-receipt',
      invocationId: envelope.invocationId,
      rendererSessionId: envelope.rendererSessionId,
      tenantScope: binding.device.tenantScope,
      graphDigest: graph.digest,
      graphKind: graph.graphKind,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      mountedAtMs: envelope.atMs,
      declaredTriangles: envelope.declaredTriangles,
      declaredTextureBytes: envelope.declaredTextureBytes,
    }),
  );
  return { ok: true, value: { binding: nextBinding, receipt } };
}

// ---------------------------------------------------------------------------
// advance-frame enforcement.
// ---------------------------------------------------------------------------

function admitAdvanceFrame(
  binding: RendererBinding,
  envelope: Extract<InvocationEnvelope, { readonly kind: 'advance-frame' }>,
): RendererRuntimeResult<InvocationOutcome> {
  // 7. Monotonic execution order: strictly increasing frame indices.
  const last = binding.lastFrameIndex ?? -1;
  if (envelope.frameIndex <= last) {
    return {
      ok: false,
      error: {
        code: 'invalid-invocation',
        message: `frame execution is monotonic: frame ${envelope.frameIndex} cannot follow frame ${last}`,
        path: ['frameIndex'],
        expected: `a frame index greater than ${last}`,
        encountered: String(envelope.frameIndex),
      },
    };
  }

  // Admitted: the frame executes against the state mounted BEFORE this
  // invocation.
  const nextBinding = resealed(binding, {
    lastFrameIndex: envelope.frameIndex,
    invocationCount: binding.invocationCount + 1,
  });
  const receipt = sealReceipt(
    RendererReceiptContentSchema.parse({
      schema: 'epoch.renderer-receipt',
      protocolVersion: RENDERER_PROTOCOL_VERSION,
      kind: 'frame-receipt',
      invocationId: envelope.invocationId,
      rendererSessionId: envelope.rendererSessionId,
      tenantScope: binding.device.tenantScope,
      frameIndex: envelope.frameIndex,
      atMs: envelope.atMs,
      stateDigest: binding.mountedStateDigest,
    }),
  );
  return { ok: true, value: { binding: nextBinding, receipt } };
}

// ---------------------------------------------------------------------------
// submit-intent enforcement.
// ---------------------------------------------------------------------------

function admitSubmitIntent(
  binding: RendererBinding,
  envelope: Extract<InvocationEnvelope, { readonly kind: 'submit-intent' }>,
): RendererRuntimeResult<InvocationOutcome> {
  // 7. Capability gate: the emitting modality must be declared by the
  // binding's effective interaction set (the W008 permission pattern).
  if (!binding.effective.interaction.includes(envelope.modality)) {
    return {
      ok: false,
      error: capabilityDenial(['modality'], binding.effective.interaction, envelope.modality),
    };
  }

  // Admitted: the typed intent is recorded as execution evidence; it is
  // never semantic authority here (lock rule 3 — future wiring routes
  // intents through the Action Gateway).
  const nextBinding = resealed(binding, {
    invocationCount: binding.invocationCount + 1,
  });
  const receipt = sealReceipt(
    RendererReceiptContentSchema.parse({
      schema: 'epoch.renderer-receipt',
      protocolVersion: RENDERER_PROTOCOL_VERSION,
      kind: 'intent-receipt',
      invocationId: envelope.invocationId,
      rendererSessionId: envelope.rendererSessionId,
      tenantScope: binding.device.tenantScope,
      modality: envelope.modality,
      intent: envelope.intent,
    }),
  );
  return { ok: true, value: { binding: nextBinding, receipt } };
}
