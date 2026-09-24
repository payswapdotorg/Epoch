// @epoch/constraint-language — compiled constraint schema (deterministic enforcement artifact).
import { z } from 'zod';
import {
  constraintIdSchema,
  descriptionSchema,
  ECL_COMPILER,
  ECL_LANGUAGE_VERSION,
  inputNameSchema,
  permissionSchema,
  semverSchema,
  severitySchema,
  tagsSchema,
  titleSchema,
} from './common';
import { CompiledExprSchema } from './expression';
import { inputDeclarationSchema } from './authored';

const compiledDigestSchema = z
  .string()
  .regex(/^[0-9a-f]{8}$/, 'digests are 8 lowercase hex chars')
  .describe('FNV-1a digest over the canonical JSON of the compiled constraint (digest excluded).');

const evidenceRequirementSchema = z.strictObject({
  kind: z.string().min(1).max(128),
  minCount: z.number().int().min(1),
});

const baseShape = {
  languageVersion: z.literal(ECL_LANGUAGE_VERSION),
  id: constraintIdSchema,
  version: semverSchema,
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  tags: tagsSchema.optional(),
  severity: severitySchema.optional(),
  inputs: z.array(inputDeclarationSchema).min(1),
  appliesWhen: CompiledExprSchema.optional(),
};

export const compiledPayloadSchema = z
  .discriminatedUnion('class', [
    z.strictObject({ class: z.literal('hard') }),
    z.strictObject({
      class: z.literal('soft'),
      weight: z.number().positive().max(1e9),
    }),
    z.strictObject({
      class: z.literal('resource'),
      usage: CompiledExprSchema,
      limit: CompiledExprSchema,
      unit: z.string().min(1).max(64),
    }),
    z.strictObject({
      class: z.literal('safety'),
      regulations: z.array(z.string().min(1).max(128)).min(1).max(32),
    }),
    z.strictObject({
      class: z.literal('epistemic'),
      confidence: CompiledExprSchema,
      threshold: CompiledExprSchema,
      evidenceInput: inputNameSchema.optional(),
      requiredEvidence: z.array(evidenceRequirementSchema).max(64).optional(),
    }),
    z.strictObject({
      class: z.literal('authority'),
      permissionsInput: inputNameSchema,
      allOf: z.array(permissionSchema).max(64),
      anyOf: z.array(permissionSchema).max(64),
    }),
  ])
  .describe('Class-specific compiled payload used to enrich evaluation results.');

export type CompiledPayload = z.infer<typeof compiledPayloadSchema>;

export const compiledConstraintSchema = z
  .strictObject({
    ...baseShape,
    root: CompiledExprSchema.describe(
      "Boolean violation expression: 'true' means the constraint is violated.",
    ),
    payload: compiledPayloadSchema,
    compiler: z
      .strictObject({
        name: z.literal(ECL_COMPILER.name),
        version: z.literal(ECL_COMPILER.version),
      })
      .describe('Compiler identity stamp.'),
    compiledDigest: compiledDigestSchema,
  })
  .describe(
    'Compiled deterministic evaluation contract: pure, side-effect-free and total ' +
      'over its declared input types.',
  );

export type CompiledConstraint = z.infer<typeof compiledConstraintSchema>;
