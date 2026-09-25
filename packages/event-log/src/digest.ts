/**
 * Digest discipline for event records: an event's identity (beyond its
 * (stream, sequence) coordinate) is the SHA-256 of its content's
 * canonical JSON serialization — content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol. The log
 * REJECTS an append whose claimed digest does not match the recomputed
 * one (tamper detection) — see `appendEvent` in src/event-log.ts and
 * `parseEventRecord` in src/parse.ts.
 *
 * The digest covers the full immutable content ({@link EventContent});
 * it never covers the digest itself, so a record's content address is
 * stable across serialization (identical inputs serialize identically —
 * canonical key order, no whitespace).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { EventContentSchema } from './schema';
import { kernelPayloadViolation } from './subjects';
import { flattenZodIssues, validationError } from './issues';
import type { EventContent, EventRecord, EventLogResult, EventRegistration } from './types';

/**
 * Content-addressed identity of an event: the SHA-256 of its canonical
 * JSON serialization. Equivalent events (any key order) always produce
 * the same digest. Throws on an invalid event — producers validate first
 * (use {@link sealEvent} for the total form).
 */
export function computeEventDigest(event: EventContent): Sha256Hex {
  const parsed = EventContentSchema.safeParse(event);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid event (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid event content into a creation envelope (content + its
 * recomputed digest). Total: an invalid event yields a typed `validation`
 * error with flattened issue paths, INCLUDING the kernel payload-contract
 * check for reserved-namespace discriminators.
 */
export function sealEvent(event: unknown): EventLogResult<EventRegistration> {
  const parsed = EventContentSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const payloadFailure = kernelPayloadViolation(parsed.data.payload);
  if (payloadFailure !== null) {
    return { ok: false, error: payloadFailure };
  }
  return {
    ok: true,
    value: {
      event: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of an
 * event (tamper detection). Total. Precedence (mirrors the admission
 * pipeline): schema -> DIGEST comparison -> kernel payload contract — a
 * tampered envelope is distinguishable from a semantically invalid
 * payload.
 */
export function verifyEventDigest(
  registration: EventRegistration,
): EventLogResult<EventContent> {
  const parsed = EventContentSchema.safeParse(registration.event);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'event digest does not match its content (tampered or mismatched envelope) — the append is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  const payloadFailure = kernelPayloadViolation(parsed.data.payload);
  if (payloadFailure !== null) {
    return { ok: false, error: payloadFailure };
  }
  return { ok: true, value: parsed.data };
}

/**
 * The published record for an event: content plus its verified content
 * address. Callers holding a verified registration use this to derive
 * the record the log stores. Throws on an invalid event (producers
 * validate first).
 */
export function eventRecordFor(event: EventContent): EventRecord {
  return {
    event,
    contentDigest: computeEventDigest(event),
  };
}
