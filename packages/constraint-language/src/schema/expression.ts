// @epoch/constraint-language — authored and compiled expression schemas.
//
// The expression language is a closed, total, side-effect-free operator set:
// every node is data. There is deliberately no `now`, `random`, `call`, `eval`
// or any other impure/nondeterministic construct — wall-clock time and other
// environment facts must be passed in as declared inputs, which is exactly what
// makes compiled evaluation deterministic and serializable.
import { z } from 'zod';
import type { AuthoredExpr, CompiledExpr } from '../types';
import { literalTypeSchema, tagSchema, valueTypeSchema } from './common';

const recordKeySchema = z.string().min(1).max(128).describe('Record key (e.g. an evidence kind).');

const authoredExprSchema: z.ZodType<AuthoredExpr> = z.lazy(() =>
  z
    .discriminatedUnion('node', [
      z.strictObject({
        node: z.literal('lit'),
        type: literalTypeSchema.describe('Static type of the literal.'),
        value: z.union([z.number(), z.string(), z.boolean()]).describe('Literal value.'),
      }),
      z.strictObject({
        node: z.literal('input'),
        name: z.string().describe('Reference to a declared input.'),
      }),
      z.strictObject({ node: z.literal('lt'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('le'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('gt'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('ge'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('eq'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('ne'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({
        node: z.literal('and'),
        operands: z.array(authoredExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('or'),
        operands: z.array(authoredExprSchema).min(2),
      }),
      z.strictObject({ node: z.literal('not'), operand: authoredExprSchema }),
      z.strictObject({
        node: z.literal('implies'),
        antecedent: authoredExprSchema,
        consequent: authoredExprSchema,
      }),
      z.strictObject({
        node: z.literal('add'),
        operands: z.array(authoredExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('mul'),
        operands: z.array(authoredExprSchema).min(2),
      }),
      z.strictObject({ node: z.literal('sub'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({ node: z.literal('div'), left: authoredExprSchema, right: authoredExprSchema }),
      z.strictObject({
        node: z.literal('has'),
        record: authoredExprSchema,
        key: recordKeySchema,
      }),
      z.strictObject({
        node: z.literal('get'),
        record: authoredExprSchema,
        key: recordKeySchema,
        fallback: authoredExprSchema.describe('Total-lookup default when the key is absent.'),
      }),
      z.strictObject({ node: z.literal('count'), list: authoredExprSchema }),
      z.strictObject({
        node: z.literal('contains'),
        list: authoredExprSchema,
        value: z.string().min(1).max(128).describe('List member to test for.'),
      }),
    ])
    .describe('ECL expression AST node.'),
);

export const AuthoredExprSchema = authoredExprSchema;

const compiledExprSchema: z.ZodType<CompiledExpr> = z.lazy(() =>
  z
    .discriminatedUnion('node', [
      z.strictObject({
        node: z.literal('lit'),
        resultType: valueTypeSchema,
        type: literalTypeSchema,
        value: z.union([z.number(), z.string(), z.boolean()]),
      }),
      z.strictObject({ node: z.literal('input'), resultType: valueTypeSchema, name: z.string() }),
      z.strictObject({
        node: z.literal('lt'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('le'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('gt'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('ge'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('eq'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('ne'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('and'),
        resultType: valueTypeSchema,
        operands: z.array(compiledExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('or'),
        resultType: valueTypeSchema,
        operands: z.array(compiledExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('not'),
        resultType: valueTypeSchema,
        operand: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('implies'),
        resultType: valueTypeSchema,
        antecedent: compiledExprSchema,
        consequent: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('add'),
        resultType: valueTypeSchema,
        operands: z.array(compiledExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('mul'),
        resultType: valueTypeSchema,
        operands: z.array(compiledExprSchema).min(2),
      }),
      z.strictObject({
        node: z.literal('sub'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('div'),
        resultType: valueTypeSchema,
        left: compiledExprSchema,
        right: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('has'),
        resultType: valueTypeSchema,
        record: compiledExprSchema,
        key: recordKeySchema,
      }),
      z.strictObject({
        node: z.literal('get'),
        resultType: valueTypeSchema,
        record: compiledExprSchema,
        key: recordKeySchema,
        fallback: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('count'),
        resultType: valueTypeSchema,
        list: compiledExprSchema,
      }),
      z.strictObject({
        node: z.literal('contains'),
        resultType: valueTypeSchema,
        list: compiledExprSchema,
        value: z.string().min(1).max(128),
      }),
    ])
    .describe('Compiled (type-annotated, constant-folded) ECL expression node.'),
);

export const CompiledExprSchema = compiledExprSchema;

/** Every operator kind accepted by the authored/compiled expression schemas. */
export const EXPR_NODE_KINDS = [
  'lit',
  'input',
  'lt',
  'le',
  'gt',
  'ge',
  'eq',
  'ne',
  'and',
  'or',
  'not',
  'implies',
  'add',
  'sub',
  'mul',
  'div',
  'has',
  'get',
  'count',
  'contains',
] as const;

export type ExprNodeKind = (typeof EXPR_NODE_KINDS)[number];

// Re-exported for schema consumers; the tag schema lives here so expression
// files share a single import surface for shared primitives.
export { tagSchema };
