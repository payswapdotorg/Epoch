// Published-surface integrity: the exported vocabulary and the schema
// surface are complete, unique, and round-trip through their validators.
import { describe, expect, it } from 'vitest';
import {
  foldStream,
  REPLAY_CONTRACT_VERSION,
  REPLAY_FOLD_ORDER,
  REPLAY_RECORD_VERSION,
  REPLAY_SCHEMA_SURFACE,
  ReplayCheckpointSchema,
  ReconstructionSnapshotSchema,
  replayOrderKey,
  snapshotOf,
} from '../src/index';
import { countersSpec, logWithThreeEvents, unwrapFold } from './helpers';

describe('replay published surface', () => {
  it('version constants and the fold order are pinned', () => {
    expect(REPLAY_CONTRACT_VERSION).toBe('1.0.0');
    expect(REPLAY_RECORD_VERSION).toBe(1);
    expect(REPLAY_FOLD_ORDER).toBe('causal-topological');
    expect(replayOrderKey('stream:world-a', 3)).toBe('stream:world-a#3');
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = REPLAY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(types);
  });

  it('serialized checkpoints validate against the published validator', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const checkpoint = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        streamIds: ['stream:world-a'],
        cursors: [{ streamId: 'stream:world-a', lastSequence: 3 }],
        stateDigest: folded.stateDigest,
        eventCount: 3,
      }),
    );
    expect(ReplayCheckpointSchema.safeParse(checkpoint).success).toBe(true);
    // A vendor field is rejected (strict objects).
    expect(
      ReplayCheckpointSchema.safeParse({ ...checkpoint, kafkaConsumerGroup: 'cg-1' }).success,
    ).toBe(false);
  });

  it('serialized reconstruction snapshots validate against the published validator', () => {
    const log = logWithThreeEvents();
    const folded = unwrapFold(foldStream(log, 'stream:world-a', countersSpec));
    const snapshot = JSON.parse(JSON.stringify(snapshotOf(countersSpec, folded)));
    expect(ReconstructionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      ReconstructionSnapshotSchema.safeParse({ ...snapshot, cacheTtl: 30 }).success,
    ).toBe(false);
  });

  it('checkpoints with duplicate streams or dangling cursors are rejected', () => {
    const base = {
      schemaVersion: 1,
      streamIds: ['stream:world-a', 'stream:world-a'],
      cursors: [{ streamId: 'stream:world-a', lastSequence: 3 }],
      stateDigest: '0'.repeat(64),
      eventCount: 3,
    };
    expect(ReplayCheckpointSchema.safeParse(base).success).toBe(false);
    const dangling = {
      schemaVersion: 1,
      streamIds: ['stream:world-a'],
      cursors: [
        { streamId: 'stream:world-a', lastSequence: 3 },
        { streamId: 'stream:ghost', lastSequence: 1 },
      ],
      stateDigest: '0'.repeat(64),
      eventCount: 3,
    };
    expect(ReplayCheckpointSchema.safeParse(dangling).success).toBe(false);
  });
});
