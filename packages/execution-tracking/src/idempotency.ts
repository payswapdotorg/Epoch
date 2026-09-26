/**
 * Deterministic idempotency keys for execution-tracking intake (the
 * W020/W022/W037 replay pin, exported for the service layer so it
 * derives keys without a runtime dependency on @epoch/agent-protocol).
 *
 * Every keyed operation derives its key as the SHA-256 of the canonical
 * JSON of a typed key scope — a pure function of the operation's
 * identity, never of wall-clock or arrival order. A replayed intake
 * (same idempotency key) returns the sealed prior record (the typed
 * `duplicate-observation` admission at the observation store); the same
 * key bound to different content is a typed version conflict; distinct
 * operations never collide (SHA-256 over disjoint canonical scopes).
 */
import type { Sha256Hex } from '@epoch/agent-protocol';
import { canonicalDigest } from './primitives';

/** The idempotency key of one execution-tracking intake (a canonical SHA-256). */
export type ExecutionIntakeKey = Sha256Hex;

/**
 * The idempotency key of an observation admission: the SHA-256 of the
 * canonical JSON of `{tenantId, idempotencyKey}` — the caller-supplied
 * key scoped to its tenant. The SAME observation payload under the same
 * key derives the same key and replays as the typed
 * `duplicate-observation` admission returning the prior digest; the same
 * key bound to a DIFFERENT observation digest is a typed
 * `version-conflict` (a key grounds exactly one observation content).
 */
export function deriveObservationReplayKey(input: {
  readonly tenantId: string;
  readonly idempotencyKey: string;
}): ExecutionIntakeKey {
  return canonicalDigest({
    scope: 'execution-observation-replay',
    tenantId: input.tenantId,
    idempotencyKey: input.idempotencyKey,
  });
}

/**
 * The idempotency key of an execution event admission: the SHA-256 of
 * the canonical JSON of `{streamId, sequence, contentDigest}` — the
 * event's exact coordinate within its stream.
 */
export function deriveExecutionEventKey(input: {
  readonly streamId: string;
  readonly sequence: number;
  readonly contentDigest: string;
}): ExecutionIntakeKey {
  return canonicalDigest({
    scope: 'execution-event-admission',
    streamId: input.streamId,
    sequence: input.sequence,
    contentDigest: input.contentDigest,
  });
}
