// @epoch/constraint-language — the ECL compiler.
//
// Pipeline: authored form (structured AST) -> zod validation -> semantic
// validation (input declarations, cross-field payload rules) -> static type
// checking -> class-payload constant folding -> class-specific violation-root
// construction -> root folding -> type annotation -> digest. compileConstraint
// is a TOTAL function: it never throws and always returns either a compiled
// constraint or typed errors.
import type { AuthoredExpr, CompiledExpr, ValueType } from '../types';
import { digestOf } from '../canonical';
import { authoredConstraintSchema, type AuthoredConstraint } from '../schema/authored';
import { compiledConstraintSchema, type CompiledConstraint } from '../schema/compiled';
import {
  ECL_COMPILER,
  ECL_LANGUAGE_VERSION,
  zodIssuesToValidationIssues,
  type ValidationIssue,
} from '../schema/common';
import { buildInputEnvironment, expectType, type InputEnvironment } from './typecheck';
import { foldExpr } from './fold';
import { guardJsonShape } from './guard';

export type CompileOutcome =
  | { ok: true; compiled: CompiledConstraint }
  | { ok: false; errors: ValidationIssue[] };

const MAX_INPUTS = 64;

function fail(errors: ValidationIssue[]): CompileOutcome {
  return { ok: false, errors };
}

function numLit(value: number): AuthoredExpr {
  return { node: 'lit', type: 'number', value };
}

function boolLit(value: boolean): AuthoredExpr {
  return { node: 'lit', type: 'boolean', value };
}

function notNode(operand: AuthoredExpr): AuthoredExpr {
  return { node: 'not', operand };
}

function orNode(operands: AuthoredExpr[]): AuthoredExpr {
  if (operands.length === 1) return operands[0];
  return { node: 'or', operands };
}

function andNode(operands: AuthoredExpr[]): AuthoredExpr {
  if (operands.length === 1) return operands[0];
  return { node: 'and', operands };
}

function slotValueType(env: InputEnvironment, name: string): ValueType {
  const declaration = env.get(name);
  if (declaration === undefined) return 'number';
  switch (declaration.type) {
    case 'number':
      return 'number';
    case 'string':
    case 'enum':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'record':
      return 'record';
    case 'list':
      return 'list';
  }
}

/** Class payload expressions after constant folding (undefined = not used by the class). */
type FoldedPayload = {
  predicate?: AuthoredExpr;
  usage?: AuthoredExpr;
  limit?: AuthoredExpr;
  confidence?: AuthoredExpr;
  threshold?: AuthoredExpr;
};

/** Construct the boolean violation root from folded payload expressions. */
function buildViolationRoot(doc: AuthoredConstraint, folded: FoldedPayload): AuthoredExpr {
  const payload = folded as Required<
    Pick<FoldedPayload, 'predicate' | 'usage' | 'limit' | 'confidence' | 'threshold'>
  > &
    FoldedPayload;
  switch (doc.class) {
    case 'hard':
    case 'soft':
    case 'safety':
      return notNode(payload.predicate);
    case 'resource':
      return { node: 'gt', left: payload.usage, right: payload.limit };
    case 'epistemic': {
      const parts: AuthoredExpr[] = [
        { node: 'lt', left: payload.confidence, right: payload.threshold },
      ];
      if (doc.requiredEvidence !== undefined && doc.evidenceInput !== undefined) {
        for (const requirement of doc.requiredEvidence) {
          parts.push({
            node: 'lt',
            left: {
              node: 'get',
              record: { node: 'input', name: doc.evidenceInput },
              key: requirement.kind,
              fallback: numLit(0),
            },
            right: numLit(requirement.minCount),
          });
        }
      }
      return orNode(parts);
    }
    case 'authority': {
      const permissions = { node: 'input', name: doc.permissionsInput } as AuthoredExpr;
      const parts: AuthoredExpr[] = doc.allOf.map((permission) =>
        notNode({ node: 'contains', list: permissions, value: permission }),
      );
      if (doc.anyOf.length > 0) {
        parts.push(
          andNode(
            doc.anyOf.map((permission) =>
              notNode({ node: 'contains', list: permissions, value: permission }),
            ),
          ),
        );
      }
      if (parts.length === 0) return boolLit(false);
      return orNode(parts);
    }
  }
}

