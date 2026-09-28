/**
 * The progressive scene ladder — deterministic derivation and budget
 * fitting (the content-side core of Renderer/Device Adaptation).
 *
 * `deriveProgressiveLadder` walks the canonical stage table
 * (src/reduce.ts) over a sealed W011 Experience Graph and produces a
 * sealed {@link ProgressiveSceneLadder}: rung 0 is the source graph at
 * full fidelity; every subsequent rung is the previous rung with exactly
 * one stage applied, re-sealed as a valid W011 graph (mountable through
 * the UNCHANGED W013 mount-graph path) and carrying an explicit
 * {@link RungReduction} manifest — same semantics, different fidelity,
 * never silent. Rungs chain by digest, so the derivation history is
 * tamper-evident; the ladder terminates when no stage applies (the
 * minimal core).
 *
 * `fitGraphToLimits` walks the same deterministic ladder against the
 * W013 binding's effective limits and returns the first fitting rung —
 * or rung 0 when the source already fits — together with the declared
 * usage the W013 mount envelope must carry. When even the minimal-core
 * rung cannot fit, the answer is a typed `unfittable-scene` rejection
 * (honesty over silent clamping).
 *
 * Determinism: the derivation is a pure function of the source graph;
 * the ladder id is caller-supplied; zero wall-clock, zero randomness,
 * zero I/O. Tenant isolation (R12): the ladder fixes the graph's tenant
 * scope; cross-tenant derivation is a typed `cross-tenant-denied`
 * rejection.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  parseExperienceGraph,
  type ExperienceGraph,
} from '@epoch/experience-protocol';
import { EffectiveLimitsSchema } from '@epoch/renderer-runtime';
import {
  PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME,
  PROGRESSIVE_SCENE_PROTOCOL_VERSION,
  SCENE_FIT_SCHEMA_NAME,
  ReductionStageKindSchema,
  MAX_LADDER_RUNGS,
  type ReductionStageKind,
} from './version';
import { LadderIdSchema, RungIndexSchema, Sha256HexSchema, TenantScopeSchema, ExperienceGraphIdSchema } from './primitives';
import { estimateGraphUsage, usageFits } from './estimates';
import { RungReductionSchema, CANONICAL_STAGE_TABLE, type RungReduction } from './reduce';
import { crossTenantDeniedError, unfittableSceneError } from './issues';
import type { ProgressiveSceneResult } from './errors';

// ---------------------------------------------------------------------------
// The ladder record.
// ---------------------------------------------------------------------------

/** One ladder rung: index, stage, sealed-graph digest, usage, manifest. */
export const LadderRungSchema = z
  .strictObject({
    /** The rung index (0 = the source graph at full fidelity). */
    rungIndex: RungIndexSchema,
    /** The stage that produced this rung (null for rung 0). */
    stage: ReductionStageKindSchema.nullable(),
    /** The sealed rung graph's content digest (re-derivable on demand). */
    graphDigest: Sha256HexSchema,
    /** The previous rung's graph digest (rung 0: the source digest). */
    parentDigest: Sha256HexSchema,
    /** The rung graph's deterministic usage estimate. */
    usage: z
      .strictObject({
        nodes: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative(),
        estimatedTriangles: z.number().int().nonnegative(),
        assetBytes: z.number().int().nonnegative(),
      })
      .readonly(),
    /** The explicit reduction manifest (null for rung 0). */
    reduction: RungReductionSchema.nullable(),
  })
  .meta({
    id: 'LadderRung',
    title: 'LadderRung',
    description:
      'One progressive-scene ladder rung: index, producing stage, sealed-graph digest, parent digest, usage estimate, and explicit reduction manifest.',
  });

/** One ladder rung. */
export type LadderRung = z.infer<typeof LadderRungSchema>;

