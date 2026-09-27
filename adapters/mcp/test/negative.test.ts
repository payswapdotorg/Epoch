// Negative evidence (acceptance: typed rejections for every failure class).
import { describe, expect, it } from 'vitest';
import {
  McpActionAdapter,
  discoverTools,
  malformedCatalog,
  referenceCatalog,
  verifyInvocationRecord,
  type ActionAuthorityPort,
  type ActionAuthoritySubmission,
  type ActionAuthorityExecutionRequest,
} from '../src/index';
import {
  TENANT_A,
  TENANT_B,
  T0,
  T1,
  DEADLINE,
  adapterSetup,
  allowingContext,
  pinFor,
  referenceSurfaces,
  registryWithAdapter,
  PRINCIPAL,
} from './helpers';

describe('negative: tenant isolation (R12)', () => {
  it('a cross-tenant invocation through the domain surface is the typed tenant-isolation-rejected', () => {
    const { action } = adapterSetup();
    const result = action.route({
      tenant: TENANT_B,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:cross-tenant',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant invocation through the W007 envelope is the typed tenant-isolation-rejected', () => {
    const { action } = adapterSetup();
    const pin = pinFor(action, registryWithAdapter());
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'action',
      binding: pin,
      payload: {
        target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
        parameters: {
          tenant: TENANT_B,
          tool: 'tool:terrain-elevation-lookup',
          arguments: { latitude: 52.5, longitude: 13.4 },
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });

  it('a cross-tenant evaluation subject is the typed tenant-isolation-rejected', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:eval-cross',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const evaluation = evaluator.judge({
      tenant: TENANT_B,
      subjectId: invocation.value.invocationId,
      subjectDigest: invocation.value.contentDigest,
      criteria: { 'expected-disposition': 'executed' },
    });
    expect(evaluation.ok).toBe(false);
    if (evaluation.ok || evaluation.error.code !== 'tenant-isolation-rejected') throw new Error('unexpected outcome');
  });
});

describe('negative: unknown provider payloads', () => {
  it('a malformed catalog is the typed unknown-provider-payload (never a partial load)', () => {
    const result = discoverTools({ tenantId: TENANT_A, payload: malformedCatalog() });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'unknown-provider-payload') throw new Error('unexpected outcome');
    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});

describe('negative: the adapter holds NO credentials', () => {
  it('invocation parameters carrying a token key are the typed credential-rejected BEFORE any proposal', () => {
    const { action } = adapterSetup();
    const result = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4, token: 'secret-value' },
      actionId: 'action:credential-attempt',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'credential-rejected') throw new Error('unexpected outcome');
    expect(result.error.offendingKeys).toEqual(['token']);
  });

  it('credential-shaped keys of every family are rejected (api-key, password, secret)', () => {
    const { action } = adapterSetup();
    for (const key of ['api-key', 'password', 'secret', 'Authorization'.toLowerCase()]) {
      const result = action.route({
        tenant: TENANT_A,
        tool: 'tool:unit-convert',
        arguments: { value: 1, unit_from: 'm', unit_to: 'mm', [key]: 'x' },
        actionId: 'action:credential-sweep',
        authority: { principalId: PRINCIPAL, context: allowingContext() },
        decidedAt: T1,
        executedAt: T1,
      });
      expect(result.ok, `key "${key}" must be rejected`).toBe(false);
      if (!result.ok && result.error.code === 'credential-rejected') {
        expect(result.error.offendingKeys).toContain(key);
      } else if (result.ok) {
        throw new Error('unreachable');
      }
    }
  });
});

describe('negative: gateway bypass', () => {
  const bypassPort: ActionAuthorityPort = {
    submitAction(request: ActionAuthoritySubmission) {
      void request;
      throw new Error('the authority must never be called in the bypass test');
    },
    executeAction(request: ActionAuthorityExecutionRequest) {
      void request;
      throw new Error('the authority must never be called in the bypass test');
    },
  };

  it('an execute-direct request is the typed gateway-bypass-rejected (the authority is never called)', () => {
    const action = new McpActionAdapter({
      surfaces: referenceSurfaces(),
      authority: bypassPort,
      expectedTenantId: TENANT_A,
    });
    const pin = pinFor(action, registryWithAdapter());
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'action',
      binding: pin,
      payload: {
        target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
        parameters: {
          tenant: TENANT_A,
          tool: 'tool:terrain-elevation-lookup',
          arguments: { latitude: 52.5, longitude: 13.4 },
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
          mode: 'execute-direct',
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'gateway-bypass-rejected') throw new Error('unexpected outcome');
    expect(result.error.attemptedMode).toBe('execute-direct');
  });
});

describe('negative: tool-argument conformance', () => {
  it('arguments that do not conform to the declared surface are the typed tool-argument-rejected', () => {
    const { action } = adapterSetup();
    const result = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 'not-a-number', longitude: 13.4 },
      actionId: 'action:bad-arguments',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tool-argument-rejected') throw new Error('unexpected outcome');
    expect(result.error.issues[0]?.path).toBe('$.arguments.latitude');
  });

  it('missing required arguments are the typed tool-argument-rejected', () => {
    const { action } = adapterSetup();
    const result = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5 },
      actionId: 'action:missing-argument',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'tool-argument-rejected') throw new Error('unexpected outcome');
  });

  it('an undiscovered tool reference is the typed validation error', () => {
    const { action } = adapterSetup();
    const result = action.route({
      tenant: TENANT_A,
      tool: 'tool:never-discovered',
      arguments: {},
      actionId: 'action:unknown-tool',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
    expect(result.error.issues[0]?.path).toBe('$.tool');
  });
});

describe('negative: tampered evaluation subjects', () => {
  it('a subject digest that does not match the record is the typed digest-mismatch', () => {
    const { action, evaluator } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:tampered-subject',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const evaluation = evaluator.judge({
      tenant: TENANT_A,
      subjectId: invocation.value.invocationId,
      subjectDigest: '0'.repeat(64),
      criteria: { 'expected-disposition': 'executed' },
    });
    expect(evaluation.ok).toBe(false);
    if (evaluation.ok || evaluation.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
  });

  it('an unknown evaluation subject is the typed validation error', () => {
    const { evaluator } = adapterSetup();
    const evaluation = evaluator.judge({
      tenant: TENANT_A,
      subjectId: 'invocation-000000000000',
      subjectDigest: 'a'.repeat(64),
      criteria: { 'expected-disposition': 'executed' },
    });
    expect(evaluation.ok).toBe(false);
    if (evaluation.ok || evaluation.error.code !== 'validation') throw new Error('unexpected outcome');
  });
});

