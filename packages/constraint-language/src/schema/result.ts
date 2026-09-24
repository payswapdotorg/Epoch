// @epoch/constraint-language — evaluation result schemas.
//
// Violation semantics are carried by the result types (architecture: hard
// violations block; soft violations score/penalize; resource violations are
// measurable budget overages; epistemic violations are evidence/uncertainty
// shortfalls; authority violations are permission denials).
import { z } from 'zod';
import { constraintClassSchema } from './common';

export const constraintOutcomeSchema = z
  .enum(['satisfied', 'violated', 'not-applicable'])
  .describe(
    "Outcome of evaluating a compiled constraint. 'not-applicable' is produced when " +
      'the authored appliesWhen guard evaluates to false.',
  );

export const constraintEffectSchema = z
  .enum(['block', 'penalize', 'none'])
  .describe(
    "Deterministic effect derived from class + outcome: violated hard/safety/resource/" +
      "epistemic/authority constraints block; violated soft constraints penalize; " +
      "everything else has no effect.",
  );

const finiteOrNone = z
  .union([z.number(), z.null()])
  .describe(
    'Computed number, or null when the computation was non-finite (NaN/±Infinity) ' +
      "or was skipped because the constraint is 'not-applicable'.",
  );

export const resultDetailsSchema = z
  .discriminatedUnion('class', [
    z.strictObject({
      class: z.literal('hard'),
      severity: z.enum(['critical', 'major', 'minor']).optional(),
    }),
    z.strictObject({
      class: z.literal('soft'),
      weight: z.number().positive(),
    }),
    z.strictObject({
      class: z.literal('resource'),
      unit: z.string(),
      usage: finiteOrNone,
      limit: finiteOrNone,
      remaining: finiteOrNone,
    }),
    z.strictObject({
      class: z.literal('safety'),
      regulations: z.array(z.string()),
    }),
    z.strictObject({
      class: z.literal('epistemic'),
      confidence: finiteOrNone,
      threshold: finiteOrNone,
      evidence: z
        .array(
          z.strictObject({
            kind: z.string(),
            required: z.number(),
            actual: z.number(),
          }),
        )
        .describe('Per-required-evidence-kind check results (empty when none required).'),
    }),
    z.strictObject({
      class: z.literal('authority'),
      allOf: z.array(z.string()),
      anyOf: z.array(z.string()),
      missing: z.array(z.string()).describe('Required permissions not granted.'),
      matchedAnyOf: z
        .union([z.string(), z.null()])
        .describe('The anyOf permission that was matched, or null.'),
    }),
  ])
  .describe('Class-specific evaluation details.');

export const evaluationResultSchema = z
  .strictObject({
    constraintId: z.string(),
    constraintVersion: z.string(),
    constraintClass: constraintClassSchema,
    outcome: constraintOutcomeSchema,
    effect: constraintEffectSchema,
    violated: z.boolean().describe('Convenience flag: outcome === "violated".'),
    penalty: z
      .number()
      .describe(
        'Penalty applied by this result: the soft weight when violated, otherwise 0.',
      ),
    message: z.string().describe('Deterministic human-readable summary.'),
    details: resultDetailsSchema,
    evaluationDigest: z
      .string()
      .regex(/^[0-9a-f]{8}$/)
      .describe(
        'FNV-1a digest over the canonical JSON of this result (digest excluded): ' +
          'identical constraint + context always yields an identical result digest.',
      ),
  })
  .describe('Deterministic, serializable evaluation result for one compiled constraint.');

export type ConstraintEvaluationResult = z.infer<typeof evaluationResultSchema>;
export type ConstraintOutcome = z.infer<typeof constraintOutcomeSchema>;
export type ConstraintEffect = z.infer<typeof constraintEffectSchema>;
export type ResultDetails = z.infer<typeof resultDetailsSchema>;

export const evaluationRejectionKindSchema = z.enum([
  'invalid-compiled',
  'invalid-context',
  'invalid-result',
]);

export type EvaluationRejectionKind = z.infer<typeof evaluationRejectionKindSchema>;

export const validationIssueArraySchema = z.array(
  z.strictObject({
    path: z.string(),
    code: z.string(),
    message: z.string(),
  }),
);

export const evaluationOutcomeSchema = z
  .discriminatedUnion('ok', [
    z.strictObject({
      ok: z.literal(true),
      result: evaluationResultSchema,
    }),
    z.strictObject({
      ok: z.literal(false),
      kind: evaluationRejectionKindSchema,
      issues: validationIssueArraySchema,
    }),
  ])
  .describe(
    'Total evaluation outcome: the reference evaluator never throws; every input ' +
      'yields either a result or a typed rejection.',
  );

export type EvaluationOutcome = z.infer<typeof evaluationOutcomeSchema>;
