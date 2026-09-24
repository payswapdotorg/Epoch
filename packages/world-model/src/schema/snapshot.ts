import { z } from 'zod';
import { AssertionSchema } from './assertion';
import { EntityTypeDefinitionSchema } from './entity';
import { ExternalMappingSchema } from './ingestion';
import { WorldEventSchema } from './event';
import { RelationTypeDefinitionSchema } from './relation';
import { WORLD_CONTRACTS_VERSION, WORLD_MODEL_SCHEMA_NAME } from '../version';

/**
 * Runtime validators for world snapshots
 * (contracts/world/src/snapshot.ts).
 *
 * The content schema enforces the deterministic ordering invariants
 * (assertions and events strictly increasing by sequence, types sorted by
 * key, mappings sorted by id) so a tampered or reordered snapshot fails
 * validation before the digest is even checked.
 */

const SnapshotContent = {
  schema: z.literal(WORLD_MODEL_SCHEMA_NAME),
  version: z.literal(WORLD_CONTRACTS_VERSION),
  sequence: z.number().int().nonnegative(),
  entityTypes: z.array(EntityTypeDefinitionSchema).readonly(),
  relationTypes: z.array(RelationTypeDefinitionSchema).readonly(),
  externalMappings: z.array(ExternalMappingSchema).readonly(),
  assertions: z.array(AssertionSchema).readonly(),
  events: z.array(WorldEventSchema).readonly(),
};

function checkStrictlyIncreasing(sequences: readonly number[]): boolean {
  for (let i = 1; i < sequences.length; i += 1) {
    if (sequences[i] <= sequences[i - 1]) return false;
  }
  return true;
}

export const WorldSnapshotContentSchema = z
  .strictObject(SnapshotContent)
  .readonly()
  .superRefine((value, ctx) => {
    if (!checkStrictlyIncreasing(value.assertions.map((a) => a.sequence))) {
      ctx.addIssue({ code: 'custom', message: 'assertions must be ordered by strictly increasing sequence', path: ['assertions'] });
    }
    if (!checkStrictlyIncreasing(value.events.map((e) => e.sequence))) {
      ctx.addIssue({ code: 'custom', message: 'events must be ordered by strictly increasing sequence', path: ['events'] });
    }
    const maxEvent = value.events.length > 0 ? value.events[value.events.length - 1].sequence : 0;
    const maxAssertion = value.assertions.length > 0 ? value.assertions[value.assertions.length - 1].sequence : 0;
    const expected = Math.max(1, maxEvent, maxAssertion);
    if (value.sequence !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `sequence must equal the highest consumed sequence number (${expected})`,
        path: ['sequence'],
      });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:world-snapshot-content',
    title: 'WorldSnapshotContent',
  });

export const WorldSnapshotSchema = z
  .strictObject({
    ...SnapshotContent,
    digest: z.string().regex(/^[0-9a-f]{64}$/, 'snapshot digests are sha-256 hex'),
  })
  .readonly()
  .superRefine((value, ctx) => {
    if (!checkStrictlyIncreasing(value.assertions.map((a) => a.sequence))) {
      ctx.addIssue({ code: 'custom', message: 'assertions must be ordered by strictly increasing sequence', path: ['assertions'] });
    }
    if (!checkStrictlyIncreasing(value.events.map((e) => e.sequence))) {
      ctx.addIssue({ code: 'custom', message: 'events must be ordered by strictly increasing sequence', path: ['events'] });
    }
    const maxEvent = value.events.length > 0 ? value.events[value.events.length - 1].sequence : 0;
    const maxAssertion = value.assertions.length > 0 ? value.assertions[value.assertions.length - 1].sequence : 0;
    const expected = Math.max(1, maxEvent, maxAssertion);
    if (value.sequence !== expected) {
      ctx.addIssue({
        code: 'custom',
        message: `sequence must equal the highest consumed sequence number (${expected})`,
        path: ['sequence'],
      });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:world-snapshot',
    title: 'WorldSnapshot',
    description: 'Deterministic, versioned full-history serialization with sha-256 integrity digest.',
  });
