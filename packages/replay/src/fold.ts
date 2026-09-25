/**
 * The deterministic fold machinery (W010): reconstruction of state from
 * event-log history.
 *
 * architecture.md (binding): "Replay is deterministic reconstruction:
 * given the same ordered event sequence, replay reconstructs the same
 * state — ZERO wall-clock, ZERO randomness; any timestamp a consumer
 * needs comes FROM event payload data."
 *
 * Fold order (REPLAY_FOLD_ORDER = causal-topological): an event never
 * applies before its causal parent; among READY events the deterministic
 * tie-break is (streamId ascending, sequence ascending). A single stream
 * therefore always folds in plain sequence order; intersecting streams
 * fold in a causality-respecting, byte-stable interleaving. Comparisons
 * are plain code-unit comparisons (never locale-sensitive).
 *
 * Determinism guarantees:
 * - the fold engine never reads a clock and never samples randomness;
 * - the state digest is the SHA-256 of the canonical JSON serialization
 *   of the spec's `projectState` projection, so two folds of the same
 *   ordered events through the same spec produce IDENTICAL digests;
 * - any handler-level nondeterminism is DETECTABLE: a fold that cannot
 *   reproduce a recorded checkpoint digest is a typed
 *   `replay-divergence` (or `checkpoint-mismatch` at resume).
 *
 * Divergence detection (`verifyReconstruction` / `verifyDigest`):
 * compares a reconstruction against a recorded checkpoint (or digest);
 * mismatch is the typed `replay-divergence` error with
 * expected/encountered digests.
 *
 * Checkpointing: `checkpointOf` records the fold position;
 * `resumeFold` re-enters a fold from a checkpoint + the checkpointed
 * STATE (verified against the checkpoint digest first — tampered
 * checkpoint states are `checkpoint-mismatch`).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { EventLog } from '@epoch/event-log';
import type { EventLogError, EventRecord, EventStreamId } from '@epoch/event-log';
import type {
  FoldedEventEntry,
  FoldOptions,
  Reconstruction,
  ReconstructionSnapshot,
  ReplayCheckpoint,
  ReplayCursor,
  ReplayError,
  ReplayResult,
  ReplaySpec,
  ResumeOptions,
  TracedReconstruction,
} from './types';

function ok<T>(value: T): ReplayResult<T> {
  return { ok: true, value };
}

function fail<T>(error: ReplayError): ReplayResult<T> {
  return { ok: false, error };
}

/** Deterministic string comparison (code-unit order; never locale). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Map a defensive event-log read error into the replay taxonomy. */
function toReplayError(error: EventLogError): ReplayError {
  if (error.code === 'unknown-stream') {
    return { code: 'unknown-stream', message: error.message, streamId: error.streamId };
  }
  return {
    code: 'validation',
    message: `event-log read failed during fold: ${error.message}`,
    issues: [{ path: 'log', message: error.message }],
  };
}

