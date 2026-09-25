/**
 * The typed admission-error taxonomy of the experience protocol.
 *
 * Every admission failure is a discriminated {@link ExperienceProtocolError}
 * value (never a bare throw), so consumers branch deterministically on
 * `code`. The error precedence of the admission pipeline is fixed and
 * documented in src/parse.ts.
 */
import { z } from 'zod';
import { ExperienceErrorCodeSchema } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export const ExperienceIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .meta({
    id: 'ExperienceIssue',
    title: 'ExperienceIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** One flattened issue. */
export type ExperienceIssue = z.infer<typeof ExperienceIssueSchema>;

/**
 * The typed admission error (discriminated on `code`):
 * - `version-unsupported` — protocolVersion skew (expected/encountered);
 * - `malformed-descriptor` — schema violations with flattened issues
 *   (strict objects reject unknown — vendor/engine — fields here);
 * - `digest-mismatch` — claimed envelope digest ≠ recomputed digest;
 * - `cross-tenant-denied` — reference or scope outside the owning tenant;
 * - `unknown-reference` — reference to kernel state outside the projection
 *   inputs, or to an experience node that does not exist;
 * - `authority-violation` — kernel semantic vocabulary in a presentation
 *   attribute record (inline world state instead of opaque references).
 */
export const ExperienceProtocolErrorSchema = z
  .discriminatedUnion('code', [
    z.strictObject({
      code: z.literal('version-unsupported'),
      message: z.string().min(1),
      expected: z.string(),
      encountered: z.string(),
    }),
    z.strictObject({
      code: z.literal('malformed-descriptor'),
      message: z.string().min(1),
      issues: z.array(ExperienceIssueSchema).min(1),
    }),
    z.strictObject({
      code: z.literal('digest-mismatch'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      expected: z.string(),
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
      code: z.literal('unknown-reference'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      reference: z.string(),
    }),
    z.strictObject({
      code: z.literal('authority-violation'),
      message: z.string().min(1),
      violations: z
        .array(
          z.strictObject({
            path: z.string(),
            key: z.string(),
          }),
        )
        .min(1),
    }),
  ])
  .meta({
    id: 'ExperienceProtocolError',
    title: 'ExperienceProtocolError',
    description: 'Typed, discriminated admission error of the experience protocol.',
  });

/** One typed admission error. */
export type ExperienceProtocolError = z.infer<typeof ExperienceProtocolErrorSchema>;

/** Result of a total admission entry point. */
export type ExperienceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExperienceProtocolError };

// Re-export for schema-surface consumers.
export { ExperienceErrorCodeSchema };
