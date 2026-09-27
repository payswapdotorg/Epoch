// NAMED POSITIVE: the software entity bindings — W002 type keys bound to
// software concepts; the classification fold; unbound entities are
// undefined (partial data, never a blocker).
import { describe, expect, it } from 'vitest';
import { classifyWorldEntity, SOFTWARE_ENTITY_BINDINGS } from '../src/index';
import { WORLD_ENTITIES } from './fixtures';

describe('NAMED POSITIVE: World Model entity bindings', () => {
  it('every binding references a W002 type key in the software namespace', () => {
    for (const binding of SOFTWARE_ENTITY_BINDINGS) {
      expect(binding.entityTypeKey).toMatch(/^software:[a-z][a-z0-9-]*$/);
      expect(binding.schema).toBe('epoch.pack-software.entity-binding');
      expect(binding.schemaVersion).toBe(1);
    }
  });

  it('the classification fold maps every fixture world entity to its concept', () => {
    for (const entity of WORLD_ENTITIES) {
      const result = classifyWorldEntity(SOFTWARE_ENTITY_BINDINGS, entity);
      expect(result.entityId).toBe(entity.id);
      expect(result.concept).toBeDefined();
    }
  });

  it('the classification fold is deterministic under binding permutation', () => {
    const forward = classifyWorldEntity(SOFTWARE_ENTITY_BINDINGS, {
      id: 'service-checkout',
      type: 'software:service',
    });
    const permuted = classifyWorldEntity([...SOFTWARE_ENTITY_BINDINGS].reverse(), {
      id: 'service-checkout',
      type: 'software:service',
    });
    expect(permuted).toEqual(forward);
  });

  it('an entity whose type carries no binding classifies as undefined (partial data)', () => {
    const result = classifyWorldEntity(SOFTWARE_ENTITY_BINDINGS, {
      id: 'site-warehouse',
      type: 'construction:zone',
    });
    expect(result.concept).toBeUndefined();
  });
});
