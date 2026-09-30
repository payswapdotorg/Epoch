'use client';
/**
 * @epoch/web — the offline queue + idempotent replay drain (W047, J07).
 *
 * The web client's offline admission: a queueable user intent (a PENDING
 * PROJECTION — never local semantic state) is admitted when the gateway is
 * unreachable, persisted to localStorage, and drained on the user's
 * explicit "Sync now" action through `recovery.replay` — every intent
 * replays through the Action Gateway path with its idempotency key; a
 * replay of the same key returns the RECORDED outcome (never double-apply).
 *
 * The queue is ONE provider-scoped instance (D-03): the shell status
 * region, the Understand evidence panel and the Realize observation panel
 * all observe the SAME queue state — an enqueue from any stage is visible
 * everywhere (the earlier per-hook-instance state never propagated to the
 * shell footer). The queue is bound to the session scope; the named
 * admission negatives are enforced client-side BEFORE queueing (only
 * genuinely transient failures may queue — authority rejections and
 * validation errors never do).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { callGateway } from './transport';
import { envelope } from './envelopes';
import { useSession } from './session';
import type { GatewayRequestEnvelope, JsonValue, GatewayOperationName } from '@epoch/client-runtime';
import type { PersistedIntent, ProductSession, UiGatewayCallResult } from '../product/types';

const QUEUE_STORAGE_KEY = 'epoch.web.offline-queue.v1';

function readQueue(): PersistedIntent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw === null) return [];
    return JSON.parse(raw) as PersistedIntent[];
  } catch {
    return [];
  }
}

function storeQueue(intents: readonly PersistedIntent[]): void {
  if (typeof window === 'undefined') return;
  if (intents.length === 0) {
    window.localStorage.removeItem(QUEUE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(intents));
}

/** The authoritative per-intent outcome of one `recovery.replay` drain. */
export interface DrainOutcome {
  readonly queueId: string;
  readonly status: string;
  readonly outcomeDigest?: string;
  readonly replayed?: boolean;
  readonly errorCode?: string;
}

/** One replay drain result (kept for consumers resolving their intents). */
export interface DrainResult {
  readonly drainedAt: string;
  readonly outcomes: readonly DrainOutcome[];
}

/** The queue API shared by the shell + every stage surface. */
export interface OfflineQueueApi {
  readonly intents: readonly PersistedIntent[];
  readonly draining: boolean;
  readonly lastDrain: DrainResult | null;
  enqueue(input: {
    readonly operation: GatewayOperationName;
    readonly payload: JsonValue;
    readonly idempotencyKey: string;
    readonly reason: UiGatewayCallResult;
  }): boolean;
  drain(): Promise<UiGatewayCallResult | null>;
}

const OfflineQueueContext = createContext<OfflineQueueApi | null>(null);

/**
 * The offline-queue provider: ONE queue instance for the whole product
 * (the shell status region + all stage surfaces observe the same state).
 * The drain is the explicit user action ("Sync now") through
 * recovery.replay — matching the J07 scenario's explicit reconnect-drain
 * step (no silent auto-drain that could race the user's confirmation).
 */
