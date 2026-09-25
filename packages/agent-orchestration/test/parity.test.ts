// RUNTIME PARITY with the sibling vocabularies (the kernel-to-kernel devDep
// pattern of W002/W006-W011): the mirrored tenant/principal id grammars are
// IDENTICAL to @epoch/tenancy's TENANT_ID_PATTERN and @epoch/identity's
// PRINCIPAL_ID_PATTERN; the cross-tenant rejection vocabulary matches
// @epoch/authorization's DENIAL_CODES; retry phases are a subset of the
// W010 ACTION_EVENT_PHASES vocabulary; real W003 proposals flow through
// compilation; real W007 registry lifecycles drive binding decisions; a
// real W002 world-model entity flows into a proposal target; and the
// session tenant scope satisfies @epoch/policy-contracts scope matching.
// devDependencies only — no runtime coupling.
import { describe, expect, it } from 'vitest';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema as IdentityPrincipalIdSchema,
} from '@epoch/identity';
import { TENANT_ID_PATTERN as TENANCY_TENANT_ID_PATTERN } from '@epoch/tenancy';
import { DENIAL_CODES, evaluate } from '@epoch/authorization';
import type { AuthorizationContext } from '@epoch/authorization';
import { ACTION_EVENT_PHASES } from '@epoch/event-log';
import { WorldModel } from '@epoch/world-model';
import { matchesScope } from '@epoch/policy-contracts';
import {
  ORCHESTRATION_PRINCIPAL_ID_PATTERN,
  ORCHESTRATION_TENANT_ID_PATTERN,
  RETRYABLE_ACTION_PHASES,
  bindOrchestratedAgent,
  compilePlan,
} from '../src/index';
import {
  agentFixture,
  planFixture,
  proposalFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('W009 tenancy parity (runtime)', () => {
  it('the mirrored tenant id pattern is exactly the tenancy pattern', () => {
    expect(ORCHESTRATION_TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT_ID_PATTERN.source);
    expect(ORCHESTRATION_TENANT_ID_PATTERN.flags).toBe(TENANCY_TENANT_ID_PATTERN.flags);
  });

  it('the same sample tenant ids pass/fail both patterns', () => {
    const valid = ['tenant:acme', 'tenant:a', 'tenant:bridge-12'];
    const invalid = ['Tenant:ACME', 'tenant:', 'tenant:-x', 'acme', 'tenant:' + 'a'.repeat(64)];
    for (const id of valid) {
      expect(new RegExp(ORCHESTRATION_TENANT_ID_PATTERN).test(id)).toBe(true);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(true);
    }
    for (const id of invalid) {
      expect(new RegExp(ORCHESTRATION_TENANT_ID_PATTERN).test(id)).toBe(false);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W009 identity parity (runtime)', () => {
  it('the mirrored principal pattern is exactly the identity pattern', () => {
    expect(ORCHESTRATION_PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.source);
    expect(ORCHESTRATION_PRINCIPAL_ID_PATTERN.flags).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.flags);
  });

  it('identity principal ids are valid orchestration principals and vice versa', () => {
    const samples = ['principal:lead-eng', 'principal:a', 'principal:svc-42'];
    for (const id of samples) {
      expect(IdentityPrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(ORCHESTRATION_PRINCIPAL_ID_PATTERN).test(id)).toBe(true);
    }
  });
});

describe('W009 authorization parity (runtime)', () => {
  it('the cross-tenant rejection code is the authorization denial vocabulary', () => {
    expect((DENIAL_CODES as readonly string[]).includes('cross-tenant-denied')).toBe(true);
  });

  it('a cross-tenant session access mirrors the authorization decision vocabulary', () => {
    // The runtime service rejects cross-tenant session access with the
    // same `cross-tenant-denied` vocabulary @epoch/authorization denies
    // with: a principal of tenant A acting on a tenant-B-scoped resource.
    const context: AuthorizationContext = {
      schemaVersion: 1,
      principals: [
        { principalId: 'principal:lead-eng', status: 'active', authenticated: true },
      ],
      memberships: [
        { principalId: 'principal:lead-eng', tenantId: 'tenant:acme' },
      ],
      knownTenants: ['tenant:acme', 'tenant:bridge'],
    };
    const decision = evaluate(
      {
        schemaVersion: 1,
        principalId: 'principal:lead-eng',
        actionKind: 'epoch.orchestration.session.read',
        resource: {
          resourceType: 'orchestration-session',
          resourceId: 'session:run-001',
          tenantId: 'tenant:bridge',
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

describe('W010 event-log parity (runtime)', () => {
  it('retry phases are a subset of the action lifecycle phase vocabulary', () => {
    const phases = ACTION_EVENT_PHASES as readonly string[];
    for (const retryable of RETRYABLE_ACTION_PHASES) {
      expect(phases.includes(retryable)).toBe(true);
    }
    expect(RETRYABLE_ACTION_PHASES).not.toContain('executed');
    expect(RETRYABLE_ACTION_PHASES).not.toContain('authorized');
  });
});

describe('W003 action-protocol parity (runtime)', () => {
  it('real admitted proposals flow through plan compilation untouched', () => {
    const registry = fixtureRegistry();
    const proposals = standardProposalSet();
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), proposals),
      proposals,
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    // The compiled steps carry the W003 ProposalReference vocabulary
    // verbatim (id + canonical digest) — referenced, never re-declared.
    expect(compiled.value.steps[0]!.proposal.proposalId).toBe('prop-survey-001');
    expect(compiled.value.steps[0]!.proposal.canonicalDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('binding decisions mirror the registry lifecycle exactly', () => {
    const registry = fixtureRegistry();
    // Registered binds.
    expect(
      bindOrchestratedAgent({
        agent: agentFixture({
          agentId: 'agent:a1',
          capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
        }),
        registry,
      }).ok,
    ).toBe(true);
    // Deprecated binds (advisory, mirroring registry.resolve).
    expect(
      bindOrchestratedAgent({
        agent: agentFixture({
          agentId: 'agent:a2',
          capabilities: [{ capabilityId: 'engineering.deprecated-analyzer', version: '0.9.0' }],
        }),
        registry,
      }).ok,
    ).toBe(true);
    // Retired never binds (mirroring registry.resolve's lifecycle-conflict).
    const retired = bindOrchestratedAgent({
      agent: agentFixture({
        agentId: 'agent:a3',
        capabilities: [{ capabilityId: 'engineering.legacy-solver', version: '1.0.0' }],
      }),
      registry,
    });
    expect(retired.ok).toBe(false);
    if (!retired.ok) {
      expect(retired.error.code).toBe('lifecycle-conflict');
    }
    // Unknown is unknown.
    const unknown = bindOrchestratedAgent({
      agent: agentFixture({
        agentId: 'agent:a4',
        capabilities: [{ capabilityId: 'engineering.missing', version: '1.0.0' }],
      }),
      registry,
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.code).toBe('unknown-capability');
    }
  });
});

describe('W002 world-model parity (runtime)', () => {
  it('a real world-model entity flows into a proposal target through compilation', () => {
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
    const proposals = [
      proposalFixture({
        target: { kind: 'world-entity', ref: entity.id },
      }),
      ...standardProposalSet().slice(1),
    ];
    const compiled = compilePlan({
      plan: withRealDigests(
        planFixture({
          steps: [
            {
              stepId: 'survey',
              agentId: 'agent:field-surveyor',
              proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
              dependsOn: [],
            },
          ],
        }),
        proposals,
      ),
      proposals,
      agents: standardAgents(fixtureRegistry()),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(compiled.value.steps[0]!.proposal.proposalId).toBe('prop-survey-001');
  });
});

describe('W004 policy-contracts parity (runtime)', () => {
  it('the session tenant scope satisfies policy scope matching', () => {
    // A tenant-scoped orchestration session is addressable by the W004
    // policy vocabulary: a tenant-wide policy scope matches a target in
    // the same tenant, and does not match a foreign tenant.
    const scope = { tenantId: 'tenant:acme' };
    expect(matchesScope(scope, { tenantId: 'tenant:acme' })).toBe(true);
    expect(matchesScope(scope, { tenantId: 'tenant:bridge' })).toBe(false);
  });
});
