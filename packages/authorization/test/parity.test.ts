// RUNTIME PARITY with the frozen kernel shapes W009 must compose with —
// pinned via devDependencies ONLY (zero runtime coupling beyond
// @epoch/agent-protocol; the kernel-to-kernel devDep precedent: W002,
// W006, W007, W008):
//
//  - @epoch/policy-contracts (W004): the policy-target projection is
//    admitted by policyTargetSchema, and a REAL W004 matchesScope
//    evaluation wired behind the decision point yields correct
//    decisions (parity of shapes AND of composition).
//  - @epoch/tenancy: the tenant id space matches, and real directory
//    node ids flow through authorization requests.
//  - @epoch/identity: the principal id space matches, and a real
//    PrincipalDirectory backs the facts.
//  - @epoch/action-protocol (W003): action kinds share the
//    authority-scope pattern; PrincipalReference.id accepts W009 ids.
//  - @epoch/evidence (W006): evidence paths share the exact-revision
//    reference shape (accept/reject parity).
import { describe, expect, it } from 'vitest';
import { AuthorityScopeSchema, PrincipalReferenceSchema } from '@epoch/action-protocol';
import { ExactRevisionRefSchema } from '@epoch/evidence';
import { PrincipalDirectory } from '@epoch/identity';
import { PrincipalIdSchema } from '@epoch/identity';
import { matchesScope, policyTargetSchema } from '@epoch/policy-contracts';
import { TenancyDirectory, TenantIdSchema } from '@epoch/tenancy';
import {
  AuthorizationDecisionPoint,
  EvidencePathSchema,
  PrincipalIdSchema as AuthorizationPrincipalIdSchema,
  TenantIdSchema as AuthorizationTenantIdSchema,
  projectPolicyTarget,
} from '../src/index';
import type { AuthorizationFacts } from '../src/index';
import { parseAuthorizationRequest } from '../src/index';
import { evidencePath, request } from './helpers';

// --- W004 policy-contracts parity --------------------------------------------

describe('W004 policy-target parity', () => {
  it('the projection of every valid request is admitted by the W004 policyTargetSchema', () => {
    const fixtures = [
      request(),
      request({ context: undefined }),
      request({ context: { tags: [] } }),
      request({
        resource: { resourceType: 'evidence', resourceId: 'evidence:report-1' },
        actionKind: 'evidence:append',
      }),
    ];
    for (const [index, fixture] of fixtures.entries()) {
      const parsed = parseAuthorizationRequest(fixture);
      expect(parsed.ok, `fixture ${index}`).toBe(true);
      if (!parsed.ok) continue;
      const target = projectPolicyTarget(parsed.value);
      expect(policyTargetSchema.safeParse(target).success, `target ${index}`).toBe(true);
    }
  });

  it('shared corruptions are rejected by both the W009 request schema and the W004 target schema', () => {
    // Empty action kind: rejected by W009's request validation...
    expect(parseAuthorizationRequest(request({ actionKind: '' })).ok).toBe(false);
    // ...and by the W004 target schema once projected.
    expect(policyTargetSchema.safeParse({ tenantId: 'tenant:acme', actionKind: '' }).success).toBe(false);
    // Oversized resource type (beyond BOTH bounds): rejected by both.
    expect(
      parseAuthorizationRequest(
        request({ resource: { resourceType: 'x'.repeat(257), resourceId: 'r' } }),
      ).ok,
    ).toBe(false);
    expect(
      policyTargetSchema.safeParse({
        tenantId: 'tenant:acme',
        resourceType: 'x'.repeat(257),
        actionKind: 'world:write',
      }).success,
    ).toBe(false);
    // Empty tenant scope: rejected by both.
    expect(policyTargetSchema.safeParse({ tenantId: '', actionKind: 'world:write' }).success).toBe(false);
  });

  it('a real W004 matchesScope evaluation wired behind the decision point yields correct decisions', () => {
    // The host wiring seam: W004 owns the policy semantics; the W009
    // decision point owns the pipeline. The scope fixture allows
    // world:write over workspace resources in tenant:acme.
    const scope = {
      tenantId: 'tenant:acme',
      resourceTypes: ['workspace'],
      actionKinds: ['world:write'],
    };
    const facts: AuthorizationFacts = {
      resolvePrincipal: (principalId: string) =>
        principalId === 'principal:ada-lovelace'
          ? { known: true, memberTenants: ['tenant:acme'] }
          : { known: false },
      resolveTenant: (tenantId: string) =>
        tenantId === 'tenant:acme' || tenantId === 'tenant:globex'
          ? { known: true }
          : { known: false },
      evaluatePolicy: (_request, target) =>
        matchesScope(scope, target)
          ? {
              outcome: 'allow',
              reasons: ['scope matched: tenant acme, workspace resources, world:write'],
            }
          : {
              outcome: 'not-applicable',
              reasons: ['no applicable policy for the projected target'],
            },
    };
    const decisionPoint = new AuthorizationDecisionPoint(facts);

    const allowed = decisionPoint.decide(request());
    expect(allowed.ok && allowed.value.decision.outcome).toBe('allow');

    const unmatched = decisionPoint.decide(
      request({ actionKind: 'evidence:append', resource: { resourceType: 'evidence', resourceId: 'evidence:report-1' } }),
    );
    expect(unmatched.ok && unmatched.value.decision.outcome).toBe('not-applicable');

    // And the fail-closed boundary still precedes policy evaluation:
    const crossTenant = decisionPoint.decide(request({ tenantId: 'tenant:globex' }));
    expect(crossTenant.ok).toBe(false);
    if (crossTenant.ok) return;
    expect(crossTenant.error.code).toBe('cross-tenant-denied');
  });
});

