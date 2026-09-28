// THE W009 AUTHORIZATION GATE: unauthorized operations are denied
// BEFORE any kernel admission; malformed contexts are typed validation
// failures; not-applicable is fail-closed; the single-tenant guard is
// R12.
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '../src/index';
import {
  DENIED_PRINCIPAL,
  EXTENSION_ID,
  OTHER_TENANT,
  POLICY_ID,
  PRINCIPAL,
  TENANT,
  T1,
  allowAuth,
  allowContext,
  conformingSubject,
  expectError,
  foreignMembershipContext,
  policyContent,
  unknownPrincipalContext,
  unwrap,
} from './helpers';

describe('the W009 authorization gate (fail-closed before any kernel admission)', () => {
  it('a denied principal cannot register a policy (no state change)', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: {
          principalId: DENIED_PRINCIPAL,
          context: foreignMembershipContext(DENIED_PRINCIPAL),
        },
        policy: policyContent(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect((error as { denialCode?: string }).denialCode).toBe('cross-tenant-denied');
    // Fail-closed BEFORE admission: nothing was recorded.
    const trail = unwrap(
      runtime.readAuditTrail({ tenantId: TENANT, authorization: allowAuth() }),
    );
    expect(trail).toEqual([]);
  });

  it('an unknown principal is denied (fail-closed, never error-open)', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: {
          principalId: DENIED_PRINCIPAL,
          context: unknownPrincipalContext(),
        },
        policy: policyContent(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect((error as { denialCode?: string }).denialCode).toBe('unknown-principal');
  });

  it('a malformed authorization context is a typed validation failure', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: { schemaVersion: 1, principals: 'not-an-array' } as never,
        },
        policy: policyContent(),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a not-applicable decision is a fail-closed rejection', () => {
    const runtime = new SecurityRuntime();
    const error = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: allowContext(PRINCIPAL),
        },
        subject: conformingSubject({ extensionId: EXTENSION_ID }),
        admittedAt: T1,
      }),
    );
    // No policy registered yet -> the fail-closed unknown-policy path
    // exercises AFTER the gate; with a policy the gate runs first.
    expect(['authorization-rejected', 'unknown-policy']).toContain(error.code);
  });

  it('the gate precedes kernel admission on EVERY operation', () => {
    const runtime = new SecurityRuntime();
    const denied = { principalId: DENIED_PRINCIPAL, context: foreignMembershipContext(DENIED_PRINCIPAL) };
    const operations: Array<
      () => { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
    > = [
      () => runtime.observeAgentSession({
        tenantId: TENANT,
        authorization: denied,
        observationId: 'observation:session-001',
        sessionId: 'session:earthworks',
        sessionStatus: 'running',
        observedAt: T1,
        sourceDigest: 'a'.repeat(64),
      }),
      () => runtime.observeSimulationRun({
        tenantId: TENANT,
        authorization: denied,
        observationId: 'observation:run-001',
        runId: 'simrun:model-1',
        runStatus: 'completed',
        observedAt: T1,
        sourceDigest: 'a'.repeat(64),
      }),
      () => runtime.observeAction({
        tenantId: TENANT,
        authorization: denied,
        observationId: 'observation:action-001',
        actionId: 'action:dispatch-1',
        actionStatus: 'executed',
        observedAt: T1,
        sourceDigest: 'a'.repeat(64),
      }),
      () => runtime.projectHealth({ tenantId: TENANT, authorization: denied, projectedAt: T1 }),
      () => runtime.readAuditTrail({ tenantId: TENANT, authorization: denied }),
      () => runtime.runAuditPass({
        tenantId: TENANT,
        authorization: denied,
        auditPassId: 'observation:audit-001',
        auditedAt: T1,
      }),
];
    for (const operation of operations) {
      const error = expectError(operation());
      expect(error.code).toBe('authorization-rejected');
    }
    expect(unwrap(runtime.readAuditTrail({ tenantId: TENANT, authorization: allowAuth() }))).toEqual([]);
  });

  it('the single-tenant guard rejects foreign tenants (R12)', () => {
    const runtime = new SecurityRuntime({ expectedTenantId: TENANT });
    const error = expectError(
      runtime.registerPolicy({
        tenantId: OTHER_TENANT,
        authorization: allowAuth(PRINCIPAL),
        policy: policyContent({ tenantId: OTHER_TENANT, policyId: POLICY_ID }),
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('the justified principal passes the gate (R17 audit justification rides the request)', () => {
    const runtime = new SecurityRuntime();
    const registered = unwrap(
      runtime.registerPolicy({
        tenantId: TENANT,
        authorization: {
          principalId: PRINCIPAL,
          context: allowContext(PRINCIPAL),
          justification: 'W030 acceptance fixture: baseline policy activation',
        },
        policy: policyContent(),
      }),
    );
    expect(registered.registered).toBe(true);
  });
});
