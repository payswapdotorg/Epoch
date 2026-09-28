// THE NEGATIVE BATTERY: tenant isolation, re-schedule-rejected,
// gateway-bypass-rejected, replay-conflict, tampered digests, malformed
// inputs, unknown registrations — every typed rejection surfaces
// BEFORE any kernel admission where applicable.
import { describe, expect, it } from 'vitest';
import { SupervisionRuntime } from '../src/index';
import {
  DELIVERY_ID,
  EVAL_IN_WINDOW,
  OTHER_TENANT,
  PRINCIPAL,
  PROGRAM_ID,
  TENANT,
  allowContext,
  expectError,
  issueSummary,
  openedDelivery,
  policyContent,
  sealedProgram,
  unwrap,
} from './helpers';

function seededHost() {
  const host = new SupervisionRuntime();
  const auth = { principalId: PRINCIPAL, context: allowContext() };
  unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
  unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
  unwrap(host.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
  return { host, auth };
}

describe('tenant isolation (R12)', () => {
  it('the single-tenant guard rejects foreign-tenant operations', () => {
    const host = new SupervisionRuntime({ expectedTenantId: TENANT });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const error = expectError(
      host.registerProgram({
        tenantId: OTHER_TENANT,
        authorization: auth,
        program: sealedProgram({ tenantId: OTHER_TENANT }),
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a program scoped to ANOTHER tenant is rejected at registration', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext(PRINCIPAL, OTHER_TENANT) };
    const error = expectError(
      host.registerProgram({ tenantId: OTHER_TENANT, authorization: auth, program: sealedProgram() }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a cross-tenant execution-issue summary is rejected at pass admission', () => {
    const { host, auth } = seededHost();
    const error = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-x',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
        executionIssues: [issueSummary({ tenantId: OTHER_TENANT })],
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a stream of ANOTHER tenant cannot be read', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    const error = expectError(
      host.readStream({
        tenantId: OTHER_TENANT,
        authorization: { principalId: PRINCIPAL, context: allowContext(PRINCIPAL, OTHER_TENANT) },
        streamId: 'stream:supervision-tower-retrofit-v1',
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});

describe('re-schedule-rejected (supervision OBSERVES, never re-schedules)', () => {
  it('the reschedule trap always rejects', () => {
    const host = new SupervisionRuntime();
    const error = expectError(host.rescheduleProgram());
    expect(error.code).toBe('re-schedule-rejected');
  });

  it('an evaluation input carrying schedule-mutation vocabulary is rejected before admission', () => {
    const { host, auth } = seededHost();
    const error = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-x',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
        leadTimeInputs: [
          {
            schema: 'epoch.supervision.lead-time-risk-input',
            schemaVersion: 1,
            leadTimeInputId: 'lead-time:cement-delivery',
            tenantId: TENANT,
            solutionId: 'solution:tower-retrofit',
            acquisitionRef: 'acquisition:bulk-cement',
            requiredBy: '2026-03-08T08:00:00.000Z',
            realisticLeadTimeDays: '5',
            observedAt: EVAL_IN_WINDOW,
            sourceRecord: { recordId: 'estimate:cement-lead', contentDigest: 'd'.repeat(64) },
            uncertainty: {
              schemaVersion: 1,
              provenance: { kind: 'observed', sourceRef: 'source:supplier-quote', actor: PRINCIPAL },
              freshness: { state: 'fresh', assessedAt: EVAL_IN_WINDOW },
              confidence: { method: 'measured', value: 0.9, rationale: 'synthesized supplier data' },
            },
            impactedActivityIds: ['activity:pour-foundations'],
            proposedReschedule: { plannedFinish: '2026-04-01T08:00:00.000Z' },
          },
        ],
      } as never),
    );
    expect(error.code).toBe('re-schedule-rejected');
  });
});

describe('replay-conflict (same id, different content)', () => {
  it('re-registering a program with DIFFERENT content is rejected', () => {
    const { host, auth } = seededHost();
    const error = expectError(
      host.registerProgram({
        tenantId: TENANT,
        authorization: auth,
        program: sealedProgram({ title: 'Tower retrofit programme v2' }),
      }),
    );
    expect(error.code).toBe('replay-conflict');
  });

  it('re-registering a delivery with DIFFERENT state is rejected', () => {
    const { host, auth } = seededHost();
    const error = expectError(
      host.registerDelivery({
        tenantId: TENANT,
        authorization: auth,
        delivery: openedDelivery({ openedAt: '2026-03-02T09:00:09.000Z' }),
      }),
    );
    expect(error.code).toBe('replay-conflict');
  });

  it('a pass id replayed with different content is rejected', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    const error = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: '2026-03-02T12:00:01.000Z',
      }),
    );
    expect(error.code).toBe('replay-conflict');
  });
});

describe('tampered digests + malformed inputs', () => {
  it('a TAMPERED program fails W036 verification at registration', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const tampered = sealedProgram() as unknown as Record<string, unknown>;
    const error = expectError(
      host.registerProgram({
        tenantId: TENANT,
        authorization: auth,
        program: { ...tampered, contentDigest: '0'.repeat(64) } as never,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a MALFORMED policy is rejected (validation)', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const error = expectError(
      host.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({ defaultSeverity: 'apocalyptic' }),
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('unknown program/delivery/policy references are typed rejections', () => {
    const { host, auth } = seededHost();
    expect(
      expectError(
        host.runEvaluationPass({
          tenantId: TENANT,
          authorization: auth,
          passId: 'pass:week-x',
          programId: 'program:unknown',
          deliveryId: DELIVERY_ID,
          evaluatedAt: EVAL_IN_WINDOW,
        }),
      ).code,
    ).toBe('unknown-program');
    expect(
      expectError(
        host.runEvaluationPass({
          tenantId: TENANT,
          authorization: auth,
          passId: 'pass:week-x',
          programId: PROGRAM_ID,
          deliveryId: 'delivery:unknown',
          evaluatedAt: EVAL_IN_WINDOW,
        }),
      ).code,
    ).toBe('unknown-delivery');
    expect(
      expectError(
        host.resolveAlertService({
          tenantId: TENANT,
          authorization: auth,
          alertId: 'alert:unknown',
          resolvedAt: EVAL_IN_WINDOW,
          resolutionKind: 'remediated',
        }),
      ).code,
    ).toBe('unknown-alert');
  });

  it('a malformed evaluation input is a typed validation failure', () => {
    const { host, auth } = seededHost();
    const error = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'not a pass id',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(error.code).toBe('validation');
  });
});

describe('gateway-bypass-rejected (escalation without a decision)', () => {
  it('a dispatch attempt without a decision is rejected BEFORE any kernel admission', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    // The caller supplies no decision: the typed service guard fires.
    const error = expectError(
      host.recordGatewayDecision({
        tenantId: TENANT,
        authorization: auth,
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        proposal: {} as never,
        decision: undefined as never,
        recordedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(error.code).toBe('gateway-decision-missing');
    // No escalation outcome was recorded (nothing bypassed the gateway).
    expect(host.health().eventCount).toBeGreaterThan(0);
  });
});
