// Positive fold evidence: deterministic reconstruction, state digests,
// causal-topological order for single and intersecting streams,
// checkpoint resume, and serialized round-trips.
import { describe, expect, it } from 'vitest';
import {
  checkpointOf,
  foldEventRecords,
  foldStream,
  foldStreams,
  parseReconstructionSnapshot,
  parseReplayCheckpoint,
  resumeFold,
  snapshotOf,
  stateDigestOf,
} from '../src/index';
import { EventLog } from '@epoch/event-log';
import {
  append,
  countersSpec,
  followUpEvent,
  logWithIntersectingStreams,
  logWithThreeEvents,
  noteEvent,
  unwrapFold,
  worldEvent,
  actionEvent,
  initialCounters,
} from './helpers';

describe('replay fold (positive)', () => {
  it('folds a single stream in sequence order and produces a state digest', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    expect(folded.appliedOrder.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(folded.state).toEqual({
      entityAssertions: 2,
      actionEvents: 1,
      notes: ['form-12'],
    });
    expect(folded.stateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(folded.cursors).toEqual([{ streamId: 'stream:world-a', lastSequence: 3 }]);
    expect(folded.eventCount).toBe(3);
  });

  it('two folds of the same log produce IDENTICAL state digests (the architecture invariant)', () => {
    const log = logWithThreeEvents();
    const first = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const second = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    expect(first.stateDigest).toBe(second.stateDigest);
    expect(first).toEqual(second);
  });

  it('folds from a record list exactly like from the log', () => {
    const log = logWithThreeEvents();
    const fromLog = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const fromRecords = unwrapFold(foldEventRecords(log.snapshot().records, countersSpec));
    expect(fromRecords.stateDigest).toBe(fromLog.stateDigest);
    expect(fromRecords.state).toEqual(fromLog.state);
  });

  it('a snapshot-restored identical log replays to the identical digest', () => {
    const log = logWithThreeEvents();
    const restored = EventLog.fromSnapshot(log.snapshot());
    if (!restored.ok) throw new Error(restored.error.message);
    const original = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const replayed = unwrapFold(foldStream(restored.value, 'stream:world-a', countersSpec));
    expect(replayed.stateDigest).toBe(original.stateDigest);
  });

  it('folds INTERSECTING streams in causal order (parent before child)', () => {
    const log = logWithIntersectingStreams();
    const folded = unwrapFold(
      foldStreams(log, ['stream:world-a', 'stream:world-b'], countersSpec),
    );
    // world-b #1 is causally parented on world-a #3: the parent applies first.
    const order = folded.appliedOrder.map((entry) => `${entry.streamId}#${entry.sequence}`);
    expect(order).toEqual(['stream:world-a#1', 'stream:world-a#2', 'stream:world-a#3', 'stream:world-b#1']);
    expect(folded.cursors).toEqual([
      { streamId: 'stream:world-a', lastSequence: 3 },
      { streamId: 'stream:world-b', lastSequence: 1 },
    ]);
    expect(folded.state.notes).toEqual(['form-12', 'form-99']);
  });

  it('fold order is deterministic regardless of the stream-set input order', () => {
    const log = logWithIntersectingStreams();
    const a = unwrapFold(foldStreams(log, ['stream:world-a', 'stream:world-b'], countersSpec));
    const b = unwrapFold(foldStreams(log, ['stream:world-b', 'stream:world-a'], countersSpec));
    expect(a).toEqual(b);
  });

  it('append interleavings do not leak into fold results', () => {
    // Two logs with the same four events, appended in different orders
    // (b#1 parented on a#2, so both orders are causally legal): the
    // folds must be byte-identical — no insertion-order leaks.
    const build = (bFirst: boolean) => {
      const log = new EventLog();
      append(log, worldEvent()); // a#1
      append(log, actionEvent()); // a#2
      if (bFirst) {
        append(
          log,
          followUpEvent({
            streamId: 'stream:world-b',
            causalParent: { streamId: 'stream:world-a', sequence: 2 },
          }),
        );
        append(log, noteEvent());
      } else {
        append(log, noteEvent()); // a#3
        append(
          log,
          followUpEvent({
            streamId: 'stream:world-b',
            causalParent: { streamId: 'stream:world-a', sequence: 2 },
          }),
        );
      }
      return log;
    };
    const foldA = unwrapFold(
      foldStreams(build(false), ['stream:world-a', 'stream:world-b'], countersSpec),
    );
    const foldB = unwrapFold(
      foldStreams(build(true), ['stream:world-a', 'stream:world-b'], countersSpec),
    );
    expect(foldA).toEqual(foldB);
  });

  it('checkpoint round-trip: resume reproduces the full-fold digest', () => {
    const log = logWithThreeEvents();
    // Fold the first two events only (checkpoint at cursor 2).
    const records = log.snapshot().records.filter(
      (record) => record.event.sequence <= 2,
    );
    const rebuilt = EventLog.fromSnapshot({
      schemaVersion: 1,
      streams: [
        {
          streamId: 'stream:world-a',
          tenantId: 'tenant:acme',
          firstSequence: 1,
          lastSequence: 2,
          eventCount: 2,
        },
      ],
      records,
    });
    if (!rebuilt.ok) throw new Error(rebuilt.error.message);
    const partial = unwrapFold(foldStream(rebuilt.value, 'stream:world-a', countersSpec));
    const checkpoint = checkpointOf(partial);
    // Resume the FULL log from the checkpoint state.
    const resumed = unwrapFold(
      resumeFold(log, checkpoint, countersSpec, { checkpointState: partial.state }),
    );
    const full = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    expect(resumed.stateDigest).toBe(full.stateDigest);
    expect(resumed.state).toEqual(full.state);
    expect(resumed.cursors).toEqual(full.cursors);
    // The continuation folded exactly the one event after the checkpoint.
    expect(resumed.eventCount).toBe(1);
  });

  it('serialized reconstruction snapshots round-trip through the validator', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const snapshot = snapshotOf(countersSpec, folded);
    const parsed = parseReconstructionSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.stateDigest).toBe(folded.stateDigest);
      expect(parsed.value.state).toEqual(snapshot.state);
    }
    const checkpoint = parseReplayCheckpoint(
      JSON.parse(JSON.stringify(checkpointOf(folded))),
    );
    expect(checkpoint.ok).toBe(true);
  });

  it('stateDigestOf is the canonical digest of the projected state', () => {
    const state = { ...initialCounters, entityAssertions: 2 };
    const digest = stateDigestOf(countersSpec, state);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(stateDigestOf(countersSpec, state)).toBe(digest);
  });

  it('an exhausted fold (empty continuation) keeps the checkpoint digest', () => {
    const log = logWithThreeEvents();
    const full = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const resumed = unwrapFold(
      resumeFold(log, checkpointOf(full), countersSpec, { checkpointState: full.state }),
    );
    expect(resumed.stateDigest).toBe(full.stateDigest);
    expect(resumed.eventCount).toBe(0);
    expect(resumed.cursors).toEqual(full.cursors);
  });
});