/** The content of a sealed ladder record (everything except the digest). */
export const ProgressiveSceneLadderContentSchema = z
  .strictObject({
    schema: z.literal(PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME),
    protocolVersion: z.literal(PROGRESSIVE_SCENE_PROTOCOL_VERSION),
    ladderId: LadderIdSchema,
    /** The tenant scope of the source graph (R12 — fixed at derivation). */
    tenantScope: TenantScopeSchema,
    /** The source graph's id (rungs are revisions of the same graph). */
    graphId: ExperienceGraphIdSchema,
    /** The source graph's content digest (rung 0's parent). */
    sourceGraphDigest: Sha256HexSchema,
    /** The canonical stage sequence the derivation applied (empty for an already-minimal source). */
    stages: z.array(ReductionStageKindSchema).readonly(),
    /** The ordered rungs (rung 0 first; the minimal core last). */
    rungs: z.array(LadderRungSchema).min(1).max(MAX_LADDER_RUNGS),
  })
  .superRefine((ladder, ctx) => {
    // Canonical-consistency: rung indices are contiguous from 0; each
    // rung's parent digest chains; rung 0 has no stage/reduction; every
    // other rung has one; the stage sequence equals the producing stages.
    for (let i = 0; i < ladder.rungs.length; i += 1) {
      const rung = ladder.rungs[i];
      if (rung.rungIndex !== i) {
        ctx.addIssue({
          code: 'custom',
          message: `rung indices must be contiguous from 0 (rung ${i} carries index ${rung.rungIndex})`,
          path: ['rungs', i, 'rungIndex'],
        });
      }
      if (rung.rungIndex > 0 && rung.stage === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'only rung 0 may carry a null stage',
          path: ['rungs', i, 'stage'],
        });
      }
      if (rung.rungIndex === 0 && (rung.stage !== null || rung.reduction !== null)) {
        ctx.addIssue({
          code: 'custom',
          message: 'rung 0 is the source graph at full fidelity (no stage, no reduction)',
          path: ['rungs', 0],
        });
      }
      if (rung.rungIndex === 0 && rung.parentDigest !== ladder.sourceGraphDigest) {
        ctx.addIssue({
          code: 'custom',
          message: "rung 0's parent digest must be the source graph digest",
          path: ['rungs', 0, 'parentDigest'],
        });
      }
      if (rung.rungIndex > 0 && rung.parentDigest !== ladder.rungs[rung.rungIndex - 1]?.graphDigest) {
        ctx.addIssue({
          code: 'custom',
          message: 'each rung must chain to the previous rung by digest',
          path: ['rungs', rung.rungIndex, 'parentDigest'],
        });
      }
    }
    const producing = ladder.rungs.slice(1).map((rung) => rung.stage);
    if (JSON.stringify(producing) !== JSON.stringify([...ladder.stages])) {
      ctx.addIssue({
        code: 'custom',
        message: 'the stage sequence must equal the producing stages of rungs 1..n',
        path: ['stages'],
      });
    }
  })
  .meta({
    id: 'ProgressiveSceneLadderContent',
    title: 'ProgressiveSceneLadderContent',
    description:
      'The content of a progressive-scene ladder: tenant scope, source graph identity, canonical stage sequence, and the digest-chained rungs.',
  });

/** One ladder content. */
export type ProgressiveSceneLadderContent = z.infer<typeof ProgressiveSceneLadderContentSchema>;

/** The sealed progressive-scene ladder record. */
export const ProgressiveSceneLadderSchema = z
  .strictObject({
    schema: z.literal(PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME),
    protocolVersion: z.literal(PROGRESSIVE_SCENE_PROTOCOL_VERSION),
    ladderId: LadderIdSchema,
    tenantScope: TenantScopeSchema,
    graphId: ExperienceGraphIdSchema,
    sourceGraphDigest: Sha256HexSchema,
    stages: z.array(ReductionStageKindSchema).readonly(),
    rungs: z.array(LadderRungSchema).min(1).max(MAX_LADDER_RUNGS),
    digest: Sha256HexSchema,
  })
  .superRefine((ladder, ctx) => {
    const { digest: _sealed, ...content } = ladder;
    void _sealed;
    const check = ProgressiveSceneLadderContentSchema.safeParse(content);
    if (!check.success) {
      for (const issue of check.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
    }
  })
  .meta({
    id: 'ProgressiveSceneLadder',
    title: 'ProgressiveSceneLadder',
    description:
      'The sealed progressive-scene ladder: deterministic digest-chained rungs of a W011 graph, content-addressed by canonical SHA-256.',
  });

/** One sealed ladder. */
export type ProgressiveSceneLadder = z.infer<typeof ProgressiveSceneLadderSchema>;

// ---------------------------------------------------------------------------
// Ladder derivation.
// ---------------------------------------------------------------------------

/** Options shared by the ladder entry points. */
export interface LadderOptions {
  /**
   * The tenant the caller is deriving FOR. When provided, a graph owned
   * by a different tenant is rejected with `cross-tenant-denied` (R12).
   */
  readonly expectedTenantId?: string;
}

/** The typed input of {@link deriveProgressiveLadder}. */
export interface DeriveLadderInput {
  readonly ladderId: unknown;
  readonly graph: unknown;
}

/**
 * Derive the progressive scene ladder of a sealed W011 Experience Graph
 * (total, deterministic, pure). The source graph is admitted through the
 * REAL W011 total admission surface first; rungs are re-sealed W011
 * graphs and chain by digest.
 */
export function deriveProgressiveLadder(
  input: DeriveLadderInput,
  options?: LadderOptions,
): ProgressiveSceneResult<ProgressiveSceneLadder> {
  const idParsed = LadderIdSchema.safeParse(input.ladderId);
  if (!idParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'ladderId failed schema validation',
        issues: idParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const graphAdmitted = parseExperienceGraph(input.graph);
  if (!graphAdmitted.ok) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `the source graph failed W011 admission (${graphAdmitted.error.code})`,
        issues: [
          {
            path: 'graph',
            message: `W011 admission rejected the graph: ${graphAdmitted.error.message}`,
          },
        ],
      },
    };
  }
  const graph = graphAdmitted.value;
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== graph.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['graph', 'tenantScope', 'tenantId'],
        options.expectedTenantId,
        graph.tenantScope.tenantId,
      ),
    };
  }

  const rungs: LadderRung[] = [
    {
      rungIndex: 0,
      stage: null,
      graphDigest: graph.digest,
      parentDigest: graph.digest,
      usage: estimateGraphUsage(graph),
      reduction: null,
    },
  ];
  const stages: ReductionStageKind[] = [];
  let current = graph;
  for (const applicator of CANONICAL_STAGE_TABLE) {
    const outcome = applicator.apply(current);
    if (outcome === null) {
      continue; // stage inapplicable — never an empty rung
    }
    stages.push(applicator.stage);
    rungs.push({
      rungIndex: rungs.length,
      stage: applicator.stage,
      graphDigest: outcome.graph.digest,
      parentDigest: current.digest,
      usage: estimateGraphUsage(outcome.graph),
      reduction: outcome.reduction,
    });
    current = outcome.graph;
  }

  const content: ProgressiveSceneLadderContent = {
    schema: PROGRESSIVE_SCENE_LADDER_SCHEMA_NAME,
    protocolVersion: PROGRESSIVE_SCENE_PROTOCOL_VERSION,
    ladderId: idParsed.data,
    tenantScope: graph.tenantScope,
    graphId: graph.graphId,
    sourceGraphDigest: graph.digest,
    stages,
    rungs,
  };
  const sealedContent = ProgressiveSceneLadderContentSchema.parse(content);
  return {
    ok: true,
    value: {
      ...sealedContent,
      digest: canonicalDigest(content as unknown as JsonValue),
    },
  };
}

