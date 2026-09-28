// W009 AUTHORIZATION GATE coverage: the gate denies unauthorized
// operations BEFORE any kernel admission (allow / unknown principal /
// foreign membership / inactive principal / malformed context).
import { describe, expect, it } from 'vitest';
import { SupervisionRuntime } from '../src/index';
import {
  DELIVERY_ID,
  EVAL_IN_WINDOW,
  PRINCIPAL,
  PROGRAM_ID,
  TENANT,
  allowContext,
  expectError,
  foreignMembershipContext,
  inactivePrincipalContextBuilder,
  openedDelivery,
  policyContent,
  sealedProgram,
  unknownPrincipalContext,
  unwrap,
} from './helpers';

describe('the W009 authorization gate (deny before admission)', () => {
  it('an unknown principal is denied (fail-closed) before any admission', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    const error = expectError(
      host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().programCount).toBe(0);
    expect(host.health().eventCount).toBe(0);
  });

  it('a principal with membership in ANOTHER tenant is denied (R12)', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: foreignMembershipContext() };
    const error = expectError(
      host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a suspended principal is denied', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: inactivePrincipalContextBuilder() };
    const error = expectError(
      host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a malformed authorization context is a typed validation failure', () => {
    const host = new SupervisionRuntime();
    const error = expectError(
      host.registerProgram({
        tenantId: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: { schemaVersion: 999 } as never,
        },
        program: sealedProgram(),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('the evaluate gate denies unknown principals too (no pass runs)', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
    const denied = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(denied.code).toBe('authorization-rejected');
    expect(host.health().passCount).toBe(0);
  });

  it('the policy-registration gate denies foreign memberships', () => {
    const host = new SupervisionRuntime();
    const error = expectError(
      host.registerPolicy({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: foreignMembershipContext() },
        policy: policyContent(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().policyCount).toBe(0);
  });
});
