import { z } from 'zod';
import {
  AssertionSchema,
} from './assertion';
import { EntitySchema } from './entity';
import { EntityIdSchema, InstantSchema } from './primitives';
import { RelationSchema } from './relation';

/**
 * Runtime validators for task-sufficiency queries
 * (contracts/world/src/query.ts).
 */

export const DecisionScopeSpecSchema = z
  .strictObject({
    entities: z.array(EntityIdSchema).min(1).readonly(),
    relationDepth: z.number().int().min(0).max(16).optional(),
    requiredConfidence: z.number().min(0).max(1).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:decision-scope-spec',
    title: 'DecisionScopeSpec',
  });

export const InformationGapSchema = z
  .strictObject({
    kind: z.enum(['absent-entity', 'low-confidence', 'missing-property', 'unsupported-claim']),
    subject: z.string().min(1).max(2048),
    detail: z.string().min(1).max(2048),
    observedConfidence: z.number().min(0).max(1).optional(),
    requiredConfidence: z.number().min(0).max(1).optional(),
    couldChangeDecision: z.literal(true),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:information-gap',
    title: 'InformationGap',
    description: 'Identified way missing information or uncertainty could change a decision; a hook for acquisition, not acquisition itself.',
  });

export const ResolvedAssertionSchema = z
  .strictObject({
    key: z.string().min(1).max(2048),
    assertion: AssertionSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:resolved-assertion',
    title: 'ResolvedAssertion',
  });

export const TaskSufficientWorldSchema = z
  .strictObject({
    at: InstantSchema,
    entities: z.array(EntitySchema).readonly(),
    relations: z.array(RelationSchema).readonly(),
    resolutions: z.array(ResolvedAssertionSchema).readonly(),
    gaps: z.array(InformationGapSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:task-sufficient-world',
    title: 'TaskSufficientWorld',
    description: 'Reconstructed sub-world for a decision scope with its live resolutions and information gaps.',
  });
