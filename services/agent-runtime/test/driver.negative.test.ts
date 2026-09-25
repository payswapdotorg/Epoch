// Driver negatives (named, typed): cross-tenant event intake denied;
// duplicate events suppressed; unknown action references (uncorrelated
// events) rejected; non-action payloads rejected; malformed events
// rejected with precise paths; contradictory facts on settled steps are
// lifecycle conflicts.
import { describe, expect, it } from 'vitest';
import { sealEvent } from '@epoch/event-log';
import { SESSION_ID, TENANT, T2, T3, fixtureRuntime, lifecycleEventFixture, startedSession } from './helpers';

describe('agent-runtime driver (negative)', () => {
  it('rejects a cross-tenant event with cross-tenant-denied (R12)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({
        phase: 'executed',
        sequence: 1,
        tenantId: 'tenant:bridge',
      }),
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
      if (result.error.code === 'cross-tenant-denied') {
        expect(result.error.expectedTenantId).toBe(TENANT);
        expect(result.error.encounteredTenantId).toBe('tenant:bridge');
      }
    }
  });

  it('rejects cross-tenant session READ access with cross-tenant-denied', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const result = runtime.getSession({
      tenantId: 'tenant:bridge',
      sessionId: SESSION_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
    }
  });

  it('suppresses a duplicate event with the state unchanged (idempotent replay)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const event = lifecycleEventFixture({ phase: 'executed', sequence: 1 });
    const first = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event,
      at: T2,
    });
    if (!first.ok) throw new Error(first.error.message);
    const before = runtime.snapshot();
    const duplicate = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event,
      at: T3,
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe('duplicate-suppressed');
      if (duplicate.error.code === 'duplicate-suppressed') {
        expect(duplicate.error.sessionId).toBe(SESSION_ID);
      }
    }
    // Idempotency: the host state is byte-identical.
    expect(runtime.snapshot()).toEqual(before);
  });

  it('rejects an uncorrelated action event with unknown-action-reference', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({
        proposalId: 'prop-not-in-plan',
        phase: 'executed',
        sequence: 1,
      }),
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-action-reference');
      if (result.error.code === 'unknown-action-reference') {
        expect(result.error.proposalId).toBe('prop-not-in-plan');
      }
    }
  });

  it('rejects a stale-revision proposal event with unknown-action-reference', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({
        proposalId: 'prop-survey-001',
        canonicalDigest: 'c'.repeat(64),
        phase: 'executed',
        sequence: 1,
      }),
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-action-reference');
    }
  });

  it('rejects a non-action payload with a precise path (validation)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    // A GENUINELY sealed world:subjects fact — valid W010 record, wrong
    // payload family for orchestration intake.
    const sealed = sealEvent({
      schemaVersion: 1,
      streamId: 'stream:world-a',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:lead-eng',
      causalParent: null,
      payload: {
        discriminator: 'world:subjects',
        data: { subjects: [{ kind: 'entity', entityId: 'element:column-c4' }] },
      },
      occurredAt: T2,
    });
    if (!sealed.ok) throw new Error(sealed.error.message);
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: { event: sealed.value.event, contentDigest: sealed.value.digest },
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(
          result.error.issues.some((issue) => issue.path === 'event.payload.discriminator'),
        ).toBe(true);
      }
    }
  });

  it('rejects a malformed event record with a precise path (validation)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: { event: { sequence: 'not-a-number' } },
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path.startsWith('event.'))).toBe(true);
      }
    }
  });

  it('rejects a fact contradicting settled history (lifecycle-conflict)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    const contradictory = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'failed', sequence: 2 }),
      at: T3,
    });
    expect(contradictory.ok).toBe(false);
    if (!contradictory.ok) {
      expect(contradictory.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects a pre-dispatch lifecycle fact on a pending step (lifecycle-conflict)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    // 'analyze' is still pending (its dependency has not executed).
    const result = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({
        proposalId: 'prop-analyze-001',
        phase: 'authorized',
        sequence: 1,
      }),
      at: T2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });
});
