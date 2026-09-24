// Cross-document conformance checks: the exact-revision evidence chain
// (registration digest -> request -> verdict), criteria-contract
// enforcement, verdict-form and determinism consistency, and
// justification-reference resolution.
import { describe, expect, it } from 'vitest';
import {
  checkEvaluationRequestConformance,
  checkVerdictConformance,
  evaluationRequestDigest,
  evaluatorRegistrationDigest,
  valueConformsToSpec,
} from '../src/conformance';
import { parseEvaluatorRegistration } from '../src/registration';
import { parseEvaluationRequest } from '../src/request';
import { parseEvaluationVerdict } from '../src/verdict';
import { validRegistration, validRequest, validVerdict, validScoredVerdict } from './fixtures';

function admitted() {
  const registration = parseEvaluatorRegistration(validRegistration());
  const request = parseEvaluationRequest(
    validRequest({ registrationDigest: registration.ok ? registration.digest : '0'.repeat(64) }),
  );
  const verdict = parseEvaluationVerdict(
    validVerdict({
      registrationDigest: registration.ok ? registration.digest : '0'.repeat(64),
      requestDigest: request.ok ? request.digest : '0'.repeat(64),
    }),
  );
  if (!registration.ok || !request.ok || !verdict.ok) {
    throw new Error('fixture admission failed');
  }
  return {
    registration: registration.value,
    request: request.value,
    verdict: verdict.value,
  };
}

describe('checkEvaluationRequestConformance', () => {
  it('accepts a conforming request with zero violations', () => {
    const { registration, request } = admitted();
    expect(checkEvaluationRequestConformance(registration, request)).toEqual([]);
  });

  it('rejects a request binding the wrong registration digest', () => {
    const { registration } = admitted();
    const request = parseEvaluationRequest(validRequest());
    if (!request.ok) throw new Error('fixture admission failed');
    const violations = checkEvaluationRequestConformance(registration, request.value);
    expect(violations.some((v) => v.path === 'evaluator.registrationDigest')).toBe(true);
  });

  it('rejects a request targeting a different evaluator id', () => {
    const { registration } = admitted();
    const request = parseEvaluationRequest(
      validRequest({
        registration: validRegistration({ evaluatorId: 'evaluator:other-evaluator' }),
        registrationDigest: evaluatorRegistrationDigest(registration),
      }),
    );
    if (!request.ok) throw new Error('fixture admission failed');
    const violations = checkEvaluationRequestConformance(registration, request.value);
    expect(violations.some((v) => v.path === 'evaluator.evaluatorId')).toBe(true);
  });

  it('rejects a subject kind the evaluator did not declare', () => {
    const { registration, request } = admitted();
    request.subject = { ...request.subject, kind: 'world-outcome' };
    const violations = checkEvaluationRequestConformance(registration, request);
    expect(violations.some((v) => v.path === 'subject.kind')).toBe(true);
  });

  it('rejects undeclared criteria', () => {
    const { registration, request } = admitted();
    request.criteria['undeclared-criterion' as keyof typeof request.criteria] = 1;
    const violations = checkEvaluationRequestConformance(registration, request);
    expect(violations.some((v) => v.path === 'criteria.undeclared-criterion')).toBe(true);
  });

  it('rejects missing required criteria', () => {
    const { registration, request } = admitted();
    delete request.criteria.limit;
    const violations = checkEvaluationRequestConformance(registration, request);
    expect(violations.some((v) => v.path === 'criteria.limit')).toBe(true);
  });

  it('rejects criteria values violating the declared kind', () => {
    const { registration, request } = admitted();
    request.criteria.limit = 'three-hundred-sixty';
    const violations = checkEvaluationRequestConformance(registration, request);
    expect(violations.some((v) => v.path === 'criteria.limit')).toBe(true);
  });

  it('accepts optional criteria being absent', () => {
    const { registration, request } = admitted();
    expect('severity' in request.criteria).toBe(false);
    expect(checkEvaluationRequestConformance(registration, request)).toEqual([]);
  });
});

