// W009 AUTHORIZATION GATE coverage: the gate denies unauthorized
// operations BEFORE any kernel admission (allow / unknown principal /
// foreign membership / inactive principal / malformed context).
import { describe, expect, it } from 'vitest';
import { ExecutionTrackingRuntime } from '../src/index';
import {
  DELIVERY_ID,
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  TENANT,
  allowContext,
  captureSeed,
  foreignMembershipContext,
  inactivePrincipalContext,
  openedDelivery,
  sealedProgram,
  unknownPrincipalContext,
  unwrap,
} from './helpers';
import { expectError } from './helpers';

describe('the W009 authorization gate (deny before admission)', () => {
  it('an unknown principal is denied (fail-closed) before any admission', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    const error = expectError(
      host.intakeFieldCapture({ tenantId: TENANT, authorization: auth, capture: captureSeed() }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().observationCount).toBe(0);
    expect(host.health().eventCount).toBe(0);
  });

  it('a principal with membership in ANOTHER tenant is denied (R12)', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: foreignMembershipContext() };
    const error = expectError(
      host.intakeFieldCapture({ tenantId: TENANT, authorization: auth, capture: captureSeed() }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a suspended principal is denied', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: inactivePrincipalContext() };
    const error = expectError(
      host.intakeFieldCapture({ tenantId: TENANT, authorization: auth, capture: captureSeed() }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a malformed authorization context is a typed validation failure', () => {
    const host = new ExecutionTrackingRuntime();
    const error = expectError(
      host.intakeFieldCapture({
        tenantId: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: { schemaVersion: 999 } as never,
        },
        capture: captureSeed(),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('the register gate denies unknown principals too', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    const error = expectError(
      host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().deliveryCount).toBe(0);
  });

  it('an authorized principal passes every gate (the full flow stays green)', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    const outcome = unwrap(
      host.intakeFieldCapture({ tenantId: TENANT, authorization: auth, capture: captureSeed() }),
    );
    expect(outcome.linkedWorkPackageId).toBe('work-package:earthworks');
    expect(host.health().observationCount).toBe(1);
  });

  it('the gate covers the projection and stream reads', () => {
    const host = new ExecutionTrackingRuntime();
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: { principalId: PRINCIPAL, context: allowContext() }, program: sealedProgram() }));
    const error = expectError(
      host.projectState({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        solutionId: SOLUTION_ID,
        asOf: T3,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    const streamError = expectError(
      host.eventStream({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: unknownPrincipalContext() },
        workPackageId: 'work-package:earthworks',
      }),
    );
    expect(streamError.code).toBe('authorization-rejected');
  });
});

void DELIVERY_ID;
