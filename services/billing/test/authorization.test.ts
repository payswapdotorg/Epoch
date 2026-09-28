// W009 AUTHORIZATION GATE coverage: the gate denies unauthorized
// operations BEFORE any kernel admission (allow / unknown principal /
// foreign membership / inactive principal / malformed context / the
// single-tenant guard).
import { describe, expect, it } from 'vitest';
import { BillingHost } from '../src/index';
import {
  AUTH,
  ENTITLEMENT,
  PRINCIPAL,
  TENANT,
  T1,
  T5,
  allowContext,
  deliveredActual,
  expectError,
  foreignMembershipContext,
  grant,
  inactivePrincipalContext,
  unknownPrincipalContext,
  unwrap,
} from './helpers';

describe('the W009 authorization gate (deny before admission)', () => {
  it('an unknown principal is denied (fail-closed) before any admission', () => {
    const host = new BillingHost();
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T1,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().accountCount).toBe(0);
    expect(host.health().eventCount).toBe(0);
  });

  it('a principal with membership in ANOTHER tenant is denied (R12)', () => {
    const host = new BillingHost();
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: foreignMembershipContext() },
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T1,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a suspended principal is denied', () => {
    const host = new BillingHost();
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: inactivePrincipalContext() },
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T1,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a malformed authorization context is a typed validation failure', () => {
    const host = new BillingHost();
    const error = expectError(
      host.openAccount({
        asTenant: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: { schemaVersion: 999 } as never,
        },
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T1,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('the grant-adoption gate denies unknown principals BEFORE any admission', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerGrant({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        grant: grant(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().grantCount).toBe(0);
  });

  it('the delivery-registration gate denies foreign memberships', () => {
    const host = new BillingHost();
    const error = expectError(
      host.registerDelivery({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: foreignMembershipContext() },
        delivery: deliveredActual(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().registeredDeliveryCount).toBe(0);
  });

  it('the seat-assignment gate denies suspended principals', () => {
    const host = new BillingHost();
    unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    const error = expectError(
      host.assignSeat({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: inactivePrincipalContext() },
        idempotencyKey: 'seat-1',
        entitlementId: ENTITLEMENT,
        principalId: PRINCIPAL,
        assignedAt: T5,
        assignedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().seatAssignmentCount).toBe(0);
  });

  it('the invoice-draft gate denies unknown principals before any line derivation', () => {
    const host = new BillingHost();
    const error = expectError(
      host.draftInvoice({
        asTenant: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        idempotencyKey: 'inv-1',
        accountId: 'billing-account:any',
        sources: [],
        createdAt: T5,
        createdBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().invoiceCount).toBe(0);
  });

  it('the single-tenant guard rejects operations naming another tenant', () => {
    const host = new BillingHost({ expectedTenantId: TENANT });
    const error = expectError(
      host.openAccount({
        asTenant: 'tenant:initech',
        authorization: { principalId: PRINCIPAL, context: allowContext(PRINCIPAL, 'tenant:initech') },
        idempotencyKey: 'key-1',
        currency: 'EUR',
        displayName: 'Initech EUR',
        openedAt: T1,
        openedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});
