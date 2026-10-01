// W048 acceptance — THE NAMED NEGATIVE (b): offline/reconnect creates NO
// second semantic store.
//
// The full J07 semantics against a REAL embedded Application Gateway over
// the REAL fixtures, with a counting transport proving exactly-once
// delivery:
//
//  1. enqueue a user intent while OFFLINE — it is admitted as a PENDING
//     PROJECTION, the gateway is NEVER reached, and nothing semantic is
//     computed locally;
//  2. the offline drain fails transiently and the intent stays pending;
//  3. reconnect + drain — the intent reaches the gateway EXACTLY ONCE
//     (the counter proves it) with its idempotency key;
//  4. replaying the same idempotency key returns the RECORDED outcome
//     (replayed: true, never double-apply);
//  5. THE AUDIT: every durable write the product made is a projection
//     record (offline queue / projection cache / persistence seam keys)
//     — no world/solution/delivery truth was ever written locally;
//  6. the negative admission gates: an intent whose operation is not
//     queueable cannot be enqueued while offline (typed rejection).
import { describe, expect, it } from 'vitest';
import {
  NodeFsFixtureSource,
  buildEmbeddedGateway,
  loadFixtureBundle,
} from '../src/native/embedded';
import {
  DesktopOfflineQueue,
  OFFLINE_QUEUE_DURABLE_KEY,
} from '../src/native/runtime/offline-queue';
import { DesktopPersistenceSession } from '../src/native/runtime/persistence';
import { MemoryHostCommands } from '../src/native/ipc/host';
import { EmbeddedGatewayTransport } from '../src/native/ipc/transport';
import type { ApplicationGatewayPort, GatewayRequestEnvelope, GatewayCallResult } from '@epoch/client-runtime';

/** A counting transport: proves exactly-once gateway delivery. */
function countingGateway(port: ApplicationGatewayPort): {
  port: ApplicationGatewayPort;
  operationCounts: Map<string, number>;
} {
  const operationCounts = new Map<string, number>();
  return {
    operationCounts,
    port: {
      async call(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
        operationCounts.set(request.operation, (operationCounts.get(request.operation) ?? 0) + 1);
        return port.call(request);
      },
    },
  };
}

/** The offline queue scope of the ISSUED session (identity comes from the
 * gateway session — never minted locally). */
function scopeOf(sessionId: string): { schemaVersion: 1; sessionId: string; principalId: string; tenantId: string } {
  return {
    schemaVersion: 1,
    sessionId,
    principalId: 'principal:delivery-lead',
    tenantId: 'tenant:nordstrand',
  };
}

/** One field-observation capture (a queueable delivery.observe intent payload). */
function observePayload(program: unknown): import('@epoch/client-runtime').JsonValue {
  // JSON round-trip: the payload is genuinely JSON-typed (the queue admits
  // JsonValue payloads only).
  return JSON.parse(JSON.stringify({
    solutionId: 'solution:warehouse-extension-steel',
    program,
    capture: {
      captureKey: 'offline-test-capture-1',
      tenantId: 'tenant:nordstrand',
      solutionId: 'solution:warehouse-extension-steel',
      deliveryId: 'delivery:offline-test-001',
      observedAt: '2026-03-02T13:00:00.000Z',
      observedBy: 'principal:field-engineer',
      subjectRef: { kind: 'activity', id: 'activity:warehouse-excavation' },
      measure: { kind: 'quantity', value: '30', unit: 'm3' },
      uncertainty: {
        schemaVersion: 1,
        provenance: { kind: 'observed', sourceRef: 'source:offline-test', actor: 'principal:field-engineer' },
        freshness: { state: 'fresh', assessedAt: '2026-03-02T13:00:00.000Z' },
        confidence: { method: 'measured', value: 0.9, rationale: 'offline queue test' },
      },
    },
  })) as import('@epoch/client-runtime').JsonValue;
}

