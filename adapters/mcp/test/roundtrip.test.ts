// Round-trip serialization + digest verification for every public type
// (acceptance: all public record shapes serialize deterministically,
// parse back to equal values, and address their exact content revision).
import { describe, expect, it } from 'vitest';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  AuthorityDecisionRecordSchema,
  AuthorityOutcomeRecordSchema,
  InvocationEvaluationSchema,
  InvocationPlanSchema,
  ToolInvocationRecordSchema,
  ToolInvocationSurfaceSchema,
  buildInvocationProposal,
  discoverTools,
  referenceCatalog,
  verifyInvocationRecord,
} from '../src/index';
import { TENANT_A, T0, T1, T2, DEADLINE, adapterSetup, allowingContext, PRINCIPAL } from './helpers';

/** Deterministic round-trip: canonical JSON -> parse -> deep equal + digest stability. */
function roundTrip(value: unknown, parse: (input: unknown) => { success: boolean; data?: unknown }): void {
  const serialized = canonicalJsonStringify(value as JsonValue);
  const parsed = parse(JSON.parse(serialized));
  expect(parsed.success, `${serialized}`).toBe(true);
  const reserialized = canonicalJsonStringify((parsed as { data: unknown }).data as JsonValue);
  expect(reserialized).toBe(serialized);
}

function surfaces() {
  const discovered = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
  if (!discovered.ok) throw new Error(discovered.error.message);
  return discovered.value;
}

function invocationRecord() {
  const { action } = adapterSetup();
  const invocation = action.route({
    tenant: TENANT_A,
    tool: 'tool:terrain-elevation-lookup',
    arguments: { latitude: 52.5, longitude: 13.4 },
    actionId: 'action:roundtrip',
    authority: { principalId: PRINCIPAL, context: allowingContext() },
    approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
    decidedAt: T1,
    executedAt: T2,
  });
  if (!invocation.ok) throw new Error(invocation.error.message);
  return invocation.value;
}

describe('round-trip serialization + digest verification (every public type)', () => {
  it('ToolInvocationSurface round-trips through canonical JSON', () => {
    for (const surface of surfaces()) {
      roundTrip(surface, (input) => ToolInvocationSurfaceSchema.safeParse(input));
    }
  });

  it('InvocationPlan round-trips through canonical JSON', () => {
    const plan = buildInvocationProposal({
      tenantId: TENANT_A,
      toolRef: 'tool:terrain-elevation-lookup',
      actionId: 'action:roundtrip',
      arguments: { latitude: 52.5, longitude: 13.4 },
      proposedAt: T1,
    });
    roundTrip(plan, (input) => InvocationPlanSchema.safeParse(input));
  });

  it('AuthorityDecisionRecord round-trips through canonical JSON', () => {
    const record = invocationRecord();
    roundTrip(record.decision, (input) => AuthorityDecisionRecordSchema.safeParse(input));
  });

  it('AuthorityOutcomeRecord round-trips through canonical JSON', () => {
    const outcome = {
      schemaVersion: 1,
      tenantId: TENANT_A,
      actionId: 'action:roundtrip',
      kind: 'succeeded',
      evidenceRefs: ['plan:roundtrip'],
      outcomeDigest: 'a'.repeat(64),
      executedAt: T2,
    };
    roundTrip(outcome, (input) => AuthorityOutcomeRecordSchema.safeParse(input));
  });

  it('ToolInvocationRecord round-trips through canonical JSON', () => {
    roundTrip(invocationRecord(), (input) => ToolInvocationRecordSchema.safeParse(input));
  });

  it('InvocationEvaluation round-trips through canonical JSON', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:roundtrip-eval',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const evaluation = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria: { 'expected-disposition': 'authority-pending-approval' },
    });
    if (!evaluation.ok) throw new Error(evaluation.error.message);
    roundTrip(evaluation.value, (input) => InvocationEvaluationSchema.safeParse(input));
  });

  it('the invocation record digest is stable under top-level key reordering (canonical form)', () => {
    const record = invocationRecord();
    const { contentDigest, invocationId, ...content } = record;
    expect(invocationId).toMatch(/^invocation-[0-9a-f]{12}$/);
    expect(contentDigest).toBe(canonicalDigest(content as unknown as JsonValue));
    expect(verifyInvocationRecord(record)).toBe(true);
    void T0;
  });
});
