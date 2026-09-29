// Offline admission: PENDING PROJECTIONS ONLY, with the FIVE NAMED
// NEGATIVES (W046 acceptance 8). Each negative has a named test that
// FAILS if the prohibition is violated — i.e. the test asserts the
// prohibition HOLDS (the queue rejects the violating admission and never
// produces local authority).
import { describe, expect, it } from 'vitest';
import {
  OfflineProjectionQueue,
  fail,
  gatewayError,
  ok,
  type GatewayOperationName,
  type GatewayResult,
  type JsonValue,
  type OfflineReplayPort,
  type QueuedIntent,
} from '../src';

const SCOPE = {
  schemaVersion: 1 as const,
  sessionId: 'session:offline-test',
  principalId: 'principal:field-engineer',
  tenantId: 'tenant:globex',
};

const CORRELATION = {
  schemaVersion: 1 as const,
  correlationId: 'corr:offline-test',
  origin: 'mobile' as const,
  issuedAt: '2026-01-05T08:00:00.000Z',
};

const ENQUEUED_AT = '2026-01-05T08:10:00.000Z';
const DRAIN_AT = '2026-01-05T09:00:00.000Z';

function queue(): OfflineProjectionQueue {
  return new OfflineProjectionQueue(SCOPE);
}

/** A spy replay port: records every submit call; never produces outcomes locally. */
class SpyPort implements OfflineReplayPort {
  public readonly calls: Array<{ operation: string; idempotencyKey: string }> = [];
  private readonly responder: () => GatewayResult<JsonValue>;

  constructor(responder: () => GatewayResult<JsonValue> = () => ok({ received: true })) {
    this.responder = responder;
  }

  async submitIntent(input: {
    readonly operation: GatewayOperationName;
    readonly payload: JsonValue;
    readonly idempotencyKey: string;
  }): Promise<GatewayResult<JsonValue>> {
    this.calls.push({ operation: input.operation, idempotencyKey: input.idempotencyKey });
    return this.responder();
  }
}

