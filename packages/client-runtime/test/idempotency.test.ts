// The typed IdempotentReplay: apply / replay / dedupe properties
// (W046 acceptance 6). Property set:
//  P1 apply-records-once: the first application executes and records;
//  P2 replay-returns-recorded-outcome: a replay returns the RECORDED
//     outcome and does NOT re-execute (executor not invoked);
//  P3 never-double-apply: after a replay, the underlying mutation count
//     is still 1;
//  P4 fingerprint-mismatch: the same key with a different fingerprint is
//     the typed conflict error (executor not invoked);
//  P5 retry-after-failure: a failed execution is not recorded; a retry
//     re-executes and then records.
import { describe, expect, it } from 'vitest';
import {
  InMemoryIdempotencyStore,
  applyIdempotent,
  computeRequestFingerprint,
  type IdempotencyStore,
} from '../src';
import { fail, gatewayError, ok as okResult } from '../src';

const AT = '2026-01-05T09:00:00.000Z';
const AT2 = '2026-01-05T09:05:00.000Z';
const ADDRESS = {
  operationKey: 'action.submit',
  idempotencyKey: 'idem:replay-test',
  requestFingerprint: computeRequestFingerprint({ proposal: 'p-1' }),
};

async function count(store: IdempotencyStore): Promise<number> {
  const record = await store.lookup(ADDRESS.operationKey, ADDRESS.idempotencyKey);
  return record === null ? 0 : 1;
}

describe('the typed IdempotentReplay (W046 acceptance 6)', () => {
  it('P1: the first application executes the executor exactly once and records the outcome', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;
    const result = await applyIdempotent(
      store,
      ADDRESS,
      async () => {
        executions += 1;
        return okResult({ applied: true, executions });
      },
      AT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('applied');
      expect(result.value.attempts).toBe(1);
      expect(result.value.recordedAt).toBe(AT);
      expect(result.value.outcome).toEqual({ applied: true, executions: 1 });
    }
    expect(executions).toBe(1);
    expect(await count(store)).toBe(1);
  });

  it('P2 + P3: a replay returns the recorded outcome and never re-executes (no double-apply)', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;
    const first = await applyIdempotent(
      store,
      ADDRESS,
      async () => {
        executions += 1;
        return okResult({ submission: 'accepted', serial: executions });
      },
      AT,
    );
    expect(first.ok && first.value.status).toBe('applied');

    // The underlying authority's state changes between the two calls: a
    // re-execution would observe it; a replay must NOT.
    executions = 100;
    const replay = await applyIdempotent(
      store,
      ADDRESS,
      async () => {
        executions += 1;
        return okResult({ submission: 'accepted', serial: executions });
      },
      AT2,
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.value.status).toBe('replayed');
      expect(replay.value.outcome).toEqual({ submission: 'accepted', serial: 1 });
      expect(replay.value.recordedAt).toBe(AT);
      expect(replay.value.attempts).toBe(2);
    }
    // P3: the executor ran exactly once for the original application.
    expect(executions).toBe(100);
  });

  it('P4: the same key with a different fingerprint is the typed conflict error (no execution)', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;
    const executor = async () => {
      executions += 1;
      return okResult({ ok: true });
    };
    await applyIdempotent(store, ADDRESS, executor, AT);
    const conflicting = {
      operationKey: ADDRESS.operationKey,
      idempotencyKey: ADDRESS.idempotencyKey,
      requestFingerprint: computeRequestFingerprint({ proposal: 'DIFFERENT' }),
    };
    const result = await applyIdempotent(store, conflicting, executor, AT2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('conflict');
      expect(result.error.code).toBe('idempotency-fingerprint-mismatch');
      expect(result.error.details?.recordedFingerprint).toBe(ADDRESS.requestFingerprint);
      expect(result.error.details?.requestFingerprint).toBe(conflicting.requestFingerprint);
    }
    expect(executions).toBe(1);
  });

  it('P5: a failed execution is not recorded; a retry re-executes and records', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;
    const failing = async () => {
      executions += 1;
      return fail(
        gatewayError({
          class: 'transient',
          code: 'network-unavailable',
          message: 'flaky',
          operation: 'action.submit',
          correlationId: 'corr:idem',
        }),
      );
    };
    const failed = await applyIdempotent(store, ADDRESS, failing, AT);
    expect(failed.ok).toBe(false);
    const afterFailure = await store.lookup(ADDRESS.operationKey, ADDRESS.idempotencyKey);
    expect(afterFailure?.status).toBe('reserved');
    expect(afterFailure?.outcome).toBeNull();

    const retried = await applyIdempotent(
      store,
      ADDRESS,
      async () => {
        executions += 1;
        return okResult({ recovered: true });
      },
      AT2,
    );
    expect(retried.ok && retried.value.status).toBe('applied');
    expect(retried.ok && retried.value.outcome).toEqual({ recovered: true });
    expect(executions).toBe(2);
  });

  it('distinct keys never collide (dedupe is per (operation, key, fingerprint))', async () => {
    const store = new InMemoryIdempotencyStore();
    const fingerprint = computeRequestFingerprint({ proposal: 'same-shape' });
    const first = await applyIdempotent(
      store,
      { operationKey: 'action.submit', idempotencyKey: 'idem:a', requestFingerprint: fingerprint },
      async () => okResult({ key: 'a' }),
      AT,
    );
    const second = await applyIdempotent(
      store,
      { operationKey: 'action.submit', idempotencyKey: 'idem:b', requestFingerprint: fingerprint },
      async () => okResult({ key: 'b' }),
      AT,
    );
    expect(first.ok && first.value.status).toBe('applied');
    expect(second.ok && second.value.status).toBe('applied');
    expect(first.ok && first.value.outcome).toEqual({ key: 'a' });
    expect(second.ok && second.value.outcome).toEqual({ key: 'b' });
    expect(store.size).toBe(2);
  });

  it('the in-memory store snapshot is deterministic (sorted by operation then key)', async () => {
    const store = new InMemoryIdempotencyStore();
    await applyIdempotent(store, { ...ADDRESS, idempotencyKey: 'idem:zzz' }, async () => okResult(1), AT);
    await applyIdempotent(store, { ...ADDRESS, idempotencyKey: 'idem:aaa' }, async () => okResult(2), AT);
    await applyIdempotent(
      store,
      { ...ADDRESS, operationKey: 'action.approve', idempotencyKey: 'idem:mmm' },
      async () => okResult(3),
      AT,
    );
    const snapshot = store.snapshot().map((record) => record.idempotencyKey);
    expect(snapshot).toEqual(['idem:mmm', 'idem:aaa', 'idem:zzz']);
  });
});