// --- tenancy parity -----------------------------------------------------------

describe('tenancy id parity', () => {
  it('the W009 and W004-adjacent tenant id spaces match (accept/reject parity)', () => {
    const valid = ['tenant:acme', 'tenant:a', `tenant:${'y'.repeat(63)}`];
    const invalid = ['', 'tenant', 'tenant:', 'Tenant:acme', 'org:acme', `tenant:${'x'.repeat(64)}`];
    for (const id of valid) {
      expect(AuthorizationTenantIdSchema.safeParse(id).success, id).toBe(true);
      expect(TenantIdSchema.safeParse(id).success, id).toBe(true);
    }
    for (const id of invalid) {
      expect(AuthorizationTenantIdSchema.safeParse(id).success, id).toBe(false);
      expect(TenantIdSchema.safeParse(id).success, id).toBe(false);
    }
  });

  it('real tenancy directory node ids flow through authorization requests', () => {
    const directory = new TenancyDirectory();
    directory.createPlatform({ id: 'platform:epoch' });
    directory.createNode({ id: 'tenant:acme', parentId: 'platform:epoch' });
    directory.createNode({ id: 'workspace:acme-eng', parentId: 'tenant:acme' });
    directory.createNode({ id: 'project:acme-bridge', parentId: 'workspace:acme-eng' });
    directory.createNode({ id: 'world:acme-bridge-north', parentId: 'project:acme-bridge' });
    const membership = directory.resolveMembership('world:acme-bridge-north');
    expect(membership.ok && membership.value.tenantId).toBe('tenant:acme');

    // The request scopes the resolved tenant and resource from the real
    // hierarchy; admission accepts the real node ids.
    const scoped = request({
      tenantId: membership.ok ? membership.value.tenantId : 'tenant:acme',
      resource: { resourceType: 'world', resourceId: 'world:acme-bridge-north' },
      context: {
        workspaceId: 'workspace:acme-eng',
        projectId: 'project:acme-bridge',
      },
    });
    const parsed = parseAuthorizationRequest(scoped);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(projectPolicyTarget(parsed.value).tenantId).toBe('tenant:acme');
    expect(policyTargetSchema.safeParse(projectPolicyTarget(parsed.value)).success).toBe(true);
  });
});

// --- identity parity ----------------------------------------------------------

