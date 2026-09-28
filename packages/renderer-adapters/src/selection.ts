/**
 * The deterministic adapter selection — the renderer-side core of
 * Renderer/Device Adaptation (the W013 pin: "concrete engines are future
 * adapters behind the descriptor contract; W019 adapts").
 *
 * `selectRendererAdapter` consumes a sealed W013 {@link RendererBinding}
 * (the negotiated enforcement envelope) plus a sealed W019
 * {@link DeviceCapabilityAssessment} (the device-side tier derivation)
 * and produces a sealed {@link RendererAdapterSelection}: the chosen
 * neutral TECHNIQUE, the typed reason, the ordered fallback chain, and
 * the full decision trace (every candidate technique in canonical order
 * with its typed eligibility verdict — the decision is data, never
 * prose, never an unexplained verdict).
 *
 * Deterministic decision rules (fixed precedence, the frozen
 * device-adaptation table rendered as logic):
 *
 * 0. INTEGRITY — the assessment must assess EXACTLY the binding's
 *    device descriptor (member-for-member), else a typed
 *    `assessment-device-mismatch` rejection;
 * 1. REMOTE ASSIST — when the assessment recommends the optional remote
 *    path, select `remote-stream` (`remote-assist-recommended`);
 * 2. STEREOSCOPIC — when the binding negotiated stereoscopic output and
 *    the compositor hosts the effective kinds, select
 *    `stereoscopic-compositor` (`stereoscopic-negotiated`);
 * 3. SPATIAL — when the effective kinds include a spatial kind, select
 *    `retained-scene-3d` (`spatial-kinds-local`, or
 *    `spatial-kinds-local-degraded` on a reduced-tier device — local
 *    reduced 3D paired with progressive-scene degradation, the frozen
 *    "low capability = 2D/reduced 3D" row);
 * 4. FLAT — otherwise select `immediate-2d` (`flat-kinds`);
 * 5. FALLBACK — when the preferred local technique does not host the
 *    effective kinds, select `remote-stream`
 *    (`local-technique-unavailable`); when even the remote technique
 *    cannot host them, the answer is a typed
 *    `no-eligible-technique` rejection.
 *
 * Determinism: the selection is a pure function of the binding, the
 * assessment, and the caller-supplied selection id; zero wall-clock,
 * zero randomness, zero I/O. Tenant isolation (R12): the selection
 * adopts the binding's tenant scope; cross-tenant selection is a typed
 * `cross-tenant-denied` rejection.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { RendererBinding } from '@epoch/renderer-runtime';
import {
  RendererBindingSchema,
  verifyRendererBindingDigest,
} from '@epoch/renderer-runtime';
import type { DeviceCapabilityAssessment } from '@epoch/device-capabilities';
import {
  DeviceCapabilityAssessmentSchema,
  verifyAssessmentDigest,
} from '@epoch/device-capabilities';
import {
  RENDERER_ADAPTER_SELECTION_SCHEMA_NAME,
  RENDERER_ADAPTERS_PROTOCOL_VERSION,
  RENDERER_TECHNIQUES,
  MAX_SELECTION_TRACE_ENTRIES,
  RendererTechniqueSchema,
  SelectionReasonSchema,
  EligibilityReasonSchema,
  type RendererTechnique,
  type SelectionReason,
  type EligibilityReason,
} from './version';
import {
  SelectionIdSchema,
  Sha256HexSchema,
  TenantScopeSchema,
} from './primitives';
import {
  RENDERER_TECHNIQUE_CATALOG,
  techniqueHostsKinds,
  hasSpatialKinds,
} from './technique';
import { crossTenantDeniedError, assessmentDeviceMismatchError } from './issues';
import type { RendererAdaptersResult } from './errors';

// ---------------------------------------------------------------------------
// The decision trace.
// ---------------------------------------------------------------------------

/** One trace entry: a candidate technique and its typed verdict. */
export const SelectionTraceEntrySchema = z
  .strictObject({
    technique: RendererTechniqueSchema,
    /** Whether the technique is eligible for this binding. */
    eligible: z.boolean(),
    /** The typed verdict (rejections carry the reason; acceptances carry
     * `not-preferred` when a more preferred technique won). */
    reason: EligibilityReasonSchema,
  })
  .meta({
    id: 'SelectionTraceEntry',
    title: 'SelectionTraceEntry',
    description:
      'One decision-trace entry: candidate technique, eligibility, and the typed verdict.',
  });