describe('negative: discovery tamper detection', () => {
  it('a claimed digest that does not match the catalog content is the typed digest-mismatch', () => {
    const result = discoverTools({
      tenantId: TENANT_A,
      payload: referenceCatalog(),
      claimedDigest: '0'.repeat(64),
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'digest-mismatch') throw new Error('unexpected outcome');
  });
});

describe('negative: binding conflicts', () => {
  it('an envelope bound to another adapter revision is the typed binding-conflict', () => {
    const { action } = adapterSetup();
    const pin = pinFor(action, registryWithAdapter());
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'action',
      binding: { ...pin, adapterDescriptorDigest: 'f'.repeat(64) },
      payload: {
        target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
        parameters: {
          tenant: TENANT_A,
          tool: 'tool:terrain-elevation-lookup',
          arguments: { latitude: 52.5, longitude: 13.4 },
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });

  it('an envelope targeting the wrong category is the typed binding-conflict', () => {
    const { action } = adapterSetup();
    const pin = pinFor(action, registryWithAdapter());
    // The envelope must be structurally VALID for the OTHER category (an
    // evaluator payload), carrying THIS surface's binding pin — the
    // category mismatch is then the typed binding-conflict.
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'evaluator',
      binding: pin,
      payload: {
        subject: {
          kind: 'world-outcome',
          subjectId: 'invocation-000000000000',
          subjectDigest: 'a'.repeat(64),
        },
        criteria: { tenant: TENANT_A, 'expected-disposition': 'executed' },
      },
    } as unknown as Parameters<typeof action.invokeTotal>[0]);
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'binding-conflict') throw new Error('unexpected outcome');
  });

  it('a routing without the approval directive surfaces the authority typed error (never a silent pass)', () => {
    const { action } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:no-approval-directive',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
      executedAt: T1,
    });
    expect(invocation.ok).toBe(false);
    if (invocation.ok || invocation.error.code !== 'authority-unavailable') throw new Error('unexpected outcome');
  });
});

describe('negative: envelope validation', () => {
  it('malformed neutral parameters are the typed validation error with precise paths', () => {
    const { action } = adapterSetup();
    const pin = pinFor(action, registryWithAdapter());
    const result = action.invokeTotal({
      schemaVersion: 1,
      category: 'action',
      binding: pin,
      payload: {
        target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
        parameters: {
          tenant: TENANT_A,
          tool: 'not-a-tool-ref',
          arguments: {},
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T0,
        },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'validation') throw new Error('unexpected outcome');
  });

  it('a tampered invocation record is detected by digest verification', () => {
    const { action } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:tampered-record',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const tampered = {
      ...invocation.value,
      arguments: { latitude: 0, longitude: 0 },
    };
    expect(verifyInvocationRecord(tampered)).toBe(false);
  });
});
