/**
 * Deterministic idempotency keys for procurement intake (the W020/W022
 * replay pin, exported for the service layer so it derives keys without
 * a runtime dependency on @epoch/agent-protocol).
 *
 * Every keyed operation derives its key as the SHA-256 of the canonical
 * JSON of a typed key scope — a pure function of the operation's
 * identity, never of wall-clock or arrival order. A replayed intake
 * (same idempotency key) returns the sealed prior record (the typed
 * `duplicate-intake-returned` admission at the service layer); distinct
 * operations never collide (SHA-256 over disjoint canonical scopes).
 */
import type { Sha256Hex } from '@epoch/agent-protocol';
import { canonicalDigest } from './primitives';

/** The idempotency key of one procurement intake (a canonical SHA-256). */
export type ProcurementIntakeKey = Sha256Hex;

/**
 * The idempotency key of a procurement record intake: the SHA-256 of
 * the canonical JSON of `{tenantId, subject, contentDigest}` — the
 * record's exact content address within its tenant scope. Re-admitting
 * the same sealed record derives the same key; any different record
 * derives a different one.
 */
export function deriveProcurementIntakeKey(input: {
  readonly tenantId: string;
  readonly subject: string;
  readonly contentDigest: string;
}): ProcurementIntakeKey {
  return canonicalDigest({
    scope: 'procurement-intake',
    tenantId: input.tenantId,
    subject: input.subject,
    contentDigest: input.contentDigest,
  });
}

/**
 * The idempotency key of a procurement event admission: the SHA-256 of
 * the canonical JSON of `{streamId, sequence, contentDigest}` — the
 * event's exact coordinate within its stream.
 */
export function deriveProcurementEventKey(input: {
  readonly streamId: string;
  readonly sequence: number;
  readonly contentDigest: string;
}): ProcurementIntakeKey {
  return canonicalDigest({
    scope: 'procurement-event-admission',
    streamId: input.streamId,
    sequence: input.sequence,
    contentDigest: input.contentDigest,
  });
}
