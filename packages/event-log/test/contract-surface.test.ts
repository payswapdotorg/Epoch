// Published-surface integrity: the exported vocabularies, the id
// patterns, the reserved namespaces, and the kernel payload kinds are
// exactly the architecture-pinned sets; every schema-surface type is
// exported from the package index and round-trips through its validator.
import { describe, expect, it } from 'vitest';
import {
  ACTION_EVENT_PHASES,
  ACTION_LIFECYCLE_EVENT_KIND,
  EVENT_ACTOR_PATTERN,
  EVENT_KIND_DISCRIMINATOR_PATTERN,
  EVENT_LOG_CONTRACT_VERSION,
  EVENT_LOG_RECORD_VERSION,
  EVENT_LOG_SCHEMA_SURFACE,
  EVENT_STREAM_ID_PATTERN,
  EVENT_SUBJECT_KINDS,
  EVENT_TENANT_ID_PATTERN,
  RESERVED_EVENT_NAMESPACES,
  WORLD_SUBJECTS_EVENT_KIND,
  WORLD_RELATION_ID_PATTERN,
} from '../src/index';
import {
  EventLogSnapshotSchema,
  EventRecordSchema,
  StreamInfoSchema,
} from '../src/index';
import { logWithThreeEvents } from './helpers';

describe('event-log published surface', () => {
  it('version constants are pinned', () => {
    expect(EVENT_LOG_CONTRACT_VERSION).toBe('1.0.0');
    expect(EVENT_LOG_RECORD_VERSION).toBe(1);
  });

  it('stream ids are kind-prefixed opaque slugs (no embedded objects)', () => {
    expect('stream:world-a').toMatch(EVENT_STREAM_ID_PATTERN);
    expect('stream:a').toMatch(EVENT_STREAM_ID_PATTERN);
    expect('Stream:A').not.toMatch(EVENT_STREAM_ID_PATTERN);
    expect('stream:').not.toMatch(EVENT_STREAM_ID_PATTERN);
    expect('stream:-leading-dash').not.toMatch(EVENT_STREAM_ID_PATTERN);
    expect('kafka:world-a').not.toMatch(EVENT_STREAM_ID_PATTERN);
    expect('stream:a'.repeat(64)).not.toMatch(EVENT_STREAM_ID_PATTERN);
  });

  it('tenant and actor ids mirror the W009 grammars', () => {
    expect('tenant:acme').toMatch(EVENT_TENANT_ID_PATTERN);
    expect('principal:lead-eng').toMatch(EVENT_ACTOR_PATTERN);
    expect('tenant:ACME').not.toMatch(EVENT_TENANT_ID_PATTERN);
    expect('openai:gpt').not.toMatch(EVENT_ACTOR_PATTERN);
  });

  it('discriminators are namespaced and the kernel namespaces are reserved', () => {
    expect('world:subjects').toMatch(EVENT_KIND_DISCRIMINATOR_PATTERN);
    expect('action:lifecycle').toMatch(EVENT_KIND_DISCRIMINATOR_PATTERN);
    expect('acme:inspection-note').toMatch(EVENT_KIND_DISCRIMINATOR_PATTERN);
    expect('not-namespaced').not.toMatch(EVENT_KIND_DISCRIMINATOR_PATTERN);
    expect('World:Subjects').not.toMatch(EVENT_KIND_DISCRIMINATOR_PATTERN);
    expect([...RESERVED_EVENT_NAMESPACES]).toEqual(['world', 'action']);
    expect([...EVENT_SUBJECT_KINDS]).toEqual(['entity', 'relation']);
  });

  it('the action phase vocabulary is closed and covers the lifecycle', () => {
    expect([...ACTION_EVENT_PHASES]).toEqual([
      'proposed',
      'authorized',
      'rejected',
      'executed',
      'effects-recorded',
      'failed',
    ]);
  });

  it('the kernel payload kinds are the reserved discriminators', () => {
    expect(WORLD_SUBJECTS_EVENT_KIND).toBe('world:subjects');
    expect(ACTION_LIFECYCLE_EVENT_KIND).toBe('action:lifecycle');
    expect(WORLD_RELATION_ID_PATTERN.source).toBe('^rel-[0-9a-f]{64}$');
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = EVENT_LOG_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(types);
  });

  it('serialized projections validate against the published validators', () => {
    const snapshot = logWithThreeEvents().snapshot();
    expect(EventLogSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      EventRecordSchema.safeParse(JSON.parse(JSON.stringify(snapshot.records[0]))).success,
    ).toBe(true);
    expect(StreamInfoSchema.safeParse(snapshot.streams[0]).success).toBe(true);
  });
});
