/**
 * @epoch/provenance — runtime zod validators for the published contract
 * types. Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * provenance door.
 */
import { z } from 'zod';
import { SLUG_PATTERN, TimestampSchema } from '@epoch/agent-protocol';
import { PROVENANCE_AGENT_KINDS, PROVENANCE_RELATIONS, PROVENANCE_RECORD_VERSION } from './version';

/** Opaque node/statement identifier (owned by the producing domain). */
const NodeId = z.string().min(1).max(256);

/** Proof-grade digest: lowercase hex SHA-256, exactly 64 characters. */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 digest as lowercase hex — the content-address form (mirrors @epoch/evidence). */
const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'urn:epoch:provenance:sha256-digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Serialized-form version discriminator for provenance graphs (v1). */
export const ProvenanceVersionSchema = z.literal(PROVENANCE_RECORD_VERSION).meta({
  id: 'urn:epoch:provenance:graph-version',
  title: 'ProvenanceGraphVersion',
  description: 'Version discriminator carried by every serialized provenance graph (currently 1).',
});

/** PROV-DM agent kinds, adapted. */
export const ProvenanceAgentKindSchema = z.enum(PROVENANCE_AGENT_KINDS).meta({
  id: 'urn:epoch:provenance:agent-kind',
  title: 'ProvenanceAgentKind',
  description: 'Kind of acting thing: person, organization, software, hardware, or system.',
});

/** The six core PROV-DM relations, adapted. */
export const ProvenanceRelationSchema = z.enum(PROVENANCE_RELATIONS).meta({
  id: 'urn:epoch:provenance:relation',
  title: 'ProvenanceRelation',
  description: 'Core PROV-DM relations adapted: was-generated-by, used, was-associated-with, was-attributed-to, was-derived-from, acted-on-behalf-of.',
});

/** Who: an acting thing. */
export const ProvenanceAgentSchema = z
  .strictObject({
    agentId: NodeId,
    agentKind: ProvenanceAgentKindSchema,
    displayName: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:provenance:agent',
    title: 'ProvenanceAgent',
    description: 'A person, organization, software agent, hardware device, or system that acts.',
  });

/** How/when: a process or action. */
export const ProvenanceActivitySchema = z
  .strictObject({
    activityId: NodeId,
    activityKind: z.string().regex(SLUG_PATTERN),
    startedAt: TimestampSchema.optional(),
    endedAt: TimestampSchema.optional(),
    displayName: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:provenance:activity',
    title: 'ProvenanceActivity',
    description: 'A process or action performed over a period of time; kind is an open kebab-case slug.',
  });

/** What: a durable thing, optionally content-addressed. */
export const ProvenanceEntitySchema = z
  .strictObject({
    entityId: NodeId,
    entityKind: z.string().regex(SLUG_PATTERN),
    digest: Sha256DigestSchema.optional(),
    displayName: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:provenance:entity',
    title: 'ProvenanceEntity',
    description: 'A durable thing an activity used or generated; carries an exact content digest when content-addressed.',
  });

/** wasGeneratedBy(entity, activity[, time][, role]). */
const WasGeneratedBySchema = z
  .strictObject({
    relation: z.literal('was-generated-by'),
    entityId: NodeId,
    activityId: NodeId,
    time: TimestampSchema.optional(),
    role: z.string().min(1).max(128).optional(),
  })
  .readonly();

/** used(activity, entity[, time][, role]). */
const UsedSchema = z
  .strictObject({
    relation: z.literal('used'),
    activityId: NodeId,
    entityId: NodeId,
    time: TimestampSchema.optional(),
    role: z.string().min(1).max(128).optional(),
  })
  .readonly();

/** wasAssociatedWith(activity, agent[, role]). */
const WasAssociatedWithSchema = z
  .strictObject({
    relation: z.literal('was-associated-with'),
    activityId: NodeId,
    agentId: NodeId,
    role: z.string().min(1).max(128).optional(),
  })
  .readonly();

/** wasAttributedTo(entity, agent). */
const WasAttributedToSchema = z
  .strictObject({
    relation: z.literal('was-attributed-to'),
    entityId: NodeId,
    agentId: NodeId,
  })
  .readonly();

/** wasDerivedFrom(generatedEntity, usedEntity[, activity]). */
const WasDerivedFromSchema = z
  .strictObject({
    relation: z.literal('was-derived-from'),
    generatedEntityId: NodeId,
    usedEntityId: NodeId,
    activityId: NodeId.optional(),
  })
  .readonly();

/** actedOnBehalfOf(subordinate, responsible[, activity]). */
const ActedOnBehalfOfSchema = z
  .strictObject({
    relation: z.literal('acted-on-behalf-of'),
    subordinateAgentId: NodeId,
    responsibleAgentId: NodeId,
    activityId: NodeId.optional(),
  })
  .readonly();

/** The six core relations as one discriminated union of statements. */
export const ProvenanceStatementSchema = z
  .discriminatedUnion('relation', [
    WasGeneratedBySchema,
    UsedSchema,
    WasAssociatedWithSchema,
    WasAttributedToSchema,
    WasDerivedFromSchema,
    ActedOnBehalfOfSchema,
  ])
  .meta({
    id: 'urn:epoch:provenance:statement',
    title: 'ProvenanceStatement',
    description: 'One typed PROV-DM relation statement referencing nodes declared in the same graph.',
  });

/** A closed, self-contained provenance graph. */
export const ProvenanceGraphSchema = z
  .strictObject({
    schemaVersion: ProvenanceVersionSchema,
    agents: z.array(ProvenanceAgentSchema).readonly(),
    activities: z.array(ProvenanceActivitySchema).readonly(),
    entities: z.array(ProvenanceEntitySchema).readonly(),
    statements: z.array(ProvenanceStatementSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:provenance:graph',
    title: 'ProvenanceGraph',
    description: 'A bundle of agents, activities, entities, and the six core relation statements connecting them.',
  });
