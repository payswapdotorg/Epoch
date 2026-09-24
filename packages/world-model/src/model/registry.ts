import type {
  EntityTypeDefinition,
  PropertyBag,
  PropertySpec,
  RelationTypeDefinition,
  TypeKey,
} from '@epoch/world-contracts';
import { WorldModelError } from '../errors';
import { deepFreeze } from '../immutable';
import { canonicalJson } from '../canonical';
import {
  EntityTypeDefinitionSchema,
  RelationTypeDefinitionSchema,
} from '../schema';
import { CORE_ENTITY_TYPES, CORE_RELATION_TYPES } from './core-vocabulary';

/**
 * The ontology registry: entity types, relation types, and external
 * mappings, with inheritance-aware property resolution and endpoint
 * assignability.
 *
 * The `core:` namespace is reserved for the kernel vocabulary. Extension
 * registrations under `core:` are rejected with WM_AUTHORITY — extension
 * semantics can never masquerade as kernel semantics (architecture-lock
 * rule: no provider/extension semantics in kernel types).
 */

const CORE_NAMESPACE = 'core';
const MAX_INHERITANCE_DEPTH = 64;

export class TypeRegistry {
  private readonly entityTypes = new Map<TypeKey, EntityTypeDefinition>();
  private readonly relationTypes = new Map<TypeKey, RelationTypeDefinition>();

  constructor() {
    for (const definition of CORE_ENTITY_TYPES) {
      this.registerEntityType(definition, { builtin: true });
    }
    for (const definition of CORE_RELATION_TYPES) {
      this.registerRelationType(definition, { builtin: true });
    }
  }

