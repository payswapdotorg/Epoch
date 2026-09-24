// contracts/constraints/v1 — the published, versioned Epoch Constraint &
// Policy Language (ECL) contract surface (Work Order W004).
//
// This file is the ownership-boundary declaration surface for consumers of the
// constraint/policy kernel (Constraint Engine integration, W022 Action
// Gateway, policy tooling). It is hand-maintained and MUST stay structurally
// identical to the implementation types:
//   - packages/constraint-language  (zod schemas; types inferred from them)
//   - packages/policy-contracts     (policy zod schemas; types inferred)
// Equality is enforced by the contract-sync tests in both packages.
// JSON Schema renderings of these types live in ./schemas/*.json.
//
// Versioning: this surface is version "v1" (ECL language version 1.0.0,
// policy language version 1.0.0). Additive changes may update the schemas in
// place; breaking changes require a new versioned directory (v2) plus an
// Architecture Change Request.

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** ECL language version gate carried by authored and compiled constraints. */
export type EclLanguageVersion = '1.0.0';

/** Policy language version gate carried by policy documents. */
export type PolicyLanguageVersion = '1.0.0';

/** Constraint classes (Epoch requirement R3). */
export type ConstraintClass = 'hard' | 'soft' | 'resource' | 'safety' | 'epistemic' | 'authority';

/** Literal value kinds expressible in the authored expression language. */
export type LiteralType = 'number' | 'string' | 'boolean';

/** Static value types annotated on compiled expression nodes. */
export type ValueType = 'number' | 'string' | 'boolean' | 'record' | 'list';

/** Declared evaluation-context input slot types. */
export type InputType = 'number' | 'string' | 'boolean' | 'enum' | 'record' | 'list';

/** Optional severity metadata echoed in results. */
export type Severity = 'critical' | 'major' | 'minor';

/** Structured validation issue (compile errors and evaluation rejections). */
export interface ValidationIssue {
  /** Dot/bracket path to the offending element ("$" = root). */
  path: string;
  /** Stable machine-readable error/rejection code. */
  code: string;
  /** Human-readable deterministic message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Evaluation-context input declarations
// ---------------------------------------------------------------------------

export interface InputDeclaration {
  name: string;
  type: InputType;
  /** Required iff type is "enum": the finite set of allowed strings. */
  values?: string[] | undefined;
  description?: string | undefined;
}

// ---------------------------------------------------------------------------
// Authored expression AST (human-editable, serializable, pre-compilation)
// ---------------------------------------------------------------------------

export type AuthoredExpr =
  | { node: 'lit'; type: LiteralType; value: number | string | boolean }
  | { node: 'input'; name: string }
  | { node: 'lt'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'le'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'gt'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'ge'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'eq'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'ne'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'and'; operands: AuthoredExpr[] }
  | { node: 'or'; operands: AuthoredExpr[] }
  | { node: 'not'; operand: AuthoredExpr }
  | { node: 'implies'; antecedent: AuthoredExpr; consequent: AuthoredExpr }
  | { node: 'add'; operands: AuthoredExpr[] }
  | { node: 'mul'; operands: AuthoredExpr[] }
  | { node: 'sub'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'div'; left: AuthoredExpr; right: AuthoredExpr }
  | { node: 'has'; record: AuthoredExpr; key: string }
  | { node: 'get'; record: AuthoredExpr; key: string; fallback: AuthoredExpr }
  | { node: 'count'; list: AuthoredExpr }
  | { node: 'contains'; list: AuthoredExpr; value: string };

// ---------------------------------------------------------------------------
// Authored constraints (compilation input; discriminator: "class")
// ---------------------------------------------------------------------------

interface AuthoredConstraintBase {
  languageVersion: EclLanguageVersion;
  id: string;
  version: string;
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  severity?: Severity | undefined;
  /** Optional boolean applicability guard; false evaluates to "not-applicable". */
  appliesWhen?: AuthoredExpr | undefined;
  inputs: InputDeclaration[];
}

export interface AuthoredHardConstraint extends AuthoredConstraintBase {
  class: 'hard';
  predicate: AuthoredExpr;
}

export interface AuthoredSoftConstraint extends AuthoredConstraintBase {
  class: 'soft';
  predicate: AuthoredExpr;
  weight: number;
}

export interface AuthoredResourceConstraint extends AuthoredConstraintBase {
  class: 'resource';
  usage: AuthoredExpr;
  limit: AuthoredExpr;
  unit: string;
}

export interface AuthoredSafetyConstraint extends AuthoredConstraintBase {
  class: 'safety';
  predicate: AuthoredExpr;
  regulations: string[];
}