// ---------------------------------------------------------------------------
// Rung re-derivation.
// ---------------------------------------------------------------------------

/**
 * Re-derive the sealed rung graph at `rungIndex` (deterministic: the
 * same source graph always re-derives byte-identical rungs). Total:
 * invalid indices yield typed `invalid-rung-index` errors.
 */
export function rungGraphAt(
  input: DeriveLadderInput,
  rungIndex: number,
): ProgressiveSceneResult<ExperienceGraph> {
  const ladder = deriveProgressiveLadder(input);
  if (!ladder.ok) {
    return ladder;
  }
  const rung = ladder.value.rungs[rungIndex];
  if (rung === undefined) {
    return {
      ok: false,
      error: {
        code: 'invalid-rung-index',
        message: `rung index ${rungIndex} is outside the ladder (valid indices: 0..${ladder.value.rungs.length - 1})`,
        encountered: rungIndex,
        rungCount: ladder.value.rungs.length,
      },
    };
  }
  const graphAdmitted = parseExperienceGraph(input.graph);
  if (!graphAdmitted.ok) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the source graph failed W011 admission',
        issues: [{ path: 'graph', message: graphAdmitted.error.message }],
      },
    };
  }
  let current = graphAdmitted.value;
  for (let i = 0; i < rungIndex; i += 1) {
    const stage = ladder.value.rungs[i + 1]?.stage;
    if (stage === null || stage === undefined) {
      break;
    }
    const outcome = CANONICAL_STAGE_TABLE.find(
      (applicator) => applicator.stage === stage,
    )?.apply(current);
    if (outcome === null || outcome === undefined) {
      break;
    }
    current = outcome.graph;
  }
  if (current.digest !== rung.graphDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          're-derived rung digest does not match the ladder (non-deterministic derivation detected)',
        path: ['rungs', rungIndex, 'graphDigest'],
        expected: rung.graphDigest,
        encountered: current.digest,
      },
    };
  }
  return { ok: true, value: current };
}

// ---------------------------------------------------------------------------
// Budget fitting.
// ---------------------------------------------------------------------------

/** The typed usage declaration the W013 mount envelope must carry. */
export interface DeclaredUsage {
  /** Declared triangle usage (required for spatial kinds under bounds). */
  readonly declaredTriangles?: number;
  /** Declared texture-byte usage (required for spatial kinds under bounds). */
  readonly declaredTextureBytes?: number;
}

