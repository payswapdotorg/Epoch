/**
 * Epoch Evaluation Protocol v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * IN-PACKAGE ownership boundary
 * `packages/evaluation-protocol/contracts/` (Work Order W005 — W005
 * owns no repository-root `contracts/*` directory, so the versioned
 * contract surface is published inside the package). It is
 * self-contained: no imports, no runtime code, no vendor/framework
 * vocabulary. The runtime implementation lives in
 * `@epoch/evaluation-protocol` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's inferred
 * types are identical to these declarations.
 *
 * Evaluation is distinct from simulation (architecture lock rule 6):
 * this surface judges subjects that are referenced neutrally by kind,
 * id, and canonical digest — it does not import or parse
 * simulation-protocol types, and it never predicts.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every message as `protocolVersion`)
 */

/**
 * Mirrored shared primitives (owned and versioned at `contracts/agent`);
 * redeclared here so this contract surface is self-contained. They MUST
 * stay structurally identical — enforced by parity assertions against
 * `@epoch/evaluation-protocol`, whose message shapes embed them.
 */

/** UTC instant in canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export type Timestamp = string;

/** Opaque message identifier (unique within the emitting scope; UUIDs fit). */
export type MessageId = string;

/** JSON-representable value (finite numbers only). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Value kinds an evaluation criterion parameter can carry. */
export type ParameterKind =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'entity-reference'
  | 'json';

/**
 * A named evaluation criterion parameter. `enumValues` is present if
 * and only if `kind` is `"enum"`; `unit` may only be present for the
 * numeric kinds (runtime refinements).
 */
export type ParameterSpec = {
  name: string;
  kind: ParameterKind;
  required: boolean;
  description: string;
  enumValues?: string[] | undefined;
  unit?: string | undefined;
};

/**
 * Cost profile. `basis: "none"` means no cost accounting applies; every
 * other basis requires exactly one ISO 4217 currency and one
 * non-negative decimal amount string.
 */
export type CostProfile =
  | { basis: 'none' }
  | { basis: 'per-proposal'; currency: string; amount: string }
  | { basis: 'per-session'; currency: string; amount: string }
  | { basis: 'per-hour'; currency: string; amount: string };

/** Latency profile in whole milliseconds (p95 >= p50, runtime refinement). */
export type LatencyProfile = {
  p50Milliseconds: number;
  p95Milliseconds: number;
};

/** Exact evaluation-protocol version admitted by contract version 1.0.0. */
export type EvaluationProtocolVersion = '1.0.0';

/** Discriminating message kinds of the evaluation protocol. */
export type EvaluationMessageKind =
  | 'evaluation.registration'
  | 'evaluation.request'
  | 'evaluation.verdict';

/** What an evaluator judges: a simulation result or a world outcome. */
export type EvaluationSubjectKind = 'simulation-result' | 'world-outcome';

/**
 * Exact-revision reference to the judged document: kind, opaque subject
 * id, and the SHA-256 digest of the subject document's canonical JSON.
 */
export type EvaluationSubject = {
  kind: EvaluationSubjectKind;
  subjectId: MessageId;
  subjectDigest: string;
};

/** Registered evaluator identifier: `evaluator:` + lowercase slug. */
export type EvaluatorId = string;

/** Verdict forms an evaluator may produce. */
export type VerdictForm = 'pass-fail' | 'scored';

/**
 * Declared judgment basis: summary plus at least one stated assumption
 * — an evaluator that cannot state its assumptions is not registrable
 * (runtime refinement).
 */
export type JudgmentBasis = {
  summary: string;
  assumptions: string[];
};

/**
 * The evaluator registration message (`messageKind:
 * "evaluation.registration"`): one provider-neutral declaration of an
 * evaluator's judgment contract — subject kinds, criteria, verdict
 * forms, judgment basis, determinism, cost and latency. Unknown fields
 * are rejected (strict objects), so no vendor- or framework-specific
 * field can be smuggled into a registration.
 */
export type EvaluatorRegistration = {
  protocolVersion: EvaluationProtocolVersion;
  messageKind: 'evaluation.registration';
  messageId: MessageId;
  createdAt: Timestamp;
  evaluatorId: EvaluatorId;
  displayName: string;
  description?: string | undefined;
  subjectKinds: EvaluationSubjectKind[];
  criteria: ParameterSpec[];
  verdictForms: VerdictForm[];
  judgmentBasis: JudgmentBasis;
  deterministic: boolean;
  costProfile: CostProfile;
  latencyProfile: LatencyProfile;
};

/**
 * Exact-revision reference to a registered evaluator: the evaluator id
 * plus the SHA-256 digest of the registration's canonical JSON.
 */
export type EvaluatorReference = {
  evaluatorId: EvaluatorId;
  registrationDigest: string;
};

/**
 * The evaluation request message (`messageKind: "evaluation.request"`):
 * a request for a registered evaluator to judge one subject at exact
 * revisions, with named evaluation criteria. At least one criterion is
 * required (runtime refinement); criteria conformance to the declared
 * contract is enforced by the runtime conformance checks.
 */
export type EvaluationRequest = {
  protocolVersion: EvaluationProtocolVersion;
  messageKind: 'evaluation.request';
  messageId: MessageId;
  createdAt: Timestamp;
  requestId: MessageId;
  evaluator: EvaluatorReference;
  subject: EvaluationSubject;
  criteria: { [key: string]: JsonValue };
};

/**
 * Exact-revision reference to an evaluation request: the request id
 * plus the SHA-256 digest of the request's canonical JSON.
 */
export type EvaluationRequestReference = {
  requestId: MessageId;
  requestDigest: string;
};

/** A binary verdict. */
export type PassFailVerdict = {
  verdictForm: 'pass-fail';
  outcome: 'pass' | 'fail';
};

/**
 * A scored verdict on a declared finite scale (minimum < maximum, score
 * within — runtime refinements).
 */
export type ScoredVerdict = {
  verdictForm: 'scored';
  score: number;
  scale: { minimum: number; maximum: number };
};

/** The exhaustive verdict-form union. */
export type VerdictOutcome = PassFailVerdict | ScoredVerdict;

/** What a verdict justification may point at. */
export type JustificationKind =
  | 'criterion'
  | 'subject-output'
  | 'subject-failure'
  | 'assumption'
  | 'method';

/**
 * One machine-referenceable justification entry: what it points at and
 * the human-auditable statement. For kind `criterion`, `reference`
 * must name a criterion key of the request (conformance-checked).
 */
export type JustificationReference = {
  kind: JustificationKind;
  reference: string;
  statement: string;
};

/**
 * The evaluation verdict message (`messageKind: "evaluation.verdict"`):
 * the judgment artifact for one admitted evaluation request. Carries
 * exact-revision request/evaluator bindings, the subject echo, a
 * structured outcome, at least one referenced justification, and the
 * determinism claim. NO wall-clock or measurement fields — a
 * deterministic evaluator's verdict digest must be a pure function of
 * the request digest.
 */
export type EvaluationVerdict = {
  protocolVersion: EvaluationProtocolVersion;
  messageKind: 'evaluation.verdict';
  verdictId: MessageId;
  request: EvaluationRequestReference;
  evaluator: EvaluatorReference;
  subject: EvaluationSubject;
  outcome: VerdictOutcome;
  justification: JustificationReference[];
  deterministic: boolean;
};
