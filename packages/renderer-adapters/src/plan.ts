/**
 * The typed renderer mount plan — how a chosen technique mounts one
 * content revision through the W013 hosting surface.
 *
 * A plan is ADAPTATION DATA, never execution: which technique mounts
 * which content digest (typically a progressive-scene rung), with which
 * declared resource usage, under which caller-supplied invocation id at
 * which caller-supplied virtual instant. {@link mountEnvelopeOf}
 * projects the plan onto a REAL W013 mount-graph invocation envelope
 * (validated by the W013 invocation schema — the honest runtime
 * composition edge), so the host hands the envelope straight to
 * `admitInvocation` on the binding revision the selection pinned.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { ExperienceGraphKindSchema } from '@epoch/experience-protocol';
import { InvocationEnvelopeSchema } from '@epoch/renderer-runtime';
import {
  RENDERER_MOUNT_PLAN_SCHEMA_NAME,
  RENDERER_ADAPTERS_PROTOCOL_VERSION,
  RendererTechniqueSchema,
} from './version';
import { MountPlanIdSchema, Sha256HexSchema, TenantScopeSchema } from './primitives';
import type { RendererAdapterSelection } from './selection';
import { RendererAdapterSelectionSchema } from './selection';
import type { RendererAdaptersResult } from './errors';

/** The typed mount steps of a plan (data, never execution). */
export const MOUNT_PLAN_STEPS = [
  'activate-presentation',
  'prepare-surface',
  'stage-content',
] as const;

/** One mount step. */
export type MountPlanStep = (typeof MOUNT_PLAN_STEPS)[number];

export const MountPlanStepSchema = z.enum(MOUNT_PLAN_STEPS).meta({
  id: 'MountPlanStep',
  title: 'MountPlanStep',
  description: 'One typed mount step of a renderer mount plan (data, never execution).',
});

/** The invocation-id grammar a plan's projected envelope carries. */
const INVOCATION_ID_PATTERN = /^inv-[a-z0-9][a-z0-9-]{0,62}$/;
const InvocationIdSchema = z.string().regex(INVOCATION_ID_PATTERN);

/** The renderer-session-id grammar (the W013 mirror). */
const RENDERER_SESSION_ID_PATTERN = /^rs-[a-z0-9][a-z0-9-]{0,62}$/;
const RendererSessionIdSchema = z.string().regex(RENDERER_SESSION_ID_PATTERN);

/** The content of a mount plan (everything except the digest). */
export const RendererMountPlanContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_MOUNT_PLAN_SCHEMA_NAME),
    protocolVersion: z.literal(RENDERER_ADAPTERS_PROTOCOL_VERSION),
    planId: MountPlanIdSchema,
    /** The invocation id the projected W013 envelope carries. */
    invocationId: InvocationIdSchema,
    /** The tenant scope adopted from the selection (R12). */
    tenantScope: TenantScopeSchema,
    /** The W013 renderer session the plan targets (from the selection). */
    rendererSessionId: RendererSessionIdSchema,
    /** The exact selection revision this plan derives from. */
    selectionDigest: Sha256HexSchema,
    /** The technique that will mount the content. */
    technique: RendererTechniqueSchema,
    /** The content digest to mount (typically a progressive-scene rung). */
    graphDigest: Sha256HexSchema,
    /** The kind of the content to mount. */
    graphKind: ExperienceGraphKindSchema,
    /** Declared triangle usage (required when the envelope bounds it). */
    declaredTriangles: z.number().int().nonnegative().max(100_000_000).optional(),
    /** Declared texture-byte usage (required when the envelope bounds it). */
    declaredTextureBytes: z.number().int().nonnegative().max(1_099_511_627_776).optional(),
    /** The caller-supplied virtual mount instant. */
    atMs: z.number().int().nonnegative(),
    /** The ordered mount steps (canonical order). */
    steps: z.array(MountPlanStepSchema).min(3).max(3).readonly(),
  })
  .superRefine((plan, ctx) => {
    // Canonical order: prepare-surface -> stage-content -> activate-presentation.
    if (
      JSON.stringify([...plan.steps]) !==
      JSON.stringify(['prepare-surface', 'stage-content', 'activate-presentation'])
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'the mount steps must be the canonical order (prepare-surface, stage-content, activate-presentation)',
        path: ['steps'],
      });
    }
  })
  .meta({
    id: 'RendererMountPlanContent',
    title: 'RendererMountPlanContent',
    description:
      'The content of a renderer mount plan: invocation identity, technique, content digest, declared usage, virtual instant, and the canonical mount steps.',
  });

