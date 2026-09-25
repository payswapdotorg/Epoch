/**
 * Digest discipline for experience-runtime documents: a device-session
 * record's identity at a revision is the SHA-256 of the canonical JSON
 * serialization of its content (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol — reused,
 * never mirrored). Admission REJECTS a sealed record whose claimed digest
 * does not match the recomputed one (tamper detection).
 *
 * Determinism: canonical JSON sorts object keys, and the record schemas
 * enforce consistent derived indices, so semantically equal records
 * serialize to identical bytes and their digests are stable.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  DeviceSessionContentSchema,
  DeviceSessionRecordSchema,
  type DeviceSessionContent,
  type DeviceSessionRecord,
} from './session';
import {
  RuntimeEventTraceContentSchema,
  RuntimeEventTraceSchema,
  type RuntimeEventTrace,
  type RuntimeEventTraceContent,
} from './events';
import { malformedRecordError } from './issues';
import type { ExperienceRuntimeResult } from './errors';

function firstIssueMessage(error: Parameters<typeof malformedRecordError>[0]): string {
  const first = malformedRecordError(error).issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

/**
 * Deterministic serialization of a sealed device-session record (canonical
 * JSON: sorted keys, no insignificant whitespace). Throws on an invalid
 * record — producers validate first ({@link parseDeviceSessionRecord} in
 * src/parse.ts is the total form).
 */
export function serializeDeviceSessionRecord(record: DeviceSessionRecord): string {
  const parsed = DeviceSessionRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid device-session record (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Deterministic serialization of a sealed event trace. Throws on an
 * invalid trace.
 */
export function serializeRuntimeEventTrace(trace: RuntimeEventTrace): string {
  const parsed = RuntimeEventTraceSchema.safeParse(trace);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid event trace (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of a device session: the SHA-256 of the canonical JSON of
 * the CONTENT (every field except `digest` itself). Throws on invalid
 * content.
 */
export function computeDeviceSessionDigest(content: DeviceSessionContent): Sha256Hex {
  const parsed = DeviceSessionContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid device-session record (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of an event trace. Throws on invalid content.
 */
export function computeRuntimeEventTraceDigest(content: RuntimeEventTraceContent): Sha256Hex {
  const parsed = RuntimeEventTraceContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(`cannot digest an invalid event trace (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid device-session content into a sealed record (content + its
 * recomputed digest). Total: invalid content yields a typed
 * `malformed-record` error with flattened issue paths.
 */
export function sealDeviceSession(content: unknown): ExperienceRuntimeResult<DeviceSessionRecord> {
  const parsed = DeviceSessionContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Seal valid event-trace content into a sealed trace record. Total:
 * invalid content yields a typed `malformed-record` error.
 */
export function sealRuntimeEventTrace(
  content: unknown,
): ExperienceRuntimeResult<RuntimeEventTrace> {
  const parsed = RuntimeEventTraceContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * device-session record (tamper detection). Total: schema-invalid records
 * yield a typed `malformed-record` error; digest skew yields
 * `digest-mismatch` with expected and encountered values.
 */
export function verifyDeviceSessionDigest(
  record: unknown,
): ExperienceRuntimeResult<DeviceSessionContent> {
  const parsed = DeviceSessionRecordSchema.safeParse(record);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'device-session digest does not match its content (tampered or mismatched record) — the document is rejected',
        path: ['digest'],
        expected,
        encountered: digest,
      },
    };
  }
  return { ok: true, value: content };
}

/**
 * Verify a claimed digest against the recomputed content digest of an
 * event trace (tamper detection). Total; see
 * {@link verifyDeviceSessionDigest}.
 */
export function verifyRuntimeEventTraceDigest(
  trace: unknown,
): ExperienceRuntimeResult<RuntimeEventTraceContent> {
  const parsed = RuntimeEventTraceSchema.safeParse(trace);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'event-trace digest does not match its content (tampered or mismatched record) — the document is rejected',
        path: ['digest'],
        expected,
        encountered: digest,
      },
    };
  }
  return { ok: true, value: content };
}
