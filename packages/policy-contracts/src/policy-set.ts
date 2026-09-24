// @epoch/policy-contracts — policy-set evaluation over a constraint resolver.
//
// Ties the policy kernel to the constraint kernel: resolve applicable
// policies for a target, evaluate each effective binding's compiled
// constraint against the shared evaluation context, and compose the
// deterministic decision. Unresolvable bindings (missing constraint) and
// rejected evaluations contribute BLOCK reasons — the policy boundary is
// fail-closed (an unresolvable policy must never silently allow).
import type { CompiledConstraint, EvaluationOutcome, ValidationIssue } from '@epoch/constraint-language';
import { evaluateConstraint, zodIssuesToValidationIssues } from '@epoch/constraint-language';
import type { PolicyBindingEvaluation, PolicySetEvaluationResult } from './outputs';
import { policySetEvaluationResultSchema } from './outputs';
import { composeConstraintEvaluations } from './compose';
import { resolveApplicablePolicies } from './precedence';
import type { PolicyResolutionOutcome } from './precedence';

export type PolicySetEvaluationOutcome =
  | { ok: true; evaluation: PolicySetEvaluationResult }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Constraint resolver supplied by the caller (e.g. the Constraint Engine /
 * Action Gateway integration): returns the compiled constraint for a binding,
 * or undefined when the constraint cannot be resolved. Throwing resolvers are
 * contained: the throw is treated as non-resolution (fail-closed).
 */
export type ConstraintResolver = (binding: {
  constraintId: string;
  constraintVersion?: string | undefined;
}) => unknown;

/**
 * Evaluate a policy set against a target and context.
 *
 * @param policies array of policy documents (validated here)
 * @param target the object policies are applied to
 * @param context evaluation context `{ inputs: { ... } }` shared by every
 *   effective binding's constraint
 * @param resolveConstraint caller-supplied compiled-constraint resolver
 */
export function evaluatePolicySet(
  policies: unknown,
  target: unknown,
  context: unknown,
  resolveConstraint: ConstraintResolver,
): PolicySetEvaluationOutcome {
  const resolution: PolicyResolutionOutcome = resolveApplicablePolicies(policies, target);
  if (!resolution.ok) return { ok: false, issues: resolution.issues };

  const evaluations: PolicyBindingEvaluation[] = [];
  const outcomes: EvaluationOutcome[] = [];

  for (const binding of resolution.resolution.bindings) {
    let compiled: unknown;
    try {
      compiled = resolveConstraint(binding);
    } catch {
      compiled = undefined;
    }
    if (compiled === undefined || compiled === null) {
      evaluations.push({ binding, resolved: false });
      continue;
    }
    const outcome = evaluateConstraint(compiled as CompiledConstraint, context);
    evaluations.push({ binding, resolved: true, outcome });
    outcomes.push(outcome);
  }

  const composed = composeConstraintEvaluations(outcomes);
  if (!composed.ok) return { ok: false, issues: composed.issues };

  const unresolved = evaluations
    .filter((evaluation) => !evaluation.resolved)
    .map((evaluation) => `unresolved-constraint:${evaluation.binding.constraintId}`);

  const decision =
    unresolved.length > 0
      ? {
          ...composed.decision,
          decision: 'block' as const,
          reasons: [...composed.decision.reasons, ...unresolved],
        }
      : composed.decision;

  const result: PolicySetEvaluationResult = {
    resolution: resolution.resolution,
    evaluations,
    decision,
  };

  const selfCheck = policySetEvaluationResultSchema.safeParse(result);
  if (!selfCheck.success) {
    return {
      ok: false,
      issues: zodIssuesToValidationIssues(selfCheck.error, undefined, 'internal').map((issue) => ({
        ...issue,
        message: `internal composition error: ${issue.message}`,
      })),
    };
  }
  return { ok: true, evaluation: result };
}
