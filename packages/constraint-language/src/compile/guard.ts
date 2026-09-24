// @epoch/constraint-language — iterative structural guard for untrusted payloads.
//
// zod (and every recursive pass in this package) recurses over object graphs;
// adversarially deep JSON can overflow the JS stack before any schema runs.
// guardJsonShape bounds depth and node count ITERATIVELY (explicit stack) so
// compile()/evaluate() stay total functions over arbitrary input.
import { ECL_LIMITS } from '../schema/common';
import type { ValidationIssue } from '../schema/common';

/** Iteratively bound a JSON payload by depth and node count. Returns issues (empty = ok). */
export function guardJsonShape(value: unknown, basePath = '$'): ValidationIssue[] {
  let nodes = 0;
  const stack: Array<{ value: unknown; depth: number; path: string }> = [
    { value, depth: 0, path: basePath },
  ];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    nodes += 1;
    if (nodes > ECL_LIMITS.maxAstNodes) {
      return [
        {
          path: current.path,
          code: 'ast-too-large',
          message: `payload exceeds the maximum of ${ECL_LIMITS.maxAstNodes} JSON nodes`,
        },
      ];
    }
    if (current.depth > ECL_LIMITS.maxAstDepth) {
      return [
        {
          path: current.path,
          code: 'ast-too-deep',
          message: `payload nesting exceeds the maximum depth of ${ECL_LIMITS.maxAstDepth}`,
        },
      ];
    }
    const { value: item, depth, path } = current;
    if (item === null || typeof item !== 'object') continue;
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i += 1) {
        stack.push({ value: item[i], depth: depth + 1, path: `${path}[${i}]` });
      }
      continue;
    }
    for (const key of Object.keys(item as Record<string, unknown>)) {
      stack.push({
        value: (item as Record<string, unknown>)[key],
        depth: depth + 1,
        path: path === '$' ? key : `${path}.${key}`,
      });
    }
  }
  return [];
}
