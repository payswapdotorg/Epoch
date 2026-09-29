// AUTHORIZATION coverage (W009): every operation sits behind the
// fail-closed authorization gate — unknown principals, suspended
// principals, no-decision contexts, and malformed contexts are typed
// `authorization-rejected` (or `validation`) rejections BEFORE any
// kernel admission or state change.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import {
  AUTH,
  DEVELOPER,
  T0,
  T1,
  draft,
  fixtureRegistry,
  unwrap,
  expectError,
  inactivePrincipalContext,
  foreignMembershipContext,
  unknownPrincipalContext,
} from './helpers';

function host(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

describe('developer portal authorization gate (W009)', () => {
  it('denies draft creation to an unknown principal (fail-closed)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:ghost', context: unknownPrincipalContext() },
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(portal.health().listingCount).toBe(0);
  });

  it('denies draft creation to a suspended principal', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:portal-dev', context: inactivePrincipalContext() },
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('denies operations to a principal with only a foreign membership (R12 deny)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:portal-dev', context: foreignMembershipContext() },
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('rejects a malformed authorization context as typed validation', () => {
    const portal = host();
    const error = expectError(
      portal.listListings({
        asTenant: DEVELOPER,
        authorization: {
          principalId: 'principal:portal-dev',
          context: { schemaVersion: 99 } as never,
        },
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('denies unauthorized reads of another developer\'s dashboard surface', () => {
    const portal = host();
    const error = expectError(
      portal.getDeveloperDashboard({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:ghost', context: unknownPrincipalContext() },
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('admits an authorized principal and records the operation effect', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(created.duplicate).toBe(false);
    // An authorized second principal of the SAME tenant may operate.
    const submitted = unwrap(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: {
          principalId: 'principal:portal-ops',
          context: {
            schemaVersion: 1,
            principals: [{ principalId: 'principal:portal-ops', status: 'active', authenticated: true }],
            memberships: [{ principalId: 'principal:portal-ops', tenantId: DEVELOPER }],
            knownTenants: [DEVELOPER],
          },
        },
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    expect(submitted.lifecycle).toBe('submitted');
  });

  it('gates capability browsing and resolution too', () => {
    const portal = host();
    const browseError = expectError(
      portal.browseCapabilities({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:ghost', context: unknownPrincipalContext() },
      }),
    );
    expect(browseError.code).toBe('authorization-rejected');
    const resolveError = expectError(
      portal.resolveCapability({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:ghost', context: unknownPrincipalContext() },
        capabilityId: 'stress.sim-fabric',
        constraint: { kind: 'exact', version: '1.0.0' },
      }),
    );
    expect(resolveError.code).toBe('authorization-rejected');
  });

  it('gates event-stream reads', () => {
    const portal = host();
    const error = expectError(
      portal.readStream({
        asTenant: DEVELOPER,
        authorization: { principalId: 'principal:ghost', context: unknownPrincipalContext() },
        streamId: 'stream:portal-listing-x',
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });
});