/** Annotate a folded authored tree with static result types (compilation output). */
function annotateExpr(node: AuthoredExpr, env: InputEnvironment): CompiledExpr {
  switch (node.node) {
    case 'lit':
      return { ...node, resultType: node.type };
    case 'input':
      return { ...node, resultType: slotValueType(env, node.name) };
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge':
    case 'eq':
    case 'ne':
      return {
        node: node.node,
        resultType: 'boolean',
        left: annotateExpr(node.left, env),
        right: annotateExpr(node.right, env),
      };
    case 'and':
    case 'or':
      return {
        node: node.node,
        resultType: 'boolean',
        operands: node.operands.map((operand) => annotateExpr(operand, env)),
      };
    case 'not':
      return { node: 'not', resultType: 'boolean', operand: annotateExpr(node.operand, env) };
    case 'implies':
      return {
        node: 'implies',
        resultType: 'boolean',
        antecedent: annotateExpr(node.antecedent, env),
        consequent: annotateExpr(node.consequent, env),
      };
    case 'add':
    case 'mul':
      return {
        node: node.node,
        resultType: 'number',
        operands: node.operands.map((operand) => annotateExpr(operand, env)),
      };
    case 'sub':
    case 'div':
      return {
        node: node.node,
        resultType: 'number',
        left: annotateExpr(node.left, env),
        right: annotateExpr(node.right, env),
      };
    case 'has':
      return {
        node: 'has',
        resultType: 'boolean',
        record: annotateExpr(node.record, env),
        key: node.key,
      };
    case 'get':
      return {
        node: 'get',
        resultType: 'number',
        record: annotateExpr(node.record, env),
        key: node.key,
        fallback: annotateExpr(node.fallback, env),
      };
    case 'count':
      return { node: 'count', resultType: 'number', list: annotateExpr(node.list, env) };
    case 'contains':
      return {
        node: 'contains',
        resultType: 'boolean',
        list: annotateExpr(node.list, env),
        value: node.value,
      };
  }
}

function validateInputDeclarations(doc: AuthoredConstraint, issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  doc.inputs.forEach((declaration, index) => {
    const path = `inputs[${index}]`;
    if (seen.has(declaration.name)) {
      issues.push({
        path: `${path}.name`,
        code: 'duplicate-input',
        message: `duplicate input declaration "${declaration.name}"`,
      });
    }
    seen.add(declaration.name);
    if (declaration.type === 'enum' && declaration.values === undefined) {
      issues.push({
        path: `${path}.values`,
        code: 'enum-values-required',
        message: `enum input "${declaration.name}" must declare its allowed values`,
      });
    }
    if (declaration.type !== 'enum' && declaration.values !== undefined) {
      issues.push({
        path: `${path}.values`,
        code: 'enum-values-forbidden',
        message: `input "${declaration.name}" of type "${declaration.type}" must not declare enum values`,
      });
    }
  });
  if (doc.inputs.length > MAX_INPUTS) {
    issues.push({
      path: 'inputs',
      code: 'too-many-inputs',
      message: `constraints may declare at most ${MAX_INPUTS} inputs (got ${doc.inputs.length})`,
    });
  }
}

function validatePayload(doc: AuthoredConstraint, issues: ValidationIssue[]): void {
  const env = buildInputEnvironment(doc.inputs);
  if (doc.appliesWhen !== undefined) {
    expectType(doc.appliesWhen, env, 'appliesWhen', 'boolean', 'applies-when-type', issues);
  }
  switch (doc.class) {
    case 'hard':
    case 'soft':
    case 'safety':
      expectType(doc.predicate, env, 'predicate', 'boolean', 'predicate-type', issues);
      break;
    case 'resource':
      expectType(doc.usage, env, 'usage', 'number', 'payload-type', issues);
      expectType(doc.limit, env, 'limit', 'number', 'payload-type', issues);
      break;
    case 'epistemic': {
      expectType(doc.confidence, env, 'confidence', 'number', 'payload-type', issues);
      expectType(doc.threshold, env, 'threshold', 'number', 'payload-type', issues);
      if (doc.requiredEvidence !== undefined) {
        if (doc.evidenceInput === undefined) {
          issues.push({
            path: 'evidenceInput',
            code: 'evidence-input-required',
            message: 'requiredEvidence requires a declared evidenceInput (record input)',
          });
        } else {
          const declaration = env.get(doc.evidenceInput);
          if (declaration === undefined) {
            issues.push({
              path: 'evidenceInput',
              code: 'undeclared-input',
              message: `evidenceInput "${doc.evidenceInput}" is not a declared input`,
            });
          } else if (declaration.type !== 'record') {
            issues.push({
              path: 'evidenceInput',
              code: 'evidence-input-type',
              message: `evidenceInput "${doc.evidenceInput}" must be a record input (got "${declaration.type}")`,
            });
          }
        }
        const kinds = new Set<string>();
        doc.requiredEvidence.forEach((requirement, index) => {
          if (kinds.has(requirement.kind)) {
            issues.push({
              path: `requiredEvidence[${index}].kind`,
              code: 'duplicate-evidence-kind',
              message: `duplicate required evidence kind "${requirement.kind}"`,
            });
          }
          kinds.add(requirement.kind);
        });
      }
      break;
    }
    case 'authority': {
      const declaration = env.get(doc.permissionsInput);
      if (declaration === undefined) {
        issues.push({
          path: 'permissionsInput',
          code: 'undeclared-input',
          message: `permissionsInput "${doc.permissionsInput}" is not a declared input`,
        });
      } else if (declaration.type !== 'list') {
        issues.push({
          path: 'permissionsInput',
          code: 'permissions-input-type',
          message: `permissionsInput "${doc.permissionsInput}" must be a list input (got "${declaration.type}")`,
        });
      }
      if (doc.allOf.length === 0 && doc.anyOf.length === 0) {
        issues.push({
          path: '$',
          code: 'empty-permission-set',
          message: 'authority constraints must require at least one permission (allOf or anyOf)',
        });
      }
      break;
    }
  }
}

