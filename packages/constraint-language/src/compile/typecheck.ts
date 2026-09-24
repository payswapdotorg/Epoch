// @epoch/constraint-language — expression type inference and semantic checks.
//
// Static type rules (compile-time, closed world):
//   lit         : declared by `type` (value/type correlation is verified)
//   input       : declared input slot type (enum maps to string)
//   lt/le/gt/ge : (number, number) -> boolean
//   eq/ne       : (T, T) -> boolean for T in {number, string, boolean}
//   and/or      : (boolean x 2+) -> boolean
//   not         : boolean -> boolean
//   implies     : (boolean, boolean) -> boolean
//   add/mul     : (number x 2+) -> number
//   sub/div     : (number, number) -> number
//   has         : (record, key) -> boolean
//   get         : (record, key, number) -> number
//   count       : (list) -> number
//   contains    : (list, value) -> boolean
import type { AuthoredExpr, ValueType } from '../types';
import type { InputDeclaration } from '../schema/authored';
import type { ValidationIssue } from '../schema/common';

export type InputEnvironment = ReadonlyMap<string, InputDeclaration>;

export function buildInputEnvironment(inputs: InputDeclaration[]): Map<string, InputDeclaration> {
  return new Map(inputs.map((declaration) => [declaration.name, declaration]));
}

function slotValueType(declaration: InputDeclaration): ValueType {
  switch (declaration.type) {
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'string';
    case 'record':
      return 'record';
    case 'list':
      return 'list';
  }
}

/**
 * Infer the static type of an authored expression, collecting typed issues.
 * Returns the inferred type, or null when the node (or a child) is invalid.
 */
export function inferExprType(
  node: AuthoredExpr,
  env: InputEnvironment,
  path: string,
  issues: ValidationIssue[],
): ValueType | null {
  switch (node.node) {
    case 'lit': {
      const expected =
        node.type === 'number' ? 'number' : node.type === 'string' ? 'string' : 'boolean';
      if (typeof node.value !== expected) {
        issues.push({
          path,
          code: 'invalid-literal',
          message: `literal declares type "${node.type}" but carries a ${typeof node.value} value`,
        });
        return null;
      }
      return node.type;
    }
    case 'input': {
      const declaration = env.get(node.name);
      if (declaration === undefined) {
        issues.push({
          path,
          code: 'undeclared-input',
          message: `expression references undeclared input "${node.name}"`,
        });
        return null;
      }
      return slotValueType(declaration);
    }
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge': {
      const left = inferExprType(node.left, env, `${path}.left`, issues);
      const right = inferExprType(node.right, env, `${path}.right`, issues);
      if (left === null || right === null) return null;
      if (left !== 'number' || right !== 'number') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"${node.node}" requires number operands (got ${left}, ${right})`,
        });
        return null;
      }
      return 'boolean';
    }
    case 'eq':
    case 'ne': {
      const left = inferExprType(node.left, env, `${path}.left`, issues);
      const right = inferExprType(node.right, env, `${path}.right`, issues);
      if (left === null || right === null) return null;
      if (left !== right || (left !== 'number' && left !== 'string' && left !== 'boolean')) {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"${node.node}" requires two operands of one primitive type (got ${left}, ${right})`,
        });
        return null;
      }
      return 'boolean';
    }
    case 'and':
    case 'or':
    case 'add':
    case 'mul': {
      const expected: ValueType = node.node === 'and' || node.node === 'or' ? 'boolean' : 'number';
      let ok = true;
      node.operands.forEach((operand, index) => {
        const type = inferExprType(operand, env, `${path}.operands[${index}]`, issues);
        if (type === null) {
          ok = false;
          return;
        }
        if (type !== expected) {
          issues.push({
            path: `${path}.operands[${index}]`,
            code: 'type-mismatch',
            message: `"${node.node}" requires ${expected} operands (got ${type})`,
          });
          ok = false;
        }
      });
      return ok ? expected : null;
    }
    case 'not': {
      const type = inferExprType(node.operand, env, `${path}.operand`, issues);
      if (type === null) return null;
      if (type !== 'boolean') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"not" requires a boolean operand (got ${type})`,
        });
        return null;
      }
      return 'boolean';
    }
    case 'implies': {
      const antecedent = inferExprType(node.antecedent, env, `${path}.antecedent`, issues);
      const consequent = inferExprType(node.consequent, env, `${path}.consequent`, issues);
      if (antecedent === null || consequent === null) return null;
      if (antecedent !== 'boolean' || consequent !== 'boolean') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"implies" requires boolean antecedent/consequent (got ${antecedent}, ${consequent})`,
        });
        return null;
      }
      return 'boolean';
    }
    case 'sub':
    case 'div': {
      const left = inferExprType(node.left, env, `${path}.left`, issues);
      const right = inferExprType(node.right, env, `${path}.right`, issues);
      if (left === null || right === null) return null;
      if (left !== 'number' || right !== 'number') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"${node.node}" requires number operands (got ${left}, ${right})`,
        });
        return null;
      }
      return 'number';
    }
    case 'has': {
      const record = inferExprType(node.record, env, `${path}.record`, issues);
      if (record === null) return null;
      if (record !== 'record') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"has" requires a record operand (got ${record})`,
        });
        return null;
      }
      return 'boolean';
    }
    case 'get': {
      const record = inferExprType(node.record, env, `${path}.record`, issues);
      const fallback = inferExprType(node.fallback, env, `${path}.fallback`, issues);
      if (record === null || fallback === null) return null;
      if (record !== 'record') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"get" requires a record operand (got ${record})`,
        });
        return null;
      }
      if (fallback !== 'number') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"get" requires a number fallback (got ${fallback})`,
        });
        return null;
      }
      return 'number';
    }
    case 'count': {
      const list = inferExprType(node.list, env, `${path}.list`, issues);
      if (list === null) return null;
      if (list !== 'list') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"count" requires a list operand (got ${list})`,
        });
        return null;
      }
      return 'number';
    }
    case 'contains': {
      const list = inferExprType(node.list, env, `${path}.list`, issues);
      if (list === null) return null;
      if (list !== 'list') {
        issues.push({
          path,
          code: 'type-mismatch',
          message: `"contains" requires a list operand (got ${list})`,
        });
        return null;
      }
      return 'boolean';
    }
  }
}

/** Expect an expression to have a specific static type at a payload position. */
export function expectType(
  node: AuthoredExpr,
  env: InputEnvironment,
  path: string,
  expected: ValueType,
  code: string,
  issues: ValidationIssue[],
): boolean {
  const type = inferExprType(node, env, path, issues);
  if (type === null) return false;
  if (type !== expected) {
    issues.push({
      path,
      code,
      message: `expected a ${expected} expression (got ${type})`,
    });
    return false;
  }
  return true;
}
