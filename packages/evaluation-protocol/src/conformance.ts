/**
 * Cross-document conformance checks for the evaluation protocol.
 *
 * Schema admission validates one message in isolation; these helpers
 * verify the *bindings between* documents — the exact-revision evidence
 * chain a consumer must enforce before trusting a verdict:
 *
 * - the evaluation request really targets the registered evaluator at
 *   the exact registration revision (digest match) and judges a subject
 *   kind the evaluator declared;
 * - the request criteria really satisfy the declared criteria contract
 *   (declared names, required presence, value kinds);
 * - the verdict really binds to the request and registration revisions,
 *   echoes the request's subject, produces only declared verdict forms,
 *   mirrors the registration's determinism claim, and justifies itself
 *   with references that resolve against the request's criteria.
 *
 * All checks are pure and return typed violations; none of them execute
 * anything and none of them read the subject payload — judgment inputs
 * are supplied by the evaluator runtime, not by these checks.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { ParameterSpec } from '@epoch/agent-protocol';
import type { EvaluatorRegistration } from './registration';
import type { EvaluationRequest } from './request';
import type { EvaluationVerdict } from './verdict';

/** One typed conformance violation (dotted path + message). */
export interface ConformanceViolation {
  readonly path: string;
  readonly message: string;
}

/** Does a JSON value satisfy a declared parameter spec's kind? */
export function valueConformsToSpec(value: JsonValue, spec: ParameterSpec): boolean {
  switch (spec.kind) {
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && (spec.enumValues ?? []).includes(value);
    case 'entity-reference':
      return typeof value === 'string';
    case 'json':
      return true;
  }
}

function specByName(specs: readonly ParameterSpec[], name: string): ParameterSpec | undefined {
  return specs.find((spec) => spec.name === name);
}

/**
 * Canonical digest of an admitted evaluator registration (recomputed
 * from the canonical JSON form — the same digest the admission pipeline
 * produced).
 */
export function evaluatorRegistrationDigest(registration: EvaluatorRegistration): string {
  return canonicalDigest(registration as unknown as JsonValue);
}

/**
 * Canonical digest of an admitted evaluation request.
 */
export function evaluationRequestDigest(request: EvaluationRequest): string {
  return canonicalDigest(request as unknown as JsonValue);
}

/**
 * Check an admitted evaluation request against the registration it
 * targets. Returns the list of violations (empty = conforming).
 */
export function checkEvaluationRequestConformance(
  registration: EvaluatorRegistration,
  request: EvaluationRequest,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (request.evaluator.evaluatorId !== registration.evaluatorId) {
    violations.push({
      path: 'evaluator.evaluatorId',
      message: `request targets evaluator "${request.evaluator.evaluatorId}" but the registration declares "${registration.evaluatorId}"`,
    });
  }

  const expectedDigest = evaluatorRegistrationDigest(registration);
  if (request.evaluator.registrationDigest !== expectedDigest) {
    violations.push({
      path: 'evaluator.registrationDigest',
      message: `request binds registration digest ${request.evaluator.registrationDigest} but the registration's canonical digest is ${expectedDigest}`,
    });
  }

  if (!registration.subjectKinds.includes(request.subject.kind)) {
    violations.push({
      path: 'subject.kind',
      message: `registration does not declare judgment of "${request.subject.kind}" subjects`,
    });
  }

  for (const [name, value] of Object.entries(request.criteria)) {
    const spec = specByName(registration.criteria, name);
    if (spec === undefined) {
      violations.push({
        path: `criteria.${name}`,
        message: `criterion "${name}" is not declared by the registration`,
      });
      continue;
    }
    if (!valueConformsToSpec(value, spec)) {
      violations.push({
        path: `criteria.${name}`,
        message: `criterion "${name}" does not conform to declared kind "${spec.kind}"`,
      });
    }
  }

  for (const spec of registration.criteria) {
    if (spec.required && !(spec.name in request.criteria)) {
      violations.push({
        path: `criteria.${spec.name}`,
        message: `required criterion "${spec.name}" is missing from the request`,
      });
    }
  }

  return violations;
}

/**
 * Check an admitted evaluation verdict against the registration and the
 * evaluation request it claims to answer. Returns the list of violations
 * (empty = conforming).
 */
export function checkVerdictConformance(
  registration: EvaluatorRegistration,
  request: EvaluationRequest,
  verdict: EvaluationVerdict,
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];

  if (verdict.request.requestId !== request.requestId) {
    violations.push({
      path: 'request.requestId',
      message: `verdict claims request "${verdict.request.requestId}" but was checked against request "${request.requestId}"`,
    });
  }

  const expectedRequestDigest = evaluationRequestDigest(request);
  if (verdict.request.requestDigest !== expectedRequestDigest) {
    violations.push({
      path: 'request.requestDigest',
      message: `verdict binds request digest ${verdict.request.requestDigest} but the request's canonical digest is ${expectedRequestDigest}`,
    });
  }

  if (verdict.evaluator.evaluatorId !== registration.evaluatorId) {
    violations.push({
      path: 'evaluator.evaluatorId',
      message: `verdict claims evaluator "${verdict.evaluator.evaluatorId}" but the registration declares "${registration.evaluatorId}"`,
    });
  }

  const expectedRegistrationDigest = evaluatorRegistrationDigest(registration);
  if (verdict.evaluator.registrationDigest !== expectedRegistrationDigest) {
    violations.push({
      path: 'evaluator.registrationDigest',
      message: `verdict binds registration digest ${verdict.evaluator.registrationDigest} but the registration's canonical digest is ${expectedRegistrationDigest}`,
    });
  }

  if (
    verdict.subject.kind !== request.subject.kind ||
    verdict.subject.subjectId !== request.subject.subjectId ||
    verdict.subject.subjectDigest !== request.subject.subjectDigest
  ) {
    violations.push({
      path: 'subject',
      message: 'verdict subject echo does not match the judged request subject',
    });
  }

  if (!registration.verdictForms.includes(verdict.outcome.verdictForm)) {
    violations.push({
      path: 'outcome.verdictForm',
      message: `registration does not declare "${verdict.outcome.verdictForm}" verdicts`,
    });
  }

  if (verdict.deterministic !== registration.deterministic) {
    violations.push({
      path: 'deterministic',
      message: `verdict claims deterministic=${verdict.deterministic} but the registration declares deterministic=${registration.deterministic}`,
    });
  }

  for (const [index, justification] of verdict.justification.entries()) {
    if (justification.kind === 'criterion' && !(justification.reference in request.criteria)) {
      violations.push({
        path: `justification.${index}`,
        message: `criterion justification references "${justification.reference}" which is not a criterion of the request`,
      });
    }
  }

  return violations;
}
