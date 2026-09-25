/**
 * The typed compiler-error taxonomy.
 *
 * Every compile or plan-admission failure is a discriminated
 * {@link CompilerError} value (never a bare throw), so consumers branch
 * deterministically on `code`. The error precedence of the compile
 * pipeline is fixed and documented in src/compile.ts; the plan-admission
 * precedence is documented in src/parse.ts.
 *
 * The six W011 admission codes are shape-compatible members (the compiler
 * reuses the W011 admission discipline and surfaces its failures 1:1);
 * `device-budget-exceeded` is the compiler-owned device-shaping rejection.
 */
import { z } from 'zod';

/** One flattened validation issue (dotted path + message; "$" = root). */
export const CompilerIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .meta({
    id: 'CompilerIssue',
    title: 'CompilerIssue',
    description: 'One flattened compiler validation issue: dotted path ("$" = root) plus message.',
  });

/** One flattened issue. */
export type CompilerIssue = z.infer<typeof CompilerIssueSchema>;

/** Where an authority-violation key came from. */
export const AUTHORITY_VIOLATION_ORIGINS = ['kernel-reserved', 'vendor-blocklist'] as const;

/** One authority-violation origin. */
export type AuthorityViolationOrigin = (typeof AUTHORITY_VIOLATION_ORIGINS)[number];

/**
 * The typed compiler error (discriminated on `code`):
 * - `version-unsupported` — protocol/descriptor version skew;
 * - `malformed-descriptor` — schema violations with flattened issues
 *   (strict objects reject unknown — vendor/engine — fields here);
 * - `digest-mismatch` — claimed digest ≠ recomputed digest (tamper
 *   detection, envelope or plan);
 * - `cross-tenant-denied` — reference or scope outside the owning tenant;
 * - `unknown-reference` — reference to kernel state or plan content
 *   outside the resolvable set;
 * - `authority-violation` — kernel-reserved or vendor/engine keys where
 *   they do not belong, each violation carrying its origin;
 * - `device-budget-exceeded` — the compiled content exceeds a typed device
 *   budget (never silently degraded).
 */
export const CompilerErrorSchema = z
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
      issues: z.array(CompilerIssueSchema).min(1),
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
            origin: z.enum(AUTHORITY_VIOLATION_ORIGINS),
          }),
        )
        .min(1),
    }),
    z.strictObject({
      code: z.literal('device-budget-exceeded'),
      message: z.string().min(1),
      path: z.array(z.union([z.string(), z.number()])),
      limit: z.enum(['maxTriangles', 'maxTextureBytes']),
      expected: z.number().int().positive(),
      encountered: z.number().int().nonnegative(),
    }),
  ])
  .meta({
    id: 'CompilerError',
    title: 'CompilerError',
    description: 'Typed, discriminated compile/admission error of the experience compiler.',
  });

/** One typed compiler error. */
export type CompilerError = z.infer<typeof CompilerErrorSchema>;

/** Result of a total compiler entry point. */
export type CompilerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CompilerError };
