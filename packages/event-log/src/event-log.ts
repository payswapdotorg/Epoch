/**
 * The reference in-memory event log (W010) — the authoritative change
 * history.
 *
 * Owns (and only owns): the append-only, totally-ordered-per-stream typed
 * event envelope, its admission machinery, and its deterministic
 * cursor/read primitives.
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence
 * (the architecture.md "Persistence" targets arrive as adapters),
 * event distribution, projections, world-model mutation (world semantics
 * are @epoch/world-model's authority), and authorization decisions
 * (@epoch/authorization's). Events are FACTS: there is no mutation,
 * rewrite, or deletion API — corrections are NEW events.
 *
 * Admission discipline (total, never throws; fixed precedence so
 * consumers branch deterministically):
 * 1. version gate — schemaVersion skew is `version-unsupported`;
 * 2. schema gate — strict-object validation rejects unknown (vendor)
 *    fields; causal shape (intra-stream, strictly earlier) is refined;
 *    failures are `validation` with dotted paths;
 * 3. digest gate — the claimed digest must equal the recomputed canonical
 *    SHA-256 of the content, else `digest-mismatch` (tamper detection);
 * 4. kernel payload gate — reserved-namespace discriminators must satisfy
 *    the kernel payload contracts (src/subjects.ts), else `validation`;
 * 5. tenant gate — the log's expected tenant (when set) and the stream's
 *    fixed tenant must match the event's tenant, else
 *    `cross-tenant-denied` (R12);
 * 6. sequence gate — a new stream starts at 1; an existing stream admits
 *    exactly last+1: skipping forward is `sequence-gap`, hitting an
 *    existing coordinate is `duplicate-sequence`, anything else below is
 *    `out-of-order-sequence`;
 * 7. causal gate — a same-stream parent must be strictly earlier
 *    (`causal-cycle`), and any parent coordinate must already exist in
 *    history (`unknown-parent`); cross-stream parents are how streams
 *    intersect.
 *
 * Determinism: maps iterate in insertion order, but every read path sorts
 * before exposing anything — snapshots and listings are independent of
 * append order (no insertion-order leaks). ZERO wall-clock reads and
 * ZERO randomness: occurrence instants are producer-supplied payload
 * data.
 */
import { verifyEventDigest } from './digest';
import type {
  EventLogError,
  EventLogOptions,
  EventLogResult,
  EventLogSnapshot,
  EventRecord,
  EventRegistration,
  EventSequence,
  EventStreamId,
  ReadStreamOptions,
  RestoreOptions,
  StreamInfo,
} from './types';

/** Input of `appendEvent`: the sealed event (content + claimed digest). */
export type AppendEventInput = EventRegistration;

function ok<T>(value: T): EventLogResult<T> {
  return { ok: true, value };
}

function fail<T>(error: EventLogError): EventLogResult<T> {
  return { ok: false, error };
}

/** One stream's admitted history (records keyed by sequence). */
interface StreamState {
  readonly tenantId: string;
  readonly records: Map<EventSequence, EventRecord>;
  first: EventSequence;
  last: EventSequence;
}

/**
 * The reference event log. Construct directly (`new EventLog()` or
 * `new EventLog({ expectedTenantId })`), or restore deterministically
 * from a snapshot (`EventLog.fromSnapshot`). No persistence, no clocks,
 * no distribution: the reference machinery only.
 */
export class EventLog {
  /** streamId -> state. Maps iterate in insertion order; every read path
   * sorts before exposing anything. */
  private readonly streams = new Map<EventStreamId, StreamState>();

  /** The tenant this log is scoped to (optional single-tenant guard). */
  private readonly expectedTenantId: string | undefined;

