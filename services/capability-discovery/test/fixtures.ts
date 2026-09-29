/**
 * Service test fixtures: a REAL tenancy snapshot (W009 admission), the
 * service instance builder, and shared authorization principals.
 */
import { computeTenancyNodeDigest } from '@epoch/tenancy';
import type { TenancyNodeRecord, TenancySnapshot } from '@epoch/tenancy';
import { CapabilityDiscoveryService } from '../src/runtime';
import type { AuthorizationDecision, ServicePrincipal } from '../src/types';

export const TENANT_ALPHA = 'tenant:alpha';
export const TENANT_BETA = 'tenant:beta';

export const ALLOW: AuthorizationDecision = { allowed: true, scope: 'discovery' };
export const DENY: AuthorizationDecision = {
  allowed: false,
  reason: 'principal is not authorized for discovery operations',
};

export const PRINCIPAL_LEAD: ServicePrincipal = {
  principalId: 'principal:tech-lead',
  roles: ['discovery-lead'],
};
export const PRINCIPAL_SCHEDULER: ServicePrincipal = {
  principalId: 'principal:scheduler',
  roles: ['discovery-scheduler'],
};

function nodeRecord(input: {
  readonly nodeId: string;
  readonly kind: 'platform' | 'tenant' | 'workspace' | 'project';
  readonly displayName: string;
  readonly parentId: string | null;
}): TenancyNodeRecord {
  const node = {
    schemaVersion: 1,
    nodeId: input.nodeId,
    kind: input.kind,
    displayName: input.displayName,
    parentId: input.parentId,
  };
  return {
    schemaVersion: 1,
    node: node as TenancyNodeRecord['node'],
    nodeDigest: computeTenancyNodeDigest(node as TenancyNodeRecord['node']),
  };
}

/** A REAL tenancy snapshot: platform + two tenants + one workspace. */
export function tenancySnapshot(): TenancySnapshot {
  return {
    schemaVersion: 1,
    records: [
      nodeRecord({
        nodeId: 'platform:epoch',
        kind: 'platform',
        displayName: 'Epoch Platform',
        parentId: null,
      }),
      nodeRecord({
        nodeId: TENANT_ALPHA,
        kind: 'tenant',
        displayName: 'Alpha Engineering',
        parentId: 'platform:epoch',
      }),
      nodeRecord({
        nodeId: TENANT_BETA,
        kind: 'tenant',
        displayName: 'Beta Construction',
        parentId: 'platform:epoch',
      }),
      nodeRecord({
        nodeId: 'workspace:alpha-eng',
        kind: 'workspace',
        displayName: 'Alpha Engineering Workspace',
        parentId: TENANT_ALPHA,
      }),
    ],
  };
}

/** Build a service instance over the REAL tenancy snapshot. */
export function buildService(): CapabilityDiscoveryService {
  return new CapabilityDiscoveryService({ tenancySnapshot: tenancySnapshot() });
}

/** Test helper: assert a typed service failure. */
export function expectServiceFailure<C extends string>(
  result: { readonly ok: true } | { readonly ok: false; readonly error: { readonly code: C; readonly message: string } },
  code: C,
): { readonly code: C; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error;
}
