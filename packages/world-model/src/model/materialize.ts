import type {
  Assertion,
  AssertionId,
  Entity,
  EntityId,
  Instant,
  Relation,
  TypeKey,
} from '@epoch/world-contracts';
import { deepFreeze } from '../immutable';
import { compareInstants } from '../time';
import { entityKey, parseKey, relationKeyId, relationKey } from './keys';
import { resolveKeyAt } from './reconcile';
import type { WorldStore } from './store';

/**
 * Materialization — resolving assertion history into immutable read views.
 *
 * Entities: the live `entity` assertion establishes existence, type and
 * initial properties; live `entity-property` assertions overlay individual
 * property values. Retracted/expired property assertions fall back to the
 * initial bag (latest-wins with fallback, full history retained).
 *
 * Relations: the live `relation` assertion of the
 * (relationType, source, target) key establishes the edge.
 */

export function materializeEntityAt(store: WorldStore, entityId: EntityId, at: Instant): Entity | null {
  const existence = resolveKeyAt(store, entityKey(entityId), at);
  if (existence === null || existence.statement.kind !== 'entity') return null;

  const properties: Record<string, unknown> = { ...(existence.statement.properties ?? {}) };
  let updatedAt = existence.assertedAt;

  for (const key of store.propertyKeysOf(entityId)) {
    const live = resolveKeyAt(store, key, at);
    if (live === null) continue;
    if (live.statement.kind !== 'entity-property') continue;
    properties[live.statement.property] = live.statement.value;
    if (compareInstants(live.assertedAt, updatedAt) > 0) {
      updatedAt = live.assertedAt;
    }
  }

  const entity: Entity = {
    id: entityId,
    type: existence.statement.entityType,
    properties: properties as Entity['properties'],
    createdAt: existence.assertedAt,
    updatedAt,
  };
  return deepFreeze(entity);
}

export function materializeRelationAt(store: WorldStore, key: string, at: Instant): Relation | null {
  const parsed = parseKey(key);
  if (parsed === null || parsed[0] !== 'rel' || parsed.length !== 4) return null;
  const live = resolveKeyAt(store, key, at);
  if (live === null || live.statement.kind !== 'relation') return null;

  const relation: Relation = {
    id: relationKeyId(key),
    type: live.statement.relationType,
    source: live.statement.source,
    target: live.statement.target,
    properties: { ...(live.statement.properties ?? {}) },
    assertionId: live.id,
    createdAt: live.assertedAt,
    updatedAt: live.assertedAt,
  };
  return deepFreeze(relation);
}

export function materializeAllEntities(store: WorldStore, at: Instant, filterType?: TypeKey): readonly Entity[] {
  const entities: Entity[] = [];
  for (const id of store.entityIds()) {
    const entity = materializeEntityAt(store, id, at);
    if (entity === null) continue;
    if (filterType !== undefined && !store.registry.isEntityAssignable(entity.type, filterType)) continue;
    entities.push(entity);
  }
  return entities;
}

export function materializeAllRelations(
  store: WorldStore,
  at: Instant,
  filter?: { type?: TypeKey; ofEntity?: EntityId },
): readonly Relation[] {
  const relations: Relation[] = [];
  for (const key of store.relationKeys()) {
    const relation = materializeRelationAt(store, key, at);
    if (relation === null) continue;
    if (filter?.type !== undefined && relation.type !== filter.type) continue;
    if (filter?.ofEntity !== undefined && relation.source !== filter.ofEntity && relation.target !== filter.ofEntity) {
      continue;
    }
    relations.push(relation);
  }
  return relations;
}

/** Every assertion whose statement concerns one entity (existence + properties). */
export function entityHistoryAt(store: WorldStore, entityId: EntityId): readonly Assertion[] {
  const records: Assertion[] = [];
  for (const record of store.assertions.values()) {
    const statement = record.statement;
    if (
      (statement.kind === 'entity' || statement.kind === 'entity-property') &&
      statement.entityId === entityId
    ) {
      records.push(record);
    }
  }
  records.sort((a, b) => a.sequence - b.sequence);
  return records;
}

/** Every assertion ever made against one relation key. */
export function relationHistoryAt(
  store: WorldStore,
  relationType: TypeKey,
  source: EntityId,
  target: EntityId,
): readonly Assertion[] {
  const ids = store.byKey.get(relationKey(relationType, source, target)) ?? [];
  return ids
    .map((id) => store.assertions.get(id))
    .filter((record): record is Assertion => record !== undefined)
    .sort((a, b) => a.sequence - b.sequence);
}

/** Assertion ids referenced by provenance derivation links (integrity helper). */
export function referencedAssertionIds(record: Assertion): readonly AssertionId[] {
  return record.provenance.derivedFrom ?? [];
}
