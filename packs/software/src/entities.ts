/**
 * Software entity bindings (DP1.0 "entity/relationship extensions"): W002
 * World Model entity-type keys bound to software concepts (system, service,
 * environment, repository, release unit). DESCRIPTIVE bindings — the World
 * Model remains the semantic world authority; the pack never defines new
 * entity authorities.
 */
import { z } from 'zod';
import { QualifiedNameSchema } from '@epoch/solution-delivery';
import { TypeKeySchema } from '@epoch/world-model';
import {
  ENTITY_BINDING_SCHEMA_NAME,
  SOFTWARE_CONCEPTS,
  SOFTWARE_PACK_RECORD_VERSION,
  type SoftwareConcept,
} from './version';

/** One World Model entity binding: a W002 entity-type key bound to a software concept. */
export const EntityBindingSchema = z
  .strictObject({
    schema: z.literal(ENTITY_BINDING_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    bindingId: QualifiedNameSchema,
    entityTypeKey: TypeKeySchema,
    softwareConcept: z.enum(SOFTWARE_CONCEPTS),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'EntityBinding',
    title: 'EntityBinding',
    description:
      'One descriptive World Model entity binding: a W002 entity-type key bound to a software concept (system/service/environment/repository/release-unit) — never a new authority.',
  });

/** One entity binding. */
export type EntityBinding = z.infer<typeof EntityBindingSchema>;

/**
 * The software entity bindings: W002 entity-type keys in the `software:`
 * namespace for the five software concepts, sorted by bindingId ascending.
 */
export const SOFTWARE_ENTITY_BINDINGS: readonly EntityBinding[] = [
  {
    schema: 'epoch.pack-software.entity-binding',
    schemaVersion: 1,
    bindingId: 'software.bind.environment',
    entityTypeKey: 'software:environment',
    softwareConcept: 'environment',
    description:
      'Deployment environments — the provider-neutral tiers (development, integration, staging, production) a release unit rolls out through, referenced by work packages and deployment steps.',
  },
  {
    schema: 'epoch.pack-software.entity-binding',
    schemaVersion: 1,
    bindingId: 'software.bind.release-unit',
    entityTypeKey: 'software:release-unit',
    softwareConcept: 'release-unit',
    description:
      'Release units — the versioned, deployable artifacts whose release milestones the roadmap view projects.',
  },
  {
    schema: 'epoch.pack-software.entity-binding',
    schemaVersion: 1,
    bindingId: 'software.bind.repository',
    entityTypeKey: 'software:repository',
    softwareConcept: 'repository',
    description:
      'Source repositories — the version-controlled code stores that services build from and verification evidence references.',
  },
  {
    schema: 'epoch.pack-software.entity-binding',
    schemaVersion: 1,
    bindingId: 'software.bind.service',
    entityTypeKey: 'software:service',
    softwareConcept: 'service',
    description:
      'Deployable services — the independently versioned runtime components (interfaces, workers, frontends) that solution lines specify and work packages realize.',
  },
  {
    schema: 'epoch.pack-software.entity-binding',
    schemaVersion: 1,
    bindingId: 'software.bind.system',
    entityTypeKey: 'software:system',
    softwareConcept: 'system',
    description:
      'Software systems — the top-level product boundary grouping services, environments and repositories for planning, observation and outcome measurement.',
  },
];

/**
 * Classify one World Model entity against the entity bindings: a pure fold
 * mapping `{ id, type }` to the bound software concept (undefined when the
 * entity type carries no software binding — partial data, never a
 * blocker). Deterministic: the FIRST binding (bindingId order) matching the
 * entity type wins.
 */
export function classifyWorldEntity(
  bindings: readonly EntityBinding[],
  entity: { readonly id: string; readonly type: string },
): { readonly entityId: string; readonly concept: SoftwareConcept | undefined } {
  const sorted = [...bindings].sort((a, b) => (a.bindingId < b.bindingId ? -1 : 1));
  const binding = sorted.find((candidate) => candidate.entityTypeKey === entity.type);
  return { entityId: entity.id, concept: binding?.softwareConcept };
}
