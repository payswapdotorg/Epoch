import type {
  EntityTypeDefinition,
  RelationTypeDefinition,
} from '@epoch/world-contracts';

/**
 * The builtin `core:` vocabulary.
 *
 * The kernel ships a minimal, domain-neutral vocabulary covering the
 * architecture's first-class graph constituents (actors, agents, resources,
 * models, artifacts, evidence) and their basic relations. Extensions
 * register additional namespaces; they can never redefine or extend into
 * the reserved `core:` namespace.
 *
 * Builtin relations use `core:entity` endpoints so they remain valid for
 * every entity type (endpoint assignability walks the entity-type
 * inheritance chain).
 */
export const CORE_ENTITY_TYPES: readonly EntityTypeDefinition[] = [
  {
    key: 'core:entity',
    description: 'Root entity type: every node in the typed property/relationship graph.',
    origin: 'core',
  },
  {
    key: 'core:actor',
    description: 'An actor: a human, agent, or system that can be the source of assertions.',
    extends: 'core:entity',
    origin: 'core',
    properties: {
      displayName: { type: 'string', description: 'Human-readable actor name.' },
    },
  },
  {
    key: 'core:agent',
    description: 'A reasoning agent (human-directed AI, solver, robot controller). Agents are participants, never semantic authority.',
    extends: 'core:actor',
    origin: 'core',
    properties: {
      framework: { type: 'string', description: 'Agent framework or runtime descriptor (opaque).' },
      model: { type: 'string', description: 'Model identifier (opaque, provider-neutral).' },
      version: { type: 'string', description: 'Agent implementation version.' },
    },
  },
  {
    key: 'core:resource',
    description: 'A resource with quantity and unit that constraints can budget.',
    extends: 'core:entity',
    origin: 'core',
    properties: {
      quantity: { type: 'number', description: 'Amount of the resource.' },
      unit: { type: 'string', description: 'Unit of measure (UCUM-compatible string recommended).' },
    },
  },
  {
    key: 'core:model',
    description: 'A model artifact (simulation model, geometry, ontology, computation) referenced by the world.',
    extends: 'core:entity',
    origin: 'core',
    properties: {
      format: { type: 'string', description: 'Model format descriptor (opaque).' },
      fidelity: { type: 'string', description: 'Fidelity class claimed by the model.' },
      version: { type: 'string', description: 'Model version.' },
    },
  },
  {
    key: 'core:artifact',
    description: 'A durable artifact (document, file, dataset) addressable by locator and digest.',
    extends: 'core:entity',
    origin: 'core',
    properties: {
      locator: { type: 'string', description: 'Opaque locator (path/URI).' },
      digest: { type: 'string', description: 'Lowercase hex content digest when known.' },
    },
  },
  {
    key: 'core:evidence',
    description: 'Evidence materialized as a first-class graph node; assertion provenance references evidence by opaque id.',
    extends: 'core:entity',
    origin: 'core',
    properties: {
      digest: { type: 'string', description: 'Lowercase hex content digest when known.' },
      locator: { type: 'string', description: 'Opaque locator (path/URI).' },
    },
  },
];

export const CORE_RELATION_TYPES: readonly RelationTypeDefinition[] = [
  {
    key: 'core:related-to',
    description: 'Generic association between two entities.',
    sourceType: 'core:entity',
    targetType: 'core:entity',
  },
  {
    key: 'core:part-of',
    description: 'Compositional containment: source is a part of target.',
    sourceType: 'core:entity',
    targetType: 'core:entity',
    cardinality: 'many-one',
  },
  {
    key: 'core:located-at',
    description: 'Spatial or logical location of the source entity.',
    sourceType: 'core:entity',
    targetType: 'core:entity',
    cardinality: 'many-one',
  },
  {
    key: 'core:uses',
    description: 'The source entity consumes or draws on the target resource.',
    sourceType: 'core:entity',
    targetType: 'core:resource',
  },
  {
    key: 'core:describes',
    description: 'A model describing an entity.',
    sourceType: 'core:model',
    targetType: 'core:entity',
  },
  {
    key: 'core:supports',
    description: 'Evidence supporting an entity or claim.',
    sourceType: 'core:evidence',
    targetType: 'core:entity',
  },
];
