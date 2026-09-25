// Shared fixtures for the authorization tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely
// (the W006/W007 helpers pattern).
import type {
  AuthorizationContext,
  AuthorizationRequest,
} from '../src/index';

const ADA = 'principal:ada';
const TENANT_ACME = 'tenant:acme';
const TENANT_GLOBEX = 'tenant:globex';
const WS_ACME_ENG = 'workspace:acme-eng';
const WS_GLOBEX_ENG = 'workspace:globex-eng';
const PROJ_BRIDGE = 'project:bridge-12';

/** A tenant-scoped resource reference as loose JSON. */
export function resource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resourceType: 'world',
    resourceId: 'world:bridge-12-model',
    tenantId: TENANT_ACME,
    workspaceId: WS_ACME_ENG,
    projectId: PROJ_BRIDGE,
    ...overrides,
  };
}

/** A valid authorization request as loose JSON. */
export function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principalId: ADA,
    actionKind: 'world.read',
    resource: resource(),
    justification: 'Load the bridge model for review.',
    ...overrides,
  };
}

/** A valid principal fact for Ada (active + authenticated). */
export function adaFact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    principalId: ADA,
    status: 'active',
    authenticated: true,
    ...overrides,
  };
}

/** A valid principal fact for the Globex member. */
export function globexFact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    principalId: 'principal:nikola',
    status: 'active',
    authenticated: true,
    ...overrides,
  };
}

/** Ada's project-scoped membership in Acme. */
export function adaMembership(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    principalId: ADA,
    tenantId: TENANT_ACME,
    workspaceId: WS_ACME_ENG,
    projectId: PROJ_BRIDGE,
    ...overrides,
  };
}

/** Nikola's project-scoped membership in Globex. */
export function globexMembership(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    principalId: 'principal:nikola',
    tenantId: TENANT_GLOBEX,
    workspaceId: WS_GLOBEX_ENG,
    projectId: 'project:globex-1',
    ...overrides,
  };
}

/** The canonical decision context: Ada + Nikola, both tenants known. */
export function context(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    principals: [adaFact(), globexFact()],
    memberships: [adaMembership(), globexMembership()],
    knownTenants: [TENANT_ACME, TENANT_GLOBEX],
    ...overrides,
  };
}

/** Typed view of the loose request fixture (for evaluate calls). */
export function asRequest(input: Record<string, unknown> = {}): AuthorizationRequest {
  return { ...(request() as unknown as AuthorizationRequest), ...input } as AuthorizationRequest;
}

/** Typed view of the loose context fixture (for evaluate calls). */
export function asContext(input: Record<string, unknown> = {}): AuthorizationContext {
  return { ...(context() as unknown as AuthorizationContext), ...input } as unknown as AuthorizationContext;
}

export const IDS = {
  ADA,
  TENANT_ACME,
  TENANT_GLOBEX,
  WS_ACME_ENG,
  WS_GLOBEX_ENG,
  PROJ_BRIDGE,
} as const;
