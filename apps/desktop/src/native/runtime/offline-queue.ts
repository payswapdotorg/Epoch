/**
 * @epoch/desktop — the durable desktop offline queue (W048 pin 4b).
 *
 * THE NAMED NEGATIVE (b) ARTIFACT: offline/reconnect creates NO second
 * semantic store. The queue holds PENDING PROJECTIONS of user intent via
 * the client-runtime `OfflineProjectionQueue` (the five named-negative
 * admission gates run on every enqueue), persists ONLY those projection
 * records through the host durable store (surviving close/relaunch —
 * J12), and drains them THROUGH the bridge (the Application Gateway path)
 * with each intent's idempotency key — outcomes are produced exclusively
 * by the authority side; a replay of the same key returns the RECORDED
 * outcome (never double-apply).
 *
 * `test/native-offline-queue.test.ts` proves the full J07 semantics
 * against a REAL gateway: enqueue offline -> failed drain (stays pending)
 * -> reconnect drain (drained exactly once, recorded outcomeDigest) ->
 * idempotent replay (replayed: true, same digest) -> the durable store
 * audit shows ONLY projection records (no world/solution/delivery truth
 * was ever written locally).
 */
import {
  OfflineProjectionQueue,
  type DrainOutcome,
  type OfflineAdmission,
  type OfflineIntentInput,
  type OfflineQueueScope,
  type OfflineReplayPort,
  type QueuedIntent,
} from '@epoch/client-runtime';
import { admitPersistedRecord, sealPersistedRecord } from './protocol-gate';
import type { HostCommandPort } from '../ipc/host';

/** The durable key the queue projection records persist under. */
export const OFFLINE_QUEUE_DURABLE_KEY = 'epoch.offline.queue.v1';

/** The desktop offline queue: the client-runtime queue + durable persistence + drain. */
export class DesktopOfflineQueue {
  private readonly queue: OfflineProjectionQueue;
  private readonly host: HostCommandPort;

  constructor(options: {
    readonly host: HostCommandPort;
    readonly scope: OfflineQueueScope;
  }) {
    this.host = options.host;
    this.queue = new OfflineProjectionQueue(options.scope);
  }

  /** The bound session scope (identity/tenant come from the session — never minted). */
  get boundScope(): OfflineQueueScope {
    return this.queue.boundScope;
  }

  /** Number of queued intents (all states). */
  get size(): number {
    return this.queue.size;
  }

  /** All intents, deterministic order. */
  snapshot(): readonly QueuedIntent[] {
    return this.queue.snapshot();
  }

  /** Pending intents only (the offline badge in the UI). */
  pendingIntents(): readonly QueuedIntent[] {
    return this.queue.pendingIntents();
  }

  /**
   * Admit a user intent as a PENDING PROJECTION (the five named-negative
   * admission gates run inside) and persist the queue for relaunch.
   */
  async admit(input: OfflineIntentInput): Promise<OfflineAdmission> {
    const admission = this.queue.admitIntent(input);
    if (admission.ok) {
      await this.persist();
    }
    return admission;
  }

  /**
   * Drain the queue through the replay port (the bridge -> gateway path;
   * every intent carries its idempotency key). Transient failures keep
   * intents pending; success marks them drained. The drain outcome rides
   * the authority side — nothing semantic is computed locally.
   */
  async drain(
    port: OfflineReplayPort,
    options: { readonly at: string; readonly maxIntents?: number },
  ): Promise<DrainOutcome> {
    const outcome = await this.queue.drain(port, options);
    await this.persist();
    return outcome;
  }

  /** Persist the queue projection records (protocol-sealed). */
  async persist(): Promise<void> {
    const intents = this.queue.snapshot();
    await this.host.durable.set(
      OFFLINE_QUEUE_DURABLE_KEY,
      JSON.stringify(sealPersistedRecord({ scope: this.queue.boundScope, intents })),
    );
  }

  /**
   * Restore the persisted queue on relaunch (J12). Incompatible protocol
   * envelopes are REFUSED and discarded (the intents are gone — the user
   * re-enqueues; never a coerced open). Returns the restored intents.
   */
  async restore(): Promise<readonly QueuedIntent[] | null> {
    const raw = await this.host.durable.get(OFFLINE_QUEUE_DURABLE_KEY);
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    const admitted = admitPersistedRecord<{ scope: OfflineQueueScope; intents: QueuedIntent[] }>(parsed);
    if (!admitted.ok) return null;
    // Re-admit every restored intent through the SAME admission gates
    // (defense in depth: a tampered record cannot smuggle a forged
    // outcome/identity claim back into the queue).
    for (const intent of admitted.record.intents) {
      this.queue.admitIntent({
        queueId: intent.queueId,
        correlation: intent.correlation,
        idempotencyKey: intent.idempotencyKey,
        operation: intent.operation,
        payload: intent.payload,
        enqueuedAt: intent.enqueuedAt,
      });
    }
    return this.queue.snapshot();
  }

  /** Drop every queued intent (wipe / sign-out). */
  async clear(): Promise<void> {
    await this.host.durable.delete(OFFLINE_QUEUE_DURABLE_KEY);
    for (const intent of this.queue.snapshot()) {
      // The client-runtime queue has no removal API by design (replay
      // safety); a fresh queue is constructed by the product runtime
      // instead — this method only clears durable state.
      void intent;
    }
  }
}