/** Validate a spec: handlers must exist and discriminators be unique. */
function validateSpec<S>(spec: ReplaySpec<S>): ReplayError | null {
  const issues: { path: string; message: string }[] = [];
  if (spec.handlers.length === 0) {
    issues.push({
      path: 'handlers',
      message: 'a replay spec declares at least one typed event handler',
    });
  }
  const seen = new Set<string>();
  for (const [index, handler] of spec.handlers.entries()) {
    if (typeof handler.discriminator !== 'string' || handler.discriminator.length === 0) {
      issues.push({
        path: `handlers[${index}].discriminator`,
        message: 'handler discriminators are non-empty event-kind discriminators',
      });
      continue;
    }
    if (typeof handler.apply !== 'function') {
      issues.push({
        path: `handlers[${index}].apply`,
        message: 'handlers apply events through a function',
      });
      continue;
    }
    if (seen.has(handler.discriminator)) {
      issues.push({
        path: `handlers[${index}].discriminator`,
        message: `duplicate handler for event kind "${handler.discriminator}"`,
      });
      continue;
    }
    seen.add(handler.discriminator);
  }
  if (typeof spec.projectState !== 'function') {
    issues.push({
      path: 'projectState',
      message: 'the canonical state projection is a function',
    });
  }
  if (issues.length === 0) {
    return null;
  }
  return {
    code: 'validation',
    message: `replay spec failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** The handler lookup table of a validated spec. */
function handlerTable<S>(spec: ReplaySpec<S>): Map<string, ReplaySpec<S>['handlers'][number]> {
  const table = new Map<string, ReplaySpec<S>['handlers'][number]>();
  for (const handler of spec.handlers) {
    table.set(handler.discriminator, handler);
  }
  return table;
}

/** The state digest of a state: canonical SHA-256 of its projection. */
export function stateDigestOf<S>(spec: ReplaySpec<S>, state: S): Sha256Hex {
  return canonicalDigest(spec.projectState(state) as JsonValue);
}

/** The cursor map of a fold position (streamId -> last applied sequence). */
function cursorMap(cursors: readonly ReplayCursor[]): Map<EventStreamId, number> {
  const map = new Map<EventStreamId, number>();
  for (const cursor of cursors) {
    map.set(cursor.streamId, cursor.lastSequence);
  }
  return map;
}

/** The canonical fold-order key: (streamId, zero-padded sequence). */
function orderKey(streamId: string, sequence: number): string {
  return `${streamId}\u0000${String(sequence).padStart(20, '0')}`;
}

/**
 * Deterministic CAUSAL-TOPOLOGICAL order of records (the fold order):
 * an event never precedes its causal parent; ties break by (streamId,
 * sequence) ascending. Parents outside the folded window (e.g. before a
 * resume cursor) count as already applied. Pure and total.
 */
export function causalTopologicalOrder(
  records: readonly EventRecord[],
): ReplayResult<readonly EventRecord[]> {
  const byCoordinate = new Map<string, EventRecord>();
  for (const record of records) {
    const coordinate = `${record.event.streamId}#${record.event.sequence}`;
    if (byCoordinate.has(coordinate)) {
      return fail({
        code: 'validation',
        message: `duplicate event coordinate ${coordinate} in the fold input`,
        issues: [
          {
            path: 'records',
            message: `event coordinate ${coordinate} appears twice — history coordinates are unique`,
          },
        ],
      });
    }
    byCoordinate.set(coordinate, record);
  }

  const ready: EventRecord[] = [];
  const blocked = new Map<string, EventRecord[]>();
  for (const record of records) {
    const parent = record.event.causalParent;
    if (parent === null) {
      ready.push(record);
      continue;
    }
    const parentCoordinate = `${parent.streamId}#${parent.sequence}`;
    if (byCoordinate.has(parentCoordinate)) {
      const list = blocked.get(parentCoordinate) ?? [];
      list.push(record);
      blocked.set(parentCoordinate, list);
    } else {
      // Parent outside the folded window (already applied pre-resume):
      // the event is ready now.
      ready.push(record);
    }
  }

  const ordered: EventRecord[] = [];
  const compare = (a: EventRecord, b: EventRecord) =>
    cmp(
      orderKey(a.event.streamId, a.event.sequence),
      orderKey(b.event.streamId, b.event.sequence),
    );
  ready.sort(compare);
  while (ready.length > 0) {
    const record = ready.shift() as EventRecord;
    ordered.push(record);
    const coordinate = `${record.event.streamId}#${record.event.sequence}`;
    const unblocked = blocked.get(coordinate) ?? [];
    blocked.delete(coordinate);
    for (const candidate of unblocked) {
      ready.push(candidate);
    }
    ready.sort(compare);
  }

  if (ordered.length !== records.length) {
    return fail({
      code: 'validation',
      message:
        'the fold input contains a causal cycle or a parent missing from the folded window',
      issues: [
        {
          path: 'records',
          message: `${records.length - ordered.length} event(s) could never become ready`,
        },
      ],
    });
  }
  return ok(ordered);
}

/** Fold an ordered record list onto a starting state (the core). */
function foldOrderedRecords<S>(
  ordered: readonly EventRecord[],
  spec: ReplaySpec<S>,
  initialState: S,
  streamIds: readonly EventStreamId[],
  baselineCursors: Map<EventStreamId, number> = new Map(),
): ReplayResult<TracedReconstruction<S>> {
  const table = handlerTable(spec);
  let state = initialState;
  const appliedSequences = new Map<EventStreamId, number>();
  const appliedOrder: FoldedEventEntry[] = [];
  for (const record of ordered) {
    const handler = table.get(record.event.payload.discriminator);
    if (handler === undefined) {
      return fail({
        code: 'unknown-event-kind',
        message: `no handler is registered for event kind "${record.event.payload.discriminator}" (event ${record.event.streamId} #${record.event.sequence})`,
        discriminator: record.event.payload.discriminator,
        streamId: record.event.streamId,
        sequence: record.event.sequence,
      });
    }
    state = handler.apply(state, record.event);
    appliedSequences.set(record.event.streamId, record.event.sequence);
    appliedOrder.push({
      streamId: record.event.streamId,
      sequence: record.event.sequence,
      discriminator: record.event.payload.discriminator,
    });
  }
  // The fold POSITION: per-stream max(resume cursor, applied sequence) —
  // an exhausted continuation keeps the checkpoint position.
  const merged = new Map<EventStreamId, number>(baselineCursors);
  for (const [streamId, sequence] of appliedSequences) {
    merged.set(streamId, Math.max(merged.get(streamId) ?? 0, sequence));
  }
  const cursors = [...merged.entries()]
    .map((entry) => ({ streamId: entry[0], lastSequence: entry[1] }))
    .sort((a, b) => cmp(a.streamId, b.streamId));
  return ok({
    streamIds,
    cursors,
    eventCount: appliedOrder.length,
    state,
    stateDigest: stateDigestOf(spec, state),
    appliedOrder,
  });
}

