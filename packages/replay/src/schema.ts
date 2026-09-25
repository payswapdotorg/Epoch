/**
 * @epoch/replay — runtime zod validators for the published contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * replay door (same policy as the W002-W010 validators). Every exported
 * schema is part of the published surface emitted under `schemas/`.
 */
import { z } from 'zod';
import { JsonValueSchema } from '@epoch/agent-protocol';
import { EventStreamIdSchema, EventSequenceSchema, Sha256DigestSchema } from '@epoch/event-log';
import { REPLAY_RECORD_VERSION } from './version';

/** Version discriminator on serialized replay records (v1). */
export const ReplayRecordVersionSchema = z.literal(REPLAY_RECORD_VERSION).meta({
  id: 'ReplayRecordVersion',
  title: 'ReplayRecordVersion',
  description:
    'Version discriminator carried by every serialized replay record (checkpoint and reconstruction snapshot; currently 1).',
});

/** One cursor position of a folded stream. */
export const ReplayCursorSchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    lastSequence: EventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'ReplayCursor',
    title: 'ReplayCursor',
    description: 'Per-stream resume coordinate: events with sequence > lastSequence apply next.',
  });

/** A recorded fold position (the resume + divergence anchor). */
export const ReplayCheckpointSchema = z
  .strictObject({
    schemaVersion: ReplayRecordVersionSchema,
    streamIds: z.array(EventStreamIdSchema).min(1).readonly(),
    cursors: z.array(ReplayCursorSchema).readonly(),
    stateDigest: Sha256DigestSchema,
    eventCount: z.number().int().min(0),
  })
  .readonly()
  .refine(
    (checkpoint) =>
      new Set(checkpoint.streamIds).size === checkpoint.streamIds.length &&
      checkpoint.cursors.every((cursor) => checkpoint.streamIds.includes(cursor.streamId)) &&
      new Set(checkpoint.cursors.map((cursor) => cursor.streamId)).size ===
        checkpoint.cursors.length,
    'stream ids must be unique and every cursor must reference a folded stream exactly once',
  )
  .meta({
    id: 'ReplayCheckpoint',
    title: 'ReplayCheckpoint',
    description:
      'Recorded fold position: folded streams, per-stream cursors, and the state digest at that position (resume and divergence anchor).',
  });

/** The serialized projection of a reconstruction. */
export const ReconstructionSnapshotSchema = z
  .strictObject({
    schemaVersion: ReplayRecordVersionSchema,
    streamIds: z.array(EventStreamIdSchema).min(1).readonly(),
    cursors: z.array(ReplayCursorSchema).readonly(),
    eventCount: z.number().int().min(0),
    state: JsonValueSchema,
    stateDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'ReconstructionSnapshot',
    title: 'ReconstructionSnapshot',
    description:
      'Serialized reconstruction projection: fold position plus the canonical state projection (content-addressed by stateDigest).',
  });

/** One flattened validation issue. */
export const ReplayIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'ReplayIssue',
    title: 'ReplayIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** One folded event trace entry (audit of the applied order). */
export const FoldedEventEntrySchema = z
  .strictObject({
    streamId: EventStreamIdSchema,
    sequence: EventSequenceSchema,
    discriminator: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'FoldedEventEntry',
    title: 'FoldedEventEntry',
    description: 'One applied event in a fold trace: (stream, sequence) plus its payload discriminator.',
  });

/**
 * The typed replay error value (discriminated on `code`). Serialized
 * form of {@link ReplayError} for contract consumers.
 */
export const ReplayErrorSchema = z
  .discriminatedUnion('code', [
    z
      .strictObject({
        code: z.literal('validation'),
        message: z.string().min(1),
        issues: z.array(ReplayIssueSchema).min(1).readonly(),
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('version-unsupported'),
        message: z.string().min(1),
        expected: z.string(),
        encountered: z.string(),
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('unknown-stream'),
        message: z.string().min(1),
        streamId: EventStreamIdSchema,
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('unknown-event-kind'),
        message: z.string().min(1),
        discriminator: z.string().min(1),
        streamId: EventStreamIdSchema,
        sequence: EventSequenceSchema,
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('checkpoint-mismatch'),
        message: z.string().min(1),
        expected: z.string(),
        encountered: z.string(),
      })
      .readonly(),
    z
      .strictObject({
        code: z.literal('replay-divergence'),
        message: z.string().min(1),
        expected: z.string(),
        encountered: z.string(),
        streamIds: z.array(EventStreamIdSchema).readonly(),
        eventCount: z.number().int().min(0),
      })
      .readonly(),
  ])
  .meta({
    id: 'ReplayError',
    title: 'ReplayError',
    description: 'Typed, discriminated replay error (validation, version skew, unknown stream/kind, checkpoint mismatch, divergence).',
  });