/**
 * Compile an authored ECL constraint into its deterministic evaluation
 * contract. Total function: never throws, never reads the environment, never
 * mutates its input.
 */
export function compileConstraint(authored: unknown): CompileOutcome {
  const guardIssues = guardJsonShape(authored);
  if (guardIssues.length > 0) return fail(guardIssues);

  const parsed = authoredConstraintSchema.safeParse(authored);
  if (!parsed.success) {
    return fail(zodIssuesToValidationIssues(parsed.error));
  }
  const doc = parsed.data;

  const issues: ValidationIssue[] = [];
  validateInputDeclarations(doc, issues);
  validatePayload(doc, issues);
  if (issues.length > 0) return fail(issues);

  const env = buildInputEnvironment(doc.inputs);

  // Fold class payload expressions first, then build the violation root from
  // folded subtrees so every expression is folded exactly once and every fold
  // issue (e.g. division by a constant zero) is reported exactly once.
  const folded: FoldedPayload = {};
  switch (doc.class) {
    case 'hard':
    case 'soft':
    case 'safety':
      folded.predicate = foldExpr(doc.predicate, 'predicate', issues);
      break;
    case 'resource':
      folded.usage = foldExpr(doc.usage, 'usage', issues);
      folded.limit = foldExpr(doc.limit, 'limit', issues);
      break;
    case 'epistemic':
      folded.confidence = foldExpr(doc.confidence, 'confidence', issues);
      folded.threshold = foldExpr(doc.threshold, 'threshold', issues);
      break;
    case 'authority':
      break;
  }
  const foldedAppliesWhen =
    doc.appliesWhen !== undefined ? foldExpr(doc.appliesWhen, 'appliesWhen', issues) : undefined;
  if (issues.length > 0) return fail(issues);

  const foldedRoot = foldExpr(buildViolationRoot(doc, folded), 'root', issues);
  if (issues.length > 0) return fail(issues);

  const payload = buildCompiledPayload(doc, env, folded);

  const compiledBase = {
    languageVersion: ECL_LANGUAGE_VERSION,
    id: doc.id,
    version: doc.version,
    ...(doc.title !== undefined ? { title: doc.title } : {}),
    ...(doc.description !== undefined ? { description: doc.description } : {}),
    ...(doc.tags !== undefined ? { tags: doc.tags } : {}),
    ...(doc.severity !== undefined ? { severity: doc.severity } : {}),
    inputs: doc.inputs,
    ...(foldedAppliesWhen !== undefined
      ? { appliesWhen: annotateExpr(foldedAppliesWhen, env) }
      : {}),
    root: annotateExpr(foldedRoot, env),
    payload,
    compiler: { name: ECL_COMPILER.name, version: ECL_COMPILER.version },
  };
  const compiledDigest = digestOf(compiledBase);
  const compiled: CompiledConstraint = { ...compiledBase, compiledDigest };

  const selfCheck = compiledConstraintSchema.safeParse(compiled);
  if (!selfCheck.success) {
    return fail(
      zodIssuesToValidationIssues(selfCheck.error, undefined, 'internal').map((issue) => ({
        ...issue,
        message: `internal compiler error: ${issue.message}`,
      })),
    );
  }
  return { ok: true, compiled };
}

function buildCompiledPayload(
  doc: AuthoredConstraint,
  env: InputEnvironment,
  folded: FoldedPayload,
) {
  switch (doc.class) {
    case 'hard':
      return { class: 'hard' as const };
    case 'soft':
      return { class: 'soft' as const, weight: doc.weight };
    case 'resource':
      return {
        class: 'resource' as const,
        usage: annotateExpr(folded.usage as AuthoredExpr, env),
        limit: annotateExpr(folded.limit as AuthoredExpr, env),
        unit: doc.unit,
      };
    case 'safety':
      return { class: 'safety' as const, regulations: doc.regulations };
    case 'epistemic':
      return {
        class: 'epistemic' as const,
        confidence: annotateExpr(folded.confidence as AuthoredExpr, env),
        threshold: annotateExpr(folded.threshold as AuthoredExpr, env),
        ...(doc.evidenceInput !== undefined ? { evidenceInput: doc.evidenceInput } : {}),
        ...(doc.requiredEvidence !== undefined ? { requiredEvidence: doc.requiredEvidence } : {}),
      };
    case 'authority':
      return {
        class: 'authority' as const,
        permissionsInput: doc.permissionsInput,
        allOf: doc.allOf,
        anyOf: doc.anyOf,
      };
  }
}