export interface EvidenceRequirement {
  kind: string;
  minCount: number;
}

export interface AuthoredEpistemicConstraint extends AuthoredConstraintBase {
  class: 'epistemic';
  confidence: AuthoredExpr;
  threshold: AuthoredExpr;
  evidenceInput?: string | undefined;
  requiredEvidence?: EvidenceRequirement[] | undefined;
}

export interface AuthoredAuthorityConstraint extends AuthoredConstraintBase {
  class: 'authority';
  permissionsInput: string;
  allOf: string[];
  anyOf: string[];
}

export type AuthoredConstraint =
  | AuthoredHardConstraint
  | AuthoredSoftConstraint
  | AuthoredResourceConstraint
  | AuthoredSafetyConstraint
  | AuthoredEpistemicConstraint
  | AuthoredAuthorityConstraint;

// ---------------------------------------------------------------------------
// Compiled constraints (deterministic evaluation contract)
// ---------------------------------------------------------------------------

export type CompiledExpr =
  | { node: 'lit'; resultType: ValueType; type: LiteralType; value: number | string | boolean }
  | { node: 'input'; resultType: ValueType; name: string }
  | { node: 'lt'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'le'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'gt'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'ge'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'eq'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'ne'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'and'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'or'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'not'; resultType: ValueType; operand: CompiledExpr }
  | { node: 'implies'; resultType: ValueType; antecedent: CompiledExpr; consequent: CompiledExpr }
  | { node: 'add'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'mul'; resultType: ValueType; operands: CompiledExpr[] }
  | { node: 'sub'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'div'; resultType: ValueType; left: CompiledExpr; right: CompiledExpr }
  | { node: 'has'; resultType: ValueType; record: CompiledExpr; key: string }
  | { node: 'get'; resultType: ValueType; record: CompiledExpr; key: string; fallback: CompiledExpr }
  | { node: 'count'; resultType: ValueType; list: CompiledExpr }
  | { node: 'contains'; resultType: ValueType; list: CompiledExpr; value: string };

export type CompiledPayload =
  | { class: 'hard' }
  | { class: 'soft'; weight: number }
  | { class: 'resource'; usage: CompiledExpr; limit: CompiledExpr; unit: string }
  | { class: 'safety'; regulations: string[] }
  | {
      class: 'epistemic';
      confidence: CompiledExpr;
      threshold: CompiledExpr;
      evidenceInput?: string | undefined;
      requiredEvidence?: EvidenceRequirement[] | undefined;
    }
  | { class: 'authority'; permissionsInput: string; allOf: string[]; anyOf: string[] };

/** Compiler identity stamped onto every compiled constraint. */
export type CompilerStamp = { name: 'epoch-ecl-compiler'; version: '1.0.0' };

export interface CompiledConstraint {
  languageVersion: EclLanguageVersion;
  id: string;
  version: string;
  title?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  severity?: Severity | undefined;
  inputs: InputDeclaration[];
  appliesWhen?: CompiledExpr | undefined;
  /** Boolean violation expression: true means the constraint is violated. */
  root: CompiledExpr;
  payload: CompiledPayload;
  compiler: CompilerStamp;
  /** FNV-1a digest over the canonical JSON of this artifact (digest excluded). */
  compiledDigest: string;
}

// ---------------------------------------------------------------------------
// Evaluation context and results
// ---------------------------------------------------------------------------

/** JSON-compatible value domain for the context envelope. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface EvaluationContext {
  inputs: { [inputName: string]: JsonValue };
}

export type ConstraintOutcome = 'satisfied' | 'violated' | 'not-applicable';

export type ConstraintEffect = 'block' | 'penalize' | 'none';

export type ResultDetails =
  | { class: 'hard'; severity?: Severity | undefined }
  | { class: 'soft'; weight: number }
  | {
      class: 'resource';
      unit: string;
      usage: number | null;
      limit: number | null;
      remaining: number | null;
    }
  | { class: 'safety'; regulations: string[] }
  | {
      class: 'epistemic';
      confidence: number | null;
      threshold: number | null;
      evidence: Array<{ kind: string; required: number; actual: number }>;
    }
  | {
      class: 'authority';
      allOf: string[];
      anyOf: string[];
      missing: string[];
      matchedAnyOf: string | null;
    };

export interface ConstraintEvaluationResult {
  constraintId: string;
  constraintVersion: string;
  constraintClass: ConstraintClass;
  outcome: ConstraintOutcome;
  effect: ConstraintEffect;
  violated: boolean;
  penalty: number;
  message: string;
  details: ResultDetails;
  /** FNV-1a digest over the canonical JSON of this result (digest excluded). */
  evaluationDigest: string;
}

