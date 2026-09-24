// Shared fixtures: valid protocol documents used across the positive tests.
import type { EvaluatorRegistration } from '../src/registration';
import type { EvaluationRequest } from '../src/request';
import type { EvaluationVerdict } from '../src/verdict';
import {
  REFERENCE_EVALUATOR_REGISTRATION,
  referenceEvaluatorRegistrationDigest,
} from '../src/reference';

export { REFERENCE_EVALUATOR_REGISTRATION, referenceEvaluatorRegistrationDigest };

/** A valid, fully declared evaluator registration (safety domain). */
export function validRegistration(overrides?: {
  evaluatorId?: string;
  messageId?: string;
}): EvaluatorRegistration {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'evaluation.registration',
    messageId: overrides?.messageId ?? 'msg-0001-evaluator-registration',
    createdAt: '2025-02-12T09:00:00.000Z',
    evaluatorId: overrides?.evaluatorId ?? 'evaluator:thermal-margin',
    displayName: 'Thermal Margin Evaluator',
    description: 'Judges predicted peak temperatures against design limits.',
    subjectKinds: ['simulation-result'],
    criteria: [
      {
        name: 'metric',
        kind: 'string',
        required: true,
        description: 'Subject output to judge.',
      },
      {
        name: 'limit',
        kind: 'number',
        required: true,
        description: 'Maximum tolerated value.',
        unit: 'K',
      },
      {
        name: 'severity',
        kind: 'enum',
        required: false,
        description: 'Optional severity weighting.',
        enumValues: ['normal', 'aggravated'],
      },
    ],
    verdictForms: ['pass-fail', 'scored'],
    judgmentBasis: {
      summary: 'Compares one named predicted quantity against a declared limit.',
      assumptions: [
        'The judged quantity is a finite number at judgment time.',
        'Single-limit comparison semantics apply.',
      ],
    },
    deterministic: true,
    costProfile: { basis: 'per-proposal', currency: 'USD', amount: '0.05' },
    latencyProfile: { p50Milliseconds: 100, p95Milliseconds: 400 },
  };
}

/** A valid evaluation request against `validRegistration()`. */
export function validRequest(overrides?: {
  registration?: EvaluatorRegistration;
  registrationDigest?: string;
  requestId?: string;
}): EvaluationRequest {
  const registration = overrides?.registration ?? validRegistration();
  return {
    protocolVersion: '1.0.0',
    messageKind: 'evaluation.request',
    messageId: 'msg-0002-evaluation-request',
    createdAt: '2025-02-12T09:05:00.000Z',
    requestId: overrides?.requestId ?? 'evalreq-0001',
    evaluator: {
      evaluatorId: registration.evaluatorId,
      registrationDigest: overrides?.registrationDigest ?? 'c'.repeat(64),
    },
    subject: {
      kind: 'simulation-result',
      subjectId: 'simresult-0123456789abcdef',
      subjectDigest: 'd'.repeat(64),
    },
    criteria: {
      metric: 'peak-temperature',
      limit: 360,
    },
  };
}

/** A valid pass/fail verdict answering `validRequest()`. */
export function validVerdict(overrides?: {
  registration?: EvaluatorRegistration;
  registrationDigest?: string;
  requestId?: string;
  requestDigest?: string;
}): EvaluationVerdict {
  const registration = overrides?.registration ?? validRegistration();
  const request = validRequest({
    registration,
    registrationDigest: overrides?.registrationDigest ?? 'c'.repeat(64),
    requestId: overrides?.requestId,
  });
  return {
    protocolVersion: '1.0.0',
    messageKind: 'evaluation.verdict',
    verdictId: 'verdict-0123456789abcdef',
    request: {
      requestId: request.requestId,
      requestDigest: overrides?.requestDigest ?? 'e'.repeat(64),
    },
    evaluator: {
      evaluatorId: registration.evaluatorId,
      registrationDigest: overrides?.registrationDigest ?? 'c'.repeat(64),
    },
    subject: request.subject,
    outcome: { verdictForm: 'pass-fail', outcome: 'pass' },
    justification: [
      {
        kind: 'criterion',
        reference: 'metric',
        statement: 'Judged subject output "peak-temperature".',
      },
      {
        kind: 'criterion',
        reference: 'limit',
        statement: 'Compared the observed value against limit 360.',
      },
      {
        kind: 'subject-output',
        reference: 'peak-temperature',
        statement: 'Observed value 355.25 <= 360.',
      },
    ],
    deterministic: true,
  };
}

/** A valid scored verdict variant (uses the same request binding). */
export function validScoredVerdict(overrides?: Parameters<typeof validVerdict>[0]): EvaluationVerdict {
  const verdict = validVerdict(overrides);
  return {
    ...verdict,
    outcome: { verdictForm: 'scored', score: 0.87, scale: { minimum: 0, maximum: 1 } },
  };
}

/** A valid evaluation request against the reference evaluator. */
export function referenceRequest(
  overrides?: Partial<Pick<EvaluationRequest, 'requestId' | 'criteria' | 'subject'>>,
): EvaluationRequest {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'evaluation.request',
    messageId: 'msg-reference-evaluation-request',
    createdAt: '2025-02-12T09:10:00.000Z',
    requestId: overrides?.requestId ?? 'evalreq-reference-0001',
    evaluator: {
      evaluatorId: REFERENCE_EVALUATOR_REGISTRATION.evaluatorId,
      registrationDigest: referenceEvaluatorRegistrationDigest(),
    },
    subject: overrides?.subject ?? {
      kind: 'simulation-result',
      subjectId: 'simresult-ffffffffffffffff',
      subjectDigest: 'f'.repeat(64),
    },
    criteria: overrides?.criteria ?? {
      metric: 'y',
      operator: '<=',
      threshold: 10,
    },
  };
}
