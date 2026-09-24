// @epoch/constraint-language — evaluation context schema + dynamic per-constraint builder.
import { z } from 'zod';
import type { JsonValue } from '../types';
import type { CompiledConstraint } from './compiled';
import type { InputDeclaration } from './authored';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const evaluationContextSchema = z
  .strictObject({
    inputs: z
      .record(z.string(), jsonValueSchema)
      .describe(
        'Input slot values keyed by declared input name. Validated per-constraint ' +
          'against the compiled input declarations (exact keys, exact types; ' +
          'numbers must be finite).',
      ),
  })
  .describe('Typed evaluation context consumed by the deterministic evaluator.');

export type EvaluationContext = z.infer<typeof evaluationContextSchema>;

/** Values a compiled input slot may carry at runtime. */
export type ContextInputValue = number | string | boolean | Record<string, number> | string[];

function slotSchema(declaration: InputDeclaration): z.ZodType<ContextInputValue> {
  switch (declaration.type) {
    case 'number':
      return z.number();
    case 'string':
      return z.string();
    case 'boolean':
      return z.boolean();
    case 'enum': {
      const values = declaration.values ?? [];
      return z.enum(values as [string, ...string[]]);
    }
    case 'record':
      return z.record(z.string(), z.number());
    case 'list':
      return z.array(z.string());
  }
}

/**
 * Build the strict per-constraint context schema from a compiled constraint's
 * declared inputs. The schema requires exactly the declared keys with exactly
 * the declared types (no unknown keys, no missing keys, finite numbers).
 */
export function buildContextSchema(
  compiled: CompiledConstraint,
): z.ZodType<{ inputs: Record<string, ContextInputValue> }> {
  const shape: Record<string, z.ZodType<ContextInputValue>> = {};
  for (const declaration of compiled.inputs) {
    shape[declaration.name] = slotSchema(declaration);
  }
  return z.strictObject({ inputs: z.strictObject(shape) }) as unknown as z.ZodType<{
    inputs: Record<string, ContextInputValue>;
  }>;
}
