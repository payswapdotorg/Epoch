import type { Instant, PropertyBag, PropertyName, TypeKey } from './primitives';

/**
 * Property typing for the typed property/relationship graph.
 *
 * Entity and relation types declare named properties with JSON-representable
 * types. Declared properties are type-checked at write time; undeclared
 * property names are permitted (open-world typing) and validated only as
 * JSON. `required` participates in information-gap analysis: a materialized
 * entity missing a required property raises a `missing-property` gap.
 */

/** The value type of a declared property. */
export type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'json';

/** Specification of a single declared property. */
export interface PropertySpec {
  readonly type: PropertyType;
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
}

/** Where a type definition comes from. */
export type TypeOrigin = 'core' | 'extension';

/**
 * Definition of an entity type (graph node type). Supports single
 * inheritance (`extends`) with property specs merged along the chain
 * (child overrides parent). The `core` namespace is reserved for the kernel
 * vocabulary; extensions register under their own namespace.
 */
export interface EntityTypeDefinition {
  readonly key: TypeKey;
  readonly description?: string | undefined;
  readonly extends?: TypeKey | undefined;
  readonly origin?: TypeOrigin | undefined;
  readonly properties?: Readonly<Record<string, PropertySpec>> | undefined;
}

/**
 * A materialized entity — the task-sufficient read view of a graph node at
 * a specific instant. Entities are resolved by the reconciliation engine
 * from live assertions; they are immutable value objects.
 */
export interface Entity {
  readonly id: string;
  readonly type: TypeKey;
  readonly properties: PropertyBag;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}