describe('offline admission — pending projections only (W046 acceptance 8)', () => {
  it('a well-formed queueable intent is admitted as a PENDING projection', () => {
    const admitted = queue().admitIntent({
      queueId: 'queue:ok-1',
      correlation: CORRELATION,
      idempotencyKey: 'idem:ok-1',
      operation: 'delivery.observe',
      payload: { capture: 'field-observation-1' },
      enqueuedAt: ENQUEUED_AT,
    });
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.intent.state).toBe('pending');
      expect(admitted.intent.attempts).toBe(0);
    }
  });

  it('NEGATIVE (e): an intent without an idempotency key is rejected (replay must go through the Action Gateway with keys)', () => {
    const admitted = queue().admitIntent({
      queueId: 'queue:no-key',
      correlation: CORRELATION,
      idempotencyKey: undefined,
      operation: 'action.submit',
      payload: { proposal: 'p' },
      enqueuedAt: ENQUEUED_AT,
    });
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.rejection.code).toBe('idempotency-key-required');
    }
  });

  it('NEGATIVE (e): drain forwards every intent to the replay port WITH its idempotency key', async () => {
    const q = queue();
    q.admitIntent({
      queueId: 'queue:drain-1',
      correlation: CORRELATION,
      idempotencyKey: 'idem:drain-1',
      operation: 'action.submit',
      payload: { proposal: 'p' },
      enqueuedAt: ENQUEUED_AT,
    });
    const port = new SpyPort();
    const outcome = await q.drain(port, { at: DRAIN_AT });
    expect(port.calls).toEqual([{ operation: 'action.submit', idempotencyKey: 'idem:drain-1' }]);
    expect(outcome.drained).toHaveLength(1);
    expect(outcome.drained[0]?.state).toBe('drained');
  });

  it('NEGATIVE (a): an intent payload carrying a local outcome/approval claim is rejected — no local approval ever counts as authority', () => {
    const q = queue();
    for (const field of ['outcome', 'approved', 'approvalResult', 'decision']) {
      const admitted = q.admitIntent({
        queueId: `queue:forged-${field}`,
        correlation: CORRELATION,
        idempotencyKey: 'idem:forged',
        operation: 'action.approve',
        payload: { [field]: { approved: true, by: 'principal:field-engineer' } },
        enqueuedAt: ENQUEUED_AT,
      });
      expect(admitted.ok, `field ${field} must be rejected`).toBe(false);
      if (!admitted.ok) {
        expect(admitted.rejection.code).toBe('local-approval-not-authority');
      }
    }
  });

  it('NEGATIVE (a): outcomes are produced ONLY by the replay port — drain never fabricates an outcome locally', async () => {
    const q = queue();
    q.admitIntent({
      queueId: 'queue:no-local-outcome',
      correlation: CORRELATION,
      idempotencyKey: 'idem:no-local-outcome',
      operation: 'evidence.intake',
      payload: { artifact: 'photo-1' },
      enqueuedAt: ENQUEUED_AT,
    });
    // A port that fails: the intent must NOT be drained (no local success).
    const failing = new SpyPort(() =>
      fail(
        gatewayError({
          class: 'transient',
          code: 'network-unavailable',
          message: 'offline',
          operation: 'evidence.intake',
          correlationId: 'corr:offline-test',
        }),
      ),
    );
    const outcome = await q.drain(failing, { at: DRAIN_AT });
    expect(outcome.drained).toHaveLength(0);
    expect(outcome.stillPending).toHaveLength(1);
    expect(outcome.stillPending[0]?.state).toBe('pending');
    // The queued payload is still the ORIGINAL pending projection.
    expect(outcome.stillPending[0]?.payload).toEqual({ artifact: 'photo-1' });
  });

  it('NEGATIVE (b): a semantic-truth mutation intent (World/Solution/Delivery/ProgramOfWork truth) is rejected', () => {
    const q = queue();
    const semanticMutations = [
      'solution.sealVersion',
      'solution.approveBaseline',
      'program.build',
      'delivery.open',
      'delivery.close',
      'session.issue',
      'procurement.order',
    ] as const;
    for (const operation of semanticMutations) {
      const admitted = q.admitIntent({
        queueId: `queue:semantic-${operation.replace('.', '-')}`,
        correlation: CORRELATION,
        idempotencyKey: 'idem:semantic',
        operation,
        payload: { intent: 'mutate semantic truth locally' },
        enqueuedAt: ENQUEUED_AT,
      });
      expect(admitted.ok, `${operation} must not be queueable`).toBe(false);
      if (!admitted.ok) {
        expect(admitted.rejection.code).toBe('local-semantic-mutation-rejected');
      }
    }
  });

  it('NEGATIVE (b): drain of an admitted intent never mutates authority state directly (only the port path runs)', async () => {
    const q = queue();
    q.admitIntent({
      queueId: 'queue:port-only',
      correlation: CORRELATION,
      idempotencyKey: 'idem:port-only',
      operation: 'delivery.observe',
      payload: { observation: 1 },
      enqueuedAt: ENQUEUED_AT,
    });
    const authorityMutations: string[] = [];
    const port: OfflineReplayPort = {
      async submitIntent() {
        authorityMutations.push('mutated-through-port');
        return ok({ accepted: true });
      },
    };
    await q.drain(port, { at: DRAIN_AT });
    // The ONLY mutation happened inside the port (the authority side).
    expect(authorityMutations).toEqual(['mutated-through-port']);
    const drained = q.snapshot().find((intent: QueuedIntent) => intent.queueId === 'queue:port-only');
    expect(drained?.state).toBe('drained');
    // And the drained record STILL carries the pending projection payload
    // (the queue never stores a semantic outcome).
    expect(drained?.payload).toEqual({ observation: 1 });
  });

  it('NEGATIVE (c): an intent that mints identity/tenancy locally is rejected', () => {
    const q = queue();
    const minting = queue().admitIntent({
      queueId: 'queue:mint-tenant',
      correlation: CORRELATION,
      idempotencyKey: 'idem:mint',
      operation: 'action.submit',
      payload: { newTenantId: 'tenant:made-up' },
      enqueuedAt: ENQUEUED_AT,
    });
    expect(minting.ok).toBe(false);
    if (!minting.ok) {
      expect(minting.rejection.code).toBe('local-identity-minting-rejected');
    }
    // Cross-scope acting: payload asserts a different tenant than the session.
    const crossScope = q.admitIntent({
      queueId: 'queue:cross-tenant',
      correlation: CORRELATION,
      idempotencyKey: 'idem:cross',
      operation: 'action.submit',
      payload: { tenantId: 'tenant:initech' },
      enqueuedAt: ENQUEUED_AT,
    });
    expect(crossScope.ok).toBe(false);
    if (!crossScope.ok) {
      expect(crossScope.rejection.code).toBe('local-identity-minting-rejected');
    }
    // A payload that asserts the SAME scope is fine.
    const sameScope = q.admitIntent({
      queueId: 'queue:scope-ok',
      correlation: CORRELATION,
      idempotencyKey: 'idem:scope-ok',
      operation: 'action.submit',
      payload: { tenantId: SCOPE.tenantId, principalId: SCOPE.principalId },
      enqueuedAt: ENQUEUED_AT,
    });
    expect(sameScope.ok).toBe(true);
  });

  it('NEGATIVE (d): an intent carrying a local digest/verification claim is rejected', () => {
    const q = queue();
    for (const field of ['verified', 'verification', 'proof', 'attestation', 'attestedDigest']) {
      const admitted = q.admitIntent({
        queueId: `queue:forgery-${field}`,
        correlation: CORRELATION,
        idempotencyKey: 'idem:forgery',
        operation: 'evidence.intake',
        payload: { [field]: 'a'.repeat(64) },
        enqueuedAt: ENQUEUED_AT,
      });
      expect(admitted.ok, `field ${field} must be rejected`).toBe(false);
      if (!admitted.ok) {
        expect(admitted.rejection.code).toBe('local-digest-forgery-rejected');
      }
    }
  });

  it('rejected intents never enter the queue (admission is all-or-nothing)', () => {
    const q = queue();
    const bad = q.admitIntent({
      queueId: 'queue:never-stored',
      correlation: CORRELATION,
      idempotencyKey: 'idem:never',
      operation: 'delivery.close',
      payload: {},
      enqueuedAt: ENQUEUED_AT,
    });
    expect(bad.ok).toBe(false);
    expect(q.size).toBe(0);
  });

  it('drain keeps transient failures pending (retry later)', async () => {
    const q = queue();
    q.admitIntent({
      queueId: 'queue:transient',
      correlation: CORRELATION,
      idempotencyKey: 'idem:transient',
      operation: 'action.submit',
      payload: {},
      enqueuedAt: ENQUEUED_AT,
    });
    const port = new SpyPort(() =>
      fail(
        gatewayError({
          class: 'transient',
          code: 'connector-unavailable',
          message: 'offline',
          operation: 'action.submit',
          correlationId: 'corr:offline-test',
        }),
      ),
    );
    const outcome = await q.drain(port, { at: DRAIN_AT });
    expect(outcome.drained).toHaveLength(0);
    expect(outcome.rejected).toHaveLength(0);
    expect(outcome.stillPending).toHaveLength(1);
    expect(outcome.stillPending[0]?.state).toBe('pending');
    expect(outcome.stillPending[0]?.lastErrorCode).toBe('connector-unavailable');
    expect(outcome.stillPending[0]?.attempts).toBe(1);
  });

  it('drain rejects intents the authority rejects (non-transient)', async () => {
    const q = queue();
    q.admitIntent({
      queueId: 'queue:authority-rejected',
      correlation: CORRELATION,
      idempotencyKey: 'idem:authority-rejected',
      operation: 'action.submit',
      payload: {},
      enqueuedAt: ENQUEUED_AT,
    });
    const port = new SpyPort(() =>
      fail(
        gatewayError({
          class: 'authority-rejected',
          code: 'authority-denied',
          message: 'denied by the Action Gateway',
          operation: 'action.submit',
          correlationId: 'corr:offline-test',
        }),
      ),
    );
    const outcome = await q.drain(port, { at: DRAIN_AT });
    expect(outcome.drained).toHaveLength(0);
    expect(outcome.stillPending).toHaveLength(0);
    expect(outcome.rejected).toHaveLength(1);
    expect(outcome.rejected[0]?.state).toBe('rejected');
    expect(outcome.rejected[0]?.lastErrorCode).toBe('authority-denied');
  });

  it('drain respects maxIntents (bounded drains for retry loops)', async () => {
    const q = queue();
    for (const id of ['queue:bounded-1', 'queue:bounded-2']) {
      q.admitIntent({
        queueId: id,
        correlation: CORRELATION,
        idempotencyKey: `idem:${id.replace('queue:', '')}`,
        operation: 'evidence.intake',
        payload: {},
        enqueuedAt: ENQUEUED_AT,
      });
    }
    const port = new SpyPort();
    const outcome = await q.drain(port, { at: DRAIN_AT, maxIntents: 1 });
    expect(outcome.drained).toHaveLength(1);
    expect(outcome.stillPending).toHaveLength(1);
    expect(port.calls).toHaveLength(1);
  });
});
