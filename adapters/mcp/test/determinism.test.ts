// Determinism + replay evidence (acceptance: identical inputs -> identical digests).
import { describe, expect, it } from 'vitest';
import {
  buildInvocationProposal,
  catalogDigestOf,
  deriveToolRegistration,
  discoverTools,
  parseProviderCatalog,
  referenceCatalog,
  verifyInvocationRecord,
} from '../src/index';
import { TENANT_A, T0, T1, DEADLINE, adapterSetup, allowingContext, pinFor, registryWithAdapter, PRINCIPAL } from './helpers';

describe('determinism', () => {
  it('the same catalog content always produces the same discovery digests', () => {
    const first = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    const second = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    if (!first.ok || !second.ok) throw new Error('discovery failed');
    expect(first.value.map((surface) => surface.surfaceDigest)).toEqual(
      second.value.map((surface) => surface.surfaceDigest),
    );
    expect(first.value.map((surface) => surface.sourceDigest)).toEqual(
      second.value.map((surface) => surface.sourceDigest),
    );
  });

  it('provider row order never leaks (surfaces sort by toolRef)', () => {
    const parsed = parseProviderCatalog(referenceCatalog());
    if (!parsed.success) throw new Error('fixture parse failed');
    const reordered = { ...parsed.data, tools: [...parsed.data.tools].reverse() };
    const a = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    const b = discoverTools({ tenantId: TENANT_A, payload: reordered });
    if (!a.ok || !b.ok) throw new Error('discovery failed');
    expect(a.value.map((surface) => surface.toolRef)).toEqual(b.value.map((surface) => surface.toolRef));
    // The catalog digests differ (row order is content) but every surface
    // maps to the SAME typed invocation surface.
    expect(catalogDigestOf(parsed.data)).not.toBe(catalogDigestOf(reordered));
    expect(a.value.map((surface) => surface.inputArguments)).toEqual(
      b.value.map((surface) => surface.inputArguments),
    );
  });

  it('identical invocation inputs derive byte-identical proposals (content-derived ids)', () => {
    const base = {
      tenantId: TENANT_A,
      toolRef: 'tool:terrain-elevation-lookup',
      actionId: 'action:fixture-invocation',
      arguments: { latitude: 52.5, longitude: 13.4 } as Record<string, number>,
      proposedAt: T1,
    };
    const first = buildInvocationProposal(base);
    const second = buildInvocationProposal(base);
    expect(first.planDigest).toBe(second.planDigest);
    expect(first.proposalRef.canonicalDigest).toBe(second.proposalRef.canonicalDigest);
    expect(first.proposal.proposalId).toBe(second.proposal.proposalId);
  });

  it('different arguments derive different proposals', () => {
    const base = {
      tenantId: TENANT_A,
      toolRef: 'tool:terrain-elevation-lookup',
      actionId: 'action:fixture-invocation',
      proposedAt: T1,
    };
    const first = buildInvocationProposal({ ...base, arguments: { latitude: 52.5, longitude: 13.4 } });
    const second = buildInvocationProposal({ ...base, arguments: { latitude: 48.8, longitude: 2.3 } });
    expect(first.planDigest).not.toBe(second.planDigest);
  });

  it('identical routed invocations produce identical content digests (independent gateways)', () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    const route = {
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:determinism',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    } as const;
    const a = setupA.action.route(route);
    const b = setupB.action.route(route);
    if (!a.ok || !b.ok) throw new Error('routing failed');
    expect(a.value.contentDigest).toBe(b.value.contentDigest);
    expect(a.value.invocationId).toBe(b.value.invocationId);
    expect(verifyInvocationRecord(a.value)).toBe(true);
  });

  it('the W007 action envelope is deterministic across independent invocations', async () => {
    const setupA = adapterSetup();
    const setupB = adapterSetup();
    const registry = registryWithAdapter();
    const pinA = pinFor(setupA.action, registry);
    const pinB = pinFor(setupB.action, registry);
    const parameters = {
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      'decided-at': T0,
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
    };
    const request = {
      schemaVersion: 1 as const,
      category: 'action' as const,
      binding: pinA,
      payload: {
        target: { kind: 'external-resource' as const, ref: 'tool:terrain-elevation-lookup' },
        parameters,
      },
    };
    const a = await setupA.action.invoke({ ...request, binding: pinA });
    const b = await setupB.action.invoke({ ...request, binding: pinB });
    expect(a.payload).toEqual(b.payload);
  });

  it('evaluation is deterministic for identical (subject, criteria)', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:eval-determinism',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const criteria = { 'expected-disposition': 'authority-pending-approval' as const };
    const a = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria,
    });
    const b = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria,
    });
    if (!a.ok || !b.ok) throw new Error('evaluation failed');
    expect(a.value.evaluationDigest).toBe(b.value.evaluationDigest);
  });

  it('per-tool registration derivation is deterministic', () => {
    const first = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    const second = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    if (!first.ok || !second.ok) throw new Error('discovery failed');
    expect(deriveToolRegistration(first.value[0]!).digest).toBe(
      deriveToolRegistration(second.value[0]!).digest,
    );
  });
});
