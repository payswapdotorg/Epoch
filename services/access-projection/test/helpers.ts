// Shared service-test helpers: REAL W009 contexts + REAL W036 records +
// the standard multi-role policy (mirrors the kernel fixtures, trimmed to
// the host surface). ZERO clock reads: every instant is a fixed constant.
import { buildProgramOfWork as buildProgram } from '@epoch/solution-delivery';
import { sealProjectionPolicy } from '@epoch/access-projection';
import type { SealedProjectionPolicy } from '@epoch/access-projection';
import type { AuthorizationContext } from '@epoch/authorization';

export const T0 = '2026-04-01T09:00:00.000Z';
export const T1 = '2026-04-01T09:00:01.000Z';
export const T2 = '2026-04-01T09:00:02.000Z';
export const T3 = '2026-04-01T09:00:03.000Z';
export const T4 = '2026-04-01T09:00:04.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const CLIENT = 'principal:client-viewer';
export const ENGINEER = 'principal:site-engineer';
export const HOST_ADMIN = 'principal:access-admin';
export const ROLE_CLIENT = 'role:client-viewer';
export const ROLE_ENGINEER = 'role:site-engineer';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PROGRAM_ID = 'program:tower-retrofit';

/** Unwrap a total result or fail loudly. */
export function unwrap<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Unwrap a total result or fail loudly, naming the expected code. */
export function expectError<T>(
  result: { ok: true; value: T } | { ok: false; error: unknown },
  code: string,
): { code: string } & Record<string, unknown> {
  if (result.ok) {
    throw new Error(`expected an error ("${code}") but the operation succeeded`);
  }
  const error = result.error as { code?: string };
  if (error?.code !== code) {
    throw new Error(
      `expected error code "${code}" but encountered "${String(error?.code)}": ${JSON.stringify(result.error)}`,
    );
  }
  return result.error as { code: string } & Record<string, unknown>;
}

/** A REAL W009 context that allows `principalId` in `tenantId`. */
export function allowContext(principalId: string, tenantId: string = TENANT): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [tenantId],
  };
}

/** A REAL W009 context whose principal is unknown (deny: unknown-principal). */
export function unknownPrincipalContext(tenantId: string = TENANT): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [tenantId],
  };
}

/** A REAL W009 context whose principal is suspended (deny: inactive-principal). */
export function inactivePrincipalContext(principalId: string): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'suspended', authenticated: true }],
    memberships: [{ principalId, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}

/** One REAL sealed program of work (two work packages, evidence + cost). */
export function sealedProgram(tenantId: string = TENANT) {
  return unwrap(
    buildProgram({
      schema: 'epoch.solution-delivery.program-of-work',
      schemaVersion: 1,
      programId: PROGRAM_ID,
      tenantId,
      solutionId: SOLUTION_ID,
      solutionVersion: '1.0.0',
      solutionVersionDigest: 'd'.repeat(64),
      title: 'Tower Retrofit Program',
      workPackages: [
        {
          workPackageId: 'work-package:earthworks',
          title: 'Earthworks',
          realizationVariant: 'construction-build',
          resources: [],
          constraintReferences: [],
          approvals: [],
          verificationGates: [],
          activities: [
            {
              activityId: 'activity:backfill',
              workPackageId: 'work-package:earthworks',
              title: 'Backfill',
              predecessors: [],
              successors: [],
              resources: [],
              constraintReferences: [],
              blockers: [],
              evidence: [{ digest: 'a'.repeat(64) }],
            },
            {
              activityId: 'activity:excavation',
              workPackageId: 'work-package:earthworks',
              title: 'Excavation',
              predecessors: [],
              successors: [],
              resources: [],
              constraintReferences: [],
              blockers: [],
              evidence: [{ digest: 'b'.repeat(64) }],
              plannedCost: { amount: '1200.50', currency: 'EUR' },
            },
          ],
        },
      ],
      milestones: [],
      createdAt: T0,
      createdBy: 'principal:chief-engineer',
    }),
  );
}

/** The standard multi-role policy content (loose). */
export function standardPolicyContent(): Record<string, unknown> {
  return {
    schema: 'epoch.access-projection.policy',
    schemaVersion: 1,
    policyId: 'policy:tower-retrofit-access',
    revision: 1,
    tenantId: TENANT,
    title: 'Tower Retrofit access policy',
    status: 'active',
    bindings: [
      {
        selector: { principalKind: 'human', role: ROLE_CLIENT },
        objectClass: 'program-of-work',
        allowedActions: ['view'],
        fieldAllowlist: [
          'schema',
          'programId',
          'tenantId',
          'title',
          'workPackages[].workPackageId',
          'workPackages[].title',
          'workPackages[].activities[].activityId',
          'workPackages[].activities[].title',
          'workPackages[].activities[].evidence[].digest',
          'contentDigest',
        ].sort(),
        redactionRules: [
          {
            fieldPath: 'workPackages[].activities[].plannedCost',
            redactionClass: 'commercial-sensitive',
          },
        ],
        defaultRedactionClass: 'policy-scoped',
        scopeFilters: { evidence: { mode: 'none' }, commercial: 'hidden', supplier: 'hidden' },
      },
      {
        selector: { principalKind: 'human', role: ROLE_ENGINEER },
        objectClass: 'program-of-work',
        allowedActions: ['export', 'share', 'view'],
        fieldAllowlist: [
          'schema',
          'programId',
          'tenantId',
          'title',
          'createdAt',
          'createdBy',
          'workPackages[].workPackageId',
          'workPackages[].title',
          'workPackages[].activities[].activityId',
          'workPackages[].activities[].title',
          'workPackages[].activities[].evidence[].digest',
          'workPackages[].activities[].plannedCost.amount',
          'workPackages[].activities[].plannedCost.currency',
          'contentDigest',
        ].sort(),
        redactionRules: [],
        defaultRedactionClass: 'policy-scoped',
        scopeFilters: {
          evidence: { mode: 'all' },
          commercial: 'visible',
          supplier: 'hidden',
        },
      },
    ],
  };
}

/** The sealed standard policy. */
export function sealedPolicy(): SealedProjectionPolicy {
  return unwrap(sealProjectionPolicy(standardPolicyContent()));
}