describe('identity principal id parity', () => {
  it('the W009 and identity principal id spaces match (accept/reject parity)', () => {
    const valid = ['principal:ada-lovelace', 'principal:a', `principal:${'y'.repeat(63)}`];
    const invalid = ['', 'principal', 'principal:', 'Principal:ada', 'user:ada', `principal:${'x'.repeat(64)}`];
    for (const id of valid) {
      expect(AuthorizationPrincipalIdSchema.safeParse(id).success, id).toBe(true);
      expect(PrincipalIdSchema.safeParse(id).success, id).toBe(true);
    }
    for (const id of invalid) {
      expect(AuthorizationPrincipalIdSchema.safeParse(id).success, id).toBe(false);
      expect(PrincipalIdSchema.safeParse(id).success, id).toBe(false);
    }
  });

  it('a real PrincipalDirectory backs the decision point facts (host wiring)', () => {
    const directory = new PrincipalDirectory();
    const ada = directory.register({
      principalId: 'principal:ada-lovelace',
      kind: 'human',
      displayName: 'Ada Lovelace',
    });
    expect(ada.ok).toBe(true);
    // The directory holds NO tenancy membership (identity != tenancy):
    // membership facts come from the host wiring, as designed.
    const facts: AuthorizationFacts = {
      resolvePrincipal: (principalId: string) => {
        const principal = directory.get(principalId);
        return principal.ok
          ? { known: true, memberTenants: ['tenant:acme'] }
          : { known: false };
      },
      resolveTenant: () => ({ known: true }),
      evaluatePolicy: () => ({ outcome: 'allow', reasons: ['member allowed'] }),
    };
    const decisionPoint = new AuthorizationDecisionPoint(facts);
    const allowed = decisionPoint.decide(request());
    expect(allowed.ok && allowed.value.decision.outcome).toBe('allow');
    const unknown = decisionPoint.decide(request({ principalId: 'principal:ghost' }));
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.error.code).toBe('unknown-principal');
  });
});

// --- action-protocol (W003) parity --------------------------------------------

describe('W003 action-protocol parity', () => {
  it('action kinds share the authority-scope pattern (accept/reject parity)', () => {
    const valid = ['world:write', 'evidence:append', 'external:git:write', 'a0:b-1:c2'];
    const invalid = ['', 'write', 'WORLD:write', 'world:', 'world:Write', 'a b'];
    for (const kind of valid) {
      expect(
        parseAuthorizationRequest(request({ actionKind: kind })).ok,
        kind,
      ).toBe(true);
      expect(AuthorityScopeSchema.safeParse(kind).success, kind).toBe(true);
    }
    for (const kind of invalid) {
      expect(
        parseAuthorizationRequest(request({ actionKind: kind })).ok,
        kind,
      ).toBe(false);
      expect(AuthorityScopeSchema.safeParse(kind).success, kind).toBe(false);
    }
  });

  it('W009 principal ids remain valid W003 PrincipalReference.id values', () => {
    expect(
      PrincipalReferenceSchema.safeParse({ id: 'principal:ada-lovelace', role: 'human' })
        .success,
    ).toBe(true);
    expect(
      PrincipalReferenceSchema.safeParse({ id: `principal:${'x'.repeat(200)}`, role: 'human' })
        .success,
    ).toBe(false);
  });
});

// --- evidence (W006) parity ---------------------------------------------------

describe('W006 evidence exact-revision parity', () => {
  it('evidence paths share the exact-revision reference shape (accept/reject parity)', () => {
    const valid = [
      evidencePath(),
      evidencePath({ artifactId: 'a'.repeat(256), revision: 'r'.repeat(128) }),
      evidencePath({ digest: '0'.repeat(64) }),
    ];
    const invalid = [
      evidencePath({ artifactId: '' }),
      evidencePath({ artifactId: 'a'.repeat(257) }),
      evidencePath({ revision: '' }),
      evidencePath({ revision: 'r'.repeat(129) }),
      evidencePath({ digest: 'short' }),
      evidencePath({ digest: 'A'.repeat(64) }),
      evidencePath({ extra: 'field' }),
    ];
    for (const [index, fixture] of valid.entries()) {
      expect(EvidencePathSchema.safeParse(fixture).success, `w009 ${index}`).toBe(true);
      expect(ExactRevisionRefSchema.safeParse(fixture).success, `w006 ${index}`).toBe(true);
    }
    for (const [index, corruption] of invalid.entries()) {
      expect(EvidencePathSchema.safeParse(corruption).success, `w009 ${index}`).toBe(false);
      expect(ExactRevisionRefSchema.safeParse(corruption).success, `w006 ${index}`).toBe(
        false,
      );
    }
  });
});
