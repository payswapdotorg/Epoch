/**
 * Primitive value types of the Canonical World Model.
 *
 * All primitives are JSON-representable: the world model is an in-memory
 * typed graph with deterministic, serializable snapshots, and no primitive
 * requires a custom codec.
 */

/** Identity of an entity (graph node). Opaque, caller-assigned, non-empty. */
export type EntityId = string;

/** Identity of an assertion (the unit of stated truth). Opaque. */
export type AssertionId = string;

/** Identity of a world event (append-only state change record). Opaque. */
export type EventId = string;

/** Identity of a relation (graph edge). Deterministically derived. Opaque. */
export type RelationId = string;

/**
 * Namespaced type key (`namespace:name`, e.g. `core:actor`). The `core`
 * namespace is reserved for the kernel vocabulary; extensions register
 * types under their own namespace.
 */
export type TypeKey = string;

/**
 * A point in time. RFC 3339 / ISO 8601 UTC instant with `Z` suffix
 * (e.g. `2026-02-05T12:00:00.000Z`). String form keeps snapshots
 * deterministic and JSON-native.
 */
export type Instant = string;

/**
 * A JSON value (recursive). Mirrors the runtime `z.json()` validator in the
 * kernel package exactly.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** A JSON object. */
export type JsonObject = { [key: string]: JsonValue };

/**
 * A bag of typed-graph property values keyed by property name. Values are
 * validated against the declaring entity/relation type's property specs
 * where a spec exists; unlisted names are permitted (open-world typing).
 */
export type PropertyBag = Readonly<Record<string, JsonValue>>;

/** Name of a property on an entity or relation. */
export type PropertyName = string;
