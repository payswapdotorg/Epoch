/**
 * Reference-grade threshold evaluator — REFERENCE ONLY, NOT A
 * PRODUCTION EVALUATOR.
 *
 * Purpose: prove the evaluation protocol end-to-end (registration ->
 * evaluation request -> subject lookup by digest -> pass/fail verdict
 * with criterion references -> digests) with a judgment that is
 * trivially auditable. It judges one named numeric output of a subject
 * against a threshold and comparison operator, producing pass/fail
 * verdicts with justification references. Real evaluators — including
 * model-backed judgment — are external capabilities behind this
 * protocol.
 *
 * Determinism evidence: `runReferenceEvaluation` is a pure function of
 * the admitted request and the registered subject payload — identical
 * inputs produce identical verdict digests (proven by tests).
 *
 * The subject payload is supplied by the CALLER as named outputs keyed
 * by the subject's canonical digest; this evaluator never parses
 * simulation-protocol or world-model types (lock rule 6 separation).
 */
import type { JsonValue, ParseOutcome, ProtocolError } from '@epoch/agent-protocol';
import { validateEvaluatorRegistration, type EvaluatorRegistration } from './registration';
import { parseEvaluationRequest, type EvaluationRequest } from './request';
import { parseEvaluationVerdict, type EvaluationVerdict } from './verdict';
import {
  checkEvaluationRequestConformance,
  evaluatorRegistrationDigest,
  type ConformanceViolation,
} from './conformance';
import { EVALUATION_PROTOCOL_VERSION } from './version';

/** Registered id of the reference evaluator. */
export const REFERENCE_EVALUATOR_ID = 'evaluator:reference-threshold';

/** Comparison operators the reference evaluator understands. */
export const REFERENCE_OPERATORS = ['<', '<=', '>', '>=', '=='] as const;

export type ReferenceOperator = (typeof REFERENCE_OPERATORS)[number];

/**
 * The reference evaluator's own registration — a valid, fully declared
 * judgment contract (subject kinds, criteria, verdict forms, judgment
 * basis with assumptions, determinism, cost, latency).
 */
export const REFERENCE_EVALUATOR_REGISTRATION: EvaluatorRegistration =
  validateEvaluatorRegistration({
    protocolVersion: EVALUATION_PROTOCOL_VERSION,
    messageKind: 'evaluation.registration',
    messageId: 'msg-reference-evaluator-registration',
    createdAt: '2025-02-01T00:00:00.000Z',
    evaluatorId: REFERENCE_EVALUATOR_ID,
    displayName: 'Reference Threshold Evaluator',
    description:
      'Reference-grade deterministic evaluator: judges one named numeric subject output against a threshold and comparison operator. Proves the evaluation protocol end-to-end; not a production evaluator.',
    subjectKinds: ['simulation-result', 'world-outcome'],
    criteria: [
      {
        name: 'metric',
        kind: 'string',
        required: true,
        description: 'Name of the subject output to judge.',
      },
      {
        name: 'operator',
        kind: 'enum',
        required: true,
        description: 'Comparison operator applied to the observed value.',
        enumValues: [...REFERENCE_OPERATORS],
      },
      {
        name: 'threshold',
        kind: 'number',
        required: true,
        description: 'Threshold the observed value is compared against.',
      },
    ],
    verdictForms: ['pass-fail'],
    judgmentBasis: {
      summary:
        'Binary judgment of one named numeric subject output against a caller-declared threshold and comparison operator.',
      assumptions: [
        'The named subject output is a finite number when the judgment runs.',
        'The comparison semantics of IEEE-754 doubles apply.',
      ],
    },
    deterministic: true,
    costProfile: { basis: 'none' },
    latencyProfile: { p50Milliseconds: 0, p95Milliseconds: 0 },
  });

/** The digest of the reference registration's canonical JSON. */
export function referenceEvaluatorRegistrationDigest(): string {
  return evaluatorRegistrationDigest(REFERENCE_EVALUATOR_REGISTRATION);
}

/**
 * Deterministically derive the verdict id for a request digest:
 * identical requests always map to the identical verdict id.
 */
export function deriveReferenceVerdictId(requestDigest: string): string {
  return `verdict-${requestDigest.slice(0, 16)}`;
}

/** A subject payload the caller registers for judgment, keyed by digest. */
export interface ReferenceSubjectPayload {
  readonly subjectId: string;
  readonly outputs: Readonly<Record<string, JsonValue>>;
}

/** Typed failure of a reference-evaluation run. */
export type ReferenceEvaluationFailure =
  | { readonly kind: 'invalid-request'; readonly error: ProtocolError }
  | { readonly kind: 'nonconforming-request'; readonly violations: ConformanceViolation[] }
  | {
      readonly kind: 'unknown-subject';
      readonly message: string;
    }
  | {
      readonly kind: 'subject-id-mismatch';
      readonly message: string;
    }
  | {
      readonly kind: 'criterion-not-applicable';
      readonly message: string;
    };

