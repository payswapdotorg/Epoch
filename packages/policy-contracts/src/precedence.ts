// @epoch/policy-contracts — applicability resolution with precedence + composition.
//
// Deterministic resolution contract:
//   1. validate every policy document (fail with typed issues on any invalid
//      document, duplicate policy id, or duplicate binding within a policy);
//   2. keep enabled policies whose scope matches the target;
//   3. order them by (tier, rank, id) ASCENDING (later = higher precedence);
//   4. fold in that order: additive policies union their bindings into the
//      effective set, override policies RESET the accumulated set (lower
//      precedence bindings are replaced);
//   5. a constraintId re-bound by a higher-precedence policy replaces the
//      earlier binding;
//   6. emit the effective bindings ordered by contributing precedence
//      (highest first), plus a deterministic trace.
import type { ValidationIssue } from '@epoch/constraint-language';
import { guardJsonShape, zodIssuesToValidationIssues } from '@epoch/constraint-language';
import type { PolicyBinding, PolicyDocument } from './schema';
import { policyDocumentSchema, policyTargetSchema, POLICY_PRECEDENCE_TIER_ORDER } from './schema';
import type { ApplicablePolicyResolution } from './outputs';
import { matchesScope } from './scope';

export type PolicyResolutionOutcome =
  | { ok: true; resolution: ApplicablePolicyResolution }
  | { ok: false; issues: ValidationIssue[] };

type Contribution = {
  binding: PolicyBinding;
  policyIndex: number;
};

function precedenceKey(policy: PolicyDocument): [number, number, string] {
  return [
    POLICY_PRECEDENCE_TIER_ORDER.get(policy.precedence.tier) ?? 0,
    policy.precedence.rank,
    policy.id,
  ];
}

function comparePrecedence(a: PolicyDocument, b: PolicyDocument): number {
  const [tierA, rankA, idA] = precedenceKey(a);
  const [tierB, rankB, idB] = precedenceKey(b);
  if (tierA !== tierB) return tierA - tierB;
  if (rankA !== rankB) return rankA - rankB;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

/**
 * Resolve the effective constraint bindings for a target from a set of policy
 * documents. Total function: never throws; typed issues on invalid input.
 */
export function resolveApplicablePolicies(policies: unknown, target: unknown): PolicyResolutionOutcome {
  const guardIssues = [
    ...guardJsonShape(policies, '$.policies'),
    ...guardJsonShape(target, '$.target'),
  ];
  if (guardIssues.length > 0) return { ok: false, issues: guardIssues };

  if (!Array.isArray(policies)) {
    return {
      ok: false,
      issues: [{ path: '$.policies', code: 'invalid-input', message: 'policies must be an array' }],
    };
  }

  const parsedTarget = policyTargetSchema.safeParse(target);
  if (!parsedTarget.success) {
    return { ok: false, issues: zodIssuesToValidationIssues(parsedTarget.error, '$.target') };
  }

  const documents: PolicyDocument[] = [];
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  policies.forEach((candidate, index) => {
    const parsed = policyDocumentSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push(...zodIssuesToValidationIssues(parsed.error, `$.policies[${index}]`));
      return;
    }
    const document = parsed.data;
    if (seenIds.has(document.id)) {
      issues.push({
        path: `$.policies[${index}].id`,
        code: 'duplicate-policy-id',
        message: `duplicate policy id "${document.id}"`,
      });
      return;
    }
    seenIds.add(document.id);
    const boundIds = new Set<string>();
    document.bindings.forEach((binding, bindingIndex) => {
      if (boundIds.has(binding.constraintId)) {
        issues.push({
          path: `$.policies[${index}].bindings[${bindingIndex}].constraintId`,
          code: 'duplicate-binding',
          message: `policy "${document.id}" binds constraint "${binding.constraintId}" more than once`,
        });
      }
      boundIds.add(binding.constraintId);
    });
    documents.push(document);
  });
  if (issues.length > 0) return { ok: false, issues };

  const ordered = [...documents].sort(comparePrecedence);
  const applicable = ordered.filter(
    (document) => document.enabled && matchesScope(document.applicability, parsedTarget.data),
  );

  const effective = new Map<string, Contribution>();
  const trace: ApplicablePolicyResolution['trace'] = [];
  applicable.forEach((document, index) => {
    if (document.composition === 'override') effective.clear();
    for (const binding of document.bindings) {
      effective.set(binding.constraintId, { binding, policyIndex: index });
    }
    trace.push({
      policyId: document.id,
      action: document.composition === 'override' ? 'reset' : 'add',
      bindingsAdded: document.bindings.length,
      effectiveBindingCount: effective.size,
    });
  });

  const contributions = [...effective.values()].sort((a, b) => b.policyIndex - a.policyIndex);

  return {
    ok: true,
    resolution: {
      target: parsedTarget.data,
      applicable: [...applicable]
        .reverse()
        .map((document) => ({
          policyId: document.id,
          precedence: document.precedence,
          composition: document.composition,
          bindingCount: document.bindings.length,
        })),
      bindings: contributions.map((contribution) => contribution.binding),
      trace,
    },
  };
}
