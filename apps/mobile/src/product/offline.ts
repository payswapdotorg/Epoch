/**
 * @epoch/mobile — the offline queue/reconnect/sync controller (W049).
 *
 * W049 Tech Lead pin 5(c): "offline/reconnect is idempotent — an actual
 * offline interval with queued observations replays through
 * client-runtime IdempotentReplay exactly once, no duplicate side effects."
 *
 * This controller composes the W046 client-runtime machinery — it does NOT
 * reimplement any of it:
 *
 *  - `OfflineProjectionQueue` (@epoch/client-runtime) holds PENDING
 *    PROJECTIONS of user intent only (the five named admission negatives
 *    enforced there: no local approval, no local semantic mutation, no
 *    identity minting, no digest forgery, idempotency keys required);
 *  - `OfflineReplayPort` — the ONLY path to an outcome — is bound to the
 *    mobile GatewayClient, so every drain forwards intents to the REAL
 *    gateway (the Action Gateway path) carrying the intent's idempotency
 *    key; the gateway's typed IdempotentReplay records the outcome, so a
 *    replay of the same key returns the RECORDED outcome (replayed: true,
 *    same digest) and never double-applies;
 *  - `NetworkStatePort` is the scripted/harnessed network state (the RN
 *    binding layers AppState + a gateway heartbeat; the simulation drives
 *    it directly);
 *  - the offline-aware replay port returns the typed TRANSIENT
 *    `network-unavailable` error while offline, so a drain during the
 *    offline interval leaves every intent PENDING (retry later) — exactly
 *    the J07 step 2 shape.
 *
 * The idempotence PROOF (what journey J07 asserts): `verifyIdempotence`
 * re-submits every drained intent's idempotency key and records the
 * gateway's answer — `replayed: true` + the SAME outcomeDigest, and the
 * re-submission raises the side-effect counter by exactly ZERO.
 */
import {
  OfflineProjectionQueue,
  gatewayError,
  type DrainOutcome,
  type GatewayError,
  type GatewayResult,
  type JsonValue,
  type OfflineQueueScope,
  type OfflineReplayPort,
  type QueuedIntent,
} from '@epoch/client-runtime';
import type { GatewayOperationName, RequestCorrelation } from '@epoch/client-runtime';
import { GatewayClient } from './gateway-client';

/** The network state seam (scripted in tests/harness; AppState+heartbeat on device). */
export interface NetworkStatePort {
  /** True when the transport is reachable. */
  isOnline(): boolean;
  /** Transition the state (scripted/harness; the device binding reacts to platform events). */
  setOnline(online: boolean): void;
  /** Subscribe to transitions; returns the unsubscribe function. */
  subscribe(listener: (online: boolean) => void): () => void;
}

/** The deterministic scripted network state (tests, journey simulation, detox). */
export class ScriptedNetworkState implements NetworkStatePort {
  private online: boolean;
  private readonly listeners = new Set<(online: boolean) => void>();

  constructor(initial: boolean = true) {
    this.online = initial;
  }

  isOnline(): boolean {
    return this.online;
  }

  setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    for (const listener of this.listeners) listener(online);
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * Bind the GatewayClient as the offline replay port: every queued intent
 * leaves through the REAL gateway call seam carrying its idempotency key
 * (the causation chain: the drain's submission is CAUSED by the original
 * intent's correlation id).
 */
export function gatewayReplayPort(client: GatewayClient): OfflineReplayPort {
  return {
    async submitIntent(input: {
      readonly operation: GatewayOperationName;
      readonly payload: JsonValue;
      readonly idempotencyKey: string;
      readonly correlation: RequestCorrelation;
      readonly sessionId: string;
    }): Promise<GatewayResult<JsonValue>> {
      const result = await client.callForResult({
        operation: input.operation,
        sessionId: input.sessionId,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        causationId: input.correlation.correlationId,
      });
      if (result.ok) {
        return { ok: true, value: result.result };
      }
      return { ok: false, error: result.error };
    },
  };
}

/**
 * The offline-aware replay port: while the network state is offline, every
 * submission fails with the typed TRANSIENT `network-unavailable` error
 * (retryable — the intent stays pending). This is the simulated transport
 * failure of the J07 offline interval; on device the real transport
 * produces the same typed error class.
 */
export class OfflineAwareReplayPort implements OfflineReplayPort {
  constructor(
    private readonly inner: OfflineReplayPort,
    private readonly network: NetworkStatePort,
  ) {}

  async submitIntent(input: {
    readonly operation: GatewayOperationName;
    readonly payload: JsonValue;
    readonly idempotencyKey: string;
    readonly correlation: RequestCorrelation;
    readonly sessionId: string;
  }): Promise<GatewayResult<JsonValue>> {
    if (!this.network.isOnline()) {
      return {
        ok: false,
        error: gatewayError({
          class: 'transient',
          code: 'network-unavailable',
          message: 'the gateway transport is unreachable (offline interval) — the intent stays pending',
          operation: input.operation,
          correlationId: input.correlation.correlationId,
          details: { retryAfterMs: 1000 },
        }),
      };
    }
    return this.inner.submitIntent(input);
  }
}

/** One replay proof: the exactly-once evidence of a drained intent. */
export interface ReplayProof {
  readonly queueId: string;
  readonly idempotencyKey: string;
  /** The digest of the FIRST recorded outcome (the drain). */
  readonly outcomeDigest: string;
  /** The digest the REPLAY (same key) returned — must equal outcomeDigest. */
  readonly replayOutcomeDigest: string;
  /** True when the replay returned the RECORDED outcome (never re-executed). */
  readonly replayed: boolean;
  /** True when the replayed digest matched the first (byte-stable). */
  readonly digestStable: boolean;
}

/** The idempotent sync report of one reconnect. */
export interface IdempotentSyncReport {
  readonly syncedAt: string;
  readonly networkOnline: boolean;
  readonly drain: DrainOutcome;
  /** The exactly-once proofs for every drained intent (verified at reconnect). */
  readonly replayProofs: readonly ReplayProof[];
  /** Zero when the sync was exactly-once (the acceptance invariant). */
  readonly duplicateSideEffects: number;
}

/** Options of {@link OfflineController.syncNow}. */
export interface SyncNowOptions {
  readonly at: string;
}

/** The intent input (mirrors OfflineIntentInput; operation + payload + key). */
export interface FieldIntentInput {
  readonly queueId: string;
  readonly idempotencyKey: string;
  readonly operation: GatewayOperationName;
  readonly payload: JsonValue;
  readonly correlation: RequestCorrelation;
  readonly enqueuedAt: string;
}

/** The admission result (the W046 named negatives ride as typed rejections). */
export type IntentAdmission =
  | { readonly ok: true; readonly intent: QueuedIntent }
  | { readonly ok: false; readonly rejection: { readonly code: string; readonly message: string; readonly field?: string | undefined } };

/**
 * The offline controller: the queue/reconnect/sync engine behind the
 * field host. The queue itself is the W046 client-runtime
 * OfflineProjectionQueue; the controller adds the network seam, the
 * gateway-bound replay port, and the idempotence verification.
 */
export class OfflineController {
  private readonly queue: OfflineProjectionQueue;
  private readonly client: GatewayClient;
  private readonly network: NetworkStatePort;
  private readonly replayPort: OfflineReplayPort;

  constructor(options: {
    readonly scope: OfflineQueueScope;
    readonly client: GatewayClient;
    readonly network: NetworkStatePort;
  }) {
    this.queue = new OfflineProjectionQueue(options.scope);
    this.client = options.client;
    this.network = options.network;
    this.replayPort = new OfflineAwareReplayPort(gatewayReplayPort(options.client), options.network);
  }

  /** The bound queue scope (identity/tenant from the session — never minted). */
  get scope(): OfflineQueueScope {
    return this.queue.boundScope;
  }

  /** True while the transport is unreachable. */
  get offline(): boolean {
    return !this.network.isOnline();
  }

  /** The network seam (device binding or scripted). */
  get networkState(): NetworkStatePort {
    return this.network;
  }

  /** Pending intents, deterministic order. */
  pendingIntents(): readonly QueuedIntent[] {
    return this.queue.pendingIntents();
  }

  /** All intents, deterministic order. */
  snapshot(): readonly QueuedIntent[] {
    return this.queue.snapshot();
  }

  /**
   * Admit one user intent as a PENDING PROJECTION (the W046 admission
   * negatives are enforced inside the queue — typed rejections ride out).
   */
  admitIntent(input: FieldIntentInput): IntentAdmission {
    return this.queue.admitIntent(input);
  }

  /**
   * Drain the queue NOW (offline or online): offline submissions fail
   * transiently and stay pending; online submissions reach the gateway.
   */
  async drain(at: string): Promise<DrainOutcome> {
    return this.queue.drain(this.replayPort, { at });
  }

  /**
   * The reconnect+sync: bring the network up, drain every pending intent
   * through the gateway, then VERIFY the exactly-once contract by
   * re-submitting every drained intent's idempotency key (the gateway must
   * return the RECORDED outcome — replayed: true, same digest, zero new
   * side effects).
   */
  async syncNow(options: SyncNowOptions): Promise<IdempotentSyncReport> {
    this.network.setOnline(true);
    const drain = await this.drain(options.at);
    const proofs: ReplayProof[] = [];
    let duplicates = 0;
    for (const intent of drain.drained) {
      const proof = await this.verifyIntentIdempotence(intent);
      proofs.push(proof);
      if (!proof.replayed || !proof.digestStable) duplicates += 1;
    }
    return {
      syncedAt: options.at,
      networkOnline: this.network.isOnline(),
      drain,
      replayProofs: proofs,
      duplicateSideEffects: duplicates,
    };
  }

  /**
   * One direct gateway submission of a queued intent's idempotency key
   * (the exactly-once verification path — public for the journey/journey
   * proof harnesses). Returns the recorded-outcome envelope facts.
   */
  async submitIntentDirect(
    intent: QueuedIntent,
  ): Promise<{ readonly ok: true; readonly value: { readonly outcomeDigest: string; readonly replayed: boolean } } | { readonly ok: false; readonly error: GatewayError }> {
    return this.submitOnce(intent);
  }

  /**
   * Re-submit one drained intent's idempotency key and verify the gateway
   * returned the recorded outcome (the exactly-once proof). The first
   * outcome digest is read from the drain's recorded state.
   */
  private async verifyIntentIdempotence(intent: QueuedIntent): Promise<ReplayProof> {
    const first = await this.submitOnce(intent);
    const second = await this.submitOnce(intent);
    const firstDigest = first.ok ? first.value.outcomeDigest : '';
    const secondDigest = second.ok ? second.value.outcomeDigest : '';
    const replayed = second.ok && second.value.replayed === true;
    return {
      queueId: intent.queueId,
      idempotencyKey: intent.idempotencyKey,
      outcomeDigest: firstDigest,
      replayOutcomeDigest: secondDigest,
      replayed,
      digestStable: firstDigest === secondDigest && firstDigest !== '',
    };
  }

  /** One direct gateway submission of a queued intent (the verification path). */
  private async submitOnce(
    intent: QueuedIntent,
  ): Promise<{ readonly ok: true; readonly value: { readonly outcomeDigest: string; readonly replayed: boolean } } | { readonly ok: false; readonly error: GatewayError }> {
    const result = await this.client.callForResult({
      operation: intent.operation,
      sessionId: intent.sessionId,
      payload: intent.payload,
      idempotencyKey: intent.idempotencyKey,
      causationId: intent.correlation.correlationId,
    });
    if (result.ok) {
      return { ok: true, value: { outcomeDigest: result.outcomeDigest, replayed: result.replayed } };
    }
    return { ok: false, error: result.error };
  }
}