/** One trace entry. */
export type SelectionTraceEntry = z.infer<typeof SelectionTraceEntrySchema>;

// ---------------------------------------------------------------------------
// The sealed selection record.
// ---------------------------------------------------------------------------

/** The content of an adapter selection (everything except the digest). */
export const RendererAdapterSelectionContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_ADAPTER_SELECTION_SCHEMA_NAME),
    protocolVersion: z.literal(RENDERER_ADAPTERS_PROTOCOL_VERSION),
    selectionId: SelectionIdSchema,
    /** The tenant scope adopted from the binding (R12). */
    tenantScope: TenantScopeSchema,
    /** The W013 renderer session this selection serves. */
    rendererSessionId: z.string().regex(/^rs-[a-z0-9][a-z0-9-]{0,62}$/),
    /** The exact binding revision this selection was derived from. */
    bindingDigest: Sha256HexSchema,
    /** The exact assessment revision this selection was derived from. */
    assessmentDigest: Sha256HexSchema,
    /** The chosen neutral technique. */
    technique: RendererTechniqueSchema,
    /** The typed reason the technique was chosen. */
    reason: SelectionReasonSchema,
    /** The ordered fallback chain (eligible alternatives, most preferred first). */
    fallbackChain: z.array(RendererTechniqueSchema).readonly(),
    /** The full decision trace (every technique in canonical order). */
    trace: z
      .array(SelectionTraceEntrySchema)
      .min(1)
      .max(MAX_SELECTION_TRACE_ENTRIES)
      .readonly(),
    /** The negotiated envelope snapshot this selection enforces against. */
    effectiveLimits: z
      .strictObject({
        graphKinds: z
          .array(z.enum(['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay']))
          .min(1)
          .max(7)
          .refine(
            (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
            'effective graphKinds must be sorted ascending and duplicate-free (deterministic set semantics)',
          ),
        interaction: z
          .array(z.enum(['gamepad', 'gaze', 'gesture', 'keyboard', 'pointer', 'touch', 'voice']))
          .max(7)
          .refine(
            (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
            'effective interaction must be sorted ascending and duplicate-free (deterministic set semantics)',
          ),
        stereoscopic: z.boolean(),
        maxGraphNodes: z.number().int().min(1).max(65_536),
        maxGraphEdges: z.number().int().min(0).max(131_072),
        maxTriangles: z.number().int().positive().max(100_000_000).optional(),
        maxTextureBytes: z.number().int().positive().max(1_099_511_627_776).optional(),
      }),
  })
  .superRefine((selection, ctx) => {
    // Canonical consistency: the chosen technique must be eligible
    // (trace marks it so) and must host every effective kind; the
    // fallback chain must contain only eligible techniques; the trace
    // must cover every technique in canonical order.
    const chosenEntry = selection.trace.find((entry) => entry.technique === selection.technique);
    if (chosenEntry === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'the trace must cover the chosen technique',
        path: ['trace'],
      });
    }
    const traceTechniques = selection.trace.map((entry) => entry.technique);
    const canonical = [...RENDERER_TECHNIQUES].sort();
    if (JSON.stringify(traceTechniques) !== JSON.stringify(canonical)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the trace must cover every technique in canonical order',
        path: ['trace'],
      });
    }
    if (chosenEntry !== undefined && !chosenEntry.eligible) {
      ctx.addIssue({
        code: 'custom',
        message: 'the chosen technique must be marked eligible in the trace',
        path: ['technique'],
      });
    }
    for (const fallback of selection.fallbackChain) {
      const entry = selection.trace.find((candidate) => candidate.technique === fallback);
      if (entry === undefined || !entry.eligible || entry.technique === selection.technique) {
        ctx.addIssue({
          code: 'custom',
          message: 'the fallback chain must contain only eligible alternative techniques',
          path: ['fallbackChain'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'RendererAdapterSelectionContent',
    title: 'RendererAdapterSelectionContent',
    description:
      'The content of an adapter selection: chosen technique, typed reason, fallback chain, full decision trace, and the negotiated envelope snapshot.',
  });

/** One selection content. */
export type RendererAdapterSelectionContent = z.infer<
  typeof RendererAdapterSelectionContentSchema
>;

/** The sealed adapter-selection record. */
export const RendererAdapterSelectionSchema = z
  .strictObject({
    schema: z.literal(RENDERER_ADAPTER_SELECTION_SCHEMA_NAME),
    protocolVersion: z.literal(RENDERER_ADAPTERS_PROTOCOL_VERSION),
    selectionId: SelectionIdSchema,
    tenantScope: TenantScopeSchema,
    rendererSessionId: z.string().regex(/^rs-[a-z0-9][a-z0-9-]{0,62}$/),
    bindingDigest: Sha256HexSchema,
    assessmentDigest: Sha256HexSchema,
    technique: RendererTechniqueSchema,
    reason: SelectionReasonSchema,
    fallbackChain: z.array(RendererTechniqueSchema).readonly(),
    trace: z
      .array(SelectionTraceEntrySchema)
      .min(1)
      .max(MAX_SELECTION_TRACE_ENTRIES)
      .readonly(),
    effectiveLimits: RendererAdapterSelectionContentSchema.shape.effectiveLimits,
    digest: Sha256HexSchema,
  })
  .superRefine((selection, ctx) => {
    const { digest: _sealed, ...content } = selection;
    void _sealed;
    const check = RendererAdapterSelectionContentSchema.safeParse(content);
    if (!check.success) {
      for (const issue of check.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  })
  .meta({
    id: 'RendererAdapterSelection',
    title: 'RendererAdapterSelection',
    description:
      'The sealed adapter selection: deterministic technique decision over a W013 binding and a W019 assessment, content-addressed by canonical SHA-256.',
  });

/** One sealed selection. */
export type RendererAdapterSelection = z.infer<typeof RendererAdapterSelectionSchema>;

// ---------------------------------------------------------------------------
// The selection engine.
// ---------------------------------------------------------------------------

/** Options shared by the selection entry points. */
export interface SelectionOptions {
  /**
   * The tenant the caller is selecting FOR. When provided, a binding
   * owned by a different tenant is rejected with `cross-tenant-denied`
   * (R12).
   */
  readonly expectedTenantId?: string;
}

/** The typed input of {@link selectRendererAdapter}. */
export interface SelectRendererAdapterInput {
  readonly selectionId: unknown;
  readonly binding: unknown;
  readonly assessment: unknown;
}

/**
 * The eligibility verdict of one technique against one binding (pure).
 */
function eligibilityOf(
  technique: RendererTechnique,
  binding: { readonly effective: { readonly graphKinds: readonly string[]; readonly stereoscopic: boolean } },
): { eligible: boolean; reason: EligibilityReason } {
  if (!techniqueHostsKinds(technique, binding.effective.graphKinds)) {
    return { eligible: false, reason: 'kind-not-hosted' };
  }
  if (binding.effective.stereoscopic && !RENDERER_TECHNIQUE_CATALOG_STEREOSCOPIC[technique]) {
    return { eligible: false, reason: 'stereoscopic-unsupported' };
  }
  if (!binding.effective.stereoscopic && RENDERER_TECHNIQUE_CATALOG_STEREOSCOPIC[technique]) {
    // A stereoscopic technique is never a silent upgrade of a mono
    // binding: it stays eligible only as an explicit fallback.
    return { eligible: true, reason: 'stereoscopic-unmatched' };
  }
  return { eligible: true, reason: 'not-preferred' };
}

/** The stereoscopic flags of the canonical catalog (pure lookup table). */
const RENDERER_TECHNIQUE_CATALOG_STEREOSCOPIC: Readonly<Record<RendererTechnique, boolean>> = {
  'immediate-2d': RENDERER_TECHNIQUE_CATALOG['immediate-2d'].stereoscopic,
  'remote-stream': RENDERER_TECHNIQUE_CATALOG['remote-stream'].stereoscopic,
  'retained-scene-3d': RENDERER_TECHNIQUE_CATALOG['retained-scene-3d'].stereoscopic,
  'stereoscopic-compositor': RENDERER_TECHNIQUE_CATALOG['stereoscopic-compositor'].stereoscopic,
};

/**
 * Select the renderer adapter technique for one binding on one assessed
 * device (total, deterministic, pure). See the module docs for the fixed
 * decision rules.
 */
export function selectRendererAdapter(
  input: SelectRendererAdapterInput,
  options?: SelectionOptions,
): RendererAdaptersResult<RendererAdapterSelection> {
  const idParsed = SelectionIdSchema.safeParse(input.selectionId);
  if (!idParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'selectionId failed schema validation',
        issues: idParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const bindingParsed = RendererBindingSchema.safeParse(input.binding);
  if (!bindingParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the binding failed W013 renderer-binding admission',
        issues: bindingParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? 'binding' : `binding.${issue.path.map(String).join('.')}`,
          message: issue.message,
        })),
      },
    };
  }
  // Digest integrity: the binding must be a genuine sealed W013 record
  // (a tampered digest is a typed rejection — decision inputs can never
  // silently disagree with their claimed revision).
  const bindingVerified = verifyRendererBindingDigest(input.binding);
  if (!bindingVerified.ok) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `the binding failed W013 digest verification (${bindingVerified.error.message})`,
        issues: [{ path: 'binding.digest', message: bindingVerified.error.message }],
      },
    };
  }
  const binding = bindingParsed.data as RendererBinding;
  const assessmentParsed = DeviceCapabilityAssessmentSchema.safeParse(input.assessment);
  if (!assessmentParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the assessment failed device-capabilities admission',
        issues: assessmentParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? 'assessment' : `assessment.${issue.path.map(String).join('.')}`,
          message: issue.message,
        })),
      },
    };
  }
  // Digest integrity: the assessment must be a genuine sealed W019 record.
  const assessmentVerified = verifyAssessmentDigest(input.assessment);
  if (!assessmentVerified.ok) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `the assessment failed digest verification (${assessmentVerified.error.code})`,
        issues: [{ path: 'assessment.digest', message: assessmentVerified.error.message }],
      },
    };
  }
  const assessment = assessmentParsed.data as DeviceCapabilityAssessment;

  // Tenant gate (R12).
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== binding.device.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['binding', 'device', 'tenantScope', 'tenantId'],
        options.expectedTenantId,
        binding.device.tenantScope.tenantId,
      ),
    };
  }

  // Integrity gate: the assessment must assess the binding's device.
  if (
    JSON.stringify(assessment.device) !== JSON.stringify(binding.device.device)
  ) {
    return {
      ok: false,
      error: assessmentDeviceMismatchError(),
    };
  }

  // The decision trace: every technique in canonical order.
  const canonicalOrder = [...RENDERER_TECHNIQUES].sort();
  const verdicts = canonicalOrder.map((technique) => ({
    technique,
    ...eligibilityOf(technique, binding),
  }));
  // Fixed decision precedence. Every branch requires its technique to be
  // ELIGIBLE (the trace's verdicts are binding); the optional remote path
  // is advisory — when it is ineligible (e.g. a negotiated stereoscopic
  // binding), the precedence falls through to the next rule.
  const spatial = hasSpatialKinds(binding.effective.graphKinds);
  const eligibleTechniques = new Set<RendererTechnique>(
    verdicts.filter((verdict) => verdict.eligible).map((verdict) => verdict.technique),
  );
  let decision: { readonly technique: RendererTechnique; readonly reason: SelectionReason } | null =
    null;

  if (
    assessment.derivation.remoteAssistRecommended &&
    eligibleTechniques.has('remote-stream')
  ) {
    decision = { technique: 'remote-stream', reason: 'remote-assist-recommended' };
  } else if (
    binding.effective.stereoscopic &&
    eligibleTechniques.has('stereoscopic-compositor')
  ) {
    decision = { technique: 'stereoscopic-compositor', reason: 'stereoscopic-negotiated' };
  } else if (spatial && eligibleTechniques.has('retained-scene-3d')) {
    decision = {
      technique: 'retained-scene-3d',
      reason:
        assessment.tier === 'reduced' ? 'spatial-kinds-local-degraded' : 'spatial-kinds-local',
    };
  } else if (!spatial && eligibleTechniques.has('immediate-2d')) {
    decision = { technique: 'immediate-2d', reason: 'flat-kinds' };
  }

  // Fallback: the optional remote path when no local technique hosts the
  // effective kinds.
  if (decision === null) {
    if (eligibleTechniques.has('remote-stream')) {
      decision = { technique: 'remote-stream', reason: 'local-technique-unavailable' };
    } else {
      return {
        ok: false,
        error: {
          code: 'no-eligible-technique',
          message:
            'no renderer technique hosts the binding\u2019s effective graph kinds (not even the remote path) — the selection is rejected, never guessed',
          effectiveGraphKinds: [...binding.effective.graphKinds],
        },
      };
    }
  }

  // The fallback chain: eligible alternatives in canonical preference
  // order, excluding the chosen technique.
  const preference: readonly RendererTechnique[] = [
    'stereoscopic-compositor',
    'retained-scene-3d',
    'immediate-2d',
    'remote-stream',
  ];
  const fallbackChain = preference.filter(
    (candidate) =>
      candidate !== decision.technique &&
      verdicts.find((verdict) => verdict.technique === candidate)?.eligible === true,
  );

  const content: RendererAdapterSelectionContent = {
    schema: RENDERER_ADAPTER_SELECTION_SCHEMA_NAME,
    protocolVersion: RENDERER_ADAPTERS_PROTOCOL_VERSION,
    selectionId: idParsed.data,
    tenantScope: binding.device.tenantScope,
    rendererSessionId: binding.rendererSessionId,
    bindingDigest: binding.digest,
    assessmentDigest: assessment.digest,
    technique: decision.technique,
    reason: decision.reason,
    fallbackChain,
    trace: verdicts.map((verdict) => ({
      technique: verdict.technique,
      eligible: verdict.eligible,
      reason: verdict.reason,
    })),
    effectiveLimits: {
      graphKinds: [...binding.effective.graphKinds],
      interaction: [...binding.effective.interaction],
      stereoscopic: binding.effective.stereoscopic,
      maxGraphNodes: binding.effective.maxGraphNodes,
      maxGraphEdges: binding.effective.maxGraphEdges,
      ...(binding.effective.maxTriangles !== undefined
        ? { maxTriangles: binding.effective.maxTriangles }
        : {}),
      ...(binding.effective.maxTextureBytes !== undefined
        ? { maxTextureBytes: binding.effective.maxTextureBytes }
        : {}),
    },
  };
  const sealedContent = RendererAdapterSelectionContentSchema.parse(content);
  return {
    ok: true,
    value: {
      ...sealedContent,
      digest: canonicalDigest(content as unknown as JsonValue),
    },
  };
}
