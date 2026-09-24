// @epoch/policy-contracts — applicability scope matching.
//
// matchesScope is a TOTAL function over unknown inputs: malformed scopes or
// targets never throw; they simply do not match (fail-closed). A matcher for a
// field the target does not carry is a non-match.
import type { PolicyScope, PolicyTarget } from './schema';
import { policyScopeSchema, policyTargetSchema } from './schema';

function subsetOf<T>(needles: readonly T[], haystack: readonly T[]): boolean {
  return needles.every((needle) => haystack.includes(needle));
}

function intersects<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.some((item) => b.includes(item));
}

/**
 * Total scope matcher: true iff every matcher present in `scope` matches
 * `target`. Malformed input yields false (fail-closed), never a throw.
 */
export function matchesScope(scope: unknown, target: unknown): boolean {
  const parsedScope = policyScopeSchema.safeParse(scope);
  if (!parsedScope.success) return false;
  const parsedTarget = policyTargetSchema.safeParse(target);
  if (!parsedTarget.success) return false;
  return scopeMatchesTarget(parsedScope.data, parsedTarget.data);
}

function scopeMatchesTarget(scope: PolicyScope, target: PolicyTarget): boolean {
  if (scope.tenantId !== undefined && scope.tenantId !== target.tenantId) return false;
  if (scope.workspaceId !== undefined && scope.workspaceId !== target.workspaceId) return false;
  if (scope.projectId !== undefined && scope.projectId !== target.projectId) return false;
  if (scope.actionKinds !== undefined) {
    if (target.actionKind === undefined || !scope.actionKinds.includes(target.actionKind)) {
      return false;
    }
  }
  if (scope.resourceTypes !== undefined) {
    if (target.resourceType === undefined || !scope.resourceTypes.includes(target.resourceType)) {
      return false;
    }
  }
  if (scope.tags !== undefined) {
    const targetTags = target.tags ?? [];
    if (scope.tags.allOf !== undefined && !subsetOf(scope.tags.allOf, targetTags)) return false;
    if (scope.tags.anyOf !== undefined && !intersects(scope.tags.anyOf, targetTags)) return false;
  }
  return true;
}
