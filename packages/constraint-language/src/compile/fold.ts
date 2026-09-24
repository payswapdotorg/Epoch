// @epoch/constraint-language — compile-time constant folding.
//
// Fully-literal subtrees are folded to literals. Arithmetic follows IEEE 754
// doubles deterministically; folding only emits finite numeric results (NaN or
// ±Infinity subtrees are preserved for runtime evaluation). A divisor that
// folds to exactly 0 is rejected at compile time (division-by-zero-constant).
import type { AuthoredExpr } from '../types';
import type { ValidationIssue } from '../schema/common';

type NumberLitExpr = { node: 'lit'; type: 'number'; value: number };
type BooleanLitExpr = { node: 'lit'; type: 'boolean'; value: boolean };

function isNumberLit(node: AuthoredExpr): node is NumberLitExpr {
  return node.node === 'lit' && node.type === 'number' && typeof node.value === 'number';
}

function isBooleanLit(node: AuthoredExpr): node is BooleanLitExpr {
  return node.node === 'lit' && node.type === 'boolean' && typeof node.value === 'boolean';
}

function numLit(value: number): AuthoredExpr {
  return { node: 'lit', type: 'number', value };
}

function boolLit(value: boolean): AuthoredExpr {
  return { node: 'lit', type: 'boolean', value };
}

/**
 * Fold an authored expression tree bottom-up. Never throws; issues are pushed
 * onto `issues` (division by a constant zero is a compile error).
 */
export function foldExpr(node: AuthoredExpr, path: string, issues: ValidationIssue[]): AuthoredExpr {
  switch (node.node) {
    case 'lit':
    case 'input':
      return node;
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
    case 'eq':
    case 'ne':
    case 'sub': {
      const left = foldExpr(node.left, `${path}.left`, issues);
      const right = foldExpr(node.right, `${path}.right`, issues);
      if (left.node === 'lit' && right.node === 'lit' && left.type === right.type) {
        if (isNumberLit(left) && isNumberLit(right)) {
          const a = left.value;
          const b = right.value;
          switch (node.node) {
            case 'lt':
              return boolLit(a < b);
            case 'le':
              return boolLit(a <= b);
            case 'gt':
              return boolLit(a > b);
            case 'ge':
              return boolLit(a >= b);
            case 'eq':
              return boolLit(a === b);
            case 'ne':
              return boolLit(a !== b);
            case 'sub':
              return numLit(a - b);
          }
        }
        if (left.type === 'string' && typeof left.value === typeof right.value) {
          if (node.node === 'eq') return boolLit(left.value === right.value);
          if (node.node === 'ne') return boolLit(left.value !== right.value);
        }
        if (isBooleanLit(left) && isBooleanLit(right)) {
          if (node.node === 'eq') return boolLit(left.value === right.value);
          if (node.node === 'ne') return boolLit(left.value !== right.value);
        }
      }
      return { node: node.node, left, right };
    }
    case 'div': {
      const left = foldExpr(node.left, `${path}.left`, issues);
      const right = foldExpr(node.right, `${path}.right`, issues);
      if (isNumberLit(right) && right.value === 0) {
        issues.push({
          path: `${path}.right`,
          code: 'division-by-zero-constant',
          message: 'division by a constant zero divisor is rejected at compile time',
        });
        return { node: 'div', left, right };
      }
      if (isNumberLit(left) && isNumberLit(right) && Number.isFinite(left.value / right.value)) {
        return numLit(left.value / right.value);
      }
      return { node: 'div', left, right };
    }
    case 'and':
    case 'or':
    case 'add':
    case 'mul': {
      const operands = node.operands.map((operand, index) =>
        foldExpr(operand, `${path}.operands[${index}]`, issues),
      );
      if (operands.every(isNumberLit)) {
        const values = operands.map((operand) => (operand as NumberLitExpr).value);
        if (node.node === 'add') {
          const sum = values.reduce((a, b) => a + b, 0);
          if (Number.isFinite(sum)) return numLit(sum);
        }
        if (node.node === 'mul') {
          const product = values.reduce((a, b) => a * b, 1);
          if (Number.isFinite(product)) return numLit(product);
        }
      }
      if ((node.node === 'and' || node.node === 'or') && operands.every(isBooleanLit)) {
        const values = operands.map((operand) => (operand as BooleanLitExpr).value);
        return boolLit(node.node === 'and' ? values.every(Boolean) : values.some(Boolean));
      }
      return { node: node.node, operands };
    }
    case 'not': {
      const operand = foldExpr(node.operand, `${path}.operand`, issues);
      if (isBooleanLit(operand)) return boolLit(!operand.value);
      return { node: 'not', operand };
    }
    case 'implies': {
      const antecedent = foldExpr(node.antecedent, `${path}.antecedent`, issues);
      const consequent = foldExpr(node.consequent, `${path}.consequent`, issues);
      if (isBooleanLit(antecedent) && isBooleanLit(consequent)) {
        return boolLit(!antecedent.value || consequent.value);
      }
      return { node: 'implies', antecedent, consequent };
    }
    case 'has': {
      const record = foldExpr(node.record, `${path}.record`, issues);
      return { node: 'has', record, key: node.key };
    }
    case 'get': {
      const record = foldExpr(node.record, `${path}.record`, issues);
      const fallback = foldExpr(node.fallback, `${path}.fallback`, issues);
      return { node: 'get', record, key: node.key, fallback };
    }
    case 'count': {
      const list = foldExpr(node.list, `${path}.list`, issues);
      return { node: 'count', list };
    }
    case 'contains': {
      const list = foldExpr(node.list, `${path}.list`, issues);
      return { node: 'contains', list, value: node.value };
    }
  }
}
