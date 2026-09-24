// @epoch/constraint-language — shared schema primitives for the ECL surface.
import { z } from 'zod';

/** Language version of the authored/compiled forms published by this package. */
export const ECL_LANGUAGE_VERSION = '1.0.0' as const;

/** Compiler identity stamped onto every compiled constraint. */
export const ECL_COMPILER = { name: 'epoch-ecl-compiler', version: '1.0.0' } as const;

/** Structural limits enforced before any recursive validation/compilation. */
export const ECL_LIMITS = {
  /** Maximum nesting depth of any authored/compiled JSON payload. */
  maxAstDepth: 128,
  /** Maximum total number of JSON nodes in any authored/compiled payload. */
  maxAstNodes: 10_000,
  /** Maximum number of declared inputs per constraint. */
  maxInputs: 64,
} as const;

export const inputNameSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, 'input names must match /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/')
  .describe('Declared input name referenced by `input` expression nodes.');

export const constraintIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,127}$/, 'ids must match /^[a-z][a-z0-9-]{0,127}$/')
  .describe('Stable, human-readable constraint identifier (lowercase kebab-case).');

export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'versions must be plain semver core (MAJOR.MINOR.PATCH)')
  .describe('Semantic version of the constraint or policy document itself.');

export const titleSchema = z.string().min(1).max(256).describe('Short human title.');

export const descriptionSchema = z.string().min(1).max(4096).describe('Longer human description.');

export const tagSchema = z.string().min(1).max(64);
export const tagsSchema = z.array(tagSchema).max(32).describe('Free-form classification tags.');

export const severitySchema = z
  .enum(['critical', 'major', 'minor'])
  .describe('Optional severity metadata, echoed in evaluation results.');

export const constraintClassSchema = z
  .enum(['hard', 'soft', 'resource', 'safety', 'epistemic', 'authority'])
  .describe('Constraint class (R3): determines violation semantics in results.');

export const literalTypeSchema = z.enum(['number', 'string', 'boolean']);

export const valueTypeSchema = z.enum(['number', 'string', 'boolean', 'record', 'list']);

export const inputTypeSchema = z
  .enum(['number', 'string', 'boolean', 'enum', 'record', 'list'])
  .describe(
    'Declared input slot type: number | string | boolean | enum (finite string set) | ' +
      'record (string -> number, e.g. evidence counts) | list (string[], e.g. granted permissions).',
  );

export const permissionSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9:_-]{0,127}$/, 'permissions must match /^[a-z0-9][a-z0-9:_-]{0,127}$/')
  .describe('Permission identifier, e.g. "action:execute".');

export const validationIssueSchema = z
  .strictObject({
    path: z.string().describe('Dot/bracket path to the offending element ("$" = root).'),
    code: z.string().describe('Stable machine-readable error/rejection code.'),
    message: z.string().describe('Human-readable deterministic message.'),
  })
  .describe('Structured validation issue shared by compile outcomes and evaluation rejections.');

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/** Join a zod issue path onto a base path, producing "inputs.count[2]" style strings. */
export function joinIssuePath(base: string | undefined, segments: readonly PropertyKey[]): string {
  let path = base ?? '';
  for (const segment of segments) {
    if (typeof segment === 'number') {
      path += `[${segment}]`;
    } else {
      path += path === '' ? String(segment) : `.${String(segment)}`;
    }
  }
  return path === '' ? '$' : path;
}

/** Map a zod error into structured validation issues (code "schema"). */
export function zodIssuesToValidationIssues(
  error: z.ZodError,
  basePath?: string,
  code = 'schema',
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: joinIssuePath(basePath, issue.path),
    code,
    message: issue.message,
  }));
}