export type EvaluationRejectionKind = 'invalid-compiled' | 'invalid-context' | 'invalid-result';

export type EvaluationOutcome =
  | { ok: true; result: ConstraintEvaluationResult }
  | { ok: false; kind: EvaluationRejectionKind; issues: ValidationIssue[] };

// ---------------------------------------------------------------------------
// Compiler outcomes
// ---------------------------------------------------------------------------

export type CompileOutcome =
  | { ok: true; compiled: CompiledConstraint }
  | { ok: false; errors: ValidationIssue[] };

// ---------------------------------------------------------------------------
// Policy contracts (packages/policy-contracts)
// ---------------------------------------------------------------------------

export type PolicyPrecedenceTier = 'platform' | 'tenant' | 'workspace' | 'project';

export interface PolicyPrecedence {
  tier: PolicyPrecedenceTier;
  rank: number;
}

export interface PolicyTagsMatcher {
  allOf?: string[] | undefined;
  anyOf?: string[] | undefined;
}

export interface PolicyScope {
  tenantId?: string | undefined;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  actionKinds?: string[] | undefined;
  resourceTypes?: string[] | undefined;
  tags?: PolicyTagsMatcher | undefined;
}

/**
 * The object a policy is being applied to. Minimal additive reference type:
 * field alignment with the W003 action protocol and W002 world model contract
 * surfaces happens when those Work Orders merge (architecture question).
 */
export interface PolicyTarget {
  tenantId?: string | undefined;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  actionKind?: string | undefined;
  resourceType?: string | undefined;
  tags?: string[] | undefined;
}

export interface PolicyBinding {
  constraintId: string;
  constraintVersion?: string | undefined;
}

export type PolicyComposition = 'additive' | 'override';

export interface PolicyDocument {
  languageVersion: PolicyLanguageVersion;
  id: string;
  version: string;
  name: string;
  description?: string | undefined;
  enabled: boolean;
  applicability: PolicyScope;
  bindings: PolicyBinding[];
  precedence: PolicyPrecedence;
  composition: PolicyComposition;
}

export interface ApplicablePolicy {
  policyId: string;
  precedence: PolicyPrecedence;
  composition: PolicyComposition;
  bindingCount: number;
}

export interface ResolutionTraceEntry {
  policyId: string;
  action: 'add' | 'reset';
  bindingsAdded: number;
  effectiveBindingCount: number;
}

export interface ApplicablePolicyResolution {
  target: PolicyTarget;
  /** Applicable policies ordered by precedence, highest first. */
  applicable: ApplicablePolicy[];
  /** Effective, deduplicated bindings ordered by contributing precedence (highest first). */
  bindings: PolicyBinding[];
  /** Deterministic fold trace in ascending precedence order. */
  trace: ResolutionTraceEntry[];
}

export type CompositeDecisionKind = 'block' | 'allow' | 'allow-with-penalties' | 'not-applicable';

export interface BlockingEntry {
  constraintId: string;
  constraintVersion: string;
  constraintClass: ConstraintClass;
  effect: ConstraintEffect;
  message: string;
}

export interface ViolatedEntry {
  constraintId: string;
  constraintVersion: string;
  constraintClass: ConstraintClass;
  effect: ConstraintEffect;
  penalty: number;
  message: string;
}

export interface CompositeDecision {
  decision: CompositeDecisionKind;
  totalPenalty: number;
  blocking: BlockingEntry[];
  violated: ViolatedEntry[];
  counts: { satisfied: number; violated: number; notApplicable: number };
  reasons: string[];
}

export interface PolicyBindingEvaluation {
  binding: PolicyBinding;
  resolved: boolean;
  outcome?: EvaluationOutcome | undefined;
}

export interface PolicySetEvaluationResult {
  resolution: ApplicablePolicyResolution;
  evaluations: PolicyBindingEvaluation[];
  decision: CompositeDecision;
}

export type PolicyResolutionOutcome =
  | { ok: true; resolution: ApplicablePolicyResolution }
  | { ok: false; issues: ValidationIssue[] };

export type CompositionOutcome =
  | { ok: true; decision: CompositeDecision }
  | { ok: false; issues: ValidationIssue[] };

export type PolicySetEvaluationOutcome =
  | { ok: true; evaluation: PolicySetEvaluationResult }
  | { ok: false; issues: ValidationIssue[] };
