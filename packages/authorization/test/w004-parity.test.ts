// RUNTIME PARITY with the frozen W004 policy-contracts shapes and the
// sibling W009 packages (the W006 evidence->W002 / W007 adapter-sdk
// pattern): the authorization policy-target projection is accepted by the
// frozen W004 validator; the mirrored id patterns and vocabularies are
// identical to @epoch/tenancy and @epoch/identity; and scope matching
// agrees with the decision semantics. DevDependencies only —
// @epoch/authorization has NO runtime coupling with these packages.
import { describe, expect, it } from 'vitest';
import {
  matchesScope,
  policyTargetSchema,
  POLICY_PRECEDENCE_TIERS,
} from '@epoch/policy-contracts';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN,
  PRINCIPAL_LIFECYCLE_STATES,
  PRINCIPAL_LIFECYCLE_TRANSITIONS,
  PrincipalIdSchema as IdentityPrincipalIdSchema,
} from '@epoch/identity';
import {
  PROJECT_ID_PATTERN as TENANCY_PROJECT_ID_PATTERN,
  TENANCY_NODE_KINDS,
  TENANT_ID_PATTERN as TENANCY_TENANT_ID_PATTERN,
  TenantIdSchema as TenancyTenantIdSchema,
  WORKSPACE_ID_PATTERN as TENANCY_WORKSPACE_ID_PATTERN,
  WorkspaceIdSchema as TenancyWorkspaceIdSchema,
} from '@epoch/tenancy';
import {
  evaluate,
  PrincipalIdSchema,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_STATUSES,
  ProjectIdSchema,
  TenantIdSchema,
  TENANT_ID_PATTERN,
  toPolicyTarget,
  WORKSPACE_ID_PATTERN,
  WorkspaceIdSchema,
} from '../src/index';
import { asContext, asRequest } from './helpers';

describe('W004 policy-target alignment (runtime parity)', () => {
  it('the frozen W004 validator accepts the policy-target projection of tenant-scoped requests', () => {
    const tenantScoped = toPolicyTarget(asRequest());
    expect(policyTargetSchema.safeParse(tenantScoped).success).toBe(true);
    const workspaceScoped = toPolicyTarget(
      asRequest({
        resource: {
          resourceType: 'report',
          resourceId: 'report:q1',
          tenantId: 'tenant:acme',
          workspaceId: 'workspace:acme-eng',
        },
      }),
    );
    expect(policyTargetSchema.safeParse(workspaceScoped).success).toBe(true);
  });

  it('the frozen W004 validator accepts the projection of platform-scoped requests (all fields optional)', () => {
    const platformScoped = toPolicyTarget(
      asRequest({
        resource: { resourceType: 'platform-settings', resourceId: 'platform:epoch' },
      }),
    );
    expect(policyTargetSchema.safeParse(platformScoped).success).toBe(true);
  });

  it('bounds parity: the W004 scope strings and the request strings reject the same corruptions', () => {
    const long = 'x'.repeat(257);
    const corruptTargets = [
      { tenantId: '' },
      { tenantId: long },
      { workspaceId: '' },
      { projectId: long },
      { actionKind: '' },
      { resourceType: long },
      { tenantId: 'tenant:acme', extra: 'field' },
    ];
    for (const [index, corruption] of corruptTargets.entries()) {
      expect(policyTargetSchema.safeParse(corruption).success, `policy ${index}`).toBe(false);
    }
    // The corresponding REQUEST corruptions are rejected by the
    // authorization validator too (same 1..256 discipline).
    expect(
      evaluate(
        asRequest({ actionKind: long }) as never,
        asContext(),
      ).ok,
    ).toBe(false);
    expect(
      evaluate(
        asRequest({ actionKind: '' }) as never,
        asContext(),
      ).ok,
    ).toBe(false);
  });

  it('scope matching agrees with the isolation semantics: cross-tenant scope = no match = denial', () => {
    const request = asRequest(); // tenant:acme resource
    const target = toPolicyTarget(request);
    // An Acme-scoped policy matches the Acme target...
    expect(matchesScope({ tenantId: 'tenant:acme' }, target)).toBe(true);
    // ...a Globex-scoped policy does not — exactly like the decision point.
    expect(matchesScope({ tenantId: 'tenant:globex' }, target)).toBe(false);
    const decision = evaluate(request, asContext({ knownTenants: ['tenant:acme', 'tenant:globex'] }));
    expect(decision.ok && decision.value.outcome).toBe('allow');
    const foreign = evaluate(
      asRequest({
        resource: {
          resourceType: 'world',
          resourceId: 'world:globex-model',
          tenantId: 'tenant:globex',
          workspaceId: 'workspace:globex-eng',
          projectId: 'project:globex-1',
        },
      }),
      asContext(),
    );
    expect(foreign.ok && foreign.value.outcome).toBe('deny');
    expect(
      matchesScope(
        { tenantId: 'tenant:acme' },
        toPolicyTarget(
          asRequest({
            resource: {
              resourceType: 'world',
              resourceId: 'world:globex-model',
              tenantId: 'tenant:globex',
              workspaceId: 'workspace:globex-eng',
              projectId: 'project:globex-1',
            },
          }),
        ),
      ),
    ).toBe(false);
  });

  it('the W004 precedence tiers are exactly the tenancy organizational kinds (platform/tenant/workspace/project)', () => {
    expect([...POLICY_PRECEDENCE_TIERS]).toEqual(['platform', 'tenant', 'workspace', 'project']);
    for (const tier of POLICY_PRECEDENCE_TIERS) {
      expect((TENANCY_NODE_KINDS as readonly string[]).includes(tier), tier).toBe(true);
    }
  });
});