/** One plan content. */
export type RendererMountPlanContent = z.infer<typeof RendererMountPlanContentSchema>;

/** The sealed mount-plan record. */
export const RendererMountPlanSchema = z
  .strictObject({
    schema: z.literal(RENDERER_MOUNT_PLAN_SCHEMA_NAME),
    protocolVersion: z.literal(RENDERER_ADAPTERS_PROTOCOL_VERSION),
    planId: MountPlanIdSchema,
    invocationId: InvocationIdSchema,
    tenantScope: TenantScopeSchema,
    rendererSessionId: RendererSessionIdSchema,
    selectionDigest: Sha256HexSchema,
    technique: RendererTechniqueSchema,
    graphDigest: Sha256HexSchema,
    graphKind: ExperienceGraphKindSchema,
    declaredTriangles: z.number().int().nonnegative().max(100_000_000).optional(),
    declaredTextureBytes: z.number().int().nonnegative().max(1_099_511_627_776).optional(),
    atMs: z.number().int().nonnegative(),
    steps: z.array(MountPlanStepSchema).min(3).max(3).readonly(),
    digest: Sha256HexSchema,
  })
  .superRefine((plan, ctx) => {
    const { digest: _sealed, ...content } = plan;
    void _sealed;
    const check = RendererMountPlanContentSchema.safeParse(content);
    if (!check.success) {
      for (const issue of check.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  })
  .meta({
    id: 'RendererMountPlan',
    title: 'RendererMountPlan',
    description:
      'The sealed renderer mount plan: adaptation data for mounting one content revision through the W013 hosting surface, content-addressed by canonical SHA-256.',
  });

/** One sealed plan. */
export type RendererMountPlan = z.infer<typeof RendererMountPlanSchema>;

/** Options shared by the plan entry points. */
export interface PlanOptions {
  /**
   * The tenant the caller is planning FOR. When provided, a selection
   * owned by a different tenant is rejected with `cross-tenant-denied`
   * (R12).
   */
  readonly expectedTenantId?: string;
}

/** The typed input of {@link planMount}. */
export interface PlanMountInput {
  readonly planId: unknown;
  /** The invocation id the projected W013 envelope will carry. */
  readonly invocationId: unknown;
  readonly selection: unknown;
  /** The content digest to mount. */
  readonly graphDigest: unknown;
  /** The kind of the content to mount. */
  readonly graphKind: unknown;
  /** Declared triangle usage (when the envelope bounds triangles). */
  readonly declaredTriangles?: unknown;
  /** Declared texture-byte usage (when the envelope bounds texture). */
  readonly declaredTextureBytes?: unknown;
  /** The caller-supplied virtual mount instant. */
  readonly atMs?: unknown;
}

/**
 * Plan one mount through a sealed adapter selection (total,
 * deterministic, pure): the plan carries the invocation identity, the
 * technique, the content digest, the declared usage, and the canonical
 * mount steps.
 */
export function planMount(
  input: PlanMountInput,
  options?: PlanOptions,
): RendererAdaptersResult<RendererMountPlan> {
  const idParsed = MountPlanIdSchema.safeParse(input.planId);
  if (!idParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'planId failed schema validation',
        issues: idParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const invocationParsed = InvocationIdSchema.safeParse(input.invocationId);
  if (!invocationParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'invocationId failed schema validation',
        issues: invocationParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const selectionParsed = RendererAdapterSelectionSchema.safeParse(input.selection);
  if (!selectionParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the selection failed renderer-adapters admission',
        issues: selectionParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? 'selection' : `selection.${issue.path.map(String).join('.')}`,
          message: issue.message,
        })),
      },
    };
  }
  const selection = selectionParsed.data as RendererAdapterSelection;
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== selection.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `cross-tenant mount planning denied: expected tenant "${options.expectedTenantId}", encountered "${selection.tenantScope.tenantId}"`,
        path: ['selection', 'tenantScope', 'tenantId'],
        expectedTenantId: options.expectedTenantId,
        encounteredTenantId: selection.tenantScope.tenantId,
      },
    };
  }
  const atMsParsed = z.number().int().nonnegative().safeParse(input.atMs ?? 0);
  if (!atMsParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'atMs failed schema validation',
        issues: atMsParsed.error.issues.map((issue) => ({
          path: 'atMs',
          message: issue.message,
        })),
      },
    };
  }
  const graphDigestParsed = Sha256HexSchema.safeParse(input.graphDigest);
  if (!graphDigestParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'graphDigest failed schema validation',
        issues: graphDigestParsed.error.issues.map((issue) => ({
          path: 'graphDigest',
          message: issue.message,
        })),
      },
    };
  }
  const graphKindParsed = ExperienceGraphKindSchema.safeParse(input.graphKind);
  if (!graphKindParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'graphKind failed schema validation',
        issues: graphKindParsed.error.issues.map((issue) => ({
          path: 'graphKind',
          message: issue.message,
        })),
      },
    };
  }
  const declaredTrianglesParsed =
    input.declaredTriangles === undefined
      ? { success: true as const, data: undefined }
      : z.number().int().nonnegative().max(100_000_000).safeParse(input.declaredTriangles);
  if (!declaredTrianglesParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'declaredTriangles failed schema validation',
        issues: declaredTrianglesParsed.error.issues.map((issue) => ({
          path: 'declaredTriangles',
          message: issue.message,
        })),
      },
    };
  }
  const declaredTextureBytesParsed =
    input.declaredTextureBytes === undefined
      ? { success: true as const, data: undefined }
      : z.number().int().nonnegative().max(1_099_511_627_776).safeParse(input.declaredTextureBytes);
  if (!declaredTextureBytesParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'declaredTextureBytes failed schema validation',
        issues: declaredTextureBytesParsed.error.issues.map((issue) => ({
          path: 'declaredTextureBytes',
          message: issue.message,
        })),
      },
    };
  }
  const content: RendererMountPlanContent = {
    schema: RENDERER_MOUNT_PLAN_SCHEMA_NAME,
    protocolVersion: RENDERER_ADAPTERS_PROTOCOL_VERSION,
    planId: idParsed.data,
    invocationId: invocationParsed.data,
    tenantScope: selection.tenantScope,
    rendererSessionId: selection.rendererSessionId,
    selectionDigest: selection.digest,
    technique: selection.technique,
    graphDigest: graphDigestParsed.data,
    graphKind: graphKindParsed.data,
    ...(declaredTrianglesParsed.data !== undefined
      ? { declaredTriangles: declaredTrianglesParsed.data }
      : {}),
    ...(declaredTextureBytesParsed.data !== undefined
      ? { declaredTextureBytes: declaredTextureBytesParsed.data }
      : {}),
    atMs: atMsParsed.data,
    steps: ['prepare-surface', 'stage-content', 'activate-presentation'],
  };
  const sealedContent = RendererMountPlanContentSchema.parse(content);
  return {
    ok: true,
    value: {
      ...sealedContent,
      digest: canonicalDigest(content as unknown as JsonValue),
    },
  };
}

/**
 * Project a sealed mount plan onto a REAL W013 mount-graph invocation
 * envelope (validated by the W013 invocation schema — the honest
 * composition edge). The host hands the envelope to `admitInvocation`
 * on the binding revision the selection pinned.
 */
export function mountEnvelopeOf(plan: RendererMountPlan): RendererAdaptersResult<unknown> {
  const envelope = {
    schema: 'epoch.renderer-invocation',
    protocolVersion: '1.0.0',
    kind: 'mount-graph',
    invocationId: plan.invocationId,
    rendererSessionId: plan.rendererSessionId,
    graphDigest: plan.graphDigest,
    atMs: plan.atMs,
    ...(plan.declaredTriangles !== undefined ? { declaredTriangles: plan.declaredTriangles } : {}),
    ...(plan.declaredTextureBytes !== undefined
      ? { declaredTextureBytes: plan.declaredTextureBytes }
      : {}),
  };
  const parsed = InvocationEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the projected mount envelope failed W013 invocation admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data };
}
