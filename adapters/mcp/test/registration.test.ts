// W007 registration + binding + invocation evidence (acceptance: the
// adapter registers through the W007 conventions under its categories;
// tool discovery feeds per-tool action-category registrations).
import { describe, expect, it } from 'vitest';
import { computeCapabilityManifestDigest, sealCapabilityManifest } from '@epoch/capability-registry';
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  MCP_ADAPTER_DESCRIPTORS,
  ACTION_ADAPTER_DESCRIPTOR,
  EVALUATOR_ADAPTER_DESCRIPTOR,
  deriveCapabilityRegistrations,
  deriveToolRegistration,
  discoverTools,
  referenceCatalog,
} from '../src/index';
import {
  TENANT_A,
  T0,
  T1,
  DEADLINE,
  adapterSetup,
  allowingContext,
  pinFor,
  registryWithAdapter,
  PRINCIPAL,
} from './helpers';

describe('W007 registration (the REAL registry, devDependency parity)', () => {
  it('derives both category registrations (action + evaluator) with correct categories', () => {
    const registrations = deriveCapabilityRegistrations();
    expect(registrations.map((registration) => registration.manifest.category).sort()).toEqual([
      'action',
      'evaluator',
    ]);
  });

  it('the derived digest equals the REAL registry manifest digest', () => {
    for (const registration of deriveCapabilityRegistrations()) {
      expect(registration.digest).toBe(computeCapabilityManifestDigest(registration.manifest));
    }
  });

  it('the REAL registry admits every derived registration under its category', () => {
    const registry = registryWithAdapter();
    const records = registry.list();
    expect(records.length).toBe(2);
    expect(records.filter((record) => record.manifest.category === 'action').length).toBe(1);
    expect(records.filter((record) => record.manifest.category === 'evaluator').length).toBe(1);
    for (const record of records) {
      expect(record.manifest.trust.origin).toBe('external-software');
      expect(record.lifecycle).toBe('registered');
    }
  });

  it('the REAL SDK negotiates the binding for both adapter descriptors', () => {
    const registry = registryWithAdapter();
    for (const descriptor of MCP_ADAPTER_DESCRIPTORS) {
      const record = registry
        .list({ category: descriptor.category })
        .find((entry) => entry.manifest.capabilityId === descriptor.binding.capabilityId);
      expect(record).toBeDefined();
      const negotiated = negotiateBinding(descriptor, record!);
      expect(negotiated.ok).toBe(true);
      if (negotiated.ok) {
        expect(negotiated.value.adapterId).toBe(descriptor.adapterId);
        expect(negotiated.value.capabilityId).toBe(descriptor.binding.capabilityId);
        expect(negotiated.value.manifestDigest).toBe(record!.manifestDigest);
      }
    }
  });

  it('per-tool registrations (from discovery) are admitted by the REAL registry under the action category', () => {
    const registry = registryWithAdapter();
    const surfaces = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
    if (!surfaces.ok) throw new Error(surfaces.error.message);
    for (const surface of surfaces.value) {
      const registration = deriveToolRegistration(surface);
      const sealed = sealCapabilityManifest(registration.manifest);
      if (!sealed.ok) throw new Error(sealed.error.message);
      expect(sealed.value.digest).toBe(registration.digest);
      const admitted = registry.register(sealed.value);
      expect(admitted.ok, `tool registration rejected: ${admitted.ok ? '' : admitted.error.message}`).toBe(true);
    }
    expect(registry.list({ category: 'action' }).length).toBe(3); // adapter surface + 2 tools.
  });

  it('retirement stops new bindings (the lifecycle convention holds through the real registry)', () => {
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'action' })[0]!;
    registry.retire({ capabilityId: record.manifest.capabilityId, version: record.manifest.version });
    const retired = registry.get({
      capabilityId: record.manifest.capabilityId,
      version: record.manifest.version,
    });
    if (!retired.ok) throw new Error(retired.error.message);
    const negotiated = negotiateBinding(ACTION_ADAPTER_DESCRIPTOR, retired.value);
    expect(negotiated.ok).toBe(false);
    if (negotiated.ok) throw new Error('unreachable');
    expect(negotiated.error.code).toBe('lifecycle-conflict');
    void EVALUATOR_ADAPTER_DESCRIPTOR;
  });
});

describe('registered invocation (the envelope end-to-end)', () => {
  it('an action invocation through a REAL negotiated pin routes through the authority', async () => {
    const { action } = adapterSetup();
    const registry = registryWithAdapter();
    const record = registry.list({ category: 'action' })[0]!;
    const negotiated = negotiateBinding(action.descriptor, record);
    if (!negotiated.ok) throw new Error(negotiated.error.message);
    const response = await action.invoke({
      schemaVersion: 1,
      category: 'action',
      binding: negotiated.value,
      payload: {
        target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
        parameters: {
          tenant: TENANT_A,
          tool: 'tool:terrain-elevation-lookup',
          arguments: { latitude: 52.5, longitude: 13.4 },
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T1,
          approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
        },
      },
    });
    expect(response.category).toBe('action');
    // The invocation requires human approval: the authority is pending, not executed.
    expect(response.payload.status).toBe('failed');
    if (response.payload.status !== 'failed') throw new Error('unreachable');
    expect(response.payload.failure.code).toBe('precondition-not-met');
    expect(response.payload.failure.message).toContain('authority-pending-approval');
  });

  it('an evaluator invocation through a REAL negotiated pin returns a justified verdict', async () => {
    const { action, evaluator } = adapterSetup();
    // Route a subject first.
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:eval-envelope-subject',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T1,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    const pin = pinFor(evaluator, registryWithAdapter());
    const response = await evaluator.invoke({
      schemaVersion: 1,
      category: 'evaluator',
      binding: pin,
      payload: {
        subject: {
          kind: 'world-outcome',
          subjectId: invocation.value.invocationId,
          subjectDigest: invocation.value.contentDigest,
        },
        criteria: {
          tenant: TENANT_A,
          'expected-disposition': 'authority-pending-approval',
        },
      },
    });
    expect(response.category).toBe('evaluator');
    expect(response.payload.verdict.verdictForm).toBe('pass-fail');
    if (response.payload.verdict.verdictForm !== 'pass-fail') throw new Error('unreachable');
    expect(response.payload.verdict.outcome).toBe('pass');
    expect(response.payload.justification.length).toBeGreaterThanOrEqual(2);
  });

  it('a W007 envelope invocation through the adapter pin works on the source-catalog path too', async () => {
    const { action } = adapterSetup();
    const registry = registryWithAdapter();
    const pin = pinFor(action, registry);
    const response = await action.invoke({
      schemaVersion: 1,
      category: 'action',
      binding: pin,
      payload: {
        target: { kind: 'external-resource', ref: 'tool:unit-convert' },
        parameters: {
          tenant: TENANT_A,
          tool: 'tool:unit-convert',
          arguments: { value: 5, unit_from: 'm', unit_to: 'cm' },
          authority: { principalId: PRINCIPAL, context: allowingContext() },
          'decided-at': T0,
          approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
        },
      },
    });
    expect(response.binding.adapterId).toBe('adapter:external-tool-action');
  });
});
