import { z } from 'zod';
import { InstantSchema, JsonObjectSchema } from './primitives';
import { ActorRefSchema } from './provenance';

/**
 * Runtime validators for world events — the append-only history
 * (contracts/world/src/event.ts).
 */

export const WorldEventTypeSchema = z.enum([
  'world-created',
  'entity-type-registered',
  'relation-type-registered',
  'external-mapping-registered',
  'assertion-applied',
  'assertion-superseded',
  'assertion-retracted',
]);

export const WorldEventSchema = z
  .strictObject({
    id: z.string().regex(/^evt-[0-9]+$/, 'event ids are assigned by the world model as evt-<sequence>'),
    sequence: z.number().int().nonnegative(),
    type: WorldEventTypeSchema,
    at: InstantSchema,
    actor: ActorRefSchema,
    subject: z.string().min(1).max(512),
    detail: JsonObjectSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:world-event',
    title: 'WorldEvent',
    description: 'Append-only state-change record; the audit trail and replay source.',
  });