describe('checkVerdictConformance', () => {
  it('accepts a conforming verdict with zero violations', () => {
    const { registration, request, verdict } = admitted();
    expect(checkVerdictConformance(registration, request, verdict)).toEqual([]);
  });

  it('accepts a conforming scored verdict', () => {
    const registration = parseEvaluatorRegistration(validRegistration());
    if (!registration.ok) throw new Error('fixture admission failed');
    const request = parseEvaluationRequest(
      validRequest({ registrationDigest: registration.digest }),
    );
    const verdict = parseEvaluationVerdict(
      validScoredVerdict({
        registrationDigest: registration.digest,
        requestDigest: request.ok ? request.digest : '0'.repeat(64),
      }),
    );
    if (!request.ok || !verdict.ok) throw new Error('fixture admission failed');
    expect(checkVerdictConformance(registration.value, request.value, verdict.value)).toEqual([]);
  });

  it('rejects a verdict binding the wrong request digest', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(validVerdict());
    if (!verdict.ok) throw new Error('fixture admission failed');
    const violations = checkVerdictConformance(registration, request, verdict.value);
    expect(violations.some((v) => v.path === 'request.requestDigest')).toBe(true);
  });

  it('rejects a verdict whose subject echo does not match the request subject', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(
      validVerdict({
        requestDigest: evaluationRequestDigest(request),
        registrationDigest: evaluatorRegistrationDigest(registration),
      }),
    );
    if (!verdict.ok) throw new Error('fixture admission failed');
    verdict.value.subject = { ...verdict.value.subject, subjectDigest: 'a'.repeat(64) };
    const violations = checkVerdictConformance(registration, request, verdict.value);
    expect(violations.some((v) => v.path === 'subject')).toBe(true);
  });

  it('rejects an undeclared verdict form', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(
      validScoredVerdict({
        registrationDigest: evaluatorRegistrationDigest(registration),
        requestDigest: evaluationRequestDigest(request),
      }),
    );
    if (!verdict.ok) throw new Error('fixture admission failed');
    // Registration declares both forms; drop 'scored' to make it undeclared.
    const narrowed: typeof registration = { ...registration, verdictForms: ['pass-fail'] };
    const violations = checkVerdictConformance(narrowed, request, verdict.value);
    expect(violations.some((v) => v.path === 'outcome.verdictForm')).toBe(true);
  });

  it('rejects a determinism claim contradicting the registration', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(
      validVerdict({
        requestDigest: evaluationRequestDigest(request),
        registrationDigest: evaluatorRegistrationDigest(registration),
      }),
    );
    if (!verdict.ok) throw new Error('fixture admission failed');
    verdict.value.deterministic = false;
    const violations = checkVerdictConformance(registration, request, verdict.value);
    expect(violations.some((v) => v.path === 'deterministic')).toBe(true);
  });

  it('rejects criterion justifications that do not resolve against the request', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(
      validVerdict({
        requestDigest: evaluationRequestDigest(request),
        registrationDigest: evaluatorRegistrationDigest(registration),
      }),
    );
    if (!verdict.ok) throw new Error('fixture admission failed');
    verdict.value.justification = [
      { kind: 'criterion', reference: 'nonexistent-criterion', statement: 'Judged.' },
    ];
    const violations = checkVerdictConformance(registration, request, verdict.value);
    expect(violations.some((v) => v.path === 'justification.0')).toBe(true);
  });

  it('accepts non-criterion justifications without request resolution', () => {
    const { registration, request } = admitted();
    const verdict = parseEvaluationVerdict(
      validVerdict({
        requestDigest: evaluationRequestDigest(request),
        registrationDigest: evaluatorRegistrationDigest(registration),
      }),
    );
    if (!verdict.ok) throw new Error('fixture admission failed');
    verdict.value.justification = [
      { kind: 'method', reference: 'any-method', statement: 'Compared directly.' },
    ];
    expect(checkVerdictConformance(registration, request, verdict.value)).toEqual([]);
  });
});

describe('valueConformsToSpec', () => {
  it('classifies parameter kinds correctly (mirrored semantics)', () => {
    const enumeration = {
      name: 'severity',
      kind: 'enum' as const,
      required: true,
      description: '',
      enumValues: ['normal', 'aggravated'],
    };
    expect(valueConformsToSpec('normal', enumeration)).toBe(true);
    expect(valueConformsToSpec('extreme', enumeration)).toBe(false);
    expect(valueConformsToSpec(3, { name: 'n', kind: 'integer', required: true, description: '' })).toBe(true);
    expect(valueConformsToSpec(3.5, { name: 'n', kind: 'integer', required: true, description: '' })).toBe(false);
  });
});
