// @epoch/policy-contracts — output schemas (resolution, composition, decisions).
import { z } from 'zod';
import { evaluationOutcomeSchema, validationIssueSchema } from '@epoch/constraint-language';
import { POLICY_PRECEDENCE_TIERS, policyBindingSchema, policyTargetSchema } from './schema';

export const applicablePolicySchema = z.strictObject({
  policyId: z.string(),
  precedence: z.strictObject({
    tier: z.enum(POLICY_PRECEDENCE_TIERS),
    rank: z.number().int().nonnegative(),
  }),
  composition: z.enum(['additive', 'override']),
  bindingCount: z.number().int().nonnegative(),
});

export const resolutionTraceEntrySchema = z.strictObject({
  policyId: z.string(),
  action: z.enum(['add', 'reset']),
  bindingsAdded: z.number().int().nonnegative(),
  effectiveBindingCount: z.number().int().nonnegative(),
});

export const applicablePolicyResolutionSchema = z.strictObject({
  target: policyTargetSchema,
  applicable: z.array(applicablePolicySchema),
  bindings: z.array(policyBindingSchema),
  trace: z.array(resolutionTraceEntrySchema),
});

export type ApplicablePolicyResolution = z.infer<typeof applicablePolicyResolutionSchema>;

export const blockingEntrySchema = z.strictObject({
  constraintId: z.string(),
  constraintVersion: z.string(),
  constraintClass: z.enum(['hard', 'soft', 'resource', 'safety', 'epistemic', 'authority']),
  effect: z.enum(['block', 'penalize', 'none']),
  message: z.string(),
});

export const violatedEntrySchema = z.strictObject({
  constraintId: z.string(),
  constraintVersion: z.string(),
  constraintClass: z.enum(['hard', 'soft', 'resource', 'safety', 'epistemic', 'authority']),
  effect: z.enum(['block', 'penalize', 'none']),
  penalty: z.number(),
  message: z.string(),
});

export const compositeDecisionSchema = z.strictObject({
  decision: z.enum(['block', 'allow', 'allow-with-penalties', 'not-applicable']),
  totalPenalty: z.number(),
  blocking: z.array(blockingEntrySchema),
  violated: z.array(violatedEntrySchema),
  counts: z.strictObject({
    satisfied: z.number().int().nonnegative(),
    violated: z.number().int().nonnegative(),
    notApplicable: z.number().int().nonnegative(),
  }),
  reasons: z.array(z.string()),
});

export type CompositeDecision = z.infer<typeof compositeDecisionSchema>;

export const policyBindingEvaluationSchema = z.strictObject({
  binding: policyBindingSchema,
  resolved: z.boolean(),
  outcome: evaluationOutcomeSchema.optional(),
});

export type PolicyBindingEvaluation = z.infer<typeof policyBindingEvaluationSchema>;

export const policySetEvaluationResultSchema = z.strictObject({
  resolution: applicablePolicyResolutionSchema,
  evaluations: z.array(policyBindingEvaluationSchema),
  decision: compositeDecisionSchema,
});

export type PolicySetEvaluationResult = z.infer<typeof policySetEvaluationResultSchema>;

export const policyResolutionOutcomeSchema = z.union([
  z.strictObject({ ok: z.literal(true), resolution: applicablePolicyResolutionSchema }),
  z.strictObject({ ok: z.literal(false), issues: z.array(validationIssueSchema) }),
]);

export const compositionOutcomeSchema = z.union([
  z.strictObject({ ok: z.literal(true), decision: compositeDecisionSchema }),
  z.strictObject({ ok: z.literal(false), issues: z.array(validationIssueSchema) }),
]);

export const policySetEvaluationOutcomeSchema = z.union([
  z.strictObject({ ok: z.literal(true), evaluation: policySetEvaluationResultSchema }),
  z.strictObject({ ok: z.literal(false), issues: z.array(validationIssueSchema) }),
]);
