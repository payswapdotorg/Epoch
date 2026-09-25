/**
 * Deterministic idempotency keys (the W020 replay/idempotency pin).
 *
 * Every keyed operation derives its key as the SHA-256 of the canonical
 * JSON of a typed key scope — a pure function of the operation's identity,
 * never of wall-clock or arrival order. Re-running an operation whose key
 * was already consumed yields the typed `duplicate-suppressed` negative
 * with the state unchanged (idempotent replay); distinct operations never
 * collide (SHA-256 over disjoint canonical scopes).
 */
import { canonicalDigest } from '@epoch/agent-protocol';
import type { EventRecord } from '@epoch/event-log';
import type { IdempotencyKey, SessionId } from './types';

/**
 * The idempotency key of an event intake against a session: the SHA-256 of
 * the canonical JSON of `{sessionId, streamId, sequence, contentDigest}` —
 * the event's exact coordinate within the session's scope. The same event
 * (identical content, identical coordinate) always derives the same key;
 * any different event derives a different one.
 */
export function deriveEventIdempotencyKey(input: {
  readonly sessionId: SessionId;
  readonly event: EventRecord;
}): IdempotencyKey {
  return canonicalDigest({
    scope: 'event-intake',
    sessionId: input.sessionId,
    streamId: input.event.event.streamId,
    sequence: input.event.event.sequence,
    contentDigest: input.event.contentDigest,
  });
}

/**
 * The idempotency key of a session creation: the SHA-256 of the canonical
 * JSON of `{sessionId, planDigest}` — re-creating a session for the SAME
 * compiled plan is the same operation (suppressed as a duplicate);
 * re-creating one for a DIFFERENT plan is a different operation (and is
 * rejected with `lifecycle-conflict` by the runtime, never silently
 * rewritten).
 */
export function deriveSessionIdempotencyKey(input: {
  readonly sessionId: SessionId;
  readonly planDigest: string;
}): IdempotencyKey {
  return canonicalDigest({
    scope: 'session-creation',
    sessionId: input.sessionId,
    planDigest: input.planDigest,
  });
}
