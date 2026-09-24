import type {
  AssertionId,
  EntityId,
  Instant,
  PropertyBag,
  TypeKey,
} from './primitives';
import type { PropertySpec } from './entity';

/** Advisory cardinality of a relation type. */
export type Cardinality = 'one-one' | 'one-many' | 'many-one' | 'many-many';

/**
 * Definition of a relation type (typed graph edge). Endpoints are typed:
 * the entity types of both endpoints must be assignable to the declared
 * source/target types (following entity-type inheritance) at write time.
 */
export interface RelationTypeDefinition {
  readonly key: TypeKey;
  readonly description?: string | undefined;
  readonly sourceType: TypeKey;
  readonly targetType: TypeKey;
  readonly cardinality?: Cardinality | undefined;
  readonly properties?: Readonly<Record<string, PropertySpec>> | undefined;
}

/**
 * A materialized relation — the read view of a typed edge at a specific
 * instant. The relation id is deterministically derived from the
 * (relationType, source, target) triple.
 */
export interface Relation {
  readonly id: string;
  readonly type: TypeKey;
  readonly source: EntityId;
  readonly target: EntityId;
  readonly properties: PropertyBag;
  /** The live assertion establishing this relation view. */
  readonly assertionId: AssertionId;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}
