/**
 * The RENDERER CONFORMANCE RESULT (W056) — the typed record the conformance
 * harness (qa/renderer-conformance) emits: the typed outcome of every
 * conformance check run against a set of renderers over ONE shared
 * fixture, plus the overall verdict.
 *
 * The check kinds are the conformance list of
 * spec/renderer-fabric-architecture.md, typed: same tenant; same world
 * digest; same semantic entity ids; equivalent supported interaction
 * outcomes; same semantic focus/layers; equivalent normalized intents;
 * renderer-specific differences confined to presentation.
 *
 * A conformance result is EVIDENCE (content-addressed), never authority:
 * it proves what was checked, against which renderers, over which world
 * digest — nothing more.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenantScopeSchema } from '@epoch/experience-protocol';
import {
  MAX_CONFORMANCE_CHECKS,
  MAX_CONFORMANCE_RENDERERS,
  MAX_FABRIC_DETAIL_LENGTH,
  RENDERER_CONFORMANCE_CHECK_KINDS,
  RENDERER_CONFORMANCE_SCHEMA_NAME,
  RendererConformanceCheckKindSchema,
  RendererFabricProtocolVersionSchema,
} from './version';
import { RendererIdSchema } from './primitives';
import { Sha256HexSchema, VirtualTimeMsSchema } from './primitives';

/**
 * One conformance check entry: the check kind, the renderer it ran
 * against, the typed outcome, an optional neutral detail, and an optional
 * evidence digest (content-addressed proof for the check).
 */
export const RendererConformanceCheckSchema = z
  .strictObject({
    checkKind: RendererConformanceCheckKindSchema,
    /** The renderer the check ran against. */
    rendererId: RendererIdSchema,
    /** The typed outcome. */
    outcome: z.enum(['fail', 'pass']),
    /** Bounded neutral detail (what exactly was compared). */
    detail: z.string().max(MAX_FABRIC_DETAIL_LENGTH).optional(),
    /** Content digest of the check's evidence record, when one was produced. */
    evidenceDigest: Sha256HexSchema.optional(),
  })
  .meta({
    id: 'RendererConformanceCheck',
    title: 'RendererConformanceCheck',
    description:
      'One conformance check entry: check kind, renderer, typed outcome, detail, and evidence digest.',
  });

/** One conformance check entry. */
export type RendererConformanceCheck = z.infer<typeof RendererConformanceCheckSchema>;

/**
 * The content of a renderer conformance result (everything except the
 * digest): the harness run identity, the renderers under test, the shared
 * fixture's tenant scope and world digest, the per-check entries, and the
 * overall verdict (pass iff every check passed).
 */
export const RendererConformanceResultContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_CONFORMANCE_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    /** The harness run identifier (caller-scoped). */
    runId: z.string().min(1).max(128),
    /** The renderers under test (sorted, duplicate-free). */
    renderers: z
      .array(RendererIdSchema)
      .min(1)
      .max(MAX_CONFORMANCE_RENDERERS)
      .refine(
        (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
        'renderers must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** The shared fixture's tenant scope. */
    tenantScope: TenantScopeSchema,
    /** The shared fixture's canonical world digest. */
    worldDigest: Sha256HexSchema,
    /** The per-check entries (every check kind x renderer combination reported). */
    checks: z.array(RendererConformanceCheckSchema).min(1).max(MAX_CONFORMANCE_CHECKS),
    /** The overall verdict (pass iff every check passed). */
    overallOutcome: z.enum(['fail', 'pass']),
    /** Virtual times of the run bounds (caller-supplied). */
    startedAtMs: VirtualTimeMsSchema,
    completedAtMs: VirtualTimeMsSchema,
  })
  .superRefine((result, ctx) => {
    if (result.completedAtMs < result.startedAtMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'completedAtMs must not precede startedAtMs',
        path: ['completedAtMs'],
      });
    }
    const overallPass = result.checks.every((check) => check.outcome === 'pass');
    if (overallPass !== (result.overallOutcome === 'pass')) {
      ctx.addIssue({
        code: 'custom',
        message: 'overallOutcome must equal the conjunction of the check outcomes',
        path: ['overallOutcome'],
      });
    }
    for (const renderer of result.renderers) {
      const covered = RENDERER_CONFORMANCE_CHECK_KINDS.filter((kind) =>
        result.checks.some((check) => check.checkKind === kind && check.rendererId === renderer),
      );
      if (covered.length !== RENDERER_CONFORMANCE_CHECK_KINDS.length) {
        ctx.addIssue({
          code: 'custom',
          message: `every renderer must be covered by every check kind (renderer "${renderer}" is not)`,
          path: ['checks'],
        });
        return;
      }
    }
  })
  .meta({
    id: 'RendererConformanceResultContent',
    title: 'RendererConformanceResultContent',
    description:
      'The content of a renderer conformance result: run identity, renderers under test, shared fixture identity, per-check entries, and the overall verdict.',
  });

/** One conformance-result content. */
export type RendererConformanceResultContent = z.infer<
  typeof RendererConformanceResultContentSchema
>;

/**
 * The sealed renderer conformance result: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 */
export const RendererConformanceResultSchema = RendererConformanceResultContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererConformanceResult',
  title: 'RendererConformanceResult',
  description:
    'The sealed renderer conformance result: content-addressed conformance evidence of one harness run.',
});

/** One sealed conformance result. */
export type RendererConformanceResult = z.infer<typeof RendererConformanceResultSchema>;

/** Seal valid conformance-result content (content + its SHA-256 digest). */
export function sealRendererConformanceResult(
  content: RendererConformanceResultContent,
): RendererConformanceResult {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
