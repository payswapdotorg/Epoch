// Positive evidence (acceptance: discovery -> typed surfaces; invocation
// -> authority-routed records; evaluation -> justified verdicts).
import { describe, expect, it } from 'vitest';
import {
  deriveToolRegistration,
  discoverTools,
  referenceCatalog,
  verifyInvocationRecord,
} from '../src/index';
import { TENANT_A, T1, T2, DEADLINE, adapterSetup, allowingContext, PRINCIPAL } from './helpers';

describe('tool discovery (positive)', () => {
  it('derives typed invocation surfaces from a provider catalog (sorted, content-addressed)', () => {
    const discovered = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) throw new Error(discovered.error.message);
    const surfaces = discovered.value;
    expect(surfaces.length).toBe(2);
    expect(surfaces.map((surface) => surface.toolRef)).toEqual([
      'tool:terrain-elevation-lookup',
      'tool:unit-convert',
    ]);
    for (const surface of surfaces) {
      expect(surface.tenantId).toBe(TENANT_A);
      expect(surface.capabilityId).toMatch(/^tool\./);
      expect(surface.surfaceDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(surface.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(surface.inputArguments.length).toBeGreaterThan(0);
    }
  });

  it('per-tool W007 registration documents are derived deterministically (action category)', () => {
    const discovered = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    if (!discovered.ok) throw new Error(discovered.error.message);
    const registration = deriveToolRegistration(discovered.value[0]!);
    expect(registration.manifest.category).toBe('action');
    expect(registration.manifest.capabilityId).toBe('tool.terrain-elevation-lookup');
    expect(registration.manifest.trust.origin).toBe('external-software');
    expect(registration.digest).toMatch(/^[0-9a-f]{64}$/);
    const again = deriveToolRegistration(discovered.value[0]!);
    expect(again.digest).toBe(registration.digest);
  });
});

describe('tool invocation (positive)', () => {
  it('routes an invocation through the authority seam (requires approval first)', () => {
    const { action } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:terrain-first',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    expect(invocation.ok).toBe(true);
    if (!invocation.ok) throw new Error(invocation.error.message);
    const record = invocation.value;
    expect(record.tenantId).toBe(TENANT_A);
    expect(record.toolRef).toBe('tool:terrain-elevation-lookup');
    expect(record.decision.outcome).toBe('requires-approval');
    expect(record.disposition).toBe('authority-pending-approval');
    expect(record.decision.decisionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(record.invocationId).toMatch(/^invocation-[0-9a-f]{12}$/);
    expect(verifyInvocationRecord(record)).toBe(true);
  });

  it('the invocation record is retrievable as an evaluation subject', () => {
    const { action } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:unit-convert',
      arguments: { value: 1000, unit_from: 'm', unit_to: 'mm' },
      actionId: 'action:unit-convert-first',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    expect(action.invocationStore().get(invocation.value.invocationId)).toBeDefined();
  });
});

describe('tool outcome evaluation (positive)', () => {
  it('judges a recorded invocation against the declared criteria with mandatory justification', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:eval-subject',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const evaluation = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria: { 'expected-disposition': 'authority-pending-approval' },
    });
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) throw new Error(evaluation.error.message);
    const verdict = evaluation.value;
    expect(verdict.verdict.verdictForm).toBe('pass-fail');
    if (verdict.verdict.verdictForm !== 'pass-fail') throw new Error('unreachable');
    expect(verdict.verdict.outcome).toBe('pass');
    expect(verdict.justification.length).toBeGreaterThanOrEqual(2);
    expect(verdict.justification[0]?.kind).toBe('criterion');
    expect(verdict.evaluationDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a failing criterion yields a fail verdict with a FAIL justification statement', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:eval-fail-subject',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const evaluation = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria: { 'expected-disposition': 'executed', 'require-evidence': true },
    });
    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) throw new Error(evaluation.error.message);
    if (evaluation.value.verdict.verdictForm !== 'pass-fail') throw new Error('unreachable');
    expect(evaluation.value.verdict.outcome).toBe('fail');
    expect(evaluation.value.justification.some((entry) => entry.statement.startsWith('FAIL'))).toBe(true);
  });
});
