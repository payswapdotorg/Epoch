// @epoch/policy-contracts — public API.
//
// Policy-side typed contracts of the Epoch Constraint & Policy Language
// (W004): policy documents, applicability scope matching, precedence and
// composition over constraint evaluation results. Policy remains distinct
// from constraint semantics (architecture lock rule 12). Provider-neutral by
// construction: the only integration point is the caller-supplied constraint
// resolver (the Constraint Engine / Action Gateway wires that up, W022).
//
// The full @epoch/constraint-language public surface is re-exported so
// consumers have a single import point for the W004 kernel.
export * from '@epoch/constraint-language';

export {
  POLICY_LANGUAGE_VERSION,
  POLICY_PRECEDENCE_TIERS,
  POLICY_PRECEDENCE_TIER_ORDER,
  policyScopeSchema,
  policyTargetSchema,
  policyBindingSchema,
  policyDocumentSchema,
} from './schema';
export type {
  PolicyPrecedenceTier,
  PolicyScope,
  PolicyTarget,
  PolicyBinding,
  PolicyDocument,
} from './schema';

export {
  applicablePolicySchema,
  resolutionTraceEntrySchema,
  applicablePolicyResolutionSchema,
  blockingEntrySchema,
  violatedEntrySchema,
  compositeDecisionSchema,
  policyBindingEvaluationSchema,
  policySetEvaluationResultSchema,
  policyResolutionOutcomeSchema,
  compositionOutcomeSchema,
  policySetEvaluationOutcomeSchema,
} from './outputs';
export type {
  ApplicablePolicyResolution,
  CompositeDecision,
  PolicyBindingEvaluation,
  PolicySetEvaluationResult,
} from './outputs';

export { matchesScope } from './scope';
export { resolveApplicablePolicies } from './precedence';
export type { PolicyResolutionOutcome } from './precedence';
export { composeConstraintEvaluations } from './compose';
export type { CompositionOutcome } from './compose';
export { evaluatePolicySet } from './policy-set';
export type { ConstraintResolver, PolicySetEvaluationOutcome } from './policy-set';
