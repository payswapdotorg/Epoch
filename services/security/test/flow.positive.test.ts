// THE GOLDEN PATH (positive + recovery): policy registration ->
// listing registration -> conforming sandbox admission -> invocation
// observations -> execution-surface intake (sessions/runs/actions) ->
// a violation -> policy-driven quarantine -> health degradation ->
// explicit release -> RECOVERY (re-admission succeeds).
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '../src/index';
import {
  EXTENSION_ID,
  EXTENSION_ID_2,
  LISTING_ID,
  POLICY_ID,
  PRINCIPAL,
  SESSION_ID,
  SIMRUN_ID,
  ACTION_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
  allowAuth,
  conformingSubject,
  expectError,
  listingContent,
  policyContent,
  unwrap,
} from './helpers';

describe('the W030 golden path (admission -> observation -> violation -> quarantine -> recovery)', () => {
  it('runs the full positive + recovery flow', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();

    // 1. Policy registration (policy is data).
    const registered = unwrap(
      runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }),
    );
    expect(registered.registered).toBe(true);

    // 2. Listing registration (W023 provenance through the REAL verifier).
    const listing = unwrap(
      runtime.registerListing({
        tenantId: TENANT,
        authorization: auth,
        listing: listingContent(),
      }),
    );
    expect(listing.registered).toBe(true);

    // 3. Conforming sandbox admission (the isolation gate).
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    expect(admitted.verdict.verdict).toBe('conforms');
    expect(admitted.quarantined).toBe(false);
    expect(admitted.observation.observationClass).toBe('sandbox-admission');
    expect(admitted.observation.outcome).toBe('allowed');

    // 4. Invocation observations (the W008 boundary).
    unwrap(
      runtime.observeSandboxInvocation({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:invocation-001',
        extensionId: EXTENSION_ID,
        outcome: 'allowed',
        observedAt: T2,
        sourceDigest: 'd'.repeat(64),
      }),
    );
    unwrap(
      runtime.observeSandboxInvocation({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:invocation-002',
        extensionId: EXTENSION_ID,
        outcome: 'denied',
        denialReason: 'undeclared-resource-scope',
        observedAt: T3,
        sourceDigest: 'e'.repeat(64),
      }),
    );

    // 5. Execution-surface intake (W020/W021/W022 lifecycle facts).
    unwrap(
      runtime.observeAgentSession({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:session-001',
        sessionId: SESSION_ID,
        sessionStatus: 'running',
        observedAt: T2,
        sourceDigest: 'f'.repeat(64),
      }),
    );
    unwrap(
      runtime.observeSimulationRun({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:run-001',
        runId: SIMRUN_ID,
        runStatus: 'failed',
        observedAt: T3,
        sourceDigest: '1'.repeat(64),
      }),
    );
    unwrap(
      runtime.observeAction({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:action-001',
        actionId: ACTION_ID,
        actionStatus: 'executed',
        observedAt: T4,
        sourceDigest: '2'.repeat(64),
      }),
    );

    // 6. Health while conforming: healthy.
    const healthy = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T4 }),
    );
    expect(healthy.health?.status).toBe('healthy');
    expect(healthy.metrics.observationsTotal).toBe(6);
    expect(healthy.metrics.deniedTotal).toBe(1);

    // 7. A SECOND extension violates the isolation profile (t4 under
    // t2): the typed isolation-violation rejection + POLICY-DRIVEN
    // auto-quarantine.
    const violationError = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({
          extensionId: EXTENSION_ID_2,
          extensionManifestDigest: 'b'.repeat(64),
          trustClass: 't4',
        }),
        admittedAt: T5,
      }),
    );
    expect(violationError.code).toBe('isolation-violation');
    // The quarantined subject is denied-by-default on re-admission.
    const deniedReAdmission = expectError(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({
          extensionId: EXTENSION_ID_2,
          extensionManifestDigest: 'b'.repeat(64),
        }),
        admittedAt: T5,
      }),
    );
    expect(deniedReAdmission.code).toBe('quarantined-subject-rejected');

    const quarantined = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T5 }),
    );
    expect(quarantined.health?.status).toBe('critical');
    expect(quarantined.quarantinedSubjects).toContain(EXTENSION_ID_2);

    // 9. Release + recovery: the subject re-admits successfully.
    unwrap(
      runtime.releaseQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:ext-release-002',
        subjectId: EXTENSION_ID_2,
        reason: 'remediated and re-published at t2',
        actedAt: T6,
      }),
    );
    const remediated = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject({
          extensionId: EXTENSION_ID_2,
          extensionManifestDigest: 'b'.repeat(64),
        }),
        admittedAt: T7,
      }),
    );
    expect(remediated.verdict.verdict).toBe('conforms');
    const recovered = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T7 }),
    );
    expect(recovered.quarantinedSubjects).toEqual([]);

    // 10. The audit trail holds every observation, sorted.
    const trail = unwrap(
      runtime.readAuditTrail({ tenantId: TENANT, authorization: auth }),
    );
    expect(trail.length).toBe(9);
    const subjectTrail = unwrap(
      runtime.readAuditTrail({
        tenantId: TENANT,
        authorization: auth,
        subjectId: EXTENSION_ID,
      }),
    );
    expect(subjectTrail.length).toBe(3);

    // 11. The event streams: the subject stream carries the lifecycle.
    const stream = unwrap(
      runtime.readStream({
        tenantId: TENANT,
        authorization: auth,
        streamId: `stream:security-${EXTENSION_ID.slice('extension:'.length)}`,
      }),
    );
    expect(stream.length).toBeGreaterThanOrEqual(3);
    expect(stream[0]!.payload.discriminator).toBe('security:observation-recorded');
    expect(POLICY_ID).toMatch(/^security-policy:/);
    expect(LISTING_ID).toMatch(/^listing:/);
    expect(PRINCIPAL).toMatch(/^principal:/);
  });

  it('records a sandbox violation with policy-driven quarantine and derives degraded health', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));

    const recorded = unwrap(
      runtime.recordSandboxViolation({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:violation-001',
        extensionId: EXTENSION_ID,
        violationCode: 'session-identity-mismatch',
        observedAt: T2,
        sourceDigest: '3'.repeat(64),
      }),
    );
    expect(recorded.observation.observationClass).toBe('sandbox-violation');
    expect(recorded.observation.severity).toBe('critical');
    expect(recorded.quarantined).toBe(true);

    const state = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T3 }),
    );
    expect(state.health?.status).toBe('critical');
    expect(state.metrics.criticalViolations).toBe(1);
    expect(state.quarantinedSubjects).toEqual([EXTENSION_ID]);

    // The quarantined extension is denied re-admission (deny-by-default).
    const denied = runtime.admitExtension({
      tenantId: TENANT,
      authorization: auth,
      subject: conformingSubject(),
      admittedAt: T4,
    });
    expect(denied.ok).toBe(false);
    expect((denied as { ok: false; error: { code: string } }).error.code).toBe(
      'quarantined-subject-rejected',
    );
  });

  it('the host health projection degrades with quarantine and recovers with release', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    expect(runtime.health().status).toBe('healthy');
    expect(runtime.health().tenantCount).toBe(1);

    unwrap(
      runtime.imposeQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:ext-001',
        subjectKind: 'extension',
        subjectId: EXTENSION_ID,
        reason: 'acceptance fixture',
        actedAt: T2,
      }),
    );
    expect(runtime.health().status).toBe('degraded');
    expect(runtime.health().quarantinedSubjectCount).toBe(1);

    unwrap(
      runtime.releaseQuarantine({
        tenantId: TENANT,
        authorization: auth,
        quarantineId: 'quarantine:ext-release-001',
        subjectId: EXTENSION_ID,
        reason: 'remediated',
        actedAt: T3,
      }),
    );
    expect(runtime.health().status).toBe('healthy');
  });

  it('the audit pass records findings from both families and the health reflects them', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));

    // An ALLOWED cross-tenant boundary observation (a breach the audit
    // family must flag).
    unwrap(
      runtime.observeTenantBoundary({
        tenantId: TENANT,
        authorization: auth,
        observationId: 'observation:boundary-001',
        subjectId: TENANT,
        subjectTenantId: TENANT,
        actorTenantId: 'tenant:initech',
        outcome: 'allowed',
        observedAt: T1,
        sourceDigest: '4'.repeat(64),
      }),
    );

    const pass = unwrap(
      runtime.runAuditPass({
        tenantId: TENANT,
        authorization: auth,
        auditPassId: 'observation:audit-pass-001',
        auditedAt: T2,
      }),
    );
    expect(pass.tenantBoundaryFindings).toHaveLength(1);
    expect(pass.tenantBoundaryFindings[0]!.code).toBe('cross-tenant-breach');
    expect(pass.projectionFindings).toEqual([]);
    expect(pass.observations).toHaveLength(1);
    expect(pass.observations[0]!.observationClass).toBe('security-audit');

    const state = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T2 }),
    );
    expect(state.metrics.criticalViolations).toBe(1);
    expect(state.metrics.byClass['security-audit']).toBe(1);
  });
});
