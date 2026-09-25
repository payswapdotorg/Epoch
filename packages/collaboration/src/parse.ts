/**
 * Total admission surface for serialized collaboration documents.
 *
 * `parseCollaborationSession`, `parseCollaborationEvent`, and
 * `parseCollaborationSnapshot` never throw: every failure is a typed
 * {@link CollaborationError}.
 *
 * Admission precedence (fixed): root shape (`validation`) -> version
 * gate (`version-unsupported`) -> schema gate (`validation` with dotted
 * paths; strict objects reject unknown fields) -> digest gate
 * (`digest-mismatch`) -> member gate (`validation`). The snapshot gate
 * additionally checks canonical (sessionId, sequence) ordering and
 * coordinate uniqueness.
 */
import {
  CollaborationEventSchema,
  CollaborationSessionSchema,
  CollaborationSnapshotSchema,
} from './schema';
import { validationError } from './issues';
import { computeEventDigest, verifyEventDigest, verifySessionDigest } from './digest';
import type {
  CollaborationError,
  CollaborationEvent,
  CollaborationEventRecord,
  CollaborationResult,
  CollaborationSession,
  CollaborationSnapshot,
} from './types';

function rootShapeError(): CollaborationError {
  return {
    code: 'validation',
    message: 'collaboration document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): CollaborationError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const source = (input as Record<string, unknown>).schemaVersion;
  if (typeof source === 'number' && source !== 1) {
    return {
      code: 'version-unsupported',
      message: `collaboration record version mismatch: expected 1, encountered ${source}`,
      expected: '1',
      encountered: String(source),
    };
  }
  return null;
}

/** Parse, validate, and admit one serialized session record. Total. */
export function parseCollaborationSession(
  input: unknown,
): CollaborationResult<CollaborationSession> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = CollaborationSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse, validate, and admit one serialized coordination event record. Total. */
export function parseCollaborationEventRecord(
  input: unknown,
): CollaborationResult<CollaborationEventRecord> {
  const versionFailure = versionGate(
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>).event
      : input,
  );
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = CollaborationEventSchema.safeParse(
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>).event
      : input,
  );
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  // Digest gate: recompute against the claimed digest when present.
  if (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).contentDigest === 'string'
  ) {
    const verified = verifyEventDigest({
      event: parsed.data,
      digest: (input as Record<string, unknown>).contentDigest as string,
    });
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }
  }
  return {
    ok: true,
    value: { event: parsed.data, contentDigest: recordDigestOf(parsed.data) },
  };
}

/** Parse, validate, and admit one serialized whole-hub snapshot. Total. */
export function parseCollaborationSnapshot(
  input: unknown,
): CollaborationResult<CollaborationSnapshot> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = CollaborationSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const snapshot = parsed.data;

  // Session records: digest-verified.
  for (const [index, sessionRecord] of snapshot.sessions.entries()) {
    const verified = verifySessionDigest({
      session: sessionRecord.session,
      digest: sessionRecord.sessionDigest,
    });
    if (!verified.ok) {
      return {
        ok: false,
        error: {
          ...verified.error,
          message: `sessions[${index}]: ${verified.error.message}`,
        },
      };
    }
  }

  // Event records: digest-verified, canonically ordered, unique coordinates.
  const coordinates = new Set<string>();
  let previous: { sessionId: string; sequence: number } | null = null;
  for (const [index, eventRecord] of snapshot.events.entries()) {
    const verified = verifyEventDigest({
      event: eventRecord.event,
      digest: eventRecord.contentDigest,
    });
    if (!verified.ok) {
      return {
        ok: false,
        error: {
          ...verified.error,
          message: `events[${index}]: ${verified.error.message}`,
        },
      };
    }
    const coordinate = `${eventRecord.event.sessionId}#${eventRecord.event.sequence}`;
    if (coordinates.has(coordinate)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `duplicate journal coordinate ${coordinate} in snapshot`,
          issues: [
            {
              path: `events[${index}]`,
              message: `journal coordinate ${coordinate} already appeared`,
            },
          ],
        },
      };
    }
    coordinates.add(coordinate);
    if (
      previous !== null &&
      (eventRecord.event.sessionId < previous.sessionId ||
        (eventRecord.event.sessionId === previous.sessionId &&
          eventRecord.event.sequence <= previous.sequence))
    ) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'snapshot events are not canonically sorted by (sessionId, sequence)',
          issues: [
            {
              path: `events[${index}]`,
              message: `expected a coordinate after ${previous.sessionId}#${previous.sequence}, encountered ${coordinate}`,
            },
          ],
        },
      };
    }
    previous = { sessionId: eventRecord.event.sessionId, sequence: eventRecord.event.sequence };
  }
  return { ok: true, value: snapshot };
}

/** The recomputed content digest of an event. */
function recordDigestOf(event: CollaborationEvent): string {
  return computeEventDigest(event);
}