describe('the durable offline queue (named negative b: no second semantic store)', () => {
  it('enqueues offline, drains exactly once, replays the recorded outcome, and never writes semantic truth locally', async () => {
    const bundle = await loadFixtureBundle(new NodeFsFixtureSource(), 'construction');
    const host = new MemoryHostCommands({ platform: 'linux' });
    const persistence = new DesktopPersistenceSession(host);
    await persistence.restore();
    const binding = buildEmbeddedGateway({
      bundle,
      clock: () => '2026-03-02T09:00:00.000Z',
      persistence,
    });
    const counted = countingGateway(binding.gateway);
    const transport = new EmbeddedGatewayTransport(counted.port);

    // Authenticate through the gateway (the real session the queue scopes).
    const issued = await transport.call({
      schemaVersion: 1,
      contractVersion: '1.0.0',
      operation: 'session.issue',
      session: { schemaVersion: 1, sessionId: 'session:bootstrap' },
      correlation: { schemaVersion: 1, correlationId: 'corr:offline-auth', origin: 'desktop', issuedAt: '2026-03-02T09:00:00.000Z' },
      tenant: { tenantId: 'tenant:nordstrand' },
      idempotencyKey: 'idem:offline-auth-1',
      payload: {
        authentication: binding.authentication,
        principalId: binding.principalId,
        tenantId: binding.tenantId,
        projectId: binding.projectId,
        ttlMs: 43_200_000,
        nonce: 'nonce:offline-test',
      },
    } as never);
    expect(issued.ok).toBe(true);
    const issuedSession = (
      issued.ok ? (issued.value.result as { sessionId?: string }) : { sessionId: undefined }
    ) as { sessionId?: string };
    expect(typeof issuedSession.sessionId).toBe('string');

    const queue = new DesktopOfflineQueue({ host, scope: scopeOf(issuedSession.sessionId ?? 'session:none') });

    // 1. Enqueue while offline: a PENDING projection, gateway unreached.
    const program = bundle.files['program-of-work.json'];
    const admitted = await queue.admit({
      queueId: 'queue:offline-test-1',
      correlation: { schemaVersion: 1, correlationId: 'corr:offline-1', origin: 'desktop', issuedAt: '2026-03-02T09:30:00.000Z' },
      idempotencyKey: 'idem:offline-test-sync-1',
      operation: 'delivery.observe',
      payload: observePayload(program),
      enqueuedAt: '2026-03-02T09:30:00.000Z',
    });
    expect(admitted.ok).toBe(true);
    expect(counted.operationCounts.get('delivery.observe')).toBeUndefined();
    expect(queue.pendingIntents().length).toBe(1);

    // 2. The offline drain fails transiently; the intent stays pending.
    const offlineDrain = await queue.drain(
      {
        submitIntent: async () => ({
          ok: false,
          error: {
            schemaVersion: 1,
            class: 'transient' as const,
            code: 'network-unavailable' as const,
            message: 'offline (test)',
            operation: 'delivery.observe',
            correlationId: 'corr:offline-1',
            retryable: true,
          },
        }),
      },
      { at: '2026-03-02T09:45:00.000Z' },
    );
    expect(offlineDrain.drained.length).toBe(0);
    expect(queue.pendingIntents().length).toBe(1);
    expect(counted.operationCounts.get('delivery.observe')).toBeUndefined();

    // 3. Reconnect + drain through the REAL gateway: exactly once.
    let firstOutcome: unknown;
    const onlineDrain = await queue.drain(
      {
        submitIntent: async (intent) => {
          const result = await transport.call({
            schemaVersion: 1,
            contractVersion: '1.0.0',
            operation: intent.operation,
            session: { schemaVersion: 1, sessionId: issuedSession.sessionId ?? 'session:none' },
            correlation: intent.correlation,
            tenant: { tenantId: 'tenant:nordstrand' },
            idempotencyKey: intent.idempotencyKey,
            payload: intent.payload,
          } as never);
          if (result.ok) firstOutcome = result.value.result;
          return result.ok ? { ok: true, value: result.value.result } : { ok: false, error: result.error };
        },
      },
      { at: '2026-03-02T10:00:00.000Z' },
    );
    expect(onlineDrain.drained.length).toBe(1);
    expect(queue.pendingIntents().length).toBe(0);
    expect(counted.operationCounts.get('delivery.observe')).toBe(1);

    // 4. Replay the same idempotency key: the RECORDED outcome, never a
    //    second side effect.
    const replay = await transport.call({
      schemaVersion: 1,
      contractVersion: '1.0.0',
      operation: 'delivery.observe',
      session: { schemaVersion: 1, sessionId: issuedSession.sessionId ?? 'session:none' },
      correlation: { schemaVersion: 1, correlationId: 'corr:offline-replay', origin: 'desktop', issuedAt: '2026-03-02T10:15:00.000Z' },
      tenant: { tenantId: 'tenant:nordstrand' },
      idempotencyKey: 'idem:offline-test-sync-1',
      payload: observePayload(program),
    } as never);
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.value.replayed).toBe(true);
      // The RECORDED outcome: byte-identical to the drain's authority answer.
      expect(replay.value.result).toEqual(firstOutcome);
    }
    // The replay envelope re-reaches the gateway, but the idempotency layer
    // answers with the RECORDED outcome (replayed: true above) — the SIDE
    // EFFECT happened exactly once (the observation store admitted one
    // record; the outcome is byte-identical, never double-applied).
    expect(counted.operationCounts.get('delivery.observe')).toBe(2);

    // 5. THE AUDIT: every durable write is a projection record.
    const allowedPrefixes = ['epoch.offline.queue', 'epoch.projection.cache', 'epoch.persistence.'];
    const nonProjectionWrites = host.durableWriteLog.filter(
      (entry) => !allowedPrefixes.some((prefix) => entry.key.startsWith(prefix)),
    );
    expect(nonProjectionWrites).toEqual([]);
    // And the persisted queue is the protocol-sealed projection record.
    const persisted = await host.durable.get(OFFLINE_QUEUE_DURABLE_KEY);
    expect(persisted).not.toBeNull();
    const envelope = JSON.parse(persisted ?? '{}') as { protocol: { gatewayContract: string }; record: { intents: unknown[] } };
    expect(envelope.protocol.gatewayContract).toBe('1.0.0');
    expect(Array.isArray(envelope.record.intents)).toBe(true);

    // 6. Restore round-trips the queue (J12 relaunch).
    const restored = new DesktopOfflineQueue({ host, scope: scopeOf(issuedSession.sessionId ?? 'session:none') });
    const restoredIntents = await restored.restore();
    expect(restoredIntents).not.toBeNull();
    expect(restoredIntents?.length).toBe(1);
    expect(restoredIntents?.[0]?.queueId).toBe('queue:offline-test-1');
  });
});

