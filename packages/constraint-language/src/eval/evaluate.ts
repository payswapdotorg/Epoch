// @epoch/constraint-language — the reference evaluator.
//
// Executes the compiled deterministic form over a typed evaluation context as
// a PURE function: no side effects, no environment access, no clocks, no
// randomness, no input mutation. Totality: it never throws — every input
// yields either a result or a typed rejection (schema-invalid compiled form,
// schema-invalid context, digest mismatch, or internal self-check failure).
// This proves the evaluation CONTRACT; the production Constraint Engine
// runtime integration (W022 action gating) wires it up.
import type { CompiledExpr } from '../types';
import { digestOf } from '../canonical';
import { compiledConstraintSchema, type CompiledConstraint } from '../schema/compiled';
import { buildContextSchema, type ContextInputValue } from '../schema/context';
import {
  evaluationResultSchema,
  type ConstraintEvaluationResult,
  type EvaluationOutcome,
} from '../schema/result';
import { zodIssuesToValidationIssues, type ValidationIssue } from '../schema/common';
import { guardJsonShape } from '../compile/guard';

type EvalValue = number | string | boolean | Record<string, number> | string[];

function reject(kind: 'invalid-compiled' | 'invalid-context' | 'invalid-result', issues: ValidationIssue[]): EvaluationOutcome {
  return { ok: false, kind, issues };
}

/** Recompute the compiled digest over the canonical form (digest excluded). */
function compiledDigestOf(compiled: CompiledConstraint): string {
  const rest: Record<string, unknown> = { ...compiled };
  delete rest.compiledDigest;
  return digestOf(rest);
}

/** Evaluate a compiled expression over validated inputs. Total; never throws. */
function evalExpr(node: CompiledExpr, inputs: Record<string, ContextInputValue>): EvalValue {
  switch (node.node) {
    case 'lit':
      return node.value;
    case 'input':
      return inputs[node.name];
    case 'lt':
      return (evalExpr(node.left, inputs) as number) < (evalExpr(node.right, inputs) as number);
    case 'le':
      return (evalExpr(node.left, inputs) as number) <= (evalExpr(node.right, inputs) as number);
    case 'gt':
      return (evalExpr(node.left, inputs) as number) > (evalExpr(node.right, inputs) as number);
    case 'ge':
      return (evalExpr(node.left, inputs) as number) >= (evalExpr(node.right, inputs) as number);
    case 'eq':
      return evalExpr(node.left, inputs) === evalExpr(node.right, inputs);
    case 'ne':
      return evalExpr(node.left, inputs) !== evalExpr(node.right, inputs);
    case 'and':
      return node.operands.every((operand) => evalExpr(operand, inputs) === true);
    case 'or':
      return node.operands.some((operand) => evalExpr(operand, inputs) === true);
    case 'not':
      return !(evalExpr(node.operand, inputs) === true);
    case 'implies':
      return !(evalExpr(node.antecedent, inputs) === true) || evalExpr(node.consequent, inputs) === true;
    case 'add':
      return node.operands.reduce<number>(
        (accumulator, operand) => accumulator + (evalExpr(operand, inputs) as number),
        0,
      );
    case 'mul':
      return node.operands.reduce<number>(
        (accumulator, operand) => accumulator * (evalExpr(operand, inputs) as number),
        1,
      );
    case 'sub':
      return (evalExpr(node.left, inputs) as number) - (evalExpr(node.right, inputs) as number);
    case 'div':
      return (evalExpr(node.left, inputs) as number) / (evalExpr(node.right, inputs) as number);
    case 'has':
      return Object.hasOwn(evalExpr(node.record, inputs) as Record<string, number>, node.key);
    case 'get': {
      const record = evalExpr(node.record, inputs) as Record<string, number>;
      return Object.hasOwn(record, node.key)
        ? record[node.key]
        : (evalExpr(node.fallback, inputs) as number);
    }
    case 'count':
      return (evalExpr(node.list, inputs) as string[]).length;
    case 'contains':
      return (evalExpr(node.list, inputs) as string[]).includes(node.value);
  }
}

