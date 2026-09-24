import { describe, expect, it } from 'vitest';
import { WorldModel } from '../src/index';
import {
  entityAssertion,
  measuredConfidence,
  propertyAssertion,
  provenance,
  relationAssertion,
  stepClock,
} from './helpers';

/**
 * Task-sufficient reconstruction and epistemic gap analysis
 * (requirements R1 + R6): the model reconstructs only what can materially
 * affect decisions, and identifies — without acquiring — the missing
 * information or uncertainty that could change one.
 */

function buildScopeWorld() {
  const { clock, advance } = stepClock();
  const world = WorldModel.create({ clock });
  world.registerEntityType({
    key: 'geo:building',
    extends: 'core:entity',
    properties: {
      floors: { type: 'integer', required: true },
      height: { type: 'number' },
    },
  });
  world.applyAssertion(entityAssertion('site-1', 'core:entity', { name: 'Campus' }));
  advance();
  world.applyAssertion(entityAssertion('b-1', 'geo:building', { floors: 3 }));
  advance();
  world.applyAssertion(entityAssertion('b-2', 'geo:building', { floors: 5 }));
  advance();
  world.applyAssertion(relationAssertion('core:part-of', 'b-1', 'site-1'));
  advance();
  world.applyAssertion(relationAssertion('core:part-of', 'b-2', 'site-1'));
  advance();
  return { world, clock };
}

describe('decisionScope (positive)', () => {
  it('reconstructs the seed entities and their live resolutions', () => {
    const { world } = buildScopeWorld();
    const scope = world.decisionScope({ entities: ['b-1'] });
    expect(scope.entities.map((entity) => entity.id)).toEqual(['b-1']);
    expect(scope.relations).toHaveLength(0); // relationDepth defaults to 0
    const keys = scope.resolutions.map((resolution) => resolution.key);
    expect(keys).toContain(JSON.stringify(['entity', 'b-1']));
    expect(scope.resolutions.every((resolution) => resolution.assertion.status === 'live')).toBe(true);
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.gaps)).toBe(true);
  });

  it('traverses relations up to the requested depth', () => {
    const { world } = buildScopeWorld();
    const depth0 = world.decisionScope({ entities: ['b-1'], relationDepth: 0 });
    expect(depth0.entities.map((entity) => entity.id)).toEqual(['b-1']);
    expect(depth0.relations).toHaveLength(0);

    const depth1 = world.decisionScope({ entities: ['b-1'], relationDepth: 1 });
    expect(depth1.entities.map((entity) => entity.id)).toEqual(['b-1', 'site-1']);
    expect(depth1.relations.map((relation) => `${relation.source}->${relation.target}`)).toEqual([
      'b-1->site-1',
    ]);

    const depth2 = world.decisionScope({ entities: ['site-1'], relationDepth: 2 });
    expect(depth2.entities.map((entity) => entity.id)).toEqual(['b-1', 'b-2', 'site-1']);
    expect(depth2.relations).toHaveLength(2);
  });

  it('reports low-confidence assertions below the required floor', () => {
    const { world } = buildScopeWorld();
    const shaky = world.applyAssertion(
      propertyAssertion('b-1', 'height', 12, { confidence: measuredConfidence(0.3) }),
    );
    void shaky;
    const scope = world.decisionScope({ entities: ['b-1'], requiredConfidence: 0.8 });
    const low = scope.gaps.filter((gap) => gap.kind === 'low-confidence');
    expect(low).toHaveLength(1);
    expect(low[0].observedConfidence).toBe(0.3);
    expect(low[0].requiredConfidence).toBe(0.8);
    expect(low[0].couldChangeDecision).toBe(true);
  });

  it('uses the interval/set upper bound as the best case for materiality', () => {
    const { world } = buildScopeWorld();
    // interval whose upper bound clears the floor -> not low-confidence
    world.applyAssertion(
      propertyAssertion('b-1', 'height', 12, {
        confidence: { distribution: { kind: 'interval', lower: 0.2, upper: 0.9 } },
      }),
    );
    const ok = world.decisionScope({ entities: ['b-1'], requiredConfidence: 0.8 });
    expect(ok.gaps.filter((gap) => gap.kind === 'low-confidence')).toHaveLength(0);

    // set whose best case stays below the floor -> low-confidence
    world.applyAssertion(
      propertyAssertion('b-2', 'height', 30, {
        confidence: { distribution: { kind: 'set', values: [0.1, 0.5] } },
      }),
    );
    const notOk = world.decisionScope({ entities: ['b-2'], requiredConfidence: 0.8 });
    const low = notOk.gaps.filter((gap) => gap.kind === 'low-confidence');
    expect(low).toHaveLength(1);
    expect(low[0].observedConfidence).toBe(0.5);
  });

  it('reports missing required properties of declared types', () => {
    const { world } = buildScopeWorld();
    world.applyAssertion(entityAssertion('b-3', 'geo:building', {})); // floors required but missing
    const scope = world.decisionScope({ entities: ['b-3'] });
    const missing = scope.gaps.filter((gap) => gap.kind === 'missing-property');
    expect(missing).toHaveLength(1);
    expect(missing[0].subject).toBe(JSON.stringify(['prop', 'b-3', 'floors']));
  });

  it('reports evidence-less assertions as unsupported claims', () => {
    const { world } = buildScopeWorld();
    world.applyAssertion(
      propertyAssertion('b-1', 'height', 12, {
        provenance: provenance({ evidence: [] }),
      }),
    );
    const scope = world.decisionScope({ entities: ['b-1'] });
    const unsupported = scope.gaps.filter((gap) => gap.kind === 'unsupported-claim');
    expect(unsupported.length).toBeGreaterThan(0);
    expect(unsupported.every((gap) => gap.couldChangeDecision)).toBe(true);
  });

  it('reports absent seed entities', () => {
    const { world } = buildScopeWorld();
    const scope = world.decisionScope({ entities: ['ghost-1'] });
    const absent = scope.gaps.filter((gap) => gap.kind === 'absent-entity');
    expect(absent).toHaveLength(1);
    expect(absent[0].subject).toBe('ghost-1');
    expect(scope.entities).toHaveLength(0);
  });

  it('binds to a fixed instant through the asOf view', () => {
    const { world, clock } = buildScopeWorld();
    const past = world.asOf(clock());
    const scope = past.decisionScope({ entities: ['site-1'], relationDepth: 2 });
    expect(scope.at).toBe(clock());
    expect(scope.relations).toHaveLength(2);
  });
});

describe('decisionScope (negative)', () => {
  it('rejects empty seed lists and out-of-range parameters', () => {
    const world = WorldModel.create();
    expect(() => world.decisionScope({ entities: [] })).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    expect(() => world.decisionScope({ entities: ['a'], relationDepth: -1 })).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
    expect(() => world.decisionScope({ entities: ['a'], requiredConfidence: 1.5 })).toThrow(
      expect.objectContaining({ code: 'WM_VALIDATION' }),
    );
  });
});
