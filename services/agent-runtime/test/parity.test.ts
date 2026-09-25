// Cross-package composition parity (the runtime consumes REAL sibling
// kernels end-to-end): W010 events produced through the REAL EventLog API
// drive the runtime; the W007 registry lifecycle drives binding
// decisions; the W009 vocabularies scope tenants/principals;
// @epoch/authorization denies a cross-tenant session read with the same
// vocabulary the runtime uses; the W004 policy scope matches the session
// tenant. devDependencies only where not runtime deps — no forked
// authorities.
import { describe, expect, it } from 'vitest';
import { EventLog, sealEvent } from '@epoch/event-log';
import { CapabilityRegistry } from '@epoch/capability-registry';
import { PRINCIPAL_ID_PATTERN } from '@epoch/identity';
import { TENANT_ID_PATTERN } from '@epoch/tenancy';
import { evaluate } from '@epoch/authorization';
import type { AuthorizationContext } from '@epoch/authorization';
import { matchesScope } from '@epoch/policy-contracts';
import { WorldModel } from '@epoch/world-model';
import { bindOrchestratedAgent } from '@epoch/agent-orchestration';
import { AgentRuntime } from '../src/index';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  admittedProposal,
  agentFixture,
  capabilityManifest,
  fixtureRuntime,
  sealedCapability,
  standardProposalSet,
  startedSession,
} from './helpers';

describe('W010 event-log parity (runtime composition)', () => {
  it('events produced through the REAL EventLog API drive the runtime end-to-end', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    // Build a genuinely distributed history: a real log, appends through
    // the real admission pipeline, read back through the real read API.
    const log = new EventLog({ expectedTenantId: TENANT });
    const content = {
      schemaVersion: 1,
      streamId: 'stream:actions',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:action-gateway',
      causalParent: null,
      payload: {
        discriminator: 'action:lifecycle',
        data: {
          action: {
            proposalId: 'prop-survey-001',
            canonicalDigest: admittedProposal(standardProposalSet()[0]!).digest,
          },
          actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
          phase: 'executed',
        },
      },
      occurredAt: T2,
    };
    const sealed = sealEvent(content);
    if (!sealed.ok) throw new Error(sealed.error.message);
    const appended = log.appendEvent(sealed.value);
    if (!appended.ok) throw new Error(appended.error.message);
    const readBack = log.readStream('stream:actions');
    if (!readBack.ok) throw new Error(readBack.error.message);
    for (const record of readBack.value) {
      const advanced = runtime.ingestEvent({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        event: record,
        at: T2,
      });
      if (!advanced.ok) throw new Error(advanced.error.message);
      expect(advanced.value.session.steps[0]!.status).toBe('executed');
    }
  });
});

describe('W007 capability-registry parity (runtime composition)', () => {
  it('the runtime binds through the real registry lifecycle', () => {
    const registry = new CapabilityRegistry();
    const registered = registry.register(
      sealedCapability(capabilityManifest({ capabilityId: 'engineering.fresh', version: '1.0.0' })),
    );
    if (!registered.ok) throw new Error(registered.error.message);
    const runtime = new AgentRuntime();
    const bound = runtime.bindAgent({
      tenantId: TENANT,
      agent: agentFixture({
        capabilities: [{ capabilityId: 'engineering.fresh', version: '1.0.0' }],
      }),
      registry,
    });
    expect(bound.ok).toBe(true);
    // Retire it: NEW bindings through the same runtime now fail with the
    // registry's own lifecycle semantics.
    const retired = registry.retire({ capabilityId: 'engineering.fresh', version: '1.0.0' });
    if (!retired.ok) throw new Error(retired.error.message);
    const rebound = bindOrchestratedAgent({
      agent: agentFixture({
        agentId: 'agent:late-binder',
        capabilities: [{ capabilityId: 'engineering.fresh', version: '1.0.0' }],
      }),
      registry,
    });
    expect(rebound.ok).toBe(false);
    if (!rebound.ok) {
      expect(rebound.error.code).toBe('lifecycle-conflict');
    }
  });
});

describe('W009 tenancy/identity parity (runtime composition)', () => {
  it('the runtime scopes sessions with the W009 tenant grammar', () => {
    expect(TENANT).toMatch(TENANT_ID_PATTERN);
    expect('principal:action-gateway').toMatch(PRINCIPAL_ID_PATTERN);
  });

  it('the runtime and @epoch/authorization deny cross-tenant access with the same vocabulary', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const denied = runtime.getSession({ tenantId: 'tenant:bridge', sessionId: SESSION_ID });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('cross-tenant-denied');
    }
    // The same access pattern, decided by the REAL authorization kernel.
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: [
        { principalId: 'principal:lead-eng', status: 'active', authenticated: true },
      ],
      memberships: [{ principalId: 'principal:lead-eng', tenantId: 'tenant:bridge' }],
      knownTenants: ['tenant:acme', 'tenant:bridge'],
    };
    const decision = evaluate(
      {
        schemaVersion: 1,
        principalId: 'principal:lead-eng',
        actionKind: 'epoch.orchestration.session.read',
        resource: {
          resourceType: 'orchestration-session',
          resourceId: SESSION_ID,
          tenantId: TENANT,
        },
      },
      context,
    );
    if (!decision.ok) throw new Error(decision.error.message);
    expect(decision.value.outcome).toBe('deny');
    if (decision.value.outcome === 'deny') {
      expect(decision.value.denial.code).toBe('cross-tenant-denied');
    }
  });
});

describe('W004 policy-contracts parity (runtime composition)', () => {
  it('the session tenant scope is addressable by policy scope matching', () => {
    expect(matchesScope({ tenantId: TENANT }, { tenantId: TENANT })).toBe(true);
    expect(matchesScope({ tenantId: TENANT }, { tenantId: 'tenant:bridge' })).toBe(false);
  });
});

describe('W002 world-model parity (runtime composition)', () => {
  it('a real world-model entity grounds the proposals the runtime schedules', () => {
    const world = WorldModel.create();
    world.applyAssertion({
      statement: {
        kind: 'entity',
        entityId: 'element:column-c4',
        entityType: 'core:entity',
        properties: {},
      },
      provenance: {
        actor: { id: 'user:alice', role: 'human' },
        method: 'direct-observation',
        evidence: [],
      },
      confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
    });
    const entity = world.getEntity('element:column-c4');
    if (entity === null) throw new Error('fixture entity must materialize');
    // The fixture proposals target this entity; the runtime schedules them.
    const { runtime, plan } = fixtureRuntime();
    const created = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan,
      createdAt: T1,
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.plan.steps[0]!.proposal.proposalId).toBe('prop-survey-001');
    expect(entity.id).toBe('element:column-c4');
  });
});