describe('tenancy mirror parity (runtime)', () => {
  it('the tenant/workspace/project id patterns are IDENTICAL to @epoch/tenancy', () => {
    expect(TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT_ID_PATTERN.source);
    expect(WORKSPACE_ID_PATTERN.source).toBe(TENANCY_WORKSPACE_ID_PATTERN.source);
    expect(PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.source);
  });

  it('the mirrored zod validators accept and reject the same fixtures', () => {
    const tenants = [
      ['tenant:acme', true],
      ['tenant:acme-eng', true],
      ['Tenant:ACME', false],
      ['tenant:', false],
      ['workspace:acme-eng', false],
      ['tenant:a'.repeat(64), false],
    ] as const;
    for (const [value, expected] of tenants) {
      expect(TenantIdSchema.safeParse(value).success, value).toBe(expected);
      expect(TenancyTenantIdSchema.safeParse(value).success, `tenancy ${value}`).toBe(expected);
    }
    const workspaces = [
      ['workspace:acme-eng', true],
      ['workspace:', false],
      ['tenant:acme', false],
    ] as const;
    for (const [value, expected] of workspaces) {
      expect(WorkspaceIdSchema.safeParse(value).success, value).toBe(expected);
      expect(TenancyWorkspaceIdSchema.safeParse(value).success, `tenancy ${value}`).toBe(expected);
    }
    const projects = [
      ['project:bridge-12', true],
      ['project:', false],
    ] as const;
    for (const [value, expected] of projects) {
      expect(ProjectIdSchema.safeParse(value).success, value).toBe(expected);
    }
    expect(TENANCY_PROJECT_ID_PATTERN.test('project:bridge-12')).toBe(true);
  });
});

describe('identity mirror parity (runtime)', () => {
  it('the principal-status vocabulary equals the @epoch/identity lifecycle states', () => {
    expect([...PRINCIPAL_STATUSES]).toEqual([...PRINCIPAL_LIFECYCLE_STATES]);
    expect(Object.keys(PRINCIPAL_LIFECYCLE_TRANSITIONS)).toEqual([
      'active',
      'suspended',
      'deactivated',
    ]);
  });

  it('the mirrored principal-id validators accept and reject the same fixtures', () => {
    const principals = [
      ['principal:ada', true],
      ['principal:stress-agent', true],
      ['principal:ci-runner', true],
      ['Principal:Ada', false],
      ['principal:', false],
      ['tenant:acme', false],
      ['agent:stress', false],
      ['principal:a'.repeat(64), false],
    ] as const;
    for (const [value, expected] of principals) {
      expect(PrincipalIdSchema.safeParse(value).success, value).toBe(expected);
      expect(IdentityPrincipalIdSchema.safeParse(value).success, `identity ${value}`).toBe(
        expected,
      );
    }
  });
});
