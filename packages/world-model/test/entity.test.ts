import { describe, expect, it } from 'vitest';
import { WorldModel, WorldModelError } from '../src/index';
import { entityAssertion, propertyAssertion, stepClock } from './helpers';

describe('entity lifecycle (positive)', () => {
  it('registers the builtin core vocabulary on creation', () => {
    const world = WorldModel.create();
    const keys = world.serialize().entityTypes.map((type) => type.key);
    expect(keys).toContain('core:entity');
    expect(keys).toContain('core:actor');
    expect(keys).toContain('core:agent');
    expect(keys).toContain('core:resource');
    expect(keys).toContain('core:model');
    expect(keys).toContain('core:artifact');
    expect(keys).toContain('core:evidence');
    const relationKeys = world.serialize().relationTypes.map((type) => type.key);
    expect(relationKeys).toContain('core:related-to');
    expect(relationKeys).toContain('core:part-of');
    expect(relationKeys).toContain('core:describes');
  });

  it('creates an entity from an assertion and materializes it', () => {
    const { clock } = stepClock();
    const world = WorldModel.create({ clock });
    const assertion = world.applyAssertion(
      entityAssertion('b-1', 'core:entity', { name: 'Turbine Hall' }),
    );
    expect(assertion.status).toBe('live');
    expect(assertion.statement.kind).toBe('entity');
    const entity = world.getEntity('b-1');
    expect(entity).not.toBeNull();
    expect(entity?.type).toBe('core:entity');
    expect(entity?.properties).toEqual({ name: 'Turbine Hall' });
    expect(entity?.createdAt).toBe(clock());
  });

  it('registers extension entity types with typed properties and inheritance', () => {
    const world = WorldModel.create();
    world.registerEntityType({
      key: 'geo:building',
      extends: 'core:entity',
      properties: { floors: { type: 'integer', required: true }, name: { type: 'string' } },
    });
    world.registerEntityType({
      key: 'geo:hospital',
      extends: 'geo:building',
      properties: { emergencyBeds: { type: 'integer' } },
    });
    const assertion = world.applyAssertion(
      entityAssertion('h-1', 'geo:hospital', { floors: 5, emergencyBeds: 20, name: 'City Hospital' }),
    );
    expect(assertion.status).toBe('live');
    const entity = world.getEntity('h-1');
    expect(entity?.type).toBe('geo:hospital');
    expect(entity?.properties).toEqual({ floors: 5, emergencyBeds: 20, name: 'City Hospital' });
  });

  it('updates a property via a superseding property assertion with history retained', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { height: 10 }));
    advance();
    const second = world.applyAssertion(propertyAssertion('b-1', 'height', 12));
    expect(second.statement.kind).toBe('entity-property');
    expect(world.getEntity('b-1')?.properties).toEqual({ height: 12 });
    // history never discarded
    expect(world.entityHistory('b-1')).toHaveLength(2);
    expect(world.entityHistory('b-1')[0].statement).toMatchObject({ kind: 'entity' });
  });

  it('lists entities filtered by assignable type', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('actor-1', 'core:agent', {}));
    world.applyAssertion(entityAssertion('thing-1', 'core:entity', {}));
    const actors = world.listEntities({ type: 'core:actor' });
    expect(actors.map((entity) => entity.id)).toEqual(['actor-1']); // core:agent IS a core:actor
    expect(world.listEntities()).toHaveLength(2);
  });
});

describe('entity boundaries (negative)', () => {
  it('rejects assertions against unregistered entity types', () => {
    const world = WorldModel.create();
    expect(() => world.applyAssertion(entityAssertion('x', 'nope:missing', {}))).toThrow(WorldModelError);
    expect(() => world.applyAssertion(entityAssertion('x', 'nope:missing', {}))).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
  });

  it('rejects property values that violate declared property types', () => {
    const world = WorldModel.create();
    world.registerEntityType({
      key: 'geo:building',
      properties: { floors: { type: 'integer' } },
    });
    expect(() => world.applyAssertion(entityAssertion('b-1', 'geo:building', { floors: 'many' }))).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    expect(() => world.applyAssertion(entityAssertion('b-1', 'geo:building', { floors: 1.5 }))).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    world.applyAssertion(entityAssertion('b-1', 'geo:building', { floors: 3 }));
    expect(() =>
      world.applyAssertion(propertyAssertion('b-1', 'floors', 'three')),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
  });

  it('allows undeclared properties (open-world typing) while validating JSON shape', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('b-1', 'core:entity', { custom: { nested: [1, true, null] } }));
    expect(world.getEntity('b-1')?.properties).toEqual({ custom: { nested: [1, true, null] } });
  });

  it('rejects property assertions on entities that do not exist', () => {
    const world = WorldModel.create();
    expect(() => world.applyAssertion(propertyAssertion('ghost', 'height', 1))).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
  });

  it('rejects malformed entity ids and statements at the schema level', () => {
    const world = WorldModel.create();
    const goodTail = {
      provenance: { actor: { id: 'a', role: 'human' as const }, method: 'x', evidence: [] },
      confidence: { distribution: { kind: 'point' as const, value: 1 } },
    };
    expect(() =>
      world.applyAssertion({
        statement: { kind: 'entity', entityId: '', entityType: 'core:entity' },
        ...goodTail,
      }),
    ).toThrow(expect.objectContaining({ code: 'WM_VALIDATION' }));
    const unknownKind = {
      statement: { kind: 'portal', entityId: 'x', entityType: 'core:entity' },
      ...goodTail,
    } as unknown as Parameters<typeof world.applyAssertion>[0];
    expect(() => world.applyAssertion(unknownKind)).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });

  it('rejects duplicate, reserved-namespace, and unknown-parent type registrations; cycles are unreachable by construction', () => {
    const world = WorldModel.create();
    world.registerEntityType({ key: 'geo:building' });
    expect(() => world.registerEntityType({ key: 'geo:building' })).toThrow(
      expect.objectContaining({ code: 'WM_CONFLICT' }),
    );
    expect(() => world.registerEntityType({ key: 'core:skyscraper' })).toThrow(
      expect.objectContaining({ code: 'WM_AUTHORITY' }),
    );
    expect(() => world.registerEntityType({ key: 'geo:a', extends: 'geo:missing' })).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
    world.registerEntityType({ key: 'geo:a' });
    world.registerEntityType({ key: 'geo:b', extends: 'geo:a' });
    // The extends graph is a DAG by construction: parents must pre-exist and
    // keys are unique, so a cycle can only ever be attempted via a parent
    // that does not exist yet — rejected as unknown (WM_NOT_FOUND).
    expect(() => world.registerEntityType({ key: 'geo:x', extends: 'geo:x' })).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
  });
});
