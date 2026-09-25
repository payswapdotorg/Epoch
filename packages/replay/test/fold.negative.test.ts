// NEGATIVE replay cases — the W010 pin: "replay divergence detected and
// typed" plus spec/stream/checkpoint admission failures. Every failure is
// a TYPED error value; nothing throws.
import { describe, expect, it } from 'vitest';
import {
  checkpointOf,
  foldEventRecords,
  foldStream,
  foldStreams,
  resumeFold,
  verifyDigest,
  verifyReconstruction,
} from '../src/index';
import { eventRecordFor, sealEvent, type EventLogError } from '@epoch/event-log';
import type { ReplayError } from '../src/index';
import {
  countersSpec,
  logWithIntersectingStreams,
  logWithThreeEvents,
  unwrapFold,
  worldEvent,
} from './helpers';

type FoldResult = { ok: boolean; error?: ReplayError };

function expectError(result: FoldResult, code: ReplayError['code']): ReplayError {
  expect(result.ok).toBe(false);
  const error = (result as { ok: false; error: ReplayError }).error;
  expect(error.code).toBe(code);
  return error;
}

describe('replay fold (negative — stream & kind gates)', () => {
  it('rejects folding an unknown stream with the typed unknown-stream error', () => {
    const log = logWithThreeEvents();
    const error = expectError(foldStream(log, 'stream:ghost', countersSpec), 'unknown-stream');
    if (error.code === 'unknown-stream') {
      expect(error.streamId).toBe('stream:ghost');
    }
  });

  it('rejects an event whose discriminator has no handler (unknown-event-kind)', () => {
    const log = logWithThreeEvents();
    // A fourth event with an UNHANDLED extension kind.
    const sealed = sealEvent(
      worldEvent({
        sequence: 4,
        occurredAt: '2026-02-05T12:00:04.000Z',
        payload: { discriminator: 'acme:unmodeled-kind', data: {} },
      }),
    );
    if (!sealed.ok) throw new Error('fixture must seal');
    const appended = log.appendEvent(sealed.value);
    if (!appended.ok) throw new Error('fixture must append');
    const error = expectError(foldStream(log, 'stream:world-a', countersSpec), 'unknown-event-kind');
    if (error.code === 'unknown-event-kind') {
      expect(error.discriminator).toBe('acme:unmodeled-kind');
      expect(error.sequence).toBe(4);
    }
  });

  it('rejects an empty stream set', () => {
    const log = logWithThreeEvents();
    expectError(foldStreams(log, [], countersSpec), 'validation');
  });

  it('rejects duplicate stream ids in one fold', () => {
    const log = logWithThreeEvents();
    expectError(
      foldStreams(log, ['stream:world-a', 'stream:world-a'], countersSpec),
      'validation',
    );
  });

  it('rejects a spec with duplicate handler discriminators', () => {
    const log = logWithThreeEvents();
    const error = expectError(
      foldStream(log, 'stream:world-a', {
        ...countersSpec,
        handlers: [
          countersSpec.handlers[0] as never,
          countersSpec.handlers[0] as never,
        ],
      }),
      'validation',
    );
    if (error.code === 'validation') {
      expect(JSON.stringify(error.issues)).toContain('duplicate handler');
    }
  });

  it('rejects a spec with no handlers', () => {
    const log = logWithThreeEvents();
    expectError(
      foldStream(log, 'stream:world-a', {
        ...countersSpec,
        handlers: [],
      }),
      'validation',
    );
  });

  it('rejects a record list containing a causal cycle', () => {
    // Hand-build two validly-sealed records that causally reference each
    // other (impossible to APPEND, but foldEventRecords consumes record
    // lists directly — the cycle is detected and typed).
    const a = sealEvent(
      worldEvent({
        causalParent: { streamId: 'stream:world-b', sequence: 1 },
      }),
    );
    const b = sealEvent(
      worldEvent({
        streamId: 'stream:world-b',
        causalParent: { streamId: 'stream:world-a', sequence: 1 },
      }),
    );
    if (!a.ok || !b.ok) throw new Error('fixtures must seal');
    const records = [eventRecordFor(a.value.event), eventRecordFor(b.value.event)];
    const error = expectError(foldEventRecords(records, countersSpec), 'validation');
    expect(error.message).toContain('causal cycle');
  });
});

describe('replay divergence detection (negative — typed)', () => {
  it('a replayed digest that differs from the RECORD is a typed replay-divergence', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    // Record the checkpoint of a DIFFERENT log (a divergence: the same
    // recorded digest must not apply to this reconstruction).
    const otherLog = logWithIntersectingStreams();
    const other = unwrapFold(
      foldStreams(otherLog, ['stream:world-a', 'stream:world-b'], countersSpec),
    );
    const recorded = checkpointOf(other);
    const error = expectError(verifyReconstruction(folded, recorded), 'replay-divergence');
    if (error.code === 'replay-divergence') {
      expect(error.expected).toBe(other.stateDigest);
      expect(error.encountered).toBe(folded.stateDigest);
    }
  });

  it('verifyDigest reports the typed replay-divergence on mismatch', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const forged = folded.stateDigest.startsWith('f')
      ? '0'.repeat(64)
      : 'f'.repeat(64);
    const error = expectError(verifyDigest(folded, forged), 'replay-divergence');
    if (error.code === 'replay-divergence') {
      expect(error.expected).toBe(forged);
      expect(error.encountered).toBe(folded.stateDigest);
    }
  });

  it('a tampered reconstruction (extra event applied) diverges from the record', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    // Tamper: record claims fewer events than the replay folded.
    const error = expectError(
      verifyReconstruction(folded, {
        ...checkpointOf(folded),
        eventCount: folded.eventCount - 1,
        cursors: [{ streamId: 'stream:world-a', lastSequence: 2 }],
      }),
      'replay-divergence',
    );
    expect(error.code).toBe('replay-divergence');
  });

  it('a matching record verifies cleanly (the positive control)', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const verified = verifyReconstruction(folded, checkpointOf(folded));
    expect(verified.ok).toBe(true);
  });
});

describe('replay checkpointing (negative — tamper detection)', () => {
  it('a checkpoint state whose digest does not match is checkpoint-mismatch', () => {
    const log = logWithThreeEvents();
    const partialLog = logWithThreeEvents();
    // Fold only part (simulate by folding the full log and resuming with
    // a DIFFERENT state than recorded).
    const folded = unwrapFold(foldStream(partialLog, 'stream:world-a', countersSpec));
    const checkpoint = checkpointOf(folded);
    const tamperedState = {
      ...folded.state,
      entityAssertions: folded.state.entityAssertions + 100,
    };
    const error = expectError(
      resumeFold(log, checkpoint, countersSpec, { checkpointState: tamperedState }),
      'checkpoint-mismatch',
    );
    if (error.code === 'checkpoint-mismatch') {
      expect(error.expected).toBe(checkpoint.stateDigest);
      expect(error.encountered).not.toBe(checkpoint.stateDigest);
    }
  });

  it('resume on an unknown stream is the typed unknown-stream error', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const checkpoint = {
      ...checkpointOf(folded),
      streamIds: ['stream:ghost'],
    };
    expectError(
      resumeFold(log, checkpoint, countersSpec, { checkpointState: folded.state }),
      'unknown-stream',
    );
  });
});

// Import the event-log error type for the defensive mapping check.
export type { EventLogError };
