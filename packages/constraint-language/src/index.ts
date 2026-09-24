// @epoch/constraint-language — public API.
//
// The Epoch Constraint Language (ECL) kernel:
//   authored constraint (structured, human-editable AST)
//     -> compileConstraint (validation + typecheck + fold + annotate + digest)
//   compiled constraint (deterministic evaluation contract)
//     -> evaluateConstraint (pure, total reference evaluator)
//   evaluation result (deterministic, serializable, digest-addressable)
//
// Provider-neutral by construction: no provider types, no I/O, no clocks, no
// randomness. The full runtime validation surface (zod) and the published
// type/JSON-Schema contract live at contracts/constraints/v1.
export {
  ECL_LANGUAGE_VERSION,
  ECL_COMPILER,
  ECL_LIMITS,
  constraintIdSchema,
  inputNameSchema,
  semverSchema,
  permissionSchema,
  titleSchema,
  descriptionSchema,
  validationIssueSchema,
  zodIssuesToValidationIssues,
  joinIssuePath,
} from './schema/common';
export { EXPR_NODE_KINDS, AuthoredExprSchema, CompiledExprSchema } from './schema/expression';
export type { ExprNodeKind } from './schema/expression';
export {
  authoredConstraintSchema,
  inputDeclarationSchema,
} from './schema/authored';
export type { AuthoredConstraint, InputDeclaration } from './schema/authored';
export { compiledConstraintSchema, compiledPayloadSchema } from './schema/compiled';
export type { CompiledConstraint, CompiledPayload } from './schema/compiled';
export { evaluationContextSchema, buildContextSchema } from './schema/context';
export type { EvaluationContext, ContextInputValue } from './schema/context';
export {
  constraintOutcomeSchema,
  constraintEffectSchema,
  resultDetailsSchema,
  evaluationResultSchema,
  evaluationOutcomeSchema,
  evaluationRejectionKindSchema,
} from './schema/result';
export type {
  ConstraintOutcome,
  ConstraintEffect,
  ResultDetails,
  ConstraintEvaluationResult,
  EvaluationOutcome,
  EvaluationRejectionKind,
} from './schema/result';
export { compileConstraint } from './compile';
export type { CompileOutcome } from './compile';
export { guardJsonShape } from './compile/guard';
export { evaluateConstraint } from './eval/evaluate';
export { canonicalJson, fnv1a32, digestOf } from './canonical';
export type { AuthoredExpr, CompiledExpr, JsonValue, LiteralType, ValueType } from './types';
export type { ValidationIssue } from './schema/common';
