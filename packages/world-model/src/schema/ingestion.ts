import { z } from 'zod';
import { TypeKeySchema } from './primitives';

/**
 * Runtime validators for the external-standards ingestion contract surface
 * (contracts/world/src/ingestion.ts).
 *
 * Mappings are pure data mapping external shapes INTO registered Epoch
 * types; `epoch` is a reserved standard identifier and rejected at the model
 * boundary (WM_AUTHORITY).
 */

const PropertyMap = z.record(z.string().min(1).max(256), z.string().min(1).max(256)).readonly();

export const ExternalEntityTypeMappingSchema = z
  .strictObject({
    external: z.string().min(1).max(256),
    target: TypeKeySchema,
    propertyMap: PropertyMap.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:external-entity-type-mapping',
    title: 'ExternalEntityTypeMapping',
  });

export const ExternalRelationTypeMappingSchema = z
  .strictObject({
    external: z.string().min(1).max(256),
    target: TypeKeySchema,
    propertyMap: PropertyMap.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:external-relation-type-mapping',
    title: 'ExternalRelationTypeMapping',
  });

export const ExternalMappingSchema = z
  .strictObject({
    id: z.string().min(1).max(256),
    standard: z.string().min(1).max(256),
    standardVersion: z.string().min(1).max(64).optional(),
    description: z.string().max(2048).optional(),
    entityTypes: z.array(ExternalEntityTypeMappingSchema).readonly(),
    relationTypes: z.array(ExternalRelationTypeMappingSchema).readonly(),
  })
  .readonly()
  .superRefine((value, ctx) => {
    if (value.standard === 'epoch') {
      ctx.addIssue({ code: 'custom', message: "standard 'epoch' is reserved", path: ['standard'] });
    }
    if (value.entityTypes.length === 0 && value.relationTypes.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'a mapping must map at least one entity or relation type' });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:external-mapping',
    title: 'ExternalMapping',
    description: 'Declared-external mapping of an external standard into registered Epoch types; pure data, never executed.',
  });
