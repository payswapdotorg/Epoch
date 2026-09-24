import { z } from 'zod';

/**
 * Runtime validators for the contract primitive types
 * (contracts/world/src/primitives.ts).
 */

export const InstantSchema = z
  .string()
  .datetime()
  .meta({
    id: 'urn:epoch:contracts:world:instant',
    title: 'Instant',
    description: 'RFC 3339 UTC instant with Z suffix (e.g. 2026-02-05T12:00:00.000Z).',
  });

export const EntityIdSchema = z
  .string()
  .min(1)
  .max(256)
  .meta({
    id: 'urn:epoch:contracts:world:entity-id',
    title: 'EntityId',
    description: 'Opaque entity identity (graph node), caller-assigned.',
  });

export const AssertionIdSchema = z
  .string()
  .regex(/^ass-[0-9]+$/, 'assertion ids are assigned by the world model as ass-<sequence>')
  .meta({
    id: 'urn:epoch:contracts:world:assertion-id',
    title: 'AssertionId',
  });

export const EventIdSchema = z
  .string()
  .regex(/^evt-[0-9]+$/, 'event ids are assigned by the world model as evt-<sequence>')
  .meta({
    id: 'urn:epoch:contracts:world:event-id',
    title: 'EventId',
  });

export const TypeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, "type keys are 'namespace:name' with lowercase segments")
  .meta({
    id: 'urn:epoch:contracts:world:type-key',
    title: 'TypeKey',
    description: "Namespaced type key (namespace:name). The 'core' namespace is reserved for the kernel vocabulary.",
  });

export const PropertyNameSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/, 'property names are short stable identifiers')
  .meta({
    id: 'urn:epoch:contracts:world:property-name',
    title: 'PropertyName',
  });

export const JsonValueSchema = z.json().meta({
  id: 'urn:epoch:contracts:world:json-value',
  title: 'JsonValue',
});

export const JsonObjectSchema = z.record(z.string(), z.json()).meta({
  id: 'urn:epoch:contracts:world:json-object',
  title: 'JsonObject',
});

export const PropertyBagSchema = z
  .record(z.string().min(1).max(256), z.json())
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:property-bag',
    title: 'PropertyBag',
    description: 'Property values keyed by name; declared names are type-checked, unlisted names are open-world.',
  });