  registerEntityType(
    definition: EntityTypeDefinition,
    options: { builtin?: boolean } = {},
  ): EntityTypeDefinition {
    const parsed = EntityTypeDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid entity type definition');
    }
    const value = parsed.data;
    const namespace = value.key.split(':')[0];
    const isCore = options.builtin === true;
    if (isCore !== (namespace === CORE_NAMESPACE)) {
      if (isCore) {
        throw new WorldModelError('WM_VALIDATION', 'builtin registrations must use the core namespace');
      }
      throw new WorldModelError(
        'WM_AUTHORITY',
        "the 'core' namespace is reserved for the kernel vocabulary; register extension types under your own namespace",
      );
    }
    if (this.entityTypes.has(value.key)) {
      throw new WorldModelError('WM_CONFLICT', `entity type '${value.key}' is already registered`);
    }
    if (value.extends !== undefined) {
      if (!this.entityTypes.has(value.extends)) {
        throw new WorldModelError('WM_NOT_FOUND', `entity type '${value.key}' extends unknown type '${value.extends}'`);
      }
      this.assertNoInheritanceCycle(value.key, value.extends);
    }
    const stored: EntityTypeDefinition = isCore
      ? value
      : { ...value, origin: 'extension' };
    this.entityTypes.set(value.key, deepFreeze(stored));
    return stored;
  }

  registerRelationType(
    definition: RelationTypeDefinition,
    options: { builtin?: boolean } = {},
  ): RelationTypeDefinition {
    const parsed = RelationTypeDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      throw new WorldModelError('WM_VALIDATION', 'invalid relation type definition');
    }
    const value = parsed.data;
    if (!options.builtin) {
      // Relation types have no namespace restriction beyond the key grammar,
      // but core:* keys stay kernel-owned.
      const namespace = value.key.split(':')[0];
      if (namespace === CORE_NAMESPACE) {
        throw new WorldModelError(
          'WM_AUTHORITY',
          "the 'core' namespace is reserved for the kernel vocabulary; register extension relation types under your own namespace",
        );
      }
    }
    if (this.relationTypes.has(value.key)) {
      throw new WorldModelError('WM_CONFLICT', `relation type '${value.key}' is already registered`);
    }
    for (const endpoint of [value.sourceType, value.targetType]) {
      if (!this.entityTypes.has(endpoint)) {
        throw new WorldModelError(
          'WM_NOT_FOUND',
          `relation type '${value.key}' references unknown entity type '${endpoint}'`,
        );
      }
    }
    this.relationTypes.set(value.key, deepFreeze(value));
    return value;
  }

  getEntityType(key: TypeKey): EntityTypeDefinition | null {
    return this.entityTypes.get(key) ?? null;
  }

  getRelationType(key: TypeKey): RelationTypeDefinition | null {
    return this.relationTypes.get(key) ?? null;
  }

  listEntityTypes(): readonly EntityTypeDefinition[] {
    return [...this.entityTypes.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  listRelationTypes(): readonly RelationTypeDefinition[] {
    return [...this.relationTypes.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  /**
   * Is `candidate` assignable to `target`? Entity-type assignability walks
   * the `extends` chain (a `core:agent` is a `core:actor` is a
   * `core:entity`).
   */
  isEntityAssignable(candidate: TypeKey, target: TypeKey): boolean {
    let current: TypeKey | undefined = candidate;
    let depth = 0;
    while (current !== undefined) {
      if (current === target) return true;
      if (++depth > MAX_INHERITANCE_DEPTH) {
        throw new WorldModelError('WM_TEMPORAL', 'entity type inheritance chain is too deep');
      }
      current = this.entityTypes.get(current)?.extends;
    }
    return false;
  }

  /** Merged property specs along the inheritance chain (child overrides parent). */
  effectiveProperties(key: TypeKey): Readonly<Record<string, PropertySpec>> {
    const chain: EntityTypeDefinition[] = [];
    let current: TypeKey | undefined = key;
    let depth = 0;
    while (current !== undefined) {
      const definition = this.entityTypes.get(current);
      if (definition === undefined) {
        throw new WorldModelError('WM_NOT_FOUND', `unknown entity type '${current}'`);
      }
      chain.unshift(definition);
      if (++depth > MAX_INHERITANCE_DEPTH) {
        throw new WorldModelError('WM_TEMPORAL', 'entity type inheritance chain is too deep');
      }
      current = definition.extends;
    }
    const merged: Record<string, PropertySpec> = {};
    for (const definition of chain) {
      if (definition.properties !== undefined) {
        for (const [name, spec] of Object.entries(definition.properties)) {
          merged[name] = spec;
        }
      }
    }
    return merged;
  }

  /**
   * Validate a property bag against the declaring type's property specs.
   * Declared names are type-checked; unlisted names are open-world.
   */
  validateProperties(bag: PropertyBag, owner: 'entity' | 'relation', typeKey: TypeKey): void {
    const specs =
      owner === 'entity'
        ? this.effectiveProperties(typeKey)
        : (this.relationTypes.get(typeKey)?.properties ?? {});
    for (const [name, value] of Object.entries(bag)) {
      const spec = specs[name];
      if (spec === undefined) continue;
      validatePropertyValue(name, value, spec);
    }
  }

  /** Canonical JSON form of a definition — used for core-vocabulary integrity checks. */
  static canonicalDefinition(definition: EntityTypeDefinition | RelationTypeDefinition): string {
    return canonicalJson(definition);
  }

  private assertNoInheritanceCycle(key: TypeKey, extendsKey: TypeKey): void {
    let current: TypeKey | undefined = extendsKey;
    let depth = 0;
    while (current !== undefined) {
      if (current === key) {
        throw new WorldModelError('WM_CONFLICT', `entity type '${key}' creates an inheritance cycle`);
      }
      if (++depth > MAX_INHERITANCE_DEPTH) {
        throw new WorldModelError('WM_TEMPORAL', 'entity type inheritance chain is too deep');
      }
      current = this.entityTypes.get(current)?.extends;
    }
  }
}

function validatePropertyValue(name: string, value: unknown, spec: PropertySpec): void {
  const fail = (expected: string): never => {
    throw new WorldModelError(
      'WM_VALIDATION',
      `property '${name}' must be ${expected} (declared as ${spec.type})`,
    );
  };
  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string') fail('a string');
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('a finite number');
      return;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) fail('an integer');
      return;
    case 'boolean':
      if (typeof value !== 'boolean') fail('a boolean');
      return;
    case 'json':
      return;
  }
}