/**
 * Fold one stream of a log from the beginning (or after a cursor) through
 * the spec. Deterministic: same log + same spec => same state digest.
 */
export function foldStream<S>(
  log: EventLog,
  streamId: EventStreamId,
  spec: ReplaySpec<S>,
  options: FoldOptions = {},
): ReplayResult<TracedReconstruction<S>> {
  return foldStreams(log, [streamId], spec, options);
}

/**
 * Fold one or more (INTERSECTING) streams of a log through the spec.
 * Events apply in causal-topological order with the (streamId,
 * sequence) tie-break. Deterministic: same log + same stream set + same
 * spec => identical state digest, independent of insertion orders.
 */
export function foldStreams<S>(
  log: EventLog,
  streamIds: readonly EventStreamId[],
  spec: ReplaySpec<S>,
  options: FoldOptions = {},
): ReplayResult<TracedReconstruction<S>> {
  const specError = validateSpec(spec);
  if (specError !== null) {
    return fail(specError);
  }
  const streamList = [...streamIds];
  if (streamList.length === 0) {
    return fail({
      code: 'validation',
      message: 'at least one stream must be named for a fold',
      issues: [{ path: 'streamIds', message: 'a fold names one or more streams' }],
    });
  }
  const uniqueStreams = new Set(streamList);
  if (uniqueStreams.size !== streamList.length) {
    return fail({
      code: 'validation',
      message: 'stream ids must be unique in a fold',
      issues: [
        {
          path: 'streamIds',
          message: 'the same stream was named twice — fold each stream once',
        },
      ],
    });
  }
  const sortedStreams = [...uniqueStreams].sort(cmp);
  const after = cursorMap(options.after ?? []);
  const records: EventRecord[] = [];
  for (const streamId of sortedStreams) {
    if (!log.hasStream(streamId)) {
      return fail({
        code: 'unknown-stream',
        message: `stream "${streamId}" does not exist in this log`,
        streamId,
      });
    }
    const read = log.readStream(streamId, { after: after.get(streamId) ?? 0 });
    if (!read.ok) {
      return fail(toReplayError(read.error));
    }
    records.push(...read.value);
  }
  const ordered = causalTopologicalOrder(records);
  if (!ordered.ok) {
    return fail(ordered.error);
  }
  return foldOrderedRecords(ordered.value, spec, spec.initialState, sortedStreams, after);
}

/**
 * Fold a record list held by the caller (e.g. from a serialized log
 * snapshot): the records are re-ordered deterministically (causal
 * topological) before folding, from the spec's initial state.
 */
export function foldEventRecords<S>(
  records: readonly EventRecord[],
  spec: ReplaySpec<S>,
): ReplayResult<TracedReconstruction<S>> {
  const specError = validateSpec(spec);
  if (specError !== null) {
    return fail(specError);
  }
  const ordered = causalTopologicalOrder(records);
  if (!ordered.ok) {
    return fail(ordered.error);
  }
  const streamIds = [...new Set(records.map((record) => record.event.streamId))].sort(cmp);
  return foldOrderedRecords(ordered.value, spec, spec.initialState, streamIds);
}

/** The recorded fold position of a reconstruction (the resume anchor). */
export function checkpointOf<S>(reconstruction: Reconstruction<S>): ReplayCheckpoint {
  return {
    schemaVersion: 1,
    streamIds: [...reconstruction.streamIds],
    cursors: [...reconstruction.cursors],
    stateDigest: reconstruction.stateDigest,
    eventCount: reconstruction.eventCount,
  };
}

/** The serialized projection of a reconstruction (state via projectState). */
export function snapshotOf<S>(
  spec: ReplaySpec<S>,
  reconstruction: Reconstruction<S>,
): ReconstructionSnapshot {
  return {
    schemaVersion: 1,
    streamIds: [...reconstruction.streamIds],
    cursors: [...reconstruction.cursors],
    eventCount: reconstruction.eventCount,
    state: spec.projectState(reconstruction.state),
    stateDigest: reconstruction.stateDigest,
  };
}

