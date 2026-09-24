import { z } from 'zod';
import { ConfidenceSchema } from './confidence';
import {
  AssertionIdSchema,
  EntityIdSchema,
  InstantSchema,
  PropertyBagSchema,
  PropertyNameSchema,
  TypeKeySchema,
} from './primitives';
import { ProvenanceSchema } from './provenance';
import { ValiditySchema } from './validity';

/**
 * Runtime validators for assertions — the unit of stated truth
 * (contracts/world/src/assertion.ts).
 */

const EntityStatement = z
  .strictObject({
    kind: z.literal('entity'),
    entityId: EntityIdSchema,
    entityType: TypeKeySchema,
    properties: PropertyBagSchema.optional(),
  })
  .readonly();

const EntityPropertyStatement = z
  .strictObject({
    kind: z.literal('entity-property'),
    entityId: EntityIdSchema,
    property: PropertyNameSchema,
    value: z.json(),
  })
  .readonly();

const RelationStatement = z
  .strictObject({
    kind: z.literal('relation'),
    relationType: TypeKeySchema,
    source: EntityIdSchema,
    target: EntityIdSchema,
    properties: PropertyBagSchema.optional(),
  })
  .readonly();

export const AssertionStatementSchema = z
  .discriminatedUnion('kind', [EntityStatement, EntityPropertyStatement, RelationStatement])
  .meta({
    id: 'urn:epoch:contracts:world:assertion-statement',
    title: 'AssertionStatement',
  });

export const AssertionStatusSchema = z.enum(['live', 'superseded', 'retracted']);

export const AssertionSchema = z
  .strictObject({
    id: AssertionIdSchema,
    key: z.string().min(1).max(2048),
    statement: AssertionStatementSchema,
    status: AssertionStatusSchema,
    sequence: z.number().int().nonnegative(),
    assertedAt: InstantSchema,
    provenance: ProvenanceSchema,
    confidence: ConfidenceSchema,
    validity: ValiditySchema.optional(),
    supersedes: AssertionIdSchema.optional(),
    supersededBy: AssertionIdSchema.optional(),
    retractedAt: InstantSchema.optional(),
    retractionReason: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((value, ctx) => {
    if (value.status === 'retracted') {
      if (value.retractedAt === undefined) {
        ctx.addIssue({ code: 'custom', message: 'retracted assertions must carry retractedAt', path: ['retractedAt'] });
      }
      if (value.retractionReason === undefined) {
        ctx.addIssue({ code: 'custom', message: 'retracted assertions must carry retractionReason', path: ['retractionReason'] });
      }
      if (value.supersededBy !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'retracted assertions cannot be superseded', path: ['supersededBy'] });
      }
    }
    if (value.status === 'superseded' && value.supersededBy === undefined) {
      ctx.addIssue({ code: 'custom', message: 'superseded assertions must carry supersededBy', path: ['supersededBy'] });
    }
    if (value.status === 'live' && (value.supersededBy !== undefined || value.retractedAt !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'live assertions cannot carry tombstone fields', path: ['status'] });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:assertion',
    title: 'Assertion',
    description: 'The unit of stated truth; retains provenance, confidence, validity and full lifecycle history.',
  });

export const AssertionInputSchema = z
  .strictObject({
    statement: AssertionStatementSchema,
    provenance: ProvenanceSchema,
    confidence: ConfidenceSchema,
    validity: ValiditySchema.optional(),
    supersedes: AssertionIdSchema.optional(),
    at: InstantSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:assertion-input',
    title: 'AssertionInput',
    description: 'Authority-gated write input; provenance and confidence are mandatory.',
  });

export const RetractionInputSchema = z
  .strictObject({
    assertionId: AssertionIdSchema,
    reason: z.string().min(1).max(2048),
    provenance: ProvenanceSchema,
    at: InstantSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:retraction-input',
    title: 'RetractionInput',
    description: 'Tombstone write input; history is retained, never deleted.',
  });
