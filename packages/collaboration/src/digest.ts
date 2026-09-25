/**
 * Digest discipline for collaboration records: a record's identity is the
 * SHA-256 of its content's canonical JSON serialization (content
 * addressing over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol). The hub REJECTS an append whose claimed digest
 * does not match the recomputed one (tamper detection).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { CollaborationSessionSchema, CollaborationEventSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  CollaborationEvent,
  CollaborationEventRegistration,
  CollaborationEventRecord,
  CollaborationResult,
  CollaborationSession,
  CollaborationSessionRecord,
  SessionRegistration,
} from './types';

/**
 * Content-addressed identity of a session record. Throws on an invalid
 * session — producers validate first (use {@link sealSession} for the
 * total form).
 */
export function computeSessionDigest(session: CollaborationSession): Sha256Hex {
  const parsed = CollaborationSessionSchema.safeParse(session);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid session (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal a valid session into a creation envelope. Total. */
export function sealSession(session: unknown): CollaborationResult<SessionRegistration> {
  const parsed = CollaborationSessionSchema.safeParse(session);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      session: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed session digest (tamper detection). Total. */
export function verifySessionDigest(
  registration: SessionRegistration,
): CollaborationResult<CollaborationSession> {
  const parsed = CollaborationSessionSchema.safeParse(registration.session);
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
          'session digest does not match its content (tampered or mismatched envelope) — the creation is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Content-addressed identity of a coordination event. Throws on an
 * invalid event — producers validate first (use {@link sealEvent}).
 */
export function computeEventDigest(event: CollaborationEvent): Sha256Hex {
  const parsed = CollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid collaboration event (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal a valid coordination event into a creation envelope. Total. */
export function sealEvent(
  event: unknown,
): CollaborationResult<CollaborationEventRegistration> {
  const parsed = CollaborationEventSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      event: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed coordination event digest (tamper detection). Total. */
export function verifyEventDigest(
  registration: CollaborationEventRegistration,
): CollaborationResult<CollaborationEvent> {
  const parsed = CollaborationEventSchema.safeParse(registration.event);
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
          'coordination event digest does not match its content (tampered or mismatched envelope) — the append is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The published session record for a verified session. */
export function sessionRecordFor(
  session: CollaborationSession,
): CollaborationSessionRecord {
  return {
    session,
    sessionDigest: computeSessionDigest(session),
  };
}

/** The published event record for a verified coordination event. */
export function eventRecordFor(
  event: CollaborationEvent,
): CollaborationEventRecord {
  return {
    event,
    contentDigest: computeEventDigest(event),
  };
}