/**
 * Verify a reconstruction against a recorded checkpoint (the
 * architecture's DIVERGENCE DETECTION): folded streams, cursors, and
 * state digest must match the record exactly. Mismatch is the typed
 * `replay-divergence` error with expected/encountered digests.
 */
export function verifyReconstruction<S>(
  reconstruction: Reconstruction<S>,
  recorded: ReplayCheckpoint,
): ReplayResult<true> {
  const recordedStreams = [...recorded.streamIds].sort(cmp);
  const foldedStreams = [...reconstruction.streamIds].sort(cmp);
  const sameStreams =
    recordedStreams.length === foldedStreams.length &&
    recordedStreams.every((streamId, index) => streamId === foldedStreams[index]);
  const sameCursors = sameCursorsAs(recorded.cursors, reconstruction.cursors);
  const digestMatches = reconstruction.stateDigest === recorded.stateDigest;
  if (!sameStreams || !sameCursors || !digestMatches) {
    return fail({
      code: 'replay-divergence',
      message:
        'replay divergence detected: the reconstruction does not match the recorded checkpoint ' +
        `(digest expected ${recorded.stateDigest}, encountered ${reconstruction.stateDigest})`,
      expected: recorded.stateDigest,
      encountered: reconstruction.stateDigest,
      streamIds: foldedStreams,
      eventCount: reconstruction.eventCount,
    });
  }
  return ok(true);
}

/** Verify a reconstruction against a recorded state DIGEST alone. */
export function verifyDigest<S>(
  reconstruction: Reconstruction<S>,
  recordedDigest: Sha256Hex,
): ReplayResult<true> {
  if (reconstruction.stateDigest !== recordedDigest) {
    return fail({
      code: 'replay-divergence',
      message: `replay divergence detected: expected state digest ${recordedDigest}, encountered ${reconstruction.stateDigest}`,
      expected: recordedDigest,
      encountered: reconstruction.stateDigest,
      streamIds: [...reconstruction.streamIds],
      eventCount: reconstruction.eventCount,
    });
  }
  return ok(true);
}

/**
 * Resume a fold from a recorded checkpoint plus the checkpointed state:
 * the state's digest is verified against the checkpoint first (tampered
 * checkpoint states are `checkpoint-mismatch`), then only events AFTER
 * the checkpoint cursors apply, continuing from the checkpoint state.
 */
export function resumeFold<S>(
  log: EventLog,
  checkpoint: ReplayCheckpoint,
  spec: ReplaySpec<S>,
  options: ResumeOptions<S>,
): ReplayResult<TracedReconstruction<S>> {
  const specError = validateSpec(spec);
  if (specError !== null) {
    return fail(specError);
  }
  const encountered = stateDigestOf(spec, options.checkpointState);
  if (encountered !== checkpoint.stateDigest) {
    return fail({
      code: 'checkpoint-mismatch',
      message: `the supplied checkpoint state does not match the recorded checkpoint digest (expected ${checkpoint.stateDigest}, encountered ${encountered})`,
      expected: checkpoint.stateDigest,
      encountered,
    });
  }
  const after = cursorMap(checkpoint.cursors);
  const records: EventRecord[] = [];
  for (const streamId of [...checkpoint.streamIds].sort(cmp)) {
    if (!log.hasStream(streamId)) {
      return fail({
        code: 'unknown-stream',
        message: `stream "${streamId}" does not exist in this log`,
        streamId,
      });
    }
    const read = log.readStream(streamId, { after: after.get(streamId) ?? 0 });
    if (!read.ok) {
      return fail(toReplayError(read.error));
    }
    records.push(...read.value);
  }
  const ordered = causalTopologicalOrder(records);
  if (!ordered.ok) {
    return fail(ordered.error);
  }
  return foldOrderedRecords(
    ordered.value,
    spec,
    options.checkpointState,
    [...checkpoint.streamIds].sort(cmp),
    after,
  );
}

/** Deterministic cursor-list equality (sorted by streamId). */
function sameCursorsAs(a: readonly ReplayCursor[], b: readonly ReplayCursor[]): boolean {
  const sortedA = [...a].sort((x, y) => cmp(x.streamId, y.streamId));
  const sortedB = [...b].sort((x, y) => cmp(x.streamId, y.streamId));
  return (
    sortedA.length === sortedB.length &&
    sortedA.every(
      (cursor, index) =>
        cursor.streamId === sortedB[index]?.streamId &&
        cursor.lastSequence === sortedB[index]?.lastSequence,
    )
  );
}
