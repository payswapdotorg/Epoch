/**
 * Total admission surface for serialized event-log documents.
 *
 * `parseEventRecord` and `parseEventLogSnapshot` never throw: every
 * failure is a typed {@link EventLogError}.
 *
 * Admission precedence (fixed, so consumers branch deterministically; the
 * record half of the `appendEvent` pipeline):
 *
 * 1. root shape — a non-object root is a `validation` error;
 * 2. version gate — a numeric `schemaVersion` that differs from 1 fails
 *    fast with `version-unsupported`;
 * 3. schema gate — full zod validation; strict objects reject unknown
 *    (vendor) fields; the intra-stream causal shape is refined; failures
 *    surface as `validation` with precise dotted paths;
 * 4. digest gate — the claimed digest must match the recomputed canonical
 *    SHA-256 (`digest-mismatch`);
 * 5. kernel payload gate — reserved-namespace payload data must satisfy
 *    the kernel payload contracts (`validation`);
 * 6. snapshot gate (snapshots only) — records must be canonically sorted
 *    by (streamId, sequence), coordinates unique, each stream
 *    single-tenant, and the claimed stream projection consistent
 *    (`validation` / `cross-tenant-denied`).
 */
import { EventRecordSchema, EventLogSnapshotSchema } from './schema';
import { kernelPayloadViolation } from './subjects';
import { validationError } from './issues';
import { verifyEventDigest } from './digest';
import type {
  EventLogError,
  EventLogResult,
  EventLogSnapshot,
  EventRecord,
  EventStreamId,
} from './types';

function rootShapeError(path: string): EventLogError {
  return {
    code: 'validation',
    message: 'event-log document root must be a JSON object',
    issues: [{ path, message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown, path: string): EventLogError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError(path);
  }
  const source = (input as Record<string, unknown>).schemaVersion;
  if (typeof source === 'number' && source !== 1) {
    return {
      code: 'version-unsupported',
      message: `event-log record version mismatch: expected 1, encountered ${source}`,
      expected: '1',
      encountered: String(source),
    };
  }
  return null;
}

/**
 * Parse, validate, and admit one serialized event record (content + its
 * claimed content digest). Total; see the module docs for the fixed
 * precedence of typed errors.
 */
export function parseEventRecord(input: unknown): EventLogResult<EventRecord> {
  const versionFailure = versionGate(input, '$');
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = EventRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  const payloadFailure = kernelPayloadViolation(record.event.payload);
  if (payloadFailure !== null) {
    return { ok: false, error: rePath(payloadFailure, '') };
  }
  const verified = verifyEventDigest({ event: record.event, digest: record.contentDigest });
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: record };
}

/**
 * Parse, validate, and admit one serialized whole-log snapshot: every
 * record passes the full record pipeline, the record list must be
 * canonically sorted by (streamId, sequence) with unique coordinates, each
 * stream single-tenant, and the claimed stream projection consistent with
 * the records. Total; never throws.
 */
export function parseEventLogSnapshot(input: unknown): EventLogResult<EventLogSnapshot> {
  const versionFailure = versionGate(input, '$');
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = EventLogSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const snapshot = parsed.data;

  // Snapshot gate: canonical (streamId, sequence) ordering, unique
  // coordinates, single-tenant streams, consistent projection.
  const coordinates = new Set<string>();
  let previous: { streamId: EventStreamId; sequence: number } | null = null;
  const derived = new Map<
    EventStreamId,
    { tenantId: string; first: number; last: number; count: number }
  >();
  for (const [index, record] of snapshot.records.entries()) {
    const payloadFailure = kernelPayloadViolation(record.event.payload);
    if (payloadFailure !== null) {
      return { ok: false, error: rePath(payloadFailure, `records[${index}].`) };
    }
    const verified = verifyEventDigest({
      event: record.event,
      digest: record.contentDigest,
    });
    if (!verified.ok) {
      return {
        ok: false,
        error: {
          ...verified.error,
          message: `records[${index}]: ${verified.error.message}`,
        },
      };
    }
    const coordinate = `${record.event.streamId}#${record.event.sequence}`;
    if (coordinates.has(coordinate)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `duplicate event coordinate ${coordinate} in snapshot`,
          issues: [
            {
              path: `records[${index}]`,
              message: `event coordinate ${coordinate} already appeared — history coordinates are unique`,
            },
          ],
        },
      };
    }
    coordinates.add(coordinate);
    if (
      previous !== null &&
      (record.event.streamId < previous.streamId ||
        (record.event.streamId === previous.streamId &&
          record.event.sequence <= previous.sequence))
    ) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'snapshot records are not canonically sorted by (streamId, sequence)',
          issues: [
            {
              path: `records[${index}]`,
              message: `expected a coordinate after ${previous.streamId}#${previous.sequence}, encountered ${coordinate}`,
            },
          ],
        },
      };
    }
    previous = { streamId: record.event.streamId, sequence: record.event.sequence };
    const stream = derived.get(record.event.streamId);
    if (stream === undefined) {
      derived.set(record.event.streamId, {
        tenantId: record.event.tenantId,
        first: record.event.sequence,
        last: record.event.sequence,
        count: 1,
      });
    } else {
      stream.last = record.event.sequence;
      stream.count += 1;
      if (stream.tenantId !== record.event.tenantId) {
        return {
          ok: false,
          error: {
            code: 'cross-tenant-denied',
            message: `stream "${record.event.streamId}" carries events from different tenants — a stream has exactly one tenant scope`,
            expectedTenantId: stream.tenantId,
            encounteredTenantId: record.event.tenantId,
            streamId: record.event.streamId,
          },
        };
      }
    }
  }

  const claimed = [...snapshot.streams].sort((a, b) =>
    a.streamId < b.streamId ? -1 : a.streamId > b.streamId ? 1 : 0,
  );
  if (claimed.length !== derived.size) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'snapshot stream projection is inconsistent with its records',
        issues: [
          {
            path: 'streams',
            message: `claimed ${claimed.length} streams, records define ${derived.size}`,
          },
        ],
      },
    };
  }
  for (const streamInfo of claimed) {
    const stream = derived.get(streamInfo.streamId);
    if (
      stream === undefined ||
      stream.tenantId !== streamInfo.tenantId ||
      stream.first !== streamInfo.firstSequence ||
      stream.last !== streamInfo.lastSequence ||
      stream.count !== streamInfo.eventCount
    ) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'snapshot stream projection is inconsistent with its records',
          issues: [
            {
              path: `streams[${streamInfo.streamId}]`,
              message: `claimed ${JSON.stringify(streamInfo)}, records define ${JSON.stringify(
                stream ?? { missing: true },
              )}`,
            },
          ],
        },
      };
    }
  }
  return { ok: true, value: snapshot };
}

/** Re-path a validation error's issues under a record prefix. */
function rePath(error: EventLogError, prefix: string): EventLogError {
  if (error.code !== 'validation') {
    return error;
  }
  return {
    code: 'validation',
    message: prefix === '' ? error.message : `${prefix}${error.message}`,
    issues: error.issues.map((issue) => ({
      path: prefix === '' ? issue.path : `${prefix}${issue.path}`,
      message: issue.message,
    })),
  };
}