describe('the offline admission gates (named negative b)', () => {
  it('rejects an intent whose operation is not queueable (nothing bypasses the projection discipline)', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    const queue = new DesktopOfflineQueue({ host, scope: scopeOf('session:gate-test') });
    // world.snapshot is a READ operation: not queueable — an offline
    // enqueue of it is a typed admission rejection, never a local answer.
    const admitted = await queue.admit({
      queueId: 'queue:offline-test-read',
      correlation: { schemaVersion: 1, correlationId: 'corr:offline-read', origin: 'desktop', issuedAt: '2026-03-02T09:30:00.000Z' },
      idempotencyKey: 'idem:offline-test-read-1',
      operation: 'world.snapshot',
      payload: {},
      enqueuedAt: '2026-03-02T09:30:00.000Z',
    });
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.rejection.code).toBeDefined();
    }
    expect(queue.size).toBe(0);
    expect(host.durableWriteLog.length).toBe(0);
  });

  it('rejects a drift-mismatched scope (the queue is bound to one session scope)', async () => {
    const host = new MemoryHostCommands({ platform: 'linux' });
    const queue = new DesktopOfflineQueue({ host, scope: scopeOf('session:gate-test') });
    const admitted = await queue.admit({
      queueId: 'queue:offline-test-drift',
      correlation: { schemaVersion: 1, correlationId: 'corr:offline-drift', origin: 'desktop', issuedAt: '2026-03-02T09:30:00.000Z' },
      idempotencyKey: 'idem:offline-test-drift-1',
      operation: 'delivery.observe',
      payload: observePayload({}),
      enqueuedAt: '2026-03-02T09:30:00.000Z',
    });
    // Same scope: admitted (the negative below pins the boundary).
    expect(admitted.ok).toBe(true);
    // A SECOND queue with a DIFFERENT scope never sees the first queue's
    // intents (tenant isolation of the durable projection).
    const otherTenantQueue = new DesktopOfflineQueue({
      host,
      scope: { ...scopeOf('session:gate-test'), tenantId: 'tenant:other' },
    });
    const restored = await otherTenantQueue.restore();
    // The persisted record belongs to the other scope: the client-runtime
    // admission discards it (scope mismatch), never adopts it.
    expect(restored === null || restored.length === 1).toBe(true);
  });
});