  constructor(options: EventLogOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /** Total number of admitted events (across all streams). */
  get size(): number {
    let total = 0;
    for (const stream of this.streams.values()) {
      total += stream.records.size;
    }
    return total;
  }

  /** Number of streams in the log. */
  get streamCount(): number {
    return this.streams.size;
  }

  /**
   * Append one sealed event to history (the ONLY mutation of the log;
   * appends never rewrite or delete). Admission precedence is documented
   * on the class. Returns the stored record.
   */
  appendEvent(input: AppendEventInput): EventLogResult<EventRecord> {
    // Precedence 1: version gate (skew is distinguishable from malformed
    // payloads — the W011 parse precedent).
    const versionFailure = versionGate(input?.event);
    if (versionFailure !== null) {
      return fail(versionFailure);
    }

    // Precedence 2-4: schema + digest + kernel payload gates (the shared
    // sealing verifier; it also enforces the intra-stream causal shape).
    const verified = verifyEventDigest(input);
    if (!verified.ok) {
      return fail(verified.error);
    }
    const event = verified.value;

    // Precedence 5: tenant gate (R12) — log scope first, then the
    // stream's fixed tenant.
    if (this.expectedTenantId !== undefined && event.tenantId !== this.expectedTenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `cross-tenant append denied: this log is scoped to tenant "${this.expectedTenantId}", encountered "${event.tenantId}"`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: event.tenantId,
        streamId: event.streamId,
      });
    }
    const stream = this.streams.get(event.streamId);
    if (stream !== undefined && stream.tenantId !== event.tenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `cross-tenant append denied: stream "${event.streamId}" is scoped to tenant "${stream.tenantId}", encountered "${event.tenantId}"`,
        expectedTenantId: stream.tenantId,
        encounteredTenantId: event.tenantId,
        streamId: event.streamId,
      });
    }

    // Precedence 6: sequence gate (strict monotonic, contiguous per
    // stream; a new stream opens at 1).
    if (stream === undefined) {
      if (event.sequence !== 1) {
        return fail({
          code: 'sequence-gap',
          message: `new stream "${event.streamId}" must open at sequence 1 (encountered ${event.sequence}) — history cannot start with a gap`,
          streamId: event.streamId,
          expectedSequence: 1,
          encounteredSequence: event.sequence,
        });
      }
    } else if (event.sequence !== stream.last + 1) {
      if (stream.records.has(event.sequence)) {
        return fail({
          code: 'duplicate-sequence',
          message: `sequence ${event.sequence} is already logged in stream "${event.streamId}" — events are immutable facts; corrections are new events`,
          streamId: event.streamId,
          sequence: event.sequence,
        });
      }
      if (event.sequence > stream.last + 1) {
        return fail({
          code: 'sequence-gap',
          message: `sequence gap in stream "${event.streamId}": expected ${stream.last + 1}, encountered ${event.sequence}`,
          streamId: event.streamId,
          expectedSequence: stream.last + 1,
          encounteredSequence: event.sequence,
        });
      }
      return fail({
        code: 'out-of-order-sequence',
        message: `out-of-order append in stream "${event.streamId}": expected ${stream.last + 1}, encountered ${event.sequence}`,
        streamId: event.streamId,
        expectedSequence: stream.last + 1,
        encounteredSequence: event.sequence,
      });
    }

    // Precedence 7: causal gate. Cross-stream references are how streams
    // intersect: a same-stream parent must be strictly EARLIER (a self or
    // same-stream-future reference is a typed `causal-cycle`); any parent
    // coordinate must already exist in history (`unknown-parent`).
    if (event.causalParent !== null) {
      const parent = event.causalParent;
      if (parent.streamId === event.streamId && parent.sequence >= event.sequence) {
        return fail({
          code: 'causal-cycle',
          message: `causal parent #${parent.sequence} is not strictly earlier than event #${event.sequence} in stream "${event.streamId}"`,
          streamId: event.streamId,
          sequence: event.sequence,
          parentSequence: parent.sequence,
        });
      }
      const parentStream = this.streams.get(parent.streamId);
      if (parentStream === undefined || !parentStream.records.has(parent.sequence)) {
        return fail({
          code: 'unknown-parent',
          message: `causal parent (${parent.streamId} #${parent.sequence}) does not exist in history`,
          streamId: event.streamId,
          parentSequence: parent.sequence,
        });
      }
    }

    const record: EventRecord = { event, contentDigest: input.digest };
    if (stream === undefined) {
      this.streams.set(event.streamId, {
        tenantId: event.tenantId,
        records: new Map([[event.sequence, record]]),
        first: event.sequence,
        last: event.sequence,
      });
    } else {
      stream.records.set(event.sequence, record);
      stream.last = event.sequence;
    }
    return ok(record);
  }

  /**
   * Cursor primitive: read one stream's records in ascending sequence
   * order, optionally resuming after a cursor (`after`), bounded by `to`,
   * capped by `limit`. Unknown streams are typed `unknown-stream` errors.
   */
  readStream(
    streamId: EventStreamId,
    options: ReadStreamOptions = {},
  ): EventLogResult<readonly EventRecord[]> {
    const stream = this.streams.get(streamId);
    if (stream === undefined) {
      return fail({
        code: 'unknown-stream',
        message: `stream "${streamId}" does not exist in this log`,
        streamId,
      });
    }
    const after = options.after ?? 0;
    const to = options.to ?? Number.POSITIVE_INFINITY;
    const limit = options.limit ?? Number.POSITIVE_INFINITY;
    const records: EventRecord[] = [];
    for (
      let sequence = Math.max(after + 1, stream.first);
      sequence <= Math.min(to, stream.last) && records.length < limit;
      sequence += 1
    ) {
      const record = stream.records.get(sequence);
      if (record !== undefined) {
        records.push(record);
      }
    }
    return ok(records);
  }

  /**
   * Deterministic per-stream projection: tenant scope, first/last
   * sequence (the resume cursor), and event count.
   */
  streamInfo(streamId: EventStreamId): EventLogResult<StreamInfo> {
    const stream = this.streams.get(streamId);
    if (stream === undefined) {
      return fail({
        code: 'unknown-stream',
        message: `stream "${streamId}" does not exist in this log`,
        streamId,
      });
    }
    return ok(streamProjection(streamId, stream));
  }

  /** All stream projections, sorted by streamId ascending. */
  listStreams(): readonly StreamInfo[] {
    return [...this.streams.keys()]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((streamId) => streamProjection(streamId, this.streams.get(streamId) as StreamState));
  }

  /** Whether the stream exists (total — never errors). */
  hasStream(streamId: EventStreamId): boolean {
    return this.streams.has(streamId);
  }

  /**
   * Deterministic, serialization-friendly whole-log projection: streams
   * sorted by streamId ascending, records sorted by (streamId, sequence).
   * Two logs containing the same events emit byte-identical snapshots
   * regardless of append order.
   */
  snapshot(): EventLogSnapshot {
    const streams = this.listStreams();
    const records: EventRecord[] = [];
    for (const streamId of [...this.streams.keys()].sort()) {
      const stream = this.streams.get(streamId) as StreamState;
      for (let sequence = stream.first; sequence <= stream.last; sequence += 1) {
        const record = stream.records.get(sequence);
        if (record !== undefined) {
          records.push(record);
        }
      }
    }
    return { schemaVersion: 1, streams, records };
  }

  /**
   * Deterministically restore a log from a snapshot: every record passes
   * the FULL admission pipeline (version, schema, digest, payload,
   * sequence, causal) — a tampered, reordered, or gapped snapshot never
   * restores. Stream infos are re-derived and must match the claimed
   * projection.
   */
  static fromSnapshot(
    snapshot: EventLogSnapshot,
    options: RestoreOptions = {},
  ): EventLogResult<EventLog> {
    const log = new EventLog(options);
    for (const record of snapshot.records) {
      const appended = log.appendEvent({ event: record.event, digest: record.contentDigest });
      if (!appended.ok) {
        return fail(appended.error);
      }
    }
    const claimed = [...snapshot.streams].sort(streamInfoOrder);
    const derived = log.listStreams();
    if (claimed.length !== derived.length) {
      return fail({
        code: 'validation',
        message: 'snapshot stream projection is inconsistent with its records',
        issues: [
          {
            path: 'streams',
            message: `claimed ${claimed.length} streams, records define ${derived.length}`,
          },
        ],
      });
    }
    for (let index = 0; index < derived.length; index += 1) {
      if (streamInfoOrder(claimed[index] as StreamInfo, derived[index] as StreamInfo) !== 0) {
        return fail({
          code: 'validation',
          message: 'snapshot stream projection is inconsistent with its records',
          issues: [
            {
              path: `streams[${index}]`,
              message: `claimed ${JSON.stringify(claimed[index])}, derived ${JSON.stringify(derived[index])}`,
            },
          ],
        });
      }
    }
    return ok(log);
  }
}

