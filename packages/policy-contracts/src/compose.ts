// @epoch/policy-contracts — composition of constraint evaluation results.
//
// Deterministic composition rules (documented contract):
//   - any evaluation rejection (ok:false) contributes BLOCK (fail-closed);
//   - any result with effect 'block' blocks the decision (deny-overrides);
//   - soft violations never block; their penalties sum into totalPenalty
//     (decision 'allow-with-penalties' when > 0);
//   - 'not-applicable' results are counted but contribute nothing;
//   - an empty composition is 'not-applicable' (nothing applied — consumers
//     decide what an empty decision means at their boundary);
//   - every input entry is re-validated against the evaluation outcome schema;
//     malformed entries fail with typed issues instead of throwing.
import type { EvaluationOutcome, ValidationIssue } from '@epoch/constraint-language';
import { evaluationOutcomeSchema, guardJsonShape, zodIssuesToValidationIssues } from '@epoch/constraint-language';
import type { CompositeDecision } from './outputs';
import { compositeDecisionSchema } from './outputs';

export type CompositionOutcome =
  | { ok: true; decision: CompositeDecision }
  | { ok: false; issues: ValidationIssue[] };

/** Compose constraint evaluation outcomes into one deterministic decision. */
export function composeConstraintEvaluations(evaluations: unknown): CompositionOutcome {
  const guardIssues = guardJsonShape(evaluations, '$.evaluations');
  if (guardIssues.length > 0) return { ok: false, issues: guardIssues };

  if (!Array.isArray(evaluations)) {
    return {
      ok: false,
      issues: [
        {
          path: '$.evaluations',
          code: 'invalid-input',
          message: 'evaluations must be an array of evaluation outcomes',
        },
      ],
    };
  }

  const outcomes: EvaluationOutcome[] = [];
  const issues: ValidationIssue[] = [];
  evaluations.forEach((candidate, index) => {
    const parsed = evaluationOutcomeSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push(...zodIssuesToValidationIssues(parsed.error, `$.evaluations[${index}]`));
      return;
    }
    outcomes.push(parsed.data);
  });
  if (issues.length > 0) return { ok: false, issues };

  const blocking: CompositeDecision['blocking'] = [];
  const violated: CompositeDecision['violated'] = [];
  const reasons: string[] = [];
  const counts = { satisfied: 0, violated: 0, notApplicable: 0 };
  let totalPenalty = 0;

  for (const outcome of outcomes) {
    if (!outcome.ok) {
      reasons.push(`evaluation-rejected:${outcome.kind}`);
      continue;
    }
    const result = outcome.result;
    if (result.outcome === 'not-applicable') {
      counts.notApplicable += 1;
      continue;
    }
    if (result.outcome === 'satisfied') {
      counts.satisfied += 1;
      continue;
    }
    counts.violated += 1;
    totalPenalty += result.penalty;
    if (result.effect === 'block') {
      blocking.push({
        constraintId: result.constraintId,
        constraintVersion: result.constraintVersion,
        constraintClass: result.constraintClass,
        effect: result.effect,
        message: result.message,
      });
    }
    violated.push({
      constraintId: result.constraintId,
      constraintVersion: result.constraintVersion,
      constraintClass: result.constraintClass,
      effect: result.effect,
      penalty: result.penalty,
      message: result.message,
    });
  }

  const rejectedCount = reasons.length;
  let decision: CompositeDecision['decision'];
  if (rejectedCount > 0 || blocking.length > 0) {
    decision = 'block';
  } else if (outcomes.length === 0) {
    decision = 'not-applicable';
  } else if (totalPenalty > 0) {
    decision = 'allow-with-penalties';
  } else {
    decision = 'allow';
  }

  const composed: CompositeDecision = {
    decision,
    totalPenalty,
    blocking,
    violated,
    counts,
    reasons,
  };
  const selfCheck = compositeDecisionSchema.safeParse(composed);
  if (!selfCheck.success) {
    return {
      ok: false,
      issues: zodIssuesToValidationIssues(selfCheck.error, undefined, 'internal'),
    };
  }
  return { ok: true, decision: composed };
}
