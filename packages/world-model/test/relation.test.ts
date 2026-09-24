import { describe, expect, it } from 'vitest';
import { WorldModel, relationKeyId, relationKey } from '../src/index';
import { entityAssertion, relationAssertion, stepClock } from './helpers';

describe('relation lifecycle (positive)', () => {
  it('establishes a typed relation between existing entities', () => {
    const { clock } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('site-1', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b-1', 'core:entity', {}));
    world.applyAssertion(relationAssertion('core:part-of', 'b-1', 'site-1'));

    const relation = world.getRelation({ type: 'core:part-of', source: 'b-1', target: 'site-1' });
    expect(relation).not.toBeNull();
    expect(relation?.type).toBe('core:part-of');
    expect(relation?.source).toBe('b-1');
    expect(relation?.target).toBe('site-1');
    // deterministic derived id from the reconciliation key
    const expectedId = relationKeyId(relationKey('core:part-of', 'b-1', 'site-1'));
    expect(relation?.id).toBe(expectedId);
    expect(relation?.id).toMatch(/^rel-[0-9a-f]{64}$/);
    // relation listed with filters
    expect(world.listRelations({ ofEntity: 'b-1' })).toHaveLength(1);
    expect(world.listRelations({ type: 'core:describes' })).toHaveLength(0);
    expect(world.listRelations()).toHaveLength(1);
  });

  it('honors typed endpoints via inheritance (core:model is a core:entity)', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('model-1', 'core:model', {}));
    world.applyAssertion(entityAssertion('thing-1', 'core:entity', {}));
    world.applyAssertion(relationAssertion('core:describes', 'model-1', 'thing-1'));
    expect(world.getRelation({ type: 'core:describes', source: 'model-1', target: 'thing-1' })).not.toBeNull();
    expect(
      world.resolveAssertion(relationKey('core:describes', 'model-1', 'thing-1'))?.status,
    ).toBe('live');
  });

  it('re-asserting a triple updates it while retaining history', () => {
    const { clock, advance } = stepClock();
    const world = WorldModel.create({ clock });
    world.applyAssertion(entityAssertion('a', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b', 'core:entity', {}));
    const first = world.applyAssertion(relationAssertion('core:related-to', 'a', 'b', { weight: 1 }));
    advance();
    const second = world.applyAssertion(
      relationAssertion('core:related-to', 'a', 'b', { weight: 2 }, { supersedes: first.id }),
    );
    expect(second.supersedes).toBe(first.id);
    const relation = world.getRelation({ type: 'core:related-to', source: 'a', target: 'b' });
    expect(relation?.properties).toEqual({ weight: 2 });
    expect(relation?.assertionId).toBe(second.id);
    // full history preserved and queryable
    expect(world.relationHistory('core:related-to', 'a', 'b')).toHaveLength(2);
    expect(world.getAssertion(first.id)?.status).toBe('superseded');
  });

  it('relation properties are validated against relation type specs', () => {
    const world = WorldModel.create();
    world.registerRelationType({
      key: 'geo:anchored-at',
      sourceType: 'core:entity',
      targetType: 'core:entity',
      properties: { offset: { type: 'number' } },
    });
    world.applyAssertion(entityAssertion('a', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b', 'core:entity', {}));
    world.applyAssertion(relationAssertion('geo:anchored-at', 'a', 'b', { offset: 1.5 }));
    expect(world.getRelation({ type: 'geo:anchored-at', source: 'a', target: 'b' })?.properties).toEqual({
      offset: 1.5,
    });
  });
});

describe('relation boundaries (negative)', () => {
  it('rejects relations with unknown relation types', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('a', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b', 'core:entity', {}));
    expect(() => world.applyAssertion(relationAssertion('nope:link', 'a', 'b'))).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
  });

  it('rejects relations whose endpoint types do not match', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('thing-1', 'core:entity', {}));
    world.applyAssertion(entityAssertion('model-1', 'core:model', {}));
    // core:describes requires source core:model
    expect(() => world.applyAssertion(relationAssertion('core:describes', 'thing-1', 'model-1'))).toThrow(
      expect.objectContaining({ code: 'WM_TYPE_MISMATCH' }),
    );
    // core:describes requires target core:entity — model IS an entity, so this passes
    world.applyAssertion(relationAssertion('core:describes', 'model-1', 'thing-1'));
    expect(world.listRelations()).toHaveLength(1);
  });

  it('rejects relations referencing nonexistent endpoints', () => {
    const world = WorldModel.create();
    world.applyAssertion(entityAssertion('a', 'core:entity', {}));
    expect(() => world.applyAssertion(relationAssertion('core:related-to', 'a', 'ghost'))).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
    expect(() => world.applyAssertion(relationAssertion('core:related-to', 'ghost', 'a'))).toThrow(
      expect.objectContaining({ code: 'WM_NOT_FOUND' }),
    );
  });

  it('rejects relation property type violations', () => {
    const world = WorldModel.create();
    world.registerRelationType({
      key: 'geo:anchored-at',
      sourceType: 'core:entity',
      targetType: 'core:entity',
      properties: { offset: { type: 'number' } },
    });
    world.applyAssertion(entityAssertion('a', 'core:entity', {}));
    world.applyAssertion(entityAssertion('b', 'core:entity', {}));
    expect(() => world.applyAssertion(relationAssertion('geo:anchored-at', 'a', 'b', { offset: 'left' }))).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });
});