export function OfflineQueueProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const { session } = useSession();
  const [intents, setIntents] = useState<PersistedIntent[]>([]);
  const [draining, setDraining] = useState(false);
  const [lastDrain, setLastDrain] = useState<DrainResult | null>(null);
  const sessionRef = useRef<ProductSession | null>(session);
  sessionRef.current = session;

  useEffect(() => {
    setIntents(readQueue());
  }, []);

  const enqueue = useCallback(
    (input: {
      readonly operation: GatewayOperationName;
      readonly payload: JsonValue;
      readonly idempotencyKey: string;
      readonly reason: UiGatewayCallResult;
    }): boolean => {
      // Admission negatives (client-side mirrors of the runtime admission):
      // only genuinely transient failures may queue — authority rejections
      // and validation errors are never retried offline.
      if (input.reason.ok || input.reason.error.class !== 'transient') return false;
      if (input.idempotencyKey === '') return false;
      const current = readQueue();
      if (current.some((intent) => intent.idempotencyKey === input.idempotencyKey)) {
        // Already queued under the same key — never double-queue.
        return true;
      }
      const intent: PersistedIntent = {
        queueId: `queue:${input.idempotencyKey.replace('idem:', 'web')}-${current.length + 1}`,
        sessionId: sessionRef.current?.sessionId ?? 'session:unknown',
        correlationId: input.reason.ok ? '' : input.reason.error.correlationId,
        idempotencyKey: input.idempotencyKey,
        operation: input.operation,
        payload: input.payload,
        enqueuedAt: new Date().toISOString(),
        state: 'pending',
        attempts: 0,
        lastErrorCode: input.reason.ok ? undefined : input.reason.error.code,
      };
      const next = [...current, intent];
      storeQueue(next);
      setIntents(next);
      return true;
    },
    [],
  );

  const drain = useCallback(async (): Promise<UiGatewayCallResult | null> => {
    const current = sessionRef.current;
    if (current === null) return null;
    const pending = readQueue().filter((intent) => intent.state === 'pending');
    if (pending.length === 0) return null;
    setDraining(true);
    try {
      const result = await callGateway(
        envelope(
          'recovery.replay',
          current,
          {
            intents: pending.map((intent) => ({
              queueId: intent.queueId,
              idempotencyKey: intent.idempotencyKey,
              operation: intent.operation,
              payload: intent.payload,
            })),
          },
          { idempotencyKey: `idem:drain-${Date.now().toString(36)}` },
        ),
      );
      // Update the persisted states from the drain outcomes.
      const outcomes = result.ok
        ? (((result.value.result as unknown as { outcomes?: DrainOutcome[] }).outcomes) ?? [])
        : [];
      const updated = readQueue().map((intent) => {
        const outcome = outcomes.find((entry) => entry.queueId === intent.queueId);
        if (outcome === undefined) return intent;
        if (outcome.status === 'drained') {
          return { ...intent, state: 'drained' as const, attempts: intent.attempts + 1 };
        }
        if (outcome.status === 'still-pending') {
          return { ...intent, state: 'pending' as const, attempts: intent.attempts + 1, lastErrorCode: outcome.errorCode };
        }
        return { ...intent, state: 'rejected' as const, attempts: intent.attempts + 1, lastErrorCode: outcome.errorCode };
      });
      storeQueue(updated);
      setIntents(updated);
      setLastDrain({ drainedAt: new Date().toISOString(), outcomes });
      return result;
    } finally {
      setDraining(false);
    }
  }, []);

  const value = useMemo<OfflineQueueApi>(
    () => ({ intents, draining, lastDrain, enqueue, drain }),
    [intents, draining, lastDrain, enqueue, drain],
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

/** The offline-queue context hook (the shared instance; fails loudly outside the provider). */
export function useOfflineQueue(): OfflineQueueApi {
  const value = useContext(OfflineQueueContext);
  if (value === null) throw new Error('useOfflineQueue requires the OfflineQueueProvider');
  return value;
}

/**
 * The queueing call wrapper: performs a gateway call; when the network is
 * unavailable (typed transient) and the operation is queueable, the intent
 * is admitted to the offline queue (the queue panel renders the pending
 * state; the returned error stays the typed transient error).
 */
export function queueingCall(
  call: () => Promise<UiGatewayCallResult>,
  enqueue: (input: {
    readonly operation: GatewayOperationName;
    readonly payload: JsonValue;
    readonly idempotencyKey: string;
    readonly reason: UiGatewayCallResult;
  }) => boolean,
  request: GatewayRequestEnvelope,
): Promise<UiGatewayCallResult> {
  return call().then((result) => {
    if (!result.ok) {
      enqueue({
        operation: request.operation,
        payload: request.payload,
        idempotencyKey: request.idempotencyKey ?? '',
        reason: result,
      });
    }
    return result;
  });
}

/** Clear drained/rejected intents (manual cleanup). */
export function clearFinishedIntents(): void {
  const remaining = readQueue().filter((intent) => intent.state === 'pending');
  storeQueue(remaining);
}
