/**
 * @epoch/adapter-mcp — the evaluator surface: judging recorded tool
 * invocations against declared criteria.
 *
 * Evaluation is distinct from execution (architecture lock rule 6):
 * this surface JUDGES recorded invocation outcomes — it never routes,
 * never executes, and never forms authority. Every verdict carries
 * MANDATORY justification (the W005 evaluation conventions: judgment
 * without justification is inexpressible), referencing the criteria and
 * the subject's own records.
 */
import { canonicalDigest, type Sha256Hex } from '@epoch/agent-protocol';
import type { JustificationReference } from '@epoch/adapter-sdk';
import type { TenantId } from '@epoch/tenancy';
import type { InvocationCriteria, InvocationEvaluation, ToolInvocationRecord } from './types';
import type { McpAdapterResult } from './errors';
import { MCP_ADAPTER_RECORD_VERSION } from './version';

/** Input of {@link evaluateInvocation}. */
export interface EvaluationInput {
  readonly tenantId: TenantId;
  /** The subject: a recorded tool invocation (by id + exact digest). */
  readonly subjectId: string;
  readonly subjectDigest: Sha256Hex;
  readonly criteria: InvocationCriteria;
}

/**
 * Evaluate one recorded tool invocation against the declared criteria
 * (deterministic, content-addressed):
 *
 * - the subject must exist in the invocation store (else the typed
 *   `validation` error) and its claimed digest must match the record's
 *   content address (else the typed `digest-mismatch` — a tampered
 *   subject is never silently judged);
 * - the verdict is pass-fail: every declared criterion is checked;
 * - the justification is MANDATORY and references each criterion and
 *   the subject's authority records.
 */
export function evaluateInvocation(
  input: EvaluationInput,
  store: ReadonlyMap<string, ToolInvocationRecord>,
): McpAdapterResult<InvocationEvaluation> {
  const record = store.get(input.subjectId);
  if (record === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `no recorded tool invocation with subject id "${input.subjectId}"`,
        issues: [{ path: '$.subjectId', message: 'unknown evaluation subject' }],
      },
    };
  }
  if (record.tenantId !== input.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `the evaluation subject belongs to tenant "${record.tenantId}" — the evaluation named tenant "${input.tenantId}"`,
        expectedTenantId: record.tenantId,
        encounteredTenantId: input.tenantId,
      },
    };
  }
  if (record.contentDigest !== input.subjectDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'the evaluation subject digest does not match the recorded invocation (tampered subject)',
        expected: record.contentDigest,
        encountered: input.subjectDigest,
      },
    };
  }

  const justification: JustificationReference[] = [];
  let passed = true;

  if (record.disposition !== input.criteria['expected-disposition']) {
    passed = false;
    justification.push({
      kind: 'criterion',
      reference: 'expected-disposition',
      statement: `FAIL: the recorded invocation disposition is "${record.disposition}", the criterion expects "${input.criteria['expected-disposition']}".`,
    });
  } else {
    justification.push({
      kind: 'criterion',
      reference: 'expected-disposition',
      statement: `PASS: the recorded invocation disposition is "${record.disposition}", matching the criterion.`,
    });
  }

  if (input.criteria['require-evidence'] === true) {
    const hasEvidence =
      record.outcome !== undefined && record.outcome.evidenceRefs.length > 0;
    if (!hasEvidence) {
      passed = false;
      justification.push({
        kind: 'criterion',
        reference: 'require-evidence',
        statement: 'FAIL: the criterion requires authority-recorded evidence references; the invocation carries none.',
      });
    } else {
      justification.push({
        kind: 'subject-output',
        reference: 'outcome.evidenceRefs',
        statement: `PASS: the invocation outcome carries ${record.outcome.evidenceRefs.length} evidence reference(s).`,
      });
    }
  }

  justification.push({
    kind: 'subject-output',
    reference: 'decision.outcome',
    statement: `The action authority decision outcome was "${record.decision.outcome}" (sealed decision ${record.decision.decisionDigest}).`,
  });

  const content = {
    schemaVersion: MCP_ADAPTER_RECORD_VERSION,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    subjectDigest: input.subjectDigest,
    verdict: {
      verdictForm: 'pass-fail' as const,
      outcome: passed ? ('pass' as const) : ('fail' as const),
    },
    justification,
  };
  return {
    ok: true,
    value: { ...content, evaluationDigest: canonicalDigest(content as unknown as import('@epoch/agent-protocol').JsonValue) },
  };
}
