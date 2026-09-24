// @epoch/policy-contracts — policy document schema.
//
// Policy stays DISTINCT from constraint semantics (architecture lock rule 12):
// a policy document binds constraint references to applicability scopes with
// precedence and composition rules. It never redefines what a constraint
// means; it decides which constraints apply where, and how their evaluation
// results combine.
import { z } from 'zod';
import {
  constraintIdSchema,
  semverSchema,
  descriptionSchema,
} from '@epoch/constraint-language';

export const POLICY_LANGUAGE_VERSION = '1.0.0' as const;

export const POLICY_PRECEDENCE_TIERS = ['platform', 'tenant', 'workspace', 'project'] as const;

export type PolicyPrecedenceTier = (typeof POLICY_PRECEDENCE_TIERS)[number];

/** Higher tier index = higher precedence (platform > tenant > workspace > project). */
export const POLICY_PRECEDENCE_TIER_ORDER: ReadonlyMap<PolicyPrecedenceTier, number> = new Map(
  POLICY_PRECEDENCE_TIERS.map((tier, index) => [tier, POLICY_PRECEDENCE_TIERS.length - index]),
);

const scopeStringSchema = z.string().min(1).max(256);

export const policyScopeSchema = z
  .strictObject({
    tenantId: scopeStringSchema.optional().describe('Exact tenant match.'),
    workspaceId: scopeStringSchema.optional().describe('Exact workspace match.'),
    projectId: scopeStringSchema.optional().describe('Exact project match.'),
    actionKinds: z
      .array(scopeStringSchema)
      .min(1)
      .max(64)
      .optional()
      .describe('Target actionKind must be one of these.'),
    resourceTypes: z
      .array(scopeStringSchema)
      .min(1)
      .max(64)
      .optional()
      .describe('Target resourceType must be one of these.'),
    tags: z
      .strictObject({
        allOf: z.array(scopeStringSchema).min(1).max(64).optional(),
        anyOf: z.array(scopeStringSchema).min(1).max(64).optional(),
      })
      .optional()
      .describe('Tag matcher: allOf must all be present; anyOf at least one.'),
  })
  .describe(
    'Applicability scope. Every present matcher must match; an empty scope ' +
      'applies universally (platform-wide defaults).',
  );

/**
 * The object a policy applies to. Minimal additive reference type pending
 * alignment with the W003 action protocol / W002 world model contract
 * surfaces (architecture question, see the W004 PR).
 */
export const policyTargetSchema = z
  .strictObject({
    tenantId: scopeStringSchema.optional(),
    workspaceId: scopeStringSchema.optional(),
    projectId: scopeStringSchema.optional(),
    actionKind: scopeStringSchema.optional(),
    resourceType: scopeStringSchema.optional(),
    tags: z.array(scopeStringSchema).max(256).optional(),
  })
  .describe('What a policy is being applied to (action/world reference).');

export const policyBindingSchema = z
  .strictObject({
    constraintId: constraintIdSchema.describe('Bound compiled constraint id.'),
    constraintVersion: semverSchema
      .optional()
      .describe('Optional exact constraint version pin.'),
  })
  .describe('Reference from a policy to a constraint.');

export const policyDocumentSchema = z
  .strictObject({
    languageVersion: z.literal(POLICY_LANGUAGE_VERSION).describe('Policy language version gate.'),
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,127}$/, 'ids must match /^[a-z][a-z0-9-]{0,127}$/')
      .describe('Stable policy identifier (lowercase kebab-case).'),
    version: semverSchema.describe('Version of this policy document.'),
    name: z.string().min(1).max(256).describe('Human-readable policy name.'),
    description: descriptionSchema.optional(),
    enabled: z
      .boolean()
      .describe('Disabled policies are ignored during resolution (fail-closed: they apply nothing).'),
    applicability: policyScopeSchema,
    bindings: z
      .array(policyBindingSchema)
      .min(1)
      .max(256)
      .describe('Constraints this policy applies in its scope.'),
    precedence: z
      .strictObject({
        tier: z.enum(POLICY_PRECEDENCE_TIERS).describe('Coarse precedence tier.'),
        rank: z
          .number()
          .int()
          .nonnegative()
          .max(1e9)
          .describe('Fine-grained rank within the tier; higher wins.'),
      })
      .describe('Precedence: tier first, then rank, then id (deterministic total order).'),
    composition: z
      .enum(['additive', 'override'])
      .describe(
        'additive: union bindings with other applicable policies. override: ' +
          'replace all lower-precedence applicable bindings.',
      ),
  })
  .describe('Epoch policy document (typed contract; distinct from constraint semantics).');

export type PolicyScope = z.infer<typeof policyScopeSchema>;
export type PolicyTarget = z.infer<typeof policyTargetSchema>;
export type PolicyBinding = z.infer<typeof policyBindingSchema>;
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;