/** Normalize a computed number for the serializable result: null when non-finite. */
function finiteOrNone(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function effectFor(class_: ConstraintEvaluationResult['constraintClass'], violated: boolean): 'block' | 'penalize' | 'none' {
  if (!violated) return 'none';
  return class_ === 'soft' ? 'penalize' : 'block';
}

function buildMessage(result: Omit<ConstraintEvaluationResult, 'message' | 'evaluationDigest'>): string {
  const head = `Constraint '${result.constraintId}' v${result.constraintVersion} (${result.constraintClass})`;
  if (result.outcome === 'not-applicable') return `${head} not applicable.`;
  if (result.outcome === 'satisfied') return `${head} satisfied.`;
  switch (result.details.class) {
    case 'hard':
      return `${head} violated: predicate failed.`;
    case 'safety':
      return `${head} violated: predicate failed (regulations: ${result.details.regulations.join(', ')}).`;
    case 'soft':
      return `${head} violated: predicate failed (penalty ${result.details.weight}).`;
    case 'resource': {
      const { usage, limit, unit } = result.details;
      if (usage === null || limit === null) {
        return `${head} violated: usage exceeds limit (non-finite usage/limit) ${unit}.`;
      }
      return `${head} violated: usage ${usage} exceeds limit ${limit} ${unit}.`;
    }
    case 'epistemic': {
      const { confidence, threshold, evidence } = result.details;
      let message: string;
      if (confidence !== null && threshold !== null && confidence < threshold) {
        message = `${head} violated: confidence ${confidence} below threshold ${threshold}.`;
      } else {
        message = `${head} violated: insufficient evidence.`;
      }
      const deficient = evidence.filter((item) => item.actual < item.required);
      if (deficient.length > 0) {
        const parts = deficient.map((item) => `${item.kind} (${item.actual} of ${item.required})`);
        message += ` Missing evidence: ${parts.join(', ')}.`;
      }
      return message;
    }
    case 'authority':
      return `${head} violated: missing permissions: [${result.details.missing.join(', ')}].`;
  }
}

/**
 * Evaluate a compiled constraint against an evaluation context.
 *
 * @param compiled compiled constraint (unknown: it is fully re-validated,
 *   including its `compiledDigest`, before execution)
 * @param context evaluation context `{ inputs: { ... } }` (unknown: it is
 *   validated against the compiled constraint's declared input slots)
 * @returns a result or a typed rejection; never throws
 */
export function evaluateConstraint(compiled: unknown, context: unknown): EvaluationOutcome {
  const compiledGuard = guardJsonShape(compiled);
  if (compiledGuard.length > 0) return reject('invalid-compiled', compiledGuard);
  const contextGuard = guardJsonShape(context);
  if (contextGuard.length > 0) return reject('invalid-context', contextGuard);

  const parsedCompiled = compiledConstraintSchema.safeParse(compiled);
  if (!parsedCompiled.success) {
    return reject('invalid-compiled', zodIssuesToValidationIssues(parsedCompiled.error));
  }
  const constraint = parsedCompiled.data;

  const expectedDigest = compiledDigestOf(constraint);
  if (expectedDigest !== constraint.compiledDigest) {
    return reject('invalid-compiled', [
      {
        path: '$.compiledDigest',
        code: 'digest-mismatch',
        message: `compiled digest mismatch: expected ${expectedDigest}, found ${constraint.compiledDigest} (artifact was modified after compilation)`,
      },
    ]);
  }

  const parsedContext = buildContextSchema(constraint).safeParse(context);
  if (!parsedContext.success) {
    return reject('invalid-context', zodIssuesToValidationIssues(parsedContext.error));
  }
  const inputs = parsedContext.data.inputs;

  if (
    constraint.appliesWhen !== undefined &&
    evalExpr(constraint.appliesWhen, inputs) !== true
  ) {
    return finalize(constraint, 'not-applicable', inputs);
  }

  const violated = evalExpr(constraint.root, inputs) === true;
  return finalize(constraint, violated ? 'violated' : 'satisfied', inputs);
}

function finalize(
  constraint: CompiledConstraint,
  outcome: 'satisfied' | 'violated' | 'not-applicable',
  inputs: Record<string, ContextInputValue>,
): EvaluationOutcome {
  const violated = outcome === 'violated';
  const notApplicable = outcome === 'not-applicable';

  let details: ConstraintEvaluationResult['details'];
  switch (constraint.payload.class) {
    case 'hard':
      details = {
        class: 'hard',
        ...(constraint.severity !== undefined ? { severity: constraint.severity } : {}),
      };
      break;
    case 'soft':
      details = { class: 'soft', weight: constraint.payload.weight };
      break;
    case 'safety':
      details = { class: 'safety', regulations: constraint.payload.regulations };
      break;
    case 'resource': {
      const usage = notApplicable ? null : finiteOrNone(evalExpr(constraint.payload.usage, inputs) as number);
      const limit = notApplicable ? null : finiteOrNone(evalExpr(constraint.payload.limit, inputs) as number);
      const remaining =
        notApplicable || usage === null || limit === null
          ? null
          : finiteOrNone(limit - usage);
      details = { class: 'resource', unit: constraint.payload.unit, usage, limit, remaining };
      break;
    }
    case 'epistemic': {
      const confidence = notApplicable
        ? null
        : finiteOrNone(evalExpr(constraint.payload.confidence, inputs) as number);
      const threshold = notApplicable
        ? null
        : finiteOrNone(evalExpr(constraint.payload.threshold, inputs) as number);
      const evidence: Array<{ kind: string; required: number; actual: number }> = [];
      if (!notApplicable && constraint.payload.requiredEvidence !== undefined) {
        const record = (inputs[constraint.payload.evidenceInput as string] ?? {}) as Record<
          string,
          number
        >;
        for (const requirement of constraint.payload.requiredEvidence) {
          evidence.push({
            kind: requirement.kind,
            required: requirement.minCount,
            actual: Object.hasOwn(record, requirement.kind) ? record[requirement.kind] : 0,
          });
        }
      }
      details = { class: 'epistemic', confidence, threshold, evidence };
      break;
    }
    case 'authority': {
      const granted = notApplicable
        ? []
        : ((inputs[constraint.payload.permissionsInput] ?? []) as string[]);
      const missing = notApplicable
        ? []
        : constraint.payload.allOf.filter((permission) => !granted.includes(permission));
      const matchedAnyOf = notApplicable
        ? undefined
        : constraint.payload.anyOf.find((permission) => granted.includes(permission));
      details = {
        class: 'authority',
        allOf: constraint.payload.allOf,
        anyOf: constraint.payload.anyOf,
        missing,
        matchedAnyOf: matchedAnyOf ?? null,
      };
      break;
    }
  }

  const penalty =
    violated && constraint.payload.class === 'soft' ? constraint.payload.weight : 0;

  const withoutDigest = {
    constraintId: constraint.id,
    constraintVersion: constraint.version,
    constraintClass: constraint.payload.class,
    outcome,
    effect: effectFor(constraint.payload.class, violated),
    violated,
    penalty,
    details,
  };
  const result: ConstraintEvaluationResult = {
    ...withoutDigest,
    message: buildMessage(withoutDigest),
    evaluationDigest: digestOf(withoutDigest),
  };

  const selfCheck = evaluationResultSchema.safeParse(result);
  if (!selfCheck.success) {
    return reject('invalid-result', zodIssuesToValidationIssues(selfCheck.error, undefined, 'internal'));
  }
  return { ok: true, result };
}
