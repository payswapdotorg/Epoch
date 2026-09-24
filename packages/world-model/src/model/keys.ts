import type { AssertionStatement, EntityId, PropertyName, TypeKey } from '@epoch/world-contracts';
import { canonicalJson } from '../canonical';
import { sha256Hex } from '../sha256';

/**
 * Reconciliation keys — the deterministic identity of a resolvable subject
 * in the world model.
 *
 * Keys are opaque canonical-JSON tuples, so they are collision-free for any
 * entity id / property name / type key values:
 * - entity existence:   `["entity", <entityId>]`
 * - entity property:    `["prop", <entityId>, <propertyName>]`
 * - relation existence: `["rel", <relationType>, <source>, <target>]`
 *
 * The latest live assertion addressing a key is the resolved truth for that
 * key at a given instant (supersession and retraction are honored; see
 * model/reconcile.ts).
 */

export function entityKey(entityId: EntityId): string {
  return canonicalJson(['entity', entityId]);
}

export function propertyKey(entityId: EntityId, property: PropertyName): string {
  return canonicalJson(['prop', entityId, property]);
}

export function relationKey(relationType: TypeKey, source: EntityId, target: EntityId): string {
  return canonicalJson(['rel', relationType, source, target]);
}

/** Derive the reconciliation key addressed by a statement. */
export function statementKey(statement: AssertionStatement): string {
  switch (statement.kind) {
    case 'entity':
      return entityKey(statement.entityId);
    case 'entity-property':
      return propertyKey(statement.entityId, statement.property);
    case 'relation':
      return relationKey(statement.relationType, statement.source, statement.target);
  }
}

/** Deterministic relation id: `rel-<sha256(reconciliation key)>`. */
export function relationKeyId(key: string): string {
  return `rel-${sha256Hex(key)}`;
}

/** Parse a reconciliation key back into its tagged tuple. */
export function parseKey(key: string): readonly [string, ...string[]] | null {
  try {
    const parsed: unknown = JSON.parse(key);
    if (Array.isArray(parsed) && parsed.length >= 1 && parsed.every((part) => typeof part === 'string')) {
      return parsed as unknown as readonly [string, ...string[]];
    }
    return null;
  } catch {
    return null;
  }
}
