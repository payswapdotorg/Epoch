import { z } from 'zod';
import {
  AssertionIdSchema,
  EntityIdSchema,
  InstantSchema,
  PropertyBagSchema,
  TypeKeySchema,
} from './primitives';
import { PropertySpecSchema } from './entity';

/**
 * Runtime validators for relation types and materialized relations
 * (contracts/world/src/relation.ts).
 */

export const RelationTypeDefinitionSchema = z
  .strictObject({
    key: TypeKeySchema,
    description: z.string().max(2048).optional(),
    sourceType: TypeKeySchema,
    targetType: TypeKeySchema,
    cardinality: z.enum(['one-one', 'one-many', 'many-one', 'many-many']).optional(),
    properties: z.record(z.string().min(1).max(256), PropertySpecSchema).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:relation-type-definition',
    title: 'RelationTypeDefinition',
  });

export const RelationSchema = z
  .strictObject({
    id: z
      .string()
      .regex(/^rel-[0-9a-f]{64}$/, 'relation ids are derived: rel-<sha256-of-key>'),
    type: TypeKeySchema,
    source: EntityIdSchema,
    target: EntityIdSchema,
    properties: PropertyBagSchema,
    assertionId: AssertionIdSchema,
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:relation',
    title: 'Relation',
    description: 'Materialized relation view (immutable value object) resolved from the live assertion of its (type, source, target) key.',
  });
