/**
 * The typed error taxonomy (values, never throws) — the W011/W013
 * errors-precedent applied to the progressive-scene kernel.
 */
import { z } from 'zod';
import { Sha256HexSchema, RungIndexSchema } from './primitives';

/** One typed diagnostic issue: a dotted path plus a message. */
export const ProgressiveSceneIssueSchema = z
  .strictObject({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .meta({
    id: 'ProgressiveSceneIssue',
    title: 'ProgressiveSceneIssue',
    description: 'One typed diagnostic issue: dotted path plus message.',
  });

/** One typed issue. */
export type ProgressiveSceneIssue = z.infer<typeof ProgressiveSceneIssueSchema>;

/** The discriminated error union of the progressive-scene kernel. */
export const ProgressiveSceneErrorSchema = z.discriminatedUnion('code', [
  z
    .strictObject({
      code: z.literal('malformed-record'),
      message: z.string().min(1),
      issues: z.array(ProgressiveSceneIssueSchema).min(1),
    })
    .meta({ id: 'MalformedRecordError', title: 'MalformedRecordError' }),
  z
    .strictObject({
      code: z.literal('version-unsupported'),
      message: z.string().min(1),
      expected: z.string().min(1),
      encountered: z.string().min(1),
    })
    .meta({ id: 'VersionUnsupportedError', title: 'VersionUnsupportedError' }),
  z
    .strictObject({
      code: z.literal('digest-mismatch'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])).readonly(),
      expected: Sha256HexSchema,
      encountered: Sha256HexSchema,
    })
    .meta({ id: 'DigestMismatchError', title: 'DigestMismatchError' }),
  z
    .strictObject({
      code: z.literal('cross-tenant-denied'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])).readonly(),
      expectedTenantId: z.string().min(1),
      encounteredTenantId: z.string().min(1),
    })
    .meta({ id: 'CrossTenantDeniedError', title: 'CrossTenantDeniedError' }),
  z
    .strictObject({
      code: z.literal('unfittable-scene'),
      message: z.string().min(1),
      /** The minimal-core usage that still exceeds the target budgets. */
      minimalUsage: z
        .strictObject({
          nodes: z.number().int().nonnegative(),
          edges: z.number().int().nonnegative(),
          estimatedTriangles: z.number().int().nonnegative(),
          assetBytes: z.number().int().nonnegative(),
        })
        .readonly(),
      /** The target budget envelope that could not be satisfied. */
      limits: z
        .strictObject({
          maxGraphNodes: z.number().int().min(1),
          maxGraphEdges: z.number().int().min(0),
          maxTriangles: z.number().int().positive().optional(),
          maxTextureBytes: z.number().int().positive().optional(),
        })
        .readonly(),
    })
    .meta({ id: 'UnfittableSceneError', title: 'UnfittableSceneError' }),
  z
    .strictObject({
      code: z.literal('invalid-rung-index'),
      message: z.string().min(1),
      encountered: RungIndexSchema,
      /** The exclusive upper bound of valid rung indices. */
      rungCount: z.number().int().min(1),
    })
    .meta({ id: 'InvalidRungIndexError', title: 'InvalidRungIndexError' }),
]);

/** One typed progressive-scene error. */
export type ProgressiveSceneError = z.infer<typeof ProgressiveSceneErrorSchema>;

/** The total-result shape used by every kernel entry point. */
export type ProgressiveSceneResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProgressiveSceneError };
