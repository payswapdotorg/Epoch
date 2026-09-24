import { z } from 'zod';
import { EntityIdSchema, InstantSchema, PropertyBagSchema, TypeKeySchema } from './primitives';

/**
 * Runtime validators for entity types and materialized entities
 * (contracts/world/src/entity.ts).
 */

export const PropertySpecSchema = z
  .strictObject({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'json']),
    description: z.string().max(2048).optional(),
    required: z.boolean().optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:property-spec',
    title: 'PropertySpec',
  });

export const EntityTypeDefinitionSchema = z
  .strictObject({
    key: TypeKeySchema,
    description: z.string().max(2048).optional(),
    extends: TypeKeySchema.optional(),
    origin: z.enum(['core', 'extension']).optional(),
    properties: z.record(z.string().min(1).max(256), PropertySpecSchema).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:entity-type-definition',
    title: 'EntityTypeDefinition',
  });

export const EntitySchema = z
  .strictObject({
    id: EntityIdSchema,
    type: TypeKeySchema,
    properties: PropertyBagSchema,
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:entity',
    title: 'Entity',
    description: 'Materialized entity view (immutable value object) resolved from live assertions.',
  });
