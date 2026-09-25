/**
 * The typed session-error taxonomy of the experience runtime.
 *
 * Every admission or transition failure is a discriminated
 * {@link ExperienceRuntimeError} value (never a bare throw), so consumers
 * branch deterministically on `code`. The error precedence of the
 * admission pipeline is fixed and documented in src/parse.ts; lifecycle
 * transitions surface `invalid-transition` with the operation and the
 * state it was attempted from.
 */
import { z } from 'zod';
import { ExperienceRuntimeErrorCodeSchema, DeviceSessionStateSchema } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export const ExperienceRuntimeIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .meta({
    id: 'ExperienceRuntimeIssue',
    title: 'ExperienceRuntimeIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** One flattened issue. */
export type ExperienceRuntimeIssue = z.infer<typeof ExperienceRuntimeIssueSchema>;

/**
 * The typed session error (discriminated on `code`):
 * - `cross-tenant-denied` — session, trace, or operation outside the
 *   owning tenant (R12);
 * - `digest-mismatch` — claimed record digest ≠ recomputed digest;
 * - `invalid-transition` — a lifecycle or virtual-time transition applied
 *   in a state that does not admit it;
 * - `malformed-record` — schema violations with flattened issues (strict
 *   objects reject unknown — vendor/engine — fields here);
 * - `version-unsupported` — protocolVersion skew (expected/encountered).
 */
export const ExperienceRuntimeErrorSchema = z
  .discriminatedUnion('code', [
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
      code: z.literal('invalid-transition'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      operation: z.string(),
      sessionState: DeviceSessionStateSchema,
    }),
    z.strictObject({
      code: z.literal('malformed-record'),
      message: z.string().min(1),
      issues: z.array(ExperienceRuntimeIssueSchema).min(1),
    }),
    z.strictObject({
      code: z.literal('version-unsupported'),
      message: z.string().min(1),
      expected: z.string(),
      encountered: z.string(),
    }),
  ])
  .meta({
    id: 'ExperienceRuntimeError',
    title: 'ExperienceRuntimeError',
    description: 'Typed, discriminated session error of the experience runtime.',
  });

/** One typed session error. */
export type ExperienceRuntimeError = z.infer<typeof ExperienceRuntimeErrorSchema>;

/** Result of a total experience-runtime entry point. */
export type ExperienceRuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExperienceRuntimeError };

// Re-export for schema-surface consumers.
export { ExperienceRuntimeErrorCodeSchema };