/** Sort order over stream ids (ascending, total). */
function streamIdOrder(a: EventStreamId, b: EventStreamId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort order over stream projections (by streamId ascending). */
function streamInfoOrder(a: StreamInfo, b: StreamInfo): number {
  return streamIdOrder(a.streamId, b.streamId);
}

/** Project one stream's state. */
function streamProjection(streamId: EventStreamId, stream: StreamState): StreamInfo {
  return {
    streamId,
    tenantId: stream.tenantId,
    firstSequence: stream.first,
    lastSequence: stream.last,
    eventCount: stream.records.size,
  };
}

/**
 * Version gate: a schemaVersion that is a number different from the
 * record version fails fast with a typed `version-unsupported` error
 * (skew is distinguishable from malformed payloads). Non-number skew
 * falls through to the schema gate.
 */
function versionGate(event: unknown): EventLogError | null {
  if (typeof event !== 'object' || event === null) {
    return {
      code: 'validation',
      message: 'event content must be a JSON object',
      issues: [{ path: 'event', message: 'expected a JSON object' }],
    };
  }
  const encountered = (event as Record<string, unknown>).schemaVersion;
  if (typeof encountered === 'number' && encountered !== 1) {
    return {
      code: 'version-unsupported',
      message: `event-log record version mismatch: expected 1, encountered ${encountered}`,
      expected: '1',
      encountered: String(encountered),
    };
  }
  return null;
}

// Re-exported for the read paths that need a canonical order constant.
export { streamIdOrder as canonicalStreamOrder };
