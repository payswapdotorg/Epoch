// @epoch/constraint-language — authored constraint schema (compilation input).
//
// The authored form is the structured, human-editable, serializable AST that
// natural-language authoring adapters produce; it is the INPUT of the compiler.
// Natural-language parsing itself is out of scope (an adapter concern).
import { z } from 'zod';
import {
  constraintIdSchema,
  descriptionSchema,
  ECL_LANGUAGE_VERSION,
  inputNameSchema,
  inputTypeSchema,
  permissionSchema,
  semverSchema,
  severitySchema,
  tagsSchema,
  titleSchema,
} from './common';
import { AuthoredExprSchema } from './expression';

export const inputDeclarationSchema = z
  .strictObject({
    name: inputNameSchema,
    type: inputTypeSchema,
    values: z
      .array(z.string().min(1).max(128))
      .min(1)
      .max(64)
      .optional()
      .describe('Required iff type is "enum": the finite set of allowed strings.'),
    description: descriptionSchema.optional(),
  })
  .describe('Declared evaluation-context input slot.');

export type InputDeclaration = z.infer<typeof inputDeclarationSchema>;

const evidenceRequirementSchema = z
  .strictObject({
    kind: z.string().min(1).max(128).describe('Evidence kind (a key of the evidence record input).'),
    minCount: z.number().int().min(1).describe('Minimum number of evidence items of this kind.'),
  })
  .describe('Required evidence for epistemic constraints.');

const baseShape = {
  languageVersion: z.literal(ECL_LANGUAGE_VERSION).describe('ECL language version gate.'),
  id: constraintIdSchema,
  version: semverSchema.describe('Version of this constraint document.'),
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  tags: tagsSchema.optional(),
  severity: severitySchema.optional(),
  appliesWhen: AuthoredExprSchema.optional().describe(
    'Optional boolean applicability guard; when it evaluates to false the ' +
      "constraint outcome is 'not-applicable'.",
  ),
  inputs: z.array(inputDeclarationSchema).min(1).describe('Declared evaluation-context input slots.'),
};

export const authoredConstraintSchema = z
  .discriminatedUnion('class', [
    z
      .strictObject({
        ...baseShape,
        class: z.literal('hard').describe('Must hold; violation blocks.'),
        predicate: AuthoredExprSchema.describe('Boolean expression that must hold.'),
      })
      .describe('Hard constraint: violation blocks.'),
    z
      .strictObject({
        ...baseShape,
        class: z.literal('soft').describe('Preference; violation scores/penalizes.'),
        predicate: AuthoredExprSchema.describe('Boolean expression that should hold.'),
        weight: z
          .number()
          .positive()
          .max(1e9)
          .describe('Penalty applied when the predicate is violated.'),
      })
      .describe('Soft constraint: violation penalizes (never blocks on its own).'),
    z
      .strictObject({
        ...baseShape,
        class: z.literal('resource').describe('Measurable budget; overage blocks.'),
        usage: AuthoredExprSchema.describe('Number expression: measured consumption.'),
        limit: AuthoredExprSchema.describe('Number expression: allowed budget.'),
        unit: z.string().min(1).max(64).describe('Measurement unit, echoed in results.'),
      })
      .describe('Resource constraint: violated iff usage exceeds limit.'),
    z
      .strictObject({
        ...baseShape,
        class: z.literal('safety').describe('Safety/regulatory; violation blocks.'),
        predicate: AuthoredExprSchema.describe('Boolean expression that must hold.'),
        regulations: z
          .array(z.string().min(1).max(128))
          .min(1)
          .max(32)
          .describe('Regulation/clause references echoed in results for audit.'),
      })
      .describe('Safety/regulatory constraint: violation blocks with regulation references.'),
    z
      .strictObject({
        ...baseShape,
        class: z.literal('epistemic').describe('Evidence/uncertainty threshold.'),
        confidence: AuthoredExprSchema.describe('Number expression: computed confidence.'),
        threshold: AuthoredExprSchema.describe('Number expression: required confidence floor.'),
        evidenceInput: inputNameSchema
          .optional()
          .describe('Name of a record input holding evidence counts (required when requiredEvidence is set).'),
        requiredEvidence: z
          .array(evidenceRequirementSchema)
          .max(64)
          .optional()
          .describe('Evidence kinds that must be present with minimum counts.'),
      })
      .describe('Epistemic constraint: violated below the confidence threshold or with insufficient evidence.'),
    z
      .strictObject({
        ...baseShape,
        class: z.literal('authority').describe('Permission assertion; denial blocks.'),
        permissionsInput: inputNameSchema.describe('Name of a list input holding granted permissions.'),
        allOf: z
          .array(permissionSchema)
          .max(64)
          .describe('Permissions that must ALL be granted (may be empty).'),
        anyOf: z
          .array(permissionSchema)
          .max(64)
          .describe('Permissions of which at least ONE must be granted (may be empty).'),
      })
      .describe(
        'Authority constraint: satisfied iff every allOf permission is granted and ' +
          '(when anyOf is non-empty) at least one anyOf permission is granted.',
      ),
  ])
  .describe('Authored ECL constraint (structured, human-editable, serializable).');

export type AuthoredConstraint = z.infer<typeof authoredConstraintSchema>;
