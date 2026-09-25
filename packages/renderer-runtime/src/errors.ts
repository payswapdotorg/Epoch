/**
 * The typed renderer-error taxonomy of the hosting surface.
 *
 * Every admission or enforcement failure is a discriminated
 * {@link RendererRuntimeError} value (never a bare throw), so consumers
 * branch deterministically on `code`. The enforcement precedence of the
 * invocation pipeline is fixed and documented in src/enforcement.ts.
 *
 * `malformed-invocation` failures may carry a typed `cause` — the
 * verbatim W011 admission error of an embedded Experience Graph document
 * — so kernel-boundary failures (authority violations, cross-tenant
 * references, ...) stay fully typed end-to-end (R12, lock rule 8).
 */
import { z } from 'zod';
import { ExperienceProtocolErrorSchema } from '@epoch/experience-protocol';
import { RendererErrorCodeSchema } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export const RendererIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .meta({
    id: 'RendererIssue',
    title: 'RendererIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** One flattened issue. */
export type RendererIssue = z.infer<typeof RendererIssueSchema>;

/**
 * The typed renderer error (discriminated on `code`):
 * - `budget-exceeded` — usage beyond an effective limit (resource-named,
 *   with limit and encountered values);
 * - `capability-denied` — use of an undeclared capability (graph kind or
 *   interaction modality), with the declared set and the encountered
 *   value — the W008 permission pattern applied to renderers;
 * - `cross-tenant-denied` — binding, graph, or operation outside the
 *   owning tenant (R12);
 * - `digest-mismatch` — claimed digest ≠ recomputed content (sealed
 *   records, mount envelopes);
 * - `invalid-invocation` — semantic contract violation (non-monotonic
 *   frame index, missing declared usage against a bounded resource);
 * - `malformed-invocation` — envelope schema violations (strict objects
 *   reject unknown — vendor/engine — fields here), optionally carrying
 *   the typed W011 cause of an embedded graph-admission failure;
 * - `malformed-record` — descriptor/binding/receipt schema violations;
 * - `session-closed` — invocation (or close) on a closed binding;
 * - `unknown-session` — envelope targeting a different renderer session;
 * - `version-unsupported` — protocolVersion skew (expected/encountered).
 */
export const RendererRuntimeErrorSchema = z
  .discriminatedUnion('code', [
    z.strictObject({
      code: z.literal('budget-exceeded'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      /** Which effective budget was exceeded. */
      resource: z.enum(['graph-edges', 'graph-nodes', 'texture-bytes', 'triangles']),
      /** The effective limit that was exceeded. */
      limit: z.number(),
      /** The encountered usage. */
      encountered: z.number(),
    }),
    z.strictObject({
      code: z.literal('capability-denied'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      /** The declared capability set of the binding. */
      declared: z.array(z.string()),
      /** The encountered (undeclared) capability use. */
      encountered: z.string(),
    }),
    z.strictObject({
      code: z.literal('cross-tenant-denied'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      expectedTenantId: z.string(),
      encounteredTenantId: z.string(),
    }),
    z.strictObject({
      code: z.literal('digest-mismatch'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      expected: z.string(),
      encountered: z.string(),
    }),
    z.strictObject({
      code: z.literal('invalid-invocation'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      expected: z.string(),
      encountered: z.string(),
    }),
    z.strictObject({
      code: z.literal('malformed-invocation'),
      message: z.string().min(1),
      issues: z.array(RendererIssueSchema).min(1),
      /** The typed W011 admission error of an embedded graph document. */
      cause: ExperienceProtocolErrorSchema.optional(),
    }),
    z.strictObject({
      code: z.literal('malformed-record'),
      message: z.string().min(1),
      issues: z.array(RendererIssueSchema).min(1),
    }),
    z.strictObject({
      code: z.literal('session-closed'),
      message: z.string().min(1),
      rendererSessionId: z.string(),
    }),
    z.strictObject({
      code: z.literal('unknown-session'),
      message: z.string().min(1),
      expectedSessionId: z.string(),
      encounteredSessionId: z.string(),
    }),
    z.strictObject({
      code: z.literal('version-unsupported'),
      message: z.string().min(1),
      expected: z.string(),
      encountered: z.string(),
    }),
  ])
  .meta({
    id: 'RendererRuntimeError',
    title: 'RendererRuntimeError',
    description: 'Typed, discriminated renderer error of the hosting surface.',
  });

/** One typed renderer error. */
export type RendererRuntimeError = z.infer<typeof RendererRuntimeErrorSchema>;

/** Result of a total renderer-runtime entry point. */
export type RendererRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RendererRuntimeError };

// Re-export for schema-surface consumers.
export { RendererErrorCodeSchema };