/** The fit verdict of one graph against one budget envelope. */
export const SceneFitSchema = z
  .strictObject({
    schema: z.literal(SCENE_FIT_SCHEMA_NAME),
    protocolVersion: z.literal(PROGRESSIVE_SCENE_PROTOCOL_VERSION),
    /** The tenant scope of the fitted graph (R12). */
    tenantScope: TenantScopeSchema,
    /** The source graph's content digest. */
    sourceGraphDigest: Sha256HexSchema,
    /** The ladder digest the fit walked. */
    ladderDigest: Sha256HexSchema,
    /** The fitting rung index (0 = the source fits as-is). */
    rungIndex: RungIndexSchema,
    /** The fitting rung's sealed graph digest. */
    rungGraphDigest: Sha256HexSchema,
    /** The fitting rung's usage estimate. */
    usage: z
      .strictObject({
        nodes: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative(),
        estimatedTriangles: z.number().int().nonnegative(),
        assetBytes: z.number().int().nonnegative(),
      })
      .readonly(),
    /** The reduction trace from rung 0 to the fitting rung (never silent). */
    reductions: z.array(RungReductionSchema).readonly(),
    /** The target budget envelope the fit satisfied. */
    limits: z
      .strictObject({
        maxGraphNodes: z.number().int().min(1),
        maxGraphEdges: z.number().int().min(0),
        maxTriangles: z.number().int().positive().optional(),
        maxTextureBytes: z.number().int().positive().optional(),
      })
      .readonly(),
    digest: Sha256HexSchema,
  })
  .meta({
    id: 'SceneFit',
    title: 'SceneFit',
    description:
      'The typed fit verdict of a progressive-scene ladder against a W013 budget envelope: fitting rung, usage, and the full reduction trace.',
  });

/** One fit verdict. */
export type SceneFit = z.infer<typeof SceneFitSchema>;

/**
 * Fit a sealed W011 Experience Graph to the W013 binding's effective
 * limits (total, deterministic, pure): returns the first fitting rung
 * (rung 0 when the source already fits) with its sealed graph digest,
 * usage estimate, full reduction trace, and the declared usage the W013
 * mount envelope must carry. When even the minimal-core rung cannot
 * fit, the answer is a typed `unfittable-scene` rejection.
 */
export function fitGraphToLimits(
  input: DeriveLadderInput & {
    readonly limits: unknown;
  },
  options?: LadderOptions,
): ProgressiveSceneResult<SceneFit & { readonly declaredUsage: DeclaredUsage }> {
  const limitsParsed = EffectiveLimitsSchema.safeParse(input.limits);
  if (!limitsParsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the target limits failed W013 effective-limits admission',
        issues: limitsParsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? 'limits' : `limits.${issue.path.map(String).join('.')}`,
          message: issue.message,
        })),
      },
    };
  }
  const limits = limitsParsed.data;
  const ladder = deriveProgressiveLadder(input, options);
  if (!ladder.ok) {
    return ladder;
  }

  // Walk the ladder for the first fitting rung.
  for (const rung of ladder.value.rungs) {
    if (usageFits(rung.usage, limits)) {
      const content = {
        schema: SCENE_FIT_SCHEMA_NAME,
        protocolVersion: PROGRESSIVE_SCENE_PROTOCOL_VERSION,
        tenantScope: ladder.value.tenantScope,
        sourceGraphDigest: ladder.value.sourceGraphDigest,
        ladderDigest: ladder.value.digest,
        rungIndex: rung.rungIndex,
        rungGraphDigest: rung.graphDigest,
        usage: rung.usage,
        reductions: ladder.value.rungs
          .slice(1, rung.rungIndex + 1)
          .map((entry) => entry.reduction)
          .filter((reduction): reduction is RungReduction => reduction !== null),
        limits: {
          maxGraphNodes: limits.maxGraphNodes,
          maxGraphEdges: limits.maxGraphEdges,
          maxTriangles: limits.maxTriangles,
          maxTextureBytes: limits.maxTextureBytes,
        },
      };
      const declaredUsage: DeclaredUsage = {
        ...(limits.maxTriangles !== undefined
          ? { declaredTriangles: rung.usage.estimatedTriangles }
          : {}),
        ...(limits.maxTextureBytes !== undefined
          ? { declaredTextureBytes: rung.usage.assetBytes }
          : {}),
      };
      return {
        ok: true,
        value: {
          ...content,
          declaredUsage,
          digest: canonicalDigest(content as unknown as JsonValue),
        },
      };
    }
  }

  // No rung fits: the honest typed rejection (never a silent clamp).
  const minimal = ladder.value.rungs[ladder.value.rungs.length - 1];
  return {
    ok: false,
    error: unfittableSceneError(minimal.usage, limits),
  };
}
