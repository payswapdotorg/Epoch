// Cursor/read primitives: ascending reads, cursor resume, bounds and
// limits, stream projections, and unknown-stream typing.
import { describe, expect, it } from 'vitest';
import { EventLog } from '../src/index';
import { appended, firstEvent, logWithThreeEvents, secondEvent, thirdEvent } from './helpers';

describe('event-log read primitives', () => {
  it('reads a whole stream in ascending sequence order', () => {
    const log = logWithThreeEvents();
    const records = log.readStream('stream:world-a');
    if (!records.ok) throw new Error(records.error.message);
    expect(records.value.map((record) => record.event.sequence)).toEqual([1, 2, 3]);
  });

  it('resumes from a cursor: after is an exclusive lower bound', () => {
    const log = logWithThreeEvents();
    const tail = log.readStream('stream:world-a', { after: 1 });
    if (!tail.ok) throw new Error(tail.error.message);
    expect(tail.value.map((record) => record.event.sequence)).toEqual([2, 3]);
  });

  it('bounds reads inclusively with `to` and caps them with `limit`', () => {
    const log = logWithThreeEvents();
    const windowed = log.readStream('stream:world-a', { after: 1, to: 2 });
    if (!windowed.ok) throw new Error(windowed.error.message);
    expect(windowed.value.map((record) => record.event.sequence)).toEqual([2]);
    const capped = log.readStream('stream:world-a', { limit: 2 });
    if (!capped.ok) throw new Error(capped.error.message);
    expect(capped.value.map((record) => record.event.sequence)).toEqual([1, 2]);
  });

  it('an exhausted cursor reads an empty page (not an error)', () => {
    const log = logWithThreeEvents();
    const drained = log.readStream('stream:world-a', { after: 3 });
    if (!drained.ok) throw new Error(drained.error.message);
    expect(drained.value).toEqual([]);
  });

  it('streamInfo projects the tenant scope and the resume cursor', () => {
    const log = logWithThreeEvents();
    const info = log.streamInfo('stream:world-a');
    if (!info.ok) throw new Error(info.error.message);
    expect(info.value).toEqual({
      streamId: 'stream:world-a',
      tenantId: 'tenant:acme',
      firstSequence: 1,
      lastSequence: 3,
      eventCount: 3,
    });
  });

  it('reading an unknown stream is a typed unknown-stream error', () => {
    const log = new EventLog();
    const missing = log.readStream('stream:ghost');
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe('unknown-stream');
      if (missing.error.code === 'unknown-stream') {
        expect(missing.error.streamId).toBe('stream:ghost');
      }
    }
    expect(log.hasStream('stream:ghost')).toBe(false);
  });

  it('a log can host many independent streams of one tenant', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    appended(log, secondEvent());
    appended(
      log,
      firstEvent({
        streamId: 'stream:world-b',
        payload: { discriminator: 'acme:note', data: { kind: 'checkpoint' } },
      }),
    );
    appended(log, thirdEvent());
    expect(log.size).toBe(4);
    expect(log.streamCount).toBe(2);
    const streams = log.listStreams();
    expect(streams.map((stream) => stream.streamId)).toEqual([
      'stream:world-a',
      'stream:world-b',
    ]);
    const a = log.streamInfo('stream:world-a');
    if (!a.ok) throw new Error(a.error.message);
    expect(a.value.lastSequence).toBe(3);
  });
});