/** Successful reference evaluation: the admitted chain with digests. */
export interface ReferenceEvaluationRun {
  readonly registration: EvaluatorRegistration;
  readonly request: EvaluationRequest;
  readonly requestDigest: string;
  readonly verdict: EvaluationVerdict;
  readonly verdictDigest: string;
}

export type ReferenceEvaluationOutcome =
  | { readonly ok: true; readonly run: ReferenceEvaluationRun }
  | { readonly ok: false; readonly failure: ReferenceEvaluationFailure };

function compare(value: number, operator: ReferenceOperator, threshold: number): boolean {
  switch (operator) {
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '==':
      return value === threshold;
  }
}

/**
 * Run the reference evaluator for one evaluation request (unknown input)
 * against a registry of subject payloads keyed by canonical digest.
 * Unknown digests are rejected with a typed `unknown-subject` failure —
 * an evaluator never judges a result it cannot address.
 */
export function runReferenceEvaluation(
  input: unknown,
  subjects: ReadonlyMap<string, ReferenceSubjectPayload>,
): ReferenceEvaluationOutcome {
  const parsed: ParseOutcome<EvaluationRequest> = parseEvaluationRequest(input);
  if (!parsed.ok) {
    return { ok: false, failure: { kind: 'invalid-request', error: parsed.error } };
  }
  const request = parsed.value;
  const requestDigest = parsed.digest;

  const violations = checkEvaluationRequestConformance(
    REFERENCE_EVALUATOR_REGISTRATION,
    request,
  );
  if (violations.length > 0) {
    return { ok: false, failure: { kind: 'nonconforming-request', violations } };
  }

  const subject = subjects.get(request.subject.subjectDigest);
  if (subject === undefined) {
    return {
      ok: false,
      failure: {
        kind: 'unknown-subject',
        message: `no subject registered for digest ${request.subject.subjectDigest} (${request.subject.kind} ${request.subject.subjectId})`,
      },
    };
  }
  if (subject.subjectId !== request.subject.subjectId) {
    return {
      ok: false,
      failure: {
        kind: 'subject-id-mismatch',
        message: `registry entry for digest ${request.subject.subjectDigest} has subject id "${subject.subjectId}" but the request judges "${request.subject.subjectId}"`,
      },
    };
  }

  const metric = request.criteria.metric as string;
  const operator = request.criteria.operator as ReferenceOperator;
  const threshold = request.criteria.threshold as number;

  const observed = subject.outputs[metric];
  if (observed === undefined) {
    return {
      ok: false,
      failure: {
        kind: 'criterion-not-applicable',
        message: `subject "${request.subject.subjectId}" has no output named "${metric}"`,
      },
    };
  }
  if (typeof observed !== 'number' || !Number.isFinite(observed)) {
    return {
      ok: false,
      failure: {
        kind: 'criterion-not-applicable',
        message: `subject output "${metric}" is not a finite number (judgment requires a numeric metric)`,
      },
    };
  }

  const passed = compare(observed, operator, threshold);

  const verdictDocument: EvaluationVerdict = {
    protocolVersion: EVALUATION_PROTOCOL_VERSION,
    messageKind: 'evaluation.verdict',
    verdictId: deriveReferenceVerdictId(requestDigest),
    request: { requestId: request.requestId, requestDigest },
    evaluator: {
      evaluatorId: REFERENCE_EVALUATOR_ID,
      registrationDigest: referenceEvaluatorRegistrationDigest(),
    },
    subject: request.subject,
    outcome: { verdictForm: 'pass-fail', outcome: passed ? 'pass' : 'fail' },
    justification: [
      {
        kind: 'criterion',
        reference: 'metric',
        statement: `Judged subject output "${metric}".`,
      },
      {
        kind: 'criterion',
        reference: 'operator',
        statement: `Applied comparison operator "${operator}".`,
      },
      {
        kind: 'criterion',
        reference: 'threshold',
        statement: `Compared the observed value against threshold ${threshold}.`,
      },
      {
        kind: 'subject-output',
        reference: metric,
        statement: `Observed value ${observed} ${operator} ${threshold} is ${passed}.`,
      },
    ],
    deterministic: true,
  };

  const admitted = parseEvaluationVerdict(verdictDocument);
  if (!admitted.ok) {
    // The reference evaluator builds only schema-valid verdicts;
    // reaching this branch is a programming error in the reference.
    return { ok: false, failure: { kind: 'invalid-request', error: admitted.error } };
  }

  return {
    ok: true,
    run: {
      registration: REFERENCE_EVALUATOR_REGISTRATION,
      request,
      requestDigest,
      verdict: admitted.value,
      verdictDigest: admitted.digest,
    },
  };
}
